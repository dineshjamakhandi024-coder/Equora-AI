import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/regions
// Retrieve all regions, ordered by ID ascending.
// Returns an empty array `[]` if no regions have been added yet.
// ---------------------------------------------------------------------------
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    // Parameterized / prepared query to select all regions
    const regions = db.prepare('SELECT id, name, population, created_at FROM regions ORDER BY id ASC').all();
    res.json(regions);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/regions/:id
// Retrieve a single region by its primary key ID.
// Returns HTTP 404 if the region does not exist.
// ---------------------------------------------------------------------------
router.get('/:id', (req, res, next) => {
  try {
    const regionId = parseInt(req.params.id, 10);

    // Validate that the ID parameter is a valid integer
    if (isNaN(regionId) || regionId <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Region ID must be a positive integer.'
      });
    }

    const db = getDb();
    // Parameterized query using '?' placeholder to prevent SQL injection
    const region = db.prepare('SELECT id, name, population, created_at FROM regions WHERE id = ?').get(regionId);

    if (!region) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Region with ID ${regionId} not found.`
      });
    }

    res.json(region);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/regions
// Create a new region with a name and population.
// Validates inputs and returns HTTP 201 with the created record.
// ---------------------------------------------------------------------------
router.post('/', (req, res, next) => {
  try {
    const { name, population } = req.body || {};

    // Validate that 'name' is provided, is a string, and is not blank
    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        error: 'Validation Error',
        message: "'name' is required and must be a non-empty string."
      });
    }

    // Validate that 'population' is a positive integer
    if (typeof population !== 'number' || !Number.isInteger(population) || population <= 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: "'population' is required and must be a positive integer greater than zero."
      });
    }

    const trimmedName = name.trim();
    const db = getDb();

    // Insert new region using parameterized SQL statement
    const insertStmt = db.prepare('INSERT INTO regions (name, population) VALUES (?, ?)');
    const result = insertStmt.run(trimmedName, population);

    // Fetch the newly created region to return complete record (with id and created_at)
    const newRegion = db
      .prepare('SELECT id, name, population, created_at FROM regions WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(newRegion);
  } catch (error) {
    next(error);
  }
});

export default router;
