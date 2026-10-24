import express from 'express';
import regionsRouter from './routes/regions.js';
import serviceCoverageRouter from './routes/serviceCoverage.js';
import analyticsRouter from './routes/analytics.js';
import allocationRouter from './routes/allocation.js';

/**
 * Creates and configures the Express application.
 * Separating app creation from server startup enables isolated testing
 * without port conflicts or side effects.
 *
 * @returns {express.Application} Configured Express app
 */
export function createApp() {
  const app = express();

  // ---------------------------------------------------------------------------
  // Middleware
  // ---------------------------------------------------------------------------
  app.use(express.json());

  // ---------------------------------------------------------------------------
  // Core Routes
  // ---------------------------------------------------------------------------
  // Root route: Welcome message for EQUORA AI
  app.get('/', (req, res) => {
    res.json({
      project: 'EQUORA AI',
      tagline: 'Intelligence That Leaves No One Behind',
      message: 'Welcome to the EQUORA AI backend API',
      status: 'online'
    });
  });

  // Health check route: System health and project info
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      project: 'EQUORA AI',
      timestamp: new Date().toISOString()
    });
  });

  // ---------------------------------------------------------------------------
  // Resource Routes
  // ---------------------------------------------------------------------------
  app.use('/api/regions', regionsRouter);
  app.use('/api/service-coverage', serviceCoverageRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/allocation', allocationRouter);
  app.use('/api/allocations', allocationRouter);

  // ---------------------------------------------------------------------------
  // 404 Fallback Middleware
  // ---------------------------------------------------------------------------
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.originalUrl}`
    });
  });

  // ---------------------------------------------------------------------------
  // Centralized Error-Handling Middleware
  // ---------------------------------------------------------------------------
  app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);

    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
      error: err.name || 'Internal Server Error',
      message: err.message || 'An unexpected error occurred'
    });
  });

  return app;
}

export default createApp;
