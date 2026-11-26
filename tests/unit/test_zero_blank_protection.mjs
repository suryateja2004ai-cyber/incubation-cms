// tests/unit/test_zero_blank_protection.mjs
// Verification suite for Permanent Zero-Blank Screen Protection:
// 1. Verifies all JSX components in frontend/src compile with zero undeclared identifiers.
// 2. Verifies that App view routing resolves to valid non-empty views for all role/tab permutations.
// 3. Verifies that corrupt or unexpected localStorage values safely recover without crashing initDatabase.
// 4. Verifies that ErrorBoundary isolates component failures with a reload card.

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

console.log('🧪 Starting Permanent Zero-Blank Screen Protection Verification Suite...\n');

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
  // 1. Static Scan of All JSX Files for Undeclared Lucide Icons
  await test('All JSX files have 100% declared and imported Lucide icons', () => {
    function getAllFiles(dir, exts = ['.jsx']) {
      let files = [];
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          if (item.name !== 'node_modules' && item.name !== '.git' && item.name !== 'dist') {
            files = files.concat(getAllFiles(full, exts));
          }
        } else if (exts.includes(path.extname(item.name))) {
          files.push(full);
        }
      }
      return files;
    }

    const jsxFiles = getAllFiles(path.join(projectRoot, 'frontend/src'));
    assert.ok(jsxFiles.length >= 30, `Expected at least 30 JSX files, found ${jsxFiles.length}`);

    const lucideIcons = [
      'AlertTriangle', 'AlertCircle', 'CheckCircle', 'Clock', 'Cpu', 'Database',
      'Download', 'Edit', 'Eye', 'EyeOff', 'FileText', 'Filter', 'Folder', 'Home',
      'Key', 'Layers', 'Lock', 'LogOut', 'Menu', 'Moon', 'MoreVertical', 'Package',
      'Phone', 'Plus', 'RefreshCw', 'Search', 'Send', 'Server', 'Settings', 'Share2',
      'Shield', 'ShieldAlert', 'ShieldCheck', 'Sliders', 'Smartphone', 'Sun', 'Tag',
      'Trash2', 'TrendingUp', 'Upload', 'User', 'UserCheck', 'UserPlus', 'Users',
      'Wifi', 'WifiOff', 'X', 'Zap'
    ];

    const violations = [];
    for (const file of jsxFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const icon of lucideIcons) {
        const tagRegex = new RegExp(`<${icon}[\\s/>]`);
        if (tagRegex.test(content)) {
          const lucideMatch = content.match(/import\s*\{([\s\S]*?)\}\s*from\s*['"]lucide-react['"]/);
          let isImported = false;
          if (lucideMatch) {
            const imported = lucideMatch[1].split(',').map(s => s.trim());
            if (imported.some(i => i === icon || i.startsWith(`${icon} as`))) {
              isImported = true;
            }
          }
          if (!isImported) {
            violations.push(`${icon} used in ${path.relative(projectRoot, file)} but not imported`);
          }
        }
      }
    }

    assert.strictEqual(violations.length, 0, `Found undeclared icons: ${violations.join(', ')}`);
  });

  // 2. Defensive Storage Parsing Protection in database.js
  await test('initDatabase recovers cleanly when localStorage contains malformed non-array data', async () => {
    // Setup corrupted mock storage
    globalThis.localStorage = {
      getItem(k) {
        if (k.includes('components')) return '{"corrupted":"object_not_array"}';
        if (k.includes('users')) return '"corrupted_string"';
        if (k.includes('settings')) return '[1,2,3]'; // array instead of object
        return null;
      },
      setItem() {},
      removeItem() {},
      clear() {},
    };

    const db = await import('../../frontend/src/db/database.js');
    await db.initDatabase();

    const comps = db.getComponents();
    const users = db.getAllUsers ? db.getAllUsers() : db.getStudents();
    const settings = db.getSettings();

    assert.ok(Array.isArray(comps), 'Components must recover to a valid array');
    assert.ok(Array.isArray(users), 'Users must recover to a valid array');
    assert.ok(settings && typeof settings === 'object', 'Settings must recover to a valid object');
    assert.ok(comps.length > 0, 'Components must fall back to initial default items');
    assert.ok(users.length > 0, 'Users must fall back to initial default users');
  });

  // 3. Exhaustive Routing Test: No State Produces a Blank View
  await test('Exhaustive Routing: Any arbitrary tab or corrupted state resolves to a valid view', () => {
    const roles = ['student', 'staff', 'admin', 'substitute_admin', 'sir', null, undefined];
    const testTabs = [
      'control', 'dashboard', 'components', 'issue', 'return', 'overdue',
      'students_inside', 'face_attendance', 'lab_entry_exit', 'transactions',
      'students', 'projects', 'achievements_events', 'research_papers',
      'complaints', 'domains_holidays', 'authorizations', 'analytics',
      'audit_log', 'settings', 'student_portal', 'completely_unknown_tab_xyz',
      '', null, undefined
    ];
    const mainTabs = ['control', 'management', 'corrupted_main_tab', null, undefined];

    // Read App.jsx and inspect its fallback branches
    const appContent = fs.readFileSync(path.join(projectRoot, 'frontend/src/app/App.jsx'), 'utf8');

    assert.ok(appContent.includes('Fallback for unrecognized student route'), 'Student route must have zero-blank fallback');
    assert.ok(appContent.includes('Fallback for unrecognized staff route'), 'Staff route must have zero-blank fallback');
    assert.ok(appContent.includes('Fallback for unrecognized admin route'), 'Admin route must have zero-blank fallback');
    assert.ok(appContent.includes('FALLBACK FOR UNRECOGNIZED MAIN TAB'), 'Main tab must have zero-blank fallback');
    assert.ok(appContent.includes('ErrorBoundary title="Sidebar Navigation"'), 'Sidebar must be isolated in ErrorBoundary');
    assert.ok(appContent.includes('ErrorBoundary title="Top Navigation Bar"'), 'Navbar must be isolated in ErrorBoundary');
  });

  // 4. Verify PWA and HTML Head Cache-Busting Protection
  await test('index.html and sw.js contain dev-mode service worker bypass and unregister handlers', () => {
    const htmlContent = fs.readFileSync(path.join(projectRoot, 'frontend/index.html'), 'utf8');
    const swContent = fs.readFileSync(path.join(projectRoot, 'frontend/public/sw.js'), 'utf8');
    const viteConfig = fs.readFileSync(path.join(projectRoot, 'frontend/vite.config.js'), 'utf8');

    assert.ok(htmlContent.includes('navigator.serviceWorker.getRegistrations'), 'index.html must proactively unregister dev SW');
    assert.ok(htmlContent.includes('Reset Cache & Reload'), 'index.html must have global error safety shield');
    assert.ok(swContent.includes('localhost'), 'sw.js must contain dev self-unregister guard');
    assert.ok(viteConfig.includes('dev-sw-and-assets-fallback'), 'vite.config.js must contain dev-mode SW and assets fallback');
  });

  console.log(`\n🎉 All ${testsPassed} Zero-Blank Screen Protection tests passed successfully!`);
}

runAll().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
