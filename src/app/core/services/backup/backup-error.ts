/**
 * Why a file cannot be imported. The UI shows an Italian message per code;
 * `message` carries the technical detail (e.g. which field is wrong).
 */
export type BackupErrorCode =
  /** The file is not valid JSON. */
  | 'NOT_JSON'
  /** Valid JSON, but not a Palanche backup. */
  | 'NOT_A_BACKUP'
  /** Created by a newer version of the app: update the app first. */
  | 'NEWER_VERSION'
  /** A Palanche backup with missing or inconsistent data. */
  | 'INVALID_DATA';

export class BackupError extends Error {
  constructor(
    readonly code: BackupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}
