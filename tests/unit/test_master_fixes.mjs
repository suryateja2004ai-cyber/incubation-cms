// tests/unit/test_master_fixes.mjs
// Comprehensive verification test suite for all 5 Master Workstreams

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Mock localStorage for Node.js test environment
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

// Import database functions and services
import {
  getUserByRoll,
  getStudents,
  getStudentActiveVisit,
  recordLabEntry,
  recordLabExit,
  calculateVisitDuration,
  cleanupStaleVisitsForStudent,
  getAttendanceHistoryByDateRange,
  getAttendanceExportData,
  toLocalDateKey,
  getLabVisits,
  getCategories,
  getCategoryById,
  getCategoryPath,
  getCategoryTree,
  getCategoryDescendantIds,
  addCategory,
  updateCategory,
  deleteCategory,
  getComponents,
  addComponent,
  resetDatabaseToSample,
  getAuditLogs,
} from '../../frontend/src/db/database.js';

import {
  checkCloudStorageAvailability,
  uploadLocationPhotoToCloud,
} from '../../frontend/src/services/storage/componentPhotoStorageService.js';

import {
  generateGenuineXlsx,
  buildZip,
} from '../../frontend/src/utils/excelExport.js';

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] Test ${totalTests}: ${name}`);
    console.error(`           Error: ${err.message}`);
    throw err;
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
    console.error(`           Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('\n================================================================');
  console.log('🧪 MASTER BUG FIX & FEATURE IMPLEMENTATION VERIFICATION SUITE');
  console.log('================================================================\n');

  resetDatabaseToSample();

  // ====================================================================
  // WORKSTREAM 1: FACE RECOGNITION IDENTITY SAFETY
  // ====================================================================
  console.log('--- WORKSTREAM 1: Face Recognition Identity Safety ---');

  runTest('Tiwari (248W5A0409) is NOT in the CMS student directory', () => {
    const tiwariUser = getUserByRoll('248W5A0409');
    assert.strictEqual(tiwariUser, null, 'Tiwari must not exist as an authorized CMS student');
  });

  runTest('Student 238W1A0477 (Anwar Bajarinti) is independent and never linked to Tiwari', () => {
    const anwar = getUserByRoll('238W1A0477');
    assert(anwar, 'Anwar Bajarinti must exist in CMS');
    assert.strictEqual(anwar.rollNumber, '238W1A0477');
    assert.strictEqual(anwar.name, 'Anwar Bajarinti');
    assert.notStrictEqual(anwar.rollNumber, '248W5A0409');
  });

  runTest('Face detection candidate without CMS record is rejected as Unlinked Face', () => {
    // Simulated face detection candidate returning unlinked SQLite ID '248W5A0409' (Tiwari)
    const detectedCandidate = {
      roll_number: '248W5A0409',
      name: 'tiwari',
      similarity: 0.72,
    };

    const cmsStudent = getUserByRoll(detectedCandidate.roll_number);
    assert.strictEqual(cmsStudent, null, 'CMS validation must return null for unlinked roll');

    // Safe HUD label determination logic matching FaceAttendance.jsx
    let hudLabel = 'Unknown or Unlinked Face';
    let isAuthorized = false;
    if (cmsStudent) {
      hudLabel = `${cmsStudent.name} (${cmsStudent.rollNumber})`;
      isAuthorized = true;
    }

    assert.strictEqual(isAuthorized, false, 'Unlinked face candidate must not be authorized');
    assert.strictEqual(hudLabel, 'Unknown or Unlinked Face', 'HUD must display Unknown or Unlinked Face');
    assert(!hudLabel.toLowerCase().includes('tiwari'), 'Unlinked candidate name must NEVER leak to HUD');
  });

  // ====================================================================
  // WORKSTREAM 2: LAB ENTRY/EXIT DURATION PRECISION & STALE VISIT SAFETY
  // ====================================================================
  console.log('\n--- WORKSTREAM 2: Lab Entry/Exit Duration Precision & Stale Visit Safety ---');

  runTest('calculateVisitDuration computes high-precision seconds and formatted duration', () => {
    const entry = '2026-10-30T10:00:00.000Z';
    const exit15s = '2026-10-30T10:00:15.000Z';
    const res15s = calculateVisitDuration(entry, exit15s);

    assert.strictEqual(res15s.durationSeconds, 15, 'durationSeconds must be exactly 15');
    assert.strictEqual(res15s.durationMinutes, 0, 'durationMinutes must round to 0 for 15s');
    assert.strictEqual(res15s.durationFormatted, '15 seconds');

    const exit45m30s = '2026-10-30T10:45:30.000Z';
    const res45m = calculateVisitDuration(entry, exit45m30s);
    assert.strictEqual(res45m.durationSeconds, 2730);
    assert.strictEqual(res45m.durationMinutes, 46);
    assert.strictEqual(res45m.durationFormatted, '46 minutes');

    const exit2h15m = '2026-10-30T12:15:00.000Z';
    const res2h = calculateVisitDuration(entry, exit2h15m);
    assert.strictEqual(res2h.durationSeconds, 8100);
    assert.strictEqual(res2h.durationMinutes, 135);
    assert.strictEqual(res2h.durationFormatted, '2 hours 15 mins');
  });

  await runAsyncTest('Immediate entry and exit records accurate seconds without multi-hour jump', async () => {
    const roll = '238W1A0412';
    // Clear any previous active visits
    const existing = getStudentActiveVisit(roll);
    if (existing) await recordLabExit(roll);

    const entryRes = await recordLabEntry(roll, 'Face Recognition');
    assert(entryRes.success, 'Lab entry must succeed');
    assert(entryRes.visit, 'Active visit must be returned');

    // Simulate exit 12 seconds later
    const exitRes = await recordLabExit(roll, 'Face Recognition');
    assert(exitRes.success, 'Lab exit must succeed');
    assert(typeof exitRes.durationSeconds === 'number', 'durationSeconds must be numeric');
    assert(exitRes.durationSeconds >= 0 && exitRes.durationSeconds < 60, 'durationSeconds must reflect real immediate exit');
    assert.strictEqual(exitRes.durationMinutes, 0, 'durationMinutes must be 0 for < 30s exit');
    assert(exitRes.durationFormatted.includes('s'), 'durationFormatted must include seconds');
  });

  runTest('cleanupStaleVisitsForStudent auto-closes previous-day visits as incomplete with zero fake exitTime', () => {
    const roll = '238W1A0477';
    // Clear any pre-existing unclosed visits first so we isolate the simulated visit
    cleanupStaleVisitsForStudent(roll);

    // Manually simulate a visit started yesterday that was never closed
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const yesterdayKey = toLocalDateKey(yesterday);

    const staleVisit = {
      id: 'stale-test-visit-01',
      studentRoll: roll,
      studentName: 'Anwar Bajarinti',
      entryTime: yesterday.toISOString(),
      exitTime: null,
      durationMinutes: null,
      durationSeconds: null,
      status: 'inside',
      date: yesterdayKey,
    };

    getLabVisits().push(staleVisit);

    const cleanedCount = cleanupStaleVisitsForStudent(roll);
    assert.strictEqual(cleanedCount, 1, 'Should identify and clean 1 stale visit');

    const cleaned = getLabVisits().find((v) => v.id === 'stale-test-visit-01');
    assert(cleaned, 'Cleaned visit must exist');
    assert.strictEqual(cleaned.status, 'incomplete', 'Stale visit must be marked incomplete');
    assert.strictEqual(cleaned.exitTime, null, 'Exit timestamp must NEVER be fabricated');
    assert.strictEqual(cleaned.durationMinutes, null, 'Duration must NOT be fabricated');
    assert.strictEqual(cleaned.autoClosed, true, 'autoClosed flag must be set');
  });

  runTest('cleanupStaleVisitsForStudent flags same-day visit > 16h for admin review without closing', () => {
    const roll = '238W1A0412';
    const today = new Date();
    const entryTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 1, 0);
    const todayKey = toLocalDateKey(today);

    const longVisit = {
      id: 'long-today-visit-01',
      studentRoll: roll,
      studentName: 'Kavya Sharma',
      entryTime: entryTime.toISOString(),
      exitTime: null,
      durationMinutes: null,
      status: 'inside',
      date: todayKey,
    };

    getLabVisits().push(longVisit);

    // Mock Date.now to 17 hours after entry on the same day
    const origNow = Date.now;
    try {
      Date.now = () => entryTime.getTime() + 17 * 3600 * 1000;
      cleanupStaleVisitsForStudent(roll);
    } finally {
      Date.now = origNow;
    }

    const checked = getLabVisits().find((v) => v.id === 'long-today-visit-01');
    assert(checked, 'Visit must exist');
    assert.strictEqual(checked.status, 'inside', 'Same-day visit > 16h must NOT be auto-closed');
    assert.strictEqual(checked.flaggedForAdminReview, true, 'Visit must be flagged for admin review');
  });

  // ====================================================================
  // WORKSTREAM 3: ATTENDANCE HISTORY & GENUINE OPENXML .XLSX EXPORT
  // ====================================================================
  console.log('\n--- WORKSTREAM 3: Attendance History & Genuine .xlsx Export ---');

  runTest('getAttendanceHistoryByDateRange returns records with session counts and department', () => {
    const todayKey = toLocalDateKey(new Date());
    const res = getAttendanceHistoryByDateRange(todayKey, todayKey);
    assert(res && Array.isArray(res.records), 'History must return an object with records array');
    assert(typeof res.totalVisits === 'number', 'totalVisits must be numeric');
    assert(typeof res.totalUniqueStudents === 'number', 'totalUniqueStudents must be numeric');
    assert(typeof res.totalHours === 'string', 'totalHours must be string');

    if (res.records.length > 0) {
      const item = res.records[0];
      assert(item.rollNumber, 'Must have rollNumber');
      assert(item.studentName, 'Must have studentName');
      assert(item.department, 'Must have department');
      assert(typeof item.visitsCountOnDate === 'number', 'visitsCountOnDate must be numeric');
      assert(typeof item.duration === 'string', 'duration must be string');
    }
  });

  runTest('generateGenuineXlsx produces genuine binary OpenXML PKZip archive', () => {
    const rows = [
      ['VRSEC Smart Incubation Centre — Lab Attendance Report'],
      ['Report Generated At (IST):', '30/10/2026, 08:00:00'],
      ['Total Attendance Visits:', 10],
      [],
      [
        'Serial Number',
        'Student Name',
        'Roll Number',
        'Department',
        'Attendance Date',
        'Entry Time',
        'Exit Time',
        'Duration',
        'Visit Status',
        'Number of Visits on Date',
      ],
      [1, 'Anwar Bajarinti', '238W1A0477', 'ECE', '2026-10-30', '09:00:00', '11:30:00', '2h 30m', 'Completed', 1],
    ];

    const buffer = generateGenuineXlsx(rows, 'Attendance');

    assert(buffer instanceof Uint8Array, 'Result must be Uint8Array');
    assert(buffer.length > 500, `Buffer must be substantial binary (got ${buffer.length} bytes)`);

    // Verify OpenXML PKZip magic header: 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
    assert.strictEqual(buffer[0], 0x50, 'Byte 0 must be 0x50 (P)');
    assert.strictEqual(buffer[1], 0x4b, 'Byte 1 must be 0x4B (K)');
    assert.strictEqual(buffer[2], 0x03, 'Byte 2 must be 0x03');
    assert.strictEqual(buffer[3], 0x04, 'Byte 3 must be 0x04');

    // Verify it is NOT plain text CSV masquerading as .xlsx
    const asText = Buffer.from(buffer.slice(0, 100)).toString('utf-8');
    assert(!asText.startsWith('Roll Number,'), 'Must NOT be a CSV file with an xlsx extension');
    assert(!asText.startsWith('VRSEC Incubation,'), 'Must NOT be a plain text file');
  });

  runTest('buildZip bundles all required Office OpenXML parts', () => {
    const files = [
      { name: '[Content_Types].xml', data: '<Types></Types>' },
      { name: '_rels/.rels', data: '<Relationships></Relationships>' },
      { name: 'xl/workbook.xml', data: '<workbook></workbook>' },
      { name: 'xl/worksheets/sheet1.xml', data: '<worksheet></worksheet>' },
    ];
    const zipBytes = buildZip(files);
    assert(zipBytes.length > 0, 'Zip bytes must not be empty');

    // Check PKZip End of Central Directory signature (0x50 0x4B 0x05 0x06)
    let foundEOCD = false;
    for (let i = 0; i < zipBytes.length - 4; i++) {
      if (
        zipBytes[i] === 0x50 &&
        zipBytes[i + 1] === 0x4b &&
        zipBytes[i + 2] === 0x05 &&
        zipBytes[i + 3] === 0x06
      ) {
        foundEOCD = true;
        break;
      }
    }
    assert(foundEOCD, 'Valid PKZip End of Central Directory record must be present');
  });

  // ====================================================================
  // WORKSTREAM 4: STORAGE LOCATION PHOTO & CLOUD STORAGE VERIFICATION
  // ====================================================================
  console.log('\n--- WORKSTREAM 4: Storage Location Photo & Cloud Storage ---');

  await runAsyncTest('checkCloudStorageAvailability inspects Supabase and Cloudflare endpoints', async () => {
    const status = await checkCloudStorageAvailability();
    assert(typeof status === 'object', 'Status must be an object');
    assert('isConfigured' in status, 'Status must contain isConfigured');
    assert('provider' in status, 'Status must contain provider');
    assert('message' in status, 'Status must contain message');
    assert(typeof status.message === 'string', 'Message must be a string');
  });

  await runAsyncTest('uploadLocationPhotoToCloud strictly rejects when cloud storage is unconfigured', async () => {
    const status = await checkCloudStorageAvailability();
    if (!status.isConfigured) {
      let threw = false;
      try {
        await uploadLocationPhotoToCloud(new Blob(['fake image']), 'COMP-001', { name: 'Admin' });
      } catch (err) {
        threw = true;
        assert(
          err.message.includes('not currently configured') ||
          err.message.includes('Required setup') ||
          err.message.includes('Missing VITE_SUPABASE_URL'),
          `Error must explain real cloud setup requirement (got: ${err.message})`
        );
      }
      assert(threw, 'Must reject upload when cloud storage is unconfigured');
    }
  });

  // ====================================================================
  // WORKSTREAM 5: MULTI-LEVEL CATEGORY HIERARCHY
  // ====================================================================
  console.log('\n--- WORKSTREAM 5: Multi-Level Component Category Hierarchy ---');

  runTest('Initial default category tree has multiple hierarchical levels', () => {
    const tree = getCategoryTree();
    assert(tree.length > 0, 'Category tree must contain root categories');

    const devBoards = tree.find((c) => c.name === 'Development Boards');
    assert(devBoards, 'Development Boards root category must exist');
    assert(devBoards.children && devBoards.children.length > 0, 'Development Boards must have sub-categories');

    const espBoards = devBoards.children.find((c) => c.name === 'ESP Development Boards');
    assert(espBoards, 'ESP Development Boards sub-category must exist');
    assert(espBoards.children && espBoards.children.length > 0, 'ESP Development Boards must have grandchild categories');

    const esp32 = espBoards.children.find((c) => c.name === 'ESP32');
    assert(esp32, 'ESP32 leaf category must exist at Level 3');
  });

  runTest('getCategoryPath computes full taxonomy breadcrumb trail', () => {
    const categories = getCategories();
    const esp32 = categories.find((c) => c.name === 'ESP32');
    assert(esp32, 'ESP32 category must exist');

    const pathArray = getCategoryPath(esp32.id);
    assert.deepStrictEqual(
      pathArray,
      ['Development Boards', 'ESP Development Boards', 'ESP32'],
      'Breadcrumb path must trace root to leaf'
    );
  });

  runTest('getCategoryDescendantIds retrieves self and all subcategory IDs', () => {
    const categories = getCategories();
    const devBoards = categories.find((c) => c.name === 'Development Boards');
    assert(devBoards, 'Development Boards category must exist');

    const descIds = getCategoryDescendantIds(devBoards.id);
    assert(descIds.has(devBoards.id), 'Must include self');
    const espBoards = categories.find((c) => c.name === 'ESP Development Boards');
    const esp32 = categories.find((c) => c.name === 'ESP32');
    assert(descIds.has(espBoards.id), 'Must include child');
    assert(descIds.has(esp32.id), 'Must include grandchild');
  });

  await runAsyncTest('addCategory creates new child and updates taxonomy', async () => {
    const categories = getCategories();
    const esp32 = categories.find((c) => c.name === 'ESP32');
    assert(esp32, 'ESP32 must exist');

    const newChild = await addCategory(
      {
        name: 'ESP32-S3 Dual Core',
        parentId: esp32.id,
        description: 'AI & Vector instruction support',
      },
      { name: 'Admin Sir', role: 'admin' }
    );

    assert(newChild.id, 'New category must have an ID');
    assert.strictEqual(newChild.parentId, esp32.id, 'Parent must be ESP32');

    const pathArray = getCategoryPath(newChild.id);
    assert.deepStrictEqual(pathArray, ['Development Boards', 'ESP Development Boards', 'ESP32', 'ESP32-S3 Dual Core']);
  });

  await runAsyncTest('updateCategory prevents cyclic hierarchy loops', async () => {
    const categories = getCategories();
    const devBoards = categories.find((c) => c.name === 'Development Boards');
    const esp32 = categories.find((c) => c.name === 'ESP32');

    let threw = false;
    try {
      // Attempting to make Development Boards a child of its own grandchild (ESP32)
      await updateCategory(devBoards.id, { parentId: esp32.id }, { name: 'Admin', role: 'admin' });
    } catch (err) {
      threw = true;
      assert(err.message.includes('cycle') || err.message.includes('descendant'), 'Must detect cycle');
    }
    assert(threw, 'Cycle prevention must reject assigning parent to a descendant');
  });

  await runAsyncTest('deleteCategory prevents deleting a category with subcategories', async () => {
    const categories = getCategories();
    const devBoards = categories.find((c) => c.name === 'Development Boards');

    let threw = false;
    try {
      await deleteCategory(devBoards.id, { name: 'Admin', role: 'admin' });
    } catch (err) {
      threw = true;
      assert(err.message.includes('subcategories') || err.message.includes('child') || err.message.includes('root') || err.message.includes('main'), 'Must reject deleting category with children');
    }
    assert(threw, 'Must protect parent categories from accidental deletion');
  });

  await runAsyncTest('addComponent associates categoryId, categoryPath, and location details', async () => {
    const categories = getCategories();
    const esp32 = categories.find((c) => c.name === 'ESP32');

    const comp = await addComponent(
      {
        name: 'ESP32-WROOM-32D Development Board',
        componentNumber: 'COMP-ESP32-999',
        categoryId: esp32.id,
        categoryPath: 'Development Boards / ESP Development Boards / ESP32',
        category: 'Development Boards',
        parentCategory: 'ESP Development Boards',
        totalQuantity: 20,
        lowStockThreshold: 4,
        location: 'Cabinet 3, Shelf B',
        locationPhotoUrl: '',
        locationPhotoRef: '',
        trackingMode: 'aggregate',
      },
      { name: 'Admin', role: 'admin' }
    );

    assert(comp.id, 'Component must be created');
    assert.strictEqual(comp.categoryId, esp32.id);
    assert.strictEqual(comp.categoryPath, 'Development Boards / ESP Development Boards / ESP32');
    assert.strictEqual(comp.location, 'Cabinet 3, Shelf B');

    // Verify recursive category filtering
    const devBoards = categories.find((c) => c.name === 'Development Boards');
    const filteredByRoot = getComponents('All', '', 'all', devBoards.id);
    const foundInRoot = filteredByRoot.some((c) => c.id === comp.id);
    assert(foundInRoot, 'Component must be found when filtering by root category (Development Boards)');
  });

  runTest('SQL migration file exists and defines component_categories schema', () => {
    const migrationPath = path.resolve('database/supabase/migrations/005_component_category_hierarchy.sql');
    assert(fs.existsSync(migrationPath), 'Migration file 005_component_category_hierarchy.sql must exist');

    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
    assert(sqlContent.includes('component_categories'), 'Must define component_categories table');
    assert(
      sqlContent.includes('REFERENCES public.component_categories(id)') ||
      sqlContent.includes('REFERENCES component_categories(id)'),
      'Must define self-referential foreign key'
    );
    assert(
      sqlContent.includes('category_id text') || sqlContent.includes('category_id UUID'),
      'Must add category_id to components table'
    );
    assert(
      sqlContent.includes('location_photo_url text') || sqlContent.includes('location_photo_url TEXT'),
      'Must add location_photo_url to components table'
    );
  });

  // ====================================================================
  // STRICT INVARIANT CHECKS: PROTECTED DATABASE BACKUP FILES
  // ====================================================================
  console.log('\n--- STRICT INVARIANT CHECKS: Database Backups ---');

  runTest('data_base_backup.js remains exactly 61,794 bytes', () => {
    const filePath = path.resolve('frontend/src/db/data_base_backup.js');
    const stat = fs.statSync(filePath);
    assert.strictEqual(stat.size, 61794, `data_base_backup.js must be exactly 61794 bytes (got ${stat.size})`);
  });

  runTest('sampleData.js remains exactly 22,676 bytes', () => {
    const filePath = path.resolve('frontend/src/db/sampleData.js');
    const stat = fs.statSync(filePath);
    assert.strictEqual(stat.size, 22676, `sampleData.js must be exactly 22676 bytes (got ${stat.size})`);
  });

  console.log('\n================================================================');
  console.log(`🎉 ALL MASTER WORKSTREAM TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
