import { createApp } from './app.js';
import { initDatabase } from './db/database.js';

// ---------------------------------------------------------------------------
// Database Initialization
// ---------------------------------------------------------------------------
// Initialize SQLite database and create tables before listening for requests.
// Any initialization failure is logged explicitly rather than silently ignored.
try {
  initDatabase();
  console.log('SQLite database initialized successfully.');
} catch (error) {
  console.error('Fatal: Failed to initialize SQLite database:', error.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Start the Server
// ---------------------------------------------------------------------------
const app = createApp();
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`EQUORA AI backend is running on http://localhost:${PORT}`);
});
