// src/db/syncService.js
// Offline Queue & Conflict-Resilient Cloud Synchronization Manager
// Manages local offline mutations, retries with exponential backoff,
// and safe last-write-wins timestamp conflict resolution.

const SYNC_QUEUE_KEY = 'inc_cms_offline_sync_queue_v1';
const MAX_RETRIES = 5;

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.listeners = new Set();
    this.supabaseClient = null;
    this.toDbRowFn = null;
    this.initNetworkListeners();
  }

  setDependencies(supabaseClient, toDbRowFn) {
    this.supabaseClient = supabaseClient || null;
    this.toDbRowFn = toDbRowFn || null;
  }

  initNetworkListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncService] Network restored.');
        this.notify('NETWORK_ONLINE', { isOnline: true });
        // Authoritative queue processing is executed by database.js with full Supabase & schemaMapper dependencies.
      });

      window.addEventListener('offline', () => {
        console.log('[SyncService] Network lost. Switching to offline queue mode.');
        this.notify('NETWORK_OFFLINE', { isOnline: false });
      });
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event, payload) {
    this.listeners.forEach((cb) => {
      try {
        cb(event, payload);
      } catch (err) {
        console.error('[SyncService Notification Error]:', err);
      }
    });
  }

  isOnline() {
    return (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') ? navigator.onLine : true;
  }

  getQueue() {
    let rawData;
    try {
      rawData = localStorage.getItem(SYNC_QUEUE_KEY);
    } catch (readErr) {
      console.error('[SyncService] Storage read failure on offline queue:', readErr);
      throw new Error(`SyncService Storage Read Failure: Unable to access offline queue in storage (${readErr.message || String(readErr)}). Stored queue preserved.`);
    }

    if (rawData === null || rawData === undefined || rawData === '') {
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(rawData);
    } catch (parseErr) {
      console.error('[SyncService] Storage corrupted: Malformed JSON in offline queue:', parseErr);
      throw new Error(`SyncService Queue Corrupted: Offline queue contains malformed JSON (${parseErr.message || String(parseErr)}). Stored queue preserved without overwrite.`);
    }

    if (!Array.isArray(parsed)) {
      console.error('[SyncService] Storage corrupted: Offline queue is not a valid JSON array.');
      throw new Error('SyncService Queue Corrupted: Stored offline queue data is not a valid array. Stored queue preserved without overwrite.');
    }

    return parsed;
  }

  getRawQueueData() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(SYNC_QUEUE_KEY) : null;
    } catch (_) {
      return null;
    }
  }

  isQueueHealthy() {
    try {
      const q = this.getQueue();
      return { healthy: true, length: q.length };
    } catch (err) {
      return { healthy: false, error: err.message };
    }
  }

  saveQueue(queue) {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('[SyncService] Failed to persist offline queue:', e);
      throw new Error(`SyncService Persistence Failure: Unable to persist offline queue to storage (${e.message || String(e)}).`);
    }
  }

  /**
   * Remove a specific mutation from the offline queue by operationId (for RPC) or mutationId.
   */
  dequeueMutation({ mutationId, operationId }) {
    const queue = this.getQueue();
    const updated = queue.filter((m) => {
      if (operationId && (m.action === 'rpc' || m.operationId)) {
        return m.operationId !== operationId;
      }
      if (mutationId) {
        return m.mutationId !== mutationId;
      }
      return true;
    });
    this.saveQueue(updated);
    return updated;
  }

  /**
   * Enqueue a pending mutation when offline or when network call fails.
   */
  enqueueMutation({ table, action, id, data, timestamp = new Date().toISOString(), rpcName, rpcPayload, operationId }) {
    const queue = this.getQueue();

    let opId = null;
    if (action === 'rpc') {
      // 1. Require rpcPayload to be a valid non-empty object
      if (!rpcPayload || typeof rpcPayload !== 'object' || Array.isArray(rpcPayload)) {
        throw new Error(`SyncService Error: rpcPayload must be a valid non-empty object for RPC mutations (rpcName: ${rpcName || 'unknown'}).`);
      }

      // 2. Require a genuine non-empty operationId
      const candidateOpId = operationId || rpcPayload.p_operation_id;
      if (!candidateOpId || typeof candidateOpId !== 'string' || !candidateOpId.trim()) {
        throw new Error(`SyncService Error: A genuine unique operationId is mandatory for RPC mutations (rpcName: ${rpcName || 'unknown'}).`);
      }
      opId = candidateOpId.trim();

      // 3. Require rpcPayload.p_operation_id to match operationId exactly
      if (!rpcPayload.p_operation_id || typeof rpcPayload.p_operation_id !== 'string' || rpcPayload.p_operation_id.trim() !== opId) {
        throw new Error(`SyncService Error: operationId ("${opId}") does not match rpcPayload.p_operation_id ("${rpcPayload.p_operation_id}").`);
      }
      rpcPayload.p_operation_id = opId;
    }

    // Deduplicate:
    // For RPC operations, use unique operationId so multiple distinct operations on the same transaction are preserved.
    // For direct table DML, deduplicate by table + id + action.
    const existingIdx = queue.findIndex((m) => {
      if (action === 'rpc' || m.action === 'rpc') {
        return m.action === 'rpc' && m.operationId === opId;
      }
      return m.table === table && m.id === id && m.action === action;
    });

    if (existingIdx !== -1 && action === 'rpc') {
      const existing = queue[existingIdx];
      if (existing.rpcName !== rpcName) {
        throw new Error(`SyncService Error: Operation ID "${opId}" is already queued for RPC "${existing.rpcName}", not "${rpcName}".`);
      }

      // If the payload differs, reject the new enqueue request instead of replacing the old mutation
      const existingPayloadStr = JSON.stringify(existing.rpcPayload);
      const newPayloadStr = JSON.stringify(rpcPayload);
      if (existingPayloadStr !== newPayloadStr) {
        throw new Error(`SyncService Error: Operation ID "${opId}" is already queued with a different payload. Conflicting mutations rejected.`);
      }

      // Identical payload: return existing queued mutation without modifying queue
      return existing;
    }

    const mutation = {
      mutationId: `MUT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      table,
      action, // 'upsert' | 'insert' | 'update' | 'delete' | 'rpc'
      id,
      operationId: opId,
      data,
      rpcName,
      rpcPayload,
      timestamp,
      retryCount: 0,
    };

    if (existingIdx !== -1) {
      queue[existingIdx] = mutation;
    } else {
      queue.push(mutation);
    }

    this.saveQueue(queue);
    this.notify('MUTATION_ENQUEUED', { table, id, operationId: opId, rpcName, pendingCount: queue.length });
    return mutation;
  }

  /**
   * Calculate exponential backoff delay based on retry count.
   * Returns delay in milliseconds: 1s, 2s, 4s, 8s, 16s (max 30s).
   */
  getBackoffDelayMs(retryCount) {
    if (!retryCount || retryCount <= 0) return 0;
    const factor = Math.min(Math.pow(2, retryCount - 1), 30);
    return factor * 1000;
  }

  /**
   * Process all queued offline mutations against Supabase.
   */
  async processQueue(supabaseClient = this.supabaseClient, toDbRowFn = this.toDbRowFn) {
    const client = supabaseClient || this.supabaseClient;
    const mapper = toDbRowFn || this.toDbRowFn;

    if (!client) {
      console.warn('[SyncService] processQueue invoked without required supabaseClient. Execution aborted without altering retry state.');
      return { processed: 0, pending: 0, skipped: true };
    }

    if (!this.isOnline() || this.isSyncing) {
      let pendingCount = 0;
      try { pendingCount = this.getQueue().length; } catch (_) {}
      return { processed: 0, pending: pendingCount };
    }

    let queue;
    try {
      queue = this.getQueue();
    } catch (queueErr) {
      console.error('[SyncService] Cannot process offline queue due to storage read/corruption error:', queueErr.message);
      this.notify('QUEUE_CORRUPTED', { error: queueErr.message });
      return { processed: 0, pending: null, error: queueErr.message };
    }

    if (queue.length === 0) return { processed: 0, pending: 0 };

    this.isSyncing = true;
    this.notify('SYNC_STARTED', { queueLength: queue.length });

    let processedCount = 0;

    try {
      for (const mutation of queue) {
        // 1. Bounded retry enforcement:
        // Never silently discard pending RPC operations! Keep queued for manual retry/audit,
        // but do not spam the network once MAX_RETRIES is reached.
        if (mutation.retryCount && mutation.retryCount >= MAX_RETRIES) {
          continue;
        }

        // 2. Exponential backoff enforcement:
        // Wait until required exponential backoff delay expires before re-attempting.
        if (mutation.lastAttemptAt && mutation.retryCount > 0) {
          const elapsed = Date.now() - new Date(mutation.lastAttemptAt).getTime();
          const backoffDelay = this.getBackoffDelayMs(mutation.retryCount);
          if (elapsed < backoffDelay) {
            continue;
          }
        }

        try {
          const { table, action, id, data, timestamp } = mutation;
          const dbPayload = mapper ? mapper(table, data) : data;

          // Conflict check: verify if newer cloud record already exists (tables only, not RPCs)
          if (action !== 'delete' && action !== 'rpc' && table) {
            const { data: existingRows } = await client
              .from(table)
              .select('updated_at')
              .eq('id', id)
              .limit(1);

            if (existingRows && existingRows.length > 0 && existingRows[0].updated_at) {
              const cloudTimestamp = new Date(existingRows[0].updated_at).getTime();
              const localTimestamp = new Date(timestamp).getTime();
              if (cloudTimestamp > localTimestamp) {
                console.warn(
                  `[SyncService] Conflict detected on ${table} (${id}): Cloud has newer timestamp. Discarding stale offline mutation.`
                );
                try {
                  this.dequeueMutation({ mutationId: mutation.mutationId, operationId: mutation.operationId });
                } catch (saveErr) {
                  console.warn('[SyncService] Storage save failure during dequeue:', saveErr.message);
                }
                processedCount++;
                continue; // Skip stale write
              }
            }
          }

          // Execute mutation against Supabase
          let resError = null;
          if (action === 'rpc') {
            const { error } = await client.rpc(mutation.rpcName, mutation.rpcPayload);
            resError = error;
          } else if (action === 'delete') {
            const { error } = await client.from(table).delete().eq('id', id);
            resError = error;
          } else if (action === 'insert') {
            const { error } = await client.from(table).insert(dbPayload);
            resError = error;
          } else {
            // Default to upsert for idempotent replay
            const { error } = await client.from(table).upsert(dbPayload);
            resError = error;
          }

          if (resError) {
            console.warn(`[SyncService] Mutation failed for ${table || mutation.rpcName} (${id}):`, resError.message);
            let currentQueue = [];
            try { currentQueue = this.getQueue(); } catch (_) {}
            const target = currentQueue.find((m) =>
              (mutation.operationId && m.operationId === mutation.operationId) ||
              (mutation.mutationId && m.mutationId === mutation.mutationId)
            );
            if (target) {
              target.retryCount = (target.retryCount || 0) + 1;
              target.lastError = resError.message;
              target.lastAttemptAt = new Date().toISOString();
              try {
                this.saveQueue(currentQueue);
              } catch (saveErr) {
                console.warn('[SyncService] Storage save failure during retryCount update:', saveErr.message);
              }
            }
          } else {
            processedCount++;
            // Ensure successful retries remove only the matching queued operation (by operationId if RPC, or mutationId)
            try {
              this.dequeueMutation({ mutationId: mutation.mutationId, operationId: mutation.operationId });
            } catch (saveErr) {
              console.warn('[SyncService] Storage save failure during successful dequeue:', saveErr.message);
            }
          }
        } catch (err) {
          console.error('[SyncService] Unexpected error processing mutation:', err);
          let currentQueue = [];
          try { currentQueue = this.getQueue(); } catch (_) {}
          const target = currentQueue.find((m) =>
            (mutation.operationId && m.operationId === mutation.operationId) ||
            (mutation.mutationId && m.mutationId === mutation.mutationId)
          );
          if (target) {
            target.retryCount = (target.retryCount || 0) + 1;
            target.lastError = err?.message || String(err);
            target.lastAttemptAt = new Date().toISOString();
            try {
              this.saveQueue(currentQueue);
            } catch (saveErr) {
              console.warn('[SyncService] Storage save failure during error retryCount update:', saveErr.message);
            }
          }
        }
      }
    } finally {
      // Guarantee isSyncing is ALWAYS reset to false, even on unhandled errors or storage failures
      this.isSyncing = false;
      let finalPending = 0;
      try {
        finalPending = this.getQueue().length;
      } catch (_) {}
      this.notify('SYNC_FINISHED', { processed: processedCount, pending: finalPending });
    }

    let finalCount = 0;
    try { finalCount = this.getQueue().length; } catch (_) {}
    return { processed: processedCount, pending: finalCount };
  }
}

export const syncService = new SyncService();
