import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp } from './helpers/testServer.js';

describe('Service Coverage API (/api/service-coverage)', () => {
  const testApp = setupTestApp();
  let testRegionId = null;

  before(async () => {
    await testApp.start();

    // Create a base test region
    const regRes = await testApp.request('/api/regions', {
      method: 'POST',
      body: { name: 'Coastal District', population: 60000 }
    });
    assert.strictEqual(regRes.status, 201);
    testRegionId = regRes.body.id;
  });

  after(async () => {
    await testApp.stop();
  });

  test('GET /api/service-coverage - initially returns empty array', async () => {
    const res = await testApp.request('/api/service-coverage');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.strictEqual(res.body.length, 0);
  });

  test('POST /api/service-coverage - successfully creates a valid record', async () => {
    const payload = {
      region_id: testRegionId,
      service_type: 'Healthcare Clinic',
      people_in_need: 10000,
      people_served: 7500,
      available_units: 15
    };

    const res = await testApp.request('/api/service-coverage', {
      method: 'POST',
      body: payload
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.id, 1);
    assert.strictEqual(res.body.region_id, testRegionId);
    assert.strictEqual(res.body.region_name, 'Coastal District');
    assert.strictEqual(res.body.service_type, 'Healthcare Clinic');
    assert.strictEqual(res.body.people_in_need, 10000);
    assert.strictEqual(res.body.people_served, 7500);
    assert.strictEqual(res.body.available_units, 15);
    assert.ok(res.body.created_at);
  });

  test('GET /api/service-coverage/:id - retrieves created record by ID with region name', async () => {
    const res = await testApp.request('/api/service-coverage/1');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, 1);
    assert.strictEqual(res.body.region_name, 'Coastal District');
    assert.strictEqual(res.body.people_served, 7500);
  });

  test('GET /api/service-coverage - lists all created coverage records', async () => {
    const res = await testApp.request('/api/service-coverage');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].service_type, 'Healthcare Clinic');
  });

  test('GET /api/service-coverage/:id - returns 404 for unknown record ID', async () => {
    const res = await testApp.request('/api/service-coverage/9999');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Not Found');
  });

  test('POST /api/service-coverage - rejects nonexistent region_id', async () => {
    const res = await testApp.request('/api/service-coverage', {
      method: 'POST',
      body: {
        region_id: 9999,
        service_type: 'Water Supply',
        people_in_need: 500,
        people_served: 200,
        available_units: 2
      }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Validation Error');
    assert.ok(res.body.message.includes('does not exist'));
  });

  test('POST /api/service-coverage - rejects blank service_type', async () => {
    const res = await testApp.request('/api/service-coverage', {
      method: 'POST',
      body: {
        region_id: testRegionId,
        service_type: '   ',
        people_in_need: 500,
        people_served: 200,
        available_units: 2
      }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Validation Error');
  });

  test('POST /api/service-coverage - rejects negative values for people_in_need or available_units', async () => {
    const resNegNeed = await testApp.request('/api/service-coverage', {
      method: 'POST',
      body: {
        region_id: testRegionId,
        service_type: 'Sanitation',
        people_in_need: -10,
        people_served: 0,
        available_units: 1
      }
    });
    assert.strictEqual(resNegNeed.status, 400);
    assert.strictEqual(resNegNeed.body.error, 'Validation Error');

    const resNegUnits = await testApp.request('/api/service-coverage', {
      method: 'POST',
      body: {
        region_id: testRegionId,
        service_type: 'Sanitation',
        people_in_need: 100,
        people_served: 50,
        available_units: -5
      }
    });
    assert.strictEqual(resNegUnits.status, 400);
    assert.strictEqual(resNegUnits.body.error, 'Validation Error');
  });

  test('POST /api/service-coverage - rejects people_served greater than people_in_need', async () => {
    const res = await testApp.request('/api/service-coverage', {
      method: 'POST',
      body: {
        region_id: testRegionId,
        service_type: 'Sanitation',
        people_in_need: 100,
        people_served: 150,
        available_units: 5
      }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Validation Error');
    assert.ok(res.body.message.includes('cannot exceed'));
  });
});
