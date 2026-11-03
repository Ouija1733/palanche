import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import { isCategoryColor, isCategoryIcon } from '../models/category-palette';
import { AccountsRepository } from '../repositories/accounts.repository';
import { CategoriesRepository } from '../repositories/categories.repository';

import { CategoryService } from './category.service';
import { DEFAULT_CATEGORIES } from './default-categories';
import type { CategorySelection, FirstAccountInput } from './onboarding.service';
import { OnboardingService } from './onboarding.service';

const ACCOUNT: FirstAccountInput = { name: 'Conto corrente', type: 'checking', initialBalanceCents: 210430 };

/** All the default categories, as the onboarding sends them when nothing is changed. */
const ALL_DEFAULTS: CategorySelection[] = DEFAULT_CATEGORIES.map((c) => ({ ...c, children: [...c.children] }));

describe('default categories', () => {
  it('match the agreed list: 14 expense and 5 income main categories', () => {
    expect(DEFAULT_CATEGORIES.filter((c) => c.kind === 'expense')).toHaveLength(14);
    expect(DEFAULT_CATEGORIES.filter((c) => c.kind === 'income').map((c) => c.name)).toEqual([
      'Stipendio',
      'Lavoro extra',
      'Rimborsi',
      'Regali ricevuti',
      'Altre entrate',
    ]);
    expect(DEFAULT_CATEGORIES.flatMap((c) => c.children)).toHaveLength(37);
  });

  it('use only palette colors and outline icons, without duplicate names', () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(isCategoryColor(category.color)).toBe(true);
      expect(isCategoryIcon(category.icon)).toBe(true);
      expect(new Set(category.children).size).toBe(category.children.length);
    }
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.name)).size).toBe(DEFAULT_CATEGORIES.length);
  });
});

describe('OnboardingService', () => {
  let service: OnboardingService;
  let categories: CategoriesRepository;

  beforeEach(async () => {
    await setUpTestDatabase();
    service = TestBed.inject(OnboardingService);
    categories = TestBed.inject(CategoriesRepository);
  });

  it('creates the account, all the default categories and marks the onboarding as done', async () => {
    expect(await service.isCompleted()).toBe(false);

    await service.complete(ACCOUNT, ALL_DEFAULTS);

    expect(await service.isCompleted()).toBe(true);
    const [account] = await TestBed.inject(AccountsRepository).findAll();
    expect(account).toEqual(
      expect.objectContaining({ name: 'Conto corrente', initialBalanceCents: 210430, currency: 'EUR' }),
    );
    expect(await categories.findAll()).toHaveLength(19 + 37);

    const tree = await TestBed.inject(CategoryService).getTree('expense');
    expect(tree.map((node) => node.category.name)).toEqual(
      DEFAULT_CATEGORIES.filter((c) => c.kind === 'expense').map((c) => c.name),
    );
    const home = tree.find((node) => node.category.name === 'Casa');
    expect(home?.children.map((c) => [c.name, c.icon, c.color])).toEqual([
      ['Affitto o mutuo', 'home-outline', 'violet'],
      ['Condominio', 'home-outline', 'violet'],
      ['Manutenzione', 'home-outline', 'violet'],
      ['Arredamento', 'home-outline', 'violet'],
    ]);
  });

  it('creates only the kept categories and subcategories, with their new names', async () => {
    const home = ALL_DEFAULTS.find((c) => c.name === 'Casa')!;
    await service.complete(ACCOUNT, [
      { ...home, name: ' Abitazione ', children: ['Affitto', 'Condominio'] },
      ALL_DEFAULTS.find((c) => c.name === 'Stipendio')!,
    ]);

    const names = (await categories.findAll()).map((c) => c.name).sort();
    expect(names).toEqual(['Abitazione', 'Affitto', 'Condominio', 'Stipendio']);
  });

  it('allows starting without categories', async () => {
    await service.complete(ACCOUNT, []);
    expect(await categories.findAll()).toEqual([]);
    expect(await service.isCompleted()).toBe(true);
  });

  it('validates names and amounts before writing anything', async () => {
    await expect(service.complete({ ...ACCOUNT, name: ' ' }, ALL_DEFAULTS)).rejects.toMatchObject({
      code: 'INVALID_NAME',
    });
    await expect(service.complete(ACCOUNT, [{ ...ALL_DEFAULTS[1], children: [''] }])).rejects.toMatchObject({
      code: 'INVALID_NAME',
    });
    await expect(service.complete({ ...ACCOUNT, initialBalanceCents: 0.5 }, [])).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    });
    expect(await service.isCompleted()).toBe(false);
  });

  it('is all or nothing', async () => {
    vi.spyOn(TestBed.inject(CategoriesRepository), 'create').mockRejectedValueOnce(new Error('boom'));
    await expect(service.complete(ACCOUNT, ALL_DEFAULTS)).rejects.toThrow('boom');

    expect(await TestBed.inject(AccountsRepository).findAll()).toEqual([]);
    expect(await service.isCompleted()).toBe(false);
  });

  it('cannot run twice', async () => {
    await service.complete(ACCOUNT, []);
    await expect(service.complete(ACCOUNT, [])).rejects.toThrow(/already/);
  });
});
