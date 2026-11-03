/**
 * Upgrades of backup files, one per schema version: `BACKUP_UPGRADES[n]`
 * turns a version n file into a version n + 1 file, mirroring migration n + 1.
 * An old backup goes through every step up to the current version.
 *
 * Every schema change (new migration) must add its step here, together with
 * a test that imports a backup of the previous version.
 */
export type BackupUpgrade = (data: Record<string, unknown>) => Record<string, unknown>;

export const BACKUP_UPGRADES: Readonly<Record<number, BackupUpgrade>> = {
  // Schema version 1 is the first one: nothing to upgrade yet.
};
