# T-P5 — Kamera i poziranje

## Aktuelni status — paket posle oba merge-a, 2026-09-12

P-12 je na Plinth main-u kroz PR #11, merge
`14a88e247c7b65134c19180e0a35e8f04054d7bf`. Linux T-P5 profil je na
astra-runner main-u kroz PR #6, merge
`0f59cef4edbd078214c35f648f596e7cf3239cec`; glavni test worker je Ubuntu 24.04.
Ovaj paket prenosi isti runtime, testove i capture skriptu iz prethodno
proverenog kandidata `53fea5b8a31da5db4704b84d4b37e1fcd5c29b4e` na novi main.
Menjaju se osnova/identitet paketa i ovaj dokumentacioni zapis.

Prethodni proposal dokazi: lokalni puni CI PASS na osnovi (40 guardova,
65 unit testova) i kandidatu (45 guardova, 78 unit testova), oba build-a PASS;
cloud PG run 34700480521 ima 45/45 snimaka, a seeded run 34700703823 PASS.
Raniji cloud CI FAIL ostaje FAIL. Ti dokazi ne zamenjuju nov standardni
`candidate-tp5-test.yml` run na novom SHA-u i nisu ulaz za publisher.

Novi standardni run još nije pokrenut u trenutku pakovanja. Tek posle njegovog
prolaza zaseban publisher sme otvoriti draft PR za tačan testirani commit.
PR CI/PG, nezavisan review i Novakova vizuelna/baseline odluka ostaju otvoreni.
Stariji odeljci ispod beleže prethodna stanja; navodi da P-12 nije na main-u
ili da browser dokaz još ne postoji više nisu aktuelni.

**Status: P-11 je prihvaćen i spojen kroz PR #9. T-P5 je implementiran u kandidatu za proveru; cloud CI/PG kandidat i nezavisan pregled još čekaju.**
Autor dopune: Codex, planska sesija 2026-09-11; tačan backend identifikator
nije izložen. Implementator: GPT-5.6 Terra, zasebna implementaciona sesija.
Reviewer ostaje druga, sveža sesija.
Prvobitna osnova implementacije: `b0634fc78156a5f487f0ae1a663bc973c1b994fa`.
Dokument od značaja: `PLINTH_SPEC.md`, §4.3, P-4, P-6/P-7 i P-10;
P-11 spec-only commit `39d28e5af95b8beb68be2428bf416b5d98684ac0` je predak
trenutnog main-a i sada je normativan.
Read-only istraživanje je prethodno upisano u commit
`2d29edde102c597612f520dba97606788a99a382`:
[`T-P5-research.md`](T-P5-research.md), F1–F10.
Dopuna F11–F13 i [`T-P5-environment.md`](T-P5-environment.md) prethodno su
upisane u `8f6d483b36022e7f90a68ce33e5c1084f363dde2`.

Isporuka: ograničen orbit i četiri poze sa stabilnim responzivnim uokviravanjem,
senkom koja prati uređaj i determinističkom QA površinom. Jedna implementaciona
sesija, jedan implementacioni PR, nezavisan pregled. Ovaj dokument ne menja kod.

## Evidencija pre implementacije

1. P-10(7) je prošao na odobrenoj Astra T-P5 površini za istu osnovu: profil
   `d2f2890f8de132ba8e9ed277c083f69d0a90586b`, kandidat provera i objava su
   zabeleženi uz PR #5 Astra runner-a. To je odobreni cloud put za proveru
   implementacionog paketa, ne tvrdnja o lokalnom Chromium-u.
2. P-11 je spojen u PR #9; njegova pravila su osnova ovog kandidata.
3. Implementator ne objavljuje, ne spaja i ne ocenjuje svoj rad. Cloud CI/PG,
   vizuelna potvrda kandidata i nezavisan review ostaju obavezni pre završetka.

Istorijska lokalna provera 2026-09-11: `npm ci` i build PASS; pun CI FAIL zbog odsutnog
Chromium-a, lokalni push FAIL zbog autentifikacije (F13). GitHub veza omogućava
objavu dokumentacije. Uspešan planski CI ne zatvara environment gate. Prelazak
na Astra put je zaseban tooling zadatak posle odobrenog ugovora/write set-a.

## Odobreni write set

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

Tačan skup odobrenog scoped profila:

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

To je odobreni, zasebno scoped Astra T-P5 profil za cloud proveru. Nema glob-a `src/**`.
Guard fajlovi se smeju samo dopuniti; dozvoljena putanja nije dozvola da se
oslabi postojeći test. Candidate validacija mora proveriti i tu razliku.

Zaštićeni spec/baseline fajlovi ostaju van write set-a. `pipeline.ts`, device
proporcije, materijali i dependency pinovi nisu deo odobrenog obuhvata. Ako provera
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

## Implementirani kandidat i lokalni preflight

- Spoljni `pose-pivot` ostaje izvan builder-a, resetuje se pre rebuild-a i čuva
  prikazanu pozu bez kumulativnog pomeranja. Tačne lokalne tačke geometrije,
  uključujući instance laptop tastera, keširaju se po rebuild-u; iz njih se mere
  world granice, pod i framing.
- Čiste poze/premisi i browser adapter su odvojeni. Prelaz koristi fiksni start,
  `lambda=8` i 0,75 s; drag pravi `custom` (`null`) i zaustavlja prelaz. PG bira
  pozu odmah, bez orbit input listener-a ili rAF-a; T-P3 drop/paste/file-pick
  input ostaje dostupan. Named `capture` izbori dodaju samo
  eksplicitne portrait/square/wide kandidate; podrazumevani PG ostaje 1280×800.
- Senka se invalidira promenom uređaj/geometrija/poza ili scene, ne promenom
  kamere/aspekta ni material-only spec promenom. Depth i blur snapshot vraćaju target, alpha, background,
  environment, override material i vidljivost ravni u `finally`.
- Lokalno na implementacionom worktree-u: `npm ci --no-audit --no-fund` PASS,
  `npm run typecheck` PASS i `npm run test` PASS (77 testova; 100 endpointa i
  1.500 uzoraka prelaza). `npm run guards` nije lokalni PASS: Chromium nije
  instaliran, pa postojeće browser suite-ove ne mogu ni da pokrenu. To nije
  zamena za cloud CI/PG ili §6 p50/p99 gate. Lokalne geometrijske provere su
  funkcionalni preflight, ne merenje performansi browser-a.
- **Korekcija nakon neuspelog cloud run-a `34688776970` (kandidat `d0b967`):**
  postojeći `guards/pg-mode.test.ts:220` je otkrio da je T-P5 pogrešno uslovio
  T-P3 drop/paste/file-pick input sa `!pg`. `src/main.ts` sada zadržava ranu
  drop-prevenciju i sva tri image input puta u preview i PG režimu; samo orbit
  listeneri i njihov scheduler ostaju isključeni u PG. Nisu menjani testovi,
  guardovi ni fixture-i. Taj neuspešan run nije CI/PG PASS. Današnji
  `npm run typecheck` je PASS; prvi puni `npm run test` je 76/77 jer postojeći
  framing test prekoračuje podrazumevani Vitest limit od 5 s. Ciljani ponovni
  prolaz tog testa sa 30 s limitom je 13/13 PASS, a `npm run build` je PASS;
  to nije puni unit/CI PASS niti browser dokaz.

- **Fix nakon nezavisnog Linux preflighta 2026-09-12:** `npm run test` sada je
  PASS, 11 fajlova i 78/78 testova, sa neizmenjenim podrazumevanim Vitest limitom
  od 5 s. Izvorni proračun kešira tačne lokalne verteks tačke po uređaju i shape-u
  i radi scalarne world transformacije; endpoint test i dalje nezavisno projektuje
  stvarne world uglove, uključujući `InstancedMesh`. `frame()` prvo izračuna
  kompletnu kameru van vidljivog stanja, pa `setAspect()` menja kameru tek po
  uspešnom bezbednom frame-u. Aspekti `0.001`, `1e-6` i `Number.MAX_VALUE`
  prolaze; `Number.MIN_VALUE`, gde potrebna udaljenost nije predstavljiva kao
  konačan broj, baca bez delimične mutacije. `?capture=toString` sada pada na
  default 1280×800 proverom sopstvenog ključa, a README navodi da PG isključuje
  samo orbit input, ne T-P3 drop/paste/file-pick.

  **Istorijski TODO(spec) F14 (razjašnjen odobrenim P-12 ispod):** P-11(3) navodi svaki pozitivan konačan aspekt, ali ne
  određuje ponašanje kada IEEE-754 proračun potrebne udaljenosti nije konačan
  (npr. `Number.MIN_VALUE`). T-P5 ne steže ili tiho ne zaokružuje aspekt: odbija
  jedino takav numerički neizvodljiv zahtev atomski. Normativno razjašnjenje
  javnog domena aspekta pripada zasebnom P-entryju, ne ovom implementacionom diff-u.

## Preostali dokazi i naredne odluke

- F10 je rešen: P-11 je prihvaćen i spojen; ovaj kandidat primenjuje njegov
  ugovor, bez izmene spec-a u implementaciji.
- F1/F2/F7/F11/F12 imaju implementacione i lokalne geometrijske testove, ali
  vizuelna potvrda novih poza/širokih uređaja ostaje Novakova odluka iz cloud
  PG kontaktnog lista.
- F13 je zatvoren za odobrenu Astra površinu; lokalni Chromium ostaje nedostupan
  i ne predstavlja lokalni CI PASS.
- F5: PNG baza/zaokruživanje, diff metod/prag i nepodržana veličina ostaju
  obavezna istraživanja pre T-P6/T-P7. Ne rešavati ih usput u T-P5.

## Acceptance koji još čeka

Cloud `npm run ci`, PG kandidati/kontaktni list, nezavisan fresh-context review
i Novakova odluka o baseline slikama ostaju potrebni za završetak T-P5. Nedostajuća
baseline slika je nedostajući dokaz poređenja, ne PASS. Samo Novak potvrđuje
baseline slike; implementator ne objavljuje, ne spaja i ne ocenjuje svoj rad.


## Odobreni nastavak P-12 i korekcija snimanja, 2026-09-12

Novak je u nastavnom razgovoru odobrio konkretan P-12 i ukupni T-P5 CI budžet
od 1200 s, bez promene limita pojedinačnih testova. Research F14–F16 je zaseban
commit `efe6a05`; P-12 je zatim zaseban spec-only commit `43c9b85`.
Ovaj kandidat je potom izveden iz tog P-12 stabla, uz isti odobreni write set.
Objava/CI na PR-ovima još čekaju; ovaj zapis nije tvrdnja da je P-12 već na main-u.

F14 sada ima izričito odobren numerički ugovor: neizvodljiv aspekt se odbija
atomski bez stezanja/zaokruživanja; svih pet propisanih aspekata i ceo P-11
framing ostaju obavezni. Nema promene numeričkog runtime-a u ovoj korekciji.
Pre normale publisher putanje P-12 mora biti objavljen na main-u i odobreni
runner profil mora proveriti njegov tačan blob; provera se ne isključuje.

F15 je ispravljen u `scripts/pg-capture.mjs`: dodatni named slučajevi imaju
viewport odgovarajućih dimenzija pre navigacije. Pre screenshot-a se proverava
celi canvas u vidljivom viewport-u i jednakost intrinsic/CSS dimenzija. Starih
20 capture slučajeva ostaje neizmenjeno. Novi PG test zadržava proveru poze,
dimenzija i byte-identičnosti i dodatno proverava punu vidljivost canvasa i
boju scene u donjem delu portreta. Kontrolisano vraćanje stare visine od 800 px
mora oboriti novu assertion; rezultat te cloud provere još čeka.

Implementacija prvobitnog T-P5 paketa: GPT-5.6 Terra. Ovu korekciju snimanja i
zapis odobrenja uradio je Codex; tačan backend identifikator nije izložen.
Lokalno: typecheck PASS, svih 78 unit testova PASS, build PASS i provera sintakse
capture skripte PASS. Browser CI, ispravljeni 45-image artefakt i seeded-failure
dokaz još nisu ovim zapisom proglašeni PASS-om. F5, nezavisan review, Novakova
vizuelna potvrda/baseline odluka i zasebno merge odobrenje ostaju obavezni.


## PR #13 touch fixup — 2026-09-12

Fresh-context review [nalaz 1](https://github.com/novakblagojevic-wq/plinth/pull/13#pullrequestreview-5187775594)
reprodukovao je native browser takeover: posle prvog touch pomeraja sledi
pointercancel. Ovo je korekcija P-11(4)/F6 input lifecycle-a u istom write set-u.
Kontroler pre gesta postavlja canvas touch-action:none, pamti prethodnu inline
vrednost i prioritet, vraća ih pri dispose-u i čini ponovljeni dispose bezopasnim.
PG i dalje ne priključuje kontroler; poze, kamera, senke i capture ostaju isti.

Novi browser guard koristi pravi Chromium touch tok (CDP), mobile 400×700,
osam vertikalnih pomeraja i touchEnd; zahteva svih osam pointermove događaja,
pointerup i custom pozu. Unit provere pokrivaju pan-y!important, praznu inline
vrednost, odjavu i ponovljeni dispose posle priključivanja novog kontrolera.
Ciljani browser test PASS; kontrolisano uklanjanje touch-action postavljanja
obara isti test na pointercancel (exit 1). Privremena izmena je vraćena.
Provera tipova i oba controller unit testa PASS. Puni CI/build i novi PR CI/PG
rezultati beleže se u PR opisu po završetku; ovaj zapis ih ne proglašava unapred.

U granu je uključen pregledani main 96204cc (PR #12 za uštede) da feature push
više ne duplira PR provere. Izvorni cloud test 34710668416 dokazuje samo stari
293ee82 kandidat; nije dokaz novog head-a. Novi fresh-context review i Novakova
vizuelna/baseline odluka ostaju potrebni. Autor fixup-a: Codex.
