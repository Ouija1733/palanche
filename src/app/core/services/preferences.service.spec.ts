import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import { SettingsRepository } from '../repositories/settings.repository';

import { DataChangesService } from './data-changes.service';
import { parseMonthStartDay, PreferencesService } from './preferences.service';

describe('parseMonthStartDay', () => {
  it('reads valid days and falls back to the 1st otherwise', () => {
    expect(parseMonthStartDay('27')).toBe(27);
    expect(parseMonthStartDay('1')).toBe(1);
    expect(parseMonthStartDay(null)).toBe(1);
    expect(parseMonthStartDay('')).toBe(1);
    expect(parseMonthStartDay('29')).toBe(1);
    expect(parseMonthStartDay('10.5')).toBe(1);
    expect(parseMonthStartDay('abc')).toBe(1);
  });
});

describe('PreferencesService', () => {
  let service: PreferencesService;
  let settings: SettingsRepository;

  beforeEach(async () => {
    await setUpTestDatabase();
    service = TestBed.inject(PreferencesService);
    settings = TestBed.inject(SettingsRepository);
  });

  it('starts the month on the 1st when nothing is stored', async () => {
    await service.load();
    expect(service.monthStartDay()).toBe(1);
  });

  it('loads the stored start day', async () => {
    await settings.set('month_start_day', '27');
    await service.load();
    expect(service.monthStartDay()).toBe(27);
  });

  it('saves a new start day and notifies the pages', async () => {
    const changes = TestBed.inject(DataChangesService);
    const before = changes.version();
    await service.setMonthStartDay(16);
    expect(service.monthStartDay()).toBe(16);
    expect(await settings.get('month_start_day')).toBe('16');
    expect(changes.version()).toBe(before + 1);
  });

  it('rejects days outside 1–28', async () => {
    for (const day of [0, 29, 31, 2.5]) {
      await expect(service.setMonthStartDay(day)).rejects.toMatchObject({ code: 'INVALID_MONTH_START_DAY' });
    }
    expect(await settings.get('month_start_day')).toBeNull();
  });
});
