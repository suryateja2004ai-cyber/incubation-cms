// tests/unit/test_zone_gesture_control.mjs
// Comprehensive Unit & Integration Test Suite for Independent 3x3 Zone-Based Appliance Control
// Validates:
// 1. Palm-facing gesture detection (Right & Left Hands).
// 2. Back-of-hand gesture detection (Right & Left Hands).
// 3. Uncertain orientation being ignored.
// 4. Gesture stability (5 frames) and debounce cooldown.
// 5. Independent zone-wise states: Person enters Z1 -> only Z1's light request changes.
// 6. Person in Z3 -> Z1 remains unchanged.
// 7. Person leaves Z1 -> only Z1's vacancy timer starts; Z3 unaffected.
// 8. 10s vacancy expiration in Z1 turns only Z1's mapped light OFF; occupied Z3 remains ON.
// 9. Two people in different zones maintain strictly independent states.
// 10. Gesture in Z5 affects only Z5, leaving other zones untouched.
// 11. ESP32 communication failure handling (fails closed gracefully).

import assert from 'node:assert';

// Mock minimal browser globals for testing in Node CLI
if (typeof globalThis.localStorage === 'undefined') {
  const memoryStorage = new Map();
  globalThis.localStorage = {
    getItem: (key) => memoryStorage.get(key) || null,
    setItem: (key, value) => memoryStorage.set(key, String(value)),
    removeItem: (key) => memoryStorage.delete(key),
    clear: () => memoryStorage.clear(),
  };
}

console.log('===================================================================');
console.log('🖐️ EXECUTING INDEPENDENT 3x3 ZONE-BASED APPLIANCE & GESTURE SUITE');
console.log('===================================================================\n');

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
    console.error('    Error:', err.message);
    throw err;
  }
}

// Helper: Synthesize 21 MediaPipe hand landmarks with geometric orientation
function generateMockLandmarks({ isPalmFacing, isEdgeOn, isRightHand = true }) {
  const landmarks = Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0.0 }));
  landmarks[0] = { x: 0.5, y: 0.8, z: 0.0 };
  landmarks[9] = { x: 0.5, y: 0.4, z: 0.0 };

  if (isEdgeOn) {
    landmarks[5] = { x: 0.5, y: 0.45, z: -0.1 };
    landmarks[17] = { x: 0.5, y: 0.45, z: 0.1 };
  } else if (isRightHand) {
    if (isPalmFacing) {
      landmarks[5] = { x: 0.4, y: 0.45, z: -0.05 };
      landmarks[17] = { x: 0.6, y: 0.45, z: -0.05 };
    } else {
      landmarks[5] = { x: 0.6, y: 0.45, z: 0.05 };
      landmarks[17] = { x: 0.4, y: 0.45, z: 0.05 };
    }
  } else {
    if (isPalmFacing) {
      landmarks[5] = { x: 0.6, y: 0.45, z: -0.05 };
      landmarks[17] = { x: 0.4, y: 0.45, z: -0.05 };
    } else {
      landmarks[5] = { x: 0.4, y: 0.45, z: 0.05 };
      landmarks[17] = { x: 0.6, y: 0.45, z: 0.05 };
    }
  }
  return landmarks;
}

function evaluateOrientation(landmarks, handedness = 'Right') {
  if (landmarks.length < 21) return 'UNCERTAIN';
  const w = landmarks[0];
  const idx = landmarks[5];
  const mid = landmarks[9];
  const pnk = landmarks[17];

  const u = [mid.x - w.x, mid.y - w.y, (mid.z || 0) - (w.z || 0)];
  const v = [pnk.x - idx.x, pnk.y - idx.y, (pnk.z || 0) - (idx.z || 0)];
  const det2D = u[0] * v[1] - u[1] * v[0];

  const a = [idx.x - w.x, idx.y - w.y, (idx.z || 0) - (w.z || 0)];
  const b = [pnk.x - w.x, pnk.y - w.y, (pnk.z || 0) - (w.z || 0)];
  const normalZ = a[0] * b[1] - a[1] * b[0];
  const normLen = Math.hypot(normalZ, a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2]);

  if (normLen < 1e-6) return 'UNCERTAIN';
  const normZUnit = normalZ / normLen;
  if (Math.abs(normZUnit) < 0.20) return 'UNCERTAIN';

  const isRight = (handedness.toLowerCase() === 'right');
  if (isRight) {
    if (det2D > 0.005 && normZUnit > 0.15) return 'PALM_FACING';
    if (det2D < -0.005 && normZUnit < -0.15) return 'BACK_OF_HAND';
  } else {
    if (det2D < -0.005 && normZUnit < -0.15) return 'PALM_FACING';
    if (det2D > 0.005 && normZUnit > 0.15) return 'BACK_OF_HAND';
  }
  return 'UNCERTAIN';
}

// --- WORKSTREAM 1: Geometry Tests ---
console.log('--- WORKSTREAM 1: Hand Orientation Detection ---');

runTest('1. Palm-facing gesture detected via landmark geometry (Right & Left Hands)', () => {
  const rightPalm = generateMockLandmarks({ isPalmFacing: true, isEdgeOn: false, isRightHand: true });
  assert.strictEqual(evaluateOrientation(rightPalm, 'Right'), 'PALM_FACING');

  const leftPalm = generateMockLandmarks({ isPalmFacing: true, isEdgeOn: false, isRightHand: false });
  assert.strictEqual(evaluateOrientation(leftPalm, 'Left'), 'PALM_FACING');
});

runTest('2. Back-of-hand gesture detected via landmark geometry (Right & Left Hands)', () => {
  const rightBack = generateMockLandmarks({ isPalmFacing: false, isEdgeOn: false, isRightHand: true });
  assert.strictEqual(evaluateOrientation(rightBack, 'Right'), 'BACK_OF_HAND');

  const leftBack = generateMockLandmarks({ isPalmFacing: false, isEdgeOn: false, isRightHand: false });
  assert.strictEqual(evaluateOrientation(leftBack, 'Left'), 'BACK_OF_HAND');
});

runTest('3. Uncertain / edge-on orientation is safely ignored without false trigger', () => {
  const edgeOn = generateMockLandmarks({ isPalmFacing: false, isEdgeOn: true, isRightHand: true });
  assert.strictEqual(evaluateOrientation(edgeOn, 'Right'), 'UNCERTAIN');

  const partialLandmarks = Array(15).fill({ x: 0, y: 0, z: 0 });
  assert.strictEqual(evaluateOrientation(partialLandmarks, 'Right'), 'UNCERTAIN');
});

// --- WORKSTREAM 2: Independent Zone State & Physical Relay Arbitration ---
console.log('\n--- WORKSTREAM 2: Independent Zone States & Relay Arbitration ---');

const { initDatabase } = await import('../../frontend/src/db/database.js');
await initDatabase();

const { zoneGestureService, GESTURE_ORIENTATIONS, GESTURE_ACTIONS } = await import(
  '../../frontend/src/services/esp32/zoneGestureService.js'
);

function resetAllZones() {
  for (const z of Object.values(zoneGestureService.zones)) {
    z.occupants.clear();
    z.vacancyStartedAt = null;
    z.manualLight = null;
    z.manualFan = null;
  }
  zoneGestureService.trackedPersons.clear();
  zoneGestureService.recomputeApplianceStates();
}

runTest('4. Gesture stability (5 frames) and debounce cooldown prevent repeated triggers', () => {
  resetAllZones();
  const personId = 'TEST-P1';
  zoneGestureService.updatePersonPresence(personId, 'Z1');

  for (let i = 0; i < 4; i++) {
    zoneGestureService.processHandGesture(personId, GESTURE_ORIENTATIONS.PALM_FACING);
  }
  let pState = zoneGestureService.trackedPersons.get(personId);
  assert.strictEqual(pState.lastAction, GESTURE_ACTIONS.NONE);

  zoneGestureService.processHandGesture(personId, GESTURE_ORIENTATIONS.PALM_FACING);
  pState = zoneGestureService.trackedPersons.get(personId);
  assert.strictEqual(pState.lastAction, GESTURE_ACTIONS.FAN_OFF);

  const initialTriggerTime = pState.lastTriggerAt;
  zoneGestureService.processHandGesture(personId, GESTURE_ORIENTATIONS.PALM_FACING);
  assert.strictEqual(pState.lastTriggerAt, initialTriggerTime);

  zoneGestureService.removePerson(personId);
});

runTest('5. Person enters Z1 -> ONLY Z1 requested light turns ON; other 8 zones remain OFF', () => {
  resetAllZones();
  zoneGestureService.updatePersonPresence('P-1', 'Z1');

  const snap = zoneGestureService.getTelemetrySnapshot();
  // Z1 requested status is ON
  assert.strictEqual(snap.zones.Z1.isOccupied, true);
  assert.strictEqual(snap.zones.Z1.lightRequested, 'ON');
  assert.strictEqual(snap.zones.Z1.deviceType, 'physical');
  assert.strictEqual(snap.zones.Z1.physicalPin, 22);

  // Physical Relay 1 (GPIO 22) must be ON
  assert.strictEqual(snap.appliances['DEV-LIGHT-1'].state, 'ON');

  // Physical Relay 2 (GPIO 23) must be OFF
  assert.strictEqual(snap.appliances['DEV-LIGHT-2'].state, 'OFF');

  // ALL other 8 zones must independently be OFF!
  for (const zId of ['Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8', 'Z9']) {
    assert.strictEqual(snap.zones[zId].isOccupied, false, `${zId} must not be marked occupied`);
    assert.strictEqual(snap.zones[zId].lightRequested, 'OFF', `${zId} light must independently remain OFF`);
  }
});

runTest('6. Person enters Z3 -> Z3 turns ON; Z1 remains independent', () => {
  // Adding person to Z3 while P-1 is in Z1
  zoneGestureService.updatePersonPresence('P-2', 'Z3');

  const snap = zoneGestureService.getTelemetrySnapshot();
  assert.strictEqual(snap.zones.Z1.lightRequested, 'ON', 'Z1 must stay ON');
  assert.strictEqual(snap.zones.Z3.lightRequested, 'ON', 'Z3 must be ON');
  assert.strictEqual(snap.zones.Z3.deviceType, 'physical');
  assert.strictEqual(snap.zones.Z3.physicalPin, 23);

  // Both physical relays now ON because both independent zones requested them
  assert.strictEqual(snap.appliances['DEV-LIGHT-1'].state, 'ON');
  assert.strictEqual(snap.appliances['DEV-LIGHT-2'].state, 'ON');

  // Unoccupied zones remain independently OFF
  for (const zId of ['Z2', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8', 'Z9']) {
    assert.strictEqual(snap.zones[zId].lightRequested, 'OFF');
  }
});

runTest('7. Person leaves Z1 -> ONLY Z1 vacancy timer starts; Z3 unaffected', () => {
  zoneGestureService.removePerson('P-1');

  const snap = zoneGestureService.getTelemetrySnapshot();
  // Z1 is vacated, starts 10s countdown
  assert.strictEqual(snap.zones.Z1.isOccupied, false);
  assert.strictEqual(snap.zones.Z1.vacancyRemainingSec > 0, true, 'Z1 vacancy timer must be running');
  assert.strictEqual(snap.zones.Z1.lightRequested, 'ON', 'Z1 stays ON during grace period');

  // Z3 remains occupied with ZERO vacancy countdown
  assert.strictEqual(snap.zones.Z3.isOccupied, true);
  assert.strictEqual(snap.zones.Z3.vacancyRemainingSec, 0, 'Z3 vacancy timer must NOT run');
  assert.strictEqual(snap.zones.Z3.lightRequested, 'ON');
});

runTest('8. Z1 vacancy expires (10s) -> Z1 light turns OFF; occupied Z3 remains ON', () => {
  // Fast-forward Z1 vacancy timer past 10s
  zoneGestureService.zones.Z1.vacancyStartedAt = Date.now() - 10500;
  zoneGestureService.tickVacancyTimers();

  const snap = zoneGestureService.getTelemetrySnapshot();
  // Z1 is now fully OFF
  assert.strictEqual(snap.zones.Z1.vacancyRemainingSec, 0);
  assert.strictEqual(snap.zones.Z1.lightRequested, 'OFF', 'Z1 light request must now be OFF');
  assert.strictEqual(snap.appliances['DEV-LIGHT-1'].state, 'OFF', 'Physical Relay 1 must switch OFF');

  // Z3 is STILL OCCUPIED and remains ON!
  assert.strictEqual(snap.zones.Z3.isOccupied, true);
  assert.strictEqual(snap.zones.Z3.lightRequested, 'ON', 'Z3 light must remain ON');
  assert.strictEqual(snap.appliances['DEV-LIGHT-2'].state, 'ON', 'Physical Relay 2 must remain ON');

  // Cleanup P-2
  zoneGestureService.removePerson('P-2');
});

runTest('9. Two people in simulated zones -> independent states with zero physical relay triggers', () => {
  resetAllZones();
  zoneGestureService.updatePersonPresence('P-SIM1', 'Z2');
  zoneGestureService.updatePersonPresence('P-SIM2', 'Z6');

  const snap = zoneGestureService.getTelemetrySnapshot();
  assert.strictEqual(snap.zones.Z2.lightRequested, 'ON');
  assert.strictEqual(snap.zones.Z2.deviceType, 'simulated');

  assert.strictEqual(snap.zones.Z6.lightRequested, 'ON');
  assert.strictEqual(snap.zones.Z6.deviceType, 'simulated');

  // Physical relays remain OFF because no physical zone was entered
  assert.strictEqual(snap.appliances['DEV-LIGHT-1'].state, 'OFF');
  assert.strictEqual(snap.appliances['DEV-LIGHT-2'].state, 'OFF');

  // Other zones remain OFF
  assert.strictEqual(snap.zones.Z1.lightRequested, 'OFF');
  assert.strictEqual(snap.zones.Z3.lightRequested, 'OFF');
  assert.strictEqual(snap.zones.Z5.lightRequested, 'OFF');

  zoneGestureService.removePerson('P-SIM1');
  zoneGestureService.removePerson('P-SIM2');
});

runTest('10. Gesture in Z5 affects ONLY Z5, leaving all other zones unaffected', () => {
  resetAllZones();
  zoneGestureService.updatePersonPresence('P-GEST', 'Z5');
  zoneGestureService.updatePersonPresence('P-OTHER', 'Z1');

  let snap = zoneGestureService.getTelemetrySnapshot();
  assert.strictEqual(snap.zones.Z5.lightRequested, 'ON');
  assert.strictEqual(snap.zones.Z1.lightRequested, 'ON');

  // Gesture Back of Hand in Z5 -> Turn Light OFF in Z5
  for (let i = 0; i < 5; i++) {
    zoneGestureService.processHandGesture('P-GEST', GESTURE_ORIENTATIONS.BACK_OF_HAND);
  }

  snap = zoneGestureService.getTelemetrySnapshot();
  assert.strictEqual(snap.zones.Z5.lightRequested, 'OFF', 'Z5 light must be overridden to OFF');
  assert.strictEqual(snap.zones.Z5.lightMode, 'gesture_override');

  // Z1 must remain completely unaffected!
  assert.strictEqual(snap.zones.Z1.lightRequested, 'ON', 'Z1 light must remain ON');
  assert.strictEqual(snap.zones.Z1.lightMode, 'auto');

  zoneGestureService.removePerson('P-GEST');
  zoneGestureService.removePerson('P-OTHER');
});

runTest('11. ESP32 communication failure handling (fails closed without crashing)', () => {
  assert.doesNotThrow(() => {
    zoneGestureService.dispatchApplianceState('DEV-NONEXISTENT', 'ON');
  });
});

// Stop background interval for clean test exit
zoneGestureService.stopBackgroundTimer();

console.log('\n===================================================================');
console.log(`🎉 ALL ${passedTests}/${totalTests} INDEPENDENT ZONE & RELAY TESTS PASSED!`);
console.log('===================================================================\n');

process.exit(0);
