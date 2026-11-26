// tests/unit/test_student_login_reconciliation.mjs
// Comprehensive unit tests for student login auth ordering, local cache reconciliation,
// nullable is_active mapping, server deactivation enforcement, offline security, and
// registration fallback warnings.

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');

const storageMap = new Map();
const mockLocalStorage = {
  getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
  setItem: (key, val) => storageMap.set(key, String(val)),
  removeItem: (key) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

try {
  globalThis.localStorage = mockLocalStorage;
} catch {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });
}

const { fromDbRow } = await import('../../frontend/src/db/schemaMapper.js');
const { supabase } = await import('../../frontend/src/lib/supabase.js');
const {
  initDatabase,
  loginUser,
  getCurrentUser,
  setCurrentUser,
  getAllUsers,
  getUserByRoll,
  getStudentPersonalStats,
  registerStudentFirstVisit,
  activateStudentLogin,
  resetStudentPassword,
} = await import('../../frontend/src/db/database.js');
const { INITIAL_USERS } = await import('../../frontend/src/db/sampleData.js');

console.log('===================================================================');
console.log('🧪 STUDENT LOGIN, RECONCILIATION & FALLBACK WARNING TEST SUITE');
console.log('===================================================================\n');

let passed = 0;
let total = 0;

async function runTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✓ [PASS] Test ${total}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] Test ${total}: ${name}`);
    console.error('    Error:', err.message);
    process.exitCode = 1;
    throw err;
  }
}

async function withMockedSupabase(overrides, fn) {
  const origSignIn = supabase.auth.signInWithPassword;
  const origSignOut = supabase.auth.signOut;
  const origGetSession = supabase.auth.getSession;
  const origRpc = supabase.rpc;
  const origFrom = supabase.from;

  let signOutCalls = 0;
  try {
    if (overrides.signInWithPassword) supabase.auth.signInWithPassword = overrides.signInWithPassword;
    if (overrides.getSession) supabase.auth.getSession = overrides.getSession;
    supabase.auth.signOut = async (...args) => {
      signOutCalls++;
      if (overrides.signOut) return overrides.signOut(...args);
      return { error: null };
    };
    if (overrides.rpc) supabase.rpc = overrides.rpc;
    if (overrides.from) supabase.from = overrides.from;

    await fn({ getSignOutCalls: () => signOutCalls });
  } finally {
    supabase.auth.signInWithPassword = origSignIn;
    supabase.auth.signOut = origSignOut;
    supabase.auth.getSession = origGetSession;
    supabase.rpc = origRpc;
    supabase.from = origFrom;
  }
}

async function main() {
  // Seed dirty pre-existing local cache BEFORE initDatabase() loads it into memoryStore.users
  const preSeededUsers = [
    ...INITIAL_USERS.map((u) => ({ ...u })),
    // Duplicate + stale pending records for valid student 238W1A0901
    {
      id: 'USER-STALE-901-A',
      authId: null,
      rollNumber: '238W1A0901',
      name: 'Spoofed Local Name',
      role: 'admin',
      status: 'pending_verification',
      verificationStatus: 'pending_roster_verification',
      membershipStatus: 'pending_verification',
      isActive: false,
      localOnlyFallback: true,
      fingerprintIds: [111, 222, 333],
      incubationStartDate: '2025-07-01',
    },
    {
      id: 'USER-STALE-901-B',
      authId: null,
      rollNumber: '238w1a0901',
      name: 'Duplicate Stale Copy',
      role: 'student',
      status: 'pending_verification',
      verificationStatus: 'pending_roster_verification',
      isActive: false,
    },
    // Student whose Supabase public.users row has is_active: null, cached locally as pending
    {
      id: 'USER-NULL-ACTIVE',
      authId: null,
      rollNumber: '238W1A0902',
      name: 'Nullable Active Local',
      role: 'student',
      status: 'pending_verification',
      verificationStatus: 'pending_roster_verification',
      isActive: false,
    },
    // Student cached as active locally even though server deactivated them
    {
      id: 'USER-DEACT-903',
      authId: 'auth-903',
      rollNumber: '238W1A0903',
      name: 'Deactivated Server Student',
      role: 'student',
      status: 'active',
      verificationStatus: 'verified',
      isActive: true,
    },
    // Non-demo active local student (must NOT log in offline using hardcoded passwords)
    {
      id: 'USER-LOCAL-ACTIVE-904',
      authId: null,
      rollNumber: '238W1A0904',
      name: 'Unverified Active-Flagged Student',
      role: 'student',
      status: 'active',
      passwordHash: 'localpass123',
      isActive: true,
    },
    // Unrelated user that must remain intact during reconciliation
    {
      id: 'USER-UNRELATED-999',
      authId: 'auth-999',
      rollNumber: '238W1A0999',
      name: 'Unrelated Student',
      role: 'student',
      status: 'active',
      isActive: true,
    },
  ];
  mockLocalStorage.setItem('inc_cms_users_v2', JSON.stringify(preSeededUsers));
  await initDatabase();

  // Wait briefly for initial background cloud refresh to settle before mocking globalThis.fetch
  const { resolveAuthenticatedProfile } = await import('../../frontend/src/db/database.js');

  // 1. Nullable is_active schema mapping
  await runTest('schemaMapper preserves is_active null without coercing to false or assuming true', () => {
    const tables = ['users', 'get_my_profile', 'student_directory', 'staff_student_directory', 'my_profile'];
    for (const table of tables) {
      const mappedNull = fromDbRow(table, { id: 'U1', is_active: null });
      assert.strictEqual(mappedNull.isActive, null, `${table}: null must stay null`);

      const mappedFalse = fromDbRow(table, { id: 'U2', is_active: false });
      assert.strictEqual(mappedFalse.isActive, false, `${table}: false must map to false`);

      const mappedTrue = fromDbRow(table, { id: 'U3', is_active: true });
      assert.strictEqual(mappedTrue.isActive, true, `${table}: true must map to true`);

      const mappedUndef = fromDbRow(table, { id: 'U4' });
      assert.strictEqual(mappedUndef.isActive, undefined, `${table}: undefined must remain undefined`);
    }
  });

  // 2. Stale pending flags + duplicates in local cache do not block valid Supabase login & reconcile cleanly
  await runTest('Valid Supabase login succeeds despite stale pending flags and collapses duplicate local records', async () => {
    let authCalled = false;
    await withMockedSupabase(
      {
        signInWithPassword: async ({ email, password }) => {
          authCalled = true;
          assert.strictEqual(email, '238w1a0901@student.incubation.local');
          assert.strictEqual(password, 'RealPass@123');
          return { data: { user: { id: 'auth-901', email } }, error: null };
        },
        rpc: async (fn) => {
          assert.strictEqual(fn, 'get_my_profile');
          return {
            data: [{
              id: 'USER-DB-901',
              auth_id: 'auth-901',
              roll_number: '238W1A0901',
              name: 'Verified Server Student',
              role: 'student',
              department: 'CSE',
              is_active: true,
              face_registered: true,
            }],
            error: null,
          };
        },
      },
      async () => {
        const user = await loginUser('238W1A0901', 'RealPass@123');
        assert.strictEqual(authCalled, true, 'Supabase Auth must be attempted before inspecting local cache');
        assert.strictEqual(user.id, 'USER-DB-901');
        assert.strictEqual(user.authId, 'auth-901');
        assert.strictEqual(user.name, 'Verified Server Student', 'Authoritative server name must win over spoofed local name');
        assert.strictEqual(user.role, 'student', 'Authoritative server role must win over spoofed local role');
        assert.strictEqual(user.isActive, true);
        assert.strictEqual(user.status, 'active');
        assert.strictEqual(user.verificationStatus, 'verified');
        assert.strictEqual(user.membershipStatus, 'active');
        assert.strictEqual(user.serverVerified, true);
        assert.strictEqual(user.localOnlyFallback, false);
        assert.deepStrictEqual(user.fingerprintIds, [111, 222, 333], 'Non-authoritative local fields absent on server should be preserved');
        assert.strictEqual(user.incubationStartDate, '2025-07-01');
      }
    );

    const matchingRecords = getAllUsers().filter(
      (u) => u.rollNumber && u.rollNumber.toUpperCase() === '238W1A0901'
    );
    assert.strictEqual(matchingRecords.length, 1, 'Duplicate local records for 238W1A0901 must be collapsed into 1');
    assert.strictEqual(matchingRecords[0].status, 'active');

    const unrelated = getAllUsers().find((u) => u.rollNumber === '238W1A0999');
    assert.ok(unrelated && unrelated.name === 'Unrelated Student', 'Unrelated local users must be preserved');

    const persistedUsers = JSON.parse(mockLocalStorage.getItem('inc_cms_users_v2'));
    assert.strictEqual(
      persistedUsers.filter((u) => u.rollNumber && u.rollNumber.toUpperCase() === '238W1A0901').length,
      1,
      'Deduplicated reconciled record must be persisted to local cache'
    );

    // Re-login after reconciliation (case-insensitive roll number and full email)
    await withMockedSupabase(
      {
        signInWithPassword: async ({ email }) => ({
          data: { user: { id: 'auth-901', email } },
          error: null,
        }),
        rpc: async () => ({
          data: [{
            id: 'USER-DB-901',
            auth_id: 'auth-901',
            roll_number: '238W1A0901',
            name: 'Verified Server Student',
            role: 'student',
            is_active: true,
          }],
          error: null,
        }),
      },
      async () => {
        const againByLowerRoll = await loginUser('238w1a0901', 'RealPass@123');
        assert.strictEqual(againByLowerRoll.id, 'USER-DB-901');
        const againByEmail = await loginUser('238w1a0901@student.incubation.local', 'RealPass@123');
        assert.strictEqual(againByEmail.id, 'USER-DB-901');
      }
    );
  });

  // 3. Re-login after reconciliation + missing/nullable is_active on server
  await runTest('Server row with is_active: null succeeds without pending or deactivation errors', async () => {
    await withMockedSupabase(
      {
        signInWithPassword: async ({ email }) => ({
          data: { user: { id: 'auth-902', email } },
          error: null,
        }),
        rpc: async () => ({
          data: [{
            id: 'USER-DB-902',
            auth_id: 'auth-902',
            roll_number: '238W1A0902',
            name: 'Null IsActive Verified',
            role: 'student',
            is_active: null,
          }],
          error: null,
        }),
      },
      async () => {
        const profile = await loginUser('238W1A0902', 'Pass@902');
        assert.strictEqual(profile.rollNumber, '238W1A0902');
        assert.strictEqual(profile.isActive, null, 'Nullable server is_active must remain null');
        assert.strictEqual(profile.status, 'active');
        assert.strictEqual(profile.verificationStatus, 'verified');
      }
    );
  });

  // 4. Server-confirmed deactivation overrides active local cache
  await runTest('Deactivated Supabase user (is_active: false) is rejected even when local cache says active', async () => {
    setCurrentUser(null);
    await withMockedSupabase(
      {
        signInWithPassword: async ({ email }) => ({
          data: { user: { id: 'auth-903', email } },
          error: null,
        }),
        rpc: async () => ({
          data: [{
            id: 'USER-DEACT-903',
            auth_id: 'auth-903',
            roll_number: '238W1A0903',
            name: 'Deactivated Server Student',
            role: 'student',
            is_active: false,
          }],
          error: null,
        }),
      },
      async ({ getSignOutCalls }) => {
        await assert.rejects(
          async () => loginUser('238W1A0903', 'ValidPass903'),
          /Account is deactivated\. Please contact an administrator\./
        );
        assert.ok(getSignOutCalls() >= 1, 'Must sign out deactivated user from Supabase Auth');
        assert.strictEqual(getCurrentUser(), null, 'currentUser must remain null');
      }
    );

    const updatedLocal = getAllUsers().find((u) => u.rollNumber === '238W1A0903');
    assert.strictEqual(updatedLocal.isActive, false, 'Local cache must be reconciled to isActive: false');
  });

  // 5. Wrong password does not authenticate via offline fallback for regular student
  await runTest('Wrong password or offline fallback blocks unverified/non-demo student accounts', async () => {
    setCurrentUser(null);
    await withMockedSupabase(
      {
        signInWithPassword: async () => ({
          data: { user: null },
          error: { message: 'Invalid login credentials' },
        }),
      },
      async () => {
        await assert.rejects(
          async () => loginUser('238W1A0904', 'student123'),
          /Invalid login credentials/
        );
        await assert.rejects(
          async () => loginUser('238W1A0904', 'localpass123'),
          /Invalid login credentials/
        );
        assert.strictEqual(getCurrentUser(), null);
      }
    );
  });

  // 6. Supabase outage fails cleanly without bypassing pending or unverified local accounts
  await runTest('Supabase unavailable blocks pending local account and unverified local account', async () => {
    await registerStudentFirstVisit({
      name: 'Offline Only Pending Student',
      rollNumber: '238W1A0905',
      password: 'Password123!',
      department: 'CSE',
      academicYearAtStart: 1,
      role: 'student',
    });

    await withMockedSupabase(
      {
        signInWithPassword: async () => {
          throw new Error('Network request failed');
        },
      },
      async () => {
        await assert.rejects(
          async () => loginUser('238W1A0905', 'student123'),
          /Account pending server verification\. Roster enrollment must be verified when online\./
        );
        await assert.rejects(
          async () => loginUser('238W1A0904', 'localpass123'),
          /Network request failed/
        );
        assert.strictEqual(getCurrentUser(), null);
      }
    );
  });

  // 7. Missing server profile fails closed even if authUser succeeds and local cache exists
  await runTest('Auth success with missing server profile fails closed without falling back to localMatch', async () => {
    await withMockedSupabase(
      {
        signInWithPassword: async ({ email }) => ({
          data: { user: { id: 'orphan-auth-904', email } },
          error: null,
        }),
        rpc: async () => ({ data: [], error: null }),
        from: () => ({
          select: () => ({
            eq: () => ({ limit: () => ({ data: [], error: null }) }),
            or: () => ({ limit: () => ({ data: [], error: null }) }),
          }),
        }),
      },
      async ({ getSignOutCalls }) => {
        await assert.rejects(
          async () => loginUser('238W1A0904', 'AnyPass'),
          /Authentication failed: Unable to verify user profile and role from server\./
        );
        assert.ok(getSignOutCalls() >= 1);
        assert.strictEqual(getCurrentUser(), null);

        const resolvedStrict = await resolveAuthenticatedProfile(
          { id: 'orphan-auth-904', email: '238w1a0904@student.incubation.local' },
          { allowLocalFallback: false }
        );
        assert.strictEqual(resolvedStrict, null, 'allowLocalFallback: false must return null when server has no profile');
      }
    );
  });

  // 8. Existing quick-test demo credentials still work when Supabase Auth is unseeded/offline
  await runTest('Quick-test demo credentials continue to work with exact demo passwords while rejecting wrong demo passwords', async () => {
    await withMockedSupabase(
      {
        signInWithPassword: async () => ({
          data: { user: null },
          error: { message: 'Invalid login credentials' },
        }),
      },
      async () => {
        const adminUser = await loginUser('admin', 'admin123');
        assert.strictEqual(adminUser.role, 'admin');

        const subadminUser = await loginUser('subadmin', 'subadmin123');
        assert.strictEqual(subadminUser.role, 'substitute_admin');

        const demoStudent = await loginUser('238W1A0477', 'student123');
        assert.strictEqual(demoStudent.role, 'student');
        assert.strictEqual(demoStudent.rollNumber, '238W1A0477');

        await assert.rejects(
          async () => loginUser('238W1A0477', 'admin123'),
          /Invalid login credentials/
        );
      }
    );
  });

  // 9. Registration local fallback vs server-verified flags
  await runTest('registerStudentFirstVisit marks local-only fallback explicitly and marks serverVerified only on /api/register-student success', async () => {
    const localStudent = await registerStudentFirstVisit({
      name: 'Fallback Marker Test',
      rollNumber: '238W1A0906',
      password: 'Password123!',
      department: 'ECE',
      academicYearAtStart: 1,
      role: 'student',
    });
    assert.strictEqual(localStudent.serverVerified, false);
    assert.strictEqual(localStudent.localOnlyFallback, true);
    assert.strictEqual(localStudent.status, 'pending_verification');
    assert.strictEqual(localStudent.verificationStatus, 'pending_roster_verification');
    assert.ok(localStudent.fallbackReason, 'fallbackReason must be recorded');

    const localAdminFallback = await registerStudentFirstVisit({
      name: 'Local Fallback Subadmin',
      rollNumber: 'SUBADMIN906',
      password: 'Password123!',
      department: 'Staff',
      role: 'substitute_admin',
    });
    assert.strictEqual(localAdminFallback.serverVerified, false);
    assert.strictEqual(localAdminFallback.localOnlyFallback, true);
    assert.strictEqual(localAdminFallback.status, 'pending_server_registration');
    assert.strictEqual(localAdminFallback.verificationStatus, 'pending_server_registration');

    // Now simulate production host + authenticated operator + working /api/register-student
    const origWindow = globalThis.window;
    const origFetch = globalThis.fetch;
    setCurrentUser({ id: 'USER-001', rollNumber: 'admin', role: 'admin', token: 'op-jwt-token' });

    try {
      globalThis.window = {
        location: { hostname: 'vrsec-incubation.pages.dev' },
        localStorage: mockLocalStorage,
      };
      globalThis.fetch = async (url) => {
        if (String(url).includes('/api/register-student')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              user: {
                id: 'USER-SERVER-907',
                authId: 'auth-907',
                rollNumber: '238W1A0907',
                name: 'Server Verified Student',
                role: 'student',
                department: 'ECE',
              },
            }),
          };
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      };

      const serverUser = await registerStudentFirstVisit({
        name: 'Server Verified Student',
        rollNumber: '238W1A0907',
        password: 'Password123!',
        department: 'ECE',
        academicYearAtStart: 1,
        role: 'student',
      });
      assert.strictEqual(serverUser.serverVerified, true);
      assert.strictEqual(serverUser.localOnlyFallback, false);
      assert.strictEqual(serverUser.status, 'active');
      assert.strictEqual(serverUser.verificationStatus, 'verified');
      assert.strictEqual(serverUser.isActive, true);

      // Simulate /api/register-student HTTP 403 failure -> local fallback with detailed reason
      globalThis.fetch = async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Roll number not present in student roster' }),
      });

      const rejectedApiFallback = await registerStudentFirstVisit({
        name: 'Api Error Student',
        rollNumber: '238W1A0908',
        password: 'Password123!',
        department: 'ECE',
        academicYearAtStart: 1,
        role: 'student',
      });
      assert.strictEqual(rejectedApiFallback.serverVerified, false);
      assert.strictEqual(rejectedApiFallback.localOnlyFallback, true);
      assert.strictEqual(rejectedApiFallback.fallbackReason, 'api_error');
      assert.ok(rejectedApiFallback.fallbackDetail.includes('Roll number not present in student roster'));

      // Localhost fallback explicitly marks local_dev_host reason
      globalThis.window = {
        location: { hostname: 'localhost' },
        localStorage: mockLocalStorage,
      };
      const localhostFallback = await registerStudentFirstVisit({
        name: 'Localhost Dev Student',
        rollNumber: '238W1A0909',
        password: 'Password123!',
        department: 'ECE',
        academicYearAtStart: 1,
        role: 'student',
      });
      assert.strictEqual(localhostFallback.serverVerified, false);
      assert.strictEqual(localhostFallback.localOnlyFallback, true);
      assert.strictEqual(localhostFallback.fallbackReason, 'local_dev_host');
    } finally {
      globalThis.window = origWindow;
      globalThis.fetch = origFetch;
      setCurrentUser(null);
    }
  });

  // 10. Server-side pending membership_status still blocks cleanly
  await runTest('Server-side membership_status pending_verification rejects cleanly even if local cache is active', async () => {
    await withMockedSupabase(
      {
        signInWithPassword: async ({ email }) => ({
          data: { user: { id: 'auth-999', email } },
          error: null,
        }),
        rpc: async () => ({
          data: [{
            id: 'USER-UNRELATED-999',
            auth_id: 'auth-999',
            roll_number: '238W1A0999',
            name: 'Unrelated Student',
            role: 'student',
            is_active: true,
            membership_status: 'pending_verification',
          }],
          error: null,
        }),
      },
      async ({ getSignOutCalls }) => {
        await assert.rejects(
          async () => loginUser('238W1A0999', 'RealPass@999'),
          /Account pending server verification\. Roster enrollment must be verified when online\./
        );
        assert.ok(getSignOutCalls() >= 1);
      }
    );
  });

  // 11. UI warning guards in Students.jsx and LabEntryExit.jsx
  await runTest('Students.jsx and LabEntryExit.jsx distinguish local-only fallback from verified registration', () => {
    const studentsSrc = fs.readFileSync(
      path.join(workspaceRoot, 'frontend/src/pages/admin/Students.jsx'),
      'utf8'
    );
    const labEntrySrc = fs.readFileSync(
      path.join(workspaceRoot, 'frontend/src/pages/lab/LabEntryExit.jsx'),
      'utf8'
    );

    assert.ok(studentsSrc.includes('Saved Locally Only — Server Verification Required'));
    assert.ok(studentsSrc.includes('alert alert-warning'));
    assert.ok(labEntrySrc.includes('Saved Locally — Pending Server Verification'));
    assert.ok(labEntrySrc.includes('isServerVerified'));
  });

  // 12. Protected files byte-count invariant
  await runTest('Protected files sampleData.js (22,676 bytes) and data_base_backup.js (61,794 bytes) remain untouched', () => {
    const sampleSize = fs.statSync(path.join(workspaceRoot, 'frontend/src/db/sampleData.js')).size;
    const backupSize = fs.statSync(path.join(workspaceRoot, 'frontend/src/db/data_base_backup.js')).size;
    assert.strictEqual(sampleSize, 22676, `Expected sampleData.js to be 22676 bytes, got ${sampleSize}`);
    assert.strictEqual(backupSize, 61794, `Expected data_base_backup.js to be 61794 bytes, got ${backupSize}`);
  });

  // 13. register-student.js: Admin auto-enrolls empty roster in staff_assisted mode while physical_kiosk enforces roster
  await runTest('register-student.js allows verified Admin to auto-enroll missing roster while physical_kiosk still enforces roster', async () => {
    const { onRequestPost } = await import('../../functions/api/register-student.js');
    const origFetch = globalThis.fetch;
    const insertedRosterRows = [];
    const insertedUsers = [];
    const createdAuthEmails = [];

    const buildMockSupabaseFetch = ({ allowRosterRows = false } = {}) => {
      return async (url, init = {}) => {
        const u = String(url);
        const method = (init.method || 'GET').toUpperCase();
        const jsonRes = (data, status = 200, extraHeaders = {}) =>
          new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json', ...extraHeaders },
          });

        if (u.includes('/rest/v1/rpc/check_rate_limit')) {
          return jsonRes(true);
        }
        if (u.includes('/rest/v1/api_rate_limits')) {
          return jsonRes([]);
        }
        if (u.includes('/auth/v1/user')) {
          return jsonRes({ id: 'auth-admin-1', email: 'admin@incubation.local' });
        }
        if (u.includes('/auth/v1/admin/users')) {
          const parsed = init.body ? JSON.parse(init.body) : {};
          createdAuthEmails.push(parsed.email);
          return jsonRes({ id: 'auth-new-0487', email: parsed.email, user: { id: 'auth-new-0487', email: parsed.email } });
        }
        if (u.includes('/rest/v1/users')) {
          if (method === 'GET') {
            if (u.includes('auth_id=eq.auth-admin-1')) {
              return jsonRes({ role: 'admin', name: 'Lab Admin', is_active: true });
            }
            return jsonRes(null);
          }
          if (method === 'POST') {
            const parsed = init.body ? JSON.parse(init.body) : {};
            insertedUsers.push(parsed);
            return jsonRes([parsed], 201);
          }
        }
        if (u.includes('/rest/v1/student_roster')) {
          if (method === 'GET' || method === 'HEAD') {
            if (u.includes('head=true') || method === 'HEAD') {
              return new Response(null, {
                status: 200,
                headers: {
                  'Content-Range': allowRosterRows ? '0-0/1' : '0-0/0',
                },
              });
            }
            return jsonRes(null);
          }
          if (method === 'PATCH') {
            return jsonRes([]);
          }
          if (method === 'POST') {
            const parsed = init.body ? JSON.parse(init.body) : {};
            const row = { id: 'roster-auto-1', ...parsed };
            insertedRosterRows.push(row);
            return jsonRes(row, 201);
          }
        }
        if (u.includes('/rest/v1/used_kiosk_nonces')) {
          return jsonRes([{ nonce: 'nonce-1' }], 201);
        }
        if (u.includes('/rest/v1/audit_logs')) {
          return jsonRes([], 201);
        }
        return jsonRes([]);
      };
    };

    try {
      const kioskSecret = 'test-kiosk-hmac-secret-123';
      const mockEnv = {
        SUPABASE_URL: 'https://test-project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        KIOSK_ATTESTATION_SECRET: kioskSecret,
      };

      globalThis.fetch = buildMockSupabaseFetch({ allowRosterRows: false });

      const adminReq = new Request('http://localhost:5173/api/register-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Authorization: 'Bearer valid-admin-jwt',
        },
        body: JSON.stringify({
          rollNumber: '238W1A-0487',
          name: 'Student 0487',
          password: 'password123',
          registrationMode: 'staff_assisted',
          department: 'ECE',
          academicYearAtStart: 2,
          role: 'student',
        }),
      });
      const adminRes = await onRequestPost({ request: adminReq, env: mockEnv });
      const adminData = await adminRes.json();
      assert.strictEqual(adminRes.status, 201, `Expected 201 from admin registration, got ${adminRes.status}: ${adminData?.error}`);
      assert.strictEqual(adminData.success, true);
      assert.strictEqual(adminData.user.serverVerified, true);
      assert.strictEqual(adminData.user.status, 'active');
      assert.strictEqual(adminData.user.isActive, true);
      assert.strictEqual(insertedRosterRows.length, 1);
      assert.strictEqual(insertedRosterRows[0].roll_number, '238W1A-0487');
      assert.strictEqual(createdAuthEmails[0], '238w1a0487@student.incubation.local');
      assert.strictEqual(insertedUsers[0].auth_id, 'auth-new-0487');

      // Physical kiosk must STILL enforce pre-imported roster (503 when roster is empty)
      const { createHmac } = await import('crypto');
      const nonce = 'nonce-kiosk-123';
      const timestampStr = String(Date.now());
      const sig = createHmac('sha256', kioskSecret).update(`${nonce}:${timestampStr}:kiosk-station`).digest('hex');
      const kioskReq = new Request('http://localhost:5173/api/register-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({
          rollNumber: 'UNLISTED99',
          name: 'Unlisted Kiosk Student',
          password: 'password123',
          registrationMode: 'physical_kiosk',
          kioskAttestation: `${sig}.${nonce}.${timestampStr}`,
        }),
      });
      const kioskRes = await onRequestPost({ request: kioskReq, env: mockEnv });
      assert.strictEqual(kioskRes.status, 503);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  // 14. 409 duplicate from /api/register-student throws explicitly instead of creating duplicate shadow user
  await runTest('registerStudentFirstVisit rejects cleanly on HTTP 409 without creating a duplicate local record', async () => {
    const origWindow = globalThis.window;
    const origFetch = globalThis.fetch;
    try {
      globalThis.window = {
        location: { hostname: 'cms.example.pages.dev' },
        localStorage: mockLocalStorage,
      };
      setCurrentUser({ id: 'USR-ADMIN', role: 'admin', name: 'Admin', token: 'mock-admin-token' });
      globalThis.fetch = async () => ({
        ok: false,
        status: 409,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ error: 'Account with Roll Number "238W1A0910" is already registered.' }),
      });

      await assert.rejects(
        async () =>
          registerStudentFirstVisit({
            name: 'Duplicate Test',
            rollNumber: '238W1A0910',
            password: 'Password123!',
            department: 'ECE',
          }),
        /already registered/i
      );
      assert.strictEqual(getUserByRoll('238W1A0910'), null);
    } finally {
      globalThis.window = origWindow;
      globalThis.fetch = origFetch;
      setCurrentUser(null);
    }
  });

  // 15. activateStudentLogin & resetStudentPassword upgrade existing pending_verification account cleanly
  await runTest('activateStudentLogin upgrades a stuck local pending_verification student into an active verified account', async () => {
    const origWindow = globalThis.window;
    const origFetch = globalThis.fetch;
    try {
      globalThis.window = {
        location: { hostname: 'localhost' },
        localStorage: mockLocalStorage,
      };
      setCurrentUser({ id: 'USR-ADMIN', role: 'admin', name: 'Admin', token: 'mock-admin-token' });

      const pendingUser = await registerStudentFirstVisit({
        name: 'Stuck Pending Student',
        rollNumber: '238W1A0487',
        password: 'password123',
        department: 'ECE',
        academicYearAtStart: 2,
      });
      assert.strictEqual(pendingUser.status, 'pending_verification');
      assert.strictEqual(pendingUser.serverVerified, false);

      globalThis.window.location.hostname = 'cms.example.pages.dev';
      globalThis.fetch = async (url) => {
        if (String(url).includes('/api/admin-reset-password')) {
          return {
            ok: false,
            status: 404,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({ error: 'Not found on server yet' }),
          };
        }
        if (String(url).includes('/api/register-student')) {
          return {
            ok: true,
            status: 201,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({
              success: true,
              user: {
                id: 'USER-SERVER-0487',
                authId: 'auth-server-0487',
                rollNumber: '238W1A0487',
                name: 'Stuck Pending Student',
                role: 'student',
                department: 'ECE',
              },
            }),
          };
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      };

      await resetStudentPassword('238W1A0487', 'NewPass123!', 'Lab Admin');
      const upgraded = getUserByRoll('238W1A0487');
      assert.ok(upgraded);
      assert.strictEqual(upgraded.authId, 'auth-server-0487');
      assert.strictEqual(upgraded.status, 'active');
      assert.strictEqual(upgraded.membershipStatus, 'active');
      assert.strictEqual(upgraded.isActive, true);
      assert.strictEqual(upgraded.serverVerified, true);
      assert.strictEqual(upgraded.localOnlyFallback, false);
    } finally {
      globalThis.window = origWindow;
      globalThis.fetch = origFetch;
      setCurrentUser(null);
    }
  });

  // 16. loginUser refreshes cloud Student Portal data (visits, transactions, projects) and merges local unsynced visits
  await runTest('loginUser hydrates cloud visits, components & projects and merges local unsynced visits for Student Portal', async () => {
    const prevFlag = globalThis.__TEST_FORCE_REFRESH_ON_LOGIN__;
    globalThis.__TEST_FORCE_REFRESH_ON_LOGIN__ = true;

    const createFromChain = (rows = []) => {
      const result = { data: rows, error: null };
      const chain = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        ilike: () => chain,
        limit: () => chain,
        update: () => chain,
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      };
      return chain;
    };

    try {
      await withMockedSupabase(
        {
          signInWithPassword: async ({ email }) => ({
            data: { user: { id: 'auth-server-0487', email } },
            error: null,
          }),
          rpc: async (fnName) => {
            if (fnName === 'get_my_profile') {
              return {
                data: [{
                  id: 'USER-SERVER-0487',
                  auth_id: 'auth-server-0487',
                  roll_number: '238W1A0487',
                  name: 'Verified 0487 Student',
                  role: 'student',
                  is_active: true,
                  membership_status: 'active',
                }],
                error: null,
              };
            }
            return { data: [], error: null };
          },
          from: (table) => {
            if (table === 'users') {
              return createFromChain([{
                id: 'USER-SERVER-0487',
                auth_id: 'auth-server-0487',
                roll_number: '238W1A0487',
                name: 'Verified 0487 Student',
                role: 'student',
                is_active: true,
                membership_status: 'active',
              }]);
            }
            if (table === 'visits') {
              return createFromChain([{
                id: 'VISIT-CLOUD-0487',
                student_roll: '238W1A0487',
                student_name: 'Verified 0487 Student',
                entry_time: new Date(Date.now() - 120 * 60000).toISOString(),
                exit_time: new Date(Date.now() - 30 * 60000).toISOString(),
                duration_minutes: 90,
                status: 'completed',
              }]);
            }
            if (table === 'transactions') {
              return createFromChain([{
                id: 'TXN-CLOUD-0487',
                student_roll: '238W1A0487',
                student_name: 'Verified 0487 Student',
                status: 'partially_returned',
                issue_date: new Date().toISOString(),
                items: [
                  {
                    componentId: 'COMP-1',
                    componentName: 'Arduino Uno R3',
                    issuedQuantity: 2,
                    returnedQuantity: 0,
                  },
                  {
                    componentId: 'COMP-2',
                    componentName: 'ESP32 DevKit',
                    issuedQuantity: 1,
                    returnedQuantity: 1,
                  },
                ],
              }]);
            }
            if (table === 'projects') {
              return createFromChain([{
                id: 'PROJ-CLOUD-0487',
                title: 'Smart Lab Energy Monitor',
                leader_roll: '238W1A0487',
                status: 'active',
                members: [],
              }]);
            }
            return createFromChain([]);
          },
        },
        async () => {
          const user = await loginUser('238W1A0487', 'NewPass123!');
          assert.strictEqual(user.rollNumber, '238W1A0487');
          assert.strictEqual(user.serverVerified, true);

          const stats = getStudentPersonalStats('238W1A0487');
          assert.ok(stats);
          assert.strictEqual(stats.totalVisitsCount, 1);
          assert.strictEqual(stats.totalTimeSpentMinutes, 90);
          assert.strictEqual(stats.activeIssuedItems.length, 1);
          assert.strictEqual(stats.activeIssuedItems[0].componentName, 'Arduino Uno R3');
          assert.strictEqual(stats.returnedItems.length, 1);
          assert.strictEqual(stats.returnedItems[0].componentName, 'ESP32 DevKit');
          assert.strictEqual(stats.projects.length, 1);
          assert.strictEqual(stats.projects[0].title, 'Smart Lab Energy Monitor');
        }
      );
    } finally {
      globalThis.__TEST_FORCE_REFRESH_ON_LOGIN__ = prevFlag;
      setCurrentUser(null);
    }
  });

  // 17. Migration 012 RPC security invariants & UI password/login activation checks
  await runTest('Migration 012 enforces SECURITY DEFINER RBAC and UI exposes login activation & 6-char password rule', () => {
    const sql012 = fs.readFileSync(
      path.join(workspaceRoot, 'database/supabase/migrations/012_admin_student_login_provisioning.sql'),
      'utf8'
    );
    const studentsSrc = fs.readFileSync(
      path.join(workspaceRoot, 'frontend/src/pages/admin/Students.jsx'),
      'utf8'
    );
    const labEntrySrc = fs.readFileSync(
      path.join(workspaceRoot, 'frontend/src/pages/lab/LabEntryExit.jsx'),
      'utf8'
    );

    assert.ok(sql012.includes('CREATE OR REPLACE FUNCTION public.admin_provision_user_profile'));
    assert.ok(sql012.includes('SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp'));
    assert.ok(sql012.includes("public.get_current_user_role()"));
    assert.ok(sql012.includes("REVOKE ALL ON FUNCTION public.admin_provision_user_profile"));
    assert.ok(sql012.includes("GRANT EXECUTE ON FUNCTION public.admin_provision_user_profile"));

    assert.ok(studentsSrc.includes('activateStudentLogin'));
    assert.ok(studentsSrc.includes('Generate Login'));
    assert.ok(studentsSrc.includes('Login Pending (Local Only)'));
    assert.ok(studentsSrc.includes('minLength={6}'));
    assert.ok(labEntrySrc.includes('minLength={6}'));
  });

  console.log(`\n🎉 Passed ${passed}/${total} student login & reconciliation tests.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
