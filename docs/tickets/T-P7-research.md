# T-P7 — istraživanje stvarnog PNG izvoza

Osnova: `4bfa3ac05489d22529dcac84f2b18424add5ba32`, main posle PR #17.
Datum: 2026-09-13. Autor: Codex; backend identifikator nije izložen.
Read-only pregled aplikacije; ovaj zapis ne implementira exporter i ne izdaje
release/device PASS. Pročitani AGENTS, ceo PLINTH_SPEC, HANDOFF, RELEASE-PLAN,
tickets README/REVIEW i T-P6 research/probe evidencija. Dated HANDOFF navodi
za T-P5/T-P6 i nepostojanje fixtures su zastareli: T-P6 i P-13 su na main-u,
fixtures postoje; poslednji PR #17 review na 8337ab7 ima MERGE preporuku.

## 1. Klauzule

§2.1–§2.7/§3 (lokalni runtime, licence, odvojen research/build/review),
§4.1/P-9 (očuvanje upload-a), §4.3/P-11/P-12 (prikazana poza i kamera),
§4.4/P-6/P-7 (half-float, screen exemption, SMAA), §4.5/P-13(5–6)
(aspekt, margine i pozadina), §4.6/P-13(1–4) (PNG i failure policy),
§4.9/P-4/P-10(2,4,6) (desktop/mobile), §7 (dokazi).
§4.7–§4.8 su granice: nema video/motion/hash/shortcuts implementacije.

## 2. Površine na osnovi

| Ugovor | Postojeći file:symbol | Nedostaje |
|---|---|---|
| Integer veličine | `src/output.ts:8` outputDimensions | Export scale UI i admission |
| Zajednički output | `src/scene/pipeline.ts:162` renderToTarget; `src/scene/studio.ts:92` renderToTarget | Vlasnik transakcije, cap/error checks, PNG |
| Alpha shader | `src/scene/alphaSmaa.ts:8` installAlphaSmaa | PNG transport, ne nova shader korekcija |
| Background | `src/scene/background.ts:17,38` prepare/apply | Očuvanje kroz export/restore failure |
| Settings | `src/settings.ts:32` createSettingsStore | Stabilan snapshot export zahteva i lifecycle status |
| Prikazana poza | `src/scene.ts:306` snapshot; `:459` advancePose | Privremena tačna output kamera bez promene izabrane poze |
| QA readback | `src/main.ts:215` readOutput | Produkcioni typed-byte API; postojeći Array.from nije exporter |
| Upload | `src/screen/load.ts:40,66` loadImage/latestImageLoader; `src/main.ts:174` | Koordinacija pending decode/context recovery |
| UI | `src/ui/panel.ts:37` createPanel | Stvarna PNG sekcija/status/download link |
| Oporavak | `src/main.ts:111–138` cleanup/boot | Nema aplikacionog contextlost/restored lifecycle-a |
| Dokazi | `guards/output-alpha.test.ts`, `guards/panel.test.ts`, `scripts/pg-capture.mjs` | PNG decode/download, velike veličine i failure seeds |

## 3. Nalazi F1–F12

### F1 — Dimenzije više nisu TODO(spec)

P-13(1) i outputDimensions zadaju svih 15 veličina, bez DPR-a/zaokruživanja.
Ne koristiti 1280×800 ili male T-P6 QA formate kao PNG baze. 3× nije render
u većoj rezoluciji pa downsample: sačuvani PNG mora imati upravo te dimenzije.
Default scale=1; integer-literal test svih 15 redova ostaje nezavisan od BASE.

### F2 — Postojeći target put nije cela export transakcija

Studio menja SMAA veličinu i gradient pa ih vraća u finally (:92–104), ali
ne podešava output kameru ni renderer DPR. Preview može imati zaokružen CSS
aspect; QA readOutput radi u postojećoj canvas veličini. Export mora uzeti
tačan W/H, snimiti kameru/DPR/viewport/scissor/clear/target, primeniti P-11/P-12
framing za trenutnu prikazanu transformaciju i vratiti sve, uključujući greške.
Ne pozivati store.compose/reset radi izvoza i ne završavati proizvoljno živu
pozu: slika predstavlja prikazanu pozu pri prihvatanju zahteva.
Synchronous GPU capture bez await-a ne dozvoljava rAF/upload interleaving;
async priprema mora biti završena pre prihvatanja snapshot-a ili zaštićena.

### F3 — Canvas2D roundtrip nije byte-lossless PNG put

WHATWG izričito navodi gubitke pri konverziji alpha reprezentacije. Nezavisna
mala proba pinovanog Chromium 153.0.8010.12, Canvas2D/sRGB, putImageData →
toBlob(image/png), PNG decode postojećim dev pngjs@7.0.0:

| Ulaz straight RGBA | Dekodirani PNG RGBA |
|---|---|
| 128,64,32,1 | 255,0,0,1 |
| 127,63,31,128 | 128,64,32,128 |
| 12,34,56,255 | 12,34,56,255 |

Zato byte-preserving encoder treba da prima straight RGBA direktno, bez
Canvas2D međukoraka. Predlog: originalni mali PNG RGBA8 encoder, filter 0,
sRGB oznaka, CRC32, IHDR/IDAT/IEND, zlib preko native CompressionStream('deflate').
Za odsutan API moguć je mali originalni stored-DEFLATE/zlib fallback (isti
bajtovi/kvalitet, veći fajl), uz isti decoder test. Nema nove runtime biblioteke,
kopiranja tuđeg nelicenciranog koda ili promocije dev pngjs u bundle.
CompressionStream je prisutan u ovoj probi; fallback i stvarni browser encoder
još nisu implementirani niti ispitani. Ne menjati P-13 lossless zahtev.

Reprodukcija probe: u Playwright stranici napraviti 3×1 canvas, ImageData sa
12 ulaznih bajtova iz tabele, putImageData, toBlob('image/png'), preneti Blob
bajtove i dekodirati PNG.sync.read u Node-u. Poređenje je direktno po bajtovima,
bez screenshot-a ili pretpostavke da PNG sam po sebi garantuje Canvas2D ulaz.

### F4 — Jedan flip i jedno razdvajanje alpha

Pipeline daje premultiplied encoded RGBA8. Pre PNG: bottom-up → top-down,
RGB=round(premultiplied*255/alpha), alpha se čuva; alpha=0 normalizuje RGB=0.
Nema nove OETF/tone konverzije niti clamp popravke neispravnog shader-a.
P-13 poređenja kompozitovanja dopuštaju kvantizaciju, ali lossless PNG mora
čuvati tačan ulaz encoder-a. Ručni asimetrični uzorak sa alpha 0/1/128/255,
nezavisan decoder i seeded flip/lost-alpha/missing-unpremultiply su obavezni.
T-P6 probe pokrivaju mali transport, ne production PNG.

### F5 — Inventar memorije zahteva razdvajanje faza

Pinovani Three 0.185.1: SMAAPass.js:36–45 koristi dva **half-float**, ne RGBA8
target-a. Pipeline.ts:80–85 i EffectComposer daju dva RGBA16F color target-a,
sa depth attachment-ima. Konzervativno računati četiri bajta po depth pikselu.

| Istovremeno u GPU/readback fazi | Bajtova po izlaznom pikselu |
|---|---:|
| Dva composer RGBA16F color target-a | 16 |
| Dva depth attachment-a, planski 4 B svaki | 8 |
| SMAA edges + weights RGBA16F | 16 |
| Finalni RGBA8 target bez depth/MSAA | 4 |
| Jedan typed RGBA8 readback | 4 |
| Ukupno | 48 |

Ovo je P-13 planski model, ne fizički memory meter. Fiksni 32 MiB dodatak,
preview/upload/driver/encoder ograničenja iz P-13 ostaju. Ne koristiti
Array.from za veliki readback: JS number nizovi imaju drugi trošak.
Restore/dispose velikih target-a **pre** konverzije/kompresije. CPU faza ima
readback, straight/scanline payload, izlazne chunk-ove/Blob i eventualne kopije;
popisati peak, ne sabirati međusobno isključive faze niti izostavljati žive kopije.
Ako konkretni peak pređe 48 B/pixel+32 MiB, admission koristi veći broj i može
odbiti veličinu. Ne snižavati procenu radi prolaza. Najveći planski zahtev
18.662.400 px je 929.349.632 B (886,30 MiB), ispod 1024 MiB, bez garancije GPU-a.

### F6 — GPU greške nisu uvek JavaScript izuzeci

Trenutni QA readOutput (:215–227) ne proverava framebuffer completeness ili
WebGL error rezultate. T-P7 mora razlikovati cap odbijanje, allocation/FBO,
render, readback, encoder failure i context loss; svaki isključuje novi uspešan
Blob/download. Preflight čita oba MAX_VIEWPORT_DIMS člana, MAX_TEXTURE_SIZE,
MAX_RENDERBUFFER_SIZE, piksele i budžet. Test svake faze, bez promene limita.
Izolovati stare WebGL greške od grešaka izvoza i ne ignorisati nove.

### F7 — Context recovery mora očuvati CPU upload

Stage.dispose zatvara bitmap i briše scenu (:308–312); opšti boot ponovo
učitava demo. To nije recovery sa očuvanom slikom. Potreban zaseban lifecycle:
contextlost prekida export i pokazuje stanje; contextrestored pokušava obnovu
Studio GPU resursa/tekstura iz živog Stage/settings/upload stanja. Ne dispose-ovati
bitmap tokom tog pokušaja. Ako obnova nije moguća, jasno ponuditi reload sa
objašnjenjem da će biti potreban ponovni unos, bez tihog prelaska na demo.
Test sa WEBGL_lose_context kada je podržan plus deterministička injected failure
provera; resource brojevi/listener ownership moraju ostati uredni.

### F8 — Mobile download treba stvaran korisnički gest

Blob je asinhron rezultat, a download atribut nije dokaz da je OS sačuvao fajl.
Predlog dva jasna stanja: 'Izvezi PNG' priprema → 'Preuzmi PNG' je stvaran
link/klik na gotov Blob, sa imenom i W×H. To čuva korisnički gest i ne otvara
prazan prozor unapred. Status kaže da je fajl spreman ili preuzimanje pokrenuto,
ne da je sigurno sačuvan. Blob URL ostaje važeći dok je rezultat ponuđen;
revokacija pri zameni/dispose-u, ne pre nego što browser preuzme resurs.
Desktop/mobile Playwright download mora dati stvarni PNG; stvarni iPad Safari
je zaseban dokaz, ne emulacija. Ne uvoditi mrežni fallback.

### F9 — UI i konkurentnost izvoza

Jedan export istovremeno. Ponovni klik dok busy ne kreira drugi posao.
Prikazati tražene dimenzije/razlog odbijanja i ponuditi manju skalu koju korisnik
sam bira; nema automatskog retry-a. Nema Shift+E dok T-P9 ne uvede shortcut.
Fajl identifikuje barem device + scene preset + aspect + scale, npr.
plinth-phone-soft-studio-4x5-1x.png; custom background ne sme ukloniti identitet
lighting preset-a. Rezultat zadržava sopstveni snapshot ako korisnik kasnije
promeni editor. Pending upload i dispose moraju sprečiti stale success.

### F10 — T-P6 matrica nije full-size PNG acceptance

200 kombinacija T-P6 koristi male QA target-e. T-P7 mora dekodirati stvarne
izvezene PNG-ove: svih 15 dimenzija; svih pet uređaja/četiri scene/oba tone
mapper-a/svih pet aspekata i transparent input prema P-13(4). Opaque i
transparent reference su nezavisni canvas izlazi na istim 1× dimenzijama/DPR1,
ne isti export target i ne opaque rerender kao alpha oracle. Sačuvati pragove
max1 RGB/opaque alpha255 i max2 composited RGB/max1 alpha. Velike 2×/3× provere
nisu zamenljive helper testom. Dokumentovati podržane/odbijene kombinacije;
reference-capable okruženje mora dati pozitivne PNG dokaze svih 15 izbora.

Ovo može biti skupo na SwiftShader-u. Pre pune sekvence izmeriti jednu stvarnu
1× i najveću dozvoljenu sliku; koristiti jedan warm context, sekvencijalne
slučajeve i bez ponovnog boot-a za svaku ćeliju. Trošak je planerski rizik,
ne dozvola za manju rezoluciju, ređu matricu ili veći prag. Ne dodavati macOS CI
zbog emulacije telefona; fizički Apple uređaj potreban je samo za stvarni Safari
save/recovery dokaz. Runner profil T-P7 ne postoji i ne nasleđuje T-P5 ovlašćenje.

### F11 — Postojeće dokaze sačuvati

57 guards/112 unit na pregledanom T-P6 head-u, CI #103 i PG #90 su provereni
pre merge-a. 20 auto PG poređenja i 36 named capture-a nisu ista vrsta dokaza.
Novi PNG kandidati/output manifest/contact sheet su dodatni artefakti, bez
fixtures bless-a ili promene postojećih PG imena/dimenzija/pragova.

### F12 — Šta nije nova normativna odluka

P-13 rešava dimenzije, admission, alpha i pragove; više nema tih starih T-P6
TODO(spec). Encoder organizacija, transactional API i naziv fajla koji nosi
zahtevane delove su implementacione odluke. Nije pronađena potreba za novim
P-entry-jem u ovom source/probe prolazu. Ne tvrdi se da su puni izvozi, sve
failure faze ili fizički mobilni download prošli; to je acceptance T-P7.

## Izvori i granice verifikacije

- [WHATWG Canvas](https://html.spec.whatwg.org/multipage/canvas.html#pixel-manipulation):
  premultiplied roundtrip može menjati poluprozirne bajtove; potvrđeno gornjom probom.
- [PNG 3](https://www.w3.org/TR/png-3/), §6.2/§7/§10–11: unassociated alpha,
  top-down scanlines, PNG struktura i zlib. Standard je izvor zahteva formata,
  ne kod koji se kopira.
- [Compression Standard](https://compression.spec.whatwg.org/): deflate koristi
  zlib format; native API je kandidat, prisustvo provereno, exporter nije izgrađen.
- [HTML download](https://html.spec.whatwg.org/multipage/links.html#downloading-resources):
  korisnički download i ime; ne potvrđuje konkretno ponašanje fizičkog iPad-a.
- [Gearfall threejs-technique-vault](https://github.com/novakblagojevic-wq/gearfall/blob/main/handoff/skills/threejs-technique-vault.md),
  pregledan 2026-09-13, redovi 508–524: a-long-expected-party RT/DPR/composite obrazac.
  Stari 'line-449' locator je pomeren. Preuzet je samo princip; bez koda/asseta.
- Pinovani lokalni Three 0.185.1 izvori su merodavni za inventar: SMAAPass,
  EffectComposer, WebGLTextures, plus navedene Plinth površine.

Nema nove proizvodne implementacije, guard-a, fixture-a, dependency/workflow izmene.
Rezultat je podloga za T-P7 tiket, ne samostalni approval za build ili merge.
