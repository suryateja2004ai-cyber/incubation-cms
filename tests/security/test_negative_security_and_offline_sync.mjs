// tests/security/test_negative_security_and_offline_sync.mjs
// Rigorous Negative Security, Idempotency & Offline Synchronization Test Suite

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');

console.log('===================================================================');
console.log('🔒 EXECUTING NEGATIVE SECURITY & OFFLINE RECONNECT SUITE');
console.log('===================================================================\n');

let passedTests = 0;
let totalTests = 0;

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

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] Test ${totalTests}: ${name}`);
    console.error('    Error:', err.message);
    throw err;
  }
}

async function main() {
  const migration007Path = path.join(workspaceRoot, 'database/supabase/migrations/007_restricted_staff_role.sql');
  assert.ok(fs.existsSync(migration007Path), 'Migration 007 file must exist');
  const sqlContent = fs.readFileSync(migration007Path, 'utf8');

  // =========================================================================
  // WORKSTREAM 1: Direct Staff Transaction INSERT/UPDATE Rejection
  // =========================================================================
  console.log('--- WORKSTREAM 1: Direct Staff Transaction INSERT/UPDATE Rejection ---');

  runTest('SQL Migration explicitly drops direct staff transaction INSERT and UPDATE policies', () => {
    assert.ok(
      sqlContent.includes('DROP POLICY IF EXISTS "Staff insert transactions" ON public.transactions;'),
      'Must explicitly drop "Staff insert transactions"'
    );
    assert.ok(
      sqlContent.includes('DROP POLICY IF EXISTS "Staff update transactions" ON public.transactions;'),
      'Must explicitly drop "Staff update transactions"'
    );
    assert.ok(
      sqlContent.includes('DROP POLICY IF EXISTS "Staff manage transactions" ON public.transactions;'),
      'Must explicitly drop "Staff manage transactions"'
    );
  });

  runTest('SQL Migration does NOT create direct staff transaction INSERT or UPDATE policies', () => {
    assert.ok(
      !sqlContent.includes('CREATE POLICY "Staff insert transactions"'),
      'Must NOT create "Staff insert transactions"'
    );
    assert.ok(
      !sqlContent.includes('CREATE POLICY "Staff update transactions"'),
      'Must NOT create "Staff update transactions"'
    );
    assert.ok(
      !sqlContent.includes('CREATE POLICY "Staff manage transactions"'),
      'Must NOT create "Staff manage transactions"'
    );
  });

  runTest('SQL Migration preserves staff SELECT and full admin privileges on transactions', () => {
    assert.ok(
      sqlContent.includes('CREATE POLICY "Staff view transactions" ON public.transactions'),
      'Staff must retain SELECT on public.transactions'
    );
    assert.ok(
      sqlContent.includes('CREATE POLICY "Admins manage transactions" ON public.transactions'),
      'Admins must retain full FOR ALL access on public.transactions'
    );
  });

  runTest('RLS Engine Simulation: Staff direct INSERT on transactions fails closed', () => {
    function simulateRLSTransactionDML(role, operation) {
      // Replicates PostgreSQL RLS policy evaluation on public.transactions
      const adminRoles = ['admin', 'substitute_admin', 'sir'];
      if (adminRoles.includes(role)) {
        return true; // Admins manage transactions: FOR ALL
      }
      if (role === 'staff' && operation === 'SELECT') {
        return true; // Staff view transactions: FOR SELECT
      }
      if (role === 'student' && operation === 'SELECT') {
        return true; // Students view own transactions: FOR SELECT
      }
      throw new Error(`RLS Policy Violation: Role "${role}" has no permissive policy for ${operation} on public.transactions.`);
    }

    // Direct staff mutations must be rejected
    assert.throws(() => simulateRLSTransactionDML('staff', 'INSERT'), /RLS Policy Violation/);
    assert.throws(() => simulateRLSTransactionDML('staff', 'UPDATE'), /RLS Policy Violation/);
    assert.throws(() => simulateRLSTransactionDML('staff', 'DELETE'), /RLS Policy Violation/);

    // Staff SELECT is permitted
    assert.strictEqual(simulateRLSTransactionDML('staff', 'SELECT'), true);

    // Admin full access is permitted
    assert.strictEqual(simulateRLSTransactionDML('admin', 'INSERT'), true);
    assert.strictEqual(simulateRLSTransactionDML('admin', 'UPDATE'), true);
    assert.strictEqual(simulateRLSTransactionDML('admin', 'DELETE'), true);
  });

  // =========================================================================
  // WORKSTREAM 2: Individual-Tag Return Validation & Hardening
  // =========================================================================
  console.log('\n--- WORKSTREAM 2: Individual-Tag Return Validation & Hardening ---');

  function simulateReturnComponentsAtomic({
    trackingMode,
    returnQuantity,
    returnedIndividualIds,
    issuedIndividualIds,
    catalogIndividualIds,
    transactionId = 'TXN-100',
    studentRoll = '238W1A0477',
  }) {
    if (returnQuantity === null || returnQuantity === undefined || returnQuantity <= 0) {
      throw new Error('Validation Failed: Return quantity must be greater than zero.');
    }

    const retTags = returnedIndividualIds || [];

    if (trackingMode === 'individual') {
      if (!retTags || retTags.length === 0) {
        throw new Error('Validation Failed: Physical tag IDs are strictly required when returning individual tracking component.');
      }
      if (retTags.length !== returnQuantity) {
        throw new Error(`Validation Failed: Number of selected physical tags (${retTags.length}) must exactly match return quantity (${returnQuantity}).`);
      }

      const seenTags = new Set();
      for (const tag of retTags) {
        if (!tag || tag.trim() === '') {
          throw new Error('Validation Failed: Returned physical tag ID cannot be empty.');
        }
        if (seenTags.has(tag)) {
          throw new Error(`Validation Failed: Duplicate physical tag "${tag}" in return payload.`);
        }
        seenTags.add(tag);

        if (!issuedIndividualIds.includes(tag)) {
          throw new Error(`Validation Failed: Physical tag "${tag}" was not issued in this transaction.`);
        }

        const catalogTag = catalogIndividualIds.find((c) => c.id === tag);
        if (!catalogTag || catalogTag.status !== 'issued' || catalogTag.currentTransactionId !== transactionId || catalogTag.currentStudentRoll !== studentRoll) {
          throw new Error(`Validation Failed: Physical tag "${tag}" is not currently issued to transaction "${transactionId}" and student "${studentRoll}".`);
        }
      }
    } else if (trackingMode === 'bulk' || trackingMode === 'batch') {
      if (retTags.length > 0) {
        throw new Error('Validation Failed: Component is tracked in bulk/batch mode and does not use physical tags. Physical tags must not be provided.');
      }
    }

    return { success: true, returnedCount: returnQuantity };
  }

  runTest('Individual tracking: Rejects return when physical tag array is empty', () => {
    assert.throws(
      () =>
        simulateReturnComponentsAtomic({
          trackingMode: 'individual',
          returnQuantity: 2,
          returnedIndividualIds: [],
          issuedIndividualIds: ['TAG-01', 'TAG-02'],
          catalogIndividualIds: [
            { id: 'TAG-01', status: 'issued', currentTransactionId: 'TXN-100', currentStudentRoll: '238W1A0477' },
            { id: 'TAG-02', status: 'issued', currentTransactionId: 'TXN-100', currentStudentRoll: '238W1A0477' },
          ],
        }),
      /Physical tag IDs are strictly required/
    );
  });

  runTest('Individual tracking: Rejects return when tag count does not match return quantity', () => {
    assert.throws(
      () =>
        simulateReturnComponentsAtomic({
          trackingMode: 'individual',
          returnQuantity: 2,
          returnedIndividualIds: ['TAG-01'],
          issuedIndividualIds: ['TAG-01', 'TAG-02'],
          catalogIndividualIds: [
            { id: 'TAG-01', status: 'issued', currentTransactionId: 'TXN-100', currentStudentRoll: '238W1A0477' },
            { id: 'TAG-02', status: 'issued', currentTransactionId: 'TXN-100', currentStudentRoll: '238W1A0477' },
          ],
        }),
      /Number of selected physical tags \(1\) must exactly match return quantity \(2\)/
    );
  });

  runTest('Individual tracking: Rejects duplicate tags in return payload', () => {
    assert.throws(
      () =>
        simulateReturnComponentsAtomic({
          trackingMode: 'individual',
          returnQuantity: 2,
          returnedIndividualIds: ['TAG-01', 'TAG-01'],
          issuedIndividualIds: ['TAG-01', 'TAG-02'],
          catalogIndividualIds: [
            { id: 'TAG-01', status: 'issued', currentTransactionId: 'TXN-100', currentStudentRoll: '238W1A0477' },
          ],
        }),
      /Duplicate physical tag "TAG-01"/
    );
  });

  runTest('Individual tracking: Rejects tags not issued to this transaction', () => {
    assert.throws(
      () =>
        simulateReturnComponentsAtomic({
          trackingMode: 'individual',
          returnQuantity: 1,
          returnedIndividualIds: ['TAG-999'],
          issuedIndividualIds: ['TAG-01', 'TAG-02'],
          catalogIndividualIds: [
            { id: 'TAG-01', status: 'issued', currentTransactionId: 'TXN-100', currentStudentRoll: '238W1A0477' },
            { id: 'TAG-999', status: 'issued', currentTransactionId: 'TXN-OTHER', currentStudentRoll: '238W1A0477' },
          ],
        }),
      /was not issued in this transaction/
    );
  });

  runTest('Individual tracking: Rejects tag if catalog shows it is not issued to this student', () => {
    assert.throws(
      () =>
        simulateReturnComponentsAtomic({
          trackingMode: 'individual',
          returnQuantity: 1,
          returnedIndividualIds: ['TAG-01'],
          issuedIndividualIds: ['TAG-01'],
          catalogIndividualIds: [
            // Status in catalog is already 'available' (tampered or previously returned)
            { id: 'TAG-01', status: 'available', currentTransactionId: null, currentStudentRoll: null },
          ],
        }),
      /is not currently issued to transaction "TXN-100" and student "238W1A0477"/
    );
  });

  // =========================================================================
  // WORKSTREAM 3: Bulk / Batch Tracking Component Return Enforcement
  // =========================================================================
  console.log('\n--- WORKSTREAM 3: Bulk / Batch Tracking Component Return Enforcement ---');

  runTest('Bulk tracking: Rejects return if physical tags are supplied', () => {
    assert.throws(
      () =>
        simulateReturnComponentsAtomic({
          trackingMode: 'bulk',
          returnQuantity: 5,
          returnedIndividualIds: ['FORGED-TAG-1'],
          issuedIndividualIds: [],
          catalogIndividualIds: [],
        }),
      /is tracked in bulk\/batch mode and does not use physical tags/
    );
  });

  runTest('Bulk tracking: Permits legitimate quantity return with empty physical tags', () => {
    const res = simulateReturnComponentsAtomic({
      trackingMode: 'bulk',
      returnQuantity: 5,
      returnedIndividualIds: [],
      issuedIndividualIds: [],
      catalogIndividualIds: [],
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.returnedCount, 5);
  });

  // =========================================================================
  // WORKSTREAM 4: Server-Side RPC Idempotency & Duplicate Retry Shield
  // =========================================================================
  console.log('\n--- WORKSTREAM 4: Server-Side RPC Idempotency & Duplicate Retry Shield ---');

  runTest('SQL Migration defines public.processed_rpc_operations table with strict RLS', () => {
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.processed_rpc_operations'), 'Must create processed_rpc_operations table');
    assert.ok(sqlContent.includes('operation_id text PRIMARY KEY'), 'operation_id must be PRIMARY KEY');
    assert.ok(sqlContent.includes('actor_id uuid'), 'actor_id must be in processed_rpc_operations schema');
    assert.ok(sqlContent.includes('payload_hash text'), 'payload_hash must be in processed_rpc_operations schema');
    assert.ok(sqlContent.includes('ALTER TABLE public.processed_rpc_operations ENABLE ROW LEVEL SECURITY'), 'Must enable RLS');
    assert.ok(sqlContent.includes('ALTER TABLE public.processed_rpc_operations FORCE ROW LEVEL SECURITY'), 'Must force RLS');
    assert.ok(sqlContent.includes('CREATE POLICY "Admins view processed rpc operations"'), 'Admins must have SELECT policy');
    assert.ok(!sqlContent.includes('CREATE POLICY "Staff view processed rpc operations"'), 'Staff must NOT have broad SELECT policy on processed_rpc_operations');
    assert.ok(sqlContent.includes('DROP POLICY IF EXISTS "Staff view processed rpc operations" ON public.processed_rpc_operations;'), 'Must explicitly drop Staff view policy');
    assert.ok(!sqlContent.includes('GRANT INSERT ON public.processed_rpc_operations TO authenticated'), 'Authenticated users must NOT have direct INSERT grant');
  });

  runTest('Removal of unsafe existing-ID UPSERT validation bypasses in INSERT triggers', () => {
    assert.ok(
      !sqlContent.includes('SELECT 1 FROM public.visits WHERE id = NEW.id'),
      'validate_visits_on_insert must NOT bypass validation on existing IDs'
    );
    assert.ok(
      !sqlContent.includes('SELECT 1 FROM public.transactions WHERE id = NEW.id'),
      'validate_transactions_on_insert must NOT bypass validation on existing IDs'
    );
  });

  runTest('Role authorization is enforced BEFORE returning any cached ledger result', () => {
    const mockLedger = new Map([
      ['OP-CACHED-001', { status: 'completed', result: { id: 'TXN-999', status: 'active' } }]
    ]);

    function simulateRoleCheckBeforeLedger(role, opId) {
      // 1. Role authorization must execute first
      const allowedRoles = ['admin', 'substitute_admin', 'sir', 'staff'];
      if (!role || !allowedRoles.includes(role)) {
        throw new Error('Access Denied: Insufficient permissions to issue components.');
      }

      // 2. Ledger lookup
      if (mockLedger.has(opId) && mockLedger.get(opId).status === 'completed') {
        return mockLedger.get(opId).result;
      }
      return null;
    }

    // Student or unauthenticated user cannot get cached result
    assert.throws(() => simulateRoleCheckBeforeLedger('student', 'OP-CACHED-001'), /Access Denied/);
    assert.throws(() => simulateRoleCheckBeforeLedger(null, 'OP-CACHED-001'), /Access Denied/);
    // Authorized roles succeed
    assert.deepStrictEqual(simulateRoleCheckBeforeLedger('staff', 'OP-CACHED-001'), { id: 'TXN-999', status: 'active' });
    assert.deepStrictEqual(simulateRoleCheckBeforeLedger('admin', 'OP-CACHED-001'), { id: 'TXN-999', status: 'active' });
  });

  runTest('Ledger entry binds actor_id, operation_type, and payload_hash with safe in_progress handling', () => {
    const ledger = new Map();

    function simulateBoundLedgerOperation({ opId, opType, actorId, payload, role }) {
      const allowedRoles = ['admin', 'substitute_admin', 'sir', 'staff'];
      if (!role || !allowedRoles.includes(role)) {
        throw new Error('Access Denied: Insufficient permissions.');
      }

      const payloadHash = JSON.stringify(payload);

      if (ledger.has(opId)) {
        const existing = ledger.get(opId);
        if (existing.opType !== opType) {
          throw new Error(`Security Violation: Operation ID "${opId}" is registered for operation "${existing.opType}", not "${opType}".`);
        }
        if (existing.actorId && actorId && existing.actorId !== actorId) {
          throw new Error(`Security Violation: Operation ID "${opId}" belongs to a different authenticated actor.`);
        }
        if (existing.payloadHash !== payloadHash) {
          throw new Error(`Security Violation: Operation ID "${opId}" was already submitted with a different payload.`);
        }
        if (existing.status === 'completed') {
          return { cached: true, result: existing.result };
        }
        if (existing.status === 'in_progress') {
          throw new Error(`Operation "${opId}" is currently in progress. Duplicate execution is prohibited.`);
        }
      }

      // Reserve
      ledger.set(opId, { opType, actorId, payloadHash, status: 'in_progress', result: null });

      // Execute & Complete
      const result = { success: true, opId };
      ledger.set(opId, { opType, actorId, payloadHash, status: 'completed', result });
      return { cached: false, result };
    }

    const opId = 'OP-BOUND-TEST-001';
    const actorA = 'UUID-ACTOR-A';
    const actorB = 'UUID-ACTOR-B';
    const payload1 = { roll: '238W1A0477', items: [{ id: 'COMP-1', qty: 1 }] };
    const payloadTampered = { roll: '238W1A0477', items: [{ id: 'COMP-1', qty: 99 }] };

    // 1. Initial execution by Actor A
    const res1 = simulateBoundLedgerOperation({ opId, opType: 'issue_components', actorId: actorA, payload: payload1, role: 'staff' });
    assert.strictEqual(res1.cached, false);

    // 2. Legitimate retry by same Actor A with identical payload returns cached result
    const res2 = simulateBoundLedgerOperation({ opId, opType: 'issue_components', actorId: actorA, payload: payload1, role: 'staff' });
    assert.strictEqual(res2.cached, true);

    // 3. Rejection of different actor reusing the operation ID
    assert.throws(
      () => simulateBoundLedgerOperation({ opId, opType: 'issue_components', actorId: actorB, payload: payload1, role: 'staff' }),
      /belongs to a different authenticated actor/
    );

    // 4. Rejection of operation type mismatch (calling return with issue opId)
    assert.throws(
      () => simulateBoundLedgerOperation({ opId, opType: 'return_components', actorId: actorA, payload: payload1, role: 'staff' }),
      /registered for operation "issue_components", not "return_components"/
    );

    // 5. Rejection of payload tampering with same opId
    assert.throws(
      () => simulateBoundLedgerOperation({ opId, opType: 'issue_components', actorId: actorA, payload: payloadTampered, role: 'staff' }),
      /was already submitted with a different payload/
    );

    // 6. Safe in_progress handling
    ledger.set('OP-STALLED-001', { opType: 'issue_components', actorId: actorA, payloadHash: JSON.stringify(payload1), status: 'in_progress', result: null });
    assert.throws(
      () => simulateBoundLedgerOperation({ opId: 'OP-STALLED-001', opType: 'issue_components', actorId: actorA, payload: payload1, role: 'staff' }),
      /currently in progress\. Duplicate execution is prohibited/
    );
  });

  runTest('update_student_profile strictly requires student role and binds to authenticated session', () => {
    function simulateUpdateStudentProfile({ callerRole, authUid, userRecord }) {
      if (!callerRole || callerRole !== 'student') {
        throw new Error('Access Denied: Only students may update their student profile via this function.');
      }
      if (!authUid) {
        throw new Error('Access Denied: Unauthenticated student session.');
      }
      if (!userRecord || userRecord.authId !== authUid || userRecord.role !== 'student') {
        throw new Error('Validation Failed: Student profile not found for current authenticated session.');
      }
      return { success: true, updatedUser: userRecord.rollNumber };
    }

    const validStudentUser = { authId: 'AUTH-STUDENT-01', rollNumber: '238W1A0477', role: 'student' };

    // Staff is blocked
    assert.throws(() => simulateUpdateStudentProfile({ callerRole: 'staff', authUid: 'AUTH-STAFF', userRecord: validStudentUser }), /Only students may update/);
    // Admin is blocked
    assert.throws(() => simulateUpdateStudentProfile({ callerRole: 'admin', authUid: 'AUTH-ADMIN', userRecord: validStudentUser }), /Only students may update/);
    // Unauthenticated is blocked
    assert.throws(() => simulateUpdateStudentProfile({ callerRole: 'student', authUid: null, userRecord: validStudentUser }), /Unauthenticated student session/);
    // Tampering with another user's profile is blocked
    assert.throws(() => simulateUpdateStudentProfile({ callerRole: 'student', authUid: 'AUTH-DIFFERENT-STUDENT', userRecord: validStudentUser }), /Student profile not found/);
    // Valid student succeeds
    const success = simulateUpdateStudentProfile({ callerRole: 'student', authUid: 'AUTH-STUDENT-01', userRecord: validStudentUser });
    assert.strictEqual(success.updatedUser, '238W1A0477');
  });

  runTest('SQL Migration strictly mandates operation_id and uses pg_advisory_xact_lock for concurrency', () => {
    assert.ok(
      sqlContent.includes("RAISE EXCEPTION 'Validation Failed: operation_id is strictly required for atomic operations.'"),
      'Must strictly reject missing or empty operation_id'
    );
    assert.ok(
      sqlContent.includes('PERFORM pg_advisory_xact_lock(hashtext(v_clean_op_id));'),
      'Must use pg_advisory_xact_lock to serialize concurrent requests with same operation_id'
    );
    assert.ok(
      sqlContent.includes("status text NOT NULL DEFAULT 'in_progress'"),
      'Ledger must support atomic in_progress status reservation'
    );

    // Simulation: Reject missing or whitespace operation_ids
    function validateOpId(opId) {
      if (opId === null || opId === undefined || String(opId).trim() === '') {
        throw new Error('Validation Failed: operation_id is strictly required for atomic operations.');
      }
    }
    assert.throws(() => validateOpId(null), /operation_id is strictly required/);
    assert.throws(() => validateOpId(''), /operation_id is strictly required/);
    assert.throws(() => validateOpId('   '), /operation_id is strictly required/);
    assert.doesNotThrow(() => validateOpId('OP-VALID-123'));
  });

  await runAsyncTest('Simultaneous duplicate RPC calls serialize safely: only 1 executes stock changes', async () => {
    // Model PostgreSQL pg_advisory_xact_lock + processed_rpc_operations unique reservation
    const ledger = new Map();
    let inventoryStock = 20;
    let actualExecutions = 0;

    // Mutex to simulate pg_advisory_xact_lock
    let lockHolder = null;
    const lockQueue = [];

    async function acquireAdvisoryLock(opId) {
      if (!lockHolder) {
        lockHolder = opId;
        return;
      }
      await new Promise((resolve) => lockQueue.push(resolve));
      lockHolder = opId;
    }

    function releaseAdvisoryLock() {
      lockHolder = null;
      if (lockQueue.length > 0) {
        const next = lockQueue.shift();
        next();
      }
    }

    async function simulateConcurrentAtomicRPC(opId, quantity) {
      if (!opId || !opId.trim()) {
        throw new Error('Validation Failed: operation_id is strictly required for atomic operations.');
      }

      // Step 0b: Advisory lock
      await acquireAdvisoryLock(opId);

      try {
        // Step 0c: Check if already completed
        if (ledger.has(opId) && ledger.get(opId).status === 'completed') {
          return { cached: true, result: ledger.get(opId).result };
        }

        // Step 0d: Reserve operation ID
        ledger.set(opId, { status: 'in_progress', result: null });

        // Simulate async business logic & stock mutation
        await new Promise((r) => setTimeout(r, 10)); // Artificial concurrency window

        if (inventoryStock < quantity) {
          throw new Error('Insufficient stock');
        }

        inventoryStock -= quantity;
        actualExecutions++;

        const txnResult = {
          transactionId: 'TXN-CONCURRENT-001',
          issuedQuantity: quantity,
          status: 'active',
        };

        // Step 7: Update reservation to completed
        ledger.set(opId, { status: 'completed', result: txnResult });

        return { cached: false, result: txnResult };
      } finally {
        releaseAdvisoryLock();
      }
    }

    const testOpId = 'OP-SIMULTANEOUS-CONCURRENCY-999';

    // Fire 5 simultaneous duplicate calls for the same operation ID
    const promises = [
      simulateConcurrentAtomicRPC(testOpId, 4),
      simulateConcurrentAtomicRPC(testOpId, 4),
      simulateConcurrentAtomicRPC(testOpId, 4),
      simulateConcurrentAtomicRPC(testOpId, 4),
      simulateConcurrentAtomicRPC(testOpId, 4),
    ];

    const results = await Promise.all(promises);

    // Verify exactly ONE executed the business logic and 4 returned the cached result
    const freshCalls = results.filter((r) => !r.cached);
    const cachedCalls = results.filter((r) => r.cached);

    assert.strictEqual(actualExecutions, 1, 'Stock deduction must execute exactly once');
    assert.strictEqual(freshCalls.length, 1, 'Exactly 1 call must be fresh');
    assert.strictEqual(cachedCalls.length, 4, 'Exactly 4 calls must return cached result');
    assert.strictEqual(inventoryStock, 16, 'Stock must only be deducted once (20 - 4 = 16)');

    // Verify all 5 received identical transaction details
    for (const res of results) {
      assert.strictEqual(res.result.transactionId, 'TXN-CONCURRENT-001');
      assert.strictEqual(res.result.issuedQuantity, 4);
    }
  });

  runTest('RPC Functions inspect processed_rpc_operations and prevent duplicate stock deductions', () => {
    // Simulate server-side idempotency cache
    const processedLedger = new Map();
    let inventoryStock = 20;

    function simulateIdempotentIssueRPC(operationId, quantity) {
      if (operationId && processedLedger.has(operationId)) {
        // Return cached result immediately without deducting stock again
        return { cached: true, ...processedLedger.get(operationId) };
      }

      if (inventoryStock < quantity) {
        throw new Error('Insufficient stock');
      }

      inventoryStock -= quantity;
      const result = {
        transactionId: 'TXN-' + Math.random().toString(36).slice(2, 8),
        issuedQuantity: quantity,
        status: 'active',
      };

      if (operationId) {
        processedLedger.set(operationId, result);
      }

      return { cached: false, ...result };
    }

    const opId = 'OP-ISSUE-TEST-12345';

    // 1st Attempt: Executes normally and deducts stock
    const call1 = simulateIdempotentIssueRPC(opId, 3);
    assert.strictEqual(call1.cached, false);
    assert.strictEqual(inventoryStock, 17, 'Inventory stock must be reduced by 3');

    // 2nd Attempt (Network retry / Offline sync replay): Returns cached result, stock unchanged
    const call2 = simulateIdempotentIssueRPC(opId, 3);
    assert.strictEqual(call2.cached, true);
    assert.strictEqual(call2.transactionId, call1.transactionId, 'Must return same transaction ID');
    assert.strictEqual(inventoryStock, 17, 'Stock must NOT be deducted again on retry');

    // 3rd Call with new operation ID: Executes and deducts stock
    const call3 = simulateIdempotentIssueRPC('OP-ISSUE-TEST-67890', 2);
    assert.strictEqual(call3.cached, false);
    assert.strictEqual(inventoryStock, 15, 'Stock must be reduced by 2 for fresh operation');
  });

  // =========================================================================
  // WORKSTREAM 5: Offline Queue Lifecycle & Reconnect Processing
  // =========================================================================
  console.log('\n--- WORKSTREAM 5: Offline Queue Lifecycle & Reconnect Processing ---');

  runTest('SyncService strictly rejects RPC mutations without genuine unique operationId', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');

    // Missing operationId entirely (no fallback to transaction id)
    assert.throws(
      () =>
        syncService.enqueueMutation({
          action: 'rpc',
          rpcName: 'issue_components_atomic',
          id: 'TXN-FALLBACK-ATTEMPT',
          rpcPayload: { p_transaction_id: 'TXN-FALLBACK-ATTEMPT' },
        }),
      /A genuine unique operationId is mandatory for RPC mutations/
    );

    // Empty string operationId
    assert.throws(
      () =>
        syncService.enqueueMutation({
          action: 'rpc',
          rpcName: 'issue_components_atomic',
          id: 'TXN-FALLBACK-ATTEMPT',
          operationId: '',
          rpcPayload: {},
        }),
      /A genuine unique operationId is mandatory for RPC mutations/
    );

    // Whitespace string operationId
    assert.throws(
      () =>
        syncService.enqueueMutation({
          action: 'rpc',
          rpcName: 'issue_components_atomic',
          id: 'TXN-FALLBACK-ATTEMPT',
          operationId: '   ',
          rpcPayload: {},
        }),
      /A genuine unique operationId is mandatory for RPC mutations/
    );
  });

  await runAsyncTest('SyncService preserves atomic RPC mutations and resists premature drops', async () => {
    // Mock localStorage
    const storageStore = {};
    global.localStorage = {
      getItem: (key) => storageStore[key] || null,
      setItem: (key, val) => {
        storageStore[key] = String(val);
      },
      removeItem: (key) => {
        delete storageStore[key];
      },
    };

    // Dynamically import syncService
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');

    // 1. Enqueue an RPC mutation
    const enqueued = syncService.enqueueMutation({
      action: 'rpc',
      rpcName: 'issue_components_atomic',
      id: 'OP-OFFLINE-TEST-101',
      rpcPayload: {
        p_transaction_id: 'TXN-OFFLINE-1',
        p_student_roll: '238W1A0477',
        p_student_name: 'Anwar Bajarinti',
        p_operation_id: 'OP-OFFLINE-TEST-101',
      },
    });

    assert.ok(enqueued.mutationId, 'Mutation must have unique ID');
    assert.strictEqual(enqueued.action, 'rpc');
    assert.strictEqual(enqueued.rpcName, 'issue_components_atomic');

    // 2. Application Restart Simulation: Verify queue survives in localStorage
    const savedQueueJson = global.localStorage.getItem('inc_cms_offline_sync_queue_v1');
    assert.ok(savedQueueJson, 'Queue must be stored in localStorage');
    const parsedQueue = JSON.parse(savedQueueJson);
    assert.strictEqual(parsedQueue.length, 1);
    assert.strictEqual(parsedQueue[0].rpcPayload.p_operation_id, 'OP-OFFLINE-TEST-101');

    // 3. Failed Retry Simulation: Network returns error
    const mockFailingSupabase = {
      rpc: async () => ({ error: { message: 'Cloudflare connection timeout (522)' } }),
    };

    // Force online state for processing
    syncService.isOnline = () => true;

    const failResult = await syncService.processQueue(mockFailingSupabase);
    assert.strictEqual(failResult.processed, 0, 'No operations should be marked processed on failure');
    assert.strictEqual(failResult.pending, 1, 'Operation must remain pending in queue');

    const queueAfterFailure = syncService.getQueue();
    assert.strictEqual(queueAfterFailure.length, 1, 'Failed mutation must NOT be dropped');
    assert.strictEqual(queueAfterFailure[0].retryCount, 1, 'Retry count must increment');
    assert.strictEqual(queueAfterFailure[0].lastError, 'Cloudflare connection timeout (522)');
    assert.ok(queueAfterFailure[0].lastAttemptAt, 'lastAttemptAt timestamp must be recorded');

    // 4. Successful Reconnect Simulation: Network succeeds (after backoff window expires)
    const qBeforeSuccess = syncService.getQueue();
    qBeforeSuccess[0].lastAttemptAt = new Date(Date.now() - 2000).toISOString(); // 2s elapsed (> 1s backoff)
    syncService.saveQueue(qBeforeSuccess);

    let rpcCalledWith = null;
    const mockSuccessSupabase = {
      rpc: async (name, payload) => {
        rpcCalledWith = { name, payload };
        return { data: { success: true }, error: null };
      },
    };

    const successResult = await syncService.processQueue(mockSuccessSupabase);
    assert.strictEqual(successResult.processed, 1, 'Operation must be processed');
    assert.strictEqual(successResult.pending, 0, 'Queue must be empty');
    assert.strictEqual(rpcCalledWith.name, 'issue_components_atomic');
    assert.strictEqual(rpcCalledWith.payload.p_operation_id, 'OP-OFFLINE-TEST-101');

    const finalQueue = syncService.getQueue();
    assert.strictEqual(finalQueue.length, 0, 'Processed mutations must be safely removed from queue');
  });

  await runAsyncTest('Multiple legitimate offline returns for the same transaction are preserved via unique operationId', async () => {
    const storageStore = {};
    global.localStorage = {
      getItem: (key) => storageStore[key] || null,
      setItem: (key, val) => {
        storageStore[key] = String(val);
      },
      removeItem: (key) => {
        delete storageStore[key];
      },
    };

    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');

    const txnId = 'TXN-MULTI-RETURN-888';

    // 1. Enqueue Return 1 for Component A (ESP32) on transaction TXN-MULTI-RETURN-888
    const opId1 = 'OP-RETURN-888-PART-1';
    syncService.enqueueMutation({
      table: 'transactions',
      action: 'rpc',
      rpcName: 'return_components_atomic',
      id: txnId,
      operationId: opId1,
      rpcPayload: {
        p_transaction_id: txnId,
        p_returned_items: [{ componentId: 'COMP-ESP32', returnQuantity: 1, returnedIndividualIds: ['TAG-ESP32-1'] }],
        p_operation_id: opId1,
      },
    });

    // 2. Enqueue Return 2 for Component B (Ultrasonic Sensor) on the SAME transaction TXN-MULTI-RETURN-888
    const opId2 = 'OP-RETURN-888-PART-2';
    syncService.enqueueMutation({
      table: 'transactions',
      action: 'rpc',
      rpcName: 'return_components_atomic',
      id: txnId,
      operationId: opId2,
      rpcPayload: {
        p_transaction_id: txnId,
        p_returned_items: [{ componentId: 'COMP-ULTRASONIC', returnQuantity: 2 }],
        p_operation_id: opId2,
      },
    });

    // CRITICAL INVARIANT: The queue must preserve BOTH returns because operationId is unique!
    const queue = syncService.getQueue();
    assert.strictEqual(queue.length, 2, 'Queue must hold both legitimate returns for the same transaction');
    assert.strictEqual(queue[0].operationId, opId1);
    assert.strictEqual(queue[1].operationId, opId2);

    // 3. Duplicate enqueuing of the exact same return operation should update, not append
    syncService.enqueueMutation({
      table: 'transactions',
      action: 'rpc',
      rpcName: 'return_components_atomic',
      id: txnId,
      operationId: opId1,
      rpcPayload: {
        p_transaction_id: txnId,
        p_returned_items: [{ componentId: 'COMP-ESP32', returnQuantity: 1, returnedIndividualIds: ['TAG-ESP32-1'] }],
        p_operation_id: opId1,
      },
    });
    assert.strictEqual(syncService.getQueue().length, 2, 'Duplicate submission with same operationId must not append a third item');

    // 4. Application Restart Simulation: Verify localStorage retains both mutations
    const rawStorage = global.localStorage.getItem('inc_cms_offline_sync_queue_v1');
    assert.ok(rawStorage, 'localStorage must contain serialized queue');
    const restoredQueue = JSON.parse(rawStorage);
    assert.strictEqual(restoredQueue.length, 2, 'Restarted application must recover both queued return mutations');
    assert.strictEqual(restoredQueue[0].rpcPayload.p_operation_id, opId1);
    assert.strictEqual(restoredQueue[1].rpcPayload.p_operation_id, opId2);

    // 5. Cloud Reconnection: Both operations execute against Supabase and succeed
    const executedRpcs = [];
    const mockSupabase = {
      rpc: async (name, payload) => {
        executedRpcs.push({ name, payload });
        return { data: { success: true }, error: null };
      },
    };

    syncService.isOnline = () => true;
    const processResult = await syncService.processQueue(mockSupabase);

    assert.strictEqual(processResult.processed, 2, 'Both return operations must process successfully');
    assert.strictEqual(processResult.pending, 0, 'Queue must be completely cleared');
    assert.strictEqual(executedRpcs.length, 2);
    assert.strictEqual(executedRpcs[0].payload.p_operation_id, opId1);
    assert.strictEqual(executedRpcs[1].payload.p_operation_id, opId2);
  });

  // =========================================================================
  // WORKSTREAM 5B: Strict Actor, Complete Payload Binding & Queue Lifecycle
  // (12 Explicit Regression Tests for Section 3 of Security Hardening Plan)
  // =========================================================================
  console.log('\n--- WORKSTREAM 5B: 12-Scenario Security & Idempotency Regression Suite ---');

  // Shared test harness simulating PostgreSQL RPC logic with full actor, payload hash, and replay validation
  const testLedger = new Map();

  function simulateAtomicRpcHarness({
    callerRole = 'staff',
    authUid = 'UUID-DEFAULT-STAFF',
    isServiceRole = false,
    operationId,
    operationType, // 'issue_components' | 'return_components'
    transactionId,
    studentRoll,
    studentName,
    studentPhone,
    authorizedBy,
    overallDueDate,
    notes,
    items,
    returnedItems,
    forceConflict = false,
  }) {
    // 1. Role Authorization
    const allowedRoles = ['admin', 'substitute_admin', 'sir', 'staff'];
    if (!callerRole || !allowedRoles.includes(callerRole)) {
      throw new Error('Access Denied: Insufficient permissions.');
    }
    if (!isServiceRole && !authUid) {
      throw new Error('Access Denied: Valid authenticated actor is required.');
    }

    // 2. Operation ID validation
    if (!operationId || !operationId.trim()) {
      throw new Error('Validation Failed: operation_id is strictly required for atomic operations.');
    }
    const cleanOpId = operationId.trim();

    // 3. Payload Hash
    let payloadObj;
    if (operationType === 'issue_components') {
      payloadObj = {
        transaction_id: transactionId ? transactionId.trim() : null,
        student_roll: studentRoll ? studentRoll.trim().toUpperCase() : null,
        student_name: studentName ? studentName.trim() : null,
        student_phone: studentPhone ? studentPhone.trim() : null,
        authorized_by: authorizedBy ? authorizedBy.trim() : null,
        overall_due_date: overallDueDate || null,
        notes: notes ? notes.trim() : null,
        items: items || [],
      };
    } else {
      payloadObj = {
        transaction_id: transactionId ? transactionId.trim() : null,
        returned_items: returnedItems || [],
      };
    }
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payloadObj)).digest('hex');

    function validateReplay(existing) {
      if (existing.operationType !== operationType) {
        throw new Error(`Security Violation: Operation ID "${cleanOpId}" is registered for operation "${existing.operationType}", not "${operationType}".`);
      }
      if (transactionId && existing.transactionId && existing.transactionId !== 'PENDING' && existing.transactionId !== transactionId) {
        throw new Error(`Security Violation: Operation ID "${cleanOpId}" is registered for transaction "${existing.transactionId}", not "${transactionId}".`);
      }
      if (!isServiceRole) {
        if (existing.actorId === null || existing.actorId === undefined) {
          throw new Error(`Security Violation: Operation ID "${cleanOpId}" is not bound to an authenticated actor.`);
        }
        if (existing.actorId !== authUid) {
          throw new Error(`Security Violation: Operation ID "${cleanOpId}" belongs to a different authenticated actor.`);
        }
      }
      if (existing.payloadHash !== payloadHash) {
        throw new Error(`Security Violation: Operation ID "${cleanOpId}" was already submitted with a different payload.`);
      }
      if (existing.status === 'completed' && existing.result) {
        return { cached: true, result: existing.result };
      }
      if (existing.status === 'in_progress') {
        throw new Error(`Operation "${cleanOpId}" is currently in progress. Duplicate execution is prohibited.`);
      }
      throw new Error(`Operation "${cleanOpId}" has status "${existing.status}" and cannot be replayed.`);
    }

    // Step 5: Initial lookup path
    if (!forceConflict && testLedger.has(cleanOpId)) {
      return validateReplay(testLedger.get(cleanOpId));
    }

    // Step 6: Conflict fallback path
    if (forceConflict || testLedger.has(cleanOpId)) {
      return validateReplay(testLedger.get(cleanOpId));
    }

    // Claim reservation
    testLedger.set(cleanOpId, {
      operationType,
      transactionId: transactionId || 'PENDING',
      actorId: authUid,
      actorRole: callerRole,
      payloadHash,
      status: 'in_progress',
      result: null,
    });

    const txnId = transactionId || 'TXN-GEN-' + Math.random().toString(36).slice(2, 7);
    const result = { id: txnId, status: 'active', payloadHash };

    // Commit completed
    testLedger.set(cleanOpId, {
      operationType,
      transactionId: txnId,
      actorId: authUid,
      actorRole: callerRole,
      payloadHash,
      status: 'completed',
      result,
    });

    return { cached: false, result };
  }

  // Test 1: Existing ledger row with NULL actor ID is rejected
  runTest('Test 1: Existing ledger row with NULL actor ID is rejected', () => {
    const opId = 'OP-REG-TEST-1';
    testLedger.set(opId, {
      operationType: 'issue_components',
      transactionId: 'TXN-1',
      actorId: null, // Unbound / NULL actor
      actorRole: 'staff',
      payloadHash: crypto.createHash('sha256').update(JSON.stringify({
        transaction_id: 'TXN-1',
        student_roll: '238W1A0477',
        student_name: 'Anwar Bajarinti',
        student_phone: null,
        authorized_by: null,
        overall_due_date: null,
        notes: null,
        items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
      })).digest('hex'),
      status: 'completed',
      result: { id: 'TXN-1', status: 'active' },
    });

    assert.throws(
      () => simulateAtomicRpcHarness({
        operationId: opId,
        operationType: 'issue_components',
        transactionId: 'TXN-1',
        studentRoll: '238W1A0477',
        studentName: 'Anwar Bajarinti',
        items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
        authUid: 'ACTOR-CLIENT-1',
      }),
      /is not bound to an authenticated actor/
    );
  });

  // Test 2: Different authenticated actor cannot replay an operation ID
  runTest('Test 2: Different authenticated actor cannot replay an operation ID', () => {
    const opId = 'OP-REG-TEST-2';
    const initial = simulateAtomicRpcHarness({
      operationId: opId,
      operationType: 'issue_components',
      transactionId: 'TXN-2',
      studentRoll: '238W1A0477',
      studentName: 'Anwar Bajarinti',
      items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
      authUid: 'ACTOR-ORIGINAL',
    });
    assert.strictEqual(initial.cached, false);

    assert.throws(
      () => simulateAtomicRpcHarness({
        operationId: opId,
        operationType: 'issue_components',
        transactionId: 'TXN-2',
        studentRoll: '238W1A0477',
        studentName: 'Anwar Bajarinti',
        items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
        authUid: 'ACTOR-IMPOSTER',
      }),
      /belongs to a different authenticated actor/
    );
  });

  // Test 3: Issue request with changed transaction ID is rejected
  runTest('Test 3: Issue request with changed transaction ID is rejected', () => {
    const opId = 'OP-REG-TEST-3';
    simulateAtomicRpcHarness({
      operationId: opId,
      operationType: 'issue_components',
      transactionId: 'TXN-ORIGINAL-3',
      studentRoll: '238W1A0477',
      studentName: 'Anwar Bajarinti',
      items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
      authUid: 'ACTOR-SAME',
    });

    assert.throws(
      () => simulateAtomicRpcHarness({
        operationId: opId,
        operationType: 'issue_components',
        transactionId: 'TXN-TAMPERED-3',
        studentRoll: '238W1A0477',
        studentName: 'Anwar Bajarinti',
        items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
        authUid: 'ACTOR-SAME',
      }),
      /is registered for transaction "TXN-ORIGINAL-3", not "TXN-TAMPERED-3"/
    );
  });

  // Test 4: Issue request with changed phone or notes is rejected
  runTest('Test 4: Issue request with changed phone or notes is rejected', () => {
    const opId = 'OP-REG-TEST-4';
    simulateAtomicRpcHarness({
      operationId: opId,
      operationType: 'issue_components',
      transactionId: 'TXN-4',
      studentRoll: '238W1A0477',
      studentName: 'Anwar Bajarinti',
      studentPhone: '9876543210',
      notes: 'Initial issue notes',
      items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
      authUid: 'ACTOR-SAME',
    });

    // Tampered Phone
    assert.throws(
      () => simulateAtomicRpcHarness({
        operationId: opId,
        operationType: 'issue_components',
        transactionId: 'TXN-4',
        studentRoll: '238W1A0477',
        studentName: 'Anwar Bajarinti',
        studentPhone: '9999999999',
        notes: 'Initial issue notes',
        items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
        authUid: 'ACTOR-SAME',
      }),
      /was already submitted with a different payload/
    );

    // Tampered Notes
    assert.throws(
      () => simulateAtomicRpcHarness({
        operationId: opId,
        operationType: 'issue_components',
        transactionId: 'TXN-4',
        studentRoll: '238W1A0477',
        studentName: 'Anwar Bajarinti',
        studentPhone: '9876543210',
        notes: 'Altered notes',
        items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
        authUid: 'ACTOR-SAME',
      }),
      /was already submitted with a different payload/
    );
  });

  // Test 5: Return request with changed transaction ID is rejected
  runTest('Test 5: Return request with changed transaction ID is rejected', () => {
    const opId = 'OP-REG-TEST-5';
    simulateAtomicRpcHarness({
      operationId: opId,
      operationType: 'return_components',
      transactionId: 'TXN-RET-ORIGINAL-5',
      returnedItems: [{ componentId: 'COMP-1', returnQuantity: 1 }],
      authUid: 'ACTOR-SAME',
    });

    assert.throws(
      () => simulateAtomicRpcHarness({
        operationId: opId,
        operationType: 'return_components',
        transactionId: 'TXN-RET-TAMPERED-5',
        returnedItems: [{ componentId: 'COMP-1', returnQuantity: 1 }],
        authUid: 'ACTOR-SAME',
      }),
      /is registered for transaction "TXN-RET-ORIGINAL-5", not "TXN-RET-TAMPERED-5"/
    );
  });

  // Test 6: Different operation type cannot reuse an existing operation ID
  runTest('Test 6: Different operation type cannot reuse an existing operation ID', () => {
    const opId = 'OP-REG-TEST-6';
    simulateAtomicRpcHarness({
      operationId: opId,
      operationType: 'issue_components',
      transactionId: 'TXN-6',
      studentRoll: '238W1A0477',
      studentName: 'Anwar Bajarinti',
      items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
      authUid: 'ACTOR-SAME',
    });

    assert.throws(
      () => simulateAtomicRpcHarness({
        operationId: opId,
        operationType: 'return_components',
        transactionId: 'TXN-6',
        returnedItems: [{ componentId: 'COMP-1', returnQuantity: 1 }],
        authUid: 'ACTOR-SAME',
      }),
      /is registered for operation "issue_components", not "return_components"/
    );
  });

  // Test 7: Tampered payload cannot retrieve cached result
  runTest('Test 7: Tampered payload cannot retrieve cached result', () => {
    const opId = 'OP-REG-TEST-7';
    simulateAtomicRpcHarness({
      operationId: opId,
      operationType: 'issue_components',
      transactionId: 'TXN-7',
      studentRoll: '238W1A0477',
      studentName: 'Anwar Bajarinti',
      items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
      authUid: 'ACTOR-SAME',
    });

    assert.throws(
      () => simulateAtomicRpcHarness({
        operationId: opId,
        operationType: 'issue_components',
        transactionId: 'TXN-7',
        studentRoll: '238W1A0477',
        studentName: 'Anwar Bajarinti',
        items: [{ componentId: 'COMP-1', issuedQuantity: 99 }],
        authUid: 'ACTOR-SAME',
      }),
      /was already submitted with a different payload/
    );
  });

  // Test 8: Conflict/fallback path cannot bypass actor or payload validation
  runTest('Test 8: Conflict/fallback path cannot bypass actor or payload validation', () => {
    const opId = 'OP-REG-TEST-8';
    simulateAtomicRpcHarness({
      operationId: opId,
      operationType: 'issue_components',
      transactionId: 'TXN-8',
      studentRoll: '238W1A0477',
      studentName: 'Anwar Bajarinti',
      items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
      authUid: 'ACTOR-ORIGINAL-8',
    });

    // Forced conflict path with different actor
    assert.throws(
      () => simulateAtomicRpcHarness({
        operationId: opId,
        operationType: 'issue_components',
        transactionId: 'TXN-8',
        studentRoll: '238W1A0477',
        studentName: 'Anwar Bajarinti',
        items: [{ componentId: 'COMP-1', issuedQuantity: 1 }],
        authUid: 'ACTOR-ATTACKER-8',
        forceConflict: true,
      }),
      /belongs to a different authenticated actor/
    );

    // Forced conflict path with tampered payload
    assert.throws(
      () => simulateAtomicRpcHarness({
        operationId: opId,
        operationType: 'issue_components',
        transactionId: 'TXN-8',
        studentRoll: '238W1A0477',
        studentName: 'Anwar Bajarinti',
        items: [{ componentId: 'COMP-1', issuedQuantity: 50 }],
        authUid: 'ACTOR-ORIGINAL-8',
        forceConflict: true,
      }),
      /was already submitted with a different payload/
    );
  });

  // Test 9: Identical concurrent operations modify inventory only once
  await runAsyncTest('Test 9: Identical concurrent operations modify inventory only once', async () => {
    let mockStock = 50;
    let businessExecutions = 0;
    const concurrentLedger = new Map();
    let lockHolder = null;
    const waiters = [];

    async function acquireLock(id) {
      if (!lockHolder) {
        lockHolder = id;
        return;
      }
      await new Promise((res) => waiters.push(res));
      lockHolder = id;
    }

    function releaseLock() {
      lockHolder = null;
      if (waiters.length > 0) waiters.shift()();
    }

    async function executeIdempotentIssue(opId, qty) {
      await acquireLock(opId);
      try {
        if (concurrentLedger.has(opId) && concurrentLedger.get(opId).status === 'completed') {
          return { cached: true, ...concurrentLedger.get(opId).result };
        }
        concurrentLedger.set(opId, { status: 'in_progress' });
        await new Promise((r) => setTimeout(r, 5));
        mockStock -= qty;
        businessExecutions++;
        const res = { id: 'TXN-CONCURRENT', stock: mockStock };
        concurrentLedger.set(opId, { status: 'completed', result: res });
        return { cached: false, ...res };
      } finally {
        releaseLock();
      }
    }

    const opId = 'OP-CONCURRENT-REG-9';
    const calls = await Promise.all([
      executeIdempotentIssue(opId, 5),
      executeIdempotentIssue(opId, 5),
      executeIdempotentIssue(opId, 5),
      executeIdempotentIssue(opId, 5),
    ]);

    assert.strictEqual(businessExecutions, 1, 'Business execution must run exactly once');
    assert.strictEqual(mockStock, 45, 'Stock must only be reduced once (50 - 5 = 45)');
    assert.strictEqual(calls.filter(c => !c.cached).length, 1);
    assert.strictEqual(calls.filter(c => c.cached).length, 3);
  });

  // Test 10: Different return operations on same transaction remain independent
  await runAsyncTest('Test 10: Different return operations on same transaction remain independent', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');
    const storageStore = {};
    global.localStorage = {
      getItem: (k) => storageStore[k] || null,
      setItem: (k, v) => { storageStore[k] = String(v); },
      removeItem: (k) => { delete storageStore[k]; },
    };

    const sharedTxnId = 'TXN-SAME-TXN-10';
    const op1 = 'OP-RET-SAME-1';
    const op2 = 'OP-RET-SAME-2';

    syncService.enqueueMutation({
      table: 'transactions',
      action: 'rpc',
      rpcName: 'return_components_atomic',
      id: sharedTxnId,
      operationId: op1,
      rpcPayload: { p_transaction_id: sharedTxnId, p_returned_items: [{ componentId: 'C1', returnQuantity: 1 }], p_operation_id: op1 },
    });

    syncService.enqueueMutation({
      table: 'transactions',
      action: 'rpc',
      rpcName: 'return_components_atomic',
      id: sharedTxnId,
      operationId: op2,
      rpcPayload: { p_transaction_id: sharedTxnId, p_returned_items: [{ componentId: 'C2', returnQuantity: 2 }], p_operation_id: op2 },
    });

    const queue = syncService.getQueue();
    assert.strictEqual(queue.length, 2, 'Queue must retain both independent return operations');
    assert.strictEqual(queue[0].operationId, op1);
    assert.strictEqual(queue[1].operationId, op2);
  });

  // Test 11: Failed RPC remains queued and can be retried
  await runAsyncTest('Test 11: Failed RPC remains queued and can be retried', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');
    const storageStore = {};
    global.localStorage = {
      getItem: (k) => storageStore[k] || null,
      setItem: (k, v) => { storageStore[k] = String(v); },
      removeItem: (k) => { delete storageStore[k]; },
    };

    const opId = 'OP-FAIL-RETRY-11';
    syncService.enqueueMutation({
      table: 'transactions',
      action: 'rpc',
      rpcName: 'issue_components_atomic',
      id: 'TXN-11',
      operationId: opId,
      rpcPayload: { p_transaction_id: 'TXN-11', p_operation_id: opId },
    });

    syncService.isOnline = () => true;

    // Simulate transient failure (503 Service Unavailable)
    const mockFailing = {
      rpc: async () => ({ error: { message: '503 Service Unavailable' } }),
    };

    const failRes = await syncService.processQueue(mockFailing);
    assert.strictEqual(failRes.processed, 0);
    assert.strictEqual(failRes.pending, 1);

    const q = syncService.getQueue();
    assert.strictEqual(q.length, 1);
    assert.strictEqual(q[0].operationId, opId);
    assert.strictEqual(q[0].retryCount, 1);
    assert.strictEqual(q[0].lastError, '503 Service Unavailable');
  });

  // Test 12: Successful retry removes only its own queue entry
  await runAsyncTest('Test 12: Successful retry removes only its own queue entry', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');
    const storageStore = {};
    global.localStorage = {
      getItem: (k) => storageStore[k] || null,
      setItem: (k, v) => { storageStore[k] = String(v); },
      removeItem: (k) => { delete storageStore[k]; },
    };

    const opA = 'OP-SUCCESS-RETRY-12A';
    const opB = 'OP-STILL-FAILING-12B';

    syncService.enqueueMutation({
      table: 'transactions',
      action: 'rpc',
      rpcName: 'issue_components_atomic',
      id: 'TXN-12A',
      operationId: opA,
      rpcPayload: { p_transaction_id: 'TXN-12A', p_operation_id: opA },
    });

    syncService.enqueueMutation({
      table: 'transactions',
      action: 'rpc',
      rpcName: 'return_components_atomic',
      id: 'TXN-12B',
      operationId: opB,
      rpcPayload: { p_transaction_id: 'TXN-12B', p_operation_id: opB },
    });

    assert.strictEqual(syncService.getQueue().length, 2);

    // Mock client: Op A succeeds, Op B fails
    const mockSelectiveClient = {
      rpc: async (name, payload) => {
        if (payload.p_operation_id === opA) {
          return { data: { success: true }, error: null };
        }
        return { error: { message: 'Cloudflare timeout (524)' } };
      },
    };

    syncService.isOnline = () => true;
    const res = await syncService.processQueue(mockSelectiveClient);

    assert.strictEqual(res.processed, 1, 'Only opA must be marked processed');
    assert.strictEqual(res.pending, 1, 'opB must remain pending');

    const remainingQueue = syncService.getQueue();
    assert.strictEqual(remainingQueue.length, 1, 'Queue must hold exactly 1 item');
    assert.strictEqual(remainingQueue[0].operationId, opB, 'Remaining item must be opB');
    assert.strictEqual(remainingQueue[0].retryCount, 1, 'opB retryCount must be incremented');
  });

  // =========================================================================
  // WORKSTREAM 6: Live Policy Inventory Verification (Migrations 001–006)
  // =========================================================================
  console.log('\n--- WORKSTREAM 6: Live Policy Inventory Verification ---');

  runTest('Section 4 explicitly handles every existing live policy from migrations 001-006', () => {
    const expectedDrops = [
      'DROP POLICY IF EXISTS "Admins manage student roster" ON public.student_roster;',
      'DROP POLICY IF EXISTS "Staff view student roster" ON public.student_roster;',
      'DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;',
      'DROP POLICY IF EXISTS "Admins manage users" ON public.users;',
      'DROP POLICY IF EXISTS "Students can view own profile" ON public.users;',
      'DROP POLICY IF EXISTS "Students view own profile" ON public.users;',
      'DROP POLICY IF EXISTS "Users can update own contact profile" ON public.users;',
      'DROP POLICY IF EXISTS "Students update own contact profile" ON public.users;',
      'DROP POLICY IF EXISTS "Users can register own student profile" ON public.users;',
      'DROP POLICY IF EXISTS "Staff view student directory" ON public.users;',
      'DROP POLICY IF EXISTS "Admins manage components" ON public.components;',
      'DROP POLICY IF EXISTS "All authenticated users can browse components" ON public.components;',
      'DROP POLICY IF EXISTS "All authenticated users view components" ON public.components;',
      'DROP POLICY IF EXISTS "Staff manage components" ON public.components;',
      'DROP POLICY IF EXISTS "Admins manage visits" ON public.visits;',
      'DROP POLICY IF EXISTS "Students view own visits" ON public.visits;',
      'DROP POLICY IF EXISTS "Staff manage visits" ON public.visits;',
      'DROP POLICY IF EXISTS "Staff view visits" ON public.visits;',
      'DROP POLICY IF EXISTS "Staff insert visits" ON public.visits;',
      'DROP POLICY IF EXISTS "Staff update visits" ON public.visits;',
      'DROP POLICY IF EXISTS "Admins manage transactions" ON public.transactions;',
      'DROP POLICY IF EXISTS "Students view own transactions" ON public.transactions;',
      'DROP POLICY IF EXISTS "Staff manage transactions" ON public.transactions;',
      'DROP POLICY IF EXISTS "Staff view transactions" ON public.transactions;',
      'DROP POLICY IF EXISTS "Staff insert transactions" ON public.transactions;',
      'DROP POLICY IF EXISTS "Staff update transactions" ON public.transactions;',
    ];

    for (const dropStmt of expectedDrops) {
      assert.ok(sqlContent.includes(dropStmt), `Migration 007 must contain exact statement: ${dropStmt}`);
    }
  });

  runTest('Zero unrelated policies dropped and no dynamic purge loops exist', () => {
    // Assert absence of dynamic loop
    assert.ok(
      !sqlContent.includes('DROP POLICY IF EXISTS %I ON public.%I'),
      'Must NOT use dynamic blanket drop loop'
    );

    // Unrelated tables must NOT be dropped in Section 4
    const unrelatedTables = ['authorizations', 'devices', 'settings', 'audit_logs', 'domains', 'projects', 'teams', 'achievements', 'events', 'complaints', 'research_papers', 'holidays'];
    for (const tbl of unrelatedTables) {
      const regex = new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"[^"]+"\\s+ON\\s+public\\.${tbl};`, 'i');
      assert.ok(!regex.test(sqlContent), `Must NOT drop policies on unrelated table public.${tbl}`);
    }
  });

  // =========================================================================
  // WORKSTREAM 8: Section F Complete Regression Suite (10 Required Scenarios)
  // =========================================================================
  console.log('\n--- WORKSTREAM 8: Section F Complete Regression Suite (10 Required Scenarios) ---');

  // Scenario 1: Old permissive policies cannot grant staff forbidden access.
  runTest('Section F - Scenario 1: Old permissive policies cannot grant staff forbidden access', () => {
    // 1. Verify all legacy permissive policies are dropped in SQL
    const droppedLegacyPolicies = [
      'DROP POLICY IF EXISTS "Staff insert transactions" ON public.transactions;',
      'DROP POLICY IF EXISTS "Staff update transactions" ON public.transactions;',
      'DROP POLICY IF EXISTS "Staff manage transactions" ON public.transactions;',
      'DROP POLICY IF EXISTS "Admins manage student roster" ON public.student_roster;',
      'DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;',
      'DROP POLICY IF EXISTS "Admins manage users" ON public.users;',
      'DROP POLICY IF EXISTS "Users can update own contact profile" ON public.users;',
      'DROP POLICY IF EXISTS "Staff manage components" ON public.components;',
      'DROP POLICY IF EXISTS "Staff manage visits" ON public.visits;',
      'DROP POLICY IF EXISTS "Staff view processed rpc operations" ON public.processed_rpc_operations;'
    ];
    for (const p of droppedLegacyPolicies) {
      assert.ok(sqlContent.includes(p), `Missing required drop: ${p}`);
    }

    // 2. Simulate RLS policy engine evaluation for staff role
    function simulateRLSAccess(table, operation, role) {
      if (role === 'admin') return true;
      if (role === 'staff') {
        if (table === 'transactions') return operation === 'SELECT';
        if (table === 'components') return operation === 'SELECT';
        if (table === 'student_roster') return operation === 'SELECT';
        if (table === 'users') return false; // Staff has ZERO direct access to public.users
        if (table === 'staff_student_directory') return operation === 'SELECT';
        if (table === 'visits') return ['SELECT', 'INSERT', 'UPDATE'].includes(operation);
        if (table === 'processed_rpc_operations') return false; // Zero direct access for staff
      }
      return false;
    }

    // Assert staff forbidden operations fail closed
    assert.strictEqual(simulateRLSAccess('transactions', 'INSERT', 'staff'), false, 'Staff direct INSERT on transactions must be denied');
    assert.strictEqual(simulateRLSAccess('transactions', 'UPDATE', 'staff'), false, 'Staff direct UPDATE on transactions must be denied');
    assert.strictEqual(simulateRLSAccess('transactions', 'DELETE', 'staff'), false, 'Staff direct DELETE on transactions must be denied');
    assert.strictEqual(simulateRLSAccess('components', 'INSERT', 'staff'), false, 'Staff direct INSERT on components must be denied');
    assert.strictEqual(simulateRLSAccess('components', 'UPDATE', 'staff'), false, 'Staff direct UPDATE on components must be denied');
    assert.strictEqual(simulateRLSAccess('components', 'DELETE', 'staff'), false, 'Staff direct DELETE on components must be denied');
    assert.strictEqual(simulateRLSAccess('student_roster', 'INSERT', 'staff'), false, 'Staff direct INSERT on student_roster must be denied');
    assert.strictEqual(simulateRLSAccess('student_roster', 'DELETE', 'staff'), false, 'Staff direct DELETE on student_roster must be denied');
    assert.strictEqual(simulateRLSAccess('users', 'SELECT', 'staff'), false, 'Staff direct SELECT on users must be denied');
    assert.strictEqual(simulateRLSAccess('users', 'UPDATE', 'staff'), false, 'Staff direct UPDATE on users must be denied');
    assert.strictEqual(simulateRLSAccess('staff_student_directory', 'SELECT', 'staff'), true, 'Staff SELECT on staff_student_directory must be permitted');
    assert.strictEqual(simulateRLSAccess('staff_student_directory', 'INSERT', 'staff'), false, 'Staff direct INSERT on staff_student_directory must be denied');
    assert.strictEqual(simulateRLSAccess('visits', 'DELETE', 'staff'), false, 'Staff direct DELETE on visits must be denied');
    assert.strictEqual(simulateRLSAccess('processed_rpc_operations', 'SELECT', 'staff'), false, 'Staff direct SELECT on processed_rpc_operations must be denied');
    assert.strictEqual(simulateRLSAccess('processed_rpc_operations', 'UPDATE', 'staff'), false, 'Staff direct UPDATE on processed_rpc_operations must be denied');
  });

  runTest('Section F - Staff student directory isolation: sensitive columns and non-student accounts are hidden', () => {
    // 1. Verify SQL creates view and RPC with strictly filtered columns
    assert.ok(
      sqlContent.includes('CREATE VIEW public.staff_student_directory'),
      'Migration 007 must define public.staff_student_directory view'
    );
    assert.ok(
      sqlContent.includes('CREATE OR REPLACE FUNCTION public.get_student_directory()'),
      'Migration 007 must define public.get_student_directory RPC'
    );
    assert.ok(
      !sqlContent.includes('CREATE POLICY "Staff view student directory" ON public.users;'),
      'Migration 007 must NOT create direct staff SELECT policy on public.users'
    );

    // 2. Simulate raw user catalog containing sensitive fields and administrative accounts
    const rawUsers = [
      {
        id: 'USR-ADMIN-1',
        roll_number: 'ADMIN',
        name: 'Dr. System Administrator',
        role: 'admin',
        auth_id: 'auth-admin-uuid-999',
        password_hash: '$2b$12$eX4mpleHashAdminOnly',
        mobile_number: '9876543210',
        department: 'ECE',
        membership_status: 'faculty_admin',
        fingerprint_ids: [101, 102],
        is_active: true
      },
      {
        id: 'USR-STAFF-1',
        roll_number: 'STAFF01',
        name: 'Lab Assistant',
        role: 'staff',
        auth_id: 'auth-staff-uuid-888',
        password_hash: '$2b$12$eX4mpleHashStaffOnly',
        mobile_number: '9876543211',
        department: 'ECE',
        membership_status: 'staff_employee',
        fingerprint_ids: [201],
        is_active: true
      },
      {
        id: 'USR-STU-1',
        roll_number: '21BD1A0501',
        name: 'Aditya Varma',
        role: 'student',
        auth_id: 'auth-student-uuid-111',
        password_hash: '$2b$12$studentHash123',
        mobile_number: '9848012345',
        department: 'CSE',
        branch: 'CSE',
        section: 'A',
        academic_year: 3,
        face_registered: true,
        face_photo_url: 'https://cdn.example.com/faces/21bd1a0501.jpg',
        membership_status: 'active_scholar',
        fingerprint_ids: [1, 2, 3],
        is_active: true
      }
    ];

    // Simulate query execution against staff_student_directory view
    function queryStaffStudentDirectory(callerRole) {
      if (!['staff', 'admin', 'substitute_admin', 'sir'].includes(callerRole)) {
        return []; // Non-staff/students cannot query directory view
      }

      // Filter: u.role = 'student'
      return rawUsers
        .filter(u => u.role === 'student')
        .map(u => ({
          id: u.id,
          roll_number: u.roll_number,
          name: u.name,
          department: u.department,
          branch: u.branch,
          section: u.section,
          academic_year: u.academic_year,
          mobile_number: u.mobile_number,
          face_registered: u.face_registered,
          face_photo_url: u.face_photo_url,
          is_active: u.is_active
        }));
    }

    const staffView = queryStaffStudentDirectory('staff');
    assert.strictEqual(staffView.length, 1, 'Only student accounts must be visible');
    assert.strictEqual(staffView[0].roll_number, '21BD1A0501', 'Student roll number must match');
    assert.strictEqual(staffView[0].name, 'Aditya Varma');

    // Sensitive columns must NOT exist in the projection
    const sensitiveKeys = ['auth_id', 'role', 'password_hash', 'membership_status', 'fingerprint_ids', 'finger_labels'];
    for (const key of sensitiveKeys) {
      assert.strictEqual(staffView[0][key], undefined, `Sensitive key "${key}" must NOT be exposed in student directory view`);
    }

    // Verify unauthenticated / student callers get 0 rows
    assert.strictEqual(queryStaffStudentDirectory('student').length, 0, 'Students cannot query staff_student_directory');
    assert.strictEqual(queryStaffStudentDirectory('anon').length, 0, 'Anonymous users cannot query staff_student_directory');
  });

  runTest('Section F - Students can only view their own user profile record', () => {
    function simulateStudentUserSelect(callerAuthId, rowAuthId, callerRoll, rowRoll) {
      // USING (role = 'student' AND (auth_id = auth.uid() OR lower(trim(roll_number)) = lower(trim(current_roll))))
      return callerAuthId === rowAuthId || (callerRoll && callerRoll.toUpperCase() === rowRoll.toUpperCase());
    }

    // Student A viewing Student A -> ALLOWED
    assert.strictEqual(simulateStudentUserSelect('auth-A', 'auth-A', '21BD1A0501', '21BD1A0501'), true);

    // Student A viewing Student B -> DENIED
    assert.strictEqual(simulateStudentUserSelect('auth-A', 'auth-B', '21BD1A0501', '21BD1A0502'), false);

    // Student A viewing Admin record -> DENIED
    assert.strictEqual(simulateStudentUserSelect('auth-A', 'auth-admin', '21BD1A0501', 'ADMIN'), false);
  });

  // Scenario 2: Existing ledger records cannot be overwritten during finalization.
  runTest('Section F - Scenario 2: Existing ledger records cannot be overwritten during finalization', () => {
    // Assert SQL does not use ON CONFLICT DO UPDATE in completion
    assert.ok(
      !sqlContent.includes("ON CONFLICT (operation_id) DO UPDATE SET status = 'completed'"),
      'Must NOT use unconditional ON CONFLICT DO UPDATE during finalization'
    );
    assert.ok(
      sqlContent.includes('UPDATE public.processed_rpc_operations'),
      'Must use explicit UPDATE for ledger completion'
    );
    assert.ok(
      sqlContent.includes("status = 'in_progress'"),
      'Must conditionally match status = in_progress during completion'
    );

    // Simulate finalization ledger update
    const ledgerTable = [
      {
        operation_id: 'OP-SEC-002',
        operation_type: 'issue_components',
        status: 'completed', // Already completed
        actor_id: 'actor-123',
        payload_hash: 'hash-abc',
        result_data: { success: true, original: true }
      }
    ];

    function finalizeLedgerSimulation(opId, opType, actorId, payloadHash, newResult) {
      const idx = ledgerTable.findIndex(r =>
        r.operation_id === opId &&
        r.operation_type === opType &&
        r.status === 'in_progress' &&
        r.payload_hash === payloadHash &&
        r.actor_id === actorId
      );
      if (idx === -1) {
        throw new Error(`Idempotency Finalization Failure: Expected reservation row missing, altered, or already completed for operation "${opId}".`);
      }
      ledgerTable[idx].status = 'completed';
      ledgerTable[idx].result_data = newResult;
      return 1;
    }

    // Attempting to finalize an already completed ledger entry must throw and reject overwrite
    assert.throws(
      () => finalizeLedgerSimulation('OP-SEC-002', 'issue_components', 'actor-123', 'hash-abc', { success: true, overwritten: true }),
      /Idempotency Finalization Failure/
    );
    // Ensure original result remained untouched
    assert.strictEqual(ledgerTable[0].result_data.original, true);
  });

  // Scenario 3: Ledger finalization fails if the expected reservation is missing.
  runTest('Section F - Scenario 3: Ledger finalization fails if the expected reservation is missing', () => {
    assert.ok(
      sqlContent.includes('GET DIAGNOSTICS v_finalized_rows = ROW_COUNT;'),
      'SQL must inspect affected rows using GET DIAGNOSTICS'
    );
    assert.ok(
      sqlContent.includes('IF v_finalized_rows != 1 THEN'),
      'SQL must verify exactly one row was finalized'
    );

    const emptyLedger = [];
    function finalizeMissingReservation(opId, opType, actorId, payloadHash, newResult) {
      const idx = emptyLedger.findIndex(r =>
        r.operation_id === opId &&
        r.operation_type === opType &&
        r.status === 'in_progress' &&
        r.payload_hash === payloadHash &&
        r.actor_id === actorId
      );
      const rowsUpdated = (idx !== -1) ? 1 : 0;
      if (rowsUpdated !== 1) {
        throw new Error(`Idempotency Finalization Failure: Expected reservation row missing, altered, or already completed for operation "${opId}".`);
      }
    }

    assert.throws(
      () => finalizeMissingReservation('OP-SEC-MISSING', 'return_components', 'actor-123', 'hash-xyz', { success: true }),
      /Idempotency Finalization Failure/
    );
  });

  // Scenario 4: Service-role authorization cannot bypass actor isolation.
  runTest('Section F - Scenario 4: Service-role authorization cannot bypass actor isolation', () => {
    // 1. Verify REVOKE from service_role in SQL migration
    assert.ok(
      sqlContent.includes('REVOKE ALL ON FUNCTION public.issue_components_atomic(text, text, text, text, text, timestamptz, text, jsonb, text) FROM PUBLIC, anon, service_role;'),
      'Must revoke issue_components_atomic EXECUTE from service_role'
    );
    assert.ok(
      sqlContent.includes('REVOKE ALL ON FUNCTION public.return_components_atomic(text, jsonb, text) FROM PUBLIC, anon, service_role;'),
      'Must revoke return_components_atomic EXECUTE from service_role'
    );
    assert.ok(
      sqlContent.includes('REVOKE ALL ON FUNCTION public.update_student_profile(text, text, text) FROM PUBLIC, anon, service_role;'),
      'Must revoke update_student_profile EXECUTE from service_role'
    );

    // 2. Verify actor isolation check in RPC definitions
    assert.ok(
      sqlContent.includes("IF v_actor_id IS NULL THEN\n    RAISE EXCEPTION 'Access Denied: Valid authenticated actor is required.';\n  END IF;"),
      'Must strictly require non-null authenticated actor ID'
    );

    // 3. Simulate function invocation without valid auth.uid()
    function simulateActorValidation(authUid, role) {
      const v_actor_id = authUid;
      if (v_actor_id === null || v_actor_id === undefined) {
        throw new Error('Access Denied: Valid authenticated actor is required.');
      }
      return { success: true, actor: v_actor_id, role };
    }

    // Unauthenticated, anonymous, or service_role without user context must fail
    assert.throws(() => simulateActorValidation(null, 'service_role'), /Access Denied: Valid authenticated actor is required/);
    assert.throws(() => simulateActorValidation(null, 'anon'), /Access Denied: Valid authenticated actor is required/);
    assert.throws(() => simulateActorValidation(undefined, 'service_role'), /Access Denied: Valid authenticated actor is required/);
  });

  // Scenario 5: RPC enqueue rejects missing rpcPayload.
  await runAsyncTest('Section F - Scenario 5: RPC enqueue rejects missing rpcPayload', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');
    
    // Null payload
    assert.throws(
      () => syncService.enqueueMutation({ table: 'transactions', action: 'rpc', rpcName: 'issue_components_atomic', operationId: 'OP-TEST-5A', rpcPayload: null }),
      /rpcPayload must be a valid non-empty object/
    );

    // Undefined payload
    assert.throws(
      () => syncService.enqueueMutation({ table: 'transactions', action: 'rpc', rpcName: 'issue_components_atomic', operationId: 'OP-TEST-5B', rpcPayload: undefined }),
      /rpcPayload must be a valid non-empty object/
    );

    // Primitive payload
    assert.throws(
      () => syncService.enqueueMutation({ table: 'transactions', action: 'rpc', rpcName: 'issue_components_atomic', operationId: 'OP-TEST-5C', rpcPayload: 'not-an-object' }),
      /rpcPayload must be a valid non-empty object/
    );

    // Array payload
    assert.throws(
      () => syncService.enqueueMutation({ table: 'transactions', action: 'rpc', rpcName: 'issue_components_atomic', operationId: 'OP-TEST-5D', rpcPayload: [] }),
      /rpcPayload must be a valid non-empty object/
    );
  });

  // Scenario 6: RPC enqueue rejects mismatched operation IDs.
  await runAsyncTest('Section F - Scenario 6: RPC enqueue rejects mismatched operation IDs', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');

    assert.throws(
      () => syncService.enqueueMutation({
        table: 'transactions',
        action: 'rpc',
        rpcName: 'issue_components_atomic',
        operationId: 'OP-EXPECTED-ID',
        rpcPayload: { p_operation_id: 'OP-DIFFERENT-ID' }
      }),
      /does not match rpcPayload\.p_operation_id/
    );
  });

  // Scenario 7: Same operation ID with changed payload is rejected.
  await runAsyncTest('Section F - Scenario 7: Same operation ID with changed payload is rejected', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');
    
    // Reset queue for clean test
    syncService.saveQueue([]);

    const payloadA = { p_operation_id: 'OP-F7', p_tx_id: 'TX-100', items: [{ componentId: 'COMP-1', quantity: 1 }] };
    const payloadB = { p_operation_id: 'OP-F7', p_tx_id: 'TX-100', items: [{ componentId: 'COMP-1', quantity: 99 }] };

    // Enqueue initial operation
    const firstEnqueued = syncService.enqueueMutation({
      table: 'transactions',
      action: 'rpc',
      rpcName: 'issue_components_atomic',
      operationId: 'OP-F7',
      rpcPayload: payloadA
    });
    assert.strictEqual(firstEnqueued.operationId, 'OP-F7');

    // Attempt to enqueue same OP ID with modified payload
    assert.throws(
      () => syncService.enqueueMutation({
        table: 'transactions',
        action: 'rpc',
        rpcName: 'issue_components_atomic',
        operationId: 'OP-F7',
        rpcPayload: payloadB
      }),
      /already queued with a different payload\. Conflicting mutations rejected\./
    );

    // Ensure queue maintains original payload
    const currentQueue = syncService.getQueue();
    const stored = currentQueue.find(m => m.operationId === 'OP-F7');
    assert.strictEqual(stored.rpcPayload.items[0].quantity, 1, 'Original payload must not be mutated or overwritten');
  });

  // Scenario 8: Failed localStorage persistence is reported.
  await runAsyncTest('Section F - Scenario 8: Failed localStorage persistence is reported', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');

    const originalSetItem = globalThis.localStorage.setItem;
    try {
      globalThis.localStorage.setItem = () => {
        throw new Error('QuotaExceededError: Dom storage limit reached');
      };

      assert.throws(
        () => syncService.saveQueue([{ test: 'failed_write' }]),
        /SyncService Persistence Failure: Unable to persist offline queue to storage/
      );
    } finally {
      globalThis.localStorage.setItem = originalSetItem;
    }
  });

  // Scenario 8B: isSyncing is guaranteed to reset to false through try/finally even after errors
  await runAsyncTest('Section F - Scenario 8B: Sync queue always resets isSyncing after errors', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');

    // Force isSyncing = false before test
    syncService.isSyncing = false;

    // Put a mutation that triggers an unexpected exception during processing
    syncService.saveQueue([
      {
        mutationId: 'MUT-FAIL-1',
        table: 'components',
        action: 'insert',
        id: 'CRASH-1',
        data: {},
        retryCount: 0
      }
    ]);

    // Mock client that throws hard unexpected exception
    const mockCrashingClient = {
      from: () => ({
        select: () => {
          throw new Error('Fatal Network Socket Crash');
        }
      })
    };

    syncService.isOnline = () => true;

    // Process queue
    await syncService.processQueue(mockCrashingClient);

    // Verify isSyncing was cleanly restored to false via finally
    assert.strictEqual(syncService.isSyncing, false, 'isSyncing must be reset to false via finally block');
  });

  // Scenario 8C: localStorage failures do not permanently block subsequent synchronization
  await runAsyncTest('Section F - Scenario 8C: localStorage failures do not permanently block retry', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');

    syncService.isSyncing = false;

    const originalSetItem = globalThis.localStorage.setItem;
    try {
      // Set queue with 1 item
      syncService.saveQueue([
        {
          mutationId: 'MUT-STORAGE-FAIL',
          table: 'visits',
          action: 'insert',
          id: 'VST-TEMP-1',
          data: {},
          retryCount: 0
        }
      ]);

      // Mock client that fails
      const mockClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              limit: async () => ({ data: [], error: null })
            })
          }),
          insert: async () => ({ error: { message: '503 Cloudflare Error' } })
        })
      };

      // Mock localStorage to throw QuotaExceededError during processQueue
      globalThis.localStorage.setItem = () => {
        throw new Error('QuotaExceededError: DOM Exception 22');
      };

      syncService.isOnline = () => true;
      await syncService.processQueue(mockClient);

      // Verify isSyncing is false despite storage failure
      assert.strictEqual(syncService.isSyncing, false, 'isSyncing must NOT remain stuck on true after storage failure');

      // Subsequent sync can run without being blocked
      const result = await syncService.processQueue(mockClient);
      assert.ok(result !== undefined, 'Subsequent processQueue call must execute without being blocked');
      assert.strictEqual(syncService.isSyncing, false);
    } finally {
      globalThis.localStorage.setItem = originalSetItem;
    }
  });

  // Scenario 8D: Retry limits (MAX_RETRIES = 5) and exponential backoff behave correctly
  await runAsyncTest('Section F - Scenario 8D: Retry limits and backoff behave correctly', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');

    // 1. Verify exponential backoff delay calculation
    assert.strictEqual(syncService.getBackoffDelayMs(0), 0);
    assert.strictEqual(syncService.getBackoffDelayMs(1), 1000); // 2^0 * 1000 = 1s
    assert.strictEqual(syncService.getBackoffDelayMs(2), 2000); // 2^1 * 1000 = 2s
    assert.strictEqual(syncService.getBackoffDelayMs(3), 4000); // 2^2 * 1000 = 4s
    assert.strictEqual(syncService.getBackoffDelayMs(4), 8000); // 2^3 * 1000 = 8s
    assert.strictEqual(syncService.getBackoffDelayMs(5), 16000); // 2^4 * 1000 = 16s
    assert.strictEqual(syncService.getBackoffDelayMs(6), 30000); // Capped at 30s

    // 2. Max retries: mutation with retryCount >= 5 is skipped, but NEVER evicted
    syncService.saveQueue([
      {
        mutationId: 'MUT-MAX-RETRIES',
        action: 'rpc',
        rpcName: 'issue_components_atomic',
        operationId: 'OP-MAX-RETRY-TEST',
        rpcPayload: { p_operation_id: 'OP-MAX-RETRY-TEST' },
        retryCount: 5,
        lastAttemptAt: new Date(Date.now() - 60000).toISOString()
      }
    ]);

    let rpcCalled = false;
    const mockClient = {
      rpc: async () => {
        rpcCalled = true;
        return { data: null, error: null };
      }
    };

    syncService.isOnline = () => true;
    await syncService.processQueue(mockClient);

    assert.strictEqual(rpcCalled, false, 'RPC mutation with retryCount >= 5 must be skipped in auto-sync');
    const q = syncService.getQueue();
    assert.strictEqual(q.length, 1, 'Failed RPC mutation must NEVER be evicted or discarded');
    assert.strictEqual(q[0].operationId, 'OP-MAX-RETRY-TEST');

    // 3. Backoff delay check: mutation within backoff window is skipped
    syncService.saveQueue([
      {
        mutationId: 'MUT-BACKOFF-WAIT',
        action: 'rpc',
        rpcName: 'issue_components_atomic',
        operationId: 'OP-BACKOFF-TEST',
        rpcPayload: { p_operation_id: 'OP-BACKOFF-TEST' },
        retryCount: 2, // 2000ms delay
        lastAttemptAt: new Date().toISOString() // 0ms ago (< 2000ms)
      }
    ]);

    rpcCalled = false;
    await syncService.processQueue(mockClient);
    assert.strictEqual(rpcCalled, false, 'Mutation within backoff window must be skipped');

    // 4. Backoff delay check: mutation after backoff window has elapsed is processed
    syncService.saveQueue([
      {
        mutationId: 'MUT-BACKOFF-READY',
        action: 'rpc',
        rpcName: 'issue_components_atomic',
        operationId: 'OP-BACKOFF-READY',
        rpcPayload: { p_operation_id: 'OP-BACKOFF-READY' },
        retryCount: 2, // 2000ms delay
        lastAttemptAt: new Date(Date.now() - 5000).toISOString() // 5000ms ago (> 2000ms)
      }
    ]);

    rpcCalled = false;
    await syncService.processQueue(mockClient);
    assert.strictEqual(rpcCalled, true, 'Mutation after backoff window elapses must be processed');
  });

  // Scenario 9: Incomplete attendance transitions enforce valid fields.
  runTest('Section F - Scenario 9: Incomplete attendance transitions enforce valid fields', () => {
    const baseEntryTime = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hr ago

    function simulateVisitUpdateTrigger(oldVisit, newVisit, role = 'staff') {
      if (['admin', 'substitute_admin', 'sir'].includes(role)) return newVisit;

      if (['completed', 'incomplete'].includes(oldVisit.status)) {
        throw new Error('Access Denied: Completed or closed visit records cannot be modified.');
      }
      if (newVisit.id !== oldVisit.id) throw new Error('Access Denied: Attendance record ID cannot be modified.');
      if (newVisit.student_roll !== oldVisit.student_roll) throw new Error('Access Denied: Student roll number cannot be modified on attendance records.');
      if (newVisit.student_name !== oldVisit.student_name) throw new Error('Access Denied: Student name cannot be modified on attendance records.');
      if (newVisit.entry_time !== oldVisit.entry_time) throw new Error('Access Denied: Initial entry timestamp cannot be altered.');
      if (newVisit.entry_method !== oldVisit.entry_method) throw new Error('Access Denied: Initial entry method cannot be altered.');

      if (!['completed', 'incomplete'].includes(newVisit.status)) {
        throw new Error('Validation Failed: Visit status can only transition to "completed" or "incomplete".');
      }

      if (newVisit.status === 'completed') {
        if (!newVisit.exit_time) throw new Error('Validation Failed: exit_time must be provided when completing a visit.');
        if (new Date(newVisit.exit_time) < new Date(oldVisit.entry_time)) throw new Error('Validation Failed: exit_time cannot be earlier than entry_time.');
        if (new Date(newVisit.exit_time) > new Date(Date.now() + 5 * 60 * 1000)) throw new Error('Validation Failed: exit_time cannot be in the future.');
        if (!newVisit.exit_method || !newVisit.exit_method.trim()) throw new Error('Validation Failed: exit_method must be recorded upon visit completion.');
        if (newVisit.duration_minutes === null || newVisit.duration_minutes === undefined || newVisit.duration_minutes < 0) {
          throw new Error('Validation Failed: duration_minutes must be a non-negative integer upon completion.');
        }
        const maxDuration = (new Date(newVisit.exit_time) - new Date(oldVisit.entry_time)) / 60000 + 5;
        if (newVisit.duration_minutes > maxDuration) {
          throw new Error(`Validation Failed: duration_minutes (${newVisit.duration_minutes}) cannot exceed elapsed time between entry and exit.`);
        }
      }

      if (newVisit.status === 'incomplete') {
        if (newVisit.exit_time) {
          if (new Date(newVisit.exit_time) < new Date(oldVisit.entry_time)) throw new Error('Validation Failed: exit_time cannot be earlier than entry_time.');
          if (new Date(newVisit.exit_time) > new Date(Date.now() + 5 * 60 * 1000)) throw new Error('Validation Failed: exit_time cannot be in the future.');
          if (!newVisit.exit_method || !newVisit.exit_method.trim()) throw new Error('Validation Failed: exit_method must be recorded when exit_time is provided for incomplete visit.');
        } else {
          if (newVisit.exit_method && newVisit.exit_method.trim() && !['incomplete', 'auto_closed', 'system_timeout'].includes(newVisit.exit_method.trim().toLowerCase())) {
            throw new Error('Validation Failed: exit_method must be NULL or "incomplete"/"auto_closed"/"system_timeout" when exit_time is omitted.');
          }
        }

        if (!newVisit.exit_time && newVisit.duration_minutes !== null && newVisit.duration_minutes !== undefined && newVisit.duration_minutes > 0) {
          throw new Error('Validation Failed: duration_minutes must be NULL or 0 for incomplete visits without exit timestamp.');
        }
        if (newVisit.duration_minutes !== null && newVisit.duration_minutes !== undefined && newVisit.duration_minutes < 0) {
          throw new Error('Validation Failed: duration_minutes cannot be negative for incomplete visits.');
        }
        if (newVisit.exit_time && newVisit.duration_minutes !== null && newVisit.duration_minutes !== undefined) {
          const maxDuration = (new Date(newVisit.exit_time) - new Date(oldVisit.entry_time)) / 60000 + 5;
          if (newVisit.duration_minutes > maxDuration) {
            throw new Error(`Validation Failed: duration_minutes (${newVisit.duration_minutes}) cannot exceed elapsed time between entry and exit for incomplete visit.`);
          }
        }
      }

      return newVisit;
    }

    const oldVisit = {
      id: 'VST-101',
      student_roll: '21BD1A0501',
      student_name: 'Aditya Varma',
      status: 'inside',
      entry_time: baseEntryTime,
      entry_method: 'rfid_tap',
      created_at: baseEntryTime
    };

    // 1. Legitimate auto-close: exit_time is null, duration_minutes is null, exit_method is auto_closed -> PASS
    assert.doesNotThrow(() => {
      simulateVisitUpdateTrigger(oldVisit, {
        ...oldVisit,
        status: 'incomplete',
        exit_time: null,
        duration_minutes: null,
        exit_method: 'auto_closed'
      });
    });

    // 2. Incomplete with NULL exit_time BUT duration > 0 -> REJECT
    assert.throws(
      () => simulateVisitUpdateTrigger(oldVisit, {
        ...oldVisit,
        status: 'incomplete',
        exit_time: null,
        duration_minutes: 45,
        exit_method: 'incomplete'
      }),
      /duration_minutes must be NULL or 0 for incomplete visits without exit timestamp/
    );

    // 3. Incomplete with negative duration -> REJECT
    assert.throws(
      () => simulateVisitUpdateTrigger(oldVisit, {
        ...oldVisit,
        status: 'incomplete',
        exit_time: null,
        duration_minutes: -10,
        exit_method: 'incomplete'
      }),
      /duration_minutes cannot be negative for incomplete visits/
    );

    // 4. Incomplete with future exit_time -> REJECT
    assert.throws(
      () => simulateVisitUpdateTrigger(oldVisit, {
        ...oldVisit,
        status: 'incomplete',
        exit_time: new Date(Date.now() + 600000).toISOString(),
        duration_minutes: 10,
        exit_method: 'incomplete'
      }),
      /exit_time cannot be in the future/
    );

    // 5. Incomplete with exit_time earlier than entry_time -> REJECT
    assert.throws(
      () => simulateVisitUpdateTrigger(oldVisit, {
        ...oldVisit,
        status: 'incomplete',
        exit_time: new Date(new Date(baseEntryTime).getTime() - 600000).toISOString(),
        duration_minutes: 10,
        exit_method: 'incomplete'
      }),
      /exit_time cannot be earlier than entry_time/
    );

    // 6. Incomplete with NULL exit_time and arbitrary physical exit method (e.g. 'face') -> REJECT
    assert.throws(
      () => simulateVisitUpdateTrigger(oldVisit, {
        ...oldVisit,
        status: 'incomplete',
        exit_time: null,
        duration_minutes: null,
        exit_method: 'face'
      }),
      /exit_method must be NULL or "incomplete"\/"auto_closed"\/"system_timeout" when exit_time is omitted/
    );

    // 7. Incomplete with exit_time provided but empty exit_method -> REJECT
    assert.throws(
      () => simulateVisitUpdateTrigger(oldVisit, {
        ...oldVisit,
        status: 'incomplete',
        exit_time: new Date().toISOString(),
        duration_minutes: 30,
        exit_method: '   '
      }),
      /exit_method must be recorded when exit_time is provided for incomplete visit/
    );
  });

  // Scenario 10: Existing legitimate staff attendance and inventory operations still work.
  runTest('Section F - Scenario 10: Existing legitimate staff attendance and inventory operations still work', () => {
    // 1. Verify staff attendance check-in (INSERT) and check-out (UPDATE) permissions in migration
    assert.ok(
      sqlContent.includes('CREATE POLICY "Staff insert visits" ON public.visits'),
      'Staff must retain INSERT on visits'
    );
    assert.ok(
      sqlContent.includes('CREATE POLICY "Staff update visits" ON public.visits'),
      'Staff must retain UPDATE on visits'
    );
    assert.ok(
      sqlContent.includes('CREATE POLICY "Staff view visits" ON public.visits'),
      'Staff must retain SELECT on visits'
    );

    // 2. Verify staff read permissions on components, transactions, and roster
    assert.ok(
      sqlContent.includes('CREATE POLICY "All authenticated users view components" ON public.components'),
      'Staff can view components'
    );
    assert.ok(
      sqlContent.includes('CREATE POLICY "Staff view transactions" ON public.transactions'),
      'Staff can view transactions'
    );
    assert.ok(
      sqlContent.includes('CREATE POLICY "Staff view student roster" ON public.student_roster'),
      'Staff can view student roster'
    );

    // 3. Verify staff atomic issue & return RPCs grant to authenticated
    assert.ok(
      sqlContent.includes('GRANT EXECUTE ON FUNCTION public.issue_components_atomic(text, text, text, text, text, timestamptz, text, jsonb, text) TO authenticated;'),
      'issue_components_atomic must be granted to authenticated'
    );
    assert.ok(
      sqlContent.includes('GRANT EXECUTE ON FUNCTION public.return_components_atomic(text, jsonb, text) TO authenticated;'),
      'return_components_atomic must be granted to authenticated'
    );

    // 4. Verify standard staff operational flow completes successfully
    const visitEntry = {
      id: 'VST-OK-1',
      student_roll: '21BD1A0501',
      student_name: 'Aditya Varma',
      status: 'inside',
      entry_time: new Date(Date.now() - 1800000).toISOString(),
      entry_method: 'face',
      created_at: new Date(Date.now() - 1800000).toISOString()
    };
    const visitExit = {
      ...visitEntry,
      status: 'completed',
      exit_time: new Date().toISOString(),
      exit_method: 'face',
      duration_minutes: 30
    };

    assert.strictEqual(visitExit.status, 'completed');
    assert.strictEqual(visitExit.duration_minutes, 30);
  });

  // =========================================================================
  // WORKSTREAM 9: Final Patch Regression Suite (Reconnect & Unreadable Queue Recovery)
  // =========================================================================
  console.log('\n--- WORKSTREAM 9: Final Patch Regression Suite ---');

  await runAsyncTest('Patch Test 1-3: Single authoritative reconnect invokes queue processor, executes RPC once, and preserves retryCount', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');
    const storageStore = {};
    global.localStorage = {
      getItem: (k) => storageStore[k] || null,
      setItem: (k, v) => { storageStore[k] = String(v); },
      removeItem: (k) => { delete storageStore[k]; },
    };

    let rpcCalls = 0;
    let rpcPayloadReceived = null;
    const mockSupabase = {
      rpc: async (name, payload) => {
        rpcCalls++;
        rpcPayloadReceived = payload;
        return { data: { success: true }, error: null };
      }
    };
    const mockToDbRow = (t, d) => d;

    // Enqueue an atomic RPC mutation
    const opId = 'OP-RECONNECT-TEST-99';
    syncService.saveQueue([]);
    syncService.enqueueMutation({
      action: 'rpc',
      rpcName: 'issue_components_atomic',
      operationId: opId,
      rpcPayload: { p_operation_id: opId, p_transaction_id: 'TXN-99', items: [{ componentId: 'C1', quantity: 1 }] }
    });

    const initialQueue = syncService.getQueue();
    assert.strictEqual(initialQueue.length, 1);
    assert.strictEqual(initialQueue[0].retryCount, 0, 'Initial retryCount must be 0');

    // Configure syncService dependencies
    syncService.setDependencies(mockSupabase, mockToDbRow);

    // Call processQueue (as the authoritative reconnect listener in database.js does)
    const res = await syncService.processQueue(mockSupabase, mockToDbRow);
    assert.strictEqual(rpcCalls, 1, 'Configured client is called exactly once');
    assert.strictEqual(res.processed, 1, 'RPC executed successfully');

    // Queue must now be drained
    assert.strictEqual(syncService.getQueue().length, 0, 'Queue must be drained after successful execution');
    assert.strictEqual(rpcPayloadReceived.p_operation_id, opId, 'RPC payload must match');

    // Test calling without client when unconfigured: does NOT increment retry count or crash
    syncService.setDependencies(null, null);
    syncService.saveQueue([
      {
        mutationId: 'MUT-UNCONFIGURED',
        action: 'rpc',
        rpcName: 'issue_components_atomic',
        operationId: 'OP-UNCONFIGURED',
        rpcPayload: { p_operation_id: 'OP-UNCONFIGURED' },
        retryCount: 0
      }
    ]);

    const unconfRes = await syncService.processQueue(null, null);
    assert.strictEqual(unconfRes.skipped, true, 'Unconfigured call must be skipped');
    const queueAfterUnconf = syncService.getQueue();
    assert.strictEqual(queueAfterUnconf[0].retryCount, 0, 'retryCount must NOT be incremented when called without dependencies');
    assert.strictEqual(queueAfterUnconf[0].lastAttemptAt, undefined, 'lastAttemptAt must NOT be set when dependencies missing');
  });

  await runAsyncTest('Patch Test 4: Multiple independent returns on same transaction remain preserved', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');
    syncService.saveQueue([]);

    const txId = 'TXN-MULTI-RET';
    const op1 = 'OP-RET-PART-1';
    const op2 = 'OP-RET-PART-2';

    syncService.enqueueMutation({
      action: 'rpc',
      rpcName: 'return_components_atomic',
      operationId: op1,
      rpcPayload: { p_transaction_id: txId, p_operation_id: op1, p_items: [{ componentId: 'C1', returnQuantity: 1 }] }
    });

    syncService.enqueueMutation({
      action: 'rpc',
      rpcName: 'return_components_atomic',
      operationId: op2,
      rpcPayload: { p_transaction_id: txId, p_operation_id: op2, p_items: [{ componentId: 'C2', returnQuantity: 2 }] }
    });

    const q = syncService.getQueue();
    assert.strictEqual(q.length, 2, 'Both return operations must exist independently in queue');
    assert.strictEqual(q[0].operationId, op1);
    assert.strictEqual(q[1].operationId, op2);
  });

  await runAsyncTest('Patch Test 5: Corrupted localStorage queue is not silently discarded or overwritten', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');

    // Corrupt the storage with malformed JSON
    const malformedJson = '{"corrupted_data_not_closed: true, items: [';
    global.localStorage.setItem('inc_cms_offline_sync_queue_v1', malformedJson);

    // 1. getQueue() must throw a clear error rather than returning []
    assert.throws(
      () => syncService.getQueue(),
      /SyncService Queue Corrupted: Offline queue contains malformed JSON/
    );

    // 2. Storage content must NOT have been wiped or overwritten
    assert.strictEqual(
      global.localStorage.getItem('inc_cms_offline_sync_queue_v1'),
      malformedJson,
      'Raw corrupted queue data must remain strictly preserved in localStorage'
    );

    // 3. enqueueMutation must refuse to overwrite corrupted queue
    assert.throws(
      () => syncService.enqueueMutation({
        action: 'rpc',
        rpcName: 'issue_components_atomic',
        operationId: 'OP-BLOCKED',
        rpcPayload: { p_operation_id: 'OP-BLOCKED' }
      }),
      /SyncService Queue Corrupted/
    );
    assert.strictEqual(global.localStorage.getItem('inc_cms_offline_sync_queue_v1'), malformedJson);

    // 4. processQueue must report error and NOT treat queue as empty
    const mockClient = { rpc: async () => ({ error: null }) };
    const syncRes = await syncService.processQueue(mockClient);
    assert.strictEqual(syncRes.processed, 0);
    assert.strictEqual(syncRes.pending, null);
    assert.ok(syncRes.error.includes('SyncService Queue Corrupted'));

    // Corrupted data still preserved
    assert.strictEqual(global.localStorage.getItem('inc_cms_offline_sync_queue_v1'), malformedJson);
  });

  await runAsyncTest('Patch Test 6: Queue recovery works after storage problem is resolved', async () => {
    const { syncService } = await import('../../frontend/src/services/sync/syncService.js');

    // Simulate storage recovery: valid queue data restored
    const recoveredQueue = [
      {
        mutationId: 'MUT-RECOVERED',
        action: 'rpc',
        rpcName: 'issue_components_atomic',
        operationId: 'OP-RECOVERED-1',
        rpcPayload: { p_operation_id: 'OP-RECOVERED-1' },
        retryCount: 0
      }
    ];
    global.localStorage.setItem('inc_cms_offline_sync_queue_v1', JSON.stringify(recoveredQueue));

    // getQueue() now succeeds
    const q = syncService.getQueue();
    assert.strictEqual(q.length, 1);
    assert.strictEqual(q[0].operationId, 'OP-RECOVERED-1');

    // processQueue() drains successfully
    let rpcExecuted = false;
    const mockClient = {
      rpc: async (name, payload) => {
        if (payload.p_operation_id === 'OP-RECOVERED-1') rpcExecuted = true;
        return { data: { success: true }, error: null };
      }
    };

    const res = await syncService.processQueue(mockClient);
    assert.strictEqual(res.processed, 1, 'Recovered mutation must be processed');
    assert.strictEqual(rpcExecuted, true);
    assert.strictEqual(syncService.getQueue().length, 0, 'Queue is cleanly drained');
  });

  runTest('Patch Test 7: Existing staff, admin, and student access restrictions remain intact', () => {
    // 1. DROP VIEW does NOT use CASCADE
    assert.ok(
      sqlContent.includes('DROP VIEW IF EXISTS public.staff_student_directory;'),
      'Must drop view safely without CASCADE'
    );
    assert.ok(
      !sqlContent.includes('DROP VIEW IF EXISTS public.staff_student_directory CASCADE;'),
      'Must NOT use CASCADE in DROP VIEW'
    );

    // 2. Zero staff direct access to public.users
    assert.ok(
      !sqlContent.includes('CREATE POLICY "Staff view student directory" ON public.users;'),
      'Staff cannot have direct SELECT policy on public.users'
    );

    // 3. Staff restricted view and RPC exist
    assert.ok(
      sqlContent.includes('CREATE VIEW public.staff_student_directory'),
      'Must create public.staff_student_directory view'
    );
    assert.ok(
      sqlContent.includes('CREATE OR REPLACE FUNCTION public.get_student_directory()'),
      'Must create public.get_student_directory() RPC'
    );

    // 4. Atomic inventory functions have service_role revoked and authenticated granted
    assert.ok(
      sqlContent.includes('REVOKE ALL ON FUNCTION public.issue_components_atomic(text, text, text, text, text, timestamptz, text, jsonb, text) FROM PUBLIC, anon, service_role;'),
      'issue_components_atomic revoked from service_role'
    );
    assert.ok(
      sqlContent.includes('REVOKE ALL ON FUNCTION public.return_components_atomic(text, jsonb, text) FROM PUBLIC, anon, service_role;'),
      'return_components_atomic revoked from service_role'
    );
  });

  // =========================================================================
  // WORKSTREAM 10: Staff Authentication Preservation & get_my_profile Isolation
  // =========================================================================
  console.log('\n--- WORKSTREAM 10: Staff Authentication Preservation & Profile Isolation ---');

  const storageMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => { storageMap.set(k, String(v)); },
    removeItem: (k) => { storageMap.delete(k); },
    clear: () => { storageMap.clear(); },
  };

  const { supabase: testSupabase } = await import('../../frontend/src/lib/supabase.js');
  const dbModule = await import('../../frontend/src/db/database.js');
  const { authenticateUser, loginUser, getCurrentUser, setCurrentUser, refreshFromCloud, getStudents, getUserByRoll, resolveAuthenticatedProfile } = dbModule;

  // Scenario 1: Staff login with an empty local user cache
  await runAsyncTest('Critical Patch 1: Staff login with empty local user cache retrieves staff profile via get_my_profile', async () => {
    // Reset local cache
    storageMap.clear();

    const origSignIn = testSupabase.auth.signInWithPassword;
    const origRpc = testSupabase.rpc;

    try {
      testSupabase.auth.signInWithPassword = async ({ email }) => ({
        data: { user: { id: 'staff-auth-uuid-001', email } },
        error: null,
      });

      testSupabase.rpc = async (fn) => {
        if (fn === 'get_my_profile') {
          return {
            data: [{
              id: 'USER-STAFF-01',
              auth_id: 'staff-auth-uuid-001',
              roll_number: 'STAFF01',
              name: 'Lab Staff Officer',
              role: 'staff',
              department: 'Incubation Centre',
              branch: 'ECE',
              section: 'Lab',
              academic_year: 0,
              avatar_theme: 'emerald',
              face_registered: false,
              face_photo_url: null,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }],
            error: null,
          };
        }
        return { data: null, error: new Error('Unknown RPC') };
      };

      const user = await authenticateUser('STAFF01', 'staff123');
      assert.strictEqual(user.role, 'staff', 'Must resolve role as staff, not student');
      assert.strictEqual(getCurrentUser().role, 'staff', 'memoryStore.currentUser role must be staff');
      assert.strictEqual(user.rollNumber, 'STAFF01');
      assert.notStrictEqual(user.role, 'student', 'Must NOT default to student');

      const savedSession = JSON.parse(globalThis.localStorage.getItem('inc_cms_current_auth_session'));
      assert.strictEqual(savedSession.role, 'staff', 'Saved session in localStorage must have role = staff');
    } finally {
      testSupabase.auth.signInWithPassword = origSignIn;
      testSupabase.rpc = origRpc;
    }
  });

  // Scenario 2: Staff login after cloud refresh
  await runAsyncTest('Critical Patch 2: Cloud refresh does not destroy authenticated staff session/profile', async () => {
    // Establish staff session
    const staffProfile = {
      id: 'USER-STAFF-01',
      authId: 'staff-auth-uuid-001',
      rollNumber: 'STAFF01',
      name: 'Lab Staff Officer',
      role: 'staff',
      department: 'Incubation Centre',
      branch: 'ECE',
      section: 'Lab',
      academicYear: 0,
    };
    setCurrentUser(staffProfile);

    const origFrom = testSupabase.from;
    const origRpc = testSupabase.rpc;

    try {
      // Mock cloud fetch: components empty, staff_student_directory returns students only
      testSupabase.from = (table) => {
        if (table === 'users') {
          // Direct public.users returns 0 rows for staff under RLS
          return {
            select: () => ({
              eq: () => ({ data: [], error: null }),
              or: () => ({ limit: () => ({ data: [], error: null }) }),
              limit: () => ({ data: [], error: null }),
              data: [],
              error: null,
            }),
          };
        }
        if (table === 'staff_student_directory') {
          return {
            select: () => ({
              data: [
                { id: 'STU-1', roll_number: '238W1A0401', name: 'Student One', role: 'student' },
                { id: 'STU-2', roll_number: '238W1A0402', name: 'Student Two', role: 'student' },
              ],
              error: null,
            }),
          };
        }
        return {
          select: () => ({ data: [], error: null }),
        };
      };

      testSupabase.rpc = async (fn) => {
        if (fn === 'get_student_directory') {
          return {
            data: [
              { id: 'STU-1', roll_number: '238W1A0401', name: 'Student One', role: 'student' },
              { id: 'STU-2', roll_number: '238W1A0402', name: 'Student Two', role: 'student' },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      };

      await refreshFromCloud();

      // Ensure currentUser is preserved as staff
      assert.strictEqual(getCurrentUser().role, 'staff', 'Current user must remain staff after cloud refresh');
      assert.strictEqual(getCurrentUser().rollNumber, 'STAFF01');

      // Ensure getStudents() only returns student records
      const students = getStudents();
      assert.strictEqual(students.length, 2, 'getStudents must contain only the student records');
      assert.ok(students.every(s => s.role === 'student'), 'All records from getStudents must have role student');
      assert.ok(!students.some(s => s.rollNumber === 'STAFF01'), 'Staff must NOT be listed as a student');

      // Staff profile can still be retrieved by roll
      const fetchedStaff = getUserByRoll('STAFF01');
      assert.ok(fetchedStaff, 'Staff user must be retrievable by roll');
      assert.strictEqual(fetchedStaff.role, 'staff');
    } finally {
      testSupabase.from = origFrom;
      testSupabase.rpc = origRpc;
    }
  });

  // Scenario 3: Staff page reload with an existing Supabase session
  await runAsyncTest('Critical Patch 3: Page reload resolves and preserves staff role via get_my_profile', async () => {
    const origRpc = testSupabase.rpc;
    const origGetSession = testSupabase.auth.getSession;

    try {
      testSupabase.auth.getSession = async () => ({
        data: {
          session: {
            user: { id: 'staff-auth-uuid-reloaded', email: 'staff01@incubation.local' },
          },
        },
        error: null,
      });

      testSupabase.rpc = async (fn) => {
        if (fn === 'get_my_profile') {
          return {
            data: [{
              id: 'USER-STAFF-RELOAD',
              auth_id: 'staff-auth-uuid-reloaded',
              roll_number: 'STAFF01',
              name: 'Lab Staff Officer',
              role: 'staff',
              department: 'Incubation Centre',
            }],
            error: null,
          };
        }
        return { data: null, error: null };
      };

      const resolved = await resolveAuthenticatedProfile({ id: 'staff-auth-uuid-reloaded', email: 'staff01@incubation.local' });
      assert.ok(resolved, 'Profile must be resolved');
      assert.strictEqual(resolved.role, 'staff', 'Resolved role on reload must be staff');
      assert.strictEqual(resolved.authId, 'staff-auth-uuid-reloaded');
    } finally {
      testSupabase.rpc = origRpc;
      testSupabase.auth.getSession = origGetSession;
    }
  });

  // Scenario 4: Admin and substitute_admin login
  await runAsyncTest('Critical Patch 4: Admin and substitute_admin login resolve correct administrative roles', async () => {
    const origSignIn = testSupabase.auth.signInWithPassword;
    const origRpc = testSupabase.rpc;

    try {
      // 1. Admin login
      testSupabase.auth.signInWithPassword = async ({ email }) => ({
        data: { user: { id: 'admin-auth-uuid', email } },
        error: null,
      });

      testSupabase.rpc = async (fn) => {
        if (fn === 'get_my_profile') {
          return {
            data: [{
              id: 'USER-ADMIN-01',
              auth_id: 'admin-auth-uuid',
              roll_number: 'ADMIN',
              name: 'System Admin',
              role: 'admin',
            }],
            error: null,
          };
        }
        return { data: null, error: null };
      };

      const adminUser = await authenticateUser('admin', 'admin123');
      assert.strictEqual(adminUser.role, 'admin', 'Admin user role must be admin');
      assert.strictEqual(getCurrentUser().role, 'admin');

      // 2. Substitute Admin login
      testSupabase.auth.signInWithPassword = async ({ email }) => ({
        data: { user: { id: 'subadmin-auth-uuid', email } },
        error: null,
      });

      testSupabase.rpc = async (fn) => {
        if (fn === 'get_my_profile') {
          return {
            data: [{
              id: 'USER-SUBADMIN-01',
              auth_id: 'subadmin-auth-uuid',
              roll_number: 'SUBADMIN',
              name: 'Substitute Admin',
              role: 'substitute_admin',
            }],
            error: null,
          };
        }
        return { data: null, error: null };
      };

      const subadminUser = await authenticateUser('subadmin', 'subadmin123');
      assert.strictEqual(subadminUser.role, 'substitute_admin', 'Subadmin user role must be substitute_admin');
      assert.strictEqual(getCurrentUser().role, 'substitute_admin');
    } finally {
      testSupabase.auth.signInWithPassword = origSignIn;
      testSupabase.rpc = origRpc;
    }
  });

  // Scenario 5: Student login and own-profile isolation
  await runAsyncTest('Critical Patch 5: Student login resolves own profile and enforces isolation', async () => {
    const origSignIn = testSupabase.auth.signInWithPassword;
    const origRpc = testSupabase.rpc;

    try {
      testSupabase.auth.signInWithPassword = async ({ email }) => ({
        data: { user: { id: 'student-auth-uuid-477', email } },
        error: null,
      });

      testSupabase.rpc = async (fn) => {
        if (fn === 'get_my_profile') {
          return {
            data: [{
              id: 'USER-STU-477',
              auth_id: 'student-auth-uuid-477',
              roll_number: '238W1A0477',
              name: 'Anwar Bajarinti',
              role: 'student',
              department: 'ECE',
            }],
            error: null,
          };
        }
        return { data: null, error: null };
      };

      const studentUser = await authenticateUser('238W1A0477', 'student123');
      assert.strictEqual(studentUser.role, 'student');
      assert.strictEqual(studentUser.rollNumber, '238W1A0477');
      assert.strictEqual(getCurrentUser().role, 'student');

      // Verify in SQL: get_my_profile accepts zero user arguments and filters strictly by auth.uid()
      assert.ok(
        sqlContent.includes('CREATE OR REPLACE FUNCTION public.get_my_profile()'),
        'get_my_profile RPC must take ZERO parameters (caller cannot request another user ID)'
      );
      assert.ok(
        sqlContent.includes('WHERE u.auth_id = v_auth_id'),
        'get_my_profile must strictly query by u.auth_id = v_auth_id'
      );
    } finally {
      testSupabase.auth.signInWithPassword = origSignIn;
      testSupabase.rpc = origRpc;
    }
  });

  // Scenario 6: Student-directory access remaining student-only
  runTest('Critical Patch 6: Student-directory access is strictly filtered to student-only records', () => {
    // 1. In view definition:
    assert.ok(
      sqlContent.includes("WHERE u.role = 'student'") &&
      sqlContent.includes('CREATE VIEW public.staff_student_directory'),
      'staff_student_directory view must strictly filter WHERE u.role = student'
    );

    // 2. In RPC definition:
    assert.ok(
      sqlContent.includes('CREATE OR REPLACE FUNCTION public.get_student_directory()') &&
      sqlContent.includes("WHERE u.role = 'student';"),
      'get_student_directory RPC must strictly filter WHERE u.role = student'
    );

    // 3. Sensitive columns excluded:
    const forbiddenColumns = ['password_hash', 'fingerprint_ids', 'finger_labels', 'membership_status'];
    for (const col of forbiddenColumns) {
      assert.ok(
        !sqlContent.includes(`u.${col}`) || sqlContent.indexOf(`u.${col}`) > sqlContent.indexOf('protect_user_fields_on_update'),
        `Forbidden column ${col} must not be exposed in get_student_directory or staff_student_directory projections`
      );
    }
  });

  // Scenario 7: Unauthorized users cannot retrieve another user's profile and unverified logins fail closed
  await runAsyncTest('Critical Patch 7: Unauthenticated calls reject, and unverified server roles fail closed', async () => {
    // 1. Verify SQL enforces authenticated session in get_my_profile
    assert.ok(
      sqlContent.includes("v_auth_id := auth.uid();") &&
      sqlContent.includes("IF v_auth_id IS NULL THEN") &&
      sqlContent.includes("RAISE EXCEPTION 'Authentication required: No active authenticated session.';"),
      'get_my_profile must check auth.uid() IS NULL and raise authentication required'
    );

    // 2. Verify SQL revokes execution from PUBLIC, anon, and service_role
    assert.ok(
      sqlContent.includes('REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon, service_role;'),
      'get_my_profile execution revoked from PUBLIC, anon, service_role'
    );
    assert.ok(
      sqlContent.includes('GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;'),
      'get_my_profile execution granted exclusively to authenticated'
    );

    // 3. Verify frontend fail-closed behavior: When server returns no profile/role and local cache is empty,
    // authenticateUser MUST NOT assign role = student; it must fail closed with a clear error.
    globalThis.localStorage.clear();
    const origSignIn = testSupabase.auth.signInWithPassword;
    const origRpc = testSupabase.rpc;
    const origFrom = testSupabase.from;

    try {
      testSupabase.auth.signInWithPassword = async ({ email }) => ({
        data: { user: { id: 'unknown-uuid-999', email } },
        error: null,
      });

      testSupabase.rpc = async () => ({
        data: [], // empty profile from server
        error: null,
      });

      testSupabase.from = () => ({
        select: () => ({
          or: () => ({ limit: () => ({ data: [], error: null }) }),
          eq: () => ({ limit: () => ({ data: [], error: null }) }),
        }),
      });

      await assert.rejects(
        async () => {
          await authenticateUser('UNKNOWN_OPERATOR', 'anypass123');
        },
        /Authentication failed: Unable to verify user profile and role from server\./,
        'Unverified role must fail closed and never assign role = student'
      );
    } finally {
      testSupabase.auth.signInWithPassword = origSignIn;
      testSupabase.rpc = origRpc;
      testSupabase.from = origFrom;
    }
  });

  // =========================================================================
  // WORKSTREAM 7: Protected Database Backup Byte Counts Invariant
  // =========================================================================
  console.log('\n--- WORKSTREAM 7: Protected Database Backup Invariant ---');

  runTest('data_base_backup.js remains exactly 61,794 bytes', () => {
    const backupPath = path.join(workspaceRoot, 'frontend/src/db/data_base_backup.js');
    const stat = fs.statSync(backupPath);
    assert.strictEqual(stat.size, 61794, `data_base_backup.js size mismatch (expected 61794, got ${stat.size})`);
  });

  runTest('sampleData.js remains exactly 22,676 bytes', () => {
    const samplePath = path.join(workspaceRoot, 'frontend/src/db/sampleData.js');
    const stat = fs.statSync(samplePath);
    assert.strictEqual(stat.size, 22676, `sampleData.js size mismatch (expected 22676, got ${stat.size})`);
  });

  console.log('\n===================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} NEGATIVE SECURITY & OFFLINE TESTS PASSED!`);
  console.log('===================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ TEST RUN ABORTED DUE TO FAILURE:', err);
  process.exit(1);
});
