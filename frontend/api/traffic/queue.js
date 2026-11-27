// Serverless Traffic Queue & Concurrency Management
// Manages concurrent active student sessions and queues burst traffic to protect Neon database limits

const MAX_CONCURRENT_ACTIVE_SESSIONS = 50; // Neon free/standard connection pool threshold
const QUEUE_TICKET_TTL_MS = 60 * 1000; // 60 seconds ticket heartbeat

// In-memory active admissions and queue waiting list
const activeAdmissions = new Map(); // sessionId -> { admittedAt, lastHeartbeat, role }
const waitingQueue = []; // array of { ticketId, sessionId, role, requestedAt, lastHeartbeat }

function cleanupStaleSessions() {
  const now = Date.now();
  for (const [sid, data] of activeAdmissions.entries()) {
    if (now - data.lastHeartbeat > 25000) {
      activeAdmissions.delete(sid);
    }
  }
  for (let i = waitingQueue.length - 1; i >= 0; i--) {
    if (now - waitingQueue[i].lastHeartbeat > 30000) {
      waitingQueue.splice(i, 1);
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  cleanupStaleSessions();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }

  const { sessionId, role, action } = body || {};
  const currentSessionId = sessionId || `SESS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const userRole = role || 'student';
  const now = Date.now();

  // Admin and faculty bypass queue with instant admission
  const isPriority = userRole === 'admin' || userRole === 'substitute_admin' || userRole === 'sir' || userRole === 'faculty';

  if (action === 'leave') {
    activeAdmissions.delete(currentSessionId);
    const qIdx = waitingQueue.findIndex((item) => item.sessionId === currentSessionId);
    if (qIdx !== -1) waitingQueue.splice(qIdx, 1);
    return res.status(200).json({ success: true, message: 'Left session' });
  }

  // 1. Check if session is already admitted
  if (activeAdmissions.has(currentSessionId) || isPriority) {
    activeAdmissions.set(currentSessionId, {
      admittedAt: activeAdmissions.get(currentSessionId)?.admittedAt || now,
      lastHeartbeat: now,
      role: userRole,
    });

    return res.status(200).json({
      success: true,
      admitted: true,
      queued: false,
      position: 0,
      activeUsers: activeAdmissions.size,
      queueLength: waitingQueue.length,
      sessionId: currentSessionId,
    });
  }

  // 2. Check if active slots are available
  if (activeAdmissions.size < MAX_CONCURRENT_ACTIVE_SESSIONS && waitingQueue.length === 0) {
    activeAdmissions.set(currentSessionId, {
      admittedAt: now,
      lastHeartbeat: now,
      role: userRole,
    });

    return res.status(200).json({
      success: true,
      admitted: true,
      queued: false,
      position: 0,
      activeUsers: activeAdmissions.size,
      queueLength: 0,
      sessionId: currentSessionId,
    });
  }

  // 3. User must wait in line: update or insert into waiting queue
  let queueItem = waitingQueue.find((item) => item.sessionId === currentSessionId);
  if (!queueItem) {
    queueItem = {
      ticketId: `TICKET-${now}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: currentSessionId,
      role: userRole,
      requestedAt: now,
      lastHeartbeat: now,
    };
    waitingQueue.push(queueItem);
  } else {
    queueItem.lastHeartbeat = now;
  }

  // Check if position is 0 (head of queue) and a slot freed up
  const position = waitingQueue.findIndex((item) => item.sessionId === currentSessionId) + 1;
  if (position === 1 && activeAdmissions.size < MAX_CONCURRENT_ACTIVE_SESSIONS) {
    waitingQueue.shift();
    activeAdmissions.set(currentSessionId, {
      admittedAt: now,
      lastHeartbeat: now,
      role: userRole,
    });

    return res.status(200).json({
      success: true,
      admitted: true,
      queued: false,
      position: 0,
      activeUsers: activeAdmissions.size,
      queueLength: waitingQueue.length,
      sessionId: currentSessionId,
    });
  }

  const estimatedWaitSeconds = Math.max(2, position * 3);

  return res.status(200).json({
    success: true,
    admitted: false,
    queued: true,
    position,
    estimatedWaitSeconds,
    activeUsers: activeAdmissions.size,
    queueLength: waitingQueue.length,
    sessionId: currentSessionId,
  });
}
