# T-P5 — provera radnog okruženja

## Aktuelni status — paket posle oba merge-a, 2026-09-12

P-12 je na Plinth main-u kroz PR #11, merge
`14a88e247c7b65134c19180e0a35e8f04054d7bf`. Linux T-P5 profil je na
astra-runner main-u kroz PR #6, merge
`0f59cef4edbd078214c35f648f596e7cf3239cec`; glavni test worker je Ubuntu 24.04.
Ovaj paket prenosi isti runtime, testove i capture skriptu iz prethodno
proverenog kandidata `53fea5b8a31da5db4704b84d4b37e1fcd5c29b4e` na novi main.
Menjaju se osnova/identitet paketa i ovaj dokumentacioni zapis.

Prethodni proposal dokazi: lokalni puni CI PASS na osnovi (40 guardova,
65 unit testova) i kandidatu (45 guardova, 78 unit testova), oba build-a PASS;
cloud PG run 34700480521 ima 45/45 snimaka, a seeded run 34700703823 PASS.
Raniji cloud CI FAIL ostaje FAIL. Ti dokazi ne zamenjuju nov standardni
`candidate-tp5-test.yml` run na novom SHA-u i nisu ulaz za publisher.

Novi standardni run još nije pokrenut u trenutku pakovanja. Tek posle njegovog
prolaza zaseban publisher sme otvoriti draft PR za tačan testirani commit.
PR CI/PG, nezavisan review i Novakova vizuelna/baseline odluka ostaju otvoreni.
Stariji odeljci ispod beleže prethodna stanja; navodi da P-12 nije na main-u
ili da browser dokaz još ne postoji više nisu aktuelni.

Datum: 2026-09-11, oko 21:56 UTC. Agent: Codex, planiranje; tačan backend
identifikator nije izložen. Ovo je provera P-10(7), ne implementacija T-P5.

**Istorijski lokalni ishod: BLOKIRANO za browser acceptance.** Izabrana probna površina je
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

## Istorijski predložena izvršna površina

Taj korak je potom završen: Astra T-P5 profil je zasebno odobren i potvrđen
za tačnu main osnovu/kandidata. T-P3 profil nije proširen; odobrenje ostaje
ograničeno na T-P5 write set.

Ako lokalni Chromium i pristup postanu dostupni, ponoviti ceo gate na tadašnjem
main-u. GitHub CI na ovom planskom PR-u proverava dokumentacioni kandidat u
GitHub okruženju; nije potvrda izvršnog okruženja za budućeg implementatora.
Istorijski zapis: P-10(7) je tada ostao otvoren; kasniji Astra prolaz opisan u dopuni ispod ga je zatvorio za odobrenu cloud površinu.


## Dopuna implementacije, 2026-09-12

P-10(7) je potom prošao na odobrenoj Astra T-P5 površini za bazu
`b0634fc78156a5f487f0ae1a663bc973c1b994fa`; profil je
`d2f2890f8de132ba8e9ed277c083f69d0a90586b`. Taj dokaz je cloud evidence i
ne pretvara lokalni worktree u Chromium površinu. Implementator GPT-5.6 Terra
je lokalno ponovio `npm ci --no-audit --no-fund`, `npm run typecheck` i
`npm run test` (77 PASS pre Linux preflighta). `npm run guards` i dalje pada pri Playwright launch-u
zbog odsutnog executable-a; browser guardovi, full CI, PG kandidati i vizuelna
potvrda zato ostaju cloud-pending. `npm run build` je zatim izvršen nad ovim tačnim implementacionim diff-om i PASS; rezultat je lokalni build preflight, ne cloud CI/PG dokaz.


## Dopuna popravke Linux preflighta, 2026-09-12

U istom odobrenom T-P5 write set-u zatvorena su četiri nalaza iz nezavisnog
Linux preflighta: endpoint unit test ostaje na podrazumevanih 5 s i sada
prolazi stvarnim keširanjem/skalarnim transformacijama tačne geometrije;
`capture` query prihvata samo sopstvene ključeve; `setAspect` računa i validira
kompletnu kandidat kameru pre commit-a; README razlikuje PG orbit input od
zadržanog T-P3 image inputa. Lokalno na ovom worktree-u: `npm run typecheck`
PASS, `npm run test` PASS (11 fajlova, 78/78) i ponovljeni `npm run build`
PASS (31 modula; 658,37 kB JS / gzip 192,72 kB). `npm run guards`/pun `npm run ci` ostaju lokalno
blokirani odsutnim Chromium executable-om; cloud CI, PG kandidati i pregled
ostaju obavezni i nisu ovim zapisom proglašeni PASS-om.


## Odobreni nastavak, 2026-09-12

Drugi Linux pokušaj `34696153078/2` potvrdio je osnovu: 40 guardova, typecheck,
65 unit testova i build. CI kandidata je prekinut ukupnim limitom od 900 s
pre završetka guardova; to nije PASS. PG je snimio svih 45 PNG-a, ali su dva
uspravna snimka bila odsečena i nisu prihvatljiv vizuelni dokaz.

Novak je zatim odobrio P-12 i 1200 s samo za ukupnu T-P5 `npm run ci` komandu
na osnovi i kandidatu. Svi pojedinačni timeout-i, assertion-i, tolerancije,
provere identiteta i obaveza pune komande ostaju. T-P3 profil se ne menja.
Korekcija viewport-a i dodatna provera punog uspravnog snimka su pripremljene
na P-12 lokalnom stablu. Typecheck, 78/78 unit testova i build prolaze; nova
Linux provera i novo snimanje tek treba da potvrde kompletan kandidat.
