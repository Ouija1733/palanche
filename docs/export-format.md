# Formato di export JSON

Il file JSON di export è il **contratto ufficiale dei dati** di Palanche: serve per i backup, per il ripristino e per passare i dati ad altre app (Lanterna). Questo documento descrive la versione dello schema **2**.

## Struttura

```json
{
  "app": "palanche",
  "schemaVersion": 2,
  "exportedAt": "2026-11-15T18:00:00.000Z",
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

- `app`: sempre `"palanche"`.
- `schemaVersion`: la versione dello schema del database (numero dell'ultima migrazione). Cambia a ogni modifica dello schema.
- `exportedAt`: istante dell'export, ISO 8601 in UTC.
- Un array per tabella, con i campi in **camelCase**. Le tabelle non ancora esistenti nella versione (`recurringRules`, `categorizationRules`, dalla fase 3) sono presenti e vuote.
- `settings`: oggetto chiave → valore (stringa o `null`).
- Il file è indentato con 2 spazi e codificato in UTF-8.

## Regole comuni

- **Righe cancellate incluse**: ogni riga ha `deletedAt` (`null` se attiva). Chi importa deve rispettarlo, così sa cosa è stato eliminato.
- **ID**: UUID v4 (stringhe), mai numeri progressivi.
- **Timestamp tecnici** (`createdAt`, `updatedAt`, `deletedAt`, `exportedAt`): ISO 8601 in UTC, es. `2026-11-15T18:00:00.000Z`.
- **Date contabili** (`date`, `targetDate`): `YYYY-MM-DD`, data locale, senza orario.
- **Mesi contabili** (`month`): `YYYY-MM`, il nome del mese contabile (vedi `budgets`).
- **Importi**: interi in centesimi (`120000` = € 1.200,00). Mai decimali.
- **Importo dei movimenti sempre positivo**: il segno lo dà `type`.

## Tabelle

### accounts

| Campo | Tipo | Note |
| --- | --- | --- |
| `id` | string | UUID |
| `name` | string | |
| `type` | `"cash"` \| `"checking"` \| `"card"` \| `"savings"` | contanti, conto corrente, carta, risparmio |
| `currency` | string | codice ISO 4217, oggi sempre `"EUR"` |
| `initialBalanceCents` | integer | può essere negativo; il saldo attuale non è salvato, si calcola |
| `archived` | boolean | |
| `sortOrder` | integer | ordine di visualizzazione |
| `createdAt`, `updatedAt` | string | timestamp |
| `deletedAt` | string \| null | timestamp |

### categories

| Campo | Tipo | Note |
| --- | --- | --- |
| `id` | string | UUID |
| `parentId` | string \| null | categoria principale; al massimo due livelli |
| `name` | string | |
| `kind` | `"expense"` \| `"income"` | |
| `icon` | string | nome Ionicons, variante `-outline` |
| `color` | string | chiave di palette: `teal`, `violet`, `ochre`, `orange`, `blue`, `cyan`, `red`, `pink`, `fuchsia`, `green`, `brown`, `indigo`, `slate`, `gray` |
| `sortOrder` | integer | |
| `createdAt`, `updatedAt`, `deletedAt` | | come sopra |

Le sottocategorie hanno la stessa icona e lo stesso colore della categoria principale.

### transactions

| Campo | Tipo | Note |
| --- | --- | --- |
| `id` | string | UUID |
| `type` | `"expense"` \| `"income"` \| `"transfer"` | |
| `amountCents` | integer > 0 | |
| `accountId` | string | conto di origine |
| `toAccountId` | string \| null | conto di destinazione: valorizzato **solo** per `transfer`, diverso da `accountId` |
| `categoryId` | string \| null | `null` per i trasferimenti |
| `date` | string | `YYYY-MM-DD` |
| `payee` | string \| null | beneficiario |
| `note` | string \| null | |
| `createdAt`, `updatedAt`, `deletedAt` | | come sopra |

### tags e transactionTags

`tags`: `id`, `name`, timestamp. Tra i tag attivi il nome è unico (senza distinguere maiuscole e minuscole).
`transactionTags` (tabella ponte): `id`, `transactionId`, `tagId`, timestamp. Togliere un tag a un movimento = `deletedAt` valorizzato sul legame.

### budgets (dalla versione 2)

| Campo | Tipo | Note |
| --- | --- | --- |
| `id` | string | UUID |
| `categoryId` | string \| null | categoria di spesa principale; `null` = budget totale del mese |
| `month` | string | `YYYY-MM`, nome del mese contabile |
| `amountCents` | integer > 0 | |
| `createdAt`, `updatedAt`, `deletedAt` | | come sopra |

Tra i budget attivi ce n'è al massimo uno per categoria e mese, e un solo totale per mese. Il budget di una categoria principale comprende le spese delle sue sottocategorie.

`month` è il **nome** del mese contabile, non un intervallo di date: le date coperte dipendono dal giorno di inizio del mese (`month_start_day` in `settings`). Il periodo prende il nome del mese che contiene la maggior parte dei suoi giorni: con inizio dall'1 al 15 quello in cui inizia, dal 16 al 28 quello in cui finisce (con inizio 27, `2026-11` va dal 27 ottobre al 26 novembre).

### savingsGoals (dalla versione 2)

| Campo | Tipo | Note |
| --- | --- | --- |
| `id` | string | UUID |
| `name` | string | |
| `targetCents` | integer > 0 | importo da raggiungere |
| `targetDate` | string \| null | `YYYY-MM-DD`, facoltativa |
| `accountId` | string | conto di risparmio collegato |
| `sortOrder` | integer | |
| `createdAt`, `updatedAt`, `deletedAt` | | come sopra |

L'avanzamento non è salvato: è il saldo del conto collegato, calcolato dai movimenti.

### settings

Chiavi note nella versione 2: `onboarding_completed_at`, `last_account_id`, `last_export_at`, `month_start_day` (giorno di inizio del mese contabile, da `"1"` a `"28"`; se manca vale 1). Le chiavi sconosciute vanno conservate.

## Import

- Si rifiuta un file con `app` diverso o con `schemaVersion` maggiore di quella dell'app.
- Un file con `schemaVersion` minore viene aggiornato passo per passo (`backup-upgrades.ts`) prima della validazione.
- Si validano tipi, valori ammessi, date, unicità degli `id` e riferimenti (ogni `accountId`, `categoryId`, `parentId`, `transactionId`, `tagId` deve esistere nel file).
- **Sostituisci tutto**: prima si salva un backup di sicurezza dei dati attuali, poi il database diventa identico al file.
- **Unisci**: le righe si abbinano per `id` e vince quella con `updatedAt` più recente (cancellazioni comprese). Un tag con lo stesso nome di uno locale attivo viene ricondotto a quello locale. Se dopo l'unione restano due budget attivi per la stessa categoria (o il totale) e lo stesso mese con `id` diversi, resta quello con `updatedAt` più recente (a parità, l'`id` maggiore) e l'altro viene cancellato logicamente. Le impostazioni locali restano, si aggiungono solo le chiavi mancanti.
- In entrambi i casi l'import avviene in un'unica transazione: o entra tutto o non cambia niente.

## Compatibilità

Ogni modifica allo schema (nuova migrazione) incrementa `schemaVersion` e aggiunge il passo di aggiornamento dei backup della versione precedente, con un test che importa un backup di quella versione. Il test di round-trip (export → database vuoto → import → dati identici) deve passare sempre.

| Versione | Cambiamenti |
| --- | --- |
| 1 | Prima versione: conti, categorie, movimenti, tag, impostazioni |
| 2 | Tabelle `budgets` e `savingsGoals`; chiave `month_start_day`. Un file della versione 1 si importa con entrambi gli array vuoti |
