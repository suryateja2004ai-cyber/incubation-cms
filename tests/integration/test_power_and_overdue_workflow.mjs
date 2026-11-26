// tests/integration/test_power_and_overdue_workflow.mjs
import assert from 'assert';
import {
  savePowerConsumption,
  getPowerConsumption,
  insertIssuedComponent,
  checkAndSyncOverdues,
  getOverdueComponents,
  queryPg,
} from '../../backend/postgres_service.js';

console.log('🧪 Starting PostgreSQL Power Consumption & Overdue Tracker Integration Tests...\n');

// ==========================================
// TEST 1: POWER CONSUMPTION TABLE
// ==========================================
console.log('--- TEST 1: Power Consumption Table ---');
const sampleDevices = [
  {
    id: 'dev-light-zone-a',
    name: 'Smart Ceiling Lights 1',
    type: 'light',
    location: 'Zone A - South Bay',
    actualState: 'on',
    powerRatingWatts: 80,
    dailyKwh: 0.64,
    weeklyKwh: 4.48,
    monthlyKwh: 19.20,
    yearlyKwh: 230.40,
    estimatedCostMonthly: 144.00,
  },
  {
    id: 'dev-fan-zone-b',
    name: 'Exhaust Fan Rack',
    type: 'fan',
    location: 'Zone B - Server & IoT Rack',
    actualState: 'on',
    powerRatingWatts: 120,
    dailyKwh: 1.20,
    weeklyKwh: 8.40,
    monthlyKwh: 36.00,
    yearlyKwh: 432.00,
    estimatedCostMonthly: 270.00,
  },
  {
    id: 'dev-ac-main-hall',
    name: 'Inverter Air Conditioner',
    type: 'ac',
    location: 'Main Incubation Hall',
    actualState: 'on',
    powerRatingWatts: 1500,
    dailyKwh: 12.00,
    weeklyKwh: 84.00,
    monthlyKwh: 360.00,
    yearlyKwh: 4320.00,
    estimatedCostMonthly: 2700.00,
  },
];

console.log('Inserting 3 zone-wise hardware devices into public.power_consumption...');
const savedCount = savePowerConsumption(sampleDevices);
assert.strictEqual(savedCount, 3, 'Should save 3 devices');

console.log('Querying public.power_consumption from PostgreSQL...');
const storedDevices = getPowerConsumption();
assert(Array.isArray(storedDevices) && storedDevices.length >= 3, 'Should return at least 3 devices');

const lightDev = storedDevices.find(d => d.device_id === 'dev-light-zone-a');
assert(lightDev, 'Zone A light device must exist in power_consumption');
assert.strictEqual(lightDev.location, 'Zone A - South Bay');
assert.strictEqual(Number(lightDev.power_rating_watts), 80);
assert.strictEqual(Number(lightDev.daily_kwh), 0.64);
console.log('✓ Verified: Zone-wise power consumption stored in public.power_consumption table.');


// ==========================================
// TEST 2: OVERDUE TRACKER WORKFLOW
// ==========================================
console.log('\n--- TEST 2: Overdue Tracker Workflow ---');
const testTxnId = `TXN-OVERDUE-TEST-${Date.now()}`;
const now = new Date();
const tenDaysAgo = new Date(now.getTime() - 10 * 86400000).toISOString();
const fourDaysAgo = new Date(now.getTime() - 4 * 86400000).toISOString(); // End date (due date) was 4 days ago!

console.log(`[Step 1] Creating an active loan ${testTxnId} in public.issued_components with due date in the past (4 days ago)...`);
insertIssuedComponent({
  id: testTxnId,
  registration_number: '238W1A0477',
  student_name: 'hemadri',
  phone_number: '9876543210',
  student_details: { department: 'ECE', year: 'III' },
  components: [
    {
      componentId: 'COMP-002',
      componentName: 'ESP32 Wi-Fi + Bluetooth Dev Board',
      category: 'Development Boards',
      quantity: 1,
      issuedQuantity: 1,
      returnedQuantity: 0,
      individualIds: ['ESP32-001'],
      dueDate: fourDaysAgo, // Crossed end date!
    }
  ],
  issue_date: tenDaysAgo,
  overall_due_date: fourDaysAgo,
  status: 'issued',
  notes: 'Testing overdue detection',
  issued_by: 'Admin',
});

console.log('[Step 2] Executing "Check Overdues" workflow (checkAndSyncOverdues)...');
const detectedOverdues = checkAndSyncOverdues();
console.log(`Detected overdues count: ${detectedOverdues.length}`);

const matchingOverdue = detectedOverdues.find(o => o.transaction_id === testTxnId);
assert(matchingOverdue, `Loan ${testTxnId} must be detected as overdue!`);
assert.strictEqual(matchingOverdue.registration_number, '238W1A0477');
assert.strictEqual(matchingOverdue.student_name, 'hemadri');
assert.strictEqual(matchingOverdue.phone_number, '9876543210');
assert.strictEqual(matchingOverdue.component_name, 'ESP32 Wi-Fi + Bluetooth Dev Board');
assert(matchingOverdue.overdue_days >= 3, `Expected at least 3-4 days overdue, got ${matchingOverdue.overdue_days}`);
assert.strictEqual(matchingOverdue.status, 'overdue');
console.log(`✓ Verified: Overdue loan detected and added to public.overdue_components with overdue_days = ${matchingOverdue.overdue_days}.`);

// ==========================================
// TEST 3: CLEANUP / RESOLUTION VERIFICATION
// ==========================================
console.log('\n--- TEST 3: Return & Resolution ---');
console.log(`Marking loan ${testTxnId} as returned in public.issued_components...`);
queryPg(`UPDATE public.issued_components SET status = 'returned' WHERE id = '${testTxnId}';`);

console.log('Re-running "Check Overdues" to verify resolved status in overdue_components...');
const activeAfterReturn = checkAndSyncOverdues();
const stillOverdue = activeAfterReturn.find(o => o.transaction_id === testTxnId);
assert(!stillOverdue, 'Returned transaction should no longer appear in active overdues list');

// Clean up test rows
queryPg(`DELETE FROM public.overdue_components WHERE transaction_id = '${testTxnId}';`);
queryPg(`DELETE FROM public.issued_components WHERE id = '${testTxnId}';`);
console.log('✓ Verified: Return resolution and clean up complete.');

console.log('\n🎉 ALL TESTS PASSED! Power consumption and overdue tracking are 100% verified in PostgreSQL.');
