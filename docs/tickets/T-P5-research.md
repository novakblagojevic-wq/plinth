# T-P5 — istraživanje kamere i poziranja

Datum: 2026-09-11. Osnova: `67afe76b08ab32b73a0e2ee4a543f7c044088eed`.
Istraživanje: zasebna read-only Codex sesija `plinth_application_research`.
Ovaj dokument je zapis njenog izveštaja, uz izvore za prenos tehnika iz pregleda
vlasničkih zbirki. Tačan backend identifikator nije izložen. Nije izvršen test
aplikacije, izmenjen kod ili ocenjena buduća implementacija.

PR #8 je spojen. T-P3 v2 je završen; ne otvara se ponovo. P-10 određuje da je
sledeća implementacija T-P5. Istraživanje može prethoditi environment gate-u;
implementacija ne može. Ovaj dokument ne potvrđuje lokalni npm/Chromium prolaz.

## 1. Koje klauzule specifikacije se dotiču?

- Primarno §4.3: ograničen orbit, nezavisnost prelaza od frekvencije kadrova,
  `front`, `hero`, `top`, `lean`, responzivno udaljavanje i promena FOV bez crop-a.
- §4.2: poziranje celog generičkog uređaja i njegova geometrija; §4.4: kontaktna
  senka i materijali moraju pratiti novu pozu.
- §2.2–§2.7 i §3: lokalni runtime, licence, jedna implementaciona sesija,
  zaseban pregled, zapis istraživanja, postojeći Three.js pin i vanilla DOM.
- P-4/P-5: panel pripada T-P6; T-P5 koristi query/QA hook, a istraživanje i ticket
  imaju sopstveni zapis.
- P-6/P-7/P-9: očuvanje screen materijala, half-float/sRGB putanje i input semantike.
- P-10(4),(6),(7): rotirane world bounds, pod, senka, determinističko vreme,
  prihvaćena perspektiva širokih uređaja, PG dokazi i environment gate.
- §6–§7: warm-up, postojeći performance kriterijumi i deterministički PG.
- §4.5–§4.9 su susedne obaveze: okvir/panel, PNG, hash i virtuelno vreme/video
  ostaju u svojim kasnijim ticketima; T-P5 ne sme da im zaključa pogrešan API.

## 2. Koji file:symbol to danas implementira?

Sve putanje i brojevi redova odnose se na navedenu osnovu.

| Površina | Postojeći kod | Ograničenje |
|---|---|---|
| Kamera i framing | `src/scene.ts:createStage/frame/setAspect` (48, 80–93, 118–120) | Statično uokviravanje, bez javnih poza/orbit prelaza. |
| Geometrijske granice | `src/devices/build.ts:buildInto` (399–462) | Bounds nastaju pri izgradnji; promena transformacije zahteva novu world procenu. |
| Senka | `src/scene/studio.ts:captureShadow/change` (37–40, 52); `src/scene/contactShadow.ts:fit/render` (94–135) | Reaguje na sadašnje promene uređaja/scena, ne na novi sistem poziranja. |
| Boja i compositor | `src/scene/pipeline.ts:createPipeline` (64–116); `guards/screen-exempt.test.ts` (107–168, 188–259) | Zaštićena P-6/P-7 putanja; ne prepisivati usput. |
| Viewport | `src/main.ts` (80–114) | Veličina stage-a i resize; nema ugovora izlaznih PNG dimenzija. |
| QA API | `src/scene.ts:Stage` (18–38); `src/main.ts:PlinthHook` (25–45) | Nema zajedničkog settings/pose/seek API-ja. |
| Warm-up | `src/scene/studio.ts:warm` (55–63) | Sadašnji uređaj kroz scene; nije dokaz svih kombinacija uređaja/poza. |
| PG | `guards/pg-mode.test.ts` (47–77); `scripts/pg-capture.mjs` (42–96) | Fiksiran capture; nedostaju blagoslovljene baseline slike. |
| Životni vek | `src/scene.ts:setImage/setDevice` (100–143); `src/devices/build.ts:dispose` (520–523); `src/scene/studio.ts:dispose` (82–85); `src/scene/pipeline.ts:dispose` (115–116) | Delimično čišćenje GPU objekata; nema celog Stage dispose ugovora. |

## 3. Šta specifikacija traži, a kod nema — i obrnuto?

### F1 — Statična kamera ne pokriva poze i sve aspekte

`src/scene.ts:frame` koristi postojeće granice i statične parametre. Nema javnih
poza, orbit ograničenja ni damp prelaza; `setAspect` ne ostvaruje ceo opis promene
FOV iz §4.3. Postojeći nepozirani capture na 1280×800 ne dokazuje uokviravanje
rotiranog tablet/browser/card uređaja na uskim aspektima. T-P5 treba da proverava
projekciju stvarnih world bounds i očuva prihvaćenu široku perspektivu.

### F2 — Bounds i senka moraju pratiti pozu

Bounds se grade u `build.ts` (455–462, 497–505), a senka se osvežava kroz postojeće
device/spec/scene promene. Novi položaj mora prvo ažurirati world matricu i bounds,
pa framing i shadow fit/capture. `lean` zahteva proveru najniže tačke geometrije
prema podu, ne samo centra uređaja. Senka ne sme ostati iz prethodne poze.

### F3 — Shadow capture nema pouzdan oporavak posle izuzetka

`contactShadow.ts:render` (111–135) privremeno menja background, environment,
overrideMaterial, vidljivost ravni, clear alpha i render target. Obnavlja ih samo
normalnom putanjom, delom na fiksne vrednosti. Izuzetak može ostaviti stage u
privremenom stanju. T-P5 koji češće poziva capture treba da zabeleži prethodne
vrednosti i obnovi ih u `finally`, uključujući prethodni target/visibility.

### F4 — Boja izlaza je postojeći ugovor

P-6/P-7 definišu screen izuzet iz tone mapping-a i half-float/sRGB compositor.
Promena kamere ne daje razlog da se doda OutputPass, promeni tone mapping ili
uvede drugi renderer. Transparent preview i PNG ostaju predmet T-P6/T-P7.

### F5 — PNG normativni detalji još nisu određeni

§4.6 ne određuje bazne dimenzije/zaokruživanje za sve aspekte niti tačan metod i
prag poređenja ili odgovor na nepodržanu veličinu. P-10 traži zasebnu odluku pre
pogođene implementacije. Postojeći PG pragovi nisu automatski PNG ugovor.
Ovo ne sprečava read-only T-P5 istraživanje; sprečava nagađanje u T-P6/T-P7.

### F6 — Novi input/prelazi moraju imati vlasnika

Stage nema potpuni dispose metod, boot nema detach putanju, a studio dispose ne
obuhvata ceo subscribe/group životni vek. Novi T-P5 kontroler mora posedovati i
ukloniti svoje listenere, scheduler i callback-ove. Širi refactor aplikacije
nije implicitno u obuhvatu; prijaviti ono što ostaje van novog kontrolera.

### F7 — Timing površina još ne postoji

Stage je event-driven, bez `seek(t)` ili zajedničkog clock ugovora. PG guard
zabranjuje `Date`, `Math.random` i `performance.now` u `src/` (62–70). T-P5 treba
da odvoji matematički prelaz od izvora vremena i omogući determinističko
zadavanje koraka; ne sme oslabiti guard. Puni seek/motion ugovor pripada T-P8a.

### F8 — Panel, settings i prečice nisu T-P5

Zajednički settings, reset i panel ne postoje; vlasnik im je T-P6 po P-10.
Hash i nemotion prečice su T-P9 core. T-P5 isporučuje malu tipiziranu pose/orbit
površinu kroz Stage/QA hook, bez najavljivanja nepostojećeg PNG/video izvoza.

### F9 — Dokaz je slabiji od budućeg done kriterijuma

Warm-up svih scene preset-a na jednom uređaju nije warm-up svih pet uređaja.
PG skripta može završiti uz upozorenje kada baseline nedostaje: to je capture,
ne uspešno poređenje. Nema kompletnog §6 izveštaja. P-10 traži kontaktni list
za prvu Novakovu potvrdu i zaseban post-merge audit T-P3 v2.

### F10 — Pogrešna referenca u §4.3

Specifikacija navodi Three.js vault Entry 2 E za damp/aspectFix, ali ta stavka
obrađuje Jajce. Odgovarajući kage nalazi su Entry 6 F (410–430 na pregledanoj
verziji vaulta). **TODO(spec):** predložiti zasebnu korekciju reference; ovaj
istraživački dokument ne menja `PLINTH_SPEC.md`. Kage nema utvrđenu licencu za
kopiranje koda; matematički princip se implementira samostalno.

## Dodatni izvori iz pregleda vlasnika

- [cad-viewer](https://github.com/earthtojake/cad-viewer): snapshot sa identitetom
  scene, posebnim vlasništvom modela/view-a i odvojenim capture rezultatom (MIT).
- [nvTorchCam](https://github.com/NVlabs/nvTorchCam): projekcija/unprojekcija sa
  validity maskama i round-trip testovima (Apache-2.0 core). Prenosi se metod
  provere koordinata, ne Torch zavisnost.
- [vibecut](https://github.com/vibe-stack/vibecut): njegov pregledani export kod
  kopira live viewport i menja DPR; taj put ne ispunjava Plinth §4.6. Izolovan
  clock i awaited frame pump su reference za kasniji T-P8b, ne izbor muxera.
- [SharpShot](https://github.com/Leonxlnx/SharpShot): razlikovanje dimenzija slike,
  scale-a i DPI metapodataka (MIT); korisno za kasnije PNG acceptance testove.

Ove reference dopunjuju F1–F10. Nisu zamena za važeću specifikaciju, licence
pri uvođenju zavisnosti, environment gate, CI, human bless ili nezavisan review.

## Dopuna planiranja, 2026-09-11 — F11–F13

Codex planska sesija je ponovo pročitala nepromenjeni main `67afe76b` i lokalni
izvor pinovanog `three@0.185.1`. Ovo su dodatni nalazi, ne tvrdnja da ih je
napisala prvobitna read-only sesija. Prethode dopuni ticketa i P-11 predlogu.

### F11 — Poziranje mora biti izvan geometrijskog builder-a

`src/devices/build.ts:buildInto` (399–462) čisti grupu, procenjuje bounds i
ponovo postavlja njen položaj. `DeviceRig.update` (487–508) isti postupak
ponavlja pri promeni geometrije. Trajna rotacija ili pozicija ubačena u istu
grupu zato može uticati na naredno merenje/centriranje. Predlog: Stage poseduje
spoljni pose pivot; pre rebuild-a vrati taj pivot na identitet, zatim ponovo
primeni pozu. Tako builder ostaje neizmenjen, a poze i resize ne gube stanje.

`three/src/math/Box3.js:expandByObject` (303–379) na pinovanoj verziji navodi da
`precise=true` koristi verteks podatke za obične mesh-eve, ali **ne za
InstancedMesh**. Laptop tasteri jesu instancirani. Konzervativni world AABB je
dobar za bezbedan framing, ali nije sam dokaz dodira sa podom. Floor test mora
posmatrati stvarne transformisane vertekse, uključujući instance, ili ekvivalentnu
tačnu donju granicu. Ne meriti celu scenu sa svetlima i shadow ravni.

### F12 — Postojeći hero i novi ugovor mogu da se razdvoje bez gubitka perspektive

`src/scene.ts:frame` (80–93) za tablet/browser/card koristi smer `(0.2,0.16,1)`
i FOV 24°, za phone/laptop `(0.28,0.38,1)` i FOV 32°. Udaljenost polazi od
`FRAME_FILL=0.6` i ispravlja odnos tangensa sočiva. To su postojeći parametri
odobrenog širokog pogleda, a ne brojevi iz tuđe CAD scene.

Predlog P-11 čuva ih kao podrazumevani `hero` na referentnom aspektu 1280/800.
Ostale tri poze, granice orbita, prekid prelaza i ograničeno širenje FOV-a su
**nove projektne odluke za pregled**, ne postojeće odobreno ponašanje.
`three/src/math/MathUtils.js:damp` (134–137) koristi težinu
`1-exp(-lambda*dt)`; za deterministički QA može se računati ista putanja iz
fiksnog početnog stanja i ukupnog eksplicitno zadatog vremena.

### F13 — P-10(7) nije zatvoren

Ponovljeni lokalni pokušaj: instalacija zavisnosti i build prolaze, Chromium
download ističe, pun CI pada na browser setup-u, lokalni push nema credential.
GitHub veza ima repo read/write pristup, ali to ne popravlja lokalni browser.
Komande, osnova i ishodi su u [`T-P5-environment.md`](T-P5-environment.md).
Ovaj nalaz sprečava početak implementacije; ne sprečava objavu planskog predloga.


## Dopuna nastavka, 2026-09-12 — F14–F16

Autor: Codex, nastavna sesija; tačan backend identifikator nije izložen.
Osnova je ponovo potvrđen main `b0634fc78156a5f487f0ae1a663bc973c1b994fa`.
Posmatrani T-P5 kandidat je `a77769c3c95e6e3484fc9ddb021ebfda233faec0`.
Ova dopuna prethodi zasebnom P-12 spec-only commit-u i korekciji kandidata.
Novak je 2026-09-12 odgovorio „Moze,nastavi” na konkretan predlog P-12 i
spoljašnjeg T-P5 CI limita od 1200 s, uz nepromenjene limite pojedinačnih testova.

### F14 — Pozitivan konačan aspekt može zahtevati nepredstavljivu kameru

P-11(3) navodi svaki pozitivan konačan aspekt. Za primer `Number.MIN_VALUE`
horizontalna projekcija/udaljenost ne može biti predstavljena konačnim brojem.
Kandidat `src/scene.ts:206–279` prvo računa izdvojenu kameru i odbija neuspeh
bez promene prikazane kamere; tačno odbijanje je provereno u ranijem nezavisnom
preflight-u. To sprečava nevažeće stanje, ali je spec-u nedostajalo eksplicitno
pravilo numeričke neizvodljivosti. Nalaz je već bio otvoren kao TODO(spec) F14
u kandidatskom ticketu, a ovde dobija research zapis pre normativne dopune.

Novak je odobrio zaseban P-12: odbiti numerički neizvodljiv zahtev pre mutacije,
bez stezanja ili zaokruživanja aspekta. NDC ±0,9, near/far, FOV, referentna
udaljenost i svih pet propisanih aspekata ostaju obavezni. Broj iteracija ili
spor algoritam nisu sami po sebi numerička neizvodljivost. Ovo ne rešava F5
ni budući PNG domen veličine. Potpun usvojeni tekst ide samo u spec-only commit.

### F15 — Tačne PNG dimenzije nisu dokaz celog uspravnog kadra

[Linux run 34696153078, pokušaj 2](https://github.com/novakblagojevic-wq/astra-runner/actions/runs/34696153078/attempts/2)
proizveo je 45 PNG fajlova sa potvrđenim hash-evima i dimenzijama. Pregled
[PG artefakta](https://github.com/novakblagojevic-wq/astra-runner/actions/runs/34696153078/artifacts/10299725819)
otkrio je da `aspect-tablet-4x5.png` ima 200 odsečenih redova (800–999), a
`aspect-laptop-9x16.png` 480 (800–1279). Svi ti redovi su `#14161a`, boja tela
stranice. `scripts/pg-capture.mjs:101` i novi PG test koriste viewport 1280×800,
a `src/main.ts:55–70,95–96,123–131` postavlja canvas do 1280 px visine.
`index.html` ima visinu 100% i overflow hidden. Granica y=800 zato odgovara
browser viewport-u, a ne geometrijskom framing-u. Test identičnosti dva
ponavljanja prihvata i dva jednako odsečena PNG-a.

Korekcija ostaje u odobrenom write set-u: izabrati viewport odgovarajućih
imenovanih dimenzija pre navigacije; proveriti ceo canvas u viewport-u i
njegove intrinsic/CSS dimenzije; dodati ponašajni dokaz donjeg dela uspravnog
snimka i seeded violation sa starim viewport-om. Sačuvati 20 starih slučajeva,
20 poza, pet aspekata i sve postojeće assertion-e/pragove/timeout-e. Ne menjati
pipeline ili uklanjati crni deo naknadnom obradom slike. Ovo je implementacioni
nedostatak dokaza, ne nova spec odluka ili dozvola da se baseline potvrdi.

### F16 — Spoljašnji CI limit nema prostor za nove obavezne testove

[Isti run, CI artefakt](https://github.com/novakblagojevic-wq/astra-runner/actions/runs/34696153078/artifacts/10299596633)
potvrđuje da osnova prolazi `npm run ci` za 879,126 s: 40 guardova, typecheck,
65 unit testova. Kandidat je prekinut na 900,018 s tokom guard faze. Tri nova
T-P5 browser slučaja su prošla i trajala ukupno 118,249 s; na osnovi je do
spoljašnjeg limita ostalo samo 20,874 s. Kandidat nema CI PASS.

Novak je odobrio 1200 s isključivo za ukupnu `npm run ci` komandu T-P5
profila/probe, na osnovi i kandidatu. Vitest/Playwright limiti pojedinačnih
testova, assertion-i, tolerancije i pun obuhvat ostaju isti. T-P3 profil se ne
menja. Novi limit i ugovorni pinovi zahtevaju zasebnu proveru runner-a;
ne isključivati provere trenutnog main-a, roditelja, stabla, paketa ili uspeha
svih osam obaveznih komandi. Neuspešan pokušaj ostaje neuspešan.
