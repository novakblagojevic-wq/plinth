import {
  Box3, Color, DirectionalLight, Group, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Scene,
  SRGBColorSpace, Texture, Vector3,
} from 'three';
import { advanceTransition, clampOrbit, clonePose, clonePoseSnapshot, type PoseSnapshot, directionToOrbit, isPoseId, isWideDevice, orbitToDirection, poseValue, type PoseId, type PoseSelection, type PoseTransition, type PoseValue } from './camera/poses';
import { buildDevice, type DeviceRig } from './devices/build';
import { isDeviceId, presetSpec, type DeviceId } from './devices/presets';
import { invariantViolations, shapeHash, type DeviceSpec } from './devices/spec';
import { isSceneId, SCENE_PRESETS, type SceneId, type ScenePreset } from './scene/presets';
import { paddedDistance, validateOutputPad } from './output';
import type { FitMode, ImageMeta, ImageState } from './screen/types';

export interface StageSettings {
  device: DeviceId; spec: DeviceSpec; pose: PoseSelection; custom: PoseSnapshot;
  aspect: number; outputPad: number; fit: FitMode; pad: number; padColor: string;
}
export interface PreparedStage { commit(): void; dispose(): void }

/** Renderer-free scene state; interactive scheduling is owned by camera/controller.ts. */
export interface Stage {
  snapshot(): StageSettings;
  isTransitioning(): boolean;
  withOutputCamera<T>(aspect: number, capture: () => T): T;
  releaseGpuResources(): void;
  restoreImageTexture(): void;
  prepareSettings(next: StageSettings, immediate?: boolean, changePose?: boolean): PreparedStage;
  onStateChange(cb: (reason: string) => void): () => void;
  dispose(): void;
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
  let rig: DeviceRig = buildDevice(presetSpec(id), id === 'browser', id !== 'browser' && id !== 'card');
  rig.group.name = 'device-rig';
  posePivot.add(rig.group);
  let localGeometry: readonly number[] = cachedLocalGeometry(rig.group, id, rig.spec);
  let display: PoseValue = poseValue('hero', id);
  let selected: PoseSelection = 'hero';
  let transition: PoseTransition | null = null;
  let worldBounds = new Box3();
  let image: { bitmap: ImageBitmap; texture: Texture; meta: ImageMeta } | null = null;
  let imageTextureReleased = false;
  let fit: FitMode = 'contain';
  let pad = 0;
  let outputPad = 0;
  let disposed = false;
  const stateListeners = new Set<(reason: string) => void>();
  const stateChanged = (reason: string): void => { for (const cb of stateListeners) cb(reason); };
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
  function calculateFrame(aspect: number, worldBoundsArg = worldBounds, device = id, pose = display, padding = outputPad): CameraFrame {
    const worldBounds = worldBoundsArg;
    const size = worldBounds.getSize(new Vector3());
    const target = worldBounds.getCenter(new Vector3());
    const fov0 = isWideDevice(device) ? WIDE_SCREEN_FOV : CAMERA_FOV;
    const responsive = Math.max(0, Math.min(1, REFERENCE_ASPECT / aspect - 1));
    const fov = fov0 + 4 * responsive;
    const verticalTangent = Math.tan((fov * Math.PI) / 360);
    const horizontalTangent = verticalTangent * aspect;
    if (!Number.isFinite(verticalTangent) || !Number.isFinite(horizontalTangent)
      || verticalTangent <= 0 || horizontalTangent <= 0) {
      throw new Error('Unable to frame device safely.');
    }
    // P-15 changes only the phone's reference fill; safe framing still follows.
    const referenceFill = device === 'phone' ? 0.82 : FRAME_FILL;
    const referenceFit = Math.max(size.y, size.x / REFERENCE_ASPECT, size.z / REFERENCE_ASPECT) / referenceFill;
    const referenceDist = referenceFit / 2 / Math.tan((CAMERA_FOV * Math.PI) / 360) + Math.max(size.z, size.x) / 2;
    const lensScale = Math.tan((CAMERA_FOV * Math.PI) / 360) / Math.tan((fov0 * Math.PI) / 360);
    const candidate = new PerspectiveCamera(fov, aspect, 0.01, 50);
    candidate.position.copy(target).addScaledVector(pose.direction, referenceDist * lensScale);
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
    distance = paddedDistance(distance, padding);
    if (!Number.isFinite(distance) || distance <= 0) throw new Error('Unable to frame device safely.');
    candidate.position.copy(target).addScaledVector(pose.direction, distance);
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
    installFrame(next);
  }
  function installFrame(next: CameraFrame): void {
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

  try { applyPreset(); applyPose(display); } catch (error) { rig.dispose(); scene.clear(); throw error; }

  const api: Stage = {
    scene, camera, key,
    withOutputCamera(aspect, capture) {
      if (disposed || !Number.isFinite(aspect) || aspect <= 0) throw new Error('Invalid output camera.');
      const next = calculateFrame(aspect); const saved = camera.clone();
      try { installFrame(next); return capture(); }
      finally { camera.copy(saved, false); }
    },
    releaseGpuResources() {
      const resources = new Set<{ dispose(): void }>();
      scene.traverse(object => { if (object instanceof Mesh) {
        resources.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
      } });
      if (image && !imageTextureReleased) { resources.add(image.texture); imageTextureReleased = true; }
      const errors: unknown[] = [];
      for (const resource of resources) try { resource.dispose(); } catch(error) { errors.push(error); }
      if (errors.length) throw new AggregateError(errors, 'GPU resource release failed.');
    },
    restoreImageTexture() {
      if (disposed) throw new Error('Stage is disposed.');
      if (image) {
        const old = image.texture;
        const texture = new Texture(image.bitmap); texture.colorSpace = SRGBColorSpace;
        texture.flipY = false; texture.needsUpdate = true; image.texture = texture;
        bindImage(); if (!imageTextureReleased) old.dispose(); imageTextureReleased = false;
      }
      scene.traverse(object => {
        if (object instanceof Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.needsUpdate = true;
      });
    },
    isTransitioning: () => transition !== null,
    snapshot: () => ({ device: id, spec: { ...rig.spec }, pose: selected, custom: { ...clonePose(display), position: posePivot.position.clone() },
      aspect: camera.aspect, outputPad, fit, pad, padColor }),
    onStateChange(cb) { stateListeners.add(cb); return () => { stateListeners.delete(cb); }; },
    dispose() {
      if (disposed) return; disposed = true;
      stateListeners.clear(); geometryListeners.clear(); deviceListeners.clear();
      rig.dispose(); if (!imageTextureReleased) image?.texture.dispose(); image?.bitmap.close(); image = null;
      scene.clear();
    },
    prepareSettings(next, immediate = false, changePose = false) {
      if (disposed) throw new Error('Stage is disposed.');
      next = { ...next, spec: { ...next.spec }, custom: clonePoseSnapshot(next.custom) };
      if (!isDeviceId(next.device)) throw new Error('Unknown device.');
      const numeric = [next.spec.w, next.spec.h, next.spec.depth, next.spec.cornerRadius, next.spec.bezel, next.spec.screenInset, next.spec.frameMetalness, next.spec.frameRoughness, next.spec.glassClearcoat, next.spec.hingeAngle];
      if (numeric.some(value => !Number.isFinite(value)) || invariantViolations(next.spec).length
        || !['none', 'plate', 'hinge'].includes(next.spec.standType)
        || [next.spec.frameMetalness, next.spec.frameRoughness, next.spec.glassClearcoat].some(value => value < 0 || value > 1)) throw new Error('Invalid device spec.');
      if (next.pose !== null && !isPoseId(next.pose)) throw new Error('Unknown pose.');
      if (!Number.isFinite(next.aspect) || next.aspect <= 0) throw new Error('Invalid aspect.');
      validateOutputPad(next.outputPad);
      if (!['contain', 'cover'].includes(next.fit) || !Number.isFinite(next.pad) || next.pad < 0 || next.pad > 0.25
        || !/^#[0-9a-f]{6}$/i.test(next.padColor)) throw new Error('Invalid image settings.');
      const custom = next.custom;
      if ([...custom.rotation.toArray(), ...custom.direction.toArray(), ...custom.position.toArray()].some(value => !Number.isFinite(value))
        || Math.abs(custom.rotation.length() - 1) > 1e-6 || Math.abs(custom.direction.length() - 1) > 1e-6) throw new Error('Invalid custom pose.');
      const orbit = directionToOrbit(custom.direction);
      const legal = clampOrbit(orbit.azimuth, orbit.elevation);
      if (Math.abs(orbit.azimuth - legal.azimuth) > 1e-9 || Math.abs(orbit.elevation - legal.elevation) > 1e-9) throw new Error('Invalid custom orbit.');
      const shapeChanged = next.device !== id || shapeHash(next.spec) !== shapeHash(rig.spec);
      let candidateRig: DeviceRig | null = null;
      let committed = false;
      try {
        if (shapeChanged) {
          candidateRig = buildDevice(next.spec, next.device === 'browser', next.device !== 'browser' && next.device !== 'card');
          if (image) candidateRig.setImage(image.texture, { w: image.meta.width, h: image.meta.height });
          candidateRig.setImageFit(next.fit, next.pad, next.padColor);
        }
        const points = candidateRig ? cachedLocalGeometry(candidateRig.group, next.device, next.spec) : localGeometry;
        const target = next.pose ? poseValue(next.pose, next.device) : clonePose(custom);
        let nextDisplay = clonePose(display);
        let nextTransition = transition;
        if (changePose) {
          nextTransition = immediate || next.pose === null ? null : { start: clonePose(display), target, elapsed: 0 };
          if (!nextTransition) nextDisplay = target;
        } else if (next.device !== id && next.pose) {
          if (transition) nextTransition = { start: clonePose(display), target, elapsed: 0 };
          else nextDisplay = target;
        }
        const geometryDirty = shapeChanged || !sameRotation(display, nextDisplay);
        const pivot = new Group(); pivot.quaternion.copy(nextDisplay.rotation);
        const raw = boundsFromLocal(points, pivot); const centre = raw.getCenter(new Vector3());
        pivot.position.set(-centre.x, -raw.min.y, -centre.z);
        const bounds = boundsFromLocal(points, pivot);
        const framing = calculateFrame(next.aspect, bounds, next.device, nextDisplay, next.outputPad);
        // Validate the endpoint too before beginning a live transition.
        if (nextTransition) {
          const end = new Group(); end.quaternion.copy(target.rotation);
          const rawEnd = boundsFromLocal(points, end); const c = rawEnd.getCenter(new Vector3());
          end.position.set(-c.x, -rawEnd.min.y, -c.z);
          calculateFrame(next.aspect, boundsFromLocal(points, end), next.device, target, next.outputPad);
        }
        return {
          commit() {
            if (committed) return;
            committed = true;
            const previous = rig;
            if (candidateRig) {
              posePivot.remove(previous.group); rig = candidateRig; rig.group.name = 'device-rig';
              posePivot.add(rig.group);
            } else rig.update(next.spec);
            id = next.device; selected = next.pose; display = nextDisplay; transition = nextTransition;
            localGeometry = points; worldBounds = bounds; outputPad = next.outputPad;
            fit = next.fit; pad = next.pad; padColor = next.padColor.toLowerCase();
            posePivot.position.copy(pivot.position); posePivot.quaternion.copy(pivot.quaternion);
            scene.updateMatrixWorld(true); installFrame(framing); bindImage();
            if (candidateRig) previous.dispose();
            if (geometryDirty) changed();
            deviceChanged(); stateChanged('settings');
          },
          dispose() { if (!committed) { candidateRig?.dispose(); candidateRig = null; } },
        };
      } catch (error) { candidateRig?.dispose(); throw error; }
    },
    setDevice(next) {
      if (!isDeviceId(next)) throw new Error('Unknown device.');
      if (next === id) return;
      // Do not let a previous world correction become input to the next builder run.
      posePivot.position.set(0, 0, 0);
      posePivot.quaternion.identity();
      posePivot.remove(rig.group);
      rig.dispose();
      id = next;
      rig = buildDevice(presetSpec(id), id === 'browser', id !== 'browser' && id !== 'card');
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
      if (!imageTextureReleased) previous?.texture.dispose(); imageTextureReleased = false;
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
  for (const name of ['setDevice', 'setSpec', 'setAspect', 'setScene', 'setPose', 'advancePose', 'orbit', 'setImage', 'setFit', 'setPad', 'setPadColor'] as const) {
    const method = api[name] as (...args: never[]) => unknown;
    Object.assign(api, { [name]: (...args: never[]) => { const result = method(...args); stateChanged(name); return result; } });
  }
  return api;
}
