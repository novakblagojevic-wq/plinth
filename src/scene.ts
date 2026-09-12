import {
  Box3, Color, DirectionalLight, Group, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Scene,
  SRGBColorSpace, Texture, Vector3,
} from 'three';
import { advanceTransition, clampOrbit, clonePose, directionToOrbit, isPoseId, isWideDevice, orbitToDirection, poseValue, type PoseId, type PoseSelection, type PoseTransition, type PoseValue } from './camera/poses';
import { buildDevice, type DeviceRig } from './devices/build';
import { isDeviceId, presetSpec, type DeviceId } from './devices/presets';
import { invariantViolations, shapeHash, type DeviceSpec } from './devices/spec';
import { isSceneId, SCENE_PRESETS, type SceneId, type ScenePreset } from './scene/presets';
import type { FitMode, ImageMeta, ImageState } from './screen/types';

/** Renderer-free scene state; interactive scheduling is owned by camera/controller.ts. */
export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  key: DirectionalLight;
  setDevice(id: DeviceId): void;
  getDevice(): DeviceId;
  getSpec(): DeviceSpec;
  setSpec(spec: DeviceSpec): void;
  setAspect(aspect: number): void;
  setScene(id: SceneId): void;
  getScene(): SceneId;
  getPreset(): ScenePreset;
  getRig(): DeviceRig;
  /** World AABB measured from actual device geometry, excluding the shadow. */
  getWorldBounds(): Box3;
  getFloorMinY(): number;
  setPose(id: PoseId | string, immediate?: boolean): void;
  getPose(): PoseSelection;
  /** Deterministic elapsed-time transition step. */
  advancePose(dt: number): boolean;
  /** A finite pointer delta in radians; a real move selects custom pose. */
  orbit(deltaAzimuth: number, deltaElevation: number): void;
  setImage(bitmap: ImageBitmap, meta: ImageMeta): void;
  setFit(mode: FitMode): void;
  setPad(value: number): void;
  setPadColor(hex: string): void;
  getImage(): ImageState | null;
  /** Legacy device/spec notification; material changes are included for existing consumers. */
  onDeviceChange(cb: () => void): () => void;
  /** World geometry/pose changes only; Studio owns this shadow-invalidating subscription. */
  onGeometryChange(cb: () => void): () => void;
}

export const FRAME_FILL = 0.6;
export const CAMERA_FOV = 32;
export const WIDE_SCREEN_FOV = 24;
const REFERENCE_ASPECT = 1280 / 800;
const NDC_MARGIN = 0.9;
const ROTATION_EPSILON = 1e-12;
const LOCAL_GEOMETRY_CACHE = new Map<string, readonly number[]>();
const MAX_LOCAL_GEOMETRY_CACHE_ENTRIES = 32;

/** Includes InstancedMesh vertices, which Box3.expandByObject does not make exact. */
function meshVertexBounds(root: Group, retainPoints = false): { bounds: Box3; points: number[] } {
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  const points: number[] = [];
  const instance = new Matrix4();
  const transform = new Matrix4();
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const position = object.geometry.getAttribute('position');
    if (!position) return;
    const instances = object instanceof InstancedMesh ? object.count : 1;
    for (let i = 0; i < instances; i++) {
      if (object instanceof InstancedMesh) {
        object.getMatrixAt(i, instance);
        transform.multiplyMatrices(object.matrixWorld, instance);
      } else transform.copy(object.matrixWorld);
      const e = transform.elements;
      for (let v = 0; v < position.count; v++) {
        const x = position.getX(v); const y = position.getY(v); const z = position.getZ(v);
        const w = e[3]! * x + e[7]! * y + e[11]! * z + e[15]!;
        const px = (e[0]! * x + e[4]! * y + e[8]! * z + e[12]!) / w;
        const py = (e[1]! * x + e[5]! * y + e[9]! * z + e[13]!) / w;
        const pz = (e[2]! * x + e[6]! * y + e[10]! * z + e[14]!) / w;
        minX = Math.min(minX, px); minY = Math.min(minY, py); minZ = Math.min(minZ, pz);
        maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); maxZ = Math.max(maxZ, pz);
        if (retainPoints) points.push(px, py, pz);
      }
    }
  });
  if (!Number.isFinite(minX)) throw new Error('Device geometry has no vertices.');
  return { bounds: new Box3(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ)), points };
}

export function geometryWorldBounds(root: Group): Box3 {
  return meshVertexBounds(root).bounds;
}

/** Exact device points cached in pose-pivot local space; refresh after a rebuild. */
function collectLocalGeometry(root: Group): number[] {
  return meshVertexBounds(root, true).points;
}

function cachedLocalGeometry(root: Group, device: DeviceId, spec: DeviceSpec): readonly number[] {
  // shapeHash covers every geometry field; device distinguishes class-specific builders.
  const key = `${device}:${shapeHash(spec)}`;
  const cached = LOCAL_GEOMETRY_CACHE.get(key);
  if (cached) return cached;
  const points = collectLocalGeometry(root);
  // A bounded FIFO keeps the preset hot path fast without retaining every Advanced shape edit.
  if (LOCAL_GEOMETRY_CACHE.size >= MAX_LOCAL_GEOMETRY_CACHE_ENTRIES) {
    const oldest = LOCAL_GEOMETRY_CACHE.keys().next().value;
    if (oldest !== undefined) LOCAL_GEOMETRY_CACHE.delete(oldest);
  }
  LOCAL_GEOMETRY_CACHE.set(key, points);
  return points;
}

function boundsFromLocal(points: readonly number[], pivot: Group): Box3 {
  pivot.updateMatrixWorld(true);
  const e = pivot.matrixWorld.elements;
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i]!; const y = points[i + 1]!; const z = points[i + 2]!;
    const w = e[3]! * x + e[7]! * y + e[11]! * z + e[15]!;
    const px = (e[0]! * x + e[4]! * y + e[8]! * z + e[12]!) / w;
    const py = (e[1]! * x + e[5]! * y + e[9]! * z + e[13]!) / w;
    const pz = (e[2]! * x + e[6]! * y + e[10]! * z + e[14]!) / w;
    minX = Math.min(minX, px); minY = Math.min(minY, py); minZ = Math.min(minZ, pz);
    maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); maxZ = Math.max(maxZ, pz);
  }
  if (!Number.isFinite(minX)) throw new Error('Device geometry has no vertices.');
  return new Box3(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ));
}

function corners(bounds: Box3): Vector3[] {
  const result: Vector3[] = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    result.push(new Vector3(x, y, z));
  }
  return result;
}

function sameRotation(a: PoseValue, b: PoseValue): boolean {
  return 1 - Math.abs(a.rotation.dot(b.rotation)) <= ROTATION_EPSILON;
}

export function createStage(initialDevice: DeviceId, initialScene: SceneId, aspect: number): Stage {
  if (!Number.isFinite(aspect) || aspect <= 0) throw new Error('Aspect must be a positive finite number.');
  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.01, 50);
  const key = new DirectionalLight(0xffffff, 1);
  key.name = 'key';
  scene.add(key);
  const posePivot = new Group();
  // Retain the historic direct scene child name while the rig stays below this external pivot.
  posePivot.name = 'device';
  scene.add(posePivot);

  let id: DeviceId = initialDevice;
  let sceneId: SceneId = initialScene;
  let rig: DeviceRig = buildDevice(presetSpec(id), id === 'browser');
  rig.group.name = 'device-rig';
  posePivot.add(rig.group);
  let localGeometry: readonly number[] = cachedLocalGeometry(rig.group, id, rig.spec);
  let display: PoseValue = poseValue('hero', id);
  let selected: PoseSelection = 'hero';
  let transition: PoseTransition | null = null;
  let worldBounds = new Box3();
  let image: { bitmap: ImageBitmap; texture: Texture; meta: ImageMeta } | null = null;
  let fit: FitMode = 'contain';
  let pad = 0;
  let padColor = '#ffffff';
  const deviceListeners = new Set<() => void>();
  const geometryListeners = new Set<() => void>();
  const changed = (): void => { for (const cb of geometryListeners) cb(); };
  const deviceChanged = (): void => { for (const cb of deviceListeners) cb(); };

  function bindImage(): void {
    if (image) rig.setImage(image.texture, { w: image.meta.width, h: image.meta.height });
    rig.setImageFit(fit, pad, padColor);
  }
  function applyPreset(): void {
    const p = SCENE_PRESETS[sceneId];
    scene.background = new Color(p.background);
    key.color.setRGB(p.key.colour[0], p.key.colour[1], p.key.colour[2]);
    key.intensity = p.key.intensity;
    key.position.set(p.key.position[0], p.key.position[1], p.key.position[2]);
  }
  function applyPose(value: PoseValue): void {
    // The builder owns its local placement. Reset this outer pivot before every measurement.
    posePivot.position.set(0, 0, 0);
    posePivot.quaternion.copy(value.rotation);
    scene.updateMatrixWorld(true);
    const beforeFloor = boundsFromLocal(localGeometry, posePivot);
    const centre = beforeFloor.getCenter(new Vector3());
    posePivot.position.set(-centre.x, -beforeFloor.min.y, -centre.z);
    scene.updateMatrixWorld(true);
    worldBounds = boundsFromLocal(localGeometry, posePivot);
    frame();
  }
  interface CameraFrame {
    aspect: number;
    fov: number;
    near: number;
    far: number;
    position: Vector3;
    quaternion: typeof camera.quaternion;
  }
  function calculateFrame(aspect: number): CameraFrame {
    const size = worldBounds.getSize(new Vector3());
    const target = worldBounds.getCenter(new Vector3());
    const fov0 = isWideDevice(id) ? WIDE_SCREEN_FOV : CAMERA_FOV;
    const responsive = Math.max(0, Math.min(1, REFERENCE_ASPECT / aspect - 1));
    const fov = fov0 + 4 * responsive;
    const verticalTangent = Math.tan((fov * Math.PI) / 360);
    const horizontalTangent = verticalTangent * aspect;
    if (!Number.isFinite(verticalTangent) || !Number.isFinite(horizontalTangent)
      || verticalTangent <= 0 || horizontalTangent <= 0) {
      throw new Error('Unable to frame device safely.');
    }
    const referenceFit = Math.max(size.y, size.x / REFERENCE_ASPECT, size.z / REFERENCE_ASPECT) / FRAME_FILL;
    const referenceDist = referenceFit / 2 / Math.tan((CAMERA_FOV * Math.PI) / 360) + Math.max(size.z, size.x) / 2;
    const lensScale = Math.tan((CAMERA_FOV * Math.PI) / 360) / Math.tan((fov0 * Math.PI) / 360);
    const candidate = new PerspectiveCamera(fov, aspect, 0.01, 50);
    candidate.position.copy(target).addScaledVector(display.direction, referenceDist * lensScale);
    candidate.up.set(0, 1, 0);
    candidate.lookAt(target);
    candidate.updateMatrixWorld(true);
    const referenceDistance = referenceDist * lensScale;
    let distance = referenceDistance;
    const safetyScale = 1 + 1e-9;
    for (const corner of corners(worldBounds)) {
      const local = corner.clone().applyMatrix4(candidate.matrixWorldInverse);
      const offset = referenceDistance + local.z;
      distance = Math.max(
        distance,
        offset + 0.002,
        offset + Math.abs(local.x) * safetyScale / (NDC_MARGIN * horizontalTangent),
        offset + Math.abs(local.y) * safetyScale / (NDC_MARGIN * verticalTangent),
      );
    }
    if (!Number.isFinite(distance) || distance <= 0) throw new Error('Unable to frame device safely.');
    candidate.position.copy(target).addScaledVector(display.direction, distance);
    candidate.lookAt(target);
    candidate.updateMatrixWorld(true);
    let minDepth = Infinity;
    let maxDepth = 0;
    for (const corner of corners(worldBounds)) {
      const local = corner.clone().applyMatrix4(candidate.matrixWorldInverse);
      const depth = -local.z;
      minDepth = Math.min(minDepth, depth);
      maxDepth = Math.max(maxDepth, depth);
    }
    const near = Math.max(0.001, minDepth * 0.5);
    const far = Math.max(near + 0.1, maxDepth * 1.5);
    if (!Number.isFinite(minDepth) || !Number.isFinite(maxDepth) || minDepth <= near || maxDepth >= far) {
      throw new Error('Unable to frame device safely.');
    }
    candidate.near = near;
    candidate.far = far;
    candidate.updateProjectionMatrix();
    for (const corner of corners(worldBounds)) {
      const projected = corner.clone().project(candidate);
      if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || !Number.isFinite(projected.z)
        || Math.abs(projected.x) > NDC_MARGIN || Math.abs(projected.y) > NDC_MARGIN) {
        throw new Error('Unable to frame device safely.');
      }
    }
    return { aspect, fov, near, far, position: candidate.position.clone(), quaternion: candidate.quaternion.clone() };
  }
  function frame(aspect = camera.aspect): void {
    // Calculate entirely off-camera so a rejected aspect leaves the visible state intact.
    const next = calculateFrame(aspect);
    camera.aspect = next.aspect;
    camera.fov = next.fov;
    camera.near = next.near;
    camera.far = next.far;
    camera.position.copy(next.position);
    camera.quaternion.copy(next.quaternion);
    camera.up.set(0, 1, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  applyPreset();
  applyPose(display);

  return {
    scene, camera, key,
    setDevice(next) {
      if (!isDeviceId(next)) throw new Error('Unknown device.');
      if (next === id) return;
      // Do not let a previous world correction become input to the next builder run.
      posePivot.position.set(0, 0, 0);
      posePivot.quaternion.identity();
      posePivot.remove(rig.group);
      rig.dispose();
      id = next;
      rig = buildDevice(presetSpec(id), id === 'browser');
      rig.group.name = 'device-rig';
      posePivot.add(rig.group);
      scene.updateMatrixWorld(true);
      localGeometry = cachedLocalGeometry(rig.group, id, rig.spec);
      bindImage();
      // A completed named pose resolves again for the new device class (for example
      // tablet top versus laptop top). A live transition instead starts from its exact
      // displayed state and retargets the new class-specific endpoint.
      if (transition && selected) transition = { start: clonePose(display), target: poseValue(selected, id), elapsed: 0 };
      else if (selected) display = poseValue(selected, id);
      applyPose(display);
      changed(); deviceChanged();
    },
    getDevice: () => id,
    getSpec: () => ({ ...rig.spec }),
    setSpec(spec) {
      const numeric = [spec.w, spec.h, spec.depth, spec.cornerRadius, spec.bezel, spec.screenInset, spec.frameMetalness, spec.frameRoughness, spec.glassClearcoat, spec.hingeAngle];
      if (numeric.some((value) => !Number.isFinite(value)) || !['none', 'plate', 'hinge'].includes(spec.standType)
        || spec.frameMetalness < 0 || spec.frameMetalness > 1 || spec.frameRoughness < 0 || spec.frameRoughness > 1 || spec.glassClearcoat < 0 || spec.glassClearcoat > 1
        || invariantViolations(spec).length) throw new Error('Invalid device spec.');
      // Material fields update in place. Only a shape change rebuilds exact points,
      // reframes the device, and invalidates the contact shadow.
      const geometryChanged = shapeHash(spec) !== shapeHash(rig.spec);
      if (geometryChanged) {
        posePivot.position.set(0, 0, 0);
        posePivot.quaternion.identity();
        scene.updateMatrixWorld(true);
      }
      rig.update(spec);
      if (geometryChanged) {
        localGeometry = cachedLocalGeometry(rig.group, id, rig.spec);
        applyPose(display);
        changed(); deviceChanged();
      } else {
        deviceChanged();
      }
    },
    setAspect(a) {
      if (!Number.isFinite(a) || a <= 0) throw new Error('Aspect must be a positive finite number.');
      frame(a);
    },
    setScene(next) { if (!isSceneId(next)) throw new Error('Unknown scene.'); sceneId = next; applyPreset(); },
    getScene: () => sceneId,
    getPreset: () => SCENE_PRESETS[sceneId],
    getRig: () => rig,
    getWorldBounds: () => worldBounds.clone(),
    getFloorMinY: () => worldBounds.min.y,
    setPose(next, immediate = false) {
      if (!isPoseId(next)) throw new Error('Unknown pose.');
      const target = poseValue(next, id);
      selected = next;
      if (immediate) {
        transition = null;
        const geometryDirty = !sameRotation(display, target);
        display = target;
        if (geometryDirty) { applyPose(display); changed(); }
        else frame();
        return;
      }
      transition = { start: clonePose(display), target, elapsed: 0 };
    },
    getPose: () => selected,
    advancePose(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw new Error('Transition delta must be finite and non-negative.');
      if (!transition || dt === 0) return transition !== null;
      const result = advanceTransition(transition, dt);
      const geometryDirty = !sameRotation(display, result.value);
      transition = result.transition;
      display = result.value;
      if (geometryDirty) { applyPose(display); changed(); }
      else frame();
      return transition !== null;
    },
    orbit(deltaAzimuth, deltaElevation) {
      if (!Number.isFinite(deltaAzimuth) || !Number.isFinite(deltaElevation)) throw new Error('Orbit delta must be finite.');
      if (deltaAzimuth === 0 && deltaElevation === 0) return;
      const orbit = directionToOrbit(display.direction);
      const next = clampOrbit(orbit.azimuth + deltaAzimuth, orbit.elevation + deltaElevation);
      transition = null;
      selected = null;
      display = { rotation: display.rotation.clone(), direction: orbitToDirection(next.azimuth, next.elevation) };
      // Orbit changes only the camera direction; the shadow's world geometry is unchanged.
      frame();
    },
    setImage(bitmap, meta) {
      if (image?.bitmap === bitmap) { image.meta = { ...meta }; bindImage(); return; }
      const previous = image;
      const texture = new Texture(bitmap);
      texture.colorSpace = SRGBColorSpace;
      texture.flipY = false;
      texture.needsUpdate = true;
      image = { bitmap, texture, meta: { ...meta } };
      bindImage();
      previous?.texture.dispose();
      previous?.bitmap.close();
    },
    setFit(mode) {
      if (mode !== 'contain' && mode !== 'cover') throw new Error('Unknown image fit.');
      fit = mode; rig.setImageFit(fit, pad, padColor);
    },
    setPad(value) {
      if (!Number.isFinite(value) || value < 0 || value > 0.25) throw new Error('Padding must be between 0 and 0.25.');
      pad = value; rig.setImageFit(fit, pad, padColor);
    },
    setPadColor(hex) {
      if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Padding colour must be a six-digit hex colour.');
      padColor = hex.toLowerCase(); rig.setImageFit(fit, pad, padColor);
    },
    getImage: () => image ? { ...image.meta, fit, pad, padColor } : null,
    onDeviceChange(cb) { deviceListeners.add(cb); return () => deviceListeners.delete(cb); },
    onGeometryChange(cb) { geometryListeners.add(cb); return () => geometryListeners.delete(cb); },
  };
}
