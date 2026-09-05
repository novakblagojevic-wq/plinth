/**
 * Drives .claude/hooks/protect-files.py as a subprocess and asserts EXIT
 * CODES, not message text (PLINTH_SPEC §2.5). A hook that prints a reason but
 * exits 0 permits the write; this test is what proves the block is real,
 * regardless of whether the hook is armed in the current session.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const HOOK = join(ROOT, '.claude', 'hooks', 'protect-files.py');

function run(payload: unknown): { status: number | null; stderr: string; stdout: string } {
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const r = spawnSync('python3', [HOOK], { input, encoding: 'utf8', cwd: ROOT });
  return { status: r.status, stderr: r.stderr, stdout: r.stdout };
}

function write(path: string): unknown {
  return { tool_name: 'Write', tool_input: { file_path: join(ROOT, path) }, cwd: ROOT };
}

describe('§2.5 protect-files hook', () => {
  it.each(['PLINTH_SPEC.md', 'LICENSE', 'fixtures/pg/phone-soft-studio.png', 'fixtures/x'])(
    'blocks %s with exit 2 and a reason on stderr',
    (path) => {
      const r = run(write(path));
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/BLOCKED/);
      expect(r.stderr.length).toBeGreaterThan(20);
    },
  );

  it.each(['src/main.ts', 'README.md', 'LICENSES.md', 'guards/denylist.ts', 'fixtures.md'])(
    'permits %s with exit 0',
    (path) => {
      expect(run(write(path)).status).toBe(0);
    },
  );

  it('matches the protected basename anywhere in the tree', () => {
    expect(run(write('docs/PLINTH_SPEC.md')).status).toBe(2);
  });

  it('ignores paths outside the repo', () => {
    const r = run({ tool_name: 'Write', tool_input: { file_path: '/elsewhere/LICENSE' }, cwd: ROOT });
    expect(r.status).toBe(0);
  });

  it('fails open on empty, malformed and path-less payloads', () => {
    expect(run('').status).toBe(0);
    expect(run('not json').status).toBe(0);
    expect(run({ tool_name: 'Bash', tool_input: { command: 'ls' } }).status).toBe(0);
  });
});
