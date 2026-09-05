import { PCFSoftShadowMap, WebGLRenderer } from 'three';
import { buildScene } from './scene';

const canvas = document.getElementById('stage');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Plinth: #stage canvas missing');
}

const renderer = new WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;

const { scene, camera, box } = buildScene(window.innerWidth / window.innerHeight);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  box.rotation.y += dt * 0.4;
  renderer.render(scene, camera);
  // First frame is out: the no-network guard (guards/no-network.test.ts)
  // waits on this before it stops counting requests.
  if (!document.documentElement.dataset['plinthReady']) {
    document.documentElement.dataset['plinthReady'] = '1';
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
