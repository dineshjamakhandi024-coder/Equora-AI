import { Router } from 'express';
import { getDb } from '../db/database.js';
import { getResourceAllocation } from '../services/allocationService.js';

const router = Router();

// ---------------------------------------------------------------------------
// Handler for POST /api/allocation and POST /api/allocation/recommend
// Computes and returns fair resource allocation recommendations under a budget.
// ---------------------------------------------------------------------------
const handleAllocation = (req, res, next) => {
  try {
    const { budget_units } = req.body || {};

    // Validate that budget_units is provided and is a non-negative integer
    if (
      budget_units === undefined ||
      typeof budget_units !== 'number' ||
      !Number.isInteger(budget_units) ||
      budget_units < 0
    ) {
      return res.status(400).json({
        error: 'Validation Error',
        message: "'budget_units' is required and must be a non-negative integer (0 or greater)."
      });
    }

    const db = getDb();
    const result = getResourceAllocation(db, budget_units);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

router.post('/', handleAllocation);
router.post('/recommend', handleAllocation);

export default router;
