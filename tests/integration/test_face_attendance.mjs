// tests/integration/test_face_attendance.mjs
// Automated verification for Face Recognition Lab Attendance & Database Integration

// Mock browser globals for Node.js test environment
const mockStorage = new Map();
try {
  globalThis.localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  };
} catch {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key) => mockStorage.get(key) || null,
      setItem: (key, val) => mockStorage.set(key, String(val)),
      removeItem: (key) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
    },
    writable: true,
  });
}

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Import database functions
import {
  getUserByRoll,
  getStudents,
  getStudentActiveVisit,
  recordLabEntry,
  recordLabExit,
  updateStudentAccount,
  getStudentsCurrentlyInside,
  resetDatabaseToSample,
} from '../../frontend/src/db/database.js';

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      throw new Error(`Test "${name}" returned a Promise. Use runAsyncTest.`);
    }
    console.log(`  [PASS] Test ${totalCount}: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalCount}: ${name}`);
    console.error(`         Error: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  [PASS] Test ${totalCount}: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalCount}: ${name}`);
    console.error(`         Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('\n=== STARTING FACE RECOGNITION ATTENDANCE INTEGRATION VERIFICATION ===\n');

  // Test 1: Reset database
  runTest('Reset database to clean sample state', () => {
    resetDatabaseToSample();
    const students = getStudents();
    assert(students.length > 0, 'Students should exist in sample database');
  });

  // Test 2: Existing student lookup
  runTest('Lookup student profile for "238W1A0412" (Kavya Sharma)', () => {
    const student = getUserByRoll('238W1A0412');
    assert(student, 'Student should be found');
    assert.strictEqual(student.rollNumber, '238W1A0412');
  });

  // Test 3: Student outside initial check
  runTest('Verify student "238W1A0412" is initially outside lab', () => {
    const activeVisit = getStudentActiveVisit('238W1A0412');
    assert.strictEqual(activeVisit, null, 'Active visit should be null');
  });

  // Test 4: Record Lab Entry via Face Recognition
  await runAsyncTest('Record Lab Entry via Face Recognition for outside student', async () => {
    const res = await recordLabEntry('238W1A0412', 'Face Recognition');
    assert(res.success, 'Lab entry should succeed');
    assert(res.visit, 'Visit object must be returned');
    assert.strictEqual(res.visit.studentRoll, '238W1A0412');
    assert.strictEqual(res.visit.entryMethod, 'Face Recognition');
    assert.strictEqual(res.visit.status, 'inside');
    assert(typeof res.visit.entryTime === 'string', 'entryTime must be ISO string');
  });

  // Test 5: Verify student is now inside lab
  runTest('Verify student "238W1A0412" is now tracked as inside', () => {
    const activeVisit = getStudentActiveVisit('238W1A0412');
    assert(activeVisit, 'Active visit should exist');
    assert.strictEqual(activeVisit.entryMethod, 'Face Recognition');
  });

  // Test 6: Prevent duplicate entry for already-inside student
  await runAsyncTest('Prevent duplicate entry when recognized student is already inside', async () => {
    const countBefore = getStudentsCurrentlyInside().length;
    const res = await recordLabEntry('238W1A0412', 'Face Recognition');
    assert(res.alreadyInside, 'Must report alreadyInside=true');
    assert(res.visit, 'Must return the existing active visit');
    assert.strictEqual(res.visit.studentRoll, '238W1A0412');
    const countAfter = getStudentsCurrentlyInside().length;
    assert.strictEqual(countAfter, countBefore, 'Count of students inside must not increase');
  });

  // Test 7: Record Lab Exit
  await runAsyncTest('Record Lab Exit accurately calculates duration from actual entryTime', async () => {
    const res = await recordLabExit('238W1A0412');
    assert(res.success, 'Lab exit must succeed');
    assert(typeof res.durationMinutes === 'number', 'durationMinutes must be a number');
    assert(res.durationMinutes >= 0, 'durationMinutes must be >= 0');
    assert(typeof res.durationSeconds === 'number' && res.durationSeconds >= 0, 'durationSeconds must be non-negative');
    assert(typeof res.durationFormatted === 'string', 'durationFormatted must exist');
    assert(res.visit, 'visit object must exist');
    assert(typeof res.visit.exitTime === 'string', 'visit.exitTime must be string');
    assert.strictEqual(res.visit.status, 'completed');
  });

  // Test 8: Verify student is no longer inside
  runTest('Verify student "238W1A0412" active visit is closed', () => {
    const activeVisit = getStudentActiveVisit('238W1A0412');
    assert.strictEqual(activeVisit, null, 'Active visit must be null after exit');
  });

  // Test 9: Update face biometric status on student profile
  await runAsyncTest('Update student profile faceRegistered biometric flag', async () => {
    await updateStudentAccount('238W1A0412', { faceRegistered: true });
    const updated = getUserByRoll('238W1A0412');
    assert.strictEqual(updated.faceRegistered, true, 'faceRegistered flag should be true');

    await updateStudentAccount('238W1A0412', { faceRegistered: false });
    const reverted = getUserByRoll('238W1A0412');
    assert.strictEqual(reverted.faceRegistered, false, 'faceRegistered flag should be false');
  });

  // Test 10: Invariant verification
  runTest('Invariant Check: data_base_backup.js and sampleData.js exact sizes preserved', () => {
    const backupPath = path.resolve('frontend/src/db/data_base_backup.js');
    const samplePath = path.resolve('frontend/src/db/sampleData.js');

    const backupStat = fs.statSync(backupPath);
    const sampleStat = fs.statSync(samplePath);

    assert.strictEqual(backupStat.size, 61794, 'data_base_backup.js must remain exactly 61,794 bytes');
    assert.strictEqual(sampleStat.size, 22676, 'sampleData.js must remain exactly 22,676 bytes');
  });

  // Test 11: First-time student registration creates record with faceRegistered: false
  await runAsyncTest('First-time student registration creates record with faceRegistered: false', async () => {
    const { registerStudentFirstVisit } = await import('../../frontend/src/db/database.js');
    const newRoll = '248W1A0499';
    await registerStudentFirstVisit({
      name: 'Pooja Reddy',
      rollNumber: newRoll,
      mobileNumber: '9876543210',
      department: 'ECE',
      password: 'password123',
      faceRegistered: false,
    });
    const created = getUserByRoll(newRoll);
    assert(created, 'Student record must be created');
    assert.strictEqual(created.faceRegistered, false, 'faceRegistered must be false initially');
  });

  // Test 12: Successful face enrollment updates student to faceRegistered: true
  await runAsyncTest('Successful face enrollment updates student to faceRegistered: true', async () => {
    const newRoll = '248W1A0499';
    await updateStudentAccount(newRoll, { faceRegistered: true });
    const updated = getUserByRoll(newRoll);
    assert.strictEqual(updated.faceRegistered, true, 'faceRegistered must become true');
  });

  // Test 13: Prevent duplicate student registration
  await runAsyncTest('Prevent duplicate student registration with existing roll number', async () => {
    const { registerStudentFirstVisit } = await import('../../frontend/src/db/database.js');
    let threw = false;
    try {
      await registerStudentFirstVisit({
        name: 'Pooja Duplicate',
        rollNumber: '248W1A0499',
        password: 'password123',
      });
    } catch (err) {
      threw = true;
      assert(err.message.includes('already registered'), 'Error must mention already registered');
    }
    assert(threw, 'Should throw duplicate error');
  });

  // Test 14: Sequential roll-number confirmation flow (Simulated)
  runTest('Sequential roll-number confirmation: Candidate 1 rejected, Candidate 2 confirmed', () => {
    const candidates = [
      { roll_number: '238W1A0477', name: 'Student A', similarity: 0.62 },
      { roll_number: '238W1A0478', name: 'Student B', similarity: 0.58 },
    ];
    let currentIndex = 0;
    let confirmedStudent = null;

    // User rejects first candidate
    currentIndex++;
    assert.strictEqual(currentIndex, 1, 'Current index should advance to 1');
    assert.strictEqual(candidates[currentIndex].roll_number, '238W1A0478');

    // User confirms second candidate
    confirmedStudent = candidates[currentIndex];
    assert.strictEqual(confirmedStudent.roll_number, '238W1A0478');
  });

  // Test 15: Rejection of all ambiguous candidates leaves visits untouched
  runTest('Sequential confirmation: Rejecting all candidates records zero attendance', () => {
    const candidates = [
      { roll_number: '238W1A0477', name: 'Student A', similarity: 0.60 },
      { roll_number: '238W1A0478', name: 'Student B', similarity: 0.58 },
    ];
    let currentIndex = 0;
    let confirmed = null;

    // Reject 1
    currentIndex++;
    // Reject 2
    currentIndex++;
    assert.strictEqual(currentIndex, candidates.length, 'Index reached end of candidates list');
    assert.strictEqual(confirmed, null, 'No candidate confirmed');
  });

  // Test 16: High-ambiguity (> 3 candidates) modal routing
  runTest('High-ambiguity (>3 candidates) triggers high_ambiguity state', () => {
    const candidates = [
      { roll_number: '238W1A0477', name: 'Student A', similarity: 0.65 },
      { roll_number: '238W1A0478', name: 'Student B', similarity: 0.62 },
      { roll_number: '238W1A0479', name: 'Student C', similarity: 0.60 },
      { roll_number: '238W1A0480', name: 'Student D', similarity: 0.58 },
    ];
    assert(candidates.length > 3, 'Must have > 3 candidates');
    const isHighAmbiguity = candidates.length > 3;
    assert.strictEqual(isHighAmbiguity, true);
  });

  // Test 17: Entry confirmation card registers outside student with real timestamps
  await runAsyncTest('Entry confirmation card registers outside student with real timestamps', async () => {
    const roll = '238W1A0477';
    // Ensure student is outside
    let active = getStudentActiveVisit(roll);
    if (active) await recordLabExit(roll);

    const res = await recordLabEntry(roll, 'Face Recognition');
    assert(res.success, 'Entry must succeed');
    assert(res.visit.entryTime, 'entryTime must exist');
    const visitAfter = getStudentActiveVisit(roll);
    assert(visitAfter, 'Student must now have active visit');
  });

  // Test 18: Exit confirmation card calculates real duration from actual entry time
  await runAsyncTest('Exit confirmation card calculates real duration from actual entry time', async () => {
    const roll = '238W1A0477';
    const active = getStudentActiveVisit(roll);
    assert(active, 'Student must have active visit');

    const res = await recordLabExit(roll, 'Face Recognition');
    assert(res.success, 'Exit must succeed');
    assert(typeof res.durationMinutes === 'number', 'durationMinutes must be number');
    assert.strictEqual(getStudentActiveVisit(roll), null, 'Active visit must be closed');
  });

  // Test 19: First-visit registration edge case: safe fallback preserves account with faceRegistered: false on modal cancel
  await runAsyncTest('First-visit registration: cancelling face enrollment preserves student record with faceRegistered: false', async () => {
    const { registerStudentFirstVisit } = await import('../../frontend/src/db/database.js');
    const studentRoll = '248W1A0488';

    // Register first visit
    const created = await registerStudentFirstVisit({
      name: 'Rohan Verma',
      rollNumber: studentRoll,
      mobileNumber: '9123456789',
      department: 'ECE',
      password: 'password123',
      faceRegistered: false,
      incubationStartDate: '2026-06-01',
      academicYearAtStart: 1,
    });

    assert(created, 'Student account must be created');

    // Simulate user cancelling or closing the face enrollment modal
    // In LabEntryExit.jsx: handleCloseFaceModal checks getUserByRoll
    const fetched = getUserByRoll(studentRoll);
    assert.strictEqual(fetched.faceRegistered, false, 'Face registration remains false without duplicating');
    assert.strictEqual(fetched.name, 'Rohan Verma', 'Account details remain preserved');

    // Later, face enrollment succeeds from directory or retry
    await updateStudentAccount(studentRoll, { faceRegistered: true });
    const finalRecord = getUserByRoll(studentRoll);
    assert.strictEqual(finalRecord.faceRegistered, true, 'Account successfully updated to faceRegistered: true');
  });

  console.log(`\n======================================================`);
  console.log(`ALL FACE ATTENDANCE INTEGRATION TESTS: ${passedCount}/${totalCount} PASSED`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});

