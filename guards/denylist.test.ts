/**
 * Guard for PLINTH_SPEC §2.1 (no brands). Greps src/ and README.md against
 * guards/denylist.ts. Any hit fails CI.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DENYLIST, scan } from './denylist';

const ROOT = join(import.meta.dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe('§2.1 denylist guard', () => {
  it('lists a real denylist', () => {
    expect(DENYLIST.length).toBeGreaterThan(50);
  });

  it('catches product and manufacturer names (guard self-test)', () => {
    const samples = [
      'the iPhone 15 preset',
      'a MacBook Pro frame',
      'Galaxy Tab',
      'Pixel 9 Pro',
      'Surface Pro 9',
      'Samsung style bezel',
      'ThinkPad hinge',
      'Retina display',
      'Dynamic Island cut-out',
      'an HP laptop',
      'LG monitor',
    ];
    for (const s of samples) {
      expect(scan(s, 'sample'), s).not.toHaveLength(0);
    }
  });

  it('does not trip on ordinary 3D vocabulary (guard self-test)', () => {
    const samples = [
      'renderer.setPixelRatio(1)',
      'surface roughness and surface normals',
      'pixel diff between exports',
      'const mate = a.clone()',
      'the nord colour theme',
      'blade of grass',
      'legion of tests',
      'a swift transition',
      'chrome and firefox',
      'this shell has a helper',
    ];
    for (const s of samples) {
      expect(scan(s, 'sample'), s).toHaveLength(0);
    }
  });

  it('src/ and README.md are clean', () => {
    const files = [...walk(join(ROOT, 'src')), join(ROOT, 'README.md')];
    const hits = files.flatMap((f) =>
      scan(readFileSync(f, 'utf8'), relative(ROOT, f)),
    );
    const report = hits
      .map((h) => `${h.file}:${h.line}  /${h.pattern}/  ${h.text}`)
      .join('\n');
    expect(hits, `§2.1 denylist hits:\n${report}`).toHaveLength(0);
  });
});
