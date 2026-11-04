# Palanche — Piano di progetto

Versione del 3 novembre 2026 · Simone Menestrina

## Visione e obiettivi

Palanche (in genovese "i soldi") è un'app Android personale per segnare spese ed entrate in pochi secondi, capire dove vanno i soldi e rispettare un budget mensile. Tutti i dati restano sul telefono e si possono esportare in qualsiasi momento.

L'app nasce standalone. Il collegamento con Lanterna arriverà dopo, passando dal formato di export, non da codice condiviso.

**Criteri di successo**

- Registrare una spesa richiede al massimo 3 tocchi e meno di 5 secondi.
- L'app viene usata ogni giorno per 30 giorni consecutivi senza abbandonarla.
- Un backup esportato si ripristina su un'installazione pulita senza perdere nulla.
- A fine mese l'app risponde a tre domande: quanto ho speso, in cosa, e dove ho sforato rispetto al budget.

## Requisiti e vincoli

L'MVP copre registrazione, budget ed export. Automazioni e analisi avanzate arrivano nelle fasi successive.

### Requisiti funzionali

| ID | Requisito | Fase |
| --- | --- | --- |
| RF1 | Gestione conti: contanti, conto corrente, carta, risparmio | 1 |
| RF2 | Movimenti: spesa, entrata, trasferimento tra conti | 1 |
| RF3 | Categorie a due livelli (es. Casa → Bollette) con icona e colore | 1 |
| RF4 | Storico movimenti con ricerca e filtri | 1 |
| RF5 | Export e import completo in JSON | 1 |
| RF6 | Budget mensile per categoria, con avviso all'80% e al 100% | 2 |
| RF7 | Dashboard del mese | 2 |
| RF8 | Export CSV dei movimenti | 2 |
| RF9 | Backup automatico periodico in una cartella esterna all'app | 2 |
| RF10 | Movimenti ricorrenti (affitto, abbonamenti, stipendio) | 3 |
| RF11 | Import CSV dall'estratto conto della banca, con deduplica | 3 |
| RF12 | Regole di categorizzazione automatica | 3 |
| RF13 | Analisi: trend, confronto mesi, tasso di risparmio | 4 |
| RF14 | Rilevamento abbonamenti e previsione di fine mese | 4 |
| RF15 | Backup cifrato con password e blocco app con impronta | 4 |
| RF16 | Obiettivi di risparmio collegati a un conto di risparmio, con avanzamento e quota mensile | 2 |

### Requisiti non funzionali

- **Solo locale**: nessun backend, nessun account. Nella build di release si rimuove il permesso `INTERNET` dal manifest, così la privacy è garantita dal sistema e non solo dalla buona volontà.
- **Affidabilità dei dati**: SQLite nativo, migrazioni versionate, cancellazioni logiche (soft delete) con possibilità di annullare.
- **Velocità**: avvio e apertura del form di inserimento sotto il secondo su un telefono medio.
- **Importi** sempre in centesimi interi. **Solo EUR**: il campo `currency` resta nel modello dei conti per il futuro, ma l'interfaccia non mostra la scelta della valuta.
- **Lingua** italiana, tema chiaro e scuro che segue il sistema.

### Fuori scope

Sincronizzazione cloud, più utenti, collegamento diretto alle banche (open banking), funzioni AI, iOS, investimenti e portafogli titoli.

## Stack tecnico e architettura

Ionic + Capacitor con SQLite nativo, organizzato a strati: le pagine non toccano mai il database direttamente.

| Ambito | Scelta |
| --- | --- |
| UI | Ionic + Angular con standalone components, Capacitor 8 |
| Database | `@capacitor-community/sqlite` |
| File | `@capacitor/filesystem`, `@capacitor/share`, un file picker Capacitor per l'import |
| Notifiche | `@capacitor/local-notifications` |
| Grafici | Chart.js |
| CSV | Export con un serializzatore interno (fase 2); PapaParse solo per leggere il CSV della banca (fase 3) |
| Cartella dei backup automatici | Plugin Capacitor locale in Java (`BackupFolder`, Storage Access Framework), nessuna dipendenza esterna |
| Impostazioni | Tabella `settings` in SQLite, non localStorage |
| Test | Unit test su servizi e repository, test di round-trip export/import |

**Strati**

1. **Pagine e componenti**: solo presentazione e interazione.
2. **Servizi di dominio**: logica (calcolo saldi, avanzamento budget, export/import, regole). Sono la parte da testare.
3. **Repository**: una classe per tabella, l'unico punto che scrive SQL.
4. **Database**: connessione SQLite, migrazioni, transazioni.

**Convenzioni da mettere nel `CLAUDE.md`**: UUID come ID, `created_at` / `updated_at` / `deleted_at` su ogni tabella, importi in centesimi, date dei movimenti come stringa `YYYY-MM-DD` (niente timestamp, per evitare errori di fuso orario), saldi sempre calcolati e mai salvati, ogni modifica allo schema come nuova migrazione numerata.

## Navigazione

```
Onboarding (solo al primo avvio)
        ↓
Schede in basso: Home · Movimenti · Budget · Analisi
   ├── pulsante + (da Home e Movimenti) → Nuovo movimento (finestra modale)
   └── icona in alto (da ogni scheda)  → Impostazioni
           Conti · Categorie · Backup e dati · Preferenze
           Ricorrenze, Regole, Import CSV banca (fase 3)
```

Le schermate di riferimento sono in `docs/mockup/`.

Quattro schede nella barra in basso coprono l'uso quotidiano. Il pulsante + apre l'inserimento da qualsiasi schermata, mentre le Impostazioni raccolgono tutto ciò che si configura una volta e poi si tocca raramente.

## Specifica delle pagine

Ogni pagina ha uno scopo solo. Il pulsante "+" per un nuovo movimento è raggiungibile da ovunque.

### Onboarding (solo al primo avvio)

- Creazione del primo conto con saldo iniziale (la valuta è sempre EUR, nessuna scelta).
- Categorie predefinite (vedi sotto): ognuna, sottocategorie comprese, si può rinominare o spegnere; quelle spente non vengono create.
- Scelta della cartella per i backup automatici (fase 2, insieme al backup automatico).

#### Categorie predefinite

Le sottocategorie ereditano icona e colore della categoria principale. Icone Ionicons, sempre `-outline`; i colori sono chiavi della palette, con una variante per il tema chiaro e una per lo scuro.

| Spese | Sottocategorie | Icona | Colore |
| --- | --- | --- | --- |
| Spesa | | `cart-outline` | teal |
| Casa | Affitto o mutuo, Condominio, Manutenzione, Arredamento | `home-outline` | violet |
| Bollette | Luce, Gas, Acqua, Internet e telefono | `flash-outline` | ochre |
| Ristoranti e bar | Ristoranti, Bar e caffè, Delivery | `restaurant-outline` | orange |
| Trasporti | Mezzi pubblici, Carburante, Auto, Parcheggi e pedaggi | `train-outline` | blue |
| Viaggi | Trasporto, Alloggio, Attività | `airplane-outline` | cyan |
| Salute | Farmacia, Visite mediche, Sport e palestra | `heart-outline` | red |
| Svago | Uscite, Cinema ed eventi, Videogiochi, Hobby | `film-outline` | pink |
| Abbonamenti | Streaming, Software e app, Altri abbonamenti | `repeat-outline` | fuchsia |
| Shopping | Abbigliamento, Elettronica, Regali | `bag-handle-outline` | green |
| Animali | Cibo, Veterinario | `paw-outline` | brown |
| Istruzione | Corsi, Libri | `school-outline` | indigo |
| Tasse e commissioni | Tasse, Commissioni bancarie | `receipt-outline` | slate |
| Altro | | `ellipsis-horizontal-outline` | gray |

| Entrate | Icona | Colore |
| --- | --- | --- |
| Stipendio | `briefcase-outline` | teal |
| Lavoro extra | `construct-outline` | blue |
| Rimborsi | `arrow-undo-outline` | cyan |
| Regali ricevuti | `gift-outline` | pink |
| Altre entrate | `add-circle-outline` | gray |

I trasferimenti non hanno categoria: in lista usano l'icona `swap-horizontal-outline` in grigio.

### Home

- **Selettore del mese** in alto, con frecce per il mese precedente e successivo.
- **Saldo totale** dei conti, con dettaglio per conto a scomparsa.
- **Speso questo mese** confrontato con il mese scorso alla stessa data ("+12% rispetto al 1–15 ottobre").
- **Budget a rischio**: le categorie sopra l'80%, al massimo tre.
- **Ultimi movimenti**: gli ultimi cinque, con link allo storico.
- **Promemoria backup** se l'ultimo backup è più vecchio della frequenza impostata.

### Nuovo / modifica movimento (finestra modale)

Il flusso standard è importo → categoria → salva.

- **Tipo**: spesa, entrata o trasferimento (spesa preselezionata).
- **Importo**: tastierino numerico grande, con focus automatico all'apertura.
- **Categoria**: griglia di icone, con le più usate in alto.
- **Conto**: preselezionato l'ultimo usato. Per i trasferimenti compare anche il conto di destinazione.
- **Data**: oggi di default, con scorciatoia per "ieri".
- **Nota** e **tag** opzionali, chiusi in una sezione "Altro".
- Pulsanti **Salva** e **Salva e aggiungi un altro**.

### Movimenti

- Lista raggruppata per giorno, con il totale del giorno.
- Ricerca testuale su nota e beneficiario.
- Filtri: periodo, conto, categoria, tipo, tag.
- Swipe a sinistra per eliminare (con "Annulla" nel toast), tocco per modificare.
- Totale dei movimenti filtrati in fondo alla lista.

### Budget

- Una riga per categoria con budget: barra di avanzamento, speso, residuo.
- Colore neutro sotto l'80%, arancione dall'80%, rosso oltre il 100%.
- Budget totale del mese opzionale, sopra la lista.
- Azione **Copia dal mese precedente** per non reimpostare tutto ogni mese.
- Le categorie senza budget ma con spese appaiono in fondo, raggruppate.

### Obiettivi di risparmio (fase 2)

- Un obiettivo ha nome, importo obiettivo, data facoltativa ed è collegato a un conto di tipo risparmio.
- **Avanzamento** = saldo attuale del conto collegato (sempre calcolato, come ogni saldo), mostrato come barra e percentuale.
- **Quota mensile necessaria** = (importo obiettivo − saldo) / mesi che mancano alla data; senza data non si mostra.
- Obiettivo raggiunto quando il saldo arriva all'importo obiettivo.

### Analisi

- Periodo selezionabile: mese, trimestre, anno, personalizzato.
- Ripartizione delle spese per categoria, con tocco per vedere le sottocategorie.
- Trend degli ultimi 6 o 12 mesi, totale e per categoria.
- Entrate contro uscite e tasso di risparmio.
- Da ogni grafico si arriva ai movimenti che lo compongono.
- Fase 4: abbonamenti rilevati e previsione di fine mese.

### Impostazioni

- **Conti**: crea, modifica, riordina, archivia (un conto con movimenti non si cancella).
- **Categorie**: crea, modifica, sposta sotto un'altra, unisci due categorie.
- **Ricorrenze** (fase 3): elenco delle regole con prossima data.
- **Regole di categorizzazione** (fase 3): "se la descrizione contiene X, usa la categoria Y".
- **Import CSV banca** (fase 3): scelta del file, mappatura delle colonne, anteprima, conferma.
- **Backup e dati**: vedi la sezione dedicata.
- **Preferenze**: giorno di inizio del mese contabile, notifiche dei budget. Il tema segue il sistema e la valuta è sempre EUR, quindi non sono scelte.

## Modello dati

Dieci tabelle. Tutte hanno `id` (UUID), `created_at`, `updated_at` e `deleted_at`, tranne `settings` e `schema_migrations`.

| Tabella | Campi principali | Note |
| --- | --- | --- |
| `accounts` | `name`, `type`, `currency`, `initial_balance_cents`, `archived`, `sort_order` | Il saldo è saldo iniziale + movimenti, sempre calcolato |
| `categories` | `name`, `parent_id`, `kind` (spesa/entrata), `icon`, `color`, `sort_order` | Massimo due livelli |
| `transactions` | `type`, `amount_cents`, `account_id`, `to_account_id`, `category_id`, `date`, `payee`, `note`, `recurring_id`, `import_hash` | Importo sempre positivo, il segno lo dà `type`; `to_account_id` solo per i trasferimenti |
| `tags` | `name` |  |
| `transaction_tags` | `transaction_id`, `tag_id` | Tabella ponte |
| `budgets` | `category_id`, `month` (`YYYY-MM`), `amount_cents` | Una riga per categoria e mese |
| `savings_goals` | `name`, `target_cents`, `target_date` (facoltativa), `account_id` | Fase 2; l'avanzamento è il saldo del conto, mai salvato |
| `recurring_rules` | modello del movimento, `frequency`, `next_date`, `end_date` | Fase 3 |
| `categorization_rules` | `field`, `pattern`, `category_id`, `priority` | Fase 3 |
| `settings` | `key`, `value` | Preferenze, ultimo backup, versione |

`import_hash` è un'impronta di data + importo + descrizione originale: serve a non importare due volte lo stesso movimento dal CSV della banca.

## Backup, export e import

Il JSON completo è il formato ufficiale dei dati: serve per i backup, per il ripristino e, in futuro, per passare i dati a Lanterna.

### Formato JSON

```json
{
  "app": "palanche",
  "schemaVersion": 1,
  "exportedAt": "2026-11-01T14:30:00+01:00",
  "accounts": [],
  "categories": [],
  "transactions": [],
  "tags": [],
  "transactionTags": [],
  "budgets": [],
  "savingsGoals": [],
  "recurringRules": [],
  "categorizationRules": [],
  "settings": {}
}
```

L'export include anche le righe cancellate logicamente, così un'unione futura sa cosa è stato eliminato.

### Pagina Backup e dati

- **Esporta ora** (JSON): crea il file e apre la condivisione di Android (Drive, mail, Telegram, cartella).
- **Esporta CSV**: movimenti di un periodo, con colonne data, tipo, importo, conto, categoria, sottocategoria, beneficiario, nota, tag.
- **Importa / ripristina**: due modalità. *Sostituisci tutto* crea prima un backup di sicurezza automatico. *Unisci* abbina le righe per UUID e tiene la versione con `updated_at` più recente.
- **Backup automatico**: attivo o no, frequenza (giornaliera, settimanale), cartella, numero di copie da tenere (le più vecchie si eliminano).
- **Data dell'ultimo backup** sempre visibile.
- **Cifratura con password** (fase 4): AES-GCM con chiave derivata dalla password, file `.json.enc`.

### Come funziona il backup automatico

Capacitor non garantisce l'esecuzione in background ad app chiusa. Il backup parte quindi all'apertura o al ritorno in primo piano dell'app, se l'ultimo è più vecchio della frequenza scelta. Se usi l'app ogni giorno, il risultato è equivalente.

La scrittura in una cartella pubblica (es. Documenti) va verificata su un dispositivo reale, perché le regole di accesso ai file cambiano tra versioni di Android.

### Regole di sicurezza sull'import

- Si controlla `schemaVersion`: un backup più vecchio viene aggiornato con le stesse migrazioni del database, uno più nuovo dell'app viene rifiutato.
- L'import avviene in un'unica transazione SQL: o entra tutto o non cambia niente.
- Prima di confermare si mostra un riepilogo: quanti conti, movimenti e categorie verranno importati.

## Roadmap

Sei fasi. Dopo la fase 1 l'app è già usabile ogni giorno; ogni fase si chiude solo quando tutti i suoi criteri sono spuntati.

### Fase 0 — Setup

Progetto Ionic + Capacitor, piattaforma Android, SQLite con sistema di migrazioni, struttura a strati, `CLAUDE.md` con le convenzioni.

- [x] L'APK di debug si installa sull'emulatore e apre una pagina vuota
- [x] La migrazione 001 crea tutte le tabelle della fase 1
- [x] Un test d'esempio su un repository passa

Chiusa il 3 novembre 2026 con la verifica sull'emulatore (browser ed emulatore: migrazione applicata una sola volta, dati persistenti). La prova sul telefono fisico è rimandata alla fine della fase 1.

### Fase 1 — MVP: registrare e salvare

Onboarding, conti, categorie predefinite, nuovo movimento, lista movimenti, export e import JSON.

- [x] Una spesa si registra in 3 tocchi dalla home
- [x] I saldi dei conti tornano con i movimenti inseriti
- [x] Export, disinstallazione, reinstallazione, import: tutti i dati identici
- [x] Una cancellazione si può annullare dal toast

Chiusa il 4 novembre 2026. Tutti i criteri sono verificati sull'emulatore (Medium Phone API 37, tema chiaro e scuro, navigazione a gesti e a tre pulsanti). La prova sul telefono fisico non è ancora stata fatta: si farà nei prossimi giorni e chiuderà anche quella rimandata dalla fase 0. Il piano dettagliato, con i task T1–T17, è in `docs/fase-1.md`.

### Fase 2 — Controllo

Budget, home completa, notifiche all'80% e al 100%, export CSV, backup automatico, obiettivi di risparmio, pagina Preferenze. Il piano dettagliato è in `docs/fase-2.md`.

- [ ] Un budget sforato mostra la barra rossa e invia una notifica una sola volta
- [ ] "Copia dal mese precedente" riporta tutti i budget
- [ ] Il CSV si apre correttamente in Excel e Google Sheets, con accenti e decimali giusti
- [ ] Il backup automatico scrive nella cartella scelta e tiene solo le ultime N copie
- [ ] Un obiettivo di risparmio mostra l'avanzamento pari al saldo del conto collegato e la quota mensile necessaria

### Fase 3 — Automazione

Movimenti ricorrenti, import CSV della banca con mappatura colonne, regole di categorizzazione.

- [ ] Un movimento ricorrente viene creato alla data giusta anche se l'app non è stata aperta quel giorno
- [ ] Importare due volte lo stesso CSV non crea doppioni
- [ ] Correggendo una categoria a mano, l'app propone di creare una regola

### Fase 4 — Analisi e sicurezza

Grafici di trend, tasso di risparmio, abbonamenti rilevati, previsione di fine mese, backup cifrato, blocco con impronta.

- [ ] Da ogni grafico si arriva ai movimenti che lo compongono
- [ ] Un backup cifrato si ripristina solo con la password giusta
- [ ] Gli abbonamenti noti (es. streaming, telefono) vengono rilevati dopo due mesi di dati

### Fase 5 — Ponte verso Lanterna (futuro)

Lanterna importa il JSON di export tramite un endpoint o un comando Artisan. Il formato definito in fase 1 diventa il contratto tra le due app.

## Decisioni aperte per il cliente

Queste vanno chiuse prima della fase 0 o della fase indicata.

- [x] **Framework UI**: Angular.
- [ ] **Scadenza**: "relativamente in fretta" significa entro quando? Serve per decidere se la fase 2 rientra nel primo rilascio.
- [x] **Nome dell'app**: Palanche (package `dev.ouija.palanche`).
- [ ] **Icona** dell'app.
- [x] **Giorno di inizio del mese contabile**: si sceglie in Preferenze, dal 1 al 28 (predefinito il 1°). Il periodo prende il nome del mese che contiene la maggior parte dei suoi giorni: con inizio tra l'1 e il 15 quello in cui inizia, dal 16 in poi quello in cui finisce (inizio 27: "Novembre" = 27 ottobre – 26 novembre). Tutti i calcoli di periodo passano da un'unica funzione in `utils/dates.ts`; cambiare il giorno non modifica nessun dato salvato, solo come i movimenti vengono raggruppati.
- [x] **Trasferimenti tra conti**: inclusi nell'MVP (fase 1).
- [x] **Backup automatico di Android**: disattivato (`android:allowBackup="false"`, e regole di estrazione dei dati che escludono sia il backup sul cloud sia il trasferimento tra dispositivi). I dati esistono solo nell'app e nei file esportati dall'utente.
- [x] **Categorie predefinite**: vedi "Categorie predefinite" nella specifica dell'onboarding.
- [ ] **Banca** da cui importerai il CSV in fase 3, per costruire il primo mappatore sul formato reale.
- [x] **Più valute**: solo EUR. Il campo `currency` resta nel modello, l'interfaccia non mostra la scelta.
