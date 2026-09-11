# T-P5 — Kamera i poziranje (nacrt)

**Status: konkretan planski predlog P-11 za pregled; implementacija blokirana.**
Autor dopune: Codex, planska sesija 2026-09-11; tačan backend identifikator
nije izložen. Uloga budućeg implementatora: GPT-5.6 Terra / Sonnet 5 ili
Novakov izbor, zasebna sesija. Reviewer je druga, sveža sesija.
Osnova: `67afe76b08ab32b73a0e2ee4a543f7c044088eed`.
Dokument od značaja: `PLINTH_SPEC.md`, §4.3, P-4, P-6/P-7 i P-10;
predloženi P-11 je u zasebnom spec-only commitu
`39d28e5af95b8beb68be2428bf416b5d98684ac0` i još nije važeći na main-u.
Read-only istraživanje je prethodno upisano u commit
`2d29edde102c597612f520dba97606788a99a382`:
[`T-P5-research.md`](T-P5-research.md), F1–F10.
Dopuna F11–F13 i [`T-P5-environment.md`](T-P5-environment.md) prethodno su
upisane u `8f6d483b36022e7f90a68ce33e5c1084f363dde2`.

Isporuka: ograničen orbit i četiri poze sa stabilnim responzivnim uokviravanjem,
senkom koja prati uređaj i determinističkom QA površinom. Jedna implementaciona
sesija, jedan implementacioni PR, nezavisan pregled. Ovaj dokument ne menja kod.

## Uslovi pre implementacije

1. Zabeležiti tadašnji main i P-10(7) environment gate na izabranoj površini:
   scoped Git read/write, podržani Node, `npm ci`, `npm run ci`, `npm run build`
   i Chromium. Tuđi cloud rezultat ne potvrđuje lokalno okruženje.
2. Ako se radi kroz Astra runner, ovaj predloženi write set mora postati posebno
   odobren i proveren T-P5 profil. T-P3 profil nije autorizacija za T-P5.
3. P-11 predlog ispod pretvara neodređene stavke u konkretan ugovor. Sačekati
   njegov nezavisan pregled, Novakovu odluku i merge; ne implementirati protiv
   neodobrene specifikacije na grani. `Nastavi` je dozvola da se pripremi ovaj
   pregledljiv rezultat, ne novo odobrenje merge-a.

Lokalna provera 2026-09-11: `npm ci` i build PASS; pun CI FAIL zbog odsutnog
Chromium-a, lokalni push FAIL zbog autentifikacije (F13). GitHub veza omogućava
objavu dokumentacije. Uspešan planski CI ne zatvara environment gate. Prelazak
na Astra put je zaseban tooling zadatak posle odobrenog ugovora/write set-a.

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
- `docs/tickets/T-P5.md`, `docs/tickets/T-P5-environment.md` i `README.md`:
  stvarno završen status, zapis provera i opis isporučenog ponašanja.

Tačan skup za budući scoped profil:

```text
src/camera/poses.ts
src/camera/poses.test.ts
src/camera/controller.ts
src/camera/controller.test.ts
src/scene.ts
src/scene.test.ts
src/main.ts
src/scene/contactShadow.ts
src/scene/contactShadow.test.ts
src/scene/studio.ts
src/scene/studio.test.ts
guards/pg-mode.test.ts
guards/camera-posing.test.ts
scripts/pg-capture.mjs
docs/tickets/T-P5.md
docs/tickets/T-P5-environment.md
README.md
```

To je predlog za odobrenje, ne postojeći Astra profil. Nema glob-a `src/**`.
Guard fajlovi se smeju samo dopuniti; dozvoljena putanja nije dozvola da se
oslabi postojeći test. Candidate validacija mora proveriti i tu razliku.

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

Konkretno po predloženom P-11(2),(4),(5): default hero; azimut [-75°,75°],
elevacija [5°,85°], bez roll-a/pan-a/zoom-a. Prelaz 0,75 s, lambda 8; na kraju
tačan cilj, bez trajnog rAF-a. Uzorkovanje fiksnog početka i ukupnog vremena
čuva nezavisnost od podele dt. Prvi stvarni drag prekida iz prikazanog stanja;
`getPose()` tada vraća `null` (custom), ne neistinit naziv prethodne poze.
Nov izbor poze ponovo hvata prikazano stanje. Tab suspend čuva proteklo vreme
prelaza; prvi rAF po povratku ne nadoknađuje skriveni interval. Testirati i
pointercancel/lostcapture/dispose, ne samo normalan pointerup.

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

Referentni aspekt, lens i pravilo FOV0+4°*clamp((1,6/aspect)-1,0,1) su P-11(3).
Za framing koristiti konzervativne world granice samo uređaja. Za stvarni floor
kontakt proveriti transformisane vertekse uključujući laptop instance (F11),
ne pretpostaviti da `Box3.setFromObject(..., true)` precizno meri instance.
Pivot poziranja je spoljašnji i resetuje se pre geometrijskog rebuild-a;
`DeviceRig.bounds` ne prepisivati kao trajno posedovane world granice. Stage
izlaže odvojene world granice koje senka i framing koriste. Proveriti povratak
na istu pozu posle više setDevice/setSpec poziva i resize-a, bez drift-a.

Uz svih 100 krajnjih kombinacija proveriti svih 12 usmerenih prelaza između
četiri poze po uređaju/aspektu u t=0, 0,1875, 0,375, 0,5625 i 0,75 s, plus
orbit granice i prekid/retarget. Ne porediti samo dve kopije iste konstante:
nezavisno projektovati stvarne world uglove kroz rezultat kamere i proveriti
NDC ±0,9, finite vrednosti, near/far i floor kontakt. Numeričke tolerancije
(npr. ≤1e-6 m za floor i ≤1e-9 za čisto vremensko stanje) obrazložiti veličinom
Float32 geometrije i dvostrukom preciznošću; nikad ih menjati radi skrivenog FAIL-a.

### 3. Senka prati istu pozu i vraća prethodno stanje (F2, F3, F4)

Redosled: transformacija → world bounds → floor/frame proračun → shadow fit/capture
→ prikaz. Osvežiti senku kada promena poze to zahteva, bez novog capture-a za
potpuno nepromenjeno stanje. Privremeno render stanje čuvati i vraćati u `finally`.

Test: namerno izazvan izuzetak tokom shadow rendera ostavlja prethodne target,
background/environment, override materijal, clear alpha i visibility. Sledeći
normalan kadar radi. Postojeći screen-exempt testovi prolaze nepromenjeni.

Izazvati grešku zasebno u depth i blur fazi, uz prethodni nenulti target,
override materijal i namerno nevidljivu shadow ravan. Nakon neuspeha sledi
uspešan render. Brojačem dokazati da orbit/aspect bez promene world uređaja ne
izaziva dodatni shadow capture, a svaki promenjen model položaj ga invalidira.
Novi subscribe mora dati odjavu; studio.dispose uklanja novu pretplatu/grupu,
bez velikog prepravljanja drugih životnih vekova van write set-a.

### 4. QA pristup je deterministički (F7–F9)

Stage/hook izlaže izbor/get poze i precizno zadavanje stanja potrebnog capture-u;
PG ne zavisi od realnog čekanja rAF-a. API ugovor se dokumentuje uz testove.
Ne koristiti zabranjene časovnike/random u `src/` i ne oslabiti pg guard.
Panel, hash i korisničke Q/W/E/R prečice ostaju svojim ticketima po P-4/P-10.
Puni `seek(t)` i tri motion preseta ostaju T-P8a.

Dokumentovati `?pose=front|hero|top|lean` (fallback hero samo pri nepoznatom
query stringu) i Stage/hook metode za izbor, čitanje i eksplicitno vremensko
uzorkovanje. Runtime/QA setter-i odbijaju nevažeće ID-jeve i nefinitne brojeve
bez mutacije. U PG je setPose neposredan, bez aktivnog kontrolera/prelaza.
Postojeći default PG capture zadržava dimenzije 1280×800. Dodatne aspect
capture-e skripta eksplicitno označava i ne preimenuje postojeće slučajeve.

Test: ponovljen identičan capture daje isti rezultat; rezultat ne zavisi od broja
interaktivnih frame-ova pre ulaska u PG. Dokumentovati cold/warm uslove i stvarno
odrađene kombinacije warm-up-a, bez tvrdnje o celom §6 gate-u ako nije pokrenut.

## TODO(spec) / odluke i preostale prepreke

- F10: rešeno **predlogom** P-11(1), još čeka prihvatanje/merge.
- F1/F2/F7/F11/F12: konkretni parovi, orbit/floor/aspect i vremenski ugovor su
  **predlog** P-11(1–6), ne odobrena implementaciona osnova. Za nove poze još
  nema rendera; vizuelna potvrda ne može se izvesti iz tabele brojeva.
- F13: pun environment gate ostaje otvoren. Astra T-P5 profil nije napravljen
  i zahteva zaseban odobren tooling obuhvat; T-P3 profil nije proširen.
- F5: PNG baza/zaokruživanje, diff metod/prag i nepodržana veličina ostaju
  obavezna istraživanja pre T-P6/T-P7. Ne rešavati ih usput u T-P5.

## Done za buduću implementaciju

`npm run ci` i build prolaze na tačnom kandidatu, relevantni Chromium/PG testovi
imaju stvarne rezultate, kontaktni list je dostupan za Novakovu potvrdu i sve
blokirajuće primedbe svežeg review-a su zatvorene. Nedostajuća baseline slika je
nedostajući dokaz poređenja, ne PASS. Samo Novak potvrđuje baseline slike.
Nacrt ticketa, uspešan capture ili zelen CI nisu sami po sebi završen T-P5.
