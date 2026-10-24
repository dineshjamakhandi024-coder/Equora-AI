import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp } from './helpers/testServer.js';

describe('Inequality Analysis API (/api/analytics/inequality)', () => {
  const testApp = setupTestApp();

  before(async () => {
    await testApp.start();
  });

  after(async () => {
    await testApp.stop();
  });

  test('GET /api/analytics/inequality - returns zero totals and empty arrays for empty dataset', async () => {
    const res = await testApp.request('/api/analytics/inequality');
    assert.strictEqual(res.status, 200);

    assert.deepStrictEqual(res.body.summary, {
      total_people_in_need: 0,
      total_people_served: 0,
      total_people_unserved: 0,
      overall_coverage_rate_percentage: 0
    });
    assert.deepStrictEqual(res.body.regional_results, []);
    assert.deepStrictEqual(res.body.underserved_regions, []);
  });

  test('GET /api/analytics/inequality - safely handles zero people_in_need without division by zero', async () => {
    const db = testApp.getDbInstance();
    const regResult = db.prepare('INSERT INTO regions (name, population) VALUES (?, ?)').run('Zero Need Zone', 1000);
    db.prepare(`
      INSERT INTO service_coverage (region_id, service_type, people_in_need, people_served, available_units)
      VALUES (?, ?, ?, ?, ?)
    `).run(regResult.lastInsertRowid, 'Emergency Response', 0, 0, 5);

    const res = await testApp.request('/api/analytics/inequality');
    assert.strictEqual(res.status, 200);

    const item = res.body.regional_results[0];
    assert.strictEqual(item.people_in_need, 0);
    assert.strictEqual(item.people_served, 0);
    assert.strictEqual(item.coverage_rate_percentage, 0);
    assert.strictEqual(res.body.summary.overall_coverage_rate_percentage, 0);
  });

  test('GET /api/analytics/inequality - verifies summary totals, rates, and underserved identification on known dataset', async () => {
    const db = testApp.getDbInstance();
    // Clean in-memory tables for fresh known dataset
    db.prepare('DELETE FROM service_coverage').run();
    db.prepare('DELETE FROM regions').run();

    // Setup Known Dataset:
    // Region 1 (District North): need = 10,000, served = 8,000 -> 80% coverage
    // Region 2 (District South): need = 20,000, served = 10,000 -> 50% coverage
    // Total need = 30,000, Total served = 18,000 -> Overall = (18000/30000)*100 = 60.00%
    // Underserved: District South (50% < 60%)
    const regNorth = db.prepare('INSERT INTO regions (name, population) VALUES (?, ?)').run('District North', 50000);
    const regSouth = db.prepare('INSERT INTO regions (name, population) VALUES (?, ?)').run('District South', 80000);

    const insertCoverage = db.prepare(`
      INSERT INTO service_coverage (region_id, service_type, people_in_need, people_served, available_units)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertCoverage.run(regNorth.lastInsertRowid, 'Primary Healthcare', 10000, 8000, 20);
    insertCoverage.run(regSouth.lastInsertRowid, 'Primary Healthcare', 20000, 10000, 15);

    const res = await testApp.request('/api/analytics/inequality');
    assert.strictEqual(res.status, 200);

    // 1. Verify summary totals
    assert.strictEqual(res.body.summary.total_people_in_need, 30000);
    assert.strictEqual(res.body.summary.total_people_served, 18000);
    assert.strictEqual(res.body.summary.total_people_unserved, 12000);
    assert.strictEqual(res.body.summary.overall_coverage_rate_percentage, 60);

    // 2. Verify regional results
    assert.strictEqual(res.body.regional_results.length, 2);
    const north = res.body.regional_results.find((r) => r.region_name === 'District North');
    const south = res.body.regional_results.find((r) => r.region_name === 'District South');

    assert.strictEqual(north.people_unserved, 2000);
    assert.strictEqual(north.coverage_rate_percentage, 80);

    assert.strictEqual(south.people_unserved, 10000);
    assert.strictEqual(south.coverage_rate_percentage, 50);

    // 3. Verify underserved regions
    assert.strictEqual(res.body.underserved_regions.length, 1);
    const underserved = res.body.underserved_regions[0];
    assert.strictEqual(underserved.region_name, 'District South');
    assert.strictEqual(underserved.coverage_rate_percentage, 50);
    assert.strictEqual(underserved.overall_coverage_rate_percentage, 60);
    assert.strictEqual(underserved.gap_percentage, 10);
    assert.strictEqual(underserved.people_unserved, 10000);
    assert.ok(underserved.comparison.includes('below the overall average'));
  });
});
