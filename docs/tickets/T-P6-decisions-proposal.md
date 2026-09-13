# T-P6/T-P7 — konkretan predlog odluka za P-13

Status: **NOVAK JE ODOBRIO ODLUKE 1–6 u nastavnom razgovoru.**
Odobreni tekst je prenet u zaseban P-13 spec commit; planning PR još nije spojen.
Donji tekst čuva originalni predlog i značenje odobrenja.
Autor: Codex. Osnova aplikacije: e98c99e680f2692d4c6e4b2003f1d83d120bc005.
Dokazi: T-P6-research F2–F8/F11/F15 i tri vrste numeričkih proba u
`docs/probes/T-P6-alpha-findings.md`. Ovaj dokument ne otvara build ticket.
P-13 je sledeći slobodan broj na proverenom main-u; proveriti ponovo pri upisu.

## 1. Tačne PNG dimenzije — F6

| Aspekt | 1× | 2× | 3× |
|---|---|---|---|
| 1:1 | 1080×1080 | 2160×2160 | 3240×3240 |
| 4:5 | 1080×1350 | 2160×2700 | 3240×4050 |
| 16:9 | 1920×1080 | 3840×2160 | 5760×3240 |
| 9:16 | 1080×1920 | 2160×3840 | 3240×5760 |
| 3:1 | 1920×640 | 3840×1280 | 5760×1920 |

Tabela je ugovor; obe integer dimenzije množe se celim scale 1/2/3.
Nema računanja iz CSS viewport-a, DPR-a ili približnog decimalnog aspekta,
nema zaokruživanja ni dodatnog skrivenog faktora supersampling-a. Scale znači
renderovanje i sačuvan PNG upravo navedenih dimenzija, bez naknadnog spuštanja
na 1×. Izlazni DPR=1; preview DPR ne određuje PNG. Default scale=1.

Banner je namerno 1920×640 na 1×, umesto ranije ilustracije 3240×1080:
najveća stranica u celoj tabeli je 5760, ne 9720. To smanjuje trošak, ali
**ne garantuje** podršku na svakom GPU-u. Najveći kadar ima 18.662.400 piksela.
Sve veličine su izbori koje aplikacija proverava, ne obećanje univerzalnog 3×.

## 2. Velike slike, ograničenja i oporavak — F7

Predlog politike prijema zahteva:

- Najviše 20.000.000 izlaznih piksela po slici i jedan izvoz istovremeno.
- Obe stranice moraju stati u relevantne MAX_TEXTURE_SIZE,
  MAX_RENDERBUFFER_SIZE i obe MAX_VIEWPORT_DIMS komponente stvarnog konteksta.
  P-9 cap za uvoz slike nije export limit i ne koristi se kao dokaz podrške.
- Dodatni planski budžet izvoza: 48 bajtova po izlaznom pikselu + 32 MiB,
  najviše 1024 MiB po zahtevu. To je **politika prijema**, ne očitana slobodna
  memorija, garantovana gornja granica browser procesa ili tvrdnja o telefonu.
  Obuhvata planirane full-size color/depth/AA/readback/konverzione površine;
  postojeći preview, upload, driver overhead i encoder interne kopije mogu
  povećati stvarnu potrošnju. T-P7 ticket mora popisati žive alokacije i koristiti
  veći izračun ako izabrana implementacija prelazi ovaj planski model; ne sme
  potcenjivanjem proći budžet. Najveći kadar je po ovom modelu ~886,3 MiB.
- Export koristi SMAA bez multisample renderbuffer-a na odabranoj 1×/2×/3×
  veličini; preview MSAA opt-in ostaje. To precizira §4.4/§4.6 supersampling:
  ne kombinovati visoku izlaznu rezoluciju sa skrivenim dodatnim 4× MSAA troškom.

Preflight odbija zahtev pre promene vidljivog stanja. UI navodi tražene
W×H i razlog, uz izbor manje skale koju korisnik sam potvrđuje. **Nema tihog
smanjenja rezolucije, automatskog ponovnog izvoza ili predstavljanja nižeg
kvaliteta kao 3×.** Ako ni 1× nije moguć, jasno odbiti PNG na tom uređaju.

Prolaz preflight-a nije garancija alokacije. Neuspeh target-a, framebuffer-a,
render/readback-a ili enkodiranja ne daje download/uspeh. Privremene resurse
osloboditi, a renderer/scene/camera stanje vratiti u finally. Sačuvati settings
i učitanu sliku; ne preći na demo. Ako GPU izgubi kontekst, trenutni prikaz
može privremeno nestati: prikazati oporavak, obnoviti GPU resurse iz sačuvanog
stanja kada je moguće, a inače ponuditi jasno ponovno učitavanje. Ne obećavati
neprekidan preview posle stvarnog context loss-a. Negativni testovi pokrivaju
svaku od ovih faza bez lažnog uspeha ili automatskog smanjenja dimenzija.

## 3. Boja i providnost — F4/F5/F15

Preview i export dele alpha-aware SMAA neighborhood blend potvrđen kontrolisanom
probom. P-6/P-7 per-material tone mapping, screen exemption, half-float put i
postojeća gamma-2.2 SMAA interpolacija ostaju; ne dodavati globalni OutputPass.
MSAA ostaje opt-in za preview. Transparent pozadina koristi clear alpha=0;
kontaktna senka zadržava delimičnu alpha. Checkerboard je samo UI, ne PNG.

Render put prenosi premultiplied encoded RGB/alpha. PNG dobija straight RGB,
alpha i top-down redove: razdvojiti RGB od alpha samo jednom, normirati RGB=0
kada je alpha=0, bez drugog tone mapping-a ili transfer konverzije. Detalj
konverzije pre/posle RGBA8 mora proći navedena poređenja; ne clamp-ovati
neispravan SMAA RGB na alpha umesto korekcije mešanja.

## 4. Poređenja i pragovi — F8

Predložene acceptance granice su odvojene od postojećih PG baseline pravila:

1. PNG dimensions: tačne integer vrednosti iz tabele za svih 15 izbora.
   Dekodirana alpha i lossless PNG zapis moraju odgovarati ulazu enkodera;
   eksplicitno proveriti orijentaciju asimetričnim uzorkom.
2. Opaque 1× PNG naspram preview/PG reference: identično stanje, izlazne
   dimenzije iz 1× tabele, DPR1, SMAA, motion frozen i završen warm-up; max
   razlika 1/255 po RGB kanalu, alpha tačno 255. Referenca mora doći iz canvas
   izlaza, ne iz istog export target-a. To su dodatni QA capture slučajevi;
   postojeći default PG 1280×800 i njegov diff loop ne menjaju se.
3. Transparent: dekodirani PNG i nezavisni premultiplied preview readback,
   istog foreground-a i istih dimenzija, kompozitovati preko crne, bele i
   obojene šahovnice; max 2/255 po RGB kanalu i max 1/255 alpha. Gde je alpha=0
   RGB se ne poredi kao vidljiva boja, ali se zahteva normalizacija PNG RGB=0.
   Ne koristiti opaque rerender sa promenjenom pozadinom kao alpha oracle.
4. Kontrolisani SMAA blend oracle: max 1/255 po RGBA kanalu, opaque parity max
   1/255; originalni pogrešni shader mora pasti. PNG greške flip/lost-alpha/
   missing-unpremultiply i dodatni double-tone-map moraju pasti na relevantnoj
   proveri. Prag se ne podiže da neispravan put prođe.

Dokazi do sada: 128 blend slučajeva prolaze, opaque byte parity 0; osam PNG
kadrova ima max 0 preko crne/bele i 1 preko šahovnice; tri transportne greške
padaju. **Puna gornja acceptance matrica još nije izvršena.** Postojeće probe
su 320×200, phone/laptop, soft-studio, Linux/SwiftShader. Budući ticket zahteva
svih pet uređaja/četiri scene, oba tone mapper-a, sve aspekte i transparent
input. Velike veličine i mobilni download/capability proveravaju se u T-P7;
T-P6 mora dokazati stvarni transparent preview. Usvajanje praga nije test PASS.

## 5. Output padding — F2

Posebno stanje `outputPad` u [0,0.25], UI 0–25%, korak 1 procentni poen,
default 0. Označava dodatno udaljavanje uređaja u kadru, **ne** image margin.
Prvo izračunati P-11/P-12 bezbednu osnovnu kameru sa udaljenošću d0, zatim
zahtevati udaljenost najmanje d0/(1-2*outputPad) od istog target-a duž iste
ose; near/far i bezbednu projekciju ponovo potvrditi. FOV ostaje propisani.
0 čuva postojeći kadar; 25% zahteva dvostruku osnovnu udaljenost. Vrednost
nije obećanje da je prazna ivica tačno toliko piksela/procenata slike.
Promena ne menja pozu, orbit, DeviceSpec, upload, image fit ili P-9 image pad.
Ne dodavati letterbox. Test mora dokazati formulu i monotono smanjenje
projektovanog uređaja kroz vrednosti i aspekte, uz očuvanje P-11 margine.

## 6. Pozadina i hinge — F3/F11

Background stanje: preset, solid, gradient ili transparent. Preset prati boju
izabrane lighting scene; u ostala tri režima promena scene čuva custom izbor.
Solid boja je sRGB #RRGGBB. Gradient u v1 ide vertikalno od gornje do donje
boje, linearno interpolira encoded sRGB kanale u izlaznim koordinatama, bez
dodatnog tone mapping-a, alpha=1. Izbor smera nije dodatna kontrola u v1.
Početne custom boje: solid #ffffff; gradient top #f2f4f8, bottom #c8d3e3.
Reset bira preset režim. Promena moda čuva prethodno unete custom boje.

Hinge je **slider 60–150°, korak 1°**, u Advanced, aktivan kada je standType
hinge. Runtime ostaje u radijanima. Ne menjati postojeći laptop default 1.85
rad (~106°) radi UI zaokruživanja; prikaz može zaokružiti, tek korisnikov unos
zadaje ceo stepen. Reset vraća tačan preset. Neaktivno polje čuva vrednost i
ne menja geometriju slab-a. Ovim se rešava §10 slider/two-values pitanje;
puni ostali Advanced rasponi i četiri kompozicije pripadaju T-P6 ticketu.

## Šta znači odobrenje

Novak odobrava **odluke 1–6**, ne slike, test PASS, production implementaciju
ili merge PR #14. Zbog P-5/P-10(4), nakon odobrenja pripremiti zaseban commit
koji menja samo PLINTH_SPEC.md i upisuje ove odluke kao P-entry. Potom se
sastavlja T-P6 ticket sa potpunim acceptance-om i disposition-om nalaza.
Fresh-context review i posebno odobrenje merge-a ostaju. Ovaj dokument sam
ne menja specifikaciju, fixture-e, guardove ili runtime.
