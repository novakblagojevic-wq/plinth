# T-P7 — PNG koji korisnik stvarno preuzima

Status: **planning candidate; nije odobrena implementacija**.
Osnova: main `4bfa3ac05489d22529dcac84f2b18424add5ba32` (T-P6 PR #17 spojen).
Autor: Codex, planska sesija; tačan backend identifikator nije izložen.
Dokument od značaja: PLINTH_SPEC §2–§3, §4.1/§4.3–§4.6/§4.9, §7,
P-4/P-6/P-7/P-9/P-10/P-11/P-12/P-13. PNG je sledeći po P-10(2).
Research je prethodno upisan kao zaseban commit; ovaj tiket ne menja specifikaciju.
Implementator navodi model/base/head; reviewer mora biti druga sveža sesija.

## Research pass

[T-P7-research.md](T-P7-research.md), F1–F12 je obavezna podloga:

| Nalazi | Disposition / scope |
|---|---|
| F1 | 1: tačne dimenzije iz P-13, ne novi base |
| F2/F4 | 2–3: transakcija kamere/renderera i tačan RGBA transport |
| F3 | 3: direktni PNG encoder bez Canvas2D roundtrip-a |
| F5/F6 | 1–2/5: peak admission i svaka failure faza |
| F7 | 5: očuvanje upload-a i GPU recovery |
| F8/F9 | 4: desktop/mobile download, status i jedan posao |
| F10/F11 | 6: nezavisni puni PNG dokazi i očuvan postojeći PG |
| F12 | P-13 je aktivan; nema novog TODO(spec) po ovom istraživanju |

Pre build-a: planning paket pregledan i spojen; fetch tadašnji main,
scoped Git pristup i podržano Linux okruženje sa pinovanim zavisnostima/Chromium-om.
`npm ci`, `npm run ci`, `npm run build` na toj osnovi moraju proći i biti zapisani.
T-P5 runner profil ne koristiti za T-P7. Ako je izabran Astra runner, posebno
odobriti profil izveden iz ovog write set-a; direktan lokalni put ga ne zahteva.

## 1. Zahtev, dimenzije i admission

Tipizirani export request: scale 1/2/3 (default 1), snapshot potvrđenog aspect-a,
uređaja/scene i trenutno prikazanog foreground-a; ne skladištiti image bytes
u settings-u. Koristiti outputDimensions. Pet aspekata i svih 15 P-13(1)
dimenzija su obavezni izbori; nema dodatnog supersampling faktora ili downsample-a.
Naziv: `plinth-{device}-{scene}-{aspect-with-x}-{scale}x.png`, npr.
`plinth-phone-soft-studio-4x5-1x.png`; samo poznati ID-jevi, bez upload imena.

Pre bilo koje vidljive promene proveriti:
- ceo validan scale/aspect i W/H;
- najviše 20.000.000 px;
- obe stranice prema stvarnim MAX_TEXTURE_SIZE/MAX_RENDERBUFFER_SIZE i
  pojedinačnim MAX_VIEWPORT_DIMS komponentama;
- planski peak najmanje 48*W*H+32 MiB i najviše 1024 MiB, ili veći stvarni
  planski inventar ako implementacija zahteva više;
- raspoloživ i zdrav context, završen warm-up, exporter nije busy/disposed.

Prijem nije garancija alokacije. Odbijanje prikazuje W×H i konkretan razlog;
niža skala je novi korisnički izbor. Ako ni 1× ne može, jasno navesti da PNG
nije moguć na ovom uređaju. Bez tihog smanjenja, fallback slike ili auto-retry-a.

## 2. Atomski capture i vraćanje prikaza

Jedan vlasnik export transakcije. Snapshot odgovara trenutku prihvatanja
zahteva; named poza koja se kreće ne sme skočiti na cilj samo zbog izvoza.
Rešiti async pripremu pre uzimanja snapshot-a i sinhroni GPU deo bez await-a
koji bi dozvolio rAF/input/upload da promene kadar. Ne uvoditi trajni loop.
Posle capture-a editor sme nastaviti rad tokom encoding-a; gotov rezultat
ostaje vezan za svoj snapshot i naziv, ne za naknadna podešavanja.

Sačuvati i vratiti: renderer DPR/logical size/drawing buffer i CSS size,
render target, viewport/scissor/test, clear color/alpha/autoClear; kameru
(position/quaternion/projection/aspect/FOV/near/far/matrice); scene background,
overrideMaterial/vidljivost; composer size/renderToScreen i preview AA izbor.
Koristiti renderer.setPixelRatio(1) za izvozni deo, bez pretvaranja preview-a u
veliki export canvas. Kamera koristi tačan W/H i postojeći P-11/P-12 framing
sa istom prikazanom device transformacijom, outputPad-om i upload mapiranjem.
Setteri ne smeju tiho promeniti izabranu/custom pozu ili pokrenuti prelaz.

Koristiti zajednički Studio/Pipeline alpha-aware SMAA, samples=0 pri svim
skalama, final RGBA8 target bez depth-a i bez nove colorspace/tone konverzije.
Proveriti framebuffer/render/readback greške, uključujući WebGL greške koje
ne bacaju JS exception. Reader vraća typed bajtove, nikad Array.from na punoj
slici. Render target je offscreen; DOM screenshot nije product PNG.

Svaka faza ima cleanup u finally. Jedan cleanup failure ne sme sprečiti ostale
cleanup korake ili ostaviti lažni uspeh. Restore velikog SMAA na preview veličinu
i dispose finalnog target-a pre pokretanja PNG konverzije/kompresije. Ne zadržavati
velike target-e do sledećeg izvoza. Očuvati PR #16 resource ownership testove.

Inventar dokumentovati po fazama: composer color 16 B/px + depth planski8 +
SMAA half-float edges/weights16 + output4 + readback4 =48 B/px u capture-u.
CPU faza posebno popisuje input/straight/filter payload/compressed chunks/Blob
kopije i njihovo preklapanje. Fiksni dodatak i isključenja iz P-13 ostaju;
nikad tvrditi da je browser proces ograničen na izračunatu memoriju.

## 3. RGBA → stvarni PNG

Jedan top-down flip; jedna premultiplied encoded → straight konverzija;
alpha se čuva; RGB=0 kada alpha=0. P-6/P-7 materijali, screen exemption i
alphaSmaa adapter ostaju. Bez dodatnog tone map-a, transfera ili RGB-to-alpha
shader clamp-a. RGBA8 kvantizacija mora ostati unutar P-13 composite praga.

Napraviti mali originalni encoder koji direktno prihvata straight RGBA8,
sa PNG signature, IHDR (RGBA8, no interlace), sRGB oznakom, filter0 scanlines,
zlib IDAT i CRC32/IEND. Ne koristiti Canvas2D kao lossless međuspremnik.
Primarni compressor: native CompressionStream('deflate'); capability detekcija
bira originalni stored-DEFLATE/zlib fallback ako API nije dostupan. Fallback
menja veličinu fajla, ne dimenzije/alpha/kvalitet. Ne pretvarati stvarnu grešku
kompresije ili context loss u tihi ponovljeni izvoz. Konačni MIME image/png;
ne uvoditi runtime zavisnost ili kopirati nelicencirani encoder.

Streaming/chunking mora imati bounded buffers; ne stvarati nenadzirane kopije
celog output-a. Release typed buffers kada više nisu potrebni. PNG decoder u
testovima je postojeći dev pngjs, nezavisan od proizvodnog encoder-a.
CRC/zlib integritet, bytes/dimenzije, sRGB deklaracija i fallback se testiraju.

## 4. UI i preuzimanje

Dodati stvarnu PNG sekciju postojećem panelu: izbor 1×/2×/3× sa W×H,
'Izvezi PNG', aria-live status. Dok posao traje, drugi zahtev se odbija/
dugme je disabled; nema lažnog procenta ili tvrdnje o brzini. Greška je
čitljiva i ne briše postojeći validan editor/upload.

Kada Blob bude spreman, prikazati 'Preuzmi PNG' kao stvaran fokusabilan
blob download link sa odgovarajućim imenom/W×H. Korisnikov klik/tap pokreće
preuzimanje. Ne tvrditi da je OS sačuvao fajl bez takvog dokaza. Ne otvarati
prazan tab pre async izvoza i ne zahtevati account, mrežu ili desktop aplikaciju.
Zadržati najviše jedan ponuđen rezultat. Pri novom pokušaju stari rezultat
mora ostati jasno označen starim ili biti uklonjen; ne predstaviti ga kao
uspeh neuspelog novog zahteva. Revokacija URL-a pri zameni/dispose-u; ne
odmah nakon klika dok browser možda još čita podatke. Stale async završetak
posle dispose-a/context-loss-a ne objavljuje Blob, link ni success status.

Mobile sheet, safe-area, tastatura, focus/Escape, 44px mete i touch izolacija
ostaju. Nema Shift+E/Shift+V, hash-a, motion/video kontrole u ovom tiketu.

## 5. Neuspeh i context recovery

Izolovati admission/allocation/FBO/render/readback/encode/download lifecycle.
Svaki failure test potvrđuje: nema novog download-a/lažnog success-a,
preserved settings/upload, vraćene renderer/camera/scene/AA vrednosti gde
context postoji, oslobođene privremene alokacije i moguć novi izričit zahtev.
U recovery fazi ne obećavati neprekinut preview.

contextlost: sprečiti podrazumevani trajni gubitak kada je oporavak podržan,
poništiti aktivni export token, prikazati 'Obnavljanje prikaza', zadržati CPU
bitmap/settings. contextrestored: jedan kontrolisan pokušaj ponovne izgradnje
Studio env/shadow/pipeline resursa i ponovnog upload-a teksture/geometry iz
živog stanja; sačuvati custom/named display i trenutnu sliku. Ne pozivati
opšti Stage.dispose koji zatvara upload bitmap radi tog pokušaja. Stari
listenere i GPU vlasnike uredno zameniti, bez duplih handler-a/store pretplata.

Ako obnova ne uspe ili context ostane nedostupan, prikazati jasno ponovno
učitavanje i upozoriti da će trebati ponovo izabrati sliku; bez auto reload-a
ili demo fallback-a. Pending image decode zadržava latest-request-wins
semantiku i ne sme pokvariti obnovu. Ponovljeni loss/dispose tokom restore-a
ne pokreće konkurentne obnove. Testirati stvarni WEBGL_lose_context gde postoji
plus injected restore failure; navesti nedostupan extension/device dokaz.

## 6. Dokazi, trošak i prihvatanje

Pre punog velikog prolaza izmeriti stvaran 1× i najveći podržan output, vreme,
limite i inventar. Zabeležiti procenu trajanja pune matrice na odabranom Linux
runner-u. Nedovoljni resursi su prijavljen blokator; ne smanjivati P-13 matricu
ili timeout/prag postojećeg testa. Ne ponavljati ceo warm-up za svaku ćeliju:
jedan warm context i sekvencijalni slučajevi; velike slike ne paralelizovati.

Obavezno na konačnom implementation sadržaju:

1. `npm run ci`, `npm run build`: svi postojeći testovi + novi smisleni unit/
browser failure/transport testovi; nema promene starih assertion-a.
2. `npm run png:acceptance`: stvarni PNG svih 15 P-13 dimenzija, decoder
potvrđuje integer W/H i lossless ulaz. Reference-capable Linux okruženje mora
pozitivno izvesti svih 15; cap odbijanje je zaseban test, ne zamena za taj PASS.
3. P-13(4) puna matrica 5 devices ×4 scenes ×2 tone mappers ×5 aspects:
stvarni 1× PNG, opaque i transparent output, transparent upload. Opaque PNG
naspram nezavisnog canvas izlaza pri istom stanju/W/H/DPR1/SMAA: max1/255 RGB,
alpha255. Transparent PNG i premultiplied canvas foreground kompozitovati
preko crne/bele/obojene šahovnice: max2 RGB, max1 alpha, PNG RGB0 pri alpha0.
To nije poređenje target-a sa samim sobom; capture referenca iz canvasa.
4. Ručni asimetrični RGBA fixture, low alpha i isolated shadow; negativne
flip/lost-alpha/missing-unpremultiply/double-tone greške padaju na relevantnom
assertion-u. Zadržati postojeći controlled SMAA original-shader seed dokaz.
Svaki novi guard ima izveden FAIL → final PASS, ne import/launch failure.
5. Admission: svi limit tipovi, memory model, drugi busy zahtev, malformed
scale, allocation/FBO/render/readback/encode/contextlost/restore failure;
cleanup/URL/resource ownership, pending input i dispose. Restore preview
MSAA on/off, DPR1/2/3, aspect/outputPad, custom pose, gradient i user bitmap.
6. Stvarni Playwright download iz UI-ja na desktop i mobilnom viewport-u;
proveriti fajl/MIME/ime/decode, ne samo postojanje linka. Posebno stvarni
Android Chrome i iPhone/iPad Safari save/otvaranje PNG-a sa zapisom OS/browser-a,
1× i podržane više skale ili poštenog odbijanja. Emulacija nije taj dokaz.
Ako fizički pristup nedostaje, tražiti vlasničko testiranje gotovog preview-a
uz tačne korake; ne označiti desktop/mobile acceptance potpuno zatvorenim.
7. Postojeći PG ostaje: 20 automatskih i 36 named kandidata, bez promene
fixtures/praga/dimenzija. Dodati PNG manifest i pregledni list ključnih PNG
izlaza, providnih ivica/senke i mobile download UI u poseban CI artefakt.

Dodati odvojeni `png-capture.yml` Linux posao za T-P7 PNG acceptance/artefakte,
sa read-only permissions i concurrency otkazivanjem zastarelog PR run-a.
Pokretanje samo za PR promene relevantnih src/test/script/PNG workflow putanja
(ne docs-only), plus ručni dispatch; bez macOS matrice ili duplog ručnog run-a
ako automatski već radi na istom head-u. Postojeće CI/PG workflow-e ne menjati.
Build-time GitHub artefakt nije runtime mreža; koristiti samo committed demo/
generisani test input, nikad vlasnikov privatni upload kao javni CI artefakt.

PR opis: model/base/head/tree, F1–F12 disposition, §→file:line mapa, inventar
svih živih alokacija, merene veličine/vremena, komande/rezultati, svaka negativna
faza i vraćeni seed, CI/PNG/PG linkovi, preostali stvarni-device dokazi i
TODO(spec) ako se pojavi. Builder ne izdaje svoj MERGE verdict. Research,
odobren tiket, implementation PR i fresh review ostaju odvojeni koraci.

## Tačan write set buduće implementacije

```text
src/export/png.ts
src/export/png.test.ts
src/export/preflight.ts
src/export/preflight.test.ts
src/export/capture.ts
src/export/capture.test.ts
src/export/download.ts
src/export/download.test.ts
src/export/recovery.ts
src/export/recovery.test.ts
src/output.ts
src/output.test.ts
src/main.ts
src/settings.ts
src/settings.test.ts
src/scene.ts
src/scene.test.ts
src/scene/studio.ts
src/scene/studio.test.ts
src/scene/pipeline.ts
src/scene/pipeline.test.ts
src/scene/background.ts
src/scene/background.test.ts
src/ui/panel.ts
src/ui/panel.test.ts
src/ui/panel.css
src/screen/load.ts
src/screen/lifecycle.test.ts
guards/png-export.test.ts
guards/panel.test.ts
scripts/png-acceptance.mjs
.github/workflows/png-capture.yml
package.json
README.md
LICENSES.md
docs/tickets/T-P7.md
```

package.json samo komanda png:acceptance; bez promene dependency pinova ili
lockfile-a. LICENSES samo potrebna tačna atribucija, bez skrivene biblioteke.
Dodatne putanje zahtevaju konkretno obrazložen proširen write set pre izmene.

## Builder ne sme

Menjati PLINTH_SPEC/fixtures/PG workflow ili stare PG slučajeve; menjati
P-6/P-7 shader/color ugovor; isključiti SMAA ili dodati export MSAA; koristiti
DOM screenshot ili Canvas2D za byte-lossless transport; smanjivati skalu tiho;
slabiti testove; uvoziti CDN/backend/telemetriju; dodati video/hash/shortcuts/
batch/multi-device; menjati preset proporcije; preimenovati proizvod;
proglasiti emulator fizičkim mobilnim PASS-om; samostalno bless-ovati,
review-ovati ili merge-ovati svoj rad. Normativni gap → TODO(spec) i stop
pogođenog obuhvata, ne izmišljena dozvola za izmenu ugovora.
