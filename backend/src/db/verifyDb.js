import { initDatabase, closeDb } from './database.js';

console.log('--- EQUORA AI Database Verification ---');

try {
  // Use an in-memory database (:memory:) for testing so the real local database is untouched
  console.log('1. Initializing in-memory SQLite database...');
  const db = initDatabase(':memory:');

  // Verify Foreign Key enforcement
  const fkStatus = db.pragma('foreign_keys', { simple: true });
  if (fkStatus !== 1) {
    throw new Error(`Expected foreign_keys pragma to be 1, but got ${fkStatus}`);
  }
  console.log('   ✓ Foreign key enforcement is ON.');

  // Verify tables exist in sqlite_master
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('regions', 'service_coverage') ORDER BY name ASC")
    .all()
    .map(row => row.name);

  if (!tables.includes('regions') || !tables.includes('service_coverage')) {
    throw new Error(`Tables missing! Found: ${tables.join(', ')}`);
  }
  console.log('   ✓ Tables created successfully: [regions, service_coverage]');

  // Verify columns for 'regions'
  const regionCols = db.pragma('table_info(regions)').map(col => col.name);
  console.log(`   ✓ 'regions' columns: ${regionCols.join(', ')}`);

  // Verify columns for 'service_coverage'
  const coverageCols = db.pragma('table_info(service_coverage)').map(col => col.name);
  console.log(`   ✓ 'service_coverage' columns: ${coverageCols.join(', ')}`);

  // Verify parameterized operations & constraints:
  console.log('2. Testing constraints and parameterized queries...');

  // Test inserting a valid region
  const insertRegion = db.prepare('INSERT INTO regions (name, population) VALUES (?, ?)');
  const regionResult = insertRegion.run('Northern District', 50000);
  const regionId = regionResult.lastInsertRowid;
  console.log(`   ✓ Inserted test region with ID: ${regionId}`);

  // Test population > 0 constraint violation
  try {
    insertRegion.run('Invalid Population Area', 0);
    throw new Error('Expected population CHECK constraint violation, but insert succeeded.');
  } catch (err) {
    if (err.message.includes('CHECK constraint failed')) {
      console.log('   ✓ CHECK constraint verified: population must be > 0.');
    } else {
      throw err;
    }
  }

  // Test inserting valid service coverage
  const insertCoverage = db.prepare(
    'INSERT INTO service_coverage (region_id, service_type, people_in_need, people_served, available_units) VALUES (?, ?, ?, ?, ?)'
  );
  insertCoverage.run(regionId, 'Healthcare', 1200, 800, 15);
  console.log('   ✓ Inserted test service coverage record.');

  // Test people_served <= people_in_need constraint violation
  try {
    insertCoverage.run(regionId, 'Clean Water', 100, 150, 5); // 150 > 100
    throw new Error('Expected people_served <= people_in_need CHECK violation, but insert succeeded.');
  } catch (err) {
    if (err.message.includes('CHECK constraint failed')) {
      console.log('   ✓ CHECK constraint verified: people_served cannot exceed people_in_need.');
    } else {
      throw err;
    }
  }

  // Test foreign key constraint violation (non-existent region_id)
  try {
    insertCoverage.run(99999, 'Electricity', 100, 50, 5);
    throw new Error('Expected foreign key constraint violation, but insert succeeded.');
  } catch (err) {
    if (err.message.includes('FOREIGN KEY constraint failed')) {
      console.log('   ✓ Foreign key constraint verified: invalid region_id rejected.');
    } else {
      throw err;
    }
  }

  // Close the in-memory database
  closeDb();

  console.log('\n--- All Database Checks Passed Successfully! ---');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Database verification failed:', error.message);
  closeDb();
  process.exit(1);
}
