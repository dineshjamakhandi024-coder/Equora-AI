import { Router } from 'express';
import { getDb } from '../db/database.js';
import { getInequalityAnalysis } from '../services/inequalityService.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/analytics/inequality
// Analyzes service coverage records to compute regional inequality metrics,
// overall coverage rates, and identifies underserved regions.
// ---------------------------------------------------------------------------
router.get('/inequality', (req, res, next) => {
  try {
    const db = getDb();
    const analysis = getInequalityAnalysis(db);
    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

export default router;
