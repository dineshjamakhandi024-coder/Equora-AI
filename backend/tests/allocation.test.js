import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp } from './helpers/testServer.js';

describe('Resource Allocation API (/api/allocation)', () => {
  const testApp = setupTestApp();

  before(async () => {
    await testApp.start();
  });

  after(async () => {
    await testApp.stop();
  });

  test('POST /api/allocation - rejects invalid budget_units (negative, non-number, float, missing)', async () => {
    // Missing budget_units
    const resMissing = await testApp.request('/api/allocation', {
      method: 'POST',
      body: {}
    });
    assert.strictEqual(resMissing.status, 400);
    assert.strictEqual(resMissing.body.error, 'Validation Error');

    // Negative budget_units
    const resNegative = await testApp.request('/api/allocation', {
      method: 'POST',
      body: { budget_units: -5 }
    });
    assert.strictEqual(resNegative.status, 400);
    assert.strictEqual(resNegative.body.error, 'Validation Error');

    // Float budget_units
    const resFloat = await testApp.request('/api/allocation', {
      method: 'POST',
      body: { budget_units: 12.5 }
    });
    assert.strictEqual(resFloat.status, 400);
    assert.strictEqual(resFloat.body.error, 'Validation Error');

    // String budget_units
    const resString = await testApp.request('/api/allocation', {
      method: 'POST',
      body: { budget_units: 'twenty' }
    });
    assert.strictEqual(resString.status, 400);
    assert.strictEqual(resString.body.error, 'Validation Error');
  });

  test('POST /api/allocation - behavior when no eligible records exist in database', async () => {
    const res = await testApp.request('/api/allocation', {
      method: 'POST',
      body: { budget_units: 50 }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.summary.budget_units, 50);
    assert.strictEqual(res.body.summary.total_allocated_units, 0);
    assert.strictEqual(res.body.summary.remaining_budget_units, 50);
    assert.strictEqual(res.body.summary.eligible_records_count, 0);
    assert.deepStrictEqual(res.body.allocations, []);
  });

  test('POST /api/allocation - behavior when all records have zero unmet need', async () => {
    const db = testApp.getDbInstance();
    const reg = db.prepare('INSERT INTO regions (name, population) VALUES (?, ?)').run('Full Coverage Region', 10000);
    db.prepare(`
      INSERT INTO service_coverage (region_id, service_type, people_in_need, people_served, available_units)
      VALUES (?, ?, ?, ?, ?)
    `).run(reg.lastInsertRowid, 'Water Supply', 5000, 5000, 10); // 100% served -> unmet need = 0

    const res = await testApp.request('/api/allocation', {
      method: 'POST',
      body: { budget_units: 20 }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.summary.total_allocated_units, 0);
    assert.strictEqual(res.body.summary.eligible_records_count, 0);
    assert.deepStrictEqual(res.body.allocations, []);
  });

  test('POST /api/allocation - verifies zero-budget behavior (budget_units = 0)', async () => {
    const db = testApp.getDbInstance();
    // Add record with unmet need
    const reg = db.prepare('INSERT INTO regions (name, population) VALUES (?, ?)').run('Unmet Region', 20000);
    db.prepare(`
      INSERT INTO service_coverage (region_id, service_type, people_in_need, people_served, available_units)
      VALUES (?, ?, ?, ?, ?)
    `).run(reg.lastInsertRowid, 'Healthcare', 10000, 4000, 5); // unserved = 6,000

    const res = await testApp.request('/api/allocation', {
      method: 'POST',
      body: { budget_units: 0 }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.summary.budget_units, 0);
    assert.strictEqual(res.body.summary.total_allocated_units, 0);
    assert.strictEqual(res.body.summary.remaining_budget_units, 0);
    assert.strictEqual(res.body.summary.eligible_records_count, 1);
    assert.strictEqual(res.body.allocations.length, 1);
    assert.strictEqual(res.body.allocations[0].allocated_units, 0);
  });

  test('POST /api/allocation - allocation does not exceed budget, only targets unmet need, and is non-negative integer', async () => {
    const db = testApp.getDbInstance();
    db.prepare('DELETE FROM service_coverage').run();
    db.prepare('DELETE FROM regions').run();

    // Create 3 regions with varied unmet needs:
    // Region A: need = 10,000, served = 2,000 -> unmet = 8,000 (coverage 20%)
    // Region B: need = 10,000, served = 6,000 -> unmet = 4,000 (coverage 60%)
    // Region C: need = 5,000, served = 5,000  -> unmet = 0     (coverage 100% - fully served!)
    const regA = db.prepare('INSERT INTO regions (name, population) VALUES (?, ?)').run('Region A', 20000);
    const regB = db.prepare('INSERT INTO regions (name, population) VALUES (?, ?)').run('Region B', 20000);
    const regC = db.prepare('INSERT INTO regions (name, population) VALUES (?, ?)').run('Region C', 10000);

    const insert = db.prepare(`
      INSERT INTO service_coverage (region_id, service_type, people_in_need, people_served, available_units)
      VALUES (?, ?, ?, ?, ?)
    `);
    insert.run(regA.lastInsertRowid, 'Clinic', 10000, 2000, 5);
    insert.run(regB.lastInsertRowid, 'Clinic', 10000, 6000, 8);
    insert.run(regC.lastInsertRowid, 'Clinic', 5000, 5000, 10);

    const budget = 30;
    const res = await testApp.request('/api/allocation', {
      method: 'POST',
      body: { budget_units: budget }
    });

    assert.strictEqual(res.status, 200);
    const { summary, allocations } = res.body;

    // 1. Total allocation must not exceed the budget
    assert.ok(
      summary.total_allocated_units <= budget,
      `Total allocated (${summary.total_allocated_units}) exceeds budget (${budget})`
    );
    assert.strictEqual(summary.total_allocated_units, budget);
    assert.strictEqual(summary.remaining_budget_units, 0);

    // 2. Only targets records with unmet need (Region C with 0 unmet need must NOT be in eligible allocations)
    assert.strictEqual(summary.eligible_records_count, 2);
    assert.strictEqual(allocations.length, 2);

    const allocA = allocations.find((a) => a.region_name === 'Region A');
    const allocB = allocations.find((a) => a.region_name === 'Region B');
    const allocC = allocations.find((a) => a.region_name === 'Region C');

    assert.ok(allocA, 'Region A should receive an allocation');
    assert.ok(allocB, 'Region B should receive an allocation');
    assert.strictEqual(allocC, undefined, 'Region C with 0 unmet need must receive no allocation');

    // 3. Allocations are non-negative integers
    for (const alloc of allocations) {
      assert.ok(Number.isInteger(alloc.allocated_units), 'allocated_units must be an integer');
      assert.ok(alloc.allocated_units >= 0, 'allocated_units must be >= 0');
    }

    // 4. Region A (unmet 8,000) should get proportionally more units than Region B (unmet 4,000)
    // 8000 / 12000 * 30 = 20 units; 4000 / 12000 * 30 = 10 units
    assert.strictEqual(allocA.allocated_units, 20);
    assert.strictEqual(allocB.allocated_units, 10);
  });

  test('POST /api/allocation - deterministic results across repeated runs with identical input', async () => {
    const budget = 25;
    const res1 = await testApp.request('/api/allocation', {
      method: 'POST',
      body: { budget_units: budget }
    });
    const res2 = await testApp.request('/api/allocation', {
      method: 'POST',
      body: { budget_units: budget }
    });

    assert.deepStrictEqual(
      res1.body,
      res2.body,
      'Resource allocation must produce identical deterministic results on identical input'
    );
  });
});
