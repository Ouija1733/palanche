/** Keys of the `settings` table used by the app. */
export type SettingKey =
  /** ISO timestamp, set when the onboarding is completed. */
  | 'onboarding_completed_at'
  /** Account preselected in the new transaction form. */
  | 'last_account_id'
  /** ISO timestamp of the last JSON export. */
  | 'last_export_at';
