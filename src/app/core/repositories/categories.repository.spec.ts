import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';

import { CategoriesRepository } from './categories.repository';

describe('CategoriesRepository', () => {
  let repository: CategoriesRepository;

  beforeEach(async () => {
    await setUpTestDatabase();
    repository = TestBed.inject(CategoriesRepository);
  });

  const createHome = () => repository.create({ name: 'Casa', kind: 'expense', icon: 'home-outline', color: 'violet' });

  it('creates a main category and a subcategory', async () => {
    const home = await createHome();
    const rent = await repository.create({
      name: 'Affitto',
      kind: 'expense',
      icon: home.icon,
      color: home.color,
      parentId: home.id,
    });

    expect(await repository.findById(rent.id)).toEqual(rent);
    expect(rent.parentId).toBe(home.id);
    expect(await repository.findChildren(home.id)).toEqual([rent]);
  });

  it('filters by kind and orders by sort order, then name', async () => {
    await repository.create({ name: 'Svago', kind: 'expense', icon: 'film-outline', color: 'pink', sortOrder: 2 });
    await repository.create({ name: 'Bollette', kind: 'expense', icon: 'flash-outline', color: 'ochre', sortOrder: 1 });
    await repository.create({ name: 'Stipendio', kind: 'income', icon: 'briefcase-outline', color: 'teal' });

    expect((await repository.findAll({ kind: 'expense' })).map((c) => c.name)).toEqual(['Bollette', 'Svago']);
    expect((await repository.findAll({ kind: 'income' })).map((c) => c.name)).toEqual(['Stipendio']);
    expect(await repository.findAll()).toHaveLength(3);
  });

  it('updates fields without touching the parent', async () => {
    const home = await createHome();
    const updated = await repository.update(home.id, { name: 'Abitazione', color: 'indigo' });
    expect(updated).toEqual(expect.objectContaining({ name: 'Abitazione', color: 'indigo', icon: 'home-outline' }));
  });

  it('moves a category under another one and back to the top level', async () => {
    const home = await createHome();
    const bills = await repository.create({ name: 'Bollette', kind: 'expense', icon: 'flash-outline', color: 'ochre' });

    await repository.setParent(bills.id, home.id);
    expect((await repository.findById(bills.id))?.parentId).toBe(home.id);

    await repository.setParent(bills.id, null);
    expect((await repository.findById(bills.id))?.parentId).toBeNull();

    await expect(repository.setParent('missing', null)).rejects.toThrow(/not found/);
  });

  it('copies icon and color to the active subcategories', async () => {
    const home = await createHome();
    const rent = await repository.create({ ...home, name: 'Affitto', parentId: home.id });
    const old = await repository.create({ ...home, name: 'Vecchia', parentId: home.id });
    await repository.softDelete(old.id);

    await repository.setChildrenAppearance(home.id, { icon: 'bed-outline', color: 'blue' });

    expect(await repository.findById(rent.id)).toEqual(expect.objectContaining({ icon: 'bed-outline', color: 'blue' }));
    await repository.restore(old.id);
    expect(await repository.findById(old.id)).toEqual(
      expect.objectContaining({ icon: 'home-outline', color: 'violet' }),
    );
  });

  it('soft-deletes and restores', async () => {
    const home = await createHome();
    expect(await repository.softDelete(home.id)).toBe(true);
    expect(await repository.findById(home.id)).toBeNull();
    expect(await repository.findAll()).toEqual([]);
    expect(await repository.restore(home.id)).toBe(true);
    expect(await repository.findById(home.id)).not.toBeNull();
  });
});
