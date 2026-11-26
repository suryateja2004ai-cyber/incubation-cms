import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { handlePgApiRequest } from '../backend/postgres_service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dev-sw-and-assets-fallback',
      apply: 'serve',
      configureServer(server) {
        // Handle PostgreSQL integration endpoints
        server.middlewares.use(async (req, res, next) => {
          if (
            req.url?.startsWith('/api/auth/') ||
            req.url?.startsWith('/api/projects') ||
            req.url?.startsWith('/api/publications') ||
            req.url?.startsWith('/api/issued-components') ||
            req.url?.startsWith('/api/return-components') ||
            req.url?.startsWith('/api/power-consumption') ||
            req.url?.startsWith('/api/check-overdues') ||
            req.url?.startsWith('/api/overdue-components') ||
            req.url?.startsWith('/api/visitors') ||
            req.url?.startsWith('/api/retention') ||
            req.url?.startsWith('/api/pg/')
          ) {
            try {
              const handled = await handlePgApiRequest(req, res);
              if (handled !== false) return;
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: err.message }));
            }
          }
          next();
        });

        server.middlewares.use((req, res, next) => {
          // 1. If browser requests sw.js in dev mode, serve a self-destruct script with no-cache
          if (req.url === '/sw.js' || req.url?.startsWith('/sw.js?')) {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            return res.end(`
              self.addEventListener('install', () => self.skipWaiting());
              self.addEventListener('activate', (e) => {
                e.waitUntil(
                  caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
                    .then(() => self.registration.unregister())
                    .then(() => self.clients.matchAll({ type: 'window' }))
                    .then((clients) => {
                      for (const client of clients) {
                        if (client.url && 'navigate' in client) {
                          client.navigate(client.url);
                        }
                      }
                    })
                );
              });
            `);
          }

          // 2. If browser requested stale production hashed asset in dev, serve from dist/assets if available
          if (req.url?.startsWith('/assets/')) {
            const assetName = req.url.split('?')[0].replace('/assets/', '');
            const distAssetPath = path.resolve(__dirname, 'dist/assets', assetName);
            if (fs.existsSync(distAssetPath)) {
              const ext = path.extname(distAssetPath);
              const contentType = ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
              res.setHeader('Content-Type', contentType);
              return res.end(fs.readFileSync(distAssetPath));
            }
          }

          next();
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api/auth': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/projects': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/publications': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/issued-components': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/return-components': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/power-consumption': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/check-overdues': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/overdue-components': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/pg': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/face': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (!res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'offline', error: 'Face recognition service is offline' }));
            }
          });
        },
      },
    },
  },
})
