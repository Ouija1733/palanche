import { TestBed } from '@angular/core/testing';

import { DatabaseService } from '../app/core/db/database.service';

import type { SqlJsExecutor } from './sqljs-executor';
import { createMigratedTestExecutor } from './sqljs-executor';

/**
 * Configures TestBed with a fresh in-memory database (all migrations applied)
 * in place of the real DatabaseService. Call it in `beforeEach`.
 */
export async function setUpTestDatabase(): Promise<SqlJsExecutor> {
  const db = await createMigratedTestExecutor();
  TestBed.configureTestingModule({
    providers: [{ provide: DatabaseService, useValue: { db } satisfies Pick<DatabaseService, 'db'> }],
  });
  return db;
}
