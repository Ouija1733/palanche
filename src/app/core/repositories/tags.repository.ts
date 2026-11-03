import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../db/database.service';
import type { SqlExecutor } from '../db/sql-executor';
import type { Tag, TransactionTag } from '../models/tag';
import { nowIso } from '../utils/dates';
import { uuidV4 } from '../utils/uuid';

import { placeholders, upsertRows } from './sql';

interface TagRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

interface TransactionTagRow {
  id: string;
  transaction_id: string;
  tag_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function toTransactionTag(row: TransactionTagRow): TransactionTag {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    tagId: row.tag_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/** The only place with SQL for `tags` and the `transaction_tags` bridge table. */
@Injectable({ providedIn: 'root' })
export class TagsRepository {
  private readonly database = inject(DatabaseService);

  async findAll(db: SqlExecutor = this.database.db): Promise<Tag[]> {
    const rows = await db.query<TagRow>('SELECT * FROM tags WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE');
    return rows.map(toTag);
  }

  /** Finds an active tag by name, ignoring case. */
  async findByName(name: string, db: SqlExecutor = this.database.db): Promise<Tag | null> {
    const [row] = await db.query<TagRow>('SELECT * FROM tags WHERE name = ? COLLATE NOCASE AND deleted_at IS NULL', [
      name.trim(),
    ]);
    return row ? toTag(row) : null;
  }

  /** Returns the tag with this name (ignoring case), creating it if needed. */
  async findOrCreate(name: string, db: SqlExecutor = this.database.db): Promise<Tag> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Tag name cannot be empty');
    }
    const existing = await this.findByName(trimmed, db);
    if (existing) {
      return existing;
    }
    const now = nowIso();
    const tag: Tag = { id: uuidV4(), name: trimmed, createdAt: now, updatedAt: now, deletedAt: null };
    await db.run('INSERT INTO tags (id, name, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?)', [
      tag.id,
      tag.name,
      tag.createdAt,
      tag.updatedAt,
      tag.deletedAt,
    ]);
    return tag;
  }

  /** Active tags of a transaction, sorted by name. */
  async findByTransaction(transactionId: string, db: SqlExecutor = this.database.db): Promise<Tag[]> {
    const rows = await db.query<TagRow>(
      `SELECT g.* FROM tags g
       JOIN transaction_tags tt ON tt.tag_id = g.id
       WHERE tt.transaction_id = ? AND tt.deleted_at IS NULL AND g.deleted_at IS NULL
       ORDER BY g.name COLLATE NOCASE`,
      [transactionId],
    );
    return rows.map(toTag);
  }

  /**
   * Makes `tagIds` the tags of the transaction: links no longer wanted are
   * soft-deleted, missing ones are added, the others are left untouched.
   */
  async setTransactionTags(
    transactionId: string,
    tagIds: readonly string[],
    db: SqlExecutor = this.database.db,
  ): Promise<void> {
    const wanted = [...new Set(tagIds)];
    const now = nowIso();

    const removeFilter = wanted.length ? `AND tag_id NOT IN (${placeholders(wanted.length)})` : '';
    await db.run(
      `UPDATE transaction_tags SET deleted_at = ?, updated_at = ?
       WHERE transaction_id = ? AND deleted_at IS NULL ${removeFilter}`,
      [now, now, transactionId, ...wanted],
    );

    const current = await db.query<{ tag_id: string }>(
      'SELECT tag_id FROM transaction_tags WHERE transaction_id = ? AND deleted_at IS NULL',
      [transactionId],
    );
    const present = new Set(current.map((row) => row.tag_id));
    for (const tagId of wanted.filter((id) => !present.has(id))) {
      await db.run(
        `INSERT INTO transaction_tags (id, transaction_id, tag_id, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, NULL)`,
        [uuidV4(), transactionId, tagId, now, now],
      );
    }
  }

  // Backup: whole tables, deleted rows included, ids and timestamps preserved.

  async findAllIncludingDeleted(db: SqlExecutor = this.database.db): Promise<Tag[]> {
    const rows = await db.query<TagRow>('SELECT * FROM tags ORDER BY created_at, id');
    return rows.map(toTag);
  }

  async findAllLinksIncludingDeleted(db: SqlExecutor = this.database.db): Promise<TransactionTag[]> {
    const rows = await db.query<TransactionTagRow>('SELECT * FROM transaction_tags ORDER BY created_at, id');
    return rows.map(toTransactionTag);
  }

  async upsertAll(tags: readonly Tag[], db: SqlExecutor = this.database.db): Promise<void> {
    await upsertRows(
      db,
      'tags',
      ['id', 'name', 'created_at', 'updated_at', 'deleted_at'],
      tags.map((tag) => [tag.id, tag.name, tag.createdAt, tag.updatedAt, tag.deletedAt]),
    );
  }

  async upsertAllLinks(links: readonly TransactionTag[], db: SqlExecutor = this.database.db): Promise<void> {
    await upsertRows(
      db,
      'transaction_tags',
      ['id', 'transaction_id', 'tag_id', 'created_at', 'updated_at', 'deleted_at'],
      links.map((link) => [link.id, link.transactionId, link.tagId, link.createdAt, link.updatedAt, link.deletedAt]),
    );
  }

  /** Physically empties both tables: only for "replace everything" restores. */
  async deleteAll(db: SqlExecutor = this.database.db): Promise<void> {
    await db.run('DELETE FROM transaction_tags');
    await db.run('DELETE FROM tags');
  }
}
