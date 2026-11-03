import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';

import { SettingsRepository } from './settings.repository';

describe('SettingsRepository', () => {
  let settings: SettingsRepository;

  beforeEach(async () => {
    await setUpTestDatabase();
    settings = TestBed.inject(SettingsRepository);
  });

  it('returns null for a key never set', async () => {
    expect(await settings.get('last_account_id')).toBeNull();
  });

  it('inserts and then replaces a value', async () => {
    await settings.set('last_account_id', 'a1');
    await settings.set('last_account_id', 'a2');
    expect(await settings.get('last_account_id')).toBe('a2');
  });

  it('returns all the settings', async () => {
    await settings.set('onboarding_completed_at', '2026-11-03T10:00:00.000Z');
    await settings.set('last_account_id', null);
    expect(await settings.getAll()).toEqual({
      last_account_id: null,
      onboarding_completed_at: '2026-11-03T10:00:00.000Z',
    });
  });
});
