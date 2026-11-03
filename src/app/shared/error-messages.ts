import { BackupError } from '../core/services/backup/backup-error';
import type { BackupErrorCode } from '../core/services/backup/backup-error';
import { DomainError } from '../core/services/domain-error';
import type { DomainErrorCode } from '../core/services/domain-error';

const DOMAIN_MESSAGES: Record<DomainErrorCode, string> = {
  INVALID_AMOUNT: 'Inserisci un importo maggiore di zero.',
  INVALID_DATE: 'La data non è valida.',
  INVALID_NAME: 'Il nome non può essere vuoto.',
  ACCOUNT_NOT_FOUND: 'Il conto non esiste più.',
  ACCOUNT_HAS_TRANSACTIONS: 'Questo conto ha dei movimenti: puoi archiviarlo, ma non eliminarlo.',
  TRANSFER_ACCOUNTS: 'Scegli due conti diversi per il trasferimento.',
  CATEGORY_REQUIRED: 'Scegli una categoria.',
  CATEGORY_NOT_FOUND: 'La categoria non esiste più.',
  CATEGORY_KIND_MISMATCH: 'La categoria non è del tipo giusto (spesa o entrata).',
  CATEGORY_NOT_ALLOWED: 'I trasferimenti non hanno categoria.',
  CATEGORY_TOO_DEEP: 'Le categorie hanno al massimo due livelli.',
  CATEGORY_IN_USE: 'La categoria ha dei movimenti: uniscila a un’altra invece di eliminarla.',
  CATEGORY_HAS_CHILDREN: 'Elimina o sposta prima le sottocategorie.',
  CATEGORY_SAME: 'Scegli una categoria diversa.',
};

const BACKUP_MESSAGES: Record<BackupErrorCode, string> = {
  NOT_JSON: 'Il file non è leggibile: non è un file JSON.',
  NOT_A_BACKUP: 'Il file non è un backup di Palanche.',
  NEWER_VERSION: 'Il backup è stato creato da una versione più recente di Palanche: aggiorna l’app.',
  INVALID_DATA: 'Il backup contiene dati non validi.',
};

/** Italian message for any error shown to the user. */
export function errorMessage(error: unknown): string {
  if (error instanceof DomainError) {
    return DOMAIN_MESSAGES[error.code];
  }
  if (error instanceof BackupError) {
    return BACKUP_MESSAGES[error.code];
  }
  return 'Si è verificato un errore imprevisto.';
}
