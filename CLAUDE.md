# CLAUDE.md — Palanche

**Palanche** (in genovese "i soldi") è un'app Android personale per registrare spese ed entrate, gestire budget mensili e analizzare le spese.
**Tutto in locale**: nessun backend, nessun account, nessuna chiamata di rete.
Il progetto è pubblico su GitHub e fa parte del portfolio del proprietario: il codice deve essere pulito, leggibile e ben strutturato.

Documenti di riferimento (leggili prima di iniziare una fase):
- `docs/piano.md`: requisiti, pagine, modello dati, export/import, roadmap e criteri di accettazione.
- `docs/mockup/*.png`: le schermate di riferimento (Home, Nuovo movimento, Movimenti, Budget, Analisi). Il layout e lo stile vanno seguiti fedelmente.

## Identità del progetto

- Nome app: **Palanche**
- Package ID Android: `dev.ouija.palanche` (non cambiarlo mai: dopo la pubblicazione è definitivo)
- Repo: `palanche` su GitHub (Ouija1733)

## Stack

- Ionic + Angular (standalone components, signals dove ha senso) + **Capacitor 8**, solo piattaforma Android
- Plugin già presenti dal template: `@capacitor/app`, `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/status-bar`
- Database: `@capacitor-community/sqlite` (con supporto web tramite `jeep-sqlite` per sviluppare nel browser)
  - `sql.js` è bloccato alla versione incorporata in `jeep-sqlite` (oggi 1.11.0): il `sql-wasm.wasm` copiato negli asset deve corrispondere, altrimenti nel browser si ha un `LinkError`. Aggiornarli sempre insieme.
  - Negli unit test il database è un SQLite vero in memoria (`src/testing/sqljs-executor.ts`) con le migrazioni reali.
- File e condivisione: `@capacitor/filesystem`, `@capacitor/share`
- Notifiche: `@capacitor/local-notifications`
- Grafici: Chart.js
- CSV: PapaParse
- Font: Manrope, **incluso nel bundle** tramite `@fontsource/manrope` (niente Google Fonts: l'app non deve fare richieste di rete)
- Icone: Ionicons, sempre in variante `-outline`
- Lingua dell'interfaccia: italiano. Codice, nomi di variabili, commit e commenti: inglese.

Le dipendenze sopra non ancora installate sono **previste**, ma vanno comunque proposte e confermate prima di installarle.

## Ambiente di sviluppo

- Windows 11, terminale PowerShell; Claude Code esegue i comandi tramite Git Bash.
- Progetto in `C:\dev\palanche`.
- Node.js 26 LTS gestito con **nvm-windows** (npm 11).
- **JDK 21** (`JAVA_HOME` punta al JDK 21 Microsoft). Non usare il JDK 25 di Android Studio: Gradle 8.14 non lo supporta ("Unsupported class file major version 69").
- Android SDK in `%LOCALAPPDATA%\Android\Sdk`, piattaforme API 37 e 36 installate.
- **Target principale: emulatore** "Medium Phone API 37.0" (x86_64). Il telefono fisico si usa per la verifica finale prima di chiudere una fase (prestazioni, cartelle di backup, notifiche, uso reale).
- npm blocca gli script di installazione non approvati. Se una build fallisce per un pacchetto con script non eseguito, proponi `npm install-scripts approve <pkg>`.
- **Non lanciare mai `npm audit fix --force`**: rompe le versioni di Angular/Ionic. Gli aggiornamenti si fanno in modo esplicito e controllato.

## Comandi

```bash
npm install                       # dipendenze
ionic serve                       # sviluppo UI nel browser (SQLite via jeep-sqlite)
npm test                          # unit test (solo unit, Vitest)
npm run e2e                       # test e2e Playwright (richiede i browser: npx playwright install)
npm run lint                      # lint
ionic build && npx cap sync android
npx cap run android               # build e installazione su emulatore o telefono
ionic cap run android -l --external   # live reload (stessa rete Wi-Fi)
adb devices                       # dispositivi collegati (emulator-5554 = emulatore)
adb logcat | grep -i capacitor    # log dell'app (Git Bash)
cd android && ./gradlew --stop    # ferma il daemon Gradle dopo un cambio di JDK
```

## Architettura

Gli strati sono rigidi: le pagine non chiamano mai il database o i repository direttamente.

```
src/app/
  core/
    db/            # DatabaseService (connessione, transazioni), migrations/ numerate
    models/        # interfacce TypeScript delle entità
    repositories/  # un repository per tabella: l'UNICO posto con SQL
    services/      # logica di dominio: saldi, budget, export/import, regole, ricorrenze
    utils/         # money.ts, dates.ts, uuid.ts
  features/
    onboarding/
    home/
    transactions/  # lista movimenti + modale nuovo/modifica
    budget/
    analysis/
    settings/      # conti, categorie, backup e dati, preferenze, (fase 3: ricorrenze, regole, import CSV)
  shared/          # componenti riusabili (vedi "Componenti condivisi")
  theme/           # variabili e token di design
```

## Regole sui dati (non negoziabili)

- **ID**: UUID v4 generati in app, mai autoincrement.
- **Ogni tabella** (tranne `settings` e `schema_migrations`) ha `created_at`, `updated_at`, `deleted_at` (ISO 8601).
- **Cancellazioni logiche**: si valorizza `deleted_at`, non si fa `DELETE`. Tutte le query escludono le righe cancellate.
- **Importi** in centesimi interi (`amount_cents INTEGER`). Mai `number` decimali per i soldi. Conversioni e formattazione solo in `utils/money.ts`.
- **Importo dei movimenti sempre positivo**: il segno lo determina `type` (`expense`, `income`, `transfer`).
- **Date dei movimenti** come stringa `YYYY-MM-DD` in ora locale. Mai timestamp per le date contabili. Mesi dei budget come `YYYY-MM`.
- **Saldi sempre calcolati** (saldo iniziale + movimenti), mai salvati.
- **Migrazioni**: ogni modifica allo schema è un nuovo file numerato in `core/db/migrations/`. Non modificare mai una migrazione già committata.
- **Scritture multiple** (import, ripristino, unione categorie) dentro un'unica transazione SQL.
- **Niente localStorage / IndexedDB / Preferences** per i dati: tutto in SQLite, impostazioni comprese (tabella `settings`).

## Export / import

Il JSON di export è il contratto ufficiale dei dati (servirà anche per l'integrazione futura con un'altra app):
campi `app` (`"palanche"`), `schemaVersion`, `exportedAt` e un array per tabella, righe cancellate incluse.
Qualsiasi modifica allo schema deve aggiornare `schemaVersion` e la logica di import dei backup più vecchi.
Il test di round-trip (export → database vuoto → import → dati identici) deve passare sempre.

## Design

Il riferimento visivo sono le schermate in `docs/mockup/`. Riassunto delle regole:

### Colori (tema chiaro)

| Token | Valore | Uso |
| --- | --- | --- |
| `--pal-bg` | `#F4F5F2` | sfondo pagine |
| `--pal-surface` | `#FFFFFF` | card |
| `--pal-text` | `#16181D` | testo principale |
| `--pal-text-muted` | `#5B615E` | testo secondario, etichette |
| `--pal-border` | `#E4E6E3` | bordi, separatori |
| `--pal-track` | `#EEF0EC` | sfondo delle barre di avanzamento |
| `--pal-primary` | `#0F766E` | colore principale: pulsanti, tab attiva, FAB, card saldo, entrate |
| `--pal-primary-soft` | `#E2F2EF` | sfondi tenui del primario (chip e categoria selezionati) |
| `--pal-warning` | `#D97706` | barre budget tra 80% e 100% (testo: `#B45309`) |
| `--pal-danger` | `#B91C1C` | budget sforato, elimina |

Ogni categoria ha un colore proprio, usato per l'icona su uno sfondo tenue dello stesso colore (es. Spesa verde, Ristoranti ambra, Trasporti blu `#1D4ED8`, Casa viola `#6D28D9`, Svago rosa `#BE185D`, Salute rosso, Bollette ocra `#A16207`).

Il **tema scuro** segue il sistema: stessi ruoli, sfondo quasi nero, card grigio scuro, primario più chiaro (es. `#2DD4BF`) per mantenere il contrasto. Testo sempre con contrasto almeno 4.5:1.

### Tipografia

Manrope. Pesi: 400 (testo), 600 (etichette, nomi), 700 (titoli di sezione, importi nelle liste), 800 (titoli di pagina e importi principali).
Dimensioni indicative: titolo pagina 24px, importo principale 34px (saldo) / 44px (inserimento), titolo sezione 15px, testo 14px, secondario 12–13px.

### Forma e spaziatura

- Card bianche su sfondo grigio chiaro, angoli 16–20px, nessun bordo, nessuna ombra (l'unica ombra è quella del FAB).
- Margini laterali della pagina 16px, spazio tra card 10–12px.
- Elementi toccabili alti almeno 44px.
- Niente gradienti, niente emoji.

### Formato dei numeri

Sempre in italiano, con `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })` dentro `utils/money.ts`: `€ 1.234,56`.
Spese con prefisso `−`, entrate con `+` e colore primario, trasferimenti neutri in grigio.

### Regole dei budget

- Sotto l'80%: barra primaria.
- Dall'80% al 100%: barra e percentuale ambra.
- Oltre il 100%: barra rossa piena, testo "Sforato di € X".
- Nella pagina Budget, la barra del totale mostra una tacca verticale nel punto "dove dovresti essere oggi" (giorni trascorsi / giorni del mese).

### Struttura delle pagine

- **Barra delle schede** in basso, sempre visibile: Home, Movimenti, Budget, Analisi. Le Impostazioni si aprono da un'icona in alto.
- **FAB "+"** in basso a destra (60px, angoli 20px), presente in Home e Movimenti: apre la modale Nuovo movimento. Non deve mai coprire contenuti importanti.
- **Nuovo movimento**: bottom sheet a tutta altezza. Ordine: tipo (segmento Spesa/Entrata/Trasferimento) → importo grande → griglia categorie 4×2 con le più usate → conto e data (Oggi/Ieri/calendario) → "Altro" richiudibile → tastierino numerico → "Salva e aggiungi" / "Salva".
- **Movimenti**: ricerca, chip di filtro su una sola riga, lista raggruppata per giorno con il totale del giorno, swipe a sinistra per eliminare, toast con "Annulla", barra con il totale filtrato sopra le schede.

### Componenti condivisi (in `shared/`)

Selettore del mese, card saldo, barra di avanzamento budget, riga movimento, icona categoria, griglia categorie, tastierino importo, chip filtro, barra di riepilogo. Riutilizzali invece di duplicare markup.

## Test

- Unit test obbligatori per `core/services` e `core/utils` (soprattutto money, date, saldi, budget, export/import).
- Per ogni bug sui dati: prima un test che lo riproduce, poi la correzione.
- Prima di dichiarare un task concluso: `npm run lint` e `npm test` verdi, e `ionic build` senza errori.

## Modo di lavorare

- Si lavora **una fase alla volta** (vedi roadmap in `docs/piano.md`). Non anticipare funzionalità di fasi successive.
- Prima di un task non banale, proponi un piano breve e aspetta conferma.
- Commit piccoli e descrittivi (Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`). Non fare `git push`.
- **Non aggiungere dipendenze o plugin Capacitor senza chiedere.**
- Il proprietario del progetto vuole capire il codice: quando introduci un pattern nuovo, spiegalo in due righe.
- Nessuna chiamata di rete nel codice dell'app. Nella build di release il permesso `INTERNET` va rimosso dal manifest.
- Mai dati personali reali nel repo: niente backup, export o CSV della banca (sono nel `.gitignore`).

## UX

- Inserire una spesa deve richiedere al massimo 3 tocchi: importo → categoria → salva.
- Tema chiaro/scuro che segue il sistema.
- Ogni cancellazione mostra un toast con "Annulla".

## Stato delle fasi

- [ ] Fase 0 — Setup (fatto: app id `dev.ouija.palanche`, SQLite nativo + web, migrazione 001, struttura cartelle, utility money/dates/uuid, repository accounts, token di design e Manrope, tutto verificato su browser ed emulatore; manca la verifica sul telefono fisico)
- [ ] Fase 1 — MVP: registrare e salvare
- [ ] Fase 2 — Controllo
- [ ] Fase 3 — Automazione
- [ ] Fase 4 — Analisi e sicurezza
