# T-P9c — telefon i soft-studio, vizuelna proba

Autor: Codex. Osnova: PR #25 `209841d` sa main `8d92de1` (samo usklađivanje
GitHub adresa), lokalni merge `7f01419`. Vlasnikov zahtev od 2026-09-15:
puniji metalni telefon, jača kontakt senka, blago zadnje rubno svetlo u
soft-studio i veći početni telefon u kadru. Tražen je novi konkretan prikaz.
Ovo je istraživanje i ponovljiva vizuelna proba, nije prihvatanje implementacije.

## Nalazi

- F1 — §4.2: `src/devices/presets.ts:18–22` definiše telefon 72×150×8 mm,
  bezel 3,5 mm, metalness 0,8 i roughness 0,35. `src/devices/build.ts:200–207`
  već prenosi ove vrednosti u fizički materijal. Probati 10 mm / 4,2 mm /
  0,95 / 0,24; ostale uređaje i boju njihovog okvira ne menjati.
- F2 — §4.4.2, P-6/P-7: `src/scene/presets.ts:45–50` i
  `src/scene/environment.ts:76–107` već imaju jednu proceduralnu svetlu
  površinu. Pomeriti soft-studio površinu iza uređaja kao izvor rubne
  refleksije, uz niži intenzitet ravnomernog svetla. Time nije potrebna
  druga env površina, novi render prolaz ili preuzeti HDRI. Glare 0,35 i
  granica 24/255 ostaju; boju slike treba proveriti postojećim guard-om.
- F3 — §4.4.3: `src/scene/presets.ts:52` ima opacity 0,55 i blur 2,5.
  `ContactShadow.fit` na `src/scene/contactShadow.ts:98–113` zavisi od
  world granica. Deblji telefon već proširuje kontakt; prvo probati opacity
  0,85 i blur 2 bez menjanja 256² cilja ili depth/alpha algoritma. Prva slika
  pokazala je pretvrd kontakt; završna proba je opacity 0,72 i blur 4.
- F4 — §4.3, P-11(2–3), P-12/P-13: `src/scene.ts:239–243` nameće minimalnu
  referentnu udaljenost uz FRAME_FILL=0,6. Nije moguće povećati početni telefon
  smanjenjem outputPad (već je nula). **TODO(spec):** pre trajne implementacije
  većeg telefona potreban je odvojen P-upis uskog novog camera ugovora.
  U probnom renderu uporediti phone fill=0,82 uz iste FOV, smer, near/far,
  NDC≤0,9 i pozitivan aspekt. Ostale klase ostaju na 0,6. Ovo nije automatska
  promena ugla prema upload slici; stari linkovi i PNG kadar zahtevaju proveru.
- F5 — §4.8–4.9: `src/ui/compositions.ts:8` je početni Studio 4:5, phone,
  hero i outputPad=0. Zato glavni dokaz treba da bude stvarni 4:5 PNG iz
  interfejsa, kao i fresh-start desktop 1280×800 i mobile 400×800.
- F6 — §2.5/§7: PR #25 još nije prihvaćen. Nove probe nisu CI kandidati,
  ne menjaju `fixtures/pg`, pragove ili PR #25. Laptop/dark-glass kontrolni
  kadar treba porediti byte-for-byte jer se njihovi ulazi ne menjaju.
- F7 — T-P9b F9 ostaje: neravna unutrašnja ivica nije ovim dokazano rešena.
  Ne koristiti veći render ili metalnost kao dokaz ispravke screen shader-a.
- F8 — §4.2/§4.4.1: veći probni kadar otkrio je ravne trake na zaobljenom
  okviru. `src/devices/build.ts:165–170` računa normale nad neindeksiranim
  ExtrudeGeometry površinama, pa se susedne površine ne usrednjavaju.
  Proba dodaje opciju samo za klasu phone i koristi postojeći Three.js
  `toCreasedNormals` sa granicom 60°. Pozicije i broj trouglova ostaju isti.
  U ovoj pinovanoj verziji utility grupiše pozicije korakom 0,01 jedinice;
  zato probna kopija geometrije najpre prelazi iz metara u milimetre, pa se
  vraća u metre. Ne primenjivati taj utility direktno na telefon u metrima.
  Odvojeno se oslobađa original i eventualna privremena kopija. Ovo ne
  menja screen shader i ne zatvara F7.

## Ponovljiva proba

`node scripts/phone-studio-preview.mjs` pokreće postojeći Vite/Chromium/SwiftShader
put. Vite transform primenjuje tačno navedene probne zamene samo u memoriji,
uz proveru da svaka izvorna tačka postoji tačno jednom. Datoteke `src/`,
specifikacija, testovi i referentne slike ostaju identični osnovi. Rezultati
idu u `phone-studio-preview/`, sa manifestom parametara i stvarnim PNG izvozom.

Posle vizuelnog izbora: zaseban P-upis za F4, precizan implementacioni tiket,
primena izabranih vrednosti, osvežavanje zahvaćenih thumbnail-a, lokalni CI/build,
cloud CI/PG/PNG, nezavisan pregled i vlasnikov bless. Ovaj redosled čuva
zahtev da se tačne vrednosti izaberu iz posmatranih slika, pre trajnog build-a.

## Rezultat probnog prikaza, 2026-09-15

- Linux, Node 24.19.0, Chromium 153.0.8010.12 / SwiftShader. Nema novih
  dependency pinova. Kandidat: phone 10 mm / bezel 4,2 mm / metalness 0,95 /
  roughness 0,24; soft-studio window elevation 35°, azimuth 140°, size 45×35°,
  intensity 12, sky zenith [0.8,0.85,0.92], horizon [0.30,0.33,0.38],
  ground [0.08,0.09,0.11]; shadow opacity 0,72 / blur 4; phone frame fill 0,82.
- Stvarni Export PNG → Download PNG uspešan; dekodirana veličina 1080×1350.
  Fresh-start 1280×800 i 400×800 snimljen bez pageerror grešaka. Kontrolni
  laptop/dark-glass PNG je byte-identičan prethodnom prikazu.
- Izmerena visina vidljive siluete, uključujući senku, pri istom PNG formatu:
  658 → 881 px (oko 34%). Ovo je poređenje slike, ne garantovani zoom faktor.
- Typecheck i svih 177 postojećih unit testova prolaze i nad izolovanom
  kopijom izvora sa probnim promenama. Postojeći testovi nezavisno proveravaju
  svih 100 device/pose/aspect krajnjih stanja i 1.500 uzoraka prelaza.
  Broj tvrdnji/pragovi nisu menjani.
- Puna lokalna CI provera osnovnog koda je prekinuta; nije PASS i ne predstavlja
  validaciju kandidata. Cloud CI/PG/PNG kandidata nisu pokretani. Nema GitHub
  push-a, merge-a, baseline bless-a ili objave sajta. PG i puni PNG color/alpha
  acceptance ostaju deo kasnije implementacije; ovo je konkretan vizuelni predlog.
- Tip Mesh u receptu je eksplicitno proširen radi BufferGeometry rezultata;
  to je TypeScript-only izmena bez promene rendera nakon proverenih snimaka.

## Korekcija gornje bele trake, 2026-09-15

- Korisnik je prihvatio debljinu i ugao prethodnog kandidata; traži uklanjanje
  bele gornje linije i malo jaču kontaktnu senku.
- Uzrok je contain margina: demo je 845×1862, a otvor uz bezel 4,2 mm ima
  63,6×141,6 mm. Razlika odnosa daje oko 0,7271 mm praznine gore i dole.
  Podrazumevani beli padColor čini tu prazninu belom. U ovoj implementaciji
  nema odvojenog staklenog mesh-a koji bi trebalo pomerati.
- `node scripts/phone-edge-probe.mjs` proverava uzrok zamenom padColor u
  magentu. Broj magenta piksela u gornjoj polovini stvarnog stage snimka:
  original 464; inset smanjen 0,2 mm 468; uključen MSAA 436; korigovana
  širina 0. Izveštaj nema pageerror grešaka. Ovo razlikuje marginu od
  pretpostavljenog razmaka ili problema anti-aliasinga.
- Novi recept koristi stalnu širinu telefona 72,66 mm umesto 72 mm
  (izračunata idealna širina 72,6599356 mm) i opacity senke 0,78 umesto
  0,72. Visina, ugao, frame fill, debljina, bezel, inset i blur su zadržani.
  Contain ostaje, slika nije odsečena; ovo nije dinamičko menjanje uređaja
  prema svakom upload-u. Drugačiji odnosi upload slike i dalje daju margine.
- Recept se sada automatski zapisuje kao recipe.json uz svako pokretanje.
  Dijagnostička proba fiksira staru širinu za negativne kontrole, čak i kada
  koristi ažurirani recept. Ovo ostaje vizuelno istraživanje, ne objava.
- Novi stvarni PNG izvoz 1080×1350, desktop/mobile i laptop/dark-glass kontrola
  prolaze isti preview harness bez pageerror grešaka; kontrola je byte-identična.
  Pregled izvoza i uvećanog poređenja potvrđuje da je bela traka uklonjena.
  Tanka rasterizovana granica materijala ostaje vidljiva pri uvećanju; to nije
  contain praznina. Prethodnih 177 testova nije ponavljano za ovu malu korekciju;
  njihove rezultate iz prethodnog odeljka ne predstavljati kao novi CI prolaz.

## Završni polish prolaz i ceo grid, 2026-09-15

Vlasnik traži preostalu svetlu ivicu, mekšu/dužu kontaktnu senku i blag rim
light, zatim pregled svih 20 kombinacija. Osnova prethodne probe `62ffe8a`;
fetch potvrđuje 0 nedostajućih commit-a sa origin/main. Ovo nastavlja isti
vizuelni izbor; F4 i kasniji implementacioni/review postupak ostaju.

- F9 — §4.1/§4.4.1, `src/screen/material.ts:27–34,60–64` i
  `src/devices/build.ts:276–291`: SDF/alphaHash delimična pokrivenost na ivici
  otkriva backplate koji deli srebrni frame materijal. Novi phone-only probni
  backplate koristi fizički tamni materijal #080a0d, metalness 0, roughness
  0,85. Dodaje se u postojeći Materials lifecycle, oslobađa kroz postojeći
  dispose; nema dodatnog mesh-a, screen sloja, promene SDF-a, slike ili inset-a.
  Uvećan PNG pokazuje nestanak svetlog oreola; granica je sada tamna. Ovo
  rešava kontrast podloge, ne tvrdi da je svaka rasterizovana ivica savršena
  na svakoj rezoluciji ili da je puni F7 shader acceptance zatvoren.
- F10 — §4.4.2–3, `src/scene/presets.ts:48,52`: soft-studio window intensity
  12→16, shadow opacity 0,78→0,84 i blur 4→6. `ContactShadow` zadržava 256²
  depth capture, dve postojeće blur faze, projekciju i alpha; meki rub senke
  se širi, bez novog directional-shadow algoritma ili dodatnog prolaza.
  Ove soft-studio vrednosti važe za sve uređaje u toj sceni, zato se pregleda
  ceo grid. Samo phone roughness ide 0,24→0,18; metalness ostaje 0,95.
  Širina/visina, frame fill, ugao, bezel i inset ostaju prethodno prihvaćeni.
- F11 — §4.1/P-9 i T-P9b F3: ceo grid potvrđuje očekivane bočne contain
  margine portretnog demo sadržaja na tablet/laptop/browser/card. To nije
  novi defekt geometrije. Za pun demo ekran tih uređaja potreban je posebno
  odobren landscape demo tok; ne crop-ovati postojeću sliku i ne menjati
  vlasništvo korisnikovog upload-a radi lepšeg kontaktnog lista.

Provere konačnog recepta:

- `phone-studio-preview.mjs --candidate-only`: stvarni 1080×1350 Download PNG,
  fresh desktop/mobile, nema pageerror grešaka. Laptop/dark-glass kontrola
  ostaje byte-identična osnovi.
- `phone-polish-grid.mjs`: normalni editor 1600×1000/DPR1, selektorom izabran
  aspekt 16:9, zatim stvarnim Device/Lighting select akcijama svih 20 parova.
  Svaki snimak prati settings snapshot; svih 20 potvrđeno, bez pageerror-a.
  Ovo su lokalni vizuelni dokazi, ne CI PG kandidati niti baseline bless.
- Vizuelni pregled: sve klase i četiri scene su prisutne, uređaji staju u
  kadar, nema nestalog ekrana; telefon ima čistu tamnu gornju granicu,
  soft-studio kontakt je širi, dark-glass zadržava kontrast. Clean-white
  ostaje namerno svetliji i manje kontrastan od ostalih. F11 je vidljiv.
- Izolovana kopija izvora sa tačnim finalnim recipe.json: typecheck i svih
  177 unit testova u 27 fajlova prolaze. Nema promena testova ili pragova.
  Nisu pokretani novi cloud CI/PG/PNG, puni lokalni guard suite ili release
  perf gate. Nema push-a, merge-a ili objave sajta.

Konačni recipe.json i manifest, prethodni PNG/recept, ceo grid i uporedni
detalji ivice/senke prate arhivu dokaza. Slike su stvarni izlazi aplikacije;
kontaktni list ih samo raspoređuje i proporcionalno smanjuje.

## Prenos na sve uređaje — F12–F15

Vlasnik je prihvatio konkretan završni prikaz i prenos u aplikaciju, zatim
tražio istu doradu ostalih uređaja. Izbor proširujemo na celu familiju.

- F12 — §4.2/§4.4.1: `src/devices/build.ts:slabGeometry` gradi i tablet,
  laptop bazu, browser i card. Smoothing u toj funkciji pokriva sve čvrste
  površine uz iste pozicije/UV i postojeći Three.js utility sa mm skalom.
  Tamni backplate dele sve klase kroz Materials lifecycle. Screen shader,
  jednoslojni fizički screen i inset se ne menjaju. Proveriti rebuild/dispose.
- F13 — §4.2, `src/devices/presets.ts`: tablet depth 8 mm, metalness 0,95 /
  roughness 0,24; laptop depth 7 mm, 0,9/0,28. Širina/visina, bezel i hinge
  ovih klasa ostaju. Browser depth 4 mm i card 3 mm ostaju; materijali
  0,35/0,32 i 0,15/0,40 daju suptilan rub bez debelog telefonskog okvira.
- F14 — §4.4.3, `src/scene/studio.ts:captureShadow`: soft-studio kontakt
  bira parametre po uređaju: phone .84/6, tablet .82/5, laptop .72/4.5,
  browser .72/4.5, card .65/4.5 (opacity/blur). Izbor pri dirty capture-u
  prati i promenu uređaja i scene; ostali scene shadow recepti se čuvaju.
  Nema dodatnog render target-a, shader-a, prolaza ili shadow light-a.
- F15 — P-11(2–3): prihvaćeni phone kadar daje konkretan izbor za odvojenu
  plansku dopunu: phone referentni fill .82, ostali .6; isti FOV, smer,
  near/far, NDC≤.9, orbit i outputPad ugovor. Upis mora biti zaseban commit
  pre izvora; ne predstavlja baseline bless ili objavu bez provera.

Posle prekida okruženja, poslednja proba i recept obnovljeni su iz sačuvane
arhive verzije 2. Istorijske transform skripte pripadaju izvornom stanju pre
implementacije; novi capture mora čitati stvarni kod bez tih zamena.
