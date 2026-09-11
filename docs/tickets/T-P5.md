# T-P5 — Kamera i poziranje (nacrt)

**Status: predlog za pregled; implementacija još nije otvorena.**
Osnova: `67afe76b08ab32b73a0e2ee4a543f7c044088eed`.
Dokument od značaja: `PLINTH_SPEC.md`, §4.3, P-4, P-6/P-7 i P-10.
Read-only istraživanje je prethodno upisano u commit
`2d29edde102c597612f520dba97606788a99a382`:
[`T-P5-research.md`](T-P5-research.md), F1–F10.

Isporuka: ograničen orbit i četiri poze sa stabilnim responzivnim uokviravanjem,
senkom koja prati uređaj i determinističkom QA površinom. Jedna implementaciona
sesija, jedan implementacioni PR, nezavisan pregled. Ovaj dokument ne menja kod.

## Uslovi pre implementacije

1. Zabeležiti tadašnji main i P-10(7) environment gate na izabranoj površini:
   scoped Git read/write, podržani Node, `npm ci`, `npm run ci`, `npm run build`
   i Chromium. Tuđi cloud rezultat ne potvrđuje lokalno okruženje.
2. Ako se radi kroz Astra runner, ovaj predloženi write set mora postati posebno
   odobren i proveren T-P5 profil. T-P3 profil nije autorizacija za T-P5.
3. Zatvoriti TODO(spec) ispod i pregledati ugovor kamera/poza pre kodiranja.
   Potrebna P-izmena ide u zaseban commit. Ne menjati specifikaciju u build commitu.

## Predloženi write set

- Novi `src/camera/poses.ts`, `src/camera/controller.ts` i njihovi unit testovi:
  tipovi, čisti proračuni, prelaz i upravljanje samo novim listenerima/schedulerom.
- `src/scene.ts`, `src/scene.test.ts`: Stage API, world bounds, framing i integracija.
- `src/main.ts`: QA/query povezivanje i prosleđivanje inputa, bez korisničkog panela.
- `src/scene/contactShadow.ts`, `src/scene/studio.ts` i ciljani novi testovi:
  ažuriranje i oporavak privremenog render stanja.
- Aditivne provere u `guards/pg-mode.test.ts` i novom
  `guards/camera-posing.test.ts`; `scripts/pg-capture.mjs` samo za dodatne imenovane
  pose/aspect kandidate. Postojeći capture slučajevi ostaju.
- Dokumentacija završenog ticketa i README opis stvarno isporučenog ponašanja.

Zaštićeni spec/baseline fajlovi ostaju van write set-a. `pipeline.ts`, device
proporcije, materijali i dependency pinovi nisu deo ovog predloga. Ako provera
otkrije da su potrebni, prijaviti dodatni obuhvat pre njihove izmene.

## Ponašanje i dokaz

### 1. Poza i orbit imaju jedno stanje (F1, F6, F8)

Uvesti tipizirane identifikatore `front`, `hero`, `top`, `lean` i named camera +
device transform parove. Odvojiti željenu i prikazanu pozu, proračun prelaza i
input. Orbit ograničava pogled iznad poda i sprečava flip. Ručni input prekida
aktivni prelaz po pregledanom pravilu; resize ne vraća korisnika na default pozu.
Novi kontroler uklanja sopstvene listenere i zakazane pozive kada se ugasi.

Test: ista početna/ciljna poza i isto ukupno vreme uz različitu podelu dt daju
ekvivalentan rezultat u obrazloženoj numeričkoj toleranciji; nulti dt ne menja
stanje; završena poza je stabilna; ponovljeni attach/detach ne umnožava input.

### 2. Framing koristi world geometriju (F1, F2)

Posle transformacije uređaja ažurirati world matrice i bounds. Proveriti sve
relevantne projektovane uglove granica, validnost projekcije i near/far opseg.
Responzivni framing sledi §4.3: koriguje udaljenost duž ose pogleda i FOV;
ne menja sliku, ne crop-uje i ne letterbox-uje. `lean` ne sme gurnuti geometriju
ispod poda. Položaj i target moraju imati isti koordinatni ugovor.

Test: svih pet uređaja × četiri poze × pet propisanih aspekata, uključujući
široke tablet/browser/card slučajeve; svi relevantni uglovi su unutar frame-a,
nema invalid/behind-camera projekcija, a najmanja world visina poštuje pod.
Vizuelni kontaktni list mora potvrditi da široke ivice nisu ponovo previše
izobličene. Matematičko uklapanje samo po sebi ne dokazuje dobru perspektivu.

### 3. Senka prati istu pozu i vraća prethodno stanje (F2, F3, F4)

Redosled: transformacija → world bounds → floor/frame proračun → shadow fit/capture
→ prikaz. Osvežiti senku kada promena poze to zahteva, bez novog capture-a za
potpuno nepromenjeno stanje. Privremeno render stanje čuvati i vraćati u `finally`.

Test: namerno izazvan izuzetak tokom shadow rendera ostavlja prethodne target,
background/environment, override materijal, clear alpha i visibility. Sledeći
normalan kadar radi. Postojeći screen-exempt testovi prolaze nepromenjeni.

### 4. QA pristup je deterministički (F7–F9)

Stage/hook izlaže izbor/get poze i precizno zadavanje stanja potrebnog capture-u;
PG ne zavisi od realnog čekanja rAF-a. API ugovor se dokumentuje uz testove.
Ne koristiti zabranjene časovnike/random u `src/` i ne oslabiti pg guard.
Panel, hash i korisničke Q/W/E/R prečice ostaju svojim ticketima po P-4/P-10.
Puni `seek(t)` i tri motion preseta ostaju T-P8a.

Test: ponovljen identičan capture daje isti rezultat; rezultat ne zavisi od broja
interaktivnih frame-ova pre ulaska u PG. Dokumentovati cold/warm uslove i stvarno
odrađene kombinacije warm-up-a, bez tvrdnje o celom §6 gate-u ako nije pokrenut.

## TODO(spec) / otvorene projektne odluke

- F10: zasebno ispraviti §4.3 vault referencu na provereni izvor metode. Ne kopirati
  nelicencirani kage kod.
- F1/F2: pre build-a zabeležiti konkretne camera/device parove, dozvoljene orbit
  granice, floor ugovor i odnos aspect/FOV/distance sa očuvanjem prihvaćene široke
  perspektive. Ne birati te brojeve iz tuđe CAD scene. Ako odluka uvodi normativno
  ponašanje koje §4.3 ne određuje, ide u zasebnu P-izmenu.
- F5: PNG baza/zaokruživanje, diff metod/prag i nepodržana veličina ostaju
  obavezna istraživanja pre T-P6/T-P7. Ne rešavati ih usput u T-P5.

## Done za buduću implementaciju

`npm run ci` i build prolaze na tačnom kandidatu, relevantni Chromium/PG testovi
imaju stvarne rezultate, kontaktni list je dostupan za Novakovu potvrdu i sve
blokirajuće primedbe svežeg review-a su zatvorene. Nedostajuća baseline slika je
nedostajući dokaz poređenja, ne PASS. Samo Novak potvrđuje baseline slike.
Nacrt ticketa, uspešan capture ili zelen CI nisu sami po sebi završen T-P5.
