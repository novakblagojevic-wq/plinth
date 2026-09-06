import {
  Box3,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

/**
 * PLINTH_SPEC §4.4.3 — contact shadow. Depth of the device captured from below
 * into a 256² target through an orthographic camera, blurred twice (horizontal
 * then vertical, the second pass at 0.4×), and projected on a transparent plane
 * that is the only floor visual (P-6). Re-rendered only when the device, its
 * spec or the preset changes; zero per-frame cost. (T-P4 research F5.)
 */
export const SHADOW_SIZE = 256;
export const SHADOW_EXTENT = 1.6;
const SECOND_PASS = 0.4;

export interface ContactShadowParams {
  opacity: number;
  /** First-pass blur in texels; the second pass is 0.4× this. */
  blur: number;
}

export class ContactShadow {
  readonly group = new Group();
  readonly plane: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly target = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE);
  private readonly blurTarget = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE);
  private readonly depthMaterial = new MeshDepthMaterial();
  private readonly hBlur = new ShaderMaterial(HorizontalBlurShader);
  private readonly vBlur = new ShaderMaterial(VerticalBlurShader);
  private readonly blurScene = new Scene();
  private readonly blurQuad: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly blurCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private params: ContactShadowParams = { opacity: 0.5, blur: 2.5 };

  constructor() {
    this.group.name = 'contact-shadow';
    this.target.texture.generateMipmaps = false;
    this.blurTarget.texture.generateMipmaps = false;

    // Depth → darkness: near the floor is dark, the top of the device fades out.
    this.depthMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'gl_FragColor = vec4( vec3( 0.0 ), 1.0 - fragCoordZ );',
      );
    };

    this.plane = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        map: this.target.texture,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    );
    this.plane.name = 'shadow-plane';
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.scale.y = -1; // the capture looks up from below; mirror it back
    this.plane.position.y = 0.0002;
    this.group.add(this.plane);

    this.camera.rotation.x = Math.PI / 2; // look up
    this.group.add(this.camera);

    this.blurQuad = new Mesh(new PlaneGeometry(2, 2), this.hBlur);
    this.blurScene.add(this.blurQuad);
    this.hBlur.toneMapped = false;
    this.vBlur.toneMapped = false;
  }

  setParams(params: ContactShadowParams): void {
    this.params = params;
    this.plane.material.opacity = params.opacity;
  }

  /** Fit the capture footprint to the device bounds (world space, min.y = 0). */
  fit(bounds: Box3): void {
    const size = bounds.getSize(new Vector3());
    const centre = bounds.getCenter(new Vector3());
    const w = Math.max(size.x, 0.01) * SHADOW_EXTENT;
    const d = Math.max(size.z, 0.01) * SHADOW_EXTENT;
    this.group.position.set(centre.x, 0, centre.z);
    this.plane.scale.set(w, -d, 1);
    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = d / 2;
    this.camera.bottom = -d / 2;
    this.camera.near = 0;
    this.camera.far = Math.max(bounds.max.y, 0.01);
    this.camera.updateProjectionMatrix();
  }

  /** Capture and blur. Call after fit() and whenever the device or preset changes. */
  render(renderer: WebGLRenderer, scene: Scene): void {
    const background = scene.background;
    const environment = scene.environment;
    const target = renderer.getRenderTarget();
    const clearAlpha = renderer.getClearAlpha();

    scene.background = null;
    scene.environment = null;
    scene.overrideMaterial = this.depthMaterial;
    this.plane.visible = false;
    renderer.setClearAlpha(0);
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, this.camera);
    scene.overrideMaterial = null;
    this.plane.visible = true;

    this.blur(renderer, this.params.blur);
    this.blur(renderer, this.params.blur * SECOND_PASS);

    renderer.setRenderTarget(target);
    renderer.setClearAlpha(clearAlpha);
    scene.background = background;
    scene.environment = environment;
  }

  private blur(renderer: WebGLRenderer, texels: number): void {
    this.blurQuad.material = this.hBlur;
    this.hBlur.uniforms['tDiffuse']!.value = this.target.texture;
    this.hBlur.uniforms['h']!.value = texels / SHADOW_SIZE;
    renderer.setRenderTarget(this.blurTarget);
    renderer.render(this.blurScene, this.blurCamera);

    this.blurQuad.material = this.vBlur;
    this.vBlur.uniforms['tDiffuse']!.value = this.blurTarget.texture;
    this.vBlur.uniforms['v']!.value = texels / SHADOW_SIZE;
    renderer.setRenderTarget(this.target);
    renderer.render(this.blurScene, this.blurCamera);
  }

  dispose(): void {
    this.target.dispose();
    this.blurTarget.dispose();
    this.depthMaterial.dispose();
    this.hBlur.dispose();
    this.vBlur.dispose();
    this.plane.geometry.dispose();
    this.plane.material.dispose();
    this.blurQuad.geometry.dispose();
  }
}
