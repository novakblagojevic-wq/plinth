import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * T-P1 placeholder scene: one lit rounded box resting on a plane.
 *
 * This is a renderer smoke test for the deploy, nothing more. No device
 * geometry, no panel, no presets (those are T-P2+). Kept renderer-free so it
 * can be built and inspected in Node by a unit test.
 */
export interface PlaceholderScene {
  scene: Scene;
  camera: PerspectiveCamera;
  box: Mesh<BoxGeometry, MeshStandardMaterial>;
  plane: Mesh<PlaneGeometry, MeshStandardMaterial>;
}

export const BOX_SIZE = 1;
export const BOX_RADIUS = 0.12;

export function buildScene(aspect: number): PlaceholderScene {
  const scene = new Scene();
  scene.background = new Color(0x14161a);

  const camera = new PerspectiveCamera(35, aspect, 0.1, 50);
  camera.position.set(2.6, 2.0, 3.4);
  camera.lookAt(0, 0.35, 0);

  const box = new Mesh(
    new RoundedBoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE, 6, BOX_RADIUS),
    new MeshStandardMaterial({ color: 0xd9dde3, metalness: 0.1, roughness: 0.45 }),
  );
  box.name = 'box';
  box.position.y = BOX_SIZE / 2;
  box.castShadow = true;
  scene.add(box);

  const plane = new Mesh(
    new PlaneGeometry(12, 12),
    new MeshStandardMaterial({ color: 0x2a2e35, metalness: 0, roughness: 0.9 }),
  );
  plane.name = 'plane';
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  const key = new DirectionalLight(0xffffff, 3);
  key.name = 'key';
  key.position.set(3, 5, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const fill = new AmbientLight(0xffffff, 0.35);
  fill.name = 'fill';
  scene.add(fill);

  return { scene, camera, box, plane };
}
