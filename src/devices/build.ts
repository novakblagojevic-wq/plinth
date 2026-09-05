import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Shape,
  Vector3,
} from 'three';
import { screenRect, shapeHash, type DeviceSpec } from './spec';

/**
 * PLINTH_SPEC §4.2 — builds a generic parametric slab from a `DeviceSpec`.
 *
 * Every dimension is read from the spec. The only constants are the ratios
 * below, which the spec does not define (browser title bar, hinge base plate,
 * stand plate, edge rounding). They live in one place so a P-entry can promote
 * any of them to a `DeviceSpec` field later without a hunt.
 *
 * Construction (all in metres, device local frame: x right, y up, z toward
 * the viewer, front face at z = depth):
 *   frame     — ExtrudeGeometry of the rounded outline with the screen opening
 *               as a hole, bevelled on both faces. The bevel makes the outer
 *               contour grow and the hole shrink between cap and wall, so the
 *               shape is authored `bevel` smaller / the hole `bevel` larger and
 *               the WALLS come out at exactly w × h and the opening at exactly
 *               the screen rect. Bounding box is exact: w × h × depth.
 *   backplate — a box behind the opening so the recess has a floor.
 *   screen    — a flat rectangle at `depth − screenInset`, dark placeholder.
 *               The texture and the SDF corner mask are T-P3 (§4.1).
 *   base      — `hinge` only: a second extruded slab lying flat, the screen
 *               slab pivoting at its back edge by `hingeAngle`.
 *   plate     — `plate` only: a thin slab the device stands on.
 */
export const BUILDER_RATIOS = {
  /** Edge rounding = min(edgeBevel × depth, edgeBevelOfBezel × bezel). */
  edgeBevel: 0.3,
  edgeBevelOfBezel: 0.35,
  bevelSegments: 3,
  curveSegments: 16,
  /** Browser title bar height as a fraction of h; dots sized from the bar. */
  browserBarHeight: 0.07,
  browserDotRadius: 0.22,
  browserDotPitch: 0.7,
  /** Hinge base plate: z-extent × h, thickness × depth. */
  baseDepth: 0.95,
  baseThickness: 2.0,
  /** Stand plate: z-extent × h, thickness × depth. */
  plateDepth: 0.5,
  plateThickness: 1.0,
  /** Gap that keeps coplanar faces from z-fighting. */
  gap: 0.0001,
} as const;

export interface DeviceRig {
  group: Group;
  frame: Mesh;
  screen: Mesh;
  /** Visible screen rectangle in metres (browser excludes the title bar). */
  screenSize: { w: number; h: number };
  /** World-aligned bounds after placement (min.y === 0). */
  bounds: Box3;
  spec: DeviceSpec;
  /** Re-apply a spec: geometry is rebuilt only when a shape field changed. */
  update(spec: DeviceSpec): void;
  dispose(): void;
}

function roundedRect(w: number, h: number, r: number, path: Shape | Path): void {
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(Math.max(r, 0), w / 2, h / 2);
  path.moveTo(x + rr, y);
  path.lineTo(x + w - rr, y);
  if (rr > 0) path.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + h - rr);
  if (rr > 0) path.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  path.lineTo(x + rr, y + h);
  if (rr > 0) path.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + rr);
  if (rr > 0) path.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
  path.closePath();
}

interface SlabOpts {
  w: number;
  h: number;
  depth: number;
  radius: number;
  bevel: number;
  hole?: { w: number; h: number; radius: number };
}

/** Extruded rounded slab spanning x∈[−w/2,w/2], y∈[−h/2,h/2], z∈[0,depth]. */
function slabGeometry(o: SlabOpts): ExtrudeGeometry {
  const b = Math.min(o.bevel, o.depth / 2 - 1e-6, o.radius);
  const shape = new Shape();
  roundedRect(o.w - 2 * b, o.h - 2 * b, o.radius - b, shape);
  if (o.hole) {
    const hole = new Path();
    roundedRect(o.hole.w + 2 * b, o.hole.h + 2 * b, o.hole.radius + b, hole);
    shape.holes.push(hole);
  }
  const g = new ExtrudeGeometry(shape, {
    depth: o.depth - 2 * b,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: 0,
    bevelSegments: BUILDER_RATIOS.bevelSegments,
    curveSegments: BUILDER_RATIOS.curveSegments,
    steps: 1,
  });
  g.translate(0, 0, b); // ExtrudeGeometry spans z∈[−b, depth−b]; shift to [0, depth]
  g.computeVertexNormals();
  return g;
}

function edgeBevel(spec: DeviceSpec, depth: number): number {
  return Math.min(BUILDER_RATIOS.edgeBevel * depth, BUILDER_RATIOS.edgeBevelOfBezel * spec.bezel);
}

interface Materials {
  frame: MeshStandardMaterial;
  screen: MeshStandardMaterial;
  bar: MeshStandardMaterial;
  dot: MeshStandardMaterial;
}

function makeMaterials(spec: DeviceSpec): Materials {
  return {
    frame: new MeshStandardMaterial({
      color: 0xd9dde3,
      metalness: spec.frameMetalness,
      roughness: spec.frameRoughness,
    }),
    screen: new MeshStandardMaterial({ color: 0x0f1115, metalness: 0, roughness: 0.55 }),
    bar: new MeshStandardMaterial({ color: 0xeceff3, metalness: 0, roughness: 0.8 }),
    dot: new MeshStandardMaterial({ color: 0xb4bac2, metalness: 0, roughness: 0.8 }),
  };
}

/** Builds the slab-with-screen assembly into `parent`. Returns the screen mesh and size. */
function buildSlab(
  parent: Group,
  spec: DeviceSpec,
  mats: Materials,
  browser: boolean,
): { frame: Mesh; screen: Mesh; screenSize: { w: number; h: number } } {
  const open = screenRect(spec);
  const bevel = edgeBevel(spec, spec.depth);

  const frame = new Mesh(
    slabGeometry({
      w: spec.w,
      h: spec.h,
      depth: spec.depth,
      radius: spec.cornerRadius,
      bevel,
      hole: open,
    }),
    mats.frame,
  );
  frame.name = 'frame';
  parent.add(frame);

  const recess = spec.depth - spec.screenInset;
  const plateDepth = recess - 2 * BUILDER_RATIOS.gap;
  // Covers the opening at the back cap (open + 2·bevel) and never exceeds the walls.
  const backplate = new Mesh(
    new BoxGeometry(
      Math.min(open.w + 2 * bevel, spec.w - 2 * bevel),
      Math.min(open.h + 2 * bevel, spec.h - 2 * bevel),
      plateDepth,
    ),
    mats.frame,
  );
  backplate.name = 'backplate';
  backplate.position.z = BUILDER_RATIOS.gap + plateDepth / 2;
  parent.add(backplate);

  let screenW = open.w;
  let screenH = open.h;
  let screenY = 0;
  if (browser) {
    const barH = BUILDER_RATIOS.browserBarHeight * spec.h;
    screenH = open.h - barH;
    screenY = -barH / 2;
    const bar = new Mesh(new PlaneGeometry(open.w, barH), mats.bar);
    bar.name = 'titlebar';
    bar.position.set(0, open.h / 2 - barH / 2, recess);
    parent.add(bar);
    const r = BUILDER_RATIOS.browserDotRadius * barH;
    const pitch = BUILDER_RATIOS.browserDotPitch * barH;
    const dotH = Math.min(BUILDER_RATIOS.gap * 2, spec.screenInset / 2);
    for (let i = 0; i < 3; i++) {
      const dot = new Mesh(new CylinderGeometry(r, r, dotH, 24), mats.dot);
      dot.name = `dot${i}`;
      dot.rotation.x = Math.PI / 2;
      dot.position.set(-open.w / 2 + barH * 0.6 + i * pitch, bar.position.y, recess + dotH / 2);
      parent.add(dot);
    }
  }

  const screen = new Mesh(new PlaneGeometry(screenW, screenH), mats.screen);
  screen.name = 'screen';
  screen.position.set(0, screenY, recess);
  parent.add(screen);

  return { frame, screen, screenSize: { w: screenW, h: screenH } };
}

function buildInto(root: Group, spec: DeviceSpec, mats: Materials, browser: boolean) {
  root.clear();
  const slab = new Group();
  slab.name = 'slab';
  // Slab local frame is centred in x/y with z∈[0,depth]; lift so y∈[0,h].
  slab.position.y = spec.h / 2;
  const parts = buildSlab(slab, spec, mats, browser);

  if (spec.standType === 'hinge') {
    const baseD = BUILDER_RATIOS.baseDepth * spec.h;
    const baseT = BUILDER_RATIOS.baseThickness * spec.depth;
    const base = new Mesh(
      slabGeometry({
        w: spec.w,
        h: baseD,
        depth: baseT,
        radius: spec.cornerRadius,
        bevel: edgeBevel(spec, baseT),
      }),
      mats.frame,
    );
    base.name = 'base';
    // Lie flat: extrusion (z) becomes thickness (y); shape y becomes −z; hinge line at z=0.
    base.rotation.x = -Math.PI / 2;
    base.position.z = baseD / 2;
    root.add(base);

    const hinge = new Group();
    hinge.name = 'hinge';
    hinge.position.y = baseT;
    hinge.rotation.x = -(spec.hingeAngle - Math.PI / 2);
    hinge.add(slab);
    root.add(hinge);
  } else if (spec.standType === 'plate') {
    const plateD = BUILDER_RATIOS.plateDepth * spec.h;
    const plateT = BUILDER_RATIOS.plateThickness * spec.depth;
    const plate = new Mesh(
      slabGeometry({
        w: spec.w,
        h: plateD,
        depth: plateT,
        radius: spec.cornerRadius,
        bevel: edgeBevel(spec, plateT),
      }),
      mats.frame,
    );
    plate.name = 'plate';
    plate.rotation.x = -Math.PI / 2;
    root.add(plate);
    slab.position.y += plateT;
    root.add(slab);
  } else {
    root.add(slab);
  }

  // Place: lowest point on y=0, centred in x and z.
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root);
  const c = bounds.getCenter(new Vector3());
  root.position.set(-c.x, -bounds.min.y, -c.z);
  root.updateMatrixWorld(true);
  bounds.setFromObject(root);
  return { ...parts, bounds };
}

export function buildDevice(initial: DeviceSpec, browser = false): DeviceRig {
  const group = new Group();
  group.name = 'device';
  const mats = makeMaterials(initial);
  let spec = { ...initial };
  let hash = shapeHash(spec);
  let built = buildInto(group, spec, mats, browser);

  const rig: DeviceRig = {
    group,
    frame: built.frame,
    screen: built.screen,
    screenSize: built.screenSize,
    bounds: built.bounds,
    spec,
    update(next) {
      spec = { ...next };
      mats.frame.metalness = spec.frameMetalness;
      mats.frame.roughness = spec.frameRoughness;
      const h = shapeHash(spec);
      if (h !== hash) {
        disposeGeometries(group);
        built = buildInto(group, spec, mats, browser);
        hash = h;
      }
      rig.frame = built.frame;
      rig.screen = built.screen;
      rig.screenSize = built.screenSize;
      rig.bounds = built.bounds;
      rig.spec = spec;
    },
    dispose() {
      disposeGeometries(group);
      group.clear();
      for (const m of Object.values(mats)) m.dispose();
    },
  };
  return rig;
}

function disposeGeometries(root: Group): void {
  root.traverse((o) => {
    if (o instanceof Mesh) o.geometry.dispose();
  });
}
