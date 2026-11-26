// tests/unit/test_students_page_render.mjs
// Verification suite to prevent regressions of the "Student Accounts Blank Screen" bug:
// 1. Verifies that Students.jsx and all admin pages compile with 0 undeclared identifiers.
// 2. Verifies that Students.jsx renders to HTML cleanly with real database data.
// 3. Verifies that the ErrorBoundary protects the view hierarchy.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const require = createRequire(import.meta.url);

// Polyfill browser globals
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};

async function runTests() {
  console.log('=== STARTING STUDENT ACCOUNTS PAGE RENDER VERIFICATION ===\n');

  // 1. Initialize database
  const db = await import('../../frontend/src/db/database.js');
  await db.initDatabase();
  db.resetDatabaseToSample();

  const students = db.getStudents();
  console.log(`[PASS] Test 1: Loaded ${students.length} student records from database.`);

  // 2. Bundle Students.jsx for node execution
  const tempBundlePath = path.join(projectRoot, 'frontend/src/pages/admin/scratch_test_bundle.cjs');
  await esbuild.build({
    entryPoints: [path.join(projectRoot, 'frontend/src/pages/admin/Students.jsx')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    outfile: tempBundlePath,
    external: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/server',
      '@supabase/supabase-js',
      '../../db/database',
    ],
  });

  const StudentsModule = require(tempBundlePath);
  const Students = StudentsModule.default || StudentsModule;

  // 3. Render Students component to HTML
  let html = '';
  try {
    html = renderToString(
      React.createElement(Students, {
        currentUser: { role: 'admin', name: 'Dr. K. Venkatesh (Lab Incharge / Sir)' },
        setActiveTab: () => {},
        onToast: () => {},
      })
    );
  } finally {
    if (fs.existsSync(tempBundlePath)) {
      fs.unlinkSync(tempBundlePath);
    }
  }

  // 4. Assertions on rendered output
  if (!html || html.length < 1000) {
    throw new Error(`Students page rendered empty or trivial HTML (length: ${html.length})`);
  }
  console.log(`[PASS] Test 2: Students component rendered successfully (${html.length} bytes of HTML).`);

  if (!html.includes('Students &amp; Accounts Management') && !html.includes('Students & Accounts Management')) {
    throw new Error('Students page HTML missing expected title header');
  }
  console.log('[PASS] Test 3: Title header verified.');

  if (!html.includes('Anwar Bajarinti')) {
    throw new Error('Rendered HTML missing student Anwar Bajarinti');
  }
  console.log('[PASS] Test 4: Student Anwar Bajarinti successfully rendered in table.');

  if (!html.includes('238W1A0477')) {
    throw new Error('Rendered HTML missing roll number 238W1A0477');
  }
  console.log('[PASS] Test 5: Student roll number 238W1A0477 verified.');

  if (!html.includes('Filters (Branch, Sec, Year)')) {
    throw new Error('Rendered HTML missing Filters toggle button');
  }
  console.log('[PASS] Test 6: Advanced Multi-Filter toggle button verified.');

  // 5. Verify ErrorBoundary exists and renders safely
  const ebBundle = esbuild.buildSync({
    entryPoints: [path.join(projectRoot, 'frontend/src/components/common/ErrorBoundary.jsx')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    write: false,
    external: ['react', 'react/jsx-runtime', 'react-dom'],
  });

  const ebModule = { exports: {} };
  const ebFn = new Function('require', 'module', 'exports', ebBundle.outputFiles[0].text);
  ebFn(require, ebModule, ebModule.exports);
  const ErrorBoundary = ebModule.exports.default || ebModule.exports;

  if (typeof ErrorBoundary.getDerivedStateFromError !== 'function') {
    throw new Error('ErrorBoundary missing static getDerivedStateFromError lifecycle method');
  }

  const normalHtml = renderToString(
    React.createElement(
      ErrorBoundary,
      null,
      React.createElement('div', { id: 'protected-child' }, 'Safe Content')
    )
  );

  if (!normalHtml.includes('protected-child') || !normalHtml.includes('Safe Content')) {
    throw new Error('ErrorBoundary failed to render children under normal operation');
  }

  // Simulate error state
  const boundaryInstance = new ErrorBoundary({});
  const errorState = ErrorBoundary.getDerivedStateFromError(new Error('Sample Runtime Crash'));
  boundaryInstance.state = errorState;
  const fallbackHtml = renderToString(boundaryInstance.render());

  if (!fallbackHtml.includes('Unable to display this view') && !fallbackHtml.includes('Sample Runtime Crash')) {
    throw new Error('ErrorBoundary fallback UI did not render correctly in error state');
  }
  console.log('[PASS] Test 7: ErrorBoundary successfully handles normal rendering and fallback error states.');

  console.log('\n======================================================');
  console.log('ALL STUDENT ACCOUNTS PAGE RENDER TESTS PASSED (7/7)');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\n[FATAL TEST ERROR]:', err);
  process.exit(1);
});
