# LICENSES

Repository licence: **MIT** (see `LICENSE`).

PLINTH_SPEC §2.4: every dependency's licence is recorded here at the point it
is added. Regenerate with `npm run licenses` after any `package.json` change;
review the diff before committing. Nothing here ships to the user at runtime
except `three` — everything else is build and test tooling.

## Direct dependencies

| Package | Version | Licence | Role |
|---|---|---|---|
| `@types/node` | 22.20.1 | MIT | dev — type definitions for the guard scripts |
| `@types/three` | 0.185.4 | MIT | dev — type definitions for three |
| `lefthook` | 2.1.12 | MIT | dev — pre-commit typecheck (§3) |
| `playwright` | 1.63.0 | Apache-2.0 | dev — no-network guard (§2.2), later PG capture (§7) |
| `three` | 0.185.1 | MIT | runtime — the stage renderer (§3, pinned as P-1) |
| `typescript` | 7.0.2 | Apache-2.0 | dev — strict typecheck (§3) |
| `vite` | 8.2.2 | MIT | dev — bundler and dev/preview server (§3) |
| `vitest` | 5.0.0 | MIT | dev — unit tests and guards (§3) |

## Transitive dependencies (npm lock, by licence)

### Apache-2.0 (24)

- `@dimforge/rapier3d-compat@0.12.0`
- `@typescript/typescript-aix-ppc64@7.0.2`
- `@typescript/typescript-darwin-arm64@7.0.2`
- `@typescript/typescript-darwin-x64@7.0.2`
- `@typescript/typescript-freebsd-arm64@7.0.2`
- `@typescript/typescript-freebsd-x64@7.0.2`
- `@typescript/typescript-linux-arm64@7.0.2`
- `@typescript/typescript-linux-arm@7.0.2`
- `@typescript/typescript-linux-loong64@7.0.2`
- `@typescript/typescript-linux-mips64el@7.0.2`
- `@typescript/typescript-linux-ppc64@7.0.2`
- `@typescript/typescript-linux-riscv64@7.0.2`
- `@typescript/typescript-linux-s390x@7.0.2`
- `@typescript/typescript-linux-x64@7.0.2`
- `@typescript/typescript-netbsd-arm64@7.0.2`
- `@typescript/typescript-netbsd-x64@7.0.2`
- `@typescript/typescript-openbsd-arm64@7.0.2`
- `@typescript/typescript-openbsd-x64@7.0.2`
- `@typescript/typescript-sunos-x64@7.0.2`
- `@typescript/typescript-win32-arm64@7.0.2`
- `@typescript/typescript-win32-x64@7.0.2`
- `detect-libc@2.1.2`
- `expect-type@1.4.0`
- `playwright-core@1.63.0`

### BSD-3-Clause (1)

- `source-map-js@1.2.1`

### ISC (2)

- `picocolors@1.1.1`
- `siginfo@2.0.0`

### MIT (59)

- `@jridgewell/resolve-uri@3.1.2`
- `@jridgewell/sourcemap-codec@1.6.0`
- `@jridgewell/trace-mapping@0.3.31`
- `@oxc-project/types@0.148.0`
- `@rolldown/binding-android-arm-eabi@1.2.7`
- `@rolldown/binding-android-arm64@1.2.7`
- `@rolldown/binding-darwin-arm64@1.2.7`
- `@rolldown/binding-darwin-x64@1.2.7`
- `@rolldown/binding-freebsd-x64@1.2.7`
- `@rolldown/binding-linux-arm-gnueabihf@1.2.7`
- `@rolldown/binding-linux-arm64-gnu@1.2.7`
- `@rolldown/binding-linux-arm64-musl@1.2.7`
- `@rolldown/binding-linux-ppc64-gnu@1.2.7`
- `@rolldown/binding-linux-s390x-gnu@1.2.7`
- `@rolldown/binding-linux-x64-gnu@1.2.7`
- `@rolldown/binding-linux-x64-musl@1.2.7`
- `@rolldown/binding-openharmony-arm64@1.2.7`
- `@rolldown/binding-win32-arm64-msvc@1.2.7`
- `@rolldown/binding-win32-x64-msvc@1.2.7`
- `@rolldown/pluginutils@1.0.1`
- `@tweenjs/tween.js@23.1.3`
- `@types/chai@5.2.3`
- `@types/deep-eql@4.0.2`
- `@types/estree@1.0.9`
- `@types/stats.js@0.17.4`
- `@types/webxr@0.5.24`
- `@vitest/mocker@5.0.0`
- `@vitest/spy@5.0.0`
- `assertion-error@2.0.1`
- `chai@6.2.2`
- `es-module-lexer@2.3.2`
- `estree-walker@3.0.3`
- `fdir@6.5.0`
- `fflate@0.8.3`
- `fsevents@2.3.3`
- `lefthook-darwin-arm64@2.1.12`
- `lefthook-darwin-x64@2.1.12`
- `lefthook-freebsd-arm64@2.1.12`
- `lefthook-freebsd-x64@2.1.12`
- `lefthook-linux-arm64@2.1.12`
- `lefthook-linux-x64@2.1.12`
- `lefthook-openbsd-arm64@2.1.12`
- `lefthook-openbsd-x64@2.1.12`
- `lefthook-windows-arm64@2.1.12`
- `lefthook-windows-x64@2.1.12`
- `magic-string@1.2.3`
- `meshoptimizer@1.1.1`
- `nanoid@3.3.18`
- `obug@2.1.4`
- `picomatch@4.0.7`
- `postcss@8.5.28`
- `rolldown@1.2.7`
- `stackback@0.0.2`
- `std-env@4.2.0`
- `tinybench@6.1.4`
- `tinyexec@1.3.0`
- `tinyglobby@0.2.17`
- `undici-types@6.21.0`
- `why-is-node-running@2.3.0`

### MPL-2.0 (12)

- `lightningcss-android-arm64@1.33.0`
- `lightningcss-darwin-arm64@1.33.0`
- `lightningcss-darwin-x64@1.33.0`
- `lightningcss-freebsd-x64@1.33.0`
- `lightningcss-linux-arm-gnueabihf@1.33.0`
- `lightningcss-linux-arm64-gnu@1.33.0`
- `lightningcss-linux-arm64-musl@1.33.0`
- `lightningcss-linux-x64-gnu@1.33.0`
- `lightningcss-linux-x64-musl@1.33.0`
- `lightningcss-win32-arm64-msvc@1.33.0`
- `lightningcss-win32-x64-msvc@1.33.0`
- `lightningcss@1.33.0`

