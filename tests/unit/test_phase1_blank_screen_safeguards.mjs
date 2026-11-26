// tests/unit/test_phase1_blank_screen_safeguards.mjs
// Automated verification suite for Phase 1: Permanent Zero-Blank Screen Safeguards

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

console.log('🧪 Starting Phase 1 Permanent Blank-Screen Safeguards Test Suite...\n');

let testsPassed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

async function runAll() {
  // 1. Service Worker Development Bypass Inspection
  await test('sw.js completely isolates dev hosts and attaches fetch listener ONLY in production', () => {
    const swPath = path.join(projectRoot, 'frontend/public/sw.js');
    const swContent = fs.readFileSync(swPath, 'utf8');

    assert.ok(swContent.includes('const isDevHost ='), 'Must declare isDevHost condition');
    assert.ok(swContent.includes('localhost'), 'isDevHost must check localhost');
    assert.ok(swContent.includes('127.0.0.1'), 'isDevHost must check 127.0.0.1');

    // Confirm that the dev branch unregisters and deletes caches
    const devBranch = swContent.split('} else {')[0];
    const prodBranch = swContent.split('} else {')[1];

    assert.ok(devBranch.includes('self.registration.unregister()'), 'Dev branch must unregister');
    assert.ok(devBranch.includes('caches.delete'), 'Dev branch must delete caches');
    assert.ok(!devBranch.includes("self.addEventListener('fetch'"), 'Dev branch must NEVER attach fetch listener');

    assert.ok(prodBranch.includes("self.addEventListener('fetch'"), 'Prod branch must attach fetch listener');
    assert.ok(prodBranch.includes('CACHE_NAME'), 'Prod branch must preserve PWA caching');
  });

  // 2. HTML Diagnostic Watchdog & Controlled Server Recovery
  await test('index.html contains capture-phase error listener, unhandled rejection shield, and diagnostic card', () => {
    const htmlPath = path.join(projectRoot, 'frontend/index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(htmlContent.includes("window.addEventListener('error'"), 'Must contain error listener');
    assert.ok(htmlContent.includes(', true);'), 'Error listener must use capture phase (true) to intercept script loading errors');
    assert.ok(htmlContent.includes("window.addEventListener('unhandledrejection'"), 'Must contain unhandledrejection listener');
    assert.ok(htmlContent.includes('showDiagnosticCard'), 'Must define showDiagnosticCard');
    assert.ok(htmlContent.includes('Check Connection & Reconnect'), 'Must provide manual reconnect check');
    assert.ok(htmlContent.includes('Reset Cache & Reload'), 'Must provide storage reset button');
    assert.ok(htmlContent.includes('maxPings = 5'), 'Controlled ping must have strict upper bound to prevent infinite reload loops');
  });

  // 3. Main Entry Mount Safety
  await test('main.jsx wraps ReactDOM root mounting in try/catch with diagnostic fallback', () => {
    const mainPath = path.join(projectRoot, 'frontend/src/main.jsx');
    const mainContent = fs.readFileSync(mainPath, 'utf8');

    assert.ok(mainContent.includes('try {'), 'main.jsx must wrap mount in try block');
    assert.ok(mainContent.includes('catch (mountErr) {'), 'main.jsx must catch mount errors');
    assert.ok(mainContent.includes('delete rootEl.dataset.isDiagnostic;'), 'main.jsx must clear pre-mount diagnostic flag');
    assert.ok(mainContent.includes('System Initialization Notice'), 'main.jsx must provide initialization fallback UI');
  });

  // 4. Date Formatter Standardization & RangeError Immunity
  await test('dateFormatter utility standardizes to DD-MM-YYYY and is 100% immune to invalid values', async () => {
    const { formatDisplayDate, formatDisplayDateTime, isValidDate, safeIsoDate } = await import('../../frontend/src/utils/dateFormatter.js');

    // Valid ISO Date
    const isoDate = '2026-11-07T08:04:51.000Z';
    const formatted = formatDisplayDate(isoDate);
    assert.strictEqual(formatted, '07-11-2026', `Expected 07-11-2026, got ${formatted}`);

    // Valid Date object
    const dObj = new Date(2026, 8, 5); // 5th September 2026
    assert.strictEqual(formatDisplayDate(dObj), '05-09-2026');

    // Invalid dates must NOT throw RangeError: Invalid time value
    assert.strictEqual(formatDisplayDate(null), '-');
    assert.strictEqual(formatDisplayDate(undefined), '-');
    assert.strictEqual(formatDisplayDate(''), '-');
    assert.strictEqual(formatDisplayDate('not-a-valid-date'), '-');
    assert.strictEqual(formatDisplayDate(NaN), '-');

    // Date-Time formatting
    const dt = formatDisplayDateTime(isoDate);
    assert.ok(dt.startsWith('07-11-2026, '), `Expected DD-MM-YYYY date-time prefix, got ${dt}`);

    // safeIsoDate
    assert.strictEqual(safeIsoDate(dObj), '2026-09-05');
    assert.strictEqual(safeIsoDate('invalid'), null);
    assert.strictEqual(isValidDate('2026-11-07'), true);
    assert.strictEqual(isValidDate('invalid'), false);
  });

  // 5. Corrupted Storage & Student Streak Safety in database.js
  await test('database.js gracefully handles corrupted storage and invalid visit dates without throwing', async () => {
    const mockStorage = new Map();
    mockStorage.set('inc_cms_current_auth_session', '{"corrupted":true}');
    mockStorage.set('inc_cms_visits_v2', JSON.stringify([
      { id: 'v-1', studentRoll: '238W1A0477', entryTime: 'INVALID_DATE_STRING', status: 'completed' },
      { id: 'v-2', studentRoll: '238W1A0477', entryTime: null, status: 'inside' },
      { id: 'v-3', studentRoll: '238W1A0477', entryTime: new Date().toISOString(), status: 'completed', durationMinutes: 45 }
    ]));

    globalThis.localStorage = {
      getItem: (k) => mockStorage.get(k) || null,
      setItem: (k, v) => mockStorage.set(k, String(v)),
      removeItem: (k) => mockStorage.delete(k),
      clear: () => mockStorage.clear(),
    };

    const db = await import('../../frontend/src/db/database.js');
    await db.initDatabase();

    // Streak calculation on visits containing invalid date must NOT throw RangeError
    const streak = db.calculateStudentStreak('238W1A0477');
    assert.ok(typeof streak === 'number', 'Streak must return a valid number');

    // getStudentPersonalStats on student with invalid visit dates must NOT throw
    const personal = db.getStudentPersonalStats('238W1A0477');
    assert.ok(personal && personal.student, 'Must return valid personal stats structure');
    assert.strictEqual(personal.student.rollNumber, '238W1A0477');

    // Unknown student roll must synthesize safe user instead of returning null and hanging
    const unknown = db.getStudentPersonalStats('UNKNOWN_STUDENT_999');
    assert.ok(unknown && unknown.student, 'Must synthesize valid student object for unknown roll');
    assert.strictEqual(unknown.student.rollNumber, 'UNKNOWN_STUDENT_999');
  });

  // 6. Invariant Byte Sizes for Protected Files
  await test('Protected files remain exact byte sizes (sampleData.js = 22676, data_base_backup.js = 61794)', () => {
    const sampleDataPath = path.join(projectRoot, 'frontend/src/db/sampleData.js');
    const backupPath = path.join(projectRoot, 'frontend/src/db/data_base_backup.js');

    const sampleSize = fs.statSync(sampleDataPath).size;
    const backupSize = fs.statSync(backupPath).size;

    assert.strictEqual(sampleSize, 22676, `sampleData.js size must be 22676 bytes, found ${sampleSize}`);
    assert.strictEqual(backupSize, 61794, `data_base_backup.js size must be 61794 bytes, found ${backupSize}`);
  });

  console.log(`\n🎉 All ${testsPassed}/${testsPassed} Phase 1 Blank-Screen Safeguard tests passed successfully!`);
}

runAll().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
