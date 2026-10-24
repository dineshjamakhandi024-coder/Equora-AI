import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const realDbPath = path.resolve(__dirname, '../data/equora.db');

describe('Database Safety & Isolation', () => {
  test('verifies the developer real local database exists and was not altered', () => {
    // Check if the real database file exists
    assert.ok(
      fs.existsSync(realDbPath),
      `Real database file must exist at ${realDbPath}`
    );

    // Open real database strictly in READ-ONLY mode
    const db = new Database(realDbPath, { readonly: true });

    try {
      const regionCount = db
        .prepare('SELECT COUNT(*) AS count FROM regions')
        .get().count;
      const coverageCount = db
        .prepare('SELECT COUNT(*) AS count FROM service_coverage')
        .get().count;

      // Ensure table rows exist and were not cleared or zeroed out
      assert.ok(
        regionCount >= 1,
        `Expected real regions table to preserve user records, found ${regionCount}`
      );
      assert.ok(
        coverageCount >= 1,
        `Expected real service_coverage table to preserve user records, found ${coverageCount}`
      );
    } finally {
      db.close();
    }
  });
});
