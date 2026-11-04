# Piano — Fase 1: MVP, registrare e salvare (Palanche)

## Contesto
La Fase 0 è chiusa: SQLite nativo e web, migrazione 001 (accounts, categories, transactions, tags, transaction_tags, settings), `SqlExecutor` + `BaseSqlExecutor`, `AccountsRepository`, utility `money` / `dates` / `uuid`, token di design e Manrope. La Fase 1 rende l'app usabile ogni giorno: onboarding, conti, categorie predefinite, nuovo movimento (spese, entrate **e trasferimenti**), lista movimenti, export/import JSON.

**Criteri di accettazione (da `docs/piano.md`)**, verificati alla fine:
- [ ] Una spesa si registra in 3 tocchi dalla home (FAB → categoria → Salva, dopo aver digitato l'importo)
- [ ] I saldi dei conti tornano con i movimenti inseriti
- [ ] Export, disinstallazione, reinstallazione, import: tutti i dati identici
- [ ] Una cancellazione si può annullare dal toast

Più, come da CLAUDE.md: lint, test e `ionic build` verdi a ogni task; la prova sul telefono fisico (rimandata dalla Fase 0) chiude la fase.

## Decisioni recepite
- Trasferimenti inclusi; solo EUR (`currency` resta nel modello, nessuna scelta in UI); tipi di conto `cash | checking | card | savings` (già nella migrazione 001).
- Categorie predefinite: l'elenco che mi hai dato, 14 principali di spesa con sottocategorie + 5 di entrata. **"Disattivabili durante l'onboarding"** = le categorie spente non vengono create (nessuna colonna `active`, nessuna migrazione). Dopo l'onboarding si gestiscono da Impostazioni → Categorie.
- **Le sottocategorie ereditano icona e colore**: la migrazione impone `icon`/`color` NOT NULL, quindi nel DB salvo una copia di quelli del padre; se cambio icona/colore del padre, il servizio aggiorna i figli nella stessa transazione. Le sottocategorie in UI non hanno un selettore di icona/colore.

## Scelte tecniche (confermate)
1. **Colore delle categorie salvato come chiave di palette** (`teal`, `violet`…), non come esadecimale: così lo stesso dato ha la variante giusta in tema chiaro e scuro (`--pal-cat-<chiave>`). Rinomino i token `--pal-cat-*` di Fase 0 da "semantici" (`groceries`…) a tinte, e ne aggiungo alcuni (verificando il contrasto ≥ 4.5:1 in entrambi i temi).
2. **Import del file senza plugin**: `<input type="file" accept=".json">` nel WebView. Il file chooser di Android è già gestito da Capacitor, quindi niente plugin file picker (lo verifico sull'emulatore).
3. **Dipendenze da installare** (sono già "previste" in CLAUDE.md): `@capacitor/filesystem@8.1.5`, `@capacitor/share@8.0.3`. Nient'altro.
4. **Formato JSON con campi camelCase** (come i modelli TS e come i nomi degli array del contratto, es. `transactionTags`), documentato in `docs/export-format.md`. Gli array delle tabelle future (`budgets`, `recurringRules`, `categorizationRules`) sono presenti e vuoti, così la forma del contratto non cambia; `schemaVersion: 1` = versione dello schema DB.
5. **"Sostituisci tutto" svuota le tabelle con `DELETE`**: è l'unica eccezione al soft delete, perché il ripristino deve rendere il DB identico al backup (righe cancellate comprese). Prima scrive sempre un backup di sicurezza (`Directory.Data/backups/safety-<timestamp>.json`).
6. **Fuori dalla Fase 1** (non anticipo): Home "completa" (speso del mese, budget a rischio, promemoria backup), selettore del mese, barra budget, Preferenze, backup automatico. Le schede Budget e Analisi esistono ma mostrano uno stato vuoto "Arriva nella prossima versione".

## Icone e colori delle categorie
| Categoria | Icona | Colore | | Categoria | Icona | Colore |
| --- | --- | --- | --- | --- | --- | --- |
| Spesa | `cart-outline` | teal | | Abbonamenti | `repeat-outline` | fuchsia |
| Casa | `home-outline` | violet | | Shopping | `bag-handle-outline` | green |
| Bollette | `flash-outline` | ochre | | Animali | `paw-outline` | brown |
| Ristoranti e bar | `restaurant-outline` | orange | | Istruzione | `school-outline` | indigo |
| Trasporti | `train-outline` | blue | | Tasse e commissioni | `receipt-outline` | slate |
| Viaggi | `airplane-outline` | cyan | | Altro | `ellipsis-horizontal-outline` | gray |
| Salute | `heart-outline` | red | | | | |
| Svago | `film-outline` | pink | | | | |

Entrate: Stipendio `briefcase-outline` teal · Lavoro extra `construct-outline` blue · Rimborsi `arrow-undo-outline` cyan · Regali ricevuti `gift-outline` pink · Altre entrate `add-circle-outline` gray.
Trasferimenti (non categoria): `swap-horizontal-outline` grigio, come nel mockup.

## Task (un commit ciascuno)

**T1 — `docs: record phase 1 decisions and add savings goals requirement`**
`docs/piano.md`: chiudo le decisioni aperte (trasferimenti nell'MVP, solo EUR, categorie predefinite con l'elenco); aggiungo **RF16 "Obiettivi di risparmio" (fase 2)**: nome, importo obiettivo, data facoltativa, collegato a un conto di tipo risparmio, avanzamento = saldo del conto, quota mensile necessaria = (obiettivo − saldo) / mesi rimanenti; voce nella descrizione e nei criteri della Fase 2, tabella `savings_goals` nel modello dati come "fase 2". Nessun codice.

**T2 — `chore: add filesystem and share plugins`** (dopo la tua conferma) + `npx cap sync android`.

**T3 — `refactor: use palette keys for category colors`**
`src/theme/variables.scss`: `--pal-cat-<chiave>` e `-soft` per le 15 tinte, chiaro e scuro, contrasto verificato. `core/models/category-palette.ts`: elenco delle chiavi (tipo `CategoryColor`) e delle icone ammesse.

**T4 — `feat: add categories, transactions, tags and settings repositories`**
Stesso schema di `AccountsRepository` ([accounts.repository.ts](src/app/core/repositories/accounts.repository.ts)), con modelli in `core/models/`:
- `CategoriesRepository`: findAll(kind?), findById, create, update, softDelete/restore, `reparent`, `countUsage` (movimenti per categoria negli ultimi 90 giorni, per "le più usate").
- `TransactionsRepository`: create/update/softDelete/restore; `search(filter)` con filtri periodo / conti / categorie (incluse le sottocategorie) / tipo / tag / testo su nota e beneficiario, restituisce righe arricchite (nomi di conto e categoria, icona, colore, tag) ordinate per data desc; `summarize(filter)` (conteggio + saldo netto via `SUM`); `sumsByAccount()` per i saldi; `countByAccount` / `countByCategory`; `reassignCategory(from, to)` per l'unione.
- `TagsRepository`: findOrCreate per nome (case-insensitive), tag di un movimento, `setTransactionTags` (soft delete dei legami tolti).
- `SettingsRepository`: get/set/getAll (`onboarding_completed_at`, `last_account_id`).
- Ogni metodo di scrittura accetta un `SqlExecutor` opzionale, così i servizi possono comporre più repository dentro la stessa `db.transaction(tx => …)`. *Pattern*: è il modo per non chiamare `db.transaction` dall'interno di una transazione (che bloccherebbe, vedi Fase 0).
- Test su sql.js per ogni repository (filtri, esclusione dei cancellati, restore).

**T5 — `feat: add balance, transaction and category domain services`** (`core/services/`, con test)
- `BalanceService`: saldo per conto = iniziale + entrate − spese − trasferimenti in uscita + trasferimenti in entrata; saldo totale dei conti non archiviati. Test: tutti i tipi, movimenti cancellati esclusi, conto archiviato, saldo negativo.
- `TransactionService`: validazione (importo intero > 0, trasferimento ⇔ conto destinazione ≠ origine e nessuna categoria, categoria del tipo giusto: spesa → categoria `expense`, entrata → `income`), salvataggio di movimento + tag in una transazione, aggiornamento di `last_account_id`, elimina/annulla.
- `CategoryService`: albero padre → figli, ereditarietà icona/colore, max 2 livelli, sposta sotto un'altra (stesso `kind`, la destinazione è di primo livello, la categoria spostata non ha figli), unisci A in B (movimenti riassegnati, figli spostati, A eliminata: tutto in una transazione), elimina solo se non usata (altrimenti proponi l'unione), "più usate" per la griglia (7 + "Altre").
- `AccountService`: elimina solo se senza movimenti, altrimenti archivia; riordino.

**T6 — `feat: add default categories seed and onboarding service`**
`core/services/default-categories.ts` (dati dell'elenco + tabella sopra) e `OnboardingService.complete({ account, categories })`: crea il primo conto, le categorie scelte (con eventuali nomi modificati) e `onboarding_completed_at`, **in un'unica transazione**. Test: seed completo, categorie spente non create, sottocategoria spenta, rinomina, atomicità.

**T7 — `feat: add JSON export and import with round-trip tests`** (`core/services/backup/`)
- `ExportService.build()`: `{ app: 'palanche', schemaVersion, exportedAt, accounts, categories, transactions, tags, transactionTags, budgets: [], recurringRules: [], categorizationRules: [], settings: {} }`, **righe cancellate incluse**. `write()` salva in `Directory.Cache` e apre la condivisione Android; nel browser scarica il file.
- `ImportService`: `parse` (valida `app`, struttura, tipi; rifiuta `schemaVersion` più nuovo dell'app; catena di `upgrade` per versione, oggi vuota) → `summarize` (quanti conti, categorie, movimenti per il riepilogo) → `replace` (backup di sicurezza, poi DELETE + INSERT in **una transazione** con `PRAGMA defer_foreign_keys`) oppure `merge` (per UUID, vince la riga con `updated_at` più recente, nuove righe inserite, in una transazione).
- **Test**:
  - **round-trip**: DB con dati vari (trasferimenti, sottocategorie, tag, righe cancellate, accenti ed emoji nelle note, importi grandi, impostazioni) → export → DB vuoto migrato → import `replace` → nuovo export identico al primo (a parte `exportedAt`), e confronto anche delle righe SQL tabella per tabella;
  - round-trip passando da `JSON.stringify` / `JSON.parse` (il file reale);
  - `merge`: vince la versione più recente, le righe nuove si aggiungono, le cancellazioni si propagano;
  - rifiuti: `app` diversa, `schemaVersion` futuro, campi mancanti o di tipo sbagliato, FK verso righe inesistenti;
  - atomicità: un import che fallisce a metà lascia il DB invariato.
- `docs/export-format.md`: il contratto (campi, tipi, regole di compatibilità).

> **⏸ Punto di controllo 1 (dopo T7)**: mi fermo e riepilogo i test del livello dati, confermando che il round-trip passa. Riprendo solo dopo l'ok.

**T8 — `feat: add shared UI components`** (`shared/`)
Icona categoria, griglia categorie (4×2 con "Altre"), tastierino importo (logica pura `applyKeypadKey` testata: virgola, max 2 decimali, backspace, limite di cifre, niente zeri iniziali), riga movimento, card saldo (con dettaglio per conto), chip filtro, barra di riepilogo, servizio toast con "Annulla". Seguono i mockup.

**T9 — `feat: add app shell with tabs and settings entry`**
Barra delle schede (Home, Movimenti, Budget, Analisi; icone `-outline`), icona Impostazioni in alto, guard di routing → `/onboarding` se `onboarding_completed_at` manca. Sposto la home in `features/home`, tolgo il template "Blank" e aggiorno `e2e/app.spec.ts` (solo il testo atteso: gli e2e non girano finché non installiamo i browser).

**T10 — `feat: add onboarding flow`** — 2 passi: primo conto (nome, tipo, saldo iniziale con tastierino) → categorie predefinite (accendi/spegni categorie e sottocategorie, rinomina) → fine.

**T11 — `feat: add new transaction modal`** — bottom sheet a tutta altezza come nel mockup 02: segmento Spesa/Entrata/Trasferimento → importo 44px → griglia "più usate" → conto (ultimo usato) / Oggi · Ieri · calendario → "Altro: nota, beneficiario, tag" richiudibile → tastierino → "Salva e aggiungi" / "Salva". Per i trasferimenti la griglia è sostituita da "Da conto → A conto". Riusata per la modifica.

> **⏸ Punto di controllo 2 (dopo T11)**: mi fermo, installo l'app sull'emulatore e ti lascio provare l'inserimento in 3 tocchi prima di costruire le altre schermate. Riprendo solo dopo l'ok.

**T12 — `feat: add home page`** — card saldo totale (mockup 01, solo saldo e conti), ultimi 5 movimenti con "Storico", FAB. Le sezioni "Speso questo mese" e "Budget a rischio" arrivano in Fase 2.

**T13 — `feat: add transactions list`** — mockup 03: ricerca, chip di filtro su una riga scorrevole (Periodo, Conti, Categoria, Tipo, Tag), raggruppamento per giorno ("Oggi · dom 15 nov") con il totale netto del giorno (trasferimenti esclusi), swipe → Elimina con toast "Annulla", tocco → modifica, barra "N movimenti filtrati · Saldo" sopra le schede, FAB. Caricamento a pagine (scroll infinito).

**T14 — `feat: add accounts and categories settings`** — Conti: crea, modifica, riordina, archivia (elimina solo se senza movimenti). Categorie: crea, modifica (icona/colore solo per le principali), sposta sotto un'altra, unisci, elimina con "Annulla".

**T15 — `feat: add backup and data settings page`** — "Esporta ora", "Importa / ripristina" con riepilogo e scelta Sostituisci tutto / Unisci, data dell'ultimo export (`settings`).

**T16 — `chore: remove INTERNET permission from release builds`** — manifest `src/release/AndroidManifest.xml` con `tools:node="remove"`; il debug lo tiene (serve al live reload). Verifico con `aapt dump permissions` sull'APK di release.

**T17 — `docs: close phase 1`** — dopo la verifica dei criteri sull'emulatore e sul telefono.

## File e codice da riusare
`core/db/sql-executor.ts` (`transaction`), `core/db/database.service.ts`, `core/repositories/accounts.repository.ts` (modello da seguire), `core/utils/money.ts` (`formatCents`, `formatTransactionAmount`, `parseAmountToCents`), `core/utils/dates.ts` (`today`, `addDays`, `monthBounds`…), `core/utils/uuid.ts`, `src/testing/sqljs-executor.ts` (`createMigratedTestExecutor`), token in `src/theme/variables.scss`.

## Verifica
- A ogni task: `npm run lint`, `npm test`, `ionic build`.
- Sull'emulatore (sequenza Git Bash di CLAUDE.md) a fine fase:
  1. installazione pulita → onboarding → conto + categorie;
  2. **3 tocchi**: FAB → digito l'importo → categoria → Salva, e conto i tocchi;
  3. **saldi**: un set noto di spese, entrate e trasferimenti, controllo i saldi a mano;
  4. **cancellazione**: swipe → Elimina → "Annulla" → il movimento torna con i suoi tag;
  5. **backup**: export → `adb uninstall` → reinstallo → import "Sostituisci" → controllo i dati (il round-trip automatico in T7 lo garantisce a livello di dati).
- Tema chiaro e scuro su ogni schermata, screenshot confrontati con i mockup.
- Telefono fisico: prestazioni (avvio e apertura del form sotto il secondo), condivisione e import del file reale.
