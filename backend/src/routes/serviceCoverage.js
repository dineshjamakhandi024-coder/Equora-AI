import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/service-coverage
// Retrieve all service coverage records, joining the regions table to include
// the region name. Returns an empty array `[]` if no records exist.
// ---------------------------------------------------------------------------
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const query = `
      SELECT 
        sc.id,
        sc.region_id,
        r.name AS region_name,
        sc.service_type,
        sc.people_in_need,
        sc.people_served,
        sc.available_units,
        sc.created_at
      FROM service_coverage sc
      LEFT JOIN regions r ON sc.region_id = r.id
      ORDER BY sc.id ASC
    `;
    const records = db.prepare(query).all();
    res.json(records);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/service-coverage/:id
// Retrieve a single service coverage record by ID, including its region name.
// Returns HTTP 404 if the record does not exist.
// ---------------------------------------------------------------------------
router.get('/:id', (req, res, next) => {
  try {
    const coverageId = parseInt(req.params.id, 10);

    // Validate that the ID parameter is a valid integer
    if (isNaN(coverageId) || coverageId <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Service coverage ID must be a positive integer.'
      });
    }

    const db = getDb();
    const query = `
      SELECT 
        sc.id,
        sc.region_id,
        r.name AS region_name,
        sc.service_type,
        sc.people_in_need,
        sc.people_served,
        sc.available_units,
        sc.created_at
      FROM service_coverage sc
      LEFT JOIN regions r ON sc.region_id = r.id
      WHERE sc.id = ?
    `;
    const record = db.prepare(query).get(coverageId);

    if (!record) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Service coverage record with ID ${coverageId} not found.`
      });
    }

    res.json(record);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/service-coverage
// Create a new service coverage record.
// Validates all fields and foreign key reference before inserting.
// ---------------------------------------------------------------------------
router.post('/', (req, res, next) => {
  try {
    const {
      region_id,
      service_type,
      people_in_need,
      people_served,
      available_units
    } = req.body || {};

    // 1. Validate region_id
    if (typeof region_id !== 'number' || !Number.isInteger(region_id) || region_id <= 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: "'region_id' is required and must be a positive integer."
      });
    }

    // 2. Validate service_type
    if (typeof service_type !== 'string' || service_type.trim() === '') {
      return res.status(400).json({
        error: 'Validation Error',
        message: "'service_type' is required and must be a non-empty string."
      });
    }

    // 3. Validate people_in_need
    if (typeof people_in_need !== 'number' || !Number.isInteger(people_in_need) || people_in_need < 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: "'people_in_need' is required and must be a non-negative integer (0 or greater)."
      });
    }

    // 4. Validate people_served
    if (typeof people_served !== 'number' || !Number.isInteger(people_served) || people_served < 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: "'people_served' is required and must be a non-negative integer (0 or greater)."
      });
    }

    // 5. Validate people_served does not exceed people_in_need
    if (people_served > people_in_need) {
      return res.status(400).json({
        error: 'Validation Error',
        message: "'people_served' cannot exceed 'people_in_need'."
      });
    }

    // 6. Validate available_units
    if (typeof available_units !== 'number' || !Number.isInteger(available_units) || available_units < 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: "'available_units' is required and must be a non-negative integer (0 or greater)."
      });
    }

    const db = getDb();

    // 7. Validate that the referenced region actually exists
    const region = db.prepare('SELECT id, name FROM regions WHERE id = ?').get(region_id);
    if (!region) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Referenced region with ID ${region_id} does not exist.`
      });
    }

    const trimmedServiceType = service_type.trim();

    // Parameterized SQL insert statement
    const insertStmt = db.prepare(`
      INSERT INTO service_coverage (
        region_id,
        service_type,
        people_in_need,
        people_served,
        available_units
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      region_id,
      trimmedServiceType,
      people_in_need,
      people_served,
      available_units
    );

    // Fetch the newly created record with its region name
    const fetchQuery = `
      SELECT 
        sc.id,
        sc.region_id,
        r.name AS region_name,
        sc.service_type,
        sc.people_in_need,
        sc.people_served,
        sc.available_units,
        sc.created_at
      FROM service_coverage sc
      LEFT JOIN regions r ON sc.region_id = r.id
      WHERE sc.id = ?
    `;
    const newRecord = db.prepare(fetchQuery).get(result.lastInsertRowid);

    res.status(201).json(newRecord);
  } catch (error) {
    next(error);
  }
});

export default router;
