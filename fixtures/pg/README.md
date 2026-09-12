# T-P5 — reference potvrđene od vlasnika

PG-3(b): Novak je pregledao i prihvatio kadar, perspektivu, poze, ekran i senke iz PG run-a 34716279569; ovo je prvi upis tih neizmenjenih CI slika kao referenci posle T-P5, ne prilagođavanje slika neuspelom testu.

Vlasnička odluka: „Sve ok, moze dalje” posle uputstva za pregled ovog artefakta. Naknadno je izričito zatražio pripremu zasebnog baseline commita („Moze to sada”). Agent prenosi njegove odobrene slike; ne bira nove reference i ne renderuje ih ponovo.

- [Izvorni PG run](https://github.com/novakblagojevic-wq/plinth/actions/runs/34716279569): SUCCESS, 45 captured, 20 without baseline, 0 failed.
- [Izvorni artefakt 10304854375](https://github.com/novakblagojevic-wq/plinth/actions/runs/34716279569/artifacts/10304854375): pg-candidates.
- ZIP SHA256: `db5561c5af36ceee14fc983c2605718654ff765026868b86517c02d838516f2a`.
- Testirani source head: `674d590d062eaa0f50aaa29c1c878315c5616bf7`.
- Source tree: `6121dd99cb87e3bf507241b15fbb4d4c0792bf7a`, isti kao T-P5 main merge `f2b5eda2b37e9fda1eab27e19c9cc4c3e7b52c8c`.
- Datum odluke i pripreme: 2026-09-12. Prenos: Codex, po vlasničkom odobrenju.

## Obuhvat i ograničenja

Svih 45 PNG fajlova je bajt-identično odobrenom artefaktu. Provereni su ZIP digest i Git blob identitet svakog upisa.

Postojeća skripta scripts/pg-capture.mjs automatski poredi **20 device × scene** referenci (1280×800) kada su ove datoteke na grani koja se testira. Još **20 pose + 5 aspect** slika ovde je sačuvano kao odobrene vizuelne reference; njihovi named capture slučajevi trenutno nemaju automatski baseline diff. Čuvanje tih 25 fajlova ne menja tu činjenicu.

Ovaj commit ne menja capture skriptu, pragove, aplikaciju ili testove. Prvi stvarni PG diff rezultat sa ovim referencama beleži se tek kada se izvrši provera grane; raniji SUCCESS bez baseline-a nije retroaktivni image-diff PASS. Puni §6 performance gate je odvojena release obaveza.

## SHA256 pojedinačnih PNG fajlova

| Fajl | SHA256 |
|---|---|
| aspect-browser-16x9.png | `68c018b442807b777eb2d36156cf6a88053eb5df295a53baf5f6448c5f623ab5` |
| aspect-card-3x1.png | `a22079d62cda9c12ff258964a810636423e7c179f302ec5d93857a701bdfe88b` |
| aspect-laptop-9x16.png | `f403a4f287e2c5269a60bd970d00ea0b63f3ef8bafe4cdf5039c9f314a1564f7` |
| aspect-phone-square.png | `e5d06845a009ae6599b928a78694fab8d59a2aa3711ab3cacd6dd2385e274543` |
| aspect-tablet-4x5.png | `b3d4f1a8788d9a58b894e1b79f80fb3eaf9842a89e668f718ac286a9d43afd33` |
| browser-clean-white.png | `914f4281452eea1378f3cdfcd09bc509bfd9b468ce23c325056056fc59556f19` |
| browser-dark-glass.png | `cf6c6a9e3358a2230354ec2d1cd1493bf7d175c512e18533228187e7d47629c7` |
| browser-soft-studio.png | `d0c30c64d636b3b7554567cccbb26a5c7c37ac2bbce9d6fe5b19674e15e06034` |
| browser-warm-sunset.png | `cf9cf98bb068b608606928eaeaaded000057a9f04a6fd4927a6027a54db0f47e` |
| card-clean-white.png | `eec9d1d4bdfdc0b39b9966a1d49bad062e005ae1485cbe9b4de75a9de0320429` |
| card-dark-glass.png | `ef45662738c0dd87434a6f141020f97ecdd5dfa2fea53ef88235b7b4811f452e` |
| card-soft-studio.png | `b3499e6b15cbdacd5f4564e5b49d44990a9aad20accd15e4b7925e94c2b0b080` |
| card-warm-sunset.png | `694afd19f09c8ca2d9d3abf3296fa5e8b84e4b4768e47693b9d53da7a51c18bc` |
| laptop-clean-white.png | `a33369ebbf2b0867da134936b96ecb0dc5048189a5a73af6538302534801548e` |
| laptop-dark-glass.png | `8d0b38845ad2ceb93bb7e72453844c94b4da96956fa074eb3e414c4768c49cba` |
| laptop-soft-studio.png | `bf179ab920686fc2b1d59e06485a7d2927e3caeb0628c811f901a5c022fea678` |
| laptop-warm-sunset.png | `515c152c81fe286e821321dd419865ad3d4672480d72faa721c73411c950de9e` |
| phone-clean-white.png | `ba97234968cb9c660c9e74cb96ca74c0b61ab5c197fe72e2cd3b923db1eb73ea` |
| phone-dark-glass.png | `83ae4bbc8aea2307a8a9d0a8dbfd670d617d916dbc4f34138b36094dcfd64c5b` |
| phone-soft-studio.png | `8bf55cbbd094af282a6670203481ddbd0c11ed49964a39e901ebb933a356ca41` |
| phone-warm-sunset.png | `790ca4b94a35990e623758a9938128bf8ceeb5ee292785505810d9d689eff5bd` |
| pose-browser-front-reference.png | `bdaf0d3e7f6be3218b82d6028c8dcded065f9a37796f39179d189f80ebacb72b` |
| pose-browser-hero-reference.png | `d0c30c64d636b3b7554567cccbb26a5c7c37ac2bbce9d6fe5b19674e15e06034` |
| pose-browser-lean-reference.png | `9f15995fe57f04e00b0e5a3aff567b92ffeb16f7fe238465174d890abd3c3f93` |
| pose-browser-top-reference.png | `c5675cd46c34dcce14438ec309a60d7d010f30e395aff90427aa31a7cc64bac7` |
| pose-card-front-reference.png | `9ef7bc377e5d2e7afa25e4791b62f24837e1e949e7ce6eff13339dac2d89cae8` |
| pose-card-hero-reference.png | `b3499e6b15cbdacd5f4564e5b49d44990a9aad20accd15e4b7925e94c2b0b080` |
| pose-card-lean-reference.png | `0e80f88459496e64386defdb71f6590e1e6b75048666d4150da0e3dc2255d2d9` |
| pose-card-top-reference.png | `2ef00a3c7c35426f3b76e8db8cde1de65d2fc0fb87b65eb293f9327f5a074702` |
| pose-laptop-front-reference.png | `97b88d5507946952f8c5efc5ba528ee8cbdaf3ec5bc286c8c5a959060d208348` |
| pose-laptop-hero-reference.png | `bf179ab920686fc2b1d59e06485a7d2927e3caeb0628c811f901a5c022fea678` |
| pose-laptop-lean-reference.png | `e79cf11cc2bd74d9b898599640b4b11b291463dc21ec72515015b5d26670273f` |
| pose-laptop-top-reference.png | `335931f00cccb35358a0a6099a2b5104268ced02911b00ba01d25bea37406b82` |
| pose-phone-front-reference.png | `e792e59349ed2301bcccfa0f4f35fda9d82fedabaf94e0afe3ac3608ef79c200` |
| pose-phone-hero-reference.png | `8bf55cbbd094af282a6670203481ddbd0c11ed49964a39e901ebb933a356ca41` |
| pose-phone-lean-reference.png | `5779e933b815a12d13c4987051fb4093d58d9ddce9f299425d4ebdbf39e21628` |
| pose-phone-top-reference.png | `c85564d9a8ae17d31ac31e37627ac4e91461f96872ed895ae5cc3fa067e3772a` |
| pose-tablet-front-reference.png | `0aa4099b3bfca97fe1d12cd13236c6dfdd8c0685256887194a86c7fdf060d6fc` |
| pose-tablet-hero-reference.png | `93888fdea86eeb9bd0fd4f3930f982c8600f0f7787310d1719a7b2fa3415e335` |
| pose-tablet-lean-reference.png | `729921f4a3783e0864888658c74552e7adfc3d08a67a25eaf08813007e3cf189` |
| pose-tablet-top-reference.png | `eff86cbfa120e6d722c6d26c4a47f07ab542c9a01097e900a3e3a08370988b08` |
| tablet-clean-white.png | `ac4976db972f1e9a067f6dec3b0289ee5801da868628201b2efdeb88a6090018` |
| tablet-dark-glass.png | `21e9949389a4c293b34b15bd11a51bb6af680a28cce48a30fb639204e83769ed` |
| tablet-soft-studio.png | `93888fdea86eeb9bd0fd4f3930f982c8600f0f7787310d1719a7b2fa3415e335` |
| tablet-warm-sunset.png | `e365a0f70f09b452313433e03d8df75a71c664c23bdf8ac5befc19e54f787ae6` |
