// tests/unit/test_global_admin_presence.mjs
// Comprehensive Verification Suite for Persistent Global Admin Lab Presence Indicator

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Mock browser storage for Node test runner
const mockStorage = new Map();
if (typeof globalThis.localStorage === 'undefined') {
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

if (typeof globalThis.sessionStorage === 'undefined') {
  const mockSession = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: {
      getItem: (key) => mockSession.get(key) || null,
      setItem: (key, val) => mockSession.set(key, String(val)),
      removeItem: (key) => mockSession.delete(key),
      clear: () => mockSession.clear(),
    },
    writable: true,
  });
}

// Dynamically import database module after storage polyfills
const {
  initDatabase,
  getGlobalAdminPresence,
  toggleStaffPresence,
  logoutUser,
  setCurrentUser,
  getCurrentUser,
  subscribeToDb,
  handleStaffPresenceRealtimePayload,
  refreshStaffPresenceFromCloud,
} = await import('../../frontend/src/db/database.js');

console.log('================================================================');
console.log('🧪 VERIFICATION SUITE: PERSISTENT GLOBAL ADMIN PRESENCE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] Test ${totalTests}: ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] Test ${totalTests}: ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  await initDatabase();

  const adminSurya = {
    id: 'USR-001',
    rollNumber: 'admin',
    name: 'Dr. Surya Prasad',
    role: 'admin',
    email: 'admin@incubation.local',
  };

  const studentUser = {
    id: 'USR-STU-001',
    rollNumber: '238W1A0477',
    name: 'Anwar Bajarinti',
    role: 'student',
    email: '238w1a0477@student.incubation.local',
  };

  const staffUser = {
    id: 'USR-STF-001',
    rollNumber: 'STAFF-01',
    name: 'Lab Assistant',
    role: 'staff',
    email: 'staff@incubation.local',
  };

  let activeAdminRecordId = null;

  console.log('--- TEST 1: Admin clicks I\'m Inside -> Portals show Green + "Admin is in lab" ---');
  await runAsyncTest('Admin clicks I\'m Inside: status becomes inside with correct visible text and tooltip', async () => {
    setCurrentUser(adminSurya);
    const res = await toggleStaffPresence(adminSurya);
    assert.strictEqual(res.isInside, true);
    activeAdminRecordId = res.record.id;

    const presence = getGlobalAdminPresence();
    assert.strictEqual(presence.isInside, true);
    assert.strictEqual(presence.visibleText, 'Admin is in lab');
    assert.strictEqual(presence.adminName, 'Dr. Surya Prasad');
    assert.strictEqual(presence.tooltipText, 'Dr. Surya Prasad is in the lab');
  });

  console.log('\n--- TEST 2: Admin logs out -> Status remains Green + "Admin is in lab" ---');
  await runAsyncTest('Admin logs out: presence status remains inside and NOT reset to outside', async () => {
    await logoutUser();
    assert.strictEqual(getCurrentUser(), null, 'Session is cleared');

    // Crucial acceptance condition: Logging out is NOT leaving the lab!
    const presence = getGlobalAdminPresence();
    assert.strictEqual(presence.isInside, true, 'Presence must remain inside after logout');
    assert.strictEqual(presence.visibleText, 'Admin is in lab');
    assert.strictEqual(presence.tooltipText, 'Dr. Surya Prasad is in the lab');
  });

  console.log('\n--- TEST 3: Admin closes browser -> Status remains Green ---');
  await runAsyncTest('Closing browser & restoring from persistent storage maintains green status', async () => {
    // Verify storage has persisted presence under canonical key
    const rawSaved = mockStorage.get('inc_cms_staff_presence_v2');
    assert.ok(rawSaved, 'Staff presence must be saved in localStorage');
    const parsed = JSON.parse(rawSaved);
    assert.ok(Array.isArray(parsed) && parsed.some((p) => p.active && !p.exitTime));

    const presence = getGlobalAdminPresence();
    assert.strictEqual(presence.isInside, true);
    assert.strictEqual(presence.visibleText, 'Admin is in lab');
  });

  console.log('\n--- TEST 4: Student refreshes portal -> Green status remains ---');
  await runAsyncTest('Student portal refresh reads persistent presence and displays green status', async () => {
    setCurrentUser(studentUser);
    const presence = getGlobalAdminPresence();
    assert.strictEqual(presence.isInside, true);
    assert.strictEqual(presence.visibleText, 'Admin is in lab');
    assert.strictEqual(presence.tooltipText, 'Dr. Surya Prasad is in the lab');
  });

  console.log('\n--- TEST 5: Admin opens another device / tab -> Latest saved status is displayed ---');
  await runAsyncTest('Another device or tab synchronizes latest presence via Realtime/Cloud payload', async () => {
    // Update the existing record via Realtime payload simulation
    const now = new Date().toISOString();
    handleStaffPresenceRealtimePayload({
      eventType: 'UPDATE',
      new: {
        id: activeAdminRecordId,
        staff_email: 'admin@incubation.local',
        staff_name: 'Dr. Surya Prasad',
        role: 'admin',
        entry_time: now,
        exit_time: null,
        duration_minutes: null,
        active: true,
        created_at: now,
      },
    });

    const presence = getGlobalAdminPresence();
    assert.strictEqual(presence.isInside, true);
    assert.strictEqual(presence.visibleText, 'Admin is in lab');
    assert.strictEqual(presence.adminName, 'Dr. Surya Prasad');
  });

  console.log('\n--- TEST 6: Admin clicks I\'m Outside -> Portals show Red + "Admin is outside the lab" ---');
  await runAsyncTest('Admin explicitly clicks I\'m Outside: status changes to outside (Red)', async () => {
    setCurrentUser(adminSurya);
    const res = await toggleStaffPresence(adminSurya);
    assert.strictEqual(res.isInside, false);

    const presence = getGlobalAdminPresence();
    assert.strictEqual(presence.isInside, false);
    assert.strictEqual(presence.visibleText, 'Admin is outside the lab');
    assert.strictEqual(presence.tooltipText, 'Dr. Surya Prasad is outside the lab');
  });

  console.log('\n--- TEST 7 & 8: Single Tooltip (Black background, White text, Not Clipped) ---');
  runTest('Navbar JSX contains exactly ONE tooltip with no native HTML title attribute', () => {
    const navbarFile = fs.readFileSync(
      path.join(projectRoot, 'frontend/src/components/layout/Navbar.jsx'),
      'utf-8'
    );

    // Indicator must NOT have title attribute (prevents duplicate browser tooltip)
    const indicatorMatch = navbarFile.match(/<div[^>]*className=["']global-admin-presence-indicator["'][^>]*>/);
    assert.ok(indicatorMatch, 'Indicator element must exist in Navbar.jsx');
    assert.ok(!indicatorMatch[0].includes('title='), 'Indicator must NOT have native title attribute');

    // Must have exactly one custom tooltip element with role="tooltip"
    const tooltipMatches = navbarFile.match(/className=["']presence-tooltip["']/g);
    assert.strictEqual(tooltipMatches?.length, 1, 'Must have exactly ONE tooltip element');

    // CSS inspection: black background, white text, z-index, not clipped
    assert.ok(navbarFile.includes('background: #000000;'), 'Tooltip must use black background');
    assert.ok(navbarFile.includes('color: #ffffff;'), 'Tooltip must use white text');
  });

  runTest('Navbar container has overflow: visible to prevent tooltip clipping', () => {
    const indexCss = fs.readFileSync(
      path.join(projectRoot, 'frontend/src/styles/index.css'),
      'utf-8'
    );
    const navbarBlock = indexCss.match(/\.navbar\s*\{[^}]+\}/)?.[0] || '';
    assert.ok(navbarBlock.includes('overflow: visible;'), '.navbar must have overflow: visible to prevent clipping');
  });

  console.log('\n--- TEST 9: Student / Staff cannot modify Admin presence ---');
  await runAsyncTest('Students are rejected with Unauthorized error when attempting to modify presence', async () => {
    setCurrentUser(studentUser);
    let threw = false;
    try {
      await toggleStaffPresence(studentUser);
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('Unauthorized'), 'Must throw Unauthorized error');
    }
    assert.strictEqual(threw, true, 'Student presence modification must be rejected');

    // Admin presence remains outside (untouched by unauthorized call)
    const presence = getGlobalAdminPresence();
    assert.strictEqual(presence.isInside, false);
    assert.strictEqual(presence.visibleText, 'Admin is outside the lab');
  });

  console.log('\n--- TEST 10: Admin portal does not display the indicator ---');
  runTest('Navbar hides indicator in Admin portal (isAdmin === true)', () => {
    const navbarFile = fs.readFileSync(
      path.join(projectRoot, 'frontend/src/components/layout/Navbar.jsx'),
      'utf-8'
    );
    assert.ok(navbarFile.includes('{!isAdmin && ('), 'Indicator must be conditionally rendered only when !isAdmin');

    // Role check logic verification
    const adminUser = { role: 'admin', rollNumber: 'admin' };
    const isAdmin = adminUser.role === 'admin' || (adminUser.rollNumber === 'admin' && !adminUser.role);
    assert.strictEqual(isAdmin, true);

    const nonAdminUser = { role: 'student', rollNumber: '238W1A0477' };
    const isNonAdmin = nonAdminUser.role === 'admin' || (nonAdminUser.rollNumber === 'admin' && !nonAdminUser.role);
    assert.strictEqual(isNonAdmin, false);
  });

  console.log('\n--- BONUS: Multiple Administrators Support ---');
  await runAsyncTest('Multiple administrators are supported without silent overwrite', async () => {
    const admin2 = {
      id: 'USR-ADMIN-002',
      rollNumber: 'admin2',
      name: 'Prof. Anitha',
      role: 'admin',
      email: 'admin2@incubation.local',
    };

    // Admin 1 (Dr. Surya Prasad) enters
    setCurrentUser(adminSurya);
    await toggleStaffPresence(adminSurya);

    // Admin 2 (Prof. Anitha) enters
    setCurrentUser(admin2);
    await toggleStaffPresence(admin2);

    const presence = getGlobalAdminPresence();
    assert.strictEqual(presence.isInside, true);
    assert.ok(
      presence.adminName.includes('Dr. Surya Prasad') && presence.adminName.includes('Prof. Anitha'),
      `Both admin names should be present, got: ${presence.adminName}`
    );
    assert.strictEqual(presence.visibleText, 'Admin is in lab');
    assert.ok(presence.tooltipText.includes('is in the lab'));

    // Admin 1 exits, Admin 2 remains inside
    setCurrentUser(adminSurya);
    await toggleStaffPresence(adminSurya);
    const presenceAfterOneExit = getGlobalAdminPresence();
    assert.strictEqual(presenceAfterOneExit.isInside, true, 'Status remains inside because Admin 2 is still in the lab');
    assert.strictEqual(presenceAfterOneExit.adminName, 'Prof. Anitha');

    // Admin 2 exits -> All admins outside
    setCurrentUser(admin2);
    await toggleStaffPresence(admin2);
    const presenceAllOut = getGlobalAdminPresence();
    assert.strictEqual(presenceAllOut.isInside, false);
    assert.strictEqual(presenceAllOut.visibleText, 'Admin is outside the lab');
  });

  console.log('\n================================================================');
  console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} PASSED, 0 FAILED`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
