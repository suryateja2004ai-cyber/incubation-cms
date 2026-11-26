// tests/unit/test_three_changes.mjs
// Verification suite for the three requested website changes:
// 1. Complete removal of fingerprint functionality & preservation of face recognition
// 2. Automatic saving and retrieval of student phone numbers in student accounts via component issuing
// 3. QR Code Choice Screen ("Install as App" vs "Continue on Web") & target URL

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);

// Polyfill browser globals
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

import {
  initDatabase,
  resetDatabaseToSample,
  registerStudentFirstVisit,
  getUserByRoll,
  issueComponents,
  getComponents,
  recordLabEntry,
  recordLabExit,
} from '../../frontend/src/db/database.js';

import { biometricService } from '../../frontend/src/services/biometric/biometricService.js';

console.log('================================================================');
console.log('🧪 VERIFICATION SUITE: THREE WEBSITE CHANGES');
console.log('================================================================\n');

let testsPassed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

async function runAll() {
  await initDatabase();
  resetDatabaseToSample();

  // -------------------------------------------------------------------------
  console.log('--- REQUIREMENT 1: Completely Remove Fingerprint Functionality ---');
  // -------------------------------------------------------------------------

  await test('biometricService no longer contains R305 or fingerprint enrollment/matching methods', () => {
    assert.strictEqual(typeof biometricService.identifyFingerprint, 'undefined', 'identifyFingerprint must be removed');
    assert.strictEqual(typeof biometricService.enrollThreeFingers, 'undefined', 'enrollThreeFingers must be removed');
    assert.strictEqual(typeof biometricService.connectR305, 'undefined', 'connectR305 must be removed');
    assert.strictEqual(biometricService.r305Port, undefined, 'r305Port property must be removed');
    assert.strictEqual(biometricService.r305Connected, undefined, 'r305Connected property must be removed');
  });

  await test('Face recognition and manual identification are preserved and fully functional', async () => {
    assert.strictEqual(typeof biometricService.identifyFace, 'function', 'identifyFace must be preserved');
    assert.strictEqual(typeof biometricService.identifyManual, 'function', 'identifyManual must be preserved');
    assert.strictEqual(typeof biometricService.registerFaceEncoding, 'function', 'registerFaceEncoding must be preserved');

    // Test manual lookup
    const manualResult = biometricService.identifyManual('238W1A0477');
    assert.ok(manualResult.success, 'Manual lookup must succeed');
    assert.strictEqual(manualResult.rollNumber, '238W1A0477');

    // Test face identification
    const faceResult = await biometricService.identifyFace('238W1A0477');
    assert.ok(faceResult.success, 'Face identification must succeed');
    assert.strictEqual(faceResult.rollNumber, '238W1A0477');
  });

  await test('recordLabEntry and recordLabExit default to "face" instead of "fingerprint"', async () => {
    // Student 238W1A0412 is outside lab initially
    const entryRes = await recordLabEntry('238W1A0412');
    assert.ok(entryRes.success, 'Entry must succeed');
    assert.strictEqual(entryRes.visit.entryMethod, 'face', 'Default entryMethod must be face');

    const exitRes = await recordLabExit('238W1A0412');
    assert.ok(exitRes.success, 'Exit must succeed');
    assert.strictEqual(exitRes.visit.exitMethod, 'face', 'Default exitMethod must be face');
  });

  await test('Active UI pages have 0 fingerprint references', () => {
    const filesToCheck = [
      'frontend/src/pages/lab/LabEntryExit.jsx',
      'frontend/src/components/layout/Sidebar.jsx',
      'frontend/src/pages/admin/Students.jsx',
      'frontend/src/pages/admin/Dashboard.jsx',
      'frontend/src/pages/auth/Login.jsx',
      'frontend/src/pages/lab/StudentsInside.jsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.join(workspaceRoot, relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(
        !content.toLowerCase().includes('fingerprint') && !content.toLowerCase().includes('r305'),
        `${relPath} must not contain any fingerprint or r305 references`
      );
    }
  });

  // -------------------------------------------------------------------------
  console.log('\n--- REQUIREMENT 2: Save Phone Numbers Automatically in Student Accounts ---');
  // -------------------------------------------------------------------------

  const studentRollNoPhone = 'PHONE_TEST_001';
  let studentAccount = null;

  await test('Student registered without phone number has empty mobileNumber', async () => {
    studentAccount = await registerStudentFirstVisit({
      name: 'Phone Test Student',
      rollNumber: studentRollNoPhone,
      password: 'testpassword123',
      department: 'ECE',
      mobileNumber: '', // Phone number optional at registration
      academicYearAtStart: 1,
    });

    assert.strictEqual(studentAccount.rollNumber, studentRollNoPhone);
    assert.strictEqual(studentAccount.mobileNumber, '');

    const fetched = getUserByRoll(studentRollNoPhone);
    assert.strictEqual(fetched.mobileNumber, '');
  });

  await test('issueComponents automatically saves entered phone number into student account', async () => {
    const components = getComponents();
    const testComp = components[0];
    assert.ok(testComp, 'Must have at least one component');

    const adminActor = { name: 'Admin User', role: 'admin' };
    const enteredPhone = '9876543210';

    const txn = await issueComponents({
      studentName: 'Phone Test Student',
      studentRoll: studentRollNoPhone,
      phone: enteredPhone,
      items: [
        {
          componentId: testComp.id,
          componentName: testComp.name,
          quantity: 1,
          selectedIndividualIds: testComp.trackingMode === 'individual'
            ? [testComp.individualIds.find(t => t.status === 'available')?.id].filter(Boolean)
            : [],
        },
      ],
      actor: adminActor,
    });

    assert.ok(txn.id, 'Transaction must be created');
    assert.strictEqual(txn.studentPhone, enteredPhone);

    // Verify student account in database was automatically updated
    const updatedUser = getUserByRoll(studentRollNoPhone);
    assert.strictEqual(
      updatedUser.mobileNumber,
      enteredPhone,
      'Student account mobileNumber must be automatically saved and updated'
    );
  });

  await test('Previously saved phone number auto-populates on subsequent queries without re-entry', () => {
    const student = getUserByRoll(studentRollNoPhone);
    assert.ok(student, 'Student must exist');
    // Emulates checkStudentRecords in IssueComponent.jsx:
    const populatedPhone = student.mobileNumber || student.phone || '';
    assert.strictEqual(populatedPhone, '9876543210', 'Phone number must auto-populate');
  });

  await test('An empty phone string does not overwrite an existing phone number', async () => {
    const components = getComponents();
    const testComp = components[0];

    await issueComponents({
      studentName: 'Phone Test Student',
      studentRoll: studentRollNoPhone,
      phone: '', // Empty phone passed
      items: [
        {
          componentId: testComp.id,
          componentName: testComp.name,
          quantity: 1,
          selectedIndividualIds: testComp.trackingMode === 'individual'
            ? [testComp.individualIds.find(t => t.status === 'available')?.id].filter(Boolean)
            : [],
        },
      ],
      actor: { name: 'Admin User', role: 'admin' },
    });

    const student = getUserByRoll(studentRollNoPhone);
    assert.strictEqual(
      student.mobileNumber,
      '9876543210',
      'Existing phone number must NOT be overwritten by an empty string'
    );
  });

  // -------------------------------------------------------------------------
  console.log('\n--- REQUIREMENT 3: QR Code Choice Screen ("Install as App" vs "Continue on Web") ---');
  // -------------------------------------------------------------------------

  // Bundle QR components with esbuild for CJS execution
  await esbuild.build({
    entryPoints: [
      path.join(workspaceRoot, 'frontend/src/components/common/AppInstallQrCard.jsx'),
      path.join(workspaceRoot, 'frontend/src/components/common/QrEntryChoiceModal.jsx'),
    ],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    outdir: path.join(workspaceRoot, 'tests/unit/temp_dist'),
    outExtension: { '.js': '.cjs' },
    external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/server'],
  });

  const AppInstallQrCardModule = require('./temp_dist/AppInstallQrCard.cjs');
  const QrEntryChoiceModalModule = require('./temp_dist/QrEntryChoiceModal.cjs');
  const QrEntryChoiceModal = QrEntryChoiceModalModule.default || QrEntryChoiceModalModule;
  const { getAppInstallationUrl, DEFAULT_APP_URL } = AppInstallQrCardModule;

  // Cleanup temp bundle directory
  try {
    fs.rmSync(path.join(workspaceRoot, 'tests/unit/temp_dist'), { recursive: true, force: true });
  } catch (e) {}

  await test('getAppInstallationUrl generates production URL with ?entry=qr query parameter', () => {
    const qrUrl = getAppInstallationUrl();
    assert.ok(qrUrl.includes('entry=qr'), `QR URL must contain entry=qr (got: ${qrUrl})`);
    assert.ok(qrUrl.startsWith('https://incubation-cms.pages.dev'), `QR URL must start with production host`);
    assert.strictEqual(DEFAULT_APP_URL, 'https://incubation-cms.pages.dev/?entry=qr');
  });

  await test('QrEntryChoiceModal renders required header and choice prompt', () => {
    const html = renderToString(
      React.createElement(QrEntryChoiceModal, {
        isOpen: true,
        onClose: () => {},
        deferredPrompt: null,
      })
    );

    assert.ok(html.includes('Welcome to Incubation Centre Management System'), 'Must render exact welcome header');
    assert.ok(html.includes('How would you like to access the website?'), 'Must render exact choice question');
    assert.ok(html.includes('Install as an App'), 'Must contain Install as an App option');
    assert.ok(html.includes('Continue as Web'), 'Must contain Continue as Web option');
  });

  await test('QrEntryChoiceModal returns null when isOpen is false', () => {
    const html = renderToString(
      React.createElement(QrEntryChoiceModal, {
        isOpen: false,
        onClose: () => {},
      })
    );
    assert.strictEqual(html, '', 'Must not render when isOpen is false');
  });

  // -------------------------------------------------------------------------
  console.log('\n--- STRICT INVARIANT CHECKS: Database Backups ---');
  // -------------------------------------------------------------------------

  await test('Protected database files remain exact byte sizes', () => {
    const dbBackupPath = path.join(workspaceRoot, 'frontend', 'src', 'db', 'data_base_backup.js');
    const sampleDataPath = path.join(workspaceRoot, 'frontend', 'src', 'db', 'sampleData.js');

    const backupSize = fs.statSync(dbBackupPath).size;
    const sampleSize = fs.statSync(sampleDataPath).size;

    assert.strictEqual(backupSize, 61794, `data_base_backup.js must be 61794 bytes (got ${backupSize})`);
    assert.strictEqual(sampleSize, 22676, `sampleData.js must be 22676 bytes (got ${sampleSize})`);
  });

  console.log(`\n================================================================`);
  console.log(`🎉 ALL ${testsPassed}/${testsPassed} THREE-CHANGES VERIFICATION TESTS PASSED!`);
  console.log(`================================================================\n`);
  process.exit(0);
}

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
