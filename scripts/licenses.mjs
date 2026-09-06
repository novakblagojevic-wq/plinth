// Regenerates LICENSES.md from the installed dependency tree (PLINTH_SPEC §2.4:
// every dependency's licence is recorded at the point it is added).
//   npm run licenses
// Direct dependencies are listed first with their role; the transitive
// appendix is grouped by licence so a non-permissive entry stands out.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));

const ROLE = {
  three: 'runtime — the stage renderer (§3, pinned as P-1)',
  '@types/three': 'dev — type definitions for three',
  '@types/node': 'dev — type definitions for the guard scripts',
  typescript: 'dev — strict typecheck (§3)',
  vite: 'dev — bundler and dev/preview server (§3)',
  vitest: 'dev — unit tests and guards (§3)',
  playwright: 'dev — no-network guard (§2.2), later PG capture (§7)',
  lefthook: 'dev — pre-commit typecheck (§3)',
  pixelmatch: 'dev — PG baseline diff (§7)',
  pngjs: 'dev — PNG decode for the PG diff (§7)',
  '@types/pngjs': 'dev — type definitions for pngjs',
};

function licenseOf(name, entry) {
  const p = join(ROOT, 'node_modules', name, 'package.json');
  if (existsSync(p)) {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    const l = j.license ?? j.licenses;
    if (typeof l === 'string') return l;
    if (l && typeof l === 'object' && 'type' in l) return l.type;
    if (Array.isArray(l)) return l.map((x) => x.type ?? x).join(' OR ');
  }
  return entry.license ?? 'UNKNOWN';
}

const direct = { ...pkg.dependencies, ...pkg.devDependencies };
const rows = [];
const transitive = new Map();
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path.startsWith('node_modules/')) continue;
  const name = path.slice('node_modules/'.length);
  if (name.includes('node_modules/')) continue; // nested duplicate versions
  const lic = licenseOf(name, entry);
  if (name in direct) rows.push({ name, version: entry.version, lic });
  else {
    if (!transitive.has(lic)) transitive.set(lic, []);
    transitive.get(lic).push(`${name}@${entry.version}`);
  }
}
rows.sort((a, b) => a.name.localeCompare(b.name));

let md = `# LICENSES

Repository licence: **MIT** (see \`LICENSE\`).

PLINTH_SPEC §2.4: every dependency's licence is recorded here at the point it
is added. Regenerate with \`npm run licenses\` after any \`package.json\` change;
review the diff before committing. Nothing here ships to the user at runtime
except \`three\` — everything else is build and test tooling.

## Direct dependencies

| Package | Version | Licence | Role |
|---|---|---|---|
`;
for (const r of rows) {
  md += `| \`${r.name}\` | ${r.version} | ${r.lic} | ${ROLE[r.name] ?? ''} |\n`;
}
md += `\n## Transitive dependencies (npm lock, by licence)\n\n`;
for (const lic of [...transitive.keys()].sort()) {
  const list = transitive.get(lic).sort();
  md += `### ${lic} (${list.length})\n\n${list.map((n) => `- \`${n}\``).join('\n')}\n\n`;
}
writeFileSync(join(ROOT, 'LICENSES.md'), md);
console.log(`LICENSES.md: ${rows.length} direct, ${[...transitive.values()].flat().length} transitive`);
