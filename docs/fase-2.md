# Piano — Fase 2: Controllo (Palanche)

## Contesto
La Fase 1 è chiusa sull'emulatore (la prova sul telefono fisico è ancora da fare): conti, categorie, movimenti, lista, export/import JSON (schema v1, round-trip testato). La Fase 2 aggiunge il controllo: budget per categoria e totale, home completa, notifiche all'80% e al 100%, export CSV, backup automatico in una cartella scelta, obiettivi di risparmio, pagina Preferenze. Il primo task salva questo piano in `docs/fase-2.md`.

**Criteri di accettazione (da `docs/piano.md`)**, verificati a fine fase:
- [ ] Un budget sforato mostra la barra rossa e invia una notifica una sola volta
- [ ] "Copia dal mese precedente" riporta tutti i budget
- [ ] Il CSV si apre correttamente in Excel e Google Sheets, con accenti e decimali giusti
- [ ] Il backup automatico scrive nella cartella scelta e tiene solo le ultime N copie
- [ ] Un obiettivo di risparmio mostra l'avanzamento pari al saldo del conto collegato e la quota mensile necessaria

Più: lint, test e `ionic build` verdi a ogni task; verifica finale su emulatore e telefono fisico.

## Decisioni recepite
1. **Mese contabile**: preferenza `month_start_day` (1–28, predefinito 1) nella tabella `settings`. Il periodo prende il nome del mese che contiene la maggior parte dei suoi giorni: inizio 1–15 → nome del mese in cui inizia (inizio 10: "Novembre" = 10 nov – 9 dic); inizio 16–28 → nome del mese in cui finisce (inizio 27: "Novembre" = 27 ott – 26 nov). Il selettore del mese mostra sotto il nome le date del periodo quando l'inizio non è il 1°. Cambiare il giorno non tocca nessun dato: `budgets.month` resta il nome del periodo, cambia solo quali date ci cadono dentro.
2. **Un'unica funzione di periodo** in `core/utils/dates.ts`: `accountingPeriod(month, startDay) → { first, last }` più `accountingMonthOf(date, startDay) → YearMonth` (definita come inversa della prima). Tutto passa da lì: budget, "speso questo mese", confronto, selettore, preset "Questo mese"/"Mese scorso" di Movimenti (`features/transactions/period.ts`), export CSV.
3. **Backup di Android disattivato**: `android:allowBackup="false"` + `android:dataExtractionRules="@xml/data_extraction_rules"` che esclude tutti i domini sia in `<cloud-backup>` sia in `<device-transfer>`. Chiuso in `docs/piano.md` insieme alla decisione sul mese contabile.
4. **Cartella del backup automatico: plugin locale nel progetto** (nessuna dipendenza npm o Gradle). Java in `android/app/src/main/java/dev/ouija/palanche/backupfolder/`, solo API del framework (`ACTION_OPEN_DOCUMENT_TREE`, `takePersistableUriPermission`, `DocumentsContract`). *Pattern*: un plugin Capacitor è una classe Java con metodi `@PluginMethod` registrata in `MainActivity`; dal TypeScript si chiama con `registerPlugin('BackupFolder')` come un plugin npm.
5. **Obiettivi di risparmio** in una card in fondo alla scheda Budget, con creazione/modifica in un foglio modale.

## Scelte tecniche (confermate)
- **Budget solo sulle categorie di spesa principali**: la spesa di una principale include le sue sottocategorie (come nel mockup 04). **Budget totale** = riga di `budgets` con `category_id NULL`. Importo budget > 0; togliere un budget = soft delete con toast "Annulla".
- **Totale del mese** (confermato al punto di controllo 1): se il budget totale non è impostato, il totale è la somma dei budget delle categorie confrontata con la spesa in quelle categorie, con etichetta **"Somma dei budget"**; se è impostato, si confronta con tutte le spese del mese, con etichetta **"Budget del mese"**.
- **Soglie e percentuali**: barra primaria sotto l'80%, ambra dall'80% al 100% compreso, rossa solo oltre il 100%; percentuali arrotondate per difetto.
- **"Copia da <mese precedente>"**: copia in una transazione i budget del periodo precedente (totale compreso) solo dove il mese corrente non ne ha già uno; restituisce quanti ne ha copiati.
- **Categorie con spese ma senza budget**: in fondo alla pagina Budget, raggruppate, con tocco per impostarne uno.
- **Tacca "dove dovresti essere oggi"** = giorni trascorsi / giorni del periodo (contabile, non di calendario); solo per il periodo corrente.
- **"Speso questo mese" vs mese scorso alla stessa data**: stesso numero di giorni dall'inizio del periodo precedente (troncato alla sua lunghezza). Per un mese passato si confrontano i periodi interi. Le spese contano solo `expense`; i trasferimenti mai.
- **Selettore del mese condiviso** (`SelectedMonthService`, signal): Home e Budget mostrano lo stesso mese, così "Vedi tutti" porta al Budget di quel mese. Il saldo in Home resta sempre quello attuale.
- **Quota mensile obiettivo** = (obiettivo − saldo) / periodi contabili rimanenti, dal corrente a quello che contiene `target_date` compresi (minimo 1). Senza data o già raggiunto: non si mostra. Collegabile solo a conti `savings` non archiviati (controllo nel servizio).
- **Notifiche una sola volta**: all'80% il testo avvisa che il budget è quasi esaurito; al 100% dice che il budget è stato **raggiunto**; "sforato" si usa solo oltre il 100%, come per il colore della barra. Per ogni riga di budget e soglia (80, 100) si registra l'invio nella chiave `budget_alerts_sent` di `settings` (JSON di `"<budgetId>:<soglia>"`). Controllo dopo ogni salvataggio/modifica di movimento o budget, solo per il periodo corrente. Preferenza `budget_alerts_enabled` (predefinito sì); il permesso Android 13+ si chiede alla prima attivazione.
- **CSV senza PapaParse** (serve davvero solo per leggere CSV, in fase 3): serializzatore puro e testato in `core/services/csv/`. Separatore `;`, BOM UTF-8, righe CRLF, virgolette dove servono, data `gg/mm/aaaa`, importo con segno e virgola decimale senza simbolo (`-12,50`, così Excel e Sheets in italiano lo leggono come numero). Colonne del piano (data, tipo, importo, conto, categoria, sottocategoria, beneficiario, nota, tag) **più "conto di destinazione"** per i trasferimenti. Periodo scelto con i preset (passano dalla funzione di periodo). Formattazione degli importi CSV in `utils/money.ts`.
- **Backup automatico**: parte all'avvio e al ritorno in primo piano (`App` `resume`, già installato) se l'ultimo automatico è più vecchio della frequenza. File `palanche-auto-<data-ora>.json` nella cartella scelta; tiene le ultime N (predefinito 7) e cancella solo i file con quel prefisso. Errori (es. permesso revocato, cartella eliminata) salvati in `auto_backup_last_error` e mostrati in Backup e dati. Impostazioni: `auto_backup_enabled`, `auto_backup_frequency` (`daily`|`weekly`), `auto_backup_folder_uri`, `auto_backup_folder_name`, `auto_backup_copies`, `last_auto_backup_at`.
- **Promemoria backup in Home**: se il più recente tra `last_export_at` e `last_auto_backup_at` è più vecchio della frequenza impostata (settimanale se non impostata).
- **Onboarding**: passo finale facoltativo "Dove salvo i backup?" con "Più tardi" (il piano lo prevede in fase 2).
- **Preferenze**: giorno di inizio del mese, notifiche dei budget. Niente scelta del tema (segue il sistema, da CLAUDE.md) né della valuta (solo EUR).
- **Dipendenza da installare** (prevista in CLAUDE.md): solo `@capacitor/local-notifications` (versione 8.x compatibile, verificata con `npm view` e confermata prima di installarla).

## Modello dati — migrazione 002
`core/db/migrations/002-budgets-and-savings-goals.ts`:
- `budgets`: `id`, `category_id` (FK categories, NULL = totale), `month` (`GLOB 'YYYY-MM'`), `amount_cents INTEGER > 0`, `created_at`, `updated_at`, `deleted_at`; indice unico `(month, IFNULL(category_id, ''))` sulle righe attive; indice su `category_id`.
- `savings_goals`: `id`, `name`, `target_cents INTEGER > 0`, `target_date` (NULL o `YYYY-MM-DD`), `account_id` (FK accounts, NOT NULL), `sort_order`, timestamp.
- `schemaVersion` diventa 2 (`CURRENT_SCHEMA_VERSION = MIGRATIONS.length`).

## Task (un commit ciascuno)

**T1 — `docs: add phase 2 plan and close open decisions`**
- `docs/fase-2.md` (questo piano).
- `docs/piano.md`: chiude "Giorno di inizio del mese contabile" e "Backup automatico di Android" con le decisioni sopra; toglie "valuta di default" dalle Preferenze (solo EUR); nello stack, PapaParse solo in Fase 3; nella nota di chiusura della Fase 1 scrive che la prova sul telefono fisico **non è ancora stata fatta** e verrà fatta nei prossimi giorni (e quindi resta aperta anche quella rimandata dalla Fase 0).
- `CLAUDE.md`: stack aggiornato (PapaParse in Fase 3, plugin locale `BackupFolder`), breve sezione sul pattern del plugin locale Java, regola "Rispondi sempre in italiano"; nello "Stato delle fasi" la stessa correzione sulla prova sul telefono, per coerenza con `piano.md`.

**T2 — `chore: disable Android backup and device transfer`**
`AndroidManifest.xml` (`allowBackup="false"`, `dataExtractionRules`), `res/xml/data_extraction_rules.xml`. Verifica: `adb shell bmgr backupnow dev.ouija.palanche` non deve fare il backup.

**T3 — `feat: add accounting period with configurable month start`**
`dates.ts`: `accountingPeriod`, `accountingMonthOf`, `periodLength`/`dayOfPeriod`. Test: inizio 1 (= mese di calendario), 15 e 16 (cambio di regola), 28; fine anno (dicembre→gennaio in entrambi i versi); febbraio bisestile e non; `accountingMonthOf(accountingPeriod(m).first/last) === m` per tutti i giorni 1–28 su due anni; cambio del giorno impostato (stessa data → mese diverso, nessun dato toccato). `PreferencesService` (`core/services`): legge/valida `month_start_day`, la espone come signal. `period.ts` di Movimenti passa dalla nuova funzione.

**T4 — `feat: add budgets and savings goals schema and repositories`**
Migrazione 002, modelli `Budget`, `SavingsGoal`, `BudgetsRepository` (findByMonth, upsert per categoria/mese, softDelete/restore, findAllIncludingDeleted, upsertAll, deleteAll), `SavingsGoalsRepository` (CRUD stile `AccountsRepository`), `TransactionsRepository.expenseByTopCategory(from, to)` (somma con rollup delle sottocategorie). Nuove chiavi in `SettingKey`. Test su sql.js: migrazione 1→2 su DB con dati, unicità del budget attivo, esclusione dei cancellati, rollup.

**T5 — `feat: add budget, savings goal and month summary services`**
`BudgetService` (avanzamento per periodo, stato ok/warning/over con soglie 80/100 in un'unica funzione pura, tacca del ritmo, copia dal precedente, categorie senza budget, set/remove con validazione), `SavingsGoalService` (avanzamento dal `BalanceService`, quota mensile, raggiunto), `MonthSummaryService` (speso del periodo e confronto alla stessa data). Test su tutti i casi limite (0%, 79/80/100/101%, budget totale senza categorie, sottocategorie, movimenti cancellati, trasferimenti e entrate esclusi, inizio mese ≠ 1).

**T6 — `feat: export and import budgets and savings goals (schema v2)`**
`backup-format.ts` (tipi reali per `budgets` e `savingsGoals`), `ExportService`, `backup-parser.ts` (validazione campi e FK verso categorie/conti), `BACKUP_UPGRADES[1]` (v1 → v2: array garantiti), `ImportService.replace`/`merge` con le nuove tabelle (ordine FK). **Merge dei budget**: se dopo l'unione restano due budget attivi con UUID diversi per la stessa categoria (o il totale) e lo stesso mese, si tiene quello con `updated_at` più recente e l'altro viene cancellato logicamente (nella stessa transazione, prima di scrivere, così l'indice unico non scatta). Test: round-trip esteso con budget (totale compreso, cancellati) e obiettivi; import di un backup v1 reale; merge, compreso il conflitto di budget (vince il più recente, sia quando è locale sia quando arriva dal file); rifiuti. `docs/export-format.md` → versione 2 con le nuove tabelle e le nuove chiavi di `settings`.

> **⏸ Punto di controllo 1 (dopo T6)**: riepilogo dei test del livello dati e conferma che il round-trip passa. Riprendo solo dopo l'ok.

**T7 — `feat: add month selector and budget progress bar components`**
`shared/month-selector` (frecce, nome del mese, date del periodo se inizio ≠ 1) collegato a `SelectedMonthService`; `shared/budget-progress` (colori primario/ambra/rosso, tacca opzionale). Etichette italiane dei mesi in `shared/`.

**T8 — `feat: add budget page`**
Mockup 04: titolo con "Novembre 2026 · 15 giorni rimasti", "Copia da <mese>", card totale con tacca e residuo, card categorie ("Sforato di € X · 112%", "€ 16 residui · 92%"), categorie con spese senza budget in fondo, foglio per impostare/modificare/togliere un budget (tastierino condiviso), toast "Annulla". Stato vuoto con "Imposta il primo budget" e "Copia da <mese>".

> **⏸ Punto di controllo 2 (dopo T8)**: installo sull'emulatore e ti lascio provare la pagina Budget (anche con inizio mese ≠ 1 impostato via codice di test o, se già pronta, dal DB). Riprendo solo dopo l'ok.

**T9 — `feat: add savings goals to the budget tab`**
Card "Obiettivi di risparmio" in fondo al Budget: barra e percentuale, "€ X al mese fino a <mese>", "Raggiunto"; foglio crea/modifica/elimina (con "Annulla"); messaggio se non esiste un conto di risparmio.

**T10 — `feat: add preferences page`**
Impostazioni → Preferenze: giorno di inizio del mese (1–28) con anteprima del periodo corrente ("Novembre: 27 ott – 26 nov").

**T11 — `chore: add local notifications plugin`** (dopo la tua conferma) + `npx cap sync android`, permesso `POST_NOTIFICATIONS`.

**T12 — `feat: notify budgets at 80% and 100%`**
`BudgetAlertService` con un `Notifier` iniettabile (in test un finto): soglie superate, una sola volta per budget e soglia, solo periodo corrente, rispetta la preferenza. A ogni controllo `budget_alerts_sent` viene ripulita dalle voci dei budget che non appartengono al periodo corrente (o cancellati), così la lista non cresce. Test anche sulla pulizia. Agganciato a `DataChangesService`. Interruttore "Avvisi sui budget" in Preferenze con richiesta del permesso.

**T13 — `feat: add CSV export of transactions`**
`core/services/csv/` (serializzatore + `CsvExportService`), test su accenti, virgolette, `;` e a capo nei campi, importi, BOM. In Backup e dati: "Esporta CSV" con scelta del periodo, condivisione via `BackupFilesService` (MIME `text/csv`).

**T14 — `feat: add native backup folder plugin`**
Plugin Java `BackupFolder`: `pickFolder()` → `{ uri, name }`, `checkAccess(uri)`, `writeFile(uri, name, text)`, `listFiles(uri)`, `deleteFile(uri, name)`. Wrapper TS in `core/services/backup/backup-folder.ts` (nel browser: non disponibile, la UI lo dice). Verificato sull'emulatore con `adb shell ls` sulla cartella scelta.

**T15 — `feat: add automatic backup`**
`AutoBackupService` (scadenza, scrittura, rotazione delle ultime N, errori) testato con un finto `BackupFolder`; avvio/resume in `AppComponent`. Backup e dati: interruttore, frequenza, cartella, copie, ultimo backup, ultimo errore. Passo facoltativo nell'onboarding.

**T16 — `feat: complete the home page`**
Mockup 01: selettore del mese, card saldo (invariata), "Speso questo mese" con badge (+ ambra / − primario) e "rispetto al 1–15 ottobre", "Budget a rischio" (≥ 80%, max tre, "Vedi tutti" → Budget), ultimi movimenti, promemoria backup.

**T17 — `docs: close phase 2`** — dopo la verifica dei criteri su emulatore e telefono.

## Codice da riusare
`core/db/sql-executor.ts` (`transaction`), `repositories/accounts.repository.ts` e `sql.ts` (modello), `services/balance.service.ts` (saldi per gli obiettivi), `services/data-changes.service.ts` (ricarica e trigger notifiche), `services/backup/*` (formato, parser, upgrade, export/import, `BackupFilesService.share`), `utils/money.ts`, `utils/dates.ts`, `shared/amount-keypad`, `shared/toast.service.ts`, `shared/choice.service.ts`, `shared/page-header`, `testing/sqljs-executor.ts` (`createMigratedTestExecutor`).

## Verifica
- A ogni task: `npm run lint`, `npm test`, `ionic build`.
- Emulatore (sequenza Git Bash di CLAUDE.md):
  1. budget sforato → barra rossa + una notifica; un altro movimento nella stessa categoria → nessuna seconda notifica;
  2. "Copia da ottobre" → tutti i budget (totale compreso) presenti in novembre;
  3. inizio mese 27 → selettore "Novembre · 27 ott – 26 nov", budget e speso ricalcolati, nessun dato cambiato (export prima/dopo identico a parte `month_start_day`);
  4. CSV aperto in Excel (Windows) e Google Sheets: accenti, importi numerici, date;
  5. backup automatico: scelgo una cartella, forzo più esecuzioni (frequenza o data dell'ultimo backup modificata), `adb shell ls` mostra solo le ultime N; revoca/eliminazione della cartella → errore visibile;
  6. obiettivo collegato a un conto risparmio: avanzamento = saldo, quota mensile corretta;
  7. `bmgr backupnow` non esegue il backup.
- Tema chiaro e scuro, confronto con i mockup 01 e 04.
- Telefono fisico: cartella reale (es. Documenti o una cartella sincronizzata), notifiche, uso reale.
