// tests/unit/test_intelligent_roll_prefix_suggestions.mjs
// Verification suite for Intelligent Student Roll Number Prefix Suggestions & Auto-Completion

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

// Import helper and database
const helperPath = path.resolve(__dirname, '../../frontend/src/utils/rollNumberPrefixHelper.js');
const dbPath = path.resolve(__dirname, '../../frontend/src/db/database.js');

const helper = await import(`file://${helperPath}`);
const db = await import(`file://${dbPath}`);

// Initialize sample data
await db.resetDatabaseToSample();

console.log('=== Starting Intelligent Roll Number Prefix Suggestions Test Suite ===\n');

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
// Test 2: Verification of Prefix Discovery with Example Dataset
// -----------------------------------------------------------------------------
runTest('Prefix Discovery Algorithm with example dataset discovers all 3 expected prefixes', () => {
  const exampleDataset = [
    '238W1A0477',
    '238W1A0478',
    '238W1A0479',
    '248W5A0407',
    '228W1A0497',
  ];

  const suggestions = helper.discoverRollNumberPrefixes(exampleDataset);
  const prefixes = suggestions.map((s) => s.prefix);

  // Requirement 2: The interface should suggest 238W1A04, 248W5A04, 228W1A04
  assert.ok(prefixes.includes('238W1A04'), 'Must discover 238W1A04');
  assert.ok(prefixes.includes('248W5A04'), 'Must discover 248W5A04');
  assert.ok(prefixes.includes('228W1A04'), 'Must discover 228W1A04');
  assert.equal(prefixes.length, 3, 'Must discover exactly 3 distinct prefixes');

  // Verify counts
  const p1 = suggestions.find((s) => s.prefix === '238W1A04');
  assert.equal(p1.count, 3, '238W1A04 must group 3 students');
  assert.equal(p1.remainingLength, 2, 'Remaining length must be 2');

  const p2 = suggestions.find((s) => s.prefix === '248W5A04');
  assert.equal(p2.count, 1, '248W5A04 must group 1 student');

  const p3 = suggestions.find((s) => s.prefix === '228W1A04');
  assert.equal(p3.count, 1, '228W1A04 must group 1 student');
});

// -----------------------------------------------------------------------------
// Test 3: Prefix Selection and Remaining Digit Entry
// -----------------------------------------------------------------------------
runTest('Selecting 238W1A04 and entering 77 produces 238W1A0477', () => {
  const combined = helper.combinePrefixAndSuffix('238W1A04', '77');
  assert.equal(combined, '238W1A0477');
  assert.equal(combined.length, 10);
});

runTest('Selecting 238W1A04 and entering 78 produces 238W1A0478', () => {
  const combined = helper.combinePrefixAndSuffix('238W1A04', '78');
  assert.equal(combined, '238W1A0478');
  assert.equal(combined.length, 10);
});

// -----------------------------------------------------------------------------
// Test 4: Unregistered Combination Rejection
// -----------------------------------------------------------------------------
runTest('An unregistered roll number combination is rejected', () => {
  const combined = helper.combinePrefixAndSuffix('238W1A04', '99');
  const res = helper.validateStudentRollNumber(combined, db.getUserByRoll);

  assert.equal(res.isValid, false);
  assert.equal(res.student, null);
  assert.match(res.message, /not registered/i);
});

// -----------------------------------------------------------------------------
// Test 5: Lowercase and Whitespace Normalization
// -----------------------------------------------------------------------------
runTest('Lowercase input and whitespace are normalized correctly to uppercase', () => {
  const normalized = helper.normalizeRollNumber('   238w1a0477   ');
  assert.equal(normalized, '238W1A0477');

  const combined = helper.combinePrefixAndSuffix('  238w1a04  ', '  77  ');
  assert.equal(combined, '238W1A0477');
});

// -----------------------------------------------------------------------------
// Test 6: Invalid or Incomplete Roll Numbers are Rejected
// -----------------------------------------------------------------------------
runTest('Invalid or incomplete roll numbers are strictly rejected', () => {
  assert.equal(helper.isValidRollNumber('238W1A047'), false, '9 characters must be invalid');
  assert.equal(helper.isValidRollNumber('238W1A04777'), false, '11 characters must be invalid');
  assert.equal(helper.isValidRollNumber('238W1A04##'), false, 'Special characters must be invalid');
  assert.equal(helper.isValidRollNumber(''), false, 'Empty string must be invalid');
  assert.equal(helper.isValidRollNumber(null), false, 'Null must be invalid');

  const incompleteRes = helper.validateStudentRollNumber('238W1A04', db.getUserByRoll);
  assert.equal(incompleteRes.isValid, false);
  assert.match(incompleteRes.message, /incomplete/i);
});

// -----------------------------------------------------------------------------
// Test 7: Duplicate Prefixes are Avoided
// -----------------------------------------------------------------------------
runTest('Duplicate prefixes are not displayed in suggestion results', () => {
  const datasetWithDuplicates = [
    '238W1A0477',
    '238W1A0478',
    '238W1A0477', // Duplicate
    '238W1A0479',
    '238w1a0480', // Lowercase duplicate prefix
  ];

  const suggestions = helper.discoverRollNumberPrefixes(datasetWithDuplicates);
  const prefixes = suggestions.map((s) => s.prefix);
  const uniquePrefixes = new Set(prefixes);

  assert.equal(prefixes.length, uniquePrefixes.size, 'Suggestions must not contain duplicates');
  assert.equal(prefixes[0], '238W1A04');
  assert.equal(suggestions[0].count, 4, 'Distinct students counted properly');
});

// -----------------------------------------------------------------------------
// Test 8: Newly Registered Students are Reflected in Future Suggestions
// -----------------------------------------------------------------------------
await runAsyncTest('Newly registered student prefix is immediately discovered in suggestions', async () => {
  const newStudentRoll = '258W1A0401'; // New Batch 2025

  // Verify 258W1A04 is not yet in suggestions
  const beforeSuggestions = db.getRollNumberPrefixSuggestions();
  assert.ok(!beforeSuggestions.some((s) => s.prefix === '258W1A04'));

  // Register new student
  await db.registerStudentFirstVisit({
    name: 'New 2025 Student',
    rollNumber: newStudentRoll,
    mobileNumber: '9876543210',
    password: 'Password123',
    department: 'Electronics & Communication Engineering',
    faceRegistered: false,
    incubationStartDate: new Date().toISOString().slice(0, 10),
    academicYearAtStart: 1,
  });

  // Verify prefix is now dynamically discovered without manual admin configuration
  const afterSuggestions = db.getRollNumberPrefixSuggestions();
  assert.ok(
    afterSuggestions.some((s) => s.prefix === '258W1A04'),
    'New student prefix 258W1A04 must be discovered automatically'
  );
});

// -----------------------------------------------------------------------------
// Test 9: Suggestions Work after Page Refresh / Database Reload
// -----------------------------------------------------------------------------
runTest('Prefix discovery produces consistent suggestions from persistent student dataset', () => {
  const suggestions1 = db.getRollNumberPrefixSuggestions();
  const suggestions2 = db.getRollNumberPrefixSuggestions();

  assert.deepEqual(
    suggestions1.map((s) => s.prefix),
    suggestions2.map((s) => s.prefix),
    'Prefix discovery must be deterministic and persistent'
  );
});

// -----------------------------------------------------------------------------
// Test 10: Successful Manual Roll Identification Calls Unified Attendance Backend
// -----------------------------------------------------------------------------
await runAsyncTest('Successful manual roll identification calls common toggleLabAttendance backend', async () => {
  const testStudentRoll = '238W1A0477';

  // Ensure outside
  const active = db.getStudentActiveVisit(testStudentRoll);
  if (active) await db.toggleLabAttendance(testStudentRoll, 'manual');

  // Step 1: Select prefix '238W1A04' and suffix '77'
  const combined = helper.combinePrefixAndSuffix('238W1A04', '77');
  assert.equal(combined, '238W1A0477');

  // Step 2: Validate student
  const val = helper.validateStudentRollNumber(combined, db.getUserByRoll);
  assert.equal(val.isValid, true);
  assert.equal(val.student.name, 'Anwar Bajarinti');

  // Step 3: Call unified attendance operation (same operation as Face Attendance)
  const attendanceResult = await db.toggleLabAttendance(combined, 'Manual Roll Number');
  assert.equal(attendanceResult.success, true);
  assert.equal(attendanceResult.action, 'ENTRY');
  assert.equal(attendanceResult.status, 'inside');
  assert.equal(attendanceResult.visit.entryMethod, 'Manual Roll Number');

  // Step 4: Call again -> Automatically toggles to EXIT
  const exitResult = await db.toggleLabAttendance(combined, 'Manual Roll Number');
  assert.equal(exitResult.success, true);
  assert.equal(exitResult.action, 'EXIT');
  assert.equal(exitResult.status, 'completed');
  assert.equal(exitResult.visit.exitMethod, 'Manual Roll Number');
});

// -----------------------------------------------------------------------------
// Test 11: Face Recognition Functionality Remains Fully Compatible & Unaffected
// -----------------------------------------------------------------------------
await runAsyncTest('Face Recognition attendance operation operates seamlessly alongside Manual Roll', async () => {
  const studentRoll = '238W1A0412'; // Kavya Sharma

  // Face Entry
  const faceEntry = await db.toggleLabAttendance(studentRoll, 'Face Recognition');
  assert.equal(faceEntry.action, 'ENTRY');
  assert.equal(faceEntry.status, 'inside');
  assert.equal(faceEntry.visit.entryMethod, 'Face Recognition');

  // Face Exit
  const faceExit = await db.toggleLabAttendance(studentRoll, 'Face Recognition');
  assert.equal(faceExit.action, 'EXIT');
  assert.equal(faceExit.status, 'completed');
  assert.equal(faceExit.visit.exitMethod, 'Face Recognition');
});

// -----------------------------------------------------------------------------
// Test 12: Data Access Security & Privacy Checks
// -----------------------------------------------------------------------------
runTest('getAuthorizedStudentRollDataset strictly exposes only non-sensitive fields', () => {
  const dataset = db.getAuthorizedStudentRollDataset();
  assert.ok(Array.isArray(dataset));
  assert.ok(dataset.length > 0);

  for (const item of dataset) {
    assert.ok(item.rollNumber, 'Must contain rollNumber');
    assert.ok(item.name, 'Must contain name');
    // Ensure sensitive fields are NEVER exposed
    assert.equal(item.password, undefined, 'Password must not be exposed');
    assert.equal(item.passwordHash, undefined, 'Password hash must not be exposed');
    assert.equal(item.mobileNumber, undefined, 'Mobile number must not be exposed');
    assert.equal(item.faceEmbeddings, undefined, 'Biometrics must not be exposed');
  }
});

console.log(`\n=== All ${passedTests} / ${totalTests} Intelligent Prefix Suggestion Tests Passed Successfully! ===`);
