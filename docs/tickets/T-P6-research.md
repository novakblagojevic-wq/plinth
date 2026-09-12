# T-P6 — istraživanje panela, izlaznog okvira i pozadine

Datum: 2026-09-12. Osnova: `f2b5eda2b37e9fda1eab27e19c9cc4c3e7b52c8c`.
Autor: Codex; tačan backend identifikator nije izložen.
Ovo je read-only istraživanje aplikacije, ne implementacioni tiket, spec odluka
ili potvrda budućeg izvoza. Jedini novi fajl je ovaj zapis. Brojevi redova ispod
odnose se na navedenu osnovu. Pročitani su AGENTS, PLINTH_SPEC, HANDOFF,
RELEASE-PLAN, tickets README/REVIEW i prethodni T-P5 ticket/research.

T-P5 PR #13 je spojen. Touch nalaz je zatvoren nezavisnim review-om na
`674d590`; vlasnik je vizuelno prihvatio kandidatske slike i posebno odobrio
merge uz odlaganje zasebnog baseline commita. To ne stvara fixtures niti
image-diff PASS. Puni §6 ostaje release obaveza. Istorijski HANDOFF navod da
T-P5 tek čeka istraživanje više nije aktuelan.

## 1. Koje klauzule se dotiču?

- §2.1–§2.7, §3: generički uređaji, lokalni runtime, bez backend-a, postojeći
  pinovi, research pre ticketa, zaseban review i vlasnički baseline.
- §4.1/P-9: fit, image padding, boja margine i očuvanje upload slike pri resetu.
- §4.2/P-8: svi DeviceSpec parametri u Advanced, uključujući značenje hinge-a.
- §4.3/P-11/P-12: pose/orbit, promena aspekta bez crop-a, floor i konačna kamera.
- §4.4/P-6/P-7: postojeće četiri scene, boja ekrana, SMAA/MSAA i kontaktna senka.
- §4.5: pet aspekata, output padding, preset/solid/gradient/transparent background.
- §4.6/P-10(4): zajednički ugovor dimenzija, boje/alpha i poređenja pre T-P6/T-P7;
  sam PNG download ostaje T-P7.
- §4.9/P-4/P-10(2–3): desktop panel 320 px, mobilni bottom sheet, četiri
  kompozicije sa thumbnail-ima, reset koji čuva sliku i zajednički settings.
- §6–§7/P-10(6): merenja ostaju odvojena od funkcionalnih testova; stari PG i
  baseline pravila ostaju. §4.7–§4.8: motion/video i hash nisu deo T-P6.

## 2. Koje file:symbol površine postoje?

| Površina | Implementacija na osnovi | Šta još nedostaje |
|---|---|---|
| UI | `index.html:10–21`, `src/main.ts:77–85,204–217` | Samo picker/status, bez panela i kontrola. |
| Veličina prikaza | `main.ts:55–70,91–103,123–132` | Preview prati ceo prozor; izlazni aspect nije posebno stanje. |
| Kamera/poze | `scene.ts:13–43,334–379`; `camera/controller.ts:14–97` | Stage ima API, ali nema panel/settings subscribe za sve promene. |
| Image state | `screen/types.ts:3–16`; `scene.ts:381–405` | Image metadata/fit/pad postoje; nema composition reset ugovora. |
| Geometrija | `devices/spec.ts:25–59`; `scene.ts:287–333` | Validacija i rebuild postoje; nema UI domena/koraka po parametru. |
| Pozadina i osvetljenje | `scene.ts:179–184,338`; `scene/studio.ts:46–54` | Scene preset prepisuje pozadinu i body; nema nezavisnog background state-a. |
| Composer | `scene/pipeline.ts:69–117` | Half-float/SMAA ili MSAA; nema javnog output/export target-a. |
| Senka | `scene/contactShadow.ts:55–76,113–138`; `studio.ts:37–44,69–92` | Poluprozirna senka i oporavak postoje; transparent final output nije dokazan. |
| PG | `scripts/pg-capture.mjs:21–24,64–89,91–134` | 20 starih + 25 named snimaka; named slučajevi nemaju isti baseline diff loop. |
| Tooling | `scripts/ci/candidate_profiles.py:22–64` | Profili su T-P3-v2/T-P5; T-P6 profil ne postoji. |

## 3. Nalazi: ugovor bez površine i kod bez dovoljnog ugovora

### F1 — Preview viewport mora se odvojiti od izlaznog formata

`main.ts:95–96` koristi innerWidth/innerHeight. Panel od 320 px ili otvoreni
bottom sheet zato bez novog layout vlasnika prekriva deo kadra. `resize:123–132`
menja renderer, kameru i composer; samo CSS smanjivanje canvasa nije dovoljno.
Tiket treba da definiše dostupnu stage oblast, uklapanje izabranog output
aspekta u nju i jedinstveno merenje dimenzija. Prazna oblast radnog prostora
oko canvasa nije letterbox unutar izlazne slike. PG zadržava eksplicitne
intrinsic/CSS dimenzije i fiksni DPR 1. Test: desktop, portrait/landscape telefon,
resize, otvaranje panela i svih pet aspekata bez odsecanja i bez promene slike.

### F2 — Dva različita padding-a ne smeju deliti značenje

`scene.ts:397–403` je P-9 image padding [0,0.25], u kraćoj strani ekrana;
`scene.ts:46–50` ima fiksni framing fill i NDC marginu. §4.5 output padding
nema jedinicu, domen ni definiciju odnosa prema toj bezbednosnoj margini.
**TODO(spec):** odrediti output padding i njegovu formulu pre implementacije.
Predlog za razmatranje: zasebno imenovano stanje okvira; nikad ga prevoditi
u image crop/pad. Domen/formula su odluka, ne postojeći ugovor. Test mora
projektovati geometriju kroz kameru, sa monotonom promenom slobodnog prostora,
a fit/image metadata ostaju isti.

### F3 — Background trenutno pripada scene preset-u

`scene.ts:179–184` postavlja scene.background; `studio.ts:46–54` uz svetlo,
environment, ekspoziciju i senku menja i body boju. Custom background bi pri
sledećem setScene nestao. T-P6 treba zaseban background model i eksplicitno
pravilo: u preset režimu prati scenu, u custom/gradient/transparent režimu
promena svetla ne briše izbor pozadine (predlog za tiket). Gradient se definiše
u izlaznim koordinatama, ne koordinatama celog prozora. Dve boje, smer,
interpolacija i ponašanje reset-a moraju biti potpuni; ne dodavati peti
lighting preset. CSS checkerboard je samo pomoć za preview i ne izvozi se.

### F4 — Transparentnost zahteva proveru celog render lanca

`main.ts:91` ne zahteva transparent clear; `scene.ts:181` uvek bira Color.
Važna verzijska razlika: pinovani `three@0.185.1` WebGLRenderer.js:77,373
ima alpha=false kao opciju, ali kreira kontekst sa alpha:true. Zato nije
ispravno zaključiti da fizički alpha kanal ne postoji. WebGLBackground.js:22
bira clearAlpha iz opcije; aplikacija i dalje nema transparent režim.

`pipeline.ts:75–102` koristi dva half-float target-a i AA. Pinovani
SMAAShader.js:440–477 meša RGBA, uz gamma obradu RGB; CopyShader.js:45 prenosi
vec4. To je dokaz iz izvora, ne dokaz ispravnih alpha rubova. Shadow plane
je transparent (`contactShadow.ts:65–70`) i mora ostati vidljiva poluprozirna
senka u PNG-u. Pre ticketa potrebna izolovana proba na pinovanoj verziji:
alpha=0 van uređaja/senke, alpha=1 u opaque regionu, delimična alpha na senki,
kompozicija preko crne i bele podloge bez svetlog/tamnog obruba, SMAA i MSAA.
Ne rešavati promenom P-6/P-7 ili isključivanjem postojećih guardova.

### F5 — Export target mora očuvati postojeći color ugovor

`pipeline.ts:64–84` označava target-e za per-material tone mapping i sRGB;
`render:112–113` završava na composer izlazu. Nema API-ja za gotov offscreen
rezultat. Dodavanje globalnog OutputPass-a bi kršilo screen exemption.
T-P6 background odluke moraju biti kompatibilne sa §4.6 offscreen RT putanjom,
a T-P7 treba da poseduje readback/PNG, supersampling i finally restoration
(render target, viewport/scissor, DPR, camera, background/clear i AA stanje).
Ne koristiti screenshot DOM-a kao implementaciju izvoza. Izolovana proba mora
porediti screen-centre boju, rubove i alpha kroz final target, uz oba tone
mapper-a. Nije izvršena u ovom read-only prolazu; ugovor boje nije zatvoren.

### F6 — Tačne PNG dimenzije još su TODO(spec), PG brojevi nisu odluka

`main.ts:55–56` navodi QA capture veličine (npr. square 800×800), ne §4.6
export base. Za pet aspekata treba eksplicitna integer tabela za 1× i njeno
množenje sa 2/3, pravilo zaokruživanja i odvajanje od DPR/layout-a.
Mogući predlog za normativni razgovor je kraća strana 1080 px:

| Aspekt | Predloženo 1×, nije usvojeno | 3× |
|---|---|---|
| 1:1 | 1080×1080 | 3240×3240 |
| 4:5 | 1080×1350 | 3240×4050 |
| 16:9 | 1920×1080 | 5760×3240 |
| 9:16 | 1080×1920 | 3240×5760 |
| 3:1 | 3240×1080 | 9720×3240 |

Tabela pokazuje problem: 3× banner prelazi opaženi 8192 texture cap.
Opaženi cap sa jednog CI-a nije univerzalni GPU limit. Predlog nije preporuka
za prihvatanje bez F7; ne sme automatski postati implementacija.

### F7 — Input cap nije output capability ili memory budžet

`main.ts:103` računa limit slike iz maxTextureSize. To ne potvrđuje uspešnu
alokaciju više color/depth/AA target-a, renderbuffer/viewport limit ili RAM za
readback. **TODO(spec):** unsupported-size politika i izlazni budžet moraju
biti rešeni pre T-P6/T-P7; P-12 rešava numerički aspect, ne GPU alokacije.
Predlog: preflight i jasno odbijanje uz očuvanje preview-a, nikad tiho smanjenje
izabranih dimenzija. Ponuditi manju veličinu kao novi izričit izbor korisnika.
Za ilustraciju, 9720×3240 ima 31.492.800 piksela; samo dva RGBA16F color
buffer-a traže 503.884.800 bajtova (~480,5 MiB), bez depth/MSAA/readback-a.
Tiket treba negativne probe limita, neuspešne alokacije/readback-a i oporavka.

### F8 — PG prag se ne prenosi automatski na PNG poređenje

`pg-capture.mjs:24,78–82` koristi pixelmatch threshold=0.1 i ukupni udeo 0.001
za postojeći PG. T-P5 research F5 i P-10(4) traže zaseban export metod/prag.
**TODO(spec):** odrediti isti render uslov i dimenzije 1× reference, orijentaciju,
boju, straight/premultiplied alpha, tretman RGB gde je alpha=0 i kriterijum za
opaque i transparent slučajeve. Prag se bira tek uz pozitivnu probu i
kontrolisane greške (double tone mapping, flip, izgubljena alpha), ne prilagodi
se da pogrešna putanja prođe. U ovom prolazu nema merenog predloga praga.

### F9 — Settings mora imati jednog vlasnika i potpuni reset

`Stage:13–43` i `PlinthHook:29–53` su skup metoda, ne kompletan state model.
`getPose()` vraća null za custom orbit, bez snapshot-a smera/rotacije;
`getImage()` daje metadata/fit/pad, a `setDevice:287–308` vraća DeviceSpec na
preset. Panel ne sme pretpostaviti da prethodno izabrano dugme i dalje opisuje
stanje posle touch orbita ili QA poziva. Tiket treba jedinstvene promene i
obaveštavanje UI-ja, redosled/validaciju kombinovanog apply-a i rollback ako
kasniji korak odbije zahtev. Ne uvoditi hash ili image bytes u settings.
Reset mora navesti tačno koje composition, DeviceSpec, image-fit/pad i
background vrednosti menja; bitmap, texture identitet i upload ostaju očuvani.
Testirati reset tokom učitavanja slike/prelaza i grešku bez delimičnog UI stanja.

### F10 — Četiri kompozicije i thumbnails nemaju zapisane vrednosti

`scene/presets.ts:10,41–79` su četiri lighting scene, ne četiri kompozicije iz
P-10(3). Potrebna je puna tabela device/spec, pose, scene, background, aspect,
output padding, fit/pad i reset pravila; za svako polje navesti set ili preserve.
Thumbnail mora odgovarati toj tabeli i koristiti dozvoljenu demo sliku.
Ne mutirati aktivan uređaj/upload radi generisanja thumbnail-a niti pokretati
četiri trajna WebGL preview-a na telefonu. Razmotriti lokalno generisane
statične thumbnails uz jasan refresh proces kada se tabela promeni.
Izbor estetike ostaje konkretan predlog za vlasnički pregled, ne proizvoljna
implementaciona pretpostavka. Nema tih asseta ili preset tabele u ovom prolazu.

### F11 — Advanced zahteva granice i otvorenu hinge odluku

`devices/spec.ts:25–49` navodi 11 polja i međuzavisne invarijante;
`scene.ts:312–333` razlikuje materijalnu izmenu od geometrijskog rebuild-a.
Tiket mora zadati jedinice (UI mm/stepeni, runtime metri/radijani), korake,
raspone i ponašanje nevažećeg unosa za sva polja, bez brisanja obaveznih kontrola.
§10 i dalje pita slider ili dva ugla za laptop hinge: **TODO(spec)** pre
izgradnje te kontrole. Postojeći opšti (0,π) validator nije UX odluka.
Česte materijalne promene ne treba pretvarati u rebuild/warm-up svega.

### F12 — Bottom sheet ne sme ponoviti konflikt touch gesta

`index.html:10–14` zaključava overflow i fiksira picker/status;
`camera/controller.ts:15–18` sada pravilno rezerviše canvas gest. Politika
mora ostati na canvas-u: panel skrol i slider input ne smeju orbitovati scenu
ili naslediti touch-action:none. Definisati desktop breakpoint, mobilnu
visinu/otvaranje, safe-area, keyboard/focus i vidljivost status greške.
Predlog je nemodalni panel koji dozvoljava interakciju sa vidljivim stage-om.
Ako se izabere modalni sheet, W3C APG zahteva inertnu pozadinu, focus unutar
dijaloga, Escape i vraćanje fokusa; ne deklarisati aria-modal za panel koji
ostavlja pozadinu aktivnom. Test: stvarni touch scroll/slider/orbit, tastatura,
rotacija ekrana, povećan tekst i vraćanje fokusa. T-P9 ne odlaže T-P6 upotrebljivost.

### F13 — Novi PG dokazi i baseline dug ostaju eksplicitni

`pg-capture.mjs:91–134` dodaje named snimke; stari diff loop je samo za prvih
20. T-P6 ne prepisuje ili briše stare slučajeve da panel stane na sliku.
Default PG ostaje čist i deterministički, dok posebni UI slučajevi pokazuju
panel; nove background/aspect kompozicije imaju zasebne nazive/dokaze.
Novak je odložio baseline commit pri T-P5 merge-u; vizuelna potvrda u razgovoru
nije kreirala fixtures. Prvi bless i eventualna dopuna poređenja named slika
moraju biti jasni zasebni koraci. Ne proglašavati svih 45 za image-diff PASS.

### F14 — Javni put za T-P6 još nije autorizovan profil

`candidate_profiles.py:22–64` nema T-P6; T-P5 ima tačan ticket/spec blob pin.
T-P5 ticket je njegovom implementacijom promenjen na main-u, pa postojeći
profil namerno ne prihvata proizvoljan sledeći paket. Ne ažurirati pin ili
proširiti putanje usput. Posle prihvatanja T-P6 ticketa pripremiti zaseban
pregledan T-P6 profil/workflow na javnom Plinth-u sa tačnim write set-om;
Astra Control i dalje bira privatni put dok se zasebno ne promeni.
To je tooling zadatak, ne razlog da T-P6 paket bude označen kao T-P5.

## Ishod i sledeći korak

Istraživanje je zapisalo površine i odluke; **T-P6 implementacioni tiket još
nije spreman za build**. P-10(4) zaustavlja pogođenu implementaciju dok se ne
razreše F4–F8. Sledeći planski korak: izolovana alpha/color/export proba uz
pinovane zavisnosti, zatim konkretan zaseban P-entry predlog za dimenzije,
unsupported-size politiku, diff kriterijum, output padding i hinge odluku.
Tek posle usvajanja normativnih odluka napisati T-P6.md sa F1–F14 disposition,
četiri potpune kompozicije, write set-om i acceptance-om. Panel/pozadina kod,
T-P7 download i profil ne uvode se ovim research commit-om.

Verifikacija ovog prolaza: git fetch, potvrđen merge main i source inspection;
pročitan lokalni pinovani Three.js iz već instaliranog node_modules. Nisu
pokretani novi application testovi, PG capture, GPU probe ili Actions dispatch.
Nijedna implementacija, spec, guard, dependency ili baseline nije promenjena.

## Primarni spoljašnji izvori

Provereno 2026-09-12; živi docs ne zamenjuju pinovani izvor:
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html):
  renderer/capability/readback API. Za alpha ponašanje gornji nalaz koristi
  stvarno instalirani three@0.185.1, ne pretpostavku iz starog vodiča.
- [W3C APG modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):
  fokus, Escape i inertna pozadina ako je mobilni panel modalni.


## Dopuna posle baseline merge-a i tehničkih proba

Main je sada e98c99e, posle baseline PR #15. F13 navod o nedostajućem
baseline commitu je istorijski: 45 odobrenih referenci je upisano, a prvih
20 automatskih poređenja prošlo je sa 0 različitih piksela. Named 25 slika
jesu sačuvane reference, ali još nemaju automatski diff loop.

[Izolovane alpha/color probe](../probes/T-P6-alpha-findings.md), ponovljivi
harness i dva JSON rezultata dokumentuju F15: postojeći SMAA na transparent
rubovima ne čuva očekivani premultiplied RGB/alpha odnos. Osnovna proba i
eksperimentalna alpha-aware varijanta svaka imaju 56 merenja bez WebGL grešaka.
Eksperiment uklanja RGB>alpha slučajeve i čuva opaque put unutar 1/255, ali
poređenje kompozicije preko pozadina još nije zatvoreno. To nije production
fix, PNG implementation ili usvojeni prag. P-10(4) ostaje otvoren; ne počinjati
pogođenu T-P6 implementaciju pre razrešenja preostalih alpha/color/PNG odluka.

### Dopuna F8/F15 — PNG transport izmeren

`docs/probes/tp6-png-results.json` i završna sekcija alpha findings zapisa sada
sadrže stvarni PNG roundtrip na osam alpha-aware/MSAA transparent kadrova.
Lossless bajtovi i dimenzije su potvrđeni; browser kompozicija istog foreground-a
preko crne/bele ima max 0, preko obojene šahovnice max 1/255. Nezavisni ručno
zadati uzorak prolazi, a izostavljeni flip, pogrešna alpha reprezentacija i
izgubljena alpha bivaju otkriveni. To zatvara transportnu probu, ne SMAA
rendering oracle ili normativni export prag. Preostale odluke i P-10(4) važe.
