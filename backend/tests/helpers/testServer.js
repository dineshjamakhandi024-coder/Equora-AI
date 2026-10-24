import { createApp } from '../../src/app.js';
import { initDatabase, closeDb, getDb } from '../../src/db/database.js';

/**
 * Creates and starts an isolated test server using an in-memory SQLite database
 * and an ephemeral OS port (port 0) to avoid any collision with running dev servers.
 */
export function setupTestApp() {
  let server = null;
  let baseUrl = '';

  return {
    async start() {
      // Initialize fresh in-memory database (:memory:)
      initDatabase(':memory:');

      const app = createApp();

      // Listen on ephemeral port 0 (OS dynamically assigns a free port)
      await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const address = server.address();
          baseUrl = `http://127.0.0.1:${address.port}`;
          resolve();
        });
      });
    },

    async stop() {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
        server = null;
      }
      closeDb();
    },

    getDbInstance() {
      return getDb();
    },

    async request(urlPath, options = {}) {
      const url = `${baseUrl}${urlPath}`;
      const fetchOptions = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      };

      if (options.body) {
        fetchOptions.body =
          typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body);
      }

      const res = await fetch(url, fetchOptions);
      const text = await res.text();
      let body = null;
      try {
        body = JSON.parse(text);
      } catch (_) {
        body = text;
      }

      return {
        status: res.status,
        headers: res.headers,
        body
      };
    }
  };
}
