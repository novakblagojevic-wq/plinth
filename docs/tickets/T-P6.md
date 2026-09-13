# T-P6 — Panel, izlazni okvir i pozadina

Dokument od značaja: PLINTH_SPEC.md §2–§3, §4.1–§4.6, §4.9, §6–§7,
P-4/P-6/P-7/P-9/P-10/P-11/P-12/P-13. Autor ticketa: Codex, planska sesija.
Implementator i tačan model evidentiraju se pri početku; reviewer je druga,
sveža sesija. Jedan implementator, jedan implementation PR.

Status: **implementation candidate prepared; final CI/PG and independent review
are recorded on the implementation PR before acceptance.**
Builder: Codex; the exact backend model identifier is not exposed.
Base: `c9a376418cebf33d7c1d2967aba9d37b6627d648` (planning PR #14 merged),
including PR #16's pipeline resource lifecycle fix. The planning package is
active on this base. PNG download remains T-P7, hash/shortcuts T-P9, motion T-P8a.

Linux setup on this base: Node 24.19.0, `npm ci --no-audit --no-fund`,
`npm run ci` (46 guards, 88 unit tests, typecheck) and `npm run build` passed.
Playwright 1.63.0 / Chromium 153.0.8010.12 (revision 1243), SwiftShader;
Three.js 0.185.1 and all lockfile pins unchanged. Direct local implementation,
not an Astra runner packet; no T-P5 profile was reused. GitHub connector
permissions confirmed read/push access; publication uses Git data APIs after
local pre-push CI, with full Git tree equality checked against the local commit.

## Research pass i disposition

Prethodno upisani `T-P6-research.md`, `T-P6-decisions-proposal.md` i
`../probes/T-P6-alpha-findings.md` su research, ne production implementacija.
P-13 prenosi odobrene odluke, ne proglašava punu render matricu prošlom.

| Nalaz | Rešenje / vlasnik |
|---|---|
| F1 | Scope 2: layout oblast odvojena od output aspekta i PNG dimenzija |
| F2 | P-13(5), scope 3: nezavisan outputPad sa propisanom kamerom |
| F3 | P-13(6), scope 4: nezavisno background stanje |
| F4/F5/F15 | P-13(3–4), scope 5: zajednički alpha-aware pipeline i njegovi dokazi |
| F6/F7/F8 | P-13(1–4): ugovor usvojen; T-P6 deli dimenzije/alpha, T-P7 enkoder, preflight i download |
| F9 | Scope 1/6: jedan state vlasnik, atomske promene i image-preserving reset |
| F10 | Scope 6: četiri potpune kompozicije i lokalni thumbnails |
| F11 | P-13(6), scope 7: hinge i svi Advanced parametri |
| F12 | Scope 2/8: nemodalni sheet, touch/keyboard/focus lifecycle |
| F13 | Baseline PR #15 je spojen; scope 9 čuva 20 auto + 25 named referenci |
| F14 | T-P6 runner profil nije napravljen; postojeći T-P5 profil se ne koristi kao zamena |

## Numerisani scope

### 1. Zajednički settings i API

Uvesti tipizirani in-memory state: device ID i potpuni DeviceSpec; pose ID ili
custom snapshot (device transform + camera direction, ne samo null); scene;
tone mapper i preview MSAA; output aspect i outputPad; background mode/solid/
gradient colors; image fit/pad/padColor; aktivna kompozicija ili custom.
Image bitmap/texture/bytes ne kopirati u settings. Koristiti postojeći loader.

Jedan store/adapter poseduje promene i obaveštava panel i QA. Settere Stage-a
ne ostaviti kao paralelni nevidljivi izvor stanja: QA i orbit takođe ažuriraju
UI. Čuvati prikazanu i ciljnu pozu po postojećem T-P5 ugovoru; ručni orbit
odmah označava custom, bez vraćanja scene. Složeni apply prvo validira ceo
kandidat i pripremi potrebne resurse, pa primeni; greška ostavlja prethodno
stanje, prikaz i sliku. Potrebni subscribe-i vraćaju idempotentni unsubscribe.

### 2. Desktop i mobilni layout

Na širini >=900 CSS px: panel desno 320 px, stage u preostaloj oblasti.
Ispod 900 px: nemodalni bottom sheet, zatvoren sa dugmetom „Podešavanja”,
otvoren najviše 55dvh, sa sopstvenim vertikalnim skrolom i zatvaranjem.
Otvoren sheet rezerviše svoju visinu u layout-u; stage koristi vidljivu oblast
iznad njega. Zatvoren koristi raspoloživu visinu iznad dugmeta/safe-area.
Ne prekrivati sliku picker/status elementima iz starog layout-a.

Izabrani aspect se uklapa u raspoloživu stage oblast. Slobodan prostor oko
izlaznog canvasa pripada editoru, ne PNG-u. Renderer i kamera prate stvarne
render dimenzije; ne rastezati samo CSS-om. Resize/sheet čuvaju izbor aspekta,
sliku i custom pozu. PG ostaje u eksplicitnoj fiksnoj veličini, bez panela po
default-u; poseban QA izbor `ui=1` uključuje panel u named capture-u.

### 3. Aspekt i output padding

Pet izbora i bazne dimenzije su tačna P-13(1) tabela, odvojena od layout-a.
Default interaktivni aspect=4:5. Istorijski PG/query capture izbori ostaju isti.
Output pad 0–25%, korak 1%, default 0, formula P-13(5); P-11/P-12 camera/floor
invarijante važe posle svake promene. Image padding je odvojena kontrola
0–25% kraće strane ekrana po P-9, korak 1%; padColor ostaje dostupan.
Izložiti i contain/cover i četiri postojeće poze; ne dodavati crop ili zoom.

### 4. Pozadina

Četiri režima, boje i vertikalna encoded-sRGB interpolacija tačno po P-13(6).
Preset background prati scene izbor, custom izbori ga preživljavaju. Gradient
je u output koordinatama i ne utiče na lighting/tone mapping. Transparent clear
čuva alpha i senku, checkerboard je iza canvas-a u UI. Ne menjati telo stranice
kao jedini izvor izlazne pozadine. QA i reset prolaze kroz isti settings adapter.

### 5. Zajednički color/alpha pipeline

Uvesti verzijski vezan alpha-aware SMAA adapter na pinovanom shader-u i javni
pipeline način renderovanja u target za budući T-P7. Preview i offscreen koriste
istu završnu obradu. Nema globalnog OutputPass-a, RGB-to-alpha clamp fix-a,
novog dependency pina ili promene screen exemption-a.

Ako adapter menja shader tekst, proveriti sve očekivane zamene i fail jasno
pri nekompatibilnom izvoru; ne nastaviti tiho sa originalnim shader-om. Navesti
izvor i postojeću Three.js MIT licencu. Preuzeti kontrolisani scalar oracle u
production acceptance test, bez zavisnosti od docs/probes stranice. GPU resurse,
pass-ove i listenere eksplicitno dispose-ovati, uključujući neuspešnu inicijalizaciju.
Temporary target/clear/viewport/scissor/scene stanje čuvati i vratiti u finally.
PNG enkoder i dugme za izvoz se ne implementiraju u T-P6.

### 6. Četiri kompozicije, thumbnails i reset

Sledeća tabela u potpunosti zadaje device, pozu, scenu, format i outputPad:

| ID / naziv | Device | Poza | Scene | Aspekt | OutputPad |
|---|---|---|---|---|---|
| studio-phone / Studio | phone | hero | soft-studio | 4:5 | 0 |
| dark-laptop / Tamni studio | laptop | hero | dark-glass | 16:9 | 0.04 |
| clean-browser / Čist prikaz | browser | front | clean-white | 16:9 | 0.04 |
| warm-card / Topli prikaz | card | lean | warm-sunset | 1:1 | 0.08 |

Za **svaki** red: DeviceSpec je tačan postojeći `presetSpec(device)` iz
`src/devices/presets.ts` na osnovi e98c99e; ne menjati njegove proporcije.
Tone=AgX, preview MSAA=false, background mode=preset, solid=#ffffff,
gradient top=#f2f4f8/bottom=#c8d3e3, image fit=contain, image pad=0,
padColor=#ffffff. Sve navedene vrednosti se SET-uju, upload identitet i image
metadata se PRESERVE-uju. Prethodni custom orbit se zamenjuje named pozom.
Promena pojedinačne kompozicione kontrole označava izgled kao custom.

Reset postavlja tačno studio-phone red i zajedničke vrednosti; učitana slika
ostaje ista. Reset tokom upload-a ne otkazuje najnoviji važeći korisnikov unos:
postojeći latest-request-wins loader ostaje, a završeni upload koristi tadašnje
settings. Stariji async rezultat ne prepisuje noviji. Reset tokom pose prelaza
hvata trenutno prikazano stanje i primenjuje T-P5 transition ugovor.

Thumbnails koriste samo committed demo sliku, bez korisnikovog sadržaja.
Generisati statične lokalne PNG-ove determinističkom skriptom iz ove tabele,
jedan privremeni renderer koji se zatvara; ne držati četiri GPU canvasa u UI.
Asseti su pod public/compositions, ne fixtures/pg. Za repro navesti komandu,
base SHA i dimenzije 240×150 thumbnail okvira; uklopiti stvarni aspect bez
istezanja, sa prostorom editora izvan njega. Vlasnik pregledava završene look-ove
iz CI artefakta; tabela/odobrenje specifikacije nisu unapred visual bless.

### 7. Advanced — sve DeviceSpec kontrole

Jedinice UI mm/stepeni, runtime metri/radijani. Rasponi su domen UI kontrole;
ne sužavaju stari Stage API za ranije validna stanja. Ne kvantizovati učitano
stanje samim prikazom. Korisnikov unos proverava i sve postojeće invarijante.

| Polje | UI raspon | Korak |
|---|---|---|
| w, h | 20–600 mm | 1 mm |
| depth | 1–50 mm | 0.1 mm |
| cornerRadius | 0.2–100 mm | 0.1 mm |
| bezel | 0.1–50 mm | 0.1 mm |
| screenInset | 0–10 mm | 0.1 mm |
| frameMetalness, frameRoughness, glassClearcoat | 0–1 | 0.01 |
| standType | none, plate, hinge | izbor |
| hingeAngle | 60–150° | 1°, P-13(6) |

Nevažeći unos ne primenjuje delimičan model: pokazati razlog uz polje, zadržati
poslednje validno stanje; Escape vraća prikaz validne vrednosti. Ne popravljati
bezel/inset/radius automatski pomeranjem drugih slider-a. Posebno proveriti
screenInset < bezel < cornerRadius <= min(w,h)/2 i screenInset < depth.
Izmena materijala ne zahteva geometry rebuild. Hinge aktivan samo za hinge
stand, uz očuvan tačan 1.85 rad laptop reset iz P-13.

### 8. Input i pristupačnost

Native label/input/select/button kontrole, vidljiv fokus, čitljivi nazivi,
aria-expanded/controls za sheet i Advanced; aria-live za status greške.
Sheet je nemodalan, bez aria-modal i bez focus trap-a. Otvaranje fokusira prvi
naslov/komandu, Escape zatvara i vraća fokus na opener. Kontrole pristupačne
Tab/Shift+Tab i tastaturom. Podržati safe-area i virtual keyboard bez skrivanja
aktivne kontrole. Minimalne touch mete 44×44 CSS px.

Canvas zadržava svoj touch-action:none i lifecycle iz T-P5; panel ga ne
nasleđuje. Scroll/slider/picker gest ne pokreće orbit; gest na vidljivom
canvas-u i dalje orbituje. Ne dodavati globalni preventDefault na ceo dokument.
Odvojiti rAF za camera transition od UI; ne uvoditi trajni render loop samo
zbog panela. Bez trajnog desktop agenta, backend-a ili runtime mreže.

### 9. Dokazi i PG

Sačuvati svih postojećih 20 automatskih PG slučajeva i 25 named capture-a,
njihove dimenzije i baseline-e. Dodati imenovane slučajeve četiri kompozicije,
četiri background režima, otvoren/zatvoren mobilni panel i desktop panel.
Svaki capture ima eksplicitnu veličinu i ready uslov; ne koristiti proizvoljno
čekanje umesto dovršene inicijalizacije. Novi UI ne sme ući u stari default PG.

Puna alpha/color acceptance mora koristiti stvarni novi pipeline: svih pet
uređaja × četiri scene × oba tone mapper-a, sa transparent input-om i svim
aspektima kroz dokumentovanu matricu. Kontrolisani blend oracle i opaque parity
po P-13(4), transparent compositing preko tri podloge; negativne provere
originalnog SMAA i double-tone-map puta moraju pasti. Testni readback adapter
ne postaje product download. PNG byte/dimenzije/download acceptance ostaje T-P7.

## Acceptance i predaja

- `npm run ci` i `npm run build` na tačnom implementation commitu, Linux,
  postojeći Node/dependency/Chromium pinovi. Nema novih timeout-a radi prolaza.
- Unit testovi: literals za dimenzije/aspekte/padding; čitav reset/preset state;
  očuvan texture/bitmap identitet; invalid composite apply bez mutacije;
  unsubscribe/dispose i async race; nezavisna projekcija P-11 margine.
- Browser: stvarni touch scroll/slider/orbit, pointercancel/lostcapture; native
  picker/paste/drop; desktop 1280×800, mobile 400×700 i 700×400, tablet 820×1180,
  sheet open/close/resize, keyboard i 200% tekst. Emulacija nije stvarni iPad
  GPU PASS; navesti stvarno korišćeni browser/device i preostalu fizičku proveru.
- P-13 color/alpha dokazi iz scope 9, opaque PG regresija, novi CI pg-candidates
  sa jasnim kontakt-listom. Svaki novi guard ima seeded FAIL dokaz, vraćen seed
  i završni PASS. Nezavisan reviewer ne koristi builder PASS kao sopstveni verdict.
- Zabeležiti merljive interaktivne zastoje pri promeni izgleda, bez tvrdnje da
  je kompletan pet-run §6 release gate završen. T-P10 ga zadržava.
- PR opis: model, base/head SHA, svaka cited klauzula sa file:line, F1–F15
  disposition, komande/rezultati, test matrica i ograničenja, CI/PG linkovi,
  svaki TODO(spec), šta tačno Novak treba da pregleda. Nedostajući dokaz nije PASS.
- Research/planning PR se ne koristi za runtime build. Pre implementacije spojiti
  pregledani planning paket, a za Astra route zasebno pripremiti T-P6 profil sa
  tačnim pinovima/write set-om. Direktni lokalni put mora imati puni pre-push CI.

## Tačan write set implementacije

```text
index.html
src/main.ts
src/scene.ts
src/scene.test.ts
src/camera/poses.ts
src/camera/poses.test.ts
src/scene/studio.ts
src/scene/studio.test.ts
src/scene/pipeline.ts
src/scene/pipeline.test.ts
src/scene/alphaSmaa.ts
src/scene/alphaSmaa.test.ts
src/scene/background.ts
src/scene/background.test.ts
src/settings.ts
src/settings.test.ts
src/output.ts
src/output.test.ts
src/ui/panel.ts
src/ui/panel.test.ts
src/ui/panel.css
src/ui/compositions.ts
src/ui/compositions.test.ts
public/compositions/studio-phone.png
public/compositions/dark-laptop.png
public/compositions/clean-browser.png
public/compositions/warm-card.png
scripts/composition-thumbnails.mjs
scripts/pg-capture.mjs
guards/pg-mode.test.ts
guards/panel.test.ts
guards/output-alpha.test.ts
README.md
LICENSES.md
docs/tickets/T-P6.md
```

Guards i postojeći testovi su aditivni; dozvoljena putanja ne dozvoljava
slabljenje assertion-a. LICENSES samo za atribuciju izvedenog Three shader-a,
bez novih zavisnosti. Ako stvarna integracija zahteva druge fajlove, navesti
konkretan nalaz i traženi dodatak write set-u pre izmene.

## Builder ne sme

Menjati PLINTH_SPEC ili fixtures/pg; menjati device preset proporcije; menjati
pinove, workflow-e, runner profile ili test pragove; dodati CDN/backend/telemetriju;
uvoditi multi-device scene, nove lighting scene, hash, video ili PNG download;
brendirane uređaje; aktivna export dugmad za nedovršene funkcije; samostalni
baseline bless, self-review ili merge. Normativni gap je TODO(spec) i stop
pogođenog obuhvata, ne prilagođavanje ugovora da bi test prošao.


## Implementation surfaces and evidence handoff

- Scope 1/6: `src/settings.ts` owns atomic prepared changes and subscribes to
  Stage notifications; `src/scene.ts:prepareSettings` validates and prepares
  candidate geometry/camera before mutation. Custom snapshots include device
  position/rotation and camera direction; translation is derived by the floor
  rule, not an extra pan control. `src/ui/compositions.ts` is the complete table.
- Scope 2/7/8: `src/ui/panel.ts`, `panel.css`, `index.html` and `src/main.ts`
  provide native controls, a 320px desktop panel, nonmodal sheet, focus/error
  handling and viewport sizing. The image loader remains the existing owner.
- Scope 3: `src/output.ts` contains literal P-13 dimensions and padding;
  `src/scene.ts:calculateFrame` reapplies the projection/near/far safety checks.
- Scope 4/5: `src/scene/background.ts` samples a vertical encoded-sRGB gradient
  per output row. `alphaSmaa.ts` checks every patched pinned shader expression.
  `pipeline.ts` and `studio.ts` share SMAA finishing, expose target rendering,
  restore temporary render state and release acquired resources on failure.
  The existing PR #16 resource tests and all their assertions are retained.
- Scope 9: existing PG cases remain; 11 named T-P6 cases are added. Local
  screenshots are diagnostics; owner review uses the CI pg-candidates artifact.
  The four 240×150 thumbnails are generated from the committed demo with one
  temporary renderer by `scripts/composition-thumbnails.mjs`.

F1–F3, F9–F12 are implemented at the surfaces above. F4/F5/F15 are covered by
production alpha blending and actual pipeline tests. F6–F8 share the P-13
contract here; PNG encoding, exact output-size hardware admission, download
and context-loss recovery remain T-P7. F13 preserves the 20 automatic + 25
named references without touching fixtures. F14 uses direct local acceptance,
not a broader runner profile. No new normative decision or TODO(spec).

Verification commands (results and exact published head are attached to the PR):

```sh
npm run ci
npm run build
npm run pg:capture
node scripts/composition-thumbnails.mjs
```

New guard negative controls run without persistent source changes:
`PLINTH_ALPHA_SEED=original` must fail the controlled blend oracle;
`PLINTH_ALPHA_SEED=double-tone` must fail actual pipeline colour/alpha checks;
`PLINTH_PANEL_SEED=overlay` must fail the mobile reserved-space assertion.
Each is followed by unseeded checks. These test-only response mutations neither
change the product nor alter fixtures or thresholds.

Actual render matrix: all five devices × four scenes × AgX/ACES × five aspects
(200 combinations), DPR1, explicit 160×160 / 160×200 / 320×180 / 180×320 /
300×100 QA frames. Every combination uses a transparent input, compares
independent canvas and target outputs, checks opaque parity and composites the
same premultiplied foreground over black, white and a coloured checker. A
shadow-only QA read retains the captured contact shadow while hiding the device,
so partial alpha is not inferred solely from device edges. Separate controlled
SMAA tests cover 128 fixture combinations; gradient tests check encoded rows.
PNG byte transport and the full P-13 export-size table remain T-P7 acceptance.

UI matrix: 1280×800 desktop, 400×700 and 700×400 mobile, 820×1180 tablet;
real Chromium touch scroll/slider/orbit/cancel, keyboard focus/Escape/Tab,
200% text, native picker, shared QA updates and image-preserving reset.
Existing T-P3 file-backed drop/paste/picker and T-P5 touch/lost-capture tests
remain additive regression coverage. No physical phone/iPad GPU claim.
Composition apply durations are observations from one Linux/SwiftShader
sequence, not a §6 performance PASS; the full five-run T-P10 gate is unchanged.

**Novak reviews:** the four composition shots, transparent edge/shadow and
gradient shots, desktop controls and open/closed mobile sheet in the CI contact
sheet. Approval of that appearance does not by itself bless new baselines or
merge the implementation. Builder does not issue its own review verdict.
