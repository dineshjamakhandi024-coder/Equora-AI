import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine the current file directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default directory: backend/data/
const DEFAULT_DATA_DIR = path.resolve(__dirname, '../../data');
// Default database file: backend/data/equora.db
const DEFAULT_DB_PATH = path.join(DEFAULT_DATA_DIR, 'equora.db');

// Singleton database instance
let db = null;

/**
 * Initializes the SQLite database connection, enables foreign keys,
 * and creates all required tables if they don't already exist.
 *
 * @param {string|null} customDbPath - Optional custom database file path or ':memory:' for tests
 * @returns {Database} The initialized better-sqlite3 database instance
 */
export function initDatabase(customDbPath = null) {
  // Close any existing open database instance to prevent dangling locks
  if (db) {
    try {
      db.close();
    } catch (_) {}
    db = null;
  }

  const dbPath = customDbPath || DEFAULT_DB_PATH;

  // If using a file (not an in-memory database), ensure the parent folder exists
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      // Create the directory recursively if missing
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Open the database connection
  db = new Database(dbPath);

  // Enable foreign key constraints (disabled by default in SQLite)
  db.pragma('foreign_keys = ON');

  // Use Write-Ahead Logging (WAL) for better concurrent read/write performance
  // (WAL mode is only applicable to disk-based databases)
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Create tables using a transaction or exec script
  createTables(db);

  return db;
}

/**
 * Creates the `regions` and `service_coverage` tables with all necessary
 * constraints, types, and relationships.
 *
 * @param {Database} database - The better-sqlite3 instance
 */
function createTables(database) {
  const schema = `
    -- Regions table: Stores geographic or administrative areas and their population
    CREATE TABLE IF NOT EXISTS regions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      population INTEGER NOT NULL CHECK (population > 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Service coverage table: Tracks service delivery metrics per region
    CREATE TABLE IF NOT EXISTS service_coverage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      region_id INTEGER NOT NULL,
      service_type TEXT NOT NULL,
      people_in_need INTEGER NOT NULL CHECK (people_in_need >= 0),
      people_served INTEGER NOT NULL CHECK (people_served >= 0 AND people_served <= people_in_need),
      available_units INTEGER NOT NULL CHECK (available_units >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE CASCADE
    );
  `;

  database.exec(schema);
}

/**
 * Returns the active database instance.
 * Throws an error if called before initDatabase().
 *
 * @returns {Database} The active better-sqlite3 database instance
 */
export function getDb() {
  if (!db) {
    throw new Error('Database has not been initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Closes the active database connection if open.
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export default {
  initDatabase,
  getDb,
  closeDb
};
