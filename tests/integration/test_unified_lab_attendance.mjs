// tests/integration/test_unified_lab_attendance.mjs
// Verification suite for Unified Automatic Lab Attendance and End-of-Day Auto Checkout

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock localStorage for Node.js test environment
const mockStorage = new Map();
const mockLocalStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

try {
  globalThis.localStorage = mockLocalStorage;
} catch {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });
}

// Import database functions after localStorage is available
const dbPath = path.resolve(__dirname, '../../frontend/src/db/database.js');
const db = await import(`file://${dbPath}`);

// Initialize in-memory database with sample data
await db.resetDatabaseToSample();

console.log('=== Starting Unified Automatic Lab Attendance Test Suite ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// Test 1: Invariant Check for Protected Files
// -----------------------------------------------------------------------------
runTest('Invariant Check: sampleData.js and data_base_backup.js sizes are preserved', () => {
  const sampleDataPath = path.resolve(__dirname, '../../frontend/src/db/sampleData.js');
  const backupPath = path.resolve(__dirname, '../../frontend/src/db/data_base_backup.js');

  const sampleSize = fs.statSync(sampleDataPath).size;
  const backupSize = fs.statSync(backupPath).size;

  assert.equal(sampleSize, 22676, `sampleData.js size must be 22676, got ${sampleSize}`);
  assert.equal(backupSize, 61794, `data_base_backup.js size must be 61794, got ${backupSize}`);
});

// -----------------------------------------------------------------------------
// Test 2: Unregistered Student Throws Error
// -----------------------------------------------------------------------------
await runAsyncTest('Invalid / unregistered student throws informative error', async () => {
  await assert.rejects(
    async () => {
      await db.toggleLabAttendance('999NONEXISTENT', 'face');
    },
    /not registered/i
  );
});

// -----------------------------------------------------------------------------
// Test 3: Registered Student (Outside) -> Toggles to ENTRY
// -----------------------------------------------------------------------------
let testStudentRoll = '238W1A0477'; // Anwar Bajarinti from seed data

await runAsyncTest('Outside student toggleLabAttendance -> Records LAB ENTRY', async () => {
  // Ensure student starts outside
  const activeBefore = db.getStudentActiveVisit(testStudentRoll);
  if (activeBefore) {
    await db.toggleLabAttendance(testStudentRoll, 'manual');
  }

  const initialCount = db.getStudentsCurrentlyInside().length;
  const result = await db.toggleLabAttendance(testStudentRoll, 'Face Recognition');

  assert.equal(result.success, true);
  assert.equal(result.action, 'ENTRY');
  assert.equal(result.status, 'inside');
  assert.equal(result.student.rollNumber, testStudentRoll);
  assert.ok(result.visit.id);
  assert.equal(result.visit.status, 'inside');
  assert.equal(result.visit.exitTime, null);
  assert.equal(result.visit.entryMethod, 'Face Recognition');

  const activeAfter = db.getStudentActiveVisit(testStudentRoll);
  assert.ok(activeAfter, 'Active visit must exist');
  assert.equal(activeAfter.id, result.visit.id);

  const newInsideCount = db.getStudentsCurrentlyInside().length;
  assert.equal(newInsideCount, initialCount + 1, 'Inside count must increase by 1');
});

// -----------------------------------------------------------------------------
// Test 4: Student (Inside) -> Toggles to EXIT
// -----------------------------------------------------------------------------
await runAsyncTest('Inside student toggleLabAttendance -> Records LAB EXIT', async () => {
  const initialCount = db.getStudentsCurrentlyInside().length;
  const result = await db.toggleLabAttendance(testStudentRoll, 'Face Recognition');

  assert.equal(result.success, true);
  assert.equal(result.action, 'EXIT');
  assert.equal(result.status, 'completed');
  assert.equal(result.student.rollNumber, testStudentRoll);
  assert.ok(result.visit.exitTime, 'Exit time must be populated');
  assert.equal(result.visit.status, 'completed');
  assert.ok(result.durationFormatted !== undefined, 'Duration formatted must exist');

  const activeAfter = db.getStudentActiveVisit(testStudentRoll);
  assert.equal(activeAfter, null, 'Active visit must no longer exist');

  const newInsideCount = db.getStudentsCurrentlyInside().length;
  assert.equal(newInsideCount, initialCount - 1, 'Inside count must decrease by 1');
});

// -----------------------------------------------------------------------------
// Test 5: Re-entry on Same Day (Multiple Sessions)
// -----------------------------------------------------------------------------
await runAsyncTest('Student can enter and exit multiple times on the same day', async () => {
  // Session 2 Entry
  const resEntry2 = await db.toggleLabAttendance(testStudentRoll, 'manual');
  assert.equal(resEntry2.action, 'ENTRY');
  assert.equal(resEntry2.status, 'inside');
  assert.equal(resEntry2.visit.entryMethod, 'Manual Roll Number');

  // Session 2 Exit
  const resExit2 = await db.toggleLabAttendance(testStudentRoll, 'manual');
  assert.equal(resExit2.action, 'EXIT');
  assert.equal(resExit2.status, 'completed');
  assert.equal(resExit2.visit.exitMethod, 'Manual Roll Number');

  assert.equal(db.getStudentActiveVisit(testStudentRoll), null);
});

// -----------------------------------------------------------------------------
// Test 6: Lab Operating Hours Settings Default & Customization
// -----------------------------------------------------------------------------
await runAsyncTest('Lab timings settings are configurable and persist', async () => {
  const currentSettings = db.getSettings();
  assert.ok(currentSettings.labTimings, 'labTimings must exist in settings');
  assert.ok(currentSettings.labTimings.openingTime);
  assert.ok(currentSettings.labTimings.closingTime);

  // Update timings
  await db.updateSettings({
    labTimings: {
      openingTime: '08:30',
      closingTime: '17:30',
      autoCheckoutEnabled: true,
      timezone: 'Asia/Kolkata',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
  });

  const updatedSettings = db.getSettings();
  assert.equal(updatedSettings.labTimings.openingTime, '08:30');
  assert.equal(updatedSettings.labTimings.closingTime, '17:30');
  assert.deepEqual(updatedSettings.labTimings.workingDays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
});

// -----------------------------------------------------------------------------
// Test 7: Automatic End-of-Day Checkout
// -----------------------------------------------------------------------------
await runAsyncTest('Automatic End-of-Day Checkout closes all active visits', async () => {
  // Enter two students into lab
  const student1 = '238W1A0477';
  const student2 = '238W1A0412'; // Second registered student (Kavya Sharma)

  // Ensure both are inside
  const active1 = db.getStudentActiveVisit(student1);
  if (!active1) await db.toggleLabAttendance(student1, 'face');

  const active2 = db.getStudentActiveVisit(student2);
  if (!active2) await db.toggleLabAttendance(student2, 'face');

  const insideBefore = db.getStudentsCurrentlyInside();
  assert.ok(insideBefore.length >= 2, 'At least 2 students inside before checkout');

  // Trigger end of day auto-checkout
  const checkoutResult = await db.executeAutoEndOfDayCheckout({ forceNow: true });
  assert.equal(checkoutResult.success, true);
  assert.ok(checkoutResult.closedCount >= 2, 'Closed count should match active count');

  // Verify all inside visits are now closed
  const insideAfter = db.getStudentsCurrentlyInside();
  assert.equal(insideAfter.length, 0, 'Active inside count must be exactly 0 after checkout');

  // Verify the closed visits have exitMethod === "automatic_end_of_day"
  const allVisits = db.getLabVisits();
  const v1 = allVisits.find((v) => v.studentRoll === student1 && v.isAutoClosed);
  assert.ok(v1, 'Student 1 visit must be auto-closed');
  assert.equal(v1.exitMethod, 'automatic_end_of_day');
  assert.equal(v1.status, 'completed');
  assert.ok(v1.exitTime);
});

// -----------------------------------------------------------------------------
// Test 8: End-of-Day Checkout Idempotency
// -----------------------------------------------------------------------------
await runAsyncTest('End-of-day checkout is idempotent (subsequent run closes 0)', async () => {
  const secondRun = await db.executeAutoEndOfDayCheckout({ forceNow: true });
  assert.equal(secondRun.success, true);
  assert.equal(secondRun.closedCount, 0, 'Subsequent checkout on 0 active visits must close 0');
});

// -----------------------------------------------------------------------------
// Test 9: Visits Feed Filtering & Presentation
// -----------------------------------------------------------------------------
runTest('All visits retain audit trail with status and duration', () => {
  const visits = db.getLabVisits();
  assert.ok(Array.isArray(visits));
  assert.ok(visits.length > 0);
  for (const v of visits.slice(0, 5)) {
    assert.ok(v.id);
    assert.ok(v.studentRoll);
    assert.ok(v.studentName);
    assert.ok(v.entryTime);
    assert.ok(['inside', 'completed'].includes(v.status));
  }
});

console.log(`\n=== All ${passedTests} / ${totalTests} Tests Passed Successfully! ===`);
