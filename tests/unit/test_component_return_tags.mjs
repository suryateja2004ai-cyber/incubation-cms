// tests/unit/test_component_return_tags.mjs
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

import {
  initDatabase,
  getComponentById,
  issueComponents,
  returnComponents,
  getActiveTransactionsForStudent,
  getTransactions,
} from '../../frontend/src/db/database.js';

console.log('🧪 Starting Component Return & Tag Selection Verification Test...');

// 1. Initialize DB with sample data
initDatabase();

// Find an individually tracked component (e.g., COMP-002: ESP32)
const esp32 = getComponentById('COMP-002');
assert(esp32, 'ESP32 component should exist');
assert.strictEqual(esp32.trackingMode, 'individual', 'ESP32 should be individually tracked');

const availableTags = esp32.individualIds.filter((t) => t.status === 'available');
assert(availableTags.length >= 1, 'There should be at least 1 available tag');
const tagToIssue = availableTags[0].id;

console.log(`[Test 1] Issuing 1 unit of ESP32 (Tag: ${tagToIssue}) to student 238W1A0477...`);
const issueResult = await issueComponents({
  studentRoll: '238W1A0477',
  studentName: 'hemadri',
  items: [
    {
      componentId: 'COMP-002',
      quantity: 1,
      individualIds: [tagToIssue],
      selectedIndividualIds: [tagToIssue],
      dueDays: 14,
    },
  ],
  actor: { name: 'Admin', role: 'admin' },
});

assert(issueResult && issueResult.id, 'Transaction should be created');
const issuedItem = issueResult.items.find((i) => i.componentId === 'COMP-002');
assert(issuedItem, 'Transaction should include ESP32');
assert(Array.isArray(issuedItem.individualIds), 'issuedItem.individualIds must be an array');
assert(issuedItem.individualIds.includes(tagToIssue), `issuedItem.individualIds must contain ${tagToIssue}`);
console.log('✓ Verified: Newly issued transaction correctly stores individualIds in transaction item.');

// 2. Test active transactions for student
console.log('\n[Test 2] Querying active transactions for 238W1A0477...');
const activeTxns = getActiveTransactionsForStudent('238W1A0477');
const foundTxn = activeTxns.find((t) => t.id === issueResult.id);
assert(foundTxn, 'Transaction should be returned');
const activeItem = foundTxn.items.find((i) => i.componentId === 'COMP-002');
assert(Array.isArray(activeItem.individualIds), 'individualIds should be an array');
assert.strictEqual(activeItem.individualIds[0], tagToIssue);
console.log('✓ Verified: getActiveTransactionsForStudent returns transaction with valid individualIds.');

// 3. Test Return Process with specified tag
console.log(`\n[Test 3] Returning tag ${tagToIssue} for transaction ${issueResult.id}...`);
const returnResult = await returnComponents(
  issueResult.id,
  [
    {
      componentId: 'COMP-002',
      returnQuantity: 1,
      returnedIndividualIds: [tagToIssue],
    },
  ],
  { name: 'Admin', role: 'admin' }
);

assert(returnResult, 'Return result should succeed');
assert.strictEqual(returnResult.status, 'returned', 'Transaction status should be returned');
const updatedComp = getComponentById('COMP-002');
const returnedTagObj = updatedComp.individualIds.find((t) => t.id === tagToIssue);
assert.strictEqual(returnedTagObj.status, 'available', 'Tag status should be reset to available');
assert.strictEqual(returnedTagObj.currentTransactionId, null, 'Tag currentTransactionId should be cleared');
assert.strictEqual(returnedTagObj.currentStudentRoll, null, 'Tag currentStudentRoll should be cleared');
console.log('✓ Verified: returnComponents marks tag as available and clears transaction/student association.');

// 4. Test Return Process Fallback (when no specific tags are provided)
console.log(`\n[Test 4] Testing return with empty tag list (quantity fallback)...`);
// Issue another one
const issue2 = await issueComponents({
  studentRoll: '238W1A0477',
  studentName: 'hemadri',
  items: [
    {
      componentId: 'COMP-002',
      quantity: 1,
      individualIds: [tagToIssue],
      selectedIndividualIds: [tagToIssue],
      dueDays: 14,
    },
  ],
  actor: { name: 'Admin', role: 'admin' },
});

const returnResultFallback = await returnComponents(
  issue2.id,
  [
    {
      componentId: 'COMP-002',
      returnQuantity: 1,
      returnedIndividualIds: [],
    },
  ],
  { name: 'Admin', role: 'admin' }
);
assert.strictEqual(returnResultFallback.status, 'returned', 'Transaction should be successfully returned via quantity fallback');
console.log('✓ Verified: Quantity fallback allows returning the component even if no individual tag was selected.');

console.log('\n🎉 ALL 4 TESTS PASSED! Component return and tag selection bug is completely resolved!');
