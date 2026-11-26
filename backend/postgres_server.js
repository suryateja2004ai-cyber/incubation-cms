// backend/postgres_server.js
// Standalone lightweight HTTP server for Incubation CMS PostgreSQL Integration
import http from 'http';
import { handlePgApiRequest } from './postgres_service.js';

const PORT = process.env.PG_API_PORT || 3001;

const server = http.createServer(async (req, res) => {
  const handled = await handlePgApiRequest(req, res);
  if (handled === false) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[PostgreSQL API Server] Running on http://127.0.0.1:${PORT}`);
  console.log(`[PostgreSQL API Server] Connected to database: incubation_cms`);
});
