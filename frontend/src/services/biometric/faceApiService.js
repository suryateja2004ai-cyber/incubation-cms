// src/services/biometric/faceApiService.js
// Client API for Local InsightFace + SQLite Biometric Service (127.0.0.1:8001)
// Zero image retention: Webcam frames are processed in-memory and discarded.

const LOCAL_FACE_DIRECT = 'http://127.0.0.1:8001';

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  let timedOut = false;

  const id = setTimeout(() => {
    timedOut = true;
    try {
      controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError'));
    } catch (e) {
      controller.abort();
    }
  }, timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    if (timedOut) {
      throw new Error(`Face service request timed out (${timeoutMs / 1000}s). The model may still be processing.`);
    }
    if (err.name === 'AbortError') {
      const explicitReason = controller.signal?.reason?.message;
      if (explicitReason) {
        throw new Error(explicitReason);
      }
      throw new Error('Request was cancelled.');
    }
    if (err.name === 'TypeError' && err.message?.includes('Failed to fetch')) {
      throw new Error(`Cannot reach local face service. Ensure port 8001 is running.`);
    }
    throw err;
  }
}

async function faceFetch(endpoint, options = {}, timeoutMs = 10000) {
  let lastError = null;

  // 1. Try relative URL (/api/face/...) via Vite proxy or Cloudflare Pages Function
  try {
    const res = await fetchWithTimeout(`/api/face${endpoint}`, options, timeoutMs);
    if (res.ok) {
      return await res.json();
    }
    // Parse backend JSON error if available
    const errData = await res.json().catch(() => null);
    if (errData && (errData.detail || errData.error || errData.message)) {
      const msg = errData.detail || errData.error || errData.message;
      throw new Error(msg);
    }
    if (res.status === 502 || res.status === 503) {
      throw new Error(`Proxy responded with status ${res.status}`);
    }
    throw new Error(`Request failed with status ${res.status}`);
  } catch (proxyErr) {
    // If it's a specific backend application error (e.g. session expired, invalid base64), rethrow immediately
    if (proxyErr.message && !proxyErr.message.includes('Proxy responded') && !proxyErr.message.includes('Cannot reach') && !proxyErr.message.includes('network')) {
      throw proxyErr;
    }
    lastError = proxyErr;
  }

  // 2. Direct localhost fallback if frontend is running on local machine (localhost or 127.0.0.1)
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    for (const url of [`${LOCAL_FACE_DIRECT}/api/face${endpoint}`, `${LOCAL_FACE_DIRECT}${endpoint}`]) {
      try {
        const directRes = await fetchWithTimeout(url, options, timeoutMs);
        if (directRes.ok) {
          return await directRes.json();
        }
        const errData = await directRes.json().catch(() => null);
        if (errData && (errData.detail || errData.error || errData.message)) {
          throw new Error(errData.detail || errData.error || errData.message);
        }
        throw new Error(`Direct request failed with status ${directRes.status}`);
      } catch (directErr) {
        if (directErr.message && !directErr.message.includes('Cannot reach') && !directErr.message.includes('network')) {
          throw directErr;
        }
        lastError = directErr;
      }
    }
    throw new Error(`Face service offline at ${LOCAL_FACE_DIRECT}. Please start with 'npm run face:start'.`);
  }

  throw lastError || new Error(`Face service offline. Please start local service.`);
}

export const faceApiService = {
  /**
   * Health & readiness check for local Python face recognition service.
   */
  async checkHealth() {
    try {
      const data = await faceFetch('/health', { method: 'GET' }, 4000);
      return {
        online: data.status === 'online',
        data,
      };
    } catch (err) {
      return {
        online: false,
        error: err.message,
      };
    }
  },

  /**
   * Get all registered students with biometric templates.
   */
  async getStudents() {
    return await faceFetch('/students', { method: 'GET' }, 6000);
  },

  /**
   * Check biometric enrollment status for a specific roll number.
   */
  async getStudentStatus(rollNumber) {
    if (!rollNumber) return { registered: false };
    const cleanRoll = encodeURIComponent(rollNumber.trim().toUpperCase());
    return await faceFetch(`/students/${cleanRoll}`, { method: 'GET' }, 6000);
  },

  /**
   * Permanently delete a student's biometric embeddings.
   */
  async deleteStudent(rollNumber) {
    const cleanRoll = encodeURIComponent(rollNumber.trim().toUpperCase());
    return await faceFetch(`/students/${cleanRoll}`, { method: 'DELETE' }, 6000);
  },

  /**
   * Start an atomic 10-embedding registration session.
   */
  async startRegistrationSession(rollNumber, name) {
    return await faceFetch('/register/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roll_number: rollNumber, name }),
    }, 8000);
  },

  /**
   * Send one video frame (base64) to the active registration session.
   * Discards frame in-memory after processing.
   */
  async sendRegistrationFrame(sessionId, imageBase64) {
    if (!sessionId) {
      throw new Error('Registration session ID is missing. Please restart the session.');
    }
    return await faceFetch('/register/session/frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, image_base64: imageBase64 }),
    }, 12000);
  },

  /**
   * Cancel an active registration session and purge uncommitted embeddings.
   */
  async cancelRegistrationSession(sessionId) {
    return await faceFetch('/register/session/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    }, 5000);
  },

  /**
   * Live frame recognition: detects faces, ranks candidates, calculates cosine similarity,
   * detects ambiguity, and returns candidates list. Discards frame immediately.
   */
  async recognizeFrame(
    imageBase64,
    simThreshold = 0.38,
    minEligibilityThreshold = 0.30,
    ambiguityMargin = 0.08
  ) {
    return await faceFetch('/recognize-frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: imageBase64,
        sim_threshold: simThreshold,
        min_eligibility_threshold: minEligibilityThreshold,
        ambiguity_margin: ambiguityMargin,
      }),
    }, 12000);
  },

  /**
   * Direct candidate evaluation for 512-dim embedding (testing and simulation).
   */
  async matchCandidates(
    embedding,
    simThreshold = 0.38,
    minEligibilityThreshold = 0.30,
    ambiguityMargin = 0.08
  ) {
    return await faceFetch('/match-candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embedding,
        sim_threshold: simThreshold,
        min_eligibility_threshold: minEligibilityThreshold,
        ambiguity_margin: ambiguityMargin,
      }),
    }, 8000);
  },
};

