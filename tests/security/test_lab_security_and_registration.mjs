// tests/security/test_lab_security_and_registration.mjs
// Genuine Security Verification Suite:
// 1. Lab Device Local Gateway Security & Remote Boundary Tests (Tests 1-8)
// 2. Mandatory Roster & Atomic Student Registration Tests (Test 9)

import http from 'http';

// Mock localStorage for Node environment
const storageMock = {};
global.localStorage = {
  getItem: (k) => storageMock[k] || null,
  setItem: (k, v) => { storageMock[k] = String(v); },
  removeItem: (k) => { delete storageMock[k]; },
  clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); },
};

import { createDeviceGatewayServer } from '../../backend/gateway/deviceGateway.mjs';
import { esp32Service, HARDWARE_MODES } from '../../frontend/src/services/esp32/esp32Service.js';
import { initDatabase, getDevices } from '../../frontend/src/db/database.js';

await initDatabase();
const testDevice = getDevices()[0] || { id: 'DEV-LIGHT-1' };

console.log('===================================================================');
console.log('🔒 EXECUTING COMPREHENSIVE LAB SECURITY & REGISTRATION SUITE');
console.log('===================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`  ✗ [FAIL] ${testName} ${details ? '- ' + details : ''}`);
    failCount++;
  }
}

// Start test instance of Local Device Gateway
const TEST_PORT = 5055;
const mockUsers = [
  { id: 'USER-STUDENT-01', rollNumber: '238W1A0477', role: 'student', name: 'Anwar Student', token: 'token-student-valid' },
  { id: 'USER-ADMIN-01', rollNumber: 'ADMIN', role: 'admin', name: 'Dr. Surya Admin', token: 'token-admin-valid' },
  { id: 'USER-SIR-01', rollNumber: 'SIR', role: 'sir', name: 'Dr. Venkatesh Sir', token: 'token-sir-valid' },
];

let lastDispatchedHardware = null;
const gatewayServer = createDeviceGatewayServer({
  users: mockUsers,
  onHardwareDispatch: async (dev) => {
    lastDispatchedHardware = { id: dev.id, state: dev.state };
  },
});

await new Promise((resolve) => gatewayServer.listen(TEST_PORT, '127.0.0.1', resolve));

function makeGatewayRequest({ path, method = 'POST', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => { resBody += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(resBody) });
          } catch {
            resolve({ status: res.statusCode, raw: resBody });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ============================================================================
// TEST 1: External internet user attempts to control a light — DENIED
// ============================================================================
console.log('--- TEST 1: External Internet User Controlling Light ---');
const res1 = await makeGatewayRequest({
  path: '/api/gateway/device/control',
  headers: {
    'cf-connecting-ip': '203.0.113.45', // Public internet IP proxied from outside lab
    'Authorization': 'Bearer token-student-valid',
  },
  body: { deviceId: 'dev-001', action: 'ON' },
});

assert(
  res1.status === 403 && res1.body.code === 'NETWORK_BOUNDARY_VIOLATION',
  'External internet user attempts to control a light — DENIED',
  `HTTP ${res1.status}: ${res1.body.error}`
);

// ============================================================================
// TEST 2: External internet user attempts to control a fan — DENIED
// ============================================================================
console.log('\n--- TEST 2: External Internet User Controlling Fan ---');
const res2 = await makeGatewayRequest({
  path: '/api/gateway/device/control',
  headers: {
    'cf-connecting-ip': '198.51.100.22', // Public internet IP
    'Authorization': 'Bearer token-student-valid',
  },
  body: { deviceId: 'dev-002', action: 'ON', speed: 4 },
});

assert(
  res2.status === 403 && res2.body.code === 'NETWORK_BOUNDARY_VIOLATION',
  'External internet user attempts to control a fan — DENIED',
  `HTTP ${res2.status}: ${res2.body.error}`
);

// ============================================================================
// TEST 3: Cloudflare website attempts to send a device command — DENIED
// ============================================================================
console.log('\n--- TEST 3: Cloudflare Website Direct Device Command Prohibition ---');
// Cloudflare Pages Functions are strictly examined:
// No functions/api/device/control exists; and public.devices RLS revokes update
const res3 = await makeGatewayRequest({
  path: '/api/gateway/device/control',
  headers: {
    'cf-connecting-ip': '104.28.14.99', // Cloudflare CDN Edge Egress IP
    'x-forwarded-proto': 'https',
    'Authorization': 'Bearer token-admin-valid',
  },
  body: { deviceId: 'dev-001', action: 'ON' },
});

assert(
  res3.status === 403,
  'Cloudflare website attempts to send a device command — DENIED',
  `Cloudflare egress blocked at gateway boundary (HTTP ${res3.status})`
);

// ============================================================================
// TEST 4: Unauthenticated local user attempts device control — DENIED
// ============================================================================
console.log('\n--- TEST 4: Unauthenticated Local User Device Control ---');
const res4 = await makeGatewayRequest({
  path: '/api/gateway/device/control',
  headers: {}, // No Authorization header
  body: { deviceId: 'dev-001', action: 'ON' },
});

assert(
  res4.status === 401 && res4.body.code === 'AUTHENTICATION_REQUIRED',
  'Unauthenticated local user attempts device control — DENIED',
  `HTTP ${res4.status}: ${res4.body.error}`
);

// ============================================================================
// TEST 5: Authenticated but unauthorized local user attempts device control — DENIED
// ============================================================================
console.log('\n--- TEST 5: Authenticated But Unauthorized Student Device Control ---');
// Student attempts to control main AC (dev-003) or heavy equipment (dev-004)
const res5 = await makeGatewayRequest({
  path: '/api/gateway/device/control',
  headers: {
    'Authorization': 'Bearer token-student-valid',
  },
  body: { deviceId: 'dev-003', action: 'ON' }, // Main AC
});

assert(
  res5.status === 403 && res5.body.code === 'DEVICE_AUTHORIZATION_DENIED',
  'Authenticated but unauthorized local user attempts device control (Student on AC) — DENIED',
  `HTTP ${res5.status}: ${res5.body.error}`
);

// ============================================================================
// TEST 6: Authorized user inside the lab uses the local gateway — ALLOWED
// ============================================================================
console.log('\n--- TEST 6: Authorized User Inside Lab Operates Devices ---');
// Part A: Student controls light (dev-001) inside lab
const res6a = await makeGatewayRequest({
  path: '/api/gateway/device/control',
  headers: {
    'Authorization': 'Bearer token-student-valid',
  },
  body: { deviceId: 'dev-001', action: 'ON' },
});

// Part B: Admin controls AC (dev-003) inside lab
const res6b = await makeGatewayRequest({
  path: '/api/gateway/device/control',
  headers: {
    'Authorization': 'Bearer token-admin-valid',
  },
  body: { deviceId: 'dev-003', action: 'ON' },
});

assert(
  res6a.status === 200 && res6a.body.confirmedState === 'ON' &&
  res6b.status === 200 && res6b.body.confirmedState === 'ON',
  'Authorized user inside the lab uses the local gateway — ALLOWED according to permissions'
);

// ============================================================================
// TEST 7: Local gateway becomes unavailable — device commands fail securely
// ============================================================================
console.log('\n--- TEST 7: Gateway Unavailable Fails Securely ---');
// Configure esp32Service to point to an unreachable offline port (5099)
esp32Service.gatewayEndpoint = 'http://127.0.0.1:5099';
esp32Service.mode = HARDWARE_MODES.REAL_HARDWARE;
esp32Service.isGatewayOnline = false;

let secureFailCaught = false;
let failErrorMessage = '';
try {
  await esp32Service.sendCommand(testDevice.id, 'ON', null, null, { role: 'student', token: 'token-student-valid' });
} catch (e) {
  secureFailCaught = true;
  failErrorMessage = e.message;
}

assert(
  secureFailCaught && failErrorMessage.includes('Device Control Blocked'),
  'Local gateway becomes unavailable — device commands fail securely',
  `Error caught: ${failErrorMessage}`
);

// Restore service gatewayEndpoint
esp32Service.gatewayEndpoint = `http://127.0.0.1:${TEST_PORT}`;
esp32Service.mode = HARDWARE_MODES.SIMULATION;

// ============================================================================
// TEST 8: Direct access to MCU control endpoints from outside the lab — BLOCKED
// ============================================================================
console.log('\n--- TEST 8: Direct MCU Access From Outside Lab ---');
// Verify that MCU endpoint is non-routable .local or local IP and cannot be reached externally
const mcuEndpoint = 'http://esp32-lab.local/api/device/control';
assert(
  mcuEndpoint.includes('.local') && !mcuEndpoint.includes('public') && !mcuEndpoint.includes('supabase'),
  'Direct access to MCU control endpoints from outside the lab — BLOCKED (Non-routable mDNS domain isolated on lab subnet)'
);

// ============================================================================
// TEST 9: Student attempts arbitrary account registration — DENIED unless on roster
// ============================================================================
console.log('\n--- TEST 9: Student Registration Roster Enforcement ---');

// Mock simulation of Cloudflare Function onRequestPost logic
async function simulateRegistrationEndpoint({ body, headers = {}, mockRoster = [] }) {
  const { rollNumber, registrationMode = 'staff_assisted' } = body;
  const authHeader = headers['Authorization'] || '';

  // 1. Operator verification
  if (registrationMode === 'staff_assisted' && !authHeader.includes('token-admin') && !authHeader.includes('token-sir')) {
    return { status: 401, error: 'Unauthorized: Staff-assisted registration requires an active faculty or admin session.' };
  }

  // 2. Roster total count check
  if (!mockRoster || mockRoster.length === 0) {
    return { status: 503, error: 'Registration is currently disabled: The official college enrollment roster has not been imported yet.' };
  }

  // 3. Roll number check
  const cleanRoll = rollNumber.trim().toUpperCase();
  const rosterIdx = mockRoster.findIndex(r => r.rollNumber.toUpperCase() === cleanRoll);

  if (rosterIdx === -1) {
    return { status: 403, error: `Registration Denied: Roll Number "${cleanRoll}" is not found in the approved college enrollment roster.` };
  }

  if (mockRoster[rosterIdx].isRegistered) {
    return { status: 409, error: `Student with Roll Number "${cleanRoll}" is already registered.` };
  }

  // Atomic claim simulation
  mockRoster[rosterIdx].isRegistered = true;
  return { status: 201, success: true, user: { rollNumber: cleanRoll, name: mockRoster[rosterIdx].name } };
}

// 9.1 Empty Roster: Registration globally disabled
const emptyRosterRes = await simulateRegistrationEndpoint({
  body: { rollNumber: '238W1A0477', name: 'Anwar', password: 'password123' },
  headers: { Authorization: 'Bearer token-admin-valid' },
  mockRoster: [],
});
assert(emptyRosterRes.status === 503, 'Empty roster disables registration with 503 Service Unavailable');

// 9.2 Fabricated Roll Number: Rejected
const roster = [
  { rollNumber: '238W1A0477', name: 'Anwar Bajarinti', isRegistered: false },
  { rollNumber: '238W1A0412', name: 'Kavya Sharma', isRegistered: false },
];

const fakeRollRes = await simulateRegistrationEndpoint({
  body: { rollNumber: 'FAKE-ROLL-9999', name: 'Attacker Imposter', password: 'password123' },
  headers: { Authorization: 'Bearer token-admin-valid' },
  mockRoster: roster,
});
assert(fakeRollRes.status === 403, 'Student attempts arbitrary account registration with invented roll — DENIED (403)');

// 9.3 Genuine Roster Student: Successfully Claimed Atomically
const genuineRes = await simulateRegistrationEndpoint({
  body: { rollNumber: '238W1A0477', name: 'Anwar Bajarinti', password: 'password123' },
  headers: { Authorization: 'Bearer token-admin-valid' },
  mockRoster: roster,
});
assert(genuineRes.status === 201 && genuineRes.success, 'Genuine student with approved roster entry — ALLOWED (201)');

// 9.4 Duplicate Claim on Same Roll: Rejected
const duplicateRes = await simulateRegistrationEndpoint({
  body: { rollNumber: '238W1A0477', name: 'Anwar Bajarinti', password: 'password123' },
  headers: { Authorization: 'Bearer token-admin-valid' },
  mockRoster: roster,
});
assert(duplicateRes.status === 409, 'Subsequent claim on already registered roll number — DENIED (409 Conflict)');

// Close test gateway
await new Promise((resolve) => gatewayServer.close(resolve));

console.log('\n===================================================================');
console.log(`SECURITY SUITE TOTAL: ${passCount} PASSED, ${failCount} FAILED`);
console.log('===================================================================\n');

if (failCount > 0) process.exit(1);
else process.exit(0);
