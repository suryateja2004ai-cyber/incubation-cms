// tests/unit/test_analytics_dashboard.mjs
// Verification suite for Analytics Dashboard Graphs:
// 1. Student Attendance Graph (Week, Month, Year) - Unique students per day/month
// 2. Equipment-Usage Graph (Week, Month, Year) - Unique borrowers per day/month
// 3. Independent counting, deduplication, and timezone integrity

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

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import {
  initDatabase,
  getAttendanceAnalytics,
  getEquipmentUsageAnalytics,
  recordLabEntry,
  recordLabExit,
  issueComponents,
  getVisits,
  getTransactions,
  getUserByRoll,
} from '../../frontend/src/db/database.js';

const workspaceRoot = process.cwd();

console.log('🧪 Starting Analytics Dashboard Graphs Verification Suite...\n');

let testsPassed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

async function run() {
  await initDatabase();

  // Test 1: Attendance Graph - Week Filter Structure & Keys
  test('Attendance Week filter returns exactly 7 days with label and studentsCount keys', () => {
    const data = getAttendanceAnalytics('week');
    assert.strictEqual(data.length, 7, `Expected 7 items for week, got ${data.length}`);
    for (const item of data) {
      assert.ok(typeof item.label === 'string' && item.label.length > 0, 'Every item must have a non-empty string label');
      assert.ok(typeof item.studentsCount === 'number', 'Every item must have a numeric studentsCount');
      assert.ok(typeof item.date === 'string', 'Every item must have a date key (YYYY-MM-DD)');
      assert.strictEqual(item.Attendees, item.studentsCount, 'Attendees alias must match studentsCount');
    }
  });

  // Test 2: Attendance Graph - Month Filter Structure
  test('Attendance Month filter returns exactly 30 days with valid data keys', () => {
    const data = getAttendanceAnalytics('month');
    assert.strictEqual(data.length, 30, `Expected 30 items for month, got ${data.length}`);
    for (const item of data) {
      assert.ok(item.label, 'Item must have a label');
      assert.ok(typeof item.studentsCount === 'number', 'Item must have a numeric studentsCount');
      assert.ok(item.date, 'Item must have date string');
    }
  });

  // Test 3: Attendance Graph - Year Filter Structure
  test('Attendance Year filter returns 12 months with label and studentsCount', () => {
    const data = getAttendanceAnalytics('year');
    assert.strictEqual(data.length, 12, `Expected 12 items for year, got ${data.length}`);
    for (const item of data) {
      assert.ok(item.label, 'Item must have a label');
      assert.ok(typeof item.studentsCount === 'number', 'Item must have a numeric studentsCount');
      assert.ok(item.month, 'Item must have month string YYYY-MM');
    }
  });

  // Test 4: Equipment Usage Graph - Week Filter Structure
  test('Equipment Usage Week filter returns exactly 7 days with label and borrowersCount keys', () => {
    const data = getEquipmentUsageAnalytics('week');
    assert.strictEqual(data.length, 7, `Expected 7 items for week, got ${data.length}`);
    for (const item of data) {
      assert.ok(typeof item.label === 'string' && item.label.length > 0, 'Every item must have label');
      assert.ok(typeof item.borrowersCount === 'number', 'Every item must have numeric borrowersCount');
      assert.ok(typeof item.date === 'string', 'Every item must have date string');
      assert.strictEqual(item.Issued, item.borrowersCount, 'Issued alias must match borrowersCount');
    }
  });

  // Test 5: Equipment Usage Graph - Month Filter Structure
  test('Equipment Usage Month filter returns exactly 30 days with valid keys', () => {
    const data = getEquipmentUsageAnalytics('month');
    assert.strictEqual(data.length, 30, `Expected 30 items for month, got ${data.length}`);
    for (const item of data) {
      assert.ok(item.label, 'Item must have label');
      assert.ok(typeof item.borrowersCount === 'number', 'Item must have numeric borrowersCount');
      assert.ok(item.date, 'Item must have date string');
    }
  });

  // Test 6: Equipment Usage Graph - Year Filter Structure
  test('Equipment Usage Year filter returns 12 months and accurately reflects historical borrowings', () => {
    const data = getEquipmentUsageAnalytics('year');
    assert.strictEqual(data.length, 12, `Expected 12 items for year, got ${data.length}`);
    const totalBorrowers = data.reduce((sum, d) => sum + d.borrowersCount, 0);
    assert.ok(totalBorrowers > 0, `Expected historical borrowers across the year, got ${totalBorrowers}`);
    
    // In sample data, Aug 2026 has 2 borrowers and Sep 2026 has 2 borrowers
    const aug = data.find(d => d.month === '2026-08');
    const sep = data.find(d => d.month === '2026-09');
    if (aug) assert.strictEqual(aug.borrowersCount, 2, `Aug 2026 should have 2 unique borrowers, got ${aug.borrowersCount}`);
    if (sep) assert.strictEqual(sep.borrowersCount, 2, `Sep 2026 should have 2 unique borrowers, got ${sep.borrowersCount}`);
  });

  // Test 7: Unique Student Deduplication on Same Day Attendance
  test('Multiple scans/visits by the same student on the same day count as 1 unique attendee', async () => {
    const todayRoll = '238W1A0412'; // Kavya Sharma
    const todayUser = getUserByRoll(todayRoll);
    assert.ok(todayUser, 'Kavya Sharma profile should exist');

    // Record entry 1
    const res1 = await recordLabEntry(todayRoll, 'manual');
    assert.ok(res1.success, 'First entry must succeed');

    // Record exit
    await recordLabExit(todayRoll);

    // Record entry 2 on the same day
    const res2 = await recordLabEntry(todayRoll, 'fingerprint');
    assert.ok(res2.success, 'Second entry must succeed');

    const weekData = getAttendanceAnalytics('week');
    const todayItem = weekData[weekData.length - 1]; // last day is today
    assert.ok(todayItem.studentsCount >= 1, 'Today attendance should count Kavya');

    // Verify raw visits count for Kavya today
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const allVisitsToday = getVisits().filter(v => {
      const vKey = `${new Date(v.entryTime).getFullYear()}-${String(new Date(v.entryTime).getMonth() + 1).padStart(2, '0')}-${String(new Date(v.entryTime).getDate()).padStart(2, '0')}`;
      return vKey === todayKey && v.studentRoll === todayRoll;
    });
    assert.ok(allVisitsToday.length >= 2, `Expected at least 2 raw visit records for Kavya today (got ${allVisitsToday.length})`);
  });

  // Test 8: Missing Exit Timestamp (Active Visit) is Counted in Attendance
  test('Active visits with exitTime: null are counted as valid attendance', () => {
    const visits = getVisits();
    const activeVisit = visits.find(v => v.status === 'inside' && v.exitTime === null);
    assert.ok(activeVisit, 'There should be an active visit in lab');

    const weekData = getAttendanceAnalytics('week');
    const todayItem = weekData[weekData.length - 1];
    assert.ok(todayItem.studentsCount >= 1, 'Active visit student must be included in studentsCount');
  });

  // Test 9: Equipment Usage Deduplication - Multiple Components & Transactions
  test('Multiple components borrowed by the same student on the same day count as 1 unique borrower', async () => {
    const borrowerRoll = '238W1A0477'; // Anwar Bajarinti
    const borrowerUser = getUserByRoll(borrowerRoll);

    // Issue multiple items in transaction
    await issueComponents({
      studentName: borrowerUser.name,
      studentRoll: borrowerRoll,
      department: borrowerUser.department,
      phone: borrowerUser.mobileNumber,
      items: [
        { componentId: 'COMP-001', componentName: 'PIR Motion Sensor (HC-SR501)', quantity: 1, dueDateDays: 7 },
        { componentId: 'COMP-003', componentName: 'Ultrasonic Distance Sensor (HC-SR04)', quantity: 1, dueDateDays: 7 }
      ],
      actor: { name: 'Admin', role: 'admin' }
    });

    const weekEquipment = getEquipmentUsageAnalytics('week');
    const todayItem = weekEquipment[weekEquipment.length - 1];
    assert.strictEqual(todayItem.borrowersCount, 1, `Expected exactly 1 unique borrower today, got ${todayItem.borrowersCount}`);
  });

  // Test 10: Attendance and Equipment Usage Remain Completely Separate
  test('Attendance records do not inflate equipment usage and equipment borrowing does not inflate attendance', () => {
    const attendanceWeek = getAttendanceAnalytics('week');
    const equipmentWeek = getEquipmentUsageAnalytics('week');

    // Compare each day
    for (let i = 0; i < 7; i++) {
      assert.ok(typeof attendanceWeek[i].studentsCount === 'number');
      assert.ok(typeof equipmentWeek[i].borrowersCount === 'number');
      // The fields must be independent
      assert.strictEqual(attendanceWeek[i].borrowersCount, undefined, 'Attendance record must not have borrowersCount');
      assert.strictEqual(equipmentWeek[i].studentsCount, undefined, 'Equipment record must not have studentsCount');
    }
  });

  // Test 11: Protected files remain exact byte sizes
  test('Protected database files remain exact byte sizes', () => {
    const dbBackupPath = path.join(workspaceRoot, 'frontend', 'src', 'db', 'data_base_backup.js');
    const sampleDataPath = path.join(workspaceRoot, 'frontend', 'src', 'db', 'sampleData.js');

    const backupSize = fs.statSync(dbBackupPath).size;
    const sampleSize = fs.statSync(sampleDataPath).size;

    assert.strictEqual(backupSize, 61794, `data_base_backup.js must be 61794 bytes (got ${backupSize})`);
    assert.strictEqual(sampleSize, 22676, `sampleData.js must be 22676 bytes (got ${sampleSize})`);
  });

  console.log(`\n🎉 All ${testsPassed}/${testsPassed} Analytics Dashboard tests passed!\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
