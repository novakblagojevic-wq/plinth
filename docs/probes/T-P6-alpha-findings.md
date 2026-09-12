# T-P6 — rezultat izolovane alpha/color probe

Osnova aplikacije: `e98c99e680f2692d4c6e4b2003f1d83d120bc005`.
Autor: Codex. Ovo nije implementacija T-P6, PNG exporter, baseline bless ili
odobrenje promene P-6/P-7. Src, spec, fixtures i postojeći testovi nisu menjani.

## Reprodukcija

Posle instalacije tačno pinovanih zavisnosti i Chromium-a:

```sh
node docs/probes/run-tp6-alpha.mjs
```

Ako pinovani browser nije na podrazumevanom mestu, postaviti
`PLINTH_CHROMIUM_PATH`. Harness u istom procesu podiže lokalni Vite dev server
i Playwright, zatvara ih po završetku i upisuje `tp6-alpha-results.json`.
`tp6-alpha.html` je samo istraživačka stranica, nije deo proizvodnog entrypoint-a.

Matrica: phone/laptop × AgX/ACES × SMAA/MSAA × transparent/black/white, 320×200,
DPR 1, soft-studio, hero, siva test boja ekrana. To daje 24 render merenja i
32 merenja naknadnog kompozitovanja. Koriste se pravi Stage, Studio i Pipeline
moduli sa main-a. Poseban drugi composer iste konfiguracije daje offscreen
rezultat, pa CopyShader sa NoBlending prenosi u RGBA8 readback target.

Kontekst probe eksplicitno bira alpha:true i preserveDrawingBuffer:true da
bi readback bio merljiv; proizvodni boot nije menjan. Pozadina je privremeno
postavljena u memoriji izolovane stranice. Ovo nije dokaz da postojeći boot
već podržava transparent mode, niti predlog da preserveDrawingBuffer postane
produkcioni default. Readback poređenje koristi isti WebGL redosled redova;
PNG enkodiranje i vertikalni flip nisu testirani.

## Rezultat

Chromium 153.0.8010.12, pinovani Playwright 1.63.0, Linux/SwiftShader.
Potpuni numerički rezultat je susedni JSON; 56 merenja, bez page/console grešaka
i bez WebGL greške. Uspešno izvršenje harness-a nije verdict o ispravnosti alpha.

| Provera | Opažanje | Značenje |
|---|---|---|
| Preview prema offscreen RGBA8 | Najveća razlika 1/255 po kanalu; MSAA slučajevi 0 | Put bez dodatnog OutputPass-a čuva boju u ovoj maloj matrici. Nije normativni export threshold. |
| Centar sivog ekrana | Phone 135,135,136; laptop 133,133,133; alpha 255, isto za AgX/ACES | Tonemapping exemption ostaje u ovoj probi, uz postojeći glare; očekivanje nije slepo RGB=128. |
| Prazni transparent ugao | 0,0,0,0 u svih osam transparent slučajeva | Clear/alpha prenos postoji. Sam ugao nije dokaz ispravnih ivica. |
| Delimična alpha | SMAA 357 phone / 2652 laptop piksela; MSAA 273 / 2452 | Postoje rub/senka pikseli sa 0<alpha<255. Nisu svi posebno klasifikovani kao senka. |
| RGB veći od alpha+1 | SMAA 123–306 piksela po transparent kadru; MSAA 0 | U SDR byte izlazu SMAA rezultat nije konzistentan sa uobičajenim premultiplied-alpha ograničenjem. |
| Transparent render preko crne/bele naspram direktnog opaque rendera | Najgori mean 0.4865 i max 90.92 kanala za straight tumačenje; mean 0.2385 i max 70 za premultiplied | Izbor samo jedne od dve interpretacije ne daje ekvivalentan render na svim rubovima. Nema alpha/compositing PASS. |

### F15 — SMAA transparent rubovi ostaju blokator za odluku o putanji

Pinovani `three@0.185.1/examples/jsm/shaders/SMAAShader.js:465–477` uzima
RGBA susede, radi pow(RGB,2.2), meša ceo vec4 i vraća pow(RGB,1/2.2), bez
posebnog razdvajanja alfa-premultiplikacije. Izmereni RGB>alpha slučajevi
podržavaju sumnju da taj korak nije odgovarajući za transparent SDR izlaz.
Ovo je dijagnoza iz izvora i merenja, ne vizuelna potvrda halo-a: PNG slike
nisu izvezene i ljudski pregled rubova nije urađen u ovoj probi.

Promena pozadine menja i ulaz u edge detection, pa razlika naknadne kompozicije
prema direktnom opaque renderu sama po sebi ne izdvaja samo jednu grešku.
Ne treba sve navedene razlike pripisati jednom shader izrazu bez dodatne probe.
Ne clamp-ovati RGB na alpha da bi test prošao: time se može promeniti boja.
Ne proglasiti premultiplied→straight konverziju dovoljnim rešenjem na osnovu
ovog malog skupa. MSAA se ne sme automatski učiniti podrazumevanim radi
zaobilaženja nalaza: P-6 zadržava SMAA default i MSAA opt-in.

## Potrebno pre T-P6 implementacionog ticketa

1. U izolovanoj probi proveriti alpha-aware SMAA obradu: pravilni prelazi
   između premultiplied/straight RGB i prostora interpolacije, uz alpha=0
   slučaj. Porediti opaque izlaz sa neizmenjenim P-6/P-7 izlazom; testirati
   seeded pogrešnu alpha i double-tone-map putanju. To još nije urađeno.
2. Izvesti stvarni PNG sa eksplicitnom alpha reprezentacijom, proveriti
   readback orijentaciju i vizuelno kompozitovati preko crne/bele/checkerboard
   pozadine. Proširiti na sve scene, dodatne uređaje, demo/user alpha input,
   izlazne veličine i najmanje ciljani mobilni browser. Trenutno ne tvrditi
   Safari/iPad ili mobilni GPU PASS na osnovu Linux Chromium-a.
3. Tek potom predložiti konačne dimenzije, failure policy i poređenje/prag
   kao zasebnu normativnu odluku (T-P6 research F6–F8). Output padding i hinge
   su zasebne otvorene odluke F2/F11. Ne menjati PLINTH_SPEC radi uklanjanja
   neugodnog nalaza iz probe.

P-10(4) gate ostaje otvoren. Ova proba zatvara pitanje da li alpha uopšte
može stići do output-a i sužava problem, ali ne zatvara ceo transparency/export
ugovor. Izmereni brojevi nisu dozvola za slabljenje postojećih guardova ili PG
baseline-a. Tehnički sledeći korak je korekcija eksperimentalne alpha putanje,
pre sastavljanja build ticketa; nije još vlasnički pregled proizvodnih slika.

## Dodatna kontrolisana alpha-aware proba

Izvršena je i komanda:

```sh
node docs/probes/run-tp6-alpha.mjs --alpha-aware
```

Rezultat je `tp6-alpha-aware-results.json`: još 56 merenja, bez console/page
ili WebGL grešaka. Eksperiment menja samo SMAA blend materijal dodatnog
**offscreen** composera u memoriji probne stranice: pre gamma obrade razdvaja
RGB od alpha, radi alpha-weighted interpolaciju i ponovo premultiplikuje
posle encoding-a. Glavni Studio preview i production moduli ostaju originalni.
To je verzijski vezana proba privatnog `_materialBlend`, ne gotov production API.

- RGB>alpha+1 je sada **0** u svim transparent kadrovima (ranije 123–306 za SMAA).
- Centar ekrana i ugaona alpha su očuvani; svi opaque black/white slučajevi
  prema originalnom preview-u odstupaju najviše 1/255.
- Transparent SMAA offscreen se sada razlikuje od **neispravljenog** preview-a
  do 54–66/255 na rubovima. Ta kolona ne sme se čitati kao novi export PASS:
  dve putanje namerno koriste različit shader u ovom eksperimentu.
- Naknadna premultiplied kompozicija prema direktnom opaque renderu još ima
  najgori mean 0.32328125 i max 66; straight tumačenje mean 0.62248339 i
  max 111.7294. To ne zatvara pun alpha/compositing ugovor i nije dokaz da
  jedna formula sama rešava sve rubove. Nema PNG roundtrip-a ili vizuelnog bless-a.

Prva stavka iz prethodnog plana time je delimično istražena, ali ne završena:
pravilo za RGB/alpha je zadovoljeno i opaque put sačuvan u ovoj matrici;
nezavisan referentni oracle za rubove, seeded greške i stvarni PNG/preview
roundtrip još su potrebni. Posebno razlikovati promenu edge detection-a zbog
pozadine od neispravne alpha reprezentacije. Ostali gate-ovi ostaju navedeni.

## PNG transport — naknadno završena numerička proba

Komanda `node docs/probes/run-tp6-alpha.mjs --png` ponovo renderuje malu
matricu na istom main-u, sa eksperimentalnim alpha-aware offscreen putem.
Rezultat je `tp6-png-results.json`; pomoćni modul je `tp6-png.mjs`.
Prethodni navodi „PNG nije testiran” opisuju ranije dve probe; ova dopuna
zatvara **transport bytes → PNG → browser decode/composite**, ne ceo F15.

Metod:
- Osam transparentnih RGBA8 readback kadrova, phone/laptop × AgX/ACES ×
  SMAA/MSAA, 320×200/DPR1/soft-studio; poređenje koristi isti foreground.
- Eksplicitan bottom-up → top-down flip, premultiplied → straight konverzija,
  RGB=0 kada je alpha=0. Postojeći development `pngjs@7.0.0` enkodira stvarne
  PNG bajtove u memoriji i nezavisno dekodira radi byte-for-byte provere.
- Chromium učitava PNG preko createImageBitmap i kompozituje Canvas2D/sRGB
  preko crne, bele i obojene šahovnice. Numerički oracle polazi od originalnog
  premultiplied readback-a i eksplicitne source-over jednačine, nikad od
  konvertovanih ili dekodiranih PNG vrednosti.
- Dodatni asimetrični 3×2 uzorak ima ručno navedene očekivane straight RGBA
  vrednosti, uključujući nultu, delimičnu i punu alpha. Tri namerne greške
  proveravaju izostavljenu konverziju, izostavljen flip i alpha postavljenu na 255.
- Pre izvršenja izabran istraživački maksimum 2 byte vrednosti po RGB kanalu
  za konverziono zaokruživanje i Canvas2D kompoziciju. To nije novi PG ili
  normativni export prag. PNG bytes i dimenzije zahtevaju tačnu jednakost.

Rezultat, Linux/Chromium 153.0.8010.12/SwiftShader, Node 24.19.0:

| Provera | Rezultat |
|---|---|
| Osam PNG zapisa | Svi lossless prema straight ulazu, tačno 320×200 |
| Kompozicija preko crne/bele | Max 0 u svih osam kadrova |
| Kompozicija preko obojene šahovnice | Max 1/255 u svih osam kadrova |
| Ručno zadati 3×2 oracle | Konverzija tačno jednaka literalima; kompozicija max 1/255 |
| Bez unpremultiply | Otkriveno, max 64/255 |
| Bez flip-a | Otkriveno, max 224/255 |
| Izgubljena alpha | Otkriveno, max 255/255 |
| Page/console/WebGL greške | Nijedna; komanda exit 0 |

PNG hash i broj bajtova svakog kadra ostaju u JSON-u; ovo nisu kandidatski
baseline-i niti slike za vlasnički bless. Nije rađen ljudski vizuelni pregled.
Nisu pokretani puni CI, novi PG capture ili ručni GitHub Actions dispatch.
Promene su istraživački docs/harness, bez production/spec/fixture izmene.

**Granica zaključka:** PNG transport ne dodaje značajnu grešku već renderovanom
foreground-u u ovoj matrici. Ne dokazuje ispravnost nastanka tog foreground-a:
nezavisna referenca za alpha-aware SMAA interpolaciju, screen color/double-tone-map
negativna proba, sve scene/uređaji, velike izlazne dimenzije i mobilni GPU ostaju
neprovereni. CPU pngjs ovde je istraživački enkoder, nije izbor biblioteke za
product runtime; browser encoder/download i njegovi failure/restore putevi su T-P7.
Ne porediti low-alpha straight RGB direktno sa premultiplied preview bajtovima;
konverzija može uvećati kvantizaciju nevidljivih boja. Byte-lossless PNG ne vraća
preciznost već izgubljenu u RGBA8 readback-u.

Sledeći konkretan tehnički gate je kontrolisani SMAA blend oracle sa poznatim
RGBA susedima/težinama i neizmenjenim opaque rezultatom, pa predlog jedinstvene
preview/export putanje. Dimenzije, failure policy, output padding i hinge iz
F2/F6–F8/F11 još zahtevaju zaseban normativni predlog. P-10(4) nije zatvoren;
T-P6 panel nije implementiran ovom probom.
