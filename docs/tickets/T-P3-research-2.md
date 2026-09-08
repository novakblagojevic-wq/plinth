# T-P3 — research pass v2: re-verification against the T-P4 scene

PLINTH_SPEC §2.7 pass, read-only, on `main` @ `cd26c94` (2026-09-08), authored by
**GPT-6 Astra** in a ChatGPT session with the GitHub connector; landed verbatim by a
Fable 5.1 session (P-5: a finding that lives only in a chat does not exist). Where
this file and the research section of `docs/tickets/T-P3.md` (written against
`152f670`, before T-P4) disagree, this file wins; the T-P3 ticket is to be rewritten
from it. F1, F4, F6 and F7 were spot-checked against the working tree by the landing
session and found as stated. The pass is in Serbian, as its author wrote it.

---

T-P3 nije spreman za doslovno izvršavanje starog research-a: scope tačka 3 jeste ažurirana posle T-P4, ali ostatak dokumenta zadržava zastarele pretpostavke. Demo slika i dalje nedostaje.

Posle `git fetch origin` potvrđen je origin/main = cd26c947295e87394bb496fdab806c546887939d. Nalazi su iz statičke provere tog stanja; bez izmena i pokretanja CI. Brojevi F ispod pripadaju ovoj re-verifikaciji.

§4.1 ima tri bullet-a, ovde numerisana redom:

| Klauzula koju T-P3 citira | Današnja implementacija / postojeća osnova |
|---|---|
| §4.1.1 — drop/paste/pick jednog PNG/JPG/WebP; limit 8192, downscale i vidljiva napomena | Nema implementacije. Ne postoje `src/screen/load.ts:loadImage/fitWithinCap`, input handleri, `#pick` ni `#note`. `index.html:15` sadrži samo canvas; `src/main.ts:132` registruje resize. |
| §4.1.2 — sRGB screen texture, contain/cover, pad | Nema image/fit implementacije. Postoje `src/devices/build.ts:193 makeMaterials`, `:302 buildSlab.screen` i `:85 DeviceRig.screenSize`, ali ekran je jednobojni emissive placeholder. |
| §4.1.2 — zaobljavanje shader SDF maskom | Nema SDF implementacije. `src/devices/build.ts:117 roundedPlaneGeometry` i `:303` daju geometrijsku osnovu; `src/devices/spec.ts:63 screenRect` daje dimenzije/radijus. |
| §4.1.3 — demo već montiran na prvom frejmu | Nema implementacije ni slike. `src/main.ts:136` čeka samo `studio.ready`, pa renderuje placeholder. |

**F1 — Dokument je samo delimično usklađen sa T-P4.**
Research F1 još predlaže ShaderMaterial/MeshBasicMaterial i `map.colorSpace` (`docs/tickets/T-P3.md:40`). Scope tačka 3 već zahteva patch postojećeg fizičkog materijala kroz `onBeforeCompile` i `emissiveMap` (:111), dok tačka 4 i dalje kaže „screen mesh uses ScreenMaterial” (:121), bez usklađene definicije tog tipa. Važeći autoritet je P-6(2): jedan MeshPhysicalMaterial, emissive slika + clearcoat, `toneMapped=false`, očuvan kroz composer. Stara preporuka klase materijala više ne važi. T-P3, tačka 3.

**F2 — Materijal je zamenjen; placeholder boja je dodatna tačka integracije.**
Stari `build.ts:141 MeshStandardMaterial` danas je `src/devices/build.ts:193 makeMaterials`, sa ekranom na :201. Postoje crna osnovna boja, tamni `emissive=0x0f1115`, clearcoat, `SCREEN_GLARE_INTENSITY` i `emissiveCompensation` (:189, :215). Put za sliku mora definisati zamenu tog tamnog emissive placeholder-a i očuvanje postojeće kompenzacije; samo pominjanje `emissiveMap` u komentaru nije implementacija sRGB slike. Nema screen `onBeforeCompile` patch-a. Materijal.

**F3 — Render put je premešten u Studio/Pipeline; izuzeće od tone mapping-a već postoji.**
Nekadašnji direktni `renderer.render(stage.scene, stage.camera)` zamenjen je pozivima `src/main.ts:73 render` → `src/scene/studio.ts:67 render` → `src/scene/pipeline.ts:112 render`. `createPipeline` koristi half-float target (:75), `isXRRenderTarget` i sRGB oznaku (:64), sa SMAA ili MSAA/copy putem. To je postojeća obaveza P-6/P-7, a sRGB oznaka izlaznog targeta ne postavlja color space buduće ulazne slike. T-P3 mora proći kroz ovaj put; stari model „neobrađeni screen materijal direktno na canvas” nije dovoljan. Pipeline.

**F4 — Screen geometrija i brojevi linija su promenjeni; browser je izuzetak.**
Stari screen mesh na `build.ts:209` sada je na `src/devices/build.ts:302`; `DeviceRig.screenSize` sa stare :63 prelazi na :85, a browser skraćenje visine je na :281. Za četiri uređaja koristi se `roundedPlaneGeometry` sa normalizovanim UV-ovima; browser i dalje koristi običan `PlaneGeometry` (:303). Zato tvrdnja scope tačke 3 da je ekran već rounded plane nije univerzalna. SDF ostaje neizgrađen za svih pet uređaja; browser zahteva gornje radijuse nula i donje zaobljene prema starom F7. `screenRect` daje otvor, dok `screenSize` daje stvarnu visinu slike bez title bar-a. Screen mesh.

**F5 — Vlasništvo nad rig-om ostaje u scene.ts; image lifecycle još ne postoji.**
`src/scene.ts:39 createStage` sada prima i `initialScene`; nije u celosti preseljen u `studio.ts`. `Stage.setDevice` (:79) i dalje uništava stari rig i pravi novi. `DeviceRig.update` (`src/devices/build.ts:473`) zadržava materijale, ali pri promeni oblika ponovo pravi screen mesh i menja `screenSize` (:487). Zato ostaju potrebni ponovno vezivanje slike pri promeni uređaja, osvežavanje UV/SDF parametara pri promeni oblika i jasno vlasništvo nad teksturom. `Stage.setImage/setFit/setPad/setPadColor/getImage` i `DeviceRig.setImage` ne postoje. Nova veza `onDeviceChange` (`scene.ts:107`) pokreće senku preko `studio.ts:52`; to nije image lifecycle. Stage.

**F6 — Prvi frejm sada ima dodatnu asinhronu granicu.**
`src/scene/studio.ts:66 ready` objedinjuje SMAA decode (`pipeline.ts:100`) i shader warm-up (`studio.ts:56`). `src/main.ts:136` zatim omogućava render, koji postavlja `data-plinth-ready` na :79. Budući demo load/mount mora biti uključen pre prvog takvog frejma; u suprotnom §4.1.3 ostaje prekršen, a PG može snimiti placeholder. Warm-up takođe trenutno kompajlira materijal bez slike/SDF patch-a — promena shader varijante nakon njega zahvata §6. Boot.

**F7 — setImage stub ne postoji; postojeći color stub je vezan za guardove.**
`src/main.ts:34` samo pominje budući `setImage`. Stvarni API je `setScreenColor` (:118), koji direktno menja `material.emissive`, i `screenCentrePx` (:123). `guards/screen-exempt.test.ts:80` koristi taj API, pa današnji testovi proveravaju jednobojni emissive izlaz, ne dekodiranje i uzorkovanje sRGB teksture. Uvođenje demo teksture zahteva usklađivanje ovog testnog puta uz očuvanje postojećih provera AgX/ACES, glare granice, highlight preciznosti i MSAA. Guard potrošač.

**F8 — Demo slika ostaje eksplicitan blokator iz postojećeg tiketa.**
U stablu cd26c94 nema `public/demo.png`. Stari F6 (`docs/tickets/T-P3.md:66`) zato i dalje važi: slika je Novakova prema §3; implementacija staje sa TODO(spec), bez zamenskog generisanog sadržaja. Prazan image pipeline potvrđuju i `main.ts:136` i placeholder u `build.ts:200`. Postojeći stop uslov.

**F9 — PG očekivanja tiketa su zastarela.**
„Bless #2 — all five change” (`docs/tickets/T-P3.md:152`) više ne opisuje stanje. `fixtures/pg/` ne postoji; capture sada obuhvata 5 uređaja × 4 scene = 20 kandidata (`scripts/pg-capture.mjs:21`, :43). Prvi bless tek predstoji. `guards/pg-mode.test.ts:73` proverava laptop/warm-sunset, ali nema predloženu 9000×2000 image/downscale proveru niti potvrdu montiranog demo sadržaja. Capture matrica.

**F10 — Spec praznine iz research-a nisu nestale, ali još nisu implementirani „kod bez §”.**
§4.1 i dalje ne definiše raspon i jedinicu `pad`, `padColor`, niti pravilo `min(8192, maxTextureSize)`. Te odluke postoje u T-P3 F2/F5 (`docs/tickets/T-P3.md:47`, :61); nema njihovog koda niti naknadnog P-entry-ja koji zatvara cap pitanje. EXIF postupak je takođe zahtev tiketa (:77), bez implementacije. To su postojeće dokumentovane razrade/praznine, ne novootkrivene T-P4 funkcije. Definicije tiketa.

**F11 — Šta današnji kod ima van eksplicitnog §4.1.**
Tamni placeholder (`build.ts:203`), `setScreenColor`/`screenCentrePx` (`main.ts:118`, :123) jesu privremene QA površine dokumentovane T-P4/P-4; nisu realizacija input klauzula. Konkretne browser proporcije (`build.ts:49`) ostaju builder brojevi bez numeričke definicije u §4.2. Nasuprot tome, studio/composer/clearcoat imaju autoritet u §4.4, §6 i P-6/P-7; ne treba ih prijaviti kao nespecifikovane samo zato što ih stari T-P3 spisak citata ne navodi.

Dodatna granica dokaza: `guards/no-network.test.ts:57` učitava stranicu i čeka ready + 500 ms; ne izvršava drop/paste/pick. Njegov prolaz sam po sebi neće dokazivati §2.2 tokom budućeg input toka. No-network obuhvat.
