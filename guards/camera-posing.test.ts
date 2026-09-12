/** T-P5 source contract guard: keep deterministic pose timing and PG isolation. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

describe('T-P5 camera posing contract', () => {
  it('keeps the pure transition fixed-start and the controller outside PG setup', () => {
    const poses = read('src/camera/poses.ts');
    const main = read('src/main.ts');
    expect(poses).toContain('1 - Math.exp(-TRANSITION_LAMBDA * elapsed)');
    expect(poses).toContain('TRANSITION_SECONDS = 0.75');
    expect(poses).toContain('TRANSITION_LAMBDA = 8');
    expect(poses).toContain('AZIMUTH_LIMIT = 75');
    expect(main).toContain('stage.setPose(initialPose, true);');
    expect(main).toContain('if (!pg) {\n    window.addEventListener(\'resize\', resize);');
  });

  it('keeps camera bounds separate from the builder and restores shadow state in finally', () => {
    const stage = read('src/scene.ts');
    const shadow = read('src/scene/contactShadow.ts');
    expect(stage).toContain("posePivot.name = 'device'");
    expect(stage).toContain('collectLocalGeometry');
    expect(stage).toContain('object instanceof InstancedMesh');
    expect(stage).toContain('NDC_MARGIN = 0.9');
    expect(read('src/scene/studio.ts')).toContain('shadow.fit(stage.getWorldBounds())');
    expect(shadow).toContain('try {');
    expect(shadow).toContain('} finally {');
    expect(shadow).toContain('scene.overrideMaterial = overrideMaterial;');
    expect(shadow).toContain('this.plane.visible = planeVisible;');
  });
});
