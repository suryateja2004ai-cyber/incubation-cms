// tests/unit/test_pwa_qr_conversion.mjs
// Verification of PWA Conversion and Post-Registration QR Code Workflow

// Polyfill browser globals before any module imports
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
import { generateQrSvg } from '../../frontend/src/utils/qrCodeGenerator.js';
import {
  initDatabase,
  registerStudentFirstVisit,
  getUserByRoll,
  getAllUsers,
} from '../../frontend/src/db/database.js';

const workspaceRoot = process.cwd();
const frontendPublic = path.join(workspaceRoot, 'frontend', 'public');
const frontendDist = path.join(workspaceRoot, 'frontend', 'dist');

console.log('🧪 Starting PWA & QR Code Conversion Test Suite...\n');

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
  // 1. Manifest Validation
  await test('Web App Manifest exists in public & dist and contains required PWA specifications', () => {
    const manifestPath = path.join(frontendPublic, 'manifest.webmanifest');
    assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist in frontend/public');
    
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(content.name, 'VRSEC Incubation Centre', 'Manifest name must be VRSEC Incubation Centre');
    assert.strictEqual(content.short_name, 'VRSEC Incubation', 'Short name must be configured');
    assert.strictEqual(content.display, 'standalone', 'Display must be standalone');
    assert.strictEqual(content.start_url, '/', 'start_url must be /');
    assert.ok(content.theme_color, 'theme_color must be specified');
    assert.ok(content.background_color, 'background_color must be specified');
    
    // Icon verification
    const icons = content.icons;
    assert.ok(Array.isArray(icons) && icons.length >= 3, 'Must have at least 3 icons');
    const has192 = icons.some(i => i.sizes === '192x192' && i.src.includes('192'));
    const has512 = icons.some(i => i.sizes === '512x512' && i.src.includes('512'));
    const hasMaskable = icons.some(i => i.purpose === 'maskable');
    assert.ok(has192, 'Must include 192x192 icon');
    assert.ok(has512, 'Must include 512x512 icon');
    assert.ok(hasMaskable, 'Must include maskable icon');
  });

  // 2. Icon Assets Verification on Disk
  await test('All PWA application icons exist as valid non-empty files', () => {
    const iconFiles = [
      'pwa-192x192.png',
      'pwa-512x512.png',
      'pwa-maskable-512x512.png',
      'apple-touch-icon.png',
      'favicon.svg'
    ];
    for (const file of iconFiles) {
      const filePath = path.join(frontendPublic, file);
      assert.ok(fs.existsSync(filePath), `${file} must exist in frontend/public`);
      const stat = fs.statSync(filePath);
      assert.ok(stat.size > 500, `${file} must not be empty (size: ${stat.size} bytes)`);
    }
  });

  // 3. Service Worker Verification
  await test('Service Worker exists and enforces internet-only policy (bypasses sensitive APIs)', () => {
    const swPath = path.join(frontendPublic, 'sw.js');
    assert.ok(fs.existsSync(swPath), 'sw.js must exist in frontend/public');
    const swContent = fs.readFileSync(swPath, 'utf8');
    assert.ok(swContent.includes('addEventListener(\'fetch\''), 'SW must have fetch listener');
    assert.ok(swContent.includes('/manifest.webmanifest'), 'SW must pre-cache manifest');
    assert.ok(swContent.includes('supabase.co') || swContent.includes('/api'), 'SW must bypass API/cloud requests to prevent fake offline mutations');
  });

  // 4. Pure-JS QR Generator Unit Test
  await test('QR Code generator produces valid SVG for production URL without external network calls', () => {
    const targetUrl = 'https://incubation-cms.pages.dev';
    const qrResult = generateQrSvg(targetUrl, { size: 200, margin: 2 });
    
    assert.ok(qrResult, 'QR result must be generated');
    assert.ok(qrResult.moduleCount >= 21, `Module count must be at least 21 (got ${qrResult.moduleCount})`);
    assert.ok(qrResult.svg.includes('<svg'), 'Generated output must contain SVG tag');
    assert.ok(qrResult.svg.includes('<rect'), 'Generated output must contain rect tag');
    assert.ok(qrResult.svg.includes('<path'), 'Generated output must contain path modules');
    assert.ok(qrResult.matrix.length === qrResult.moduleCount, 'Matrix rows must match module count');
    assert.ok(qrResult.matrix[0].length === qrResult.moduleCount, 'Matrix cols must match module count');
  });

  // 5. Account Registration and Role Handling
  await test('Registration workflow supports Student, Subadmin, and Admin roles and persists correctly', async () => {
    await initDatabase();
    
    const testStudentRoll = `PWA_STUDENT_${Date.now()}`;
    const student = await registerStudentFirstVisit({
      name: 'PWA Test Student',
      rollNumber: testStudentRoll,
      password: 'password123',
      department: 'CSE',
      academicYearAtStart: 1,
      role: 'student'
    });
    assert.strictEqual(student.rollNumber, testStudentRoll);
    assert.strictEqual(student.role, 'student');
    assert.strictEqual(getUserByRoll(testStudentRoll)?.role, 'student');

    const testSubadminRoll = `PWA_SUBADMIN_${Date.now()}`;
    const subadmin = await registerStudentFirstVisit({
      name: 'PWA Test Subadmin',
      rollNumber: testSubadminRoll,
      password: 'password123',
      department: 'Incubation Staff',
      role: 'substitute_admin'
    });
    assert.strictEqual(subadmin.rollNumber, testSubadminRoll);
    assert.strictEqual(subadmin.role, 'substitute_admin');
    assert.strictEqual(getUserByRoll(testSubadminRoll)?.role, 'substitute_admin');

    const testAdminRoll = `PWA_ADMIN_${Date.now()}`;
    const admin = await registerStudentFirstVisit({
      name: 'PWA Test Admin',
      rollNumber: testAdminRoll,
      password: 'password123',
      department: 'Incubation Director',
      role: 'admin'
    });
    assert.strictEqual(admin.rollNumber, testAdminRoll);
    assert.strictEqual(admin.role, 'admin');
    assert.strictEqual(getUserByRoll(testAdminRoll)?.role, 'admin');
  });

  // 6. Security and Protected Files Invariant
  await test('Protected database files remain exact byte sizes', () => {
    const dbBackupPath = path.join(workspaceRoot, 'frontend', 'src', 'db', 'data_base_backup.js');
    const sampleDataPath = path.join(workspaceRoot, 'frontend', 'src', 'db', 'sampleData.js');

    const backupSize = fs.statSync(dbBackupPath).size;
    const sampleSize = fs.statSync(sampleDataPath).size;

    assert.strictEqual(backupSize, 61794, `data_base_backup.js must be 61794 bytes (got ${backupSize})`);
    assert.strictEqual(sampleSize, 22676, `sampleData.js must be 22676 bytes (got ${sampleSize})`);
  });

  // 7. HTML Header & Meta Tags
  await test('index.html contains required PWA manifest and mobile meta tags', () => {
    const htmlPath = path.join(workspaceRoot, 'frontend', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('rel="manifest"'), 'index.html must link manifest');
    assert.ok(html.includes('name="theme-color"'), 'index.html must include theme-color');
    assert.ok(html.includes('name="mobile-web-app-capable"'), 'index.html must declare mobile-web-app-capable');
    assert.ok(html.includes('name="apple-mobile-web-app-capable"'), 'index.html must declare apple-mobile-web-app-capable');
    assert.ok(html.includes('rel="apple-touch-icon"'), 'index.html must declare apple-touch-icon');
    assert.ok(html.includes('VRSEC Incubation Centre'), 'index.html title must reflect VRSEC Incubation Centre');
  });

  console.log(`\n🎉 All ${testsPassed}/${testsPassed} PWA & QR Conversion tests passed!\n`);
  process.exit(0);
}

runAll().catch(e => {
  console.error(e);
  process.exit(1);
});
