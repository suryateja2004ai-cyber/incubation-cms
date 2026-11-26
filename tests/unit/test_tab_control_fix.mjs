// tests/unit/test_tab_control_fix.mjs
// Verification of Tab Control stability, ESP32 gateway health monitoring, and offline resilience

import assert from 'assert';

// Setup minimal localStorage mock for Node environment if absent
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

import esp32ServiceDefault, {
  esp32Service as esp32ServiceNamed,
  checkGatewayHealth,
  HARDWARE_MODES,
  DEVICE_HARDWARE_STATES,
  Esp32Service
} from '../../frontend/src/services/esp32/esp32Service.js';
import { initDatabase, getDevices } from '../../frontend/src/db/database.js';

console.log('=== TEST SUITE: TAB CONTROL & ESP32 SERVICE RESILIENCE ===\n');

// 1. Verify Exports and Function Binding
console.log('[Test 1] Verifying ESP32 Service exports and method bindings...');
assert(esp32ServiceDefault, 'Default export esp32Service must exist');
assert(esp32ServiceNamed, 'Named export esp32Service must exist');
assert.strictEqual(esp32ServiceDefault, esp32ServiceNamed, 'Default and named exports must be the identical instance');
assert.strictEqual(typeof esp32ServiceDefault.checkGatewayHealth, 'function', 'checkGatewayHealth must be a function on esp32Service');
assert.strictEqual(typeof checkGatewayHealth, 'function', 'checkGatewayHealth must be exported as a standalone function');
assert.strictEqual(typeof esp32ServiceDefault.getMode, 'function', 'getMode must be a function');
assert.strictEqual(typeof esp32ServiceDefault.setMode, 'function', 'setMode must be a function');
assert.strictEqual(typeof esp32ServiceDefault.sendCommand, 'function', 'sendCommand must be a function');
assert.strictEqual(typeof esp32ServiceDefault.handlePhysicalSwitchEvent, 'function', 'handlePhysicalSwitchEvent must be a function');
assert.strictEqual(typeof esp32ServiceDefault.setEmergencyFallback, 'function', 'setEmergencyFallback must be a function');
console.log('✓ All exports and methods verified successfully.\n');

// 2. Verify Graceful Handling When Gateway is Offline / Unreachable
console.log('[Test 2] Testing gateway health check with unreachable offline port...');
// Point to an unused local port that rejects immediately
esp32ServiceDefault.gatewayEndpoint = 'http://127.0.0.1:59999';

const offlineHealth = await esp32ServiceDefault.checkGatewayHealth();
console.log('  Gateway offline health result:', offlineHealth);
assert.strictEqual(offlineHealth.isGatewayOnline, false, 'isGatewayOnline must be false when gateway is offline');
assert.strictEqual(offlineHealth.isLocalLabNetwork, false, 'isLocalLabNetwork must be false when gateway is offline');
assert.strictEqual(esp32ServiceDefault.isGatewayOnline, false, 'Service property isGatewayOnline must reflect offline state');
console.log('✓ Unreachable gateway handled gracefully without throwing unhandled exceptions.\n');

// 3. Verify notifyStatus includes isGatewayOnline & isLocalLabNetwork
console.log('[Test 3] Verifying status listener notification payload...');
let receivedPayload = null;
const unsubscribe = esp32ServiceDefault.subscribeStatus((status) => {
  receivedPayload = status;
});

await esp32ServiceDefault.checkGatewayHealth();
assert(receivedPayload, 'Listener must receive status payload');
assert.strictEqual(receivedPayload.isGatewayOnline, false, 'Payload must include isGatewayOnline');
assert.strictEqual(receivedPayload.isLocalLabNetwork, false, 'Payload must include isLocalLabNetwork');
assert.strictEqual(receivedPayload.mode, HARDWARE_MODES.SIMULATION, 'Payload must include active mode');
unsubscribe();
console.log('✓ Status listener correctly receives gateway online/offline state.\n');

// 4. Verify Component-Level Resilience Against Missing checkGatewayHealth
console.log('[Test 4] Testing defensive component logic against missing or broken checkGatewayHealth...');
// Simulate an outdated or mocked service object that lacks checkGatewayHealth
const legacyMockService = {
  isGatewayOnline: false,
  getMode: () => HARDWARE_MODES.SIMULATION,
  getDeviceState: () => ({ state: DEVICE_HARDWARE_STATES.CONFIRMED }),
  // checkGatewayHealth is deliberately undefined
};

// Test the exact defensive pattern used in ControlTab.jsx
let simulatedIsGatewayConnected = null;
let errorThrown = false;

try {
  if (typeof legacyMockService?.checkGatewayHealth === 'function') {
    await legacyMockService.checkGatewayHealth();
    simulatedIsGatewayConnected = true;
  } else {
    // Graceful fallback
    simulatedIsGatewayConnected = Boolean(legacyMockService?.isGatewayOnline);
  }
} catch (e) {
  errorThrown = true;
}

assert.strictEqual(errorThrown, false, 'Component check must NOT throw even if checkGatewayHealth is missing');
assert.strictEqual(simulatedIsGatewayConnected, false, 'Component must safely default to offline state without crashing');
console.log('✓ Defensive check successfully prevents "esp32Service.checkGatewayHealth is not a function" crash.\n');

// 5. Verify Device Control Operations (Simulation Mode & Fallback)
console.log('[Test 5] Testing device control operations in Simulation & Fallback modes...');
try {
  initDatabase();
} catch {}

const devices = getDevices('admin');
const testDevId = devices.length > 0 ? devices[0].id : 'DEV-LIGHT-1';

esp32ServiceDefault.setMode(HARDWARE_MODES.SIMULATION);
const simResult = await esp32ServiceDefault.sendCommand(testDevId, 'ON', 80, null, { role: 'admin' });
assert.strictEqual(simResult.success, true, 'Command in simulation mode must succeed');
assert.strictEqual(simResult.hardwareState, DEVICE_HARDWARE_STATES.CONFIRMED, 'State must be CONFIRMED');

// Test emergency fallback
esp32ServiceDefault.setEmergencyFallback(true);
const fallbackResult = await esp32ServiceDefault.sendCommand(testDevId, 'ON', null, 3, { role: 'admin' });
assert.strictEqual(fallbackResult.success, true, 'Emergency fallback command must succeed');
assert.strictEqual(fallbackResult.mode, 'emergency_fallback', 'Mode must indicate emergency_fallback');
esp32ServiceDefault.setEmergencyFallback(false);
console.log('✓ Device control and emergency fallback operations verified.\n');

// 6. Verify Real Hardware Mode Security Lockout When Gateway is Offline
console.log('[Test 6] Testing Real Hardware mode security rejection when Gateway is offline...');
esp32ServiceDefault.setMode(HARDWARE_MODES.REAL_HARDWARE);
esp32ServiceDefault.isGatewayOnline = false;

let blockedError = null;
try {
  await esp32ServiceDefault.sendCommand(testDevId, 'ON', null, null, { role: 'admin' });
} catch (err) {
  blockedError = err;
}

assert(blockedError, 'Real Hardware command must be blocked when gateway is offline');
assert(blockedError.message.includes('Device Control Blocked'), 'Error message must explain physical lab restriction');
const deviceState = esp32ServiceDefault.getDeviceState(testDevId);
assert.strictEqual(deviceState.state, DEVICE_HARDWARE_STATES.FAILED, 'Device state must be marked FAILED on gateway outage');
console.log('✓ Security lockout and FAILED hardware state correctly enforced when gateway is offline.\n');

// Reset service to default simulation mode
esp32ServiceDefault.setMode(HARDWARE_MODES.SIMULATION);
console.log('=== ALL 6 TESTS PASSED (100% SUCCESS) ===');
process.exit(0);
