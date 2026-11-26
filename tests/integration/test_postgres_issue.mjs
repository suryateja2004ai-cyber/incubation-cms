// tests/integration/test_postgres_issue.mjs
import assert from 'assert';
import {
  insertIssuedComponent,
  getIssuedComponents,
  updateReturnComponent,
  queryPg
} from '../../backend/postgres_service.js';

console.log('🧪 Starting PostgreSQL Integration Test for Issue Components...');

const testTxnId = `TXN-PGTEST-${Date.now()}`;
const testRoll = '238W1A0477';
const testName = 'hemadri';
const testPhone = '9876543210';
const testComponents = [
  {
    componentId: 'COMP-ESP32',
    componentName: 'ESP32 Wi-Fi + Bluetooth Dev Board',
    quantity: 1,
    individualIds: ['ESP32-TAG-01'],
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString()
  }
];

// 1. Insert into PostgreSQL
console.log(`[Step 1] Inserting issue record ${testTxnId} into public.issued_components...`);
const insertRes = insertIssuedComponent({
  id: testTxnId,
  registration_number: testRoll,
  student_name: testName,
  phone_number: testPhone,
  student_details: { department: 'ECE', year: 'III', email: 'hemadri@vrsec.ac.in' },
  components: testComponents,
  issue_date: new Date().toISOString(),
  overall_due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
  status: 'issued',
  notes: 'Integration test for Issue Components',
  issued_by: 'Admin',
});

console.log('Insert response:', insertRes);

// 2. Query from PostgreSQL
console.log(`[Step 2] Querying records for registration_number = ${testRoll}...`);
const records = getIssuedComponents(testRoll);
assert(Array.isArray(records), 'Expected array of records');
const found = records.find(r => r.id === testTxnId);
assert(found, `Expected transaction ${testTxnId} to exist in PostgreSQL`);
assert.strictEqual(found.registration_number, testRoll);
assert.strictEqual(found.student_name, testName);
assert.strictEqual(found.phone_number, testPhone);
assert.strictEqual(found.status, 'issued');
assert.strictEqual(found.components.length, 1);
assert.strictEqual(found.components[0].individualIds[0], 'ESP32-TAG-01');
console.log('✓ Verified: Transaction record exists in PostgreSQL with all student details and components.');

// 3. Update return status
console.log(`[Step 3] Updating return status for ${testTxnId}...`);
testComponents[0].returnedQuantity = 1;
testComponents[0].status = 'returned';
updateReturnComponent({
  id: testTxnId,
  status: 'returned',
  items: testComponents,
});

const updatedRecords = getIssuedComponents(testRoll);
const updatedFound = updatedRecords.find(r => r.id === testTxnId);
assert.strictEqual(updatedFound.status, 'returned');
console.log('✓ Verified: Return status updated to "returned" in PostgreSQL.');

// 4. Clean up test record
queryPg(`DELETE FROM public.issued_components WHERE id = '${testTxnId}';`);
console.log('✓ Cleaned up test record.');

console.log('🎉 ALL POSTGRESQL INTEGRATION TESTS PASSED SUCCESSFULLY!');
