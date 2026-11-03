import type { TransactionListItem } from '../../core/models/transaction';

/** Main line: payee, else note, else category, else "Trasferimento". */
export function transactionTitle(item: TransactionListItem): string {
  return item.payee ?? item.note ?? item.categoryName ?? (item.type === 'transfer' ? 'Trasferimento' : 'Movimento');
}

/**
 * Secondary line, parts joined by " · ":
 * expense/income "Spesa · Conto corrente · #lampadine",
 * transfer "Trasferimento · Corrente → Prepagata".
 * The category is omitted when it is already the title.
 */
export function transactionSubtitle(item: TransactionListItem, extra: readonly string[] = []): string {
  const parts: string[] = [];
  if (item.type === 'transfer') {
    parts.push('Trasferimento', `${item.accountName} → ${item.toAccountName ?? '?'}`);
  } else {
    if (item.categoryName && transactionTitle(item) !== item.categoryName) {
      parts.push(item.categoryName);
    }
    parts.push(item.accountName);
  }
  parts.push(...extra, ...item.tags.map((tag) => `#${tag}`));
  return parts.join(' · ');
}
