// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import ErrorBoundary from './components/common/ErrorBoundary';
import './styles/index.css';

// Register PWA Service Worker in production; unregister in development to avoid caching dev assets
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // SW registered in production
        })
        .catch((err) => {
          console.warn('[PWA] ServiceWorker registration failed:', err);
        });
    });
  } else {
    // In local development, unregister any active service worker to prevent stale dev caching
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
}

try {
  const rootEl = document.getElementById('root');
  if (rootEl) {
    delete rootEl.dataset.isDiagnostic;
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <ErrorBoundary title="System Initialization Notice">
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  }
} catch (mountErr) {
  console.error('[Fatal Mount Error]:', mountErr);
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;padding:1.5rem;font-family:system-ui,-apple-system,sans-serif;">' +
        '<div style="max-width:520px;width:100%;background:#ffffff;border-radius:12px;padding:2rem;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.08);border:1px solid #fee2e2;">' +
          '<div style="width:48px;height:48px;border-radius:50%;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:22px;font-weight:bold;">!</div>' +
          '<h2 style="font-size:1.25rem;font-weight:800;color:#0f172a;margin-bottom:0.5rem;">System Initialization Notice</h2>' +
          '<p style="font-size:0.9rem;color:#64748b;margin-bottom:1.5rem;line-height:1.5;">' + (mountErr && mountErr.message ? mountErr.message : 'A client-side initialization event occurred.') + '</p>' +
          '<button onclick="localStorage.clear();sessionStorage.clear();window.location.reload(true);" style="background:#4f46e5;color:#fff;border:none;padding:0.75rem 1.5rem;border-radius:8px;font-weight:700;cursor:pointer;">Reset Storage & Reload</button>' +
        '</div>' +
      '</div>';
  }
}
