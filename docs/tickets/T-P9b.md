# T-P9b — uspravna demo tabela

Autor/implementator: Codex. Osnova: main bdebd02; istraživanje T-P9b-research.md i njegova dopuna nakon vlasnikovog „Moze, koristi tu“.
Dokument odluke: PLINTH_SPEC §2, §3, §4.1, §4.2, §4.8, §7, P-5/P-9/P-10/P-14; konkretno vlasnikovo odobrenje nove slike ima prednost nad ranijim poreklom demo asset-a.

## Obuhvat

1. Zameniti public/demo.png odobrenim PNG-om 845×1862 bez dodatnog resize/crop-a. F1–F3 rešavaju se izborom uspravnog sadržaja, ne promenom kamere.
2. Osvežiti sva četiri public/compositions thumbnail-a postojećim PG receptom i istim podešavanjima kompozicija (F6/F7).
3. Ažurirati samo dva literalna očekivanja dimenzija u postojećem first-ready guard-u. Sve druge provere ostaju. Pokazati FAIL na staroj slici i PASS na novoj.
4. Pregledati početni prikaz na telefonu i desktopu, svih pet uređaja i četiri kompozicije. Eksplicitno navesti bočne margine na širokim ekranima. Proveriti stvarni PNG download postojeće acceptance putanje.

## Dozvoljeni fajlovi

- docs/tickets/T-P9b-research.md, docs/tickets/T-P9b.md
- public/demo.png
- public/compositions/studio-phone.png, dark-laptop.png, clean-browser.png, warm-card.png
- guards/pg-mode.test.ts: samo očekivane dimenzije demo slike, bez slabljenja provera

## Prihvatanje

Linux npm run ci i build pre objave; tačan commit/tree u PR-u. PG i PNG cloud dokazi, pregled kandidata i nezavisan pregled. Očekivani PG DIFF zbog odobrene slike ostaje vidljiv i blokira konačno prihvatanje dok vlasnik ne potvrdi reference u posebnom bless commitu. Bez automatskog merge-a.

Ne menjati specifikaciju, baseline fajlove, pragove, aplikacioni kod, geometriju, osvetljenje, kompozicije, state format, upload ponašanje, dependencies ili workflows. UI ostaje engleski; nova dokumentacija i PR opis su srpski. F4/F5/F9 i T-P8a/T-P10 nisu završeni ovim asset korakom.
