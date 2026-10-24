import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp } from './helpers/testServer.js';

describe('Regions API (/api/regions)', () => {
  const testApp = setupTestApp();

  before(async () => {
    await testApp.start();
  });

  after(async () => {
    await testApp.stop();
  });

  test('GET /api/regions - initially returns empty list when no regions exist', async () => {
    const res = await testApp.request('/api/regions');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.strictEqual(res.body.length, 0);
  });

  test('POST /api/regions - successfully creates a valid region', async () => {
    const payload = { name: 'Highland District', population: 45000 };
    const res = await testApp.request('/api/regions', {
      method: 'POST',
      body: payload
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.id, 1);
    assert.strictEqual(res.body.name, 'Highland District');
    assert.strictEqual(res.body.population, 45000);
    assert.ok(res.body.created_at);
  });

  test('GET /api/regions/:id - retrieves an existing region by ID', async () => {
    const res = await testApp.request('/api/regions/1');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, 1);
    assert.strictEqual(res.body.name, 'Highland District');
    assert.strictEqual(res.body.population, 45000);
  });

  test('GET /api/regions - lists all created regions', async () => {
    const res = await testApp.request('/api/regions');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].name, 'Highland District');
  });

  test('GET /api/regions/:id - returns 404 for an unknown region ID', async () => {
    const res = await testApp.request('/api/regions/9999');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Not Found');
    assert.ok(res.body.message.includes('not found'));
  });

  test('GET /api/regions/:id - returns 400 for an invalid ID parameter', async () => {
    const res = await testApp.request('/api/regions/abc');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Bad Request');
  });

  test('POST /api/regions - rejects missing or blank name', async () => {
    const res = await testApp.request('/api/regions', {
      method: 'POST',
      body: { name: '   ', population: 10000 }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Validation Error');
    assert.ok(res.body.message.includes('name'));
  });

  test('POST /api/regions - rejects zero or negative population', async () => {
    const resZero = await testApp.request('/api/regions', {
      method: 'POST',
      body: { name: 'Valley', population: 0 }
    });
    assert.strictEqual(resZero.status, 400);
    assert.strictEqual(resZero.body.error, 'Validation Error');

    const resNeg = await testApp.request('/api/regions', {
      method: 'POST',
      body: { name: 'Valley', population: -50 }
    });
    assert.strictEqual(resNeg.status, 400);
    assert.strictEqual(resNeg.body.error, 'Validation Error');
  });

  test('POST /api/regions - rejects non-integer population', async () => {
    const res = await testApp.request('/api/regions', {
      method: 'POST',
      body: { name: 'Valley', population: 123.45 }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Validation Error');
  });
});
