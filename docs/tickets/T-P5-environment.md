# T-P5 — provera radnog okruženja

Datum: 2026-09-11, oko 21:56 UTC. Agent: Codex, planiranje; tačan backend
identifikator nije izložen. Ovo je provera P-10(7), ne implementacija T-P5.

**Ishod: BLOKIRANO za lokalnu implementaciju.** Izabrana probna površina je
Codex workspace, Node `v24.19.0`, npm `11.9.0`. Node zadovoljava postojeći
`package.json` uslov `>=22`; GitHub workflow-i koriste Node 22.

Proverena osnova: `67afe76b08ab32b73a0e2ee4a543f7c044088eed`.
`git fetch origin` je uspeo. Stari planski checkout je bio jedan merge commit
iza main-a; za ovu proveru napravljen je čist odvojen worktree na navedenom
main-u. Nisu menjani runtime, zavisnosti, guardovi ili baseline slike.

| Provera | Stvarni rezultat |
|---|---|
| Čitanje Git repozitorijuma | `git fetch origin`: exit 0. |
| Lokalni Git upis | `git -c credential.interactive=never push --dry-run origin origin/astra/tp5-research-owner-sweep-2026-09-11:refs/heads/astra/tp5-research-owner-sweep-2026-09-11`: exit 128, `fatal: unable to get password from user`. Nije izmenjen remote ref. |
| GitHub veza | Repo API potvrđuje `pull: true`, `push: true`; prethodni upis PR #9 je potvrđen. Ovo nije lokalni Git credential. Planska dokumentacija se objavljuje tom vezom. |
| Zavisnosti | `npm ci --no-audit --no-fund`: exit 0, 58 paketa. |
| Build | `npm run build`: exit 0, 29 modula; JS 649,32 kB / gzip 190,02 kB. |
| Chromium | `PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=10000 timeout 55s npx --no-install playwright install chromium`: exit 124; pokušaji preuzimanja sa zvaničnog CDN-a ističu. Nije pronađen drugi lokalni Chromium executable. |
| Pun CI | `npm run ci`: exit 1. Dva guard fajla prolaze; tri browser guard fajla ne mogu da pokrenu Chromium. Vitest: 16 passed, 24 skipped zbog neuspelog setup-a. Preskočeni testovi nisu PASS; typecheck/unit faze iza `&&` nisu izvršene. |

Ključna greška CI-a:

```text
browserType.launch: Executable doesn't exist at
/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
```

`npm run ci` je pokrenut na main osnovi; dok se proces završavao checkout je
prebačen na PR #9 radi čitanja njegovih dokumenata. Razlika su isključivo dva
Markdown fajla u `docs/tickets/`; runtime, lockfile, skripte i guardovi ostali
su identični. Ovaj neuspešan pokušaj se svakako ne računa kao environment PASS.

## Sledeća izvršna površina

Praktičan sledeći put je postojeći Astra runner, posle prihvatanja T-P5
ugovora/write set-a. Potreban je zaseban tooling zadatak za T-P5 profil,
sa odbijanjem fajlova van odobrenog skupa i proverom tačne main osnove i
kandidata. Ovaj dokument ne proširuje postojeći T-P3 profil niti tvrdi da
je T-P5 profil napravljen ili odobren.

Ako lokalni Chromium i pristup postanu dostupni, ponoviti ceo gate na tadašnjem
main-u. GitHub CI na ovom planskom PR-u proverava dokumentacioni kandidat u
GitHub okruženju; nije potvrda izvršnog okruženja za budućeg implementatora.
P-10(7) ostaje otvoren do punog prolaza izabrane površine.


## Probni paket zasebnog T-P5 profila

Priprema: 2026-09-11. Autor: Codex; tačan backend identifikator nije izložen.
Plinth PR #9 i Astra runner PR #5 spojeni su uz Novakovo izričito odobrenje.
Osnova ove probe: `b0634fc78156a5f487f0ae1a663bc973c1b994fa`.
Runner profil: merge `d2f2890f8de132ba8e9ed277c083f69d0a90586b`.

Ovaj dodatak dokumentaciji je namerno jedina izmena u probnom kandidatu.
Ne menja kameru, runtime, testove, guardove, specifikaciju ili PG baseline.
Sadržaj paketa nastaje pre pokretanja provere i zato ne tvrdi da je proba prošla.

Za dokaz su potrebni uspešni rezultati svih osam komandi na čistoj osnovi i
kandidatu, neizmenjena osnova, validiran artefakt i zasebna uspešna objava draft
PR-a preko čistog worker-a. Stvarni ishod i run/attempt/SHA identiteti beleže se
u izveštaju Astre i PR diskusiji. Opšta dijagnostika i infrastruktura unit testovi
nisu zamena za ovaj dokaz. Merge probnog PR-a nije automatski odobren.
