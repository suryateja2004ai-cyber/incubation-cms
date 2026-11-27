// src/services/traffic/trafficQueueService.js
// Client Traffic & Concurrency Queue Manager
// Protects the server and database from burst student access

const SESSION_KEY = 'inc_cms_traffic_session_id';

class TrafficQueueService {
  constructor() {
    this.sessionId = this.getOrInitSessionId();
    this.listeners = new Set();
    this.pollInterval = null;
    this.state = {
      admitted: true,
      queued: false,
      position: 0,
      estimatedWaitSeconds: 0,
      activeUsers: 1,
      queueLength: 0,
      trafficStatus: 'normal', // 'normal' | 'moderate' | 'high_queue_active'
    };
  }

  getOrInitSessionId() {
    if (typeof window === 'undefined') return 'SSR-SESSION';
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `CLI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.state);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      try { cb(this.state); } catch (_) {}
    }
  }

  async checkQueueStatus(currentUser) {
    const role = currentUser?.role || 'student';
    try {
      const res = await fetch('/api/traffic/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          role,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const activeUsers = data.activeUsers || 1;
        const queueLength = data.queueLength || 0;

        let trafficStatus = 'normal';
        if (queueLength > 0 || activeUsers > 40) {
          trafficStatus = 'high_queue_active';
        } else if (activeUsers > 20) {
          trafficStatus = 'moderate';
        }

        this.state = {
          admitted: Boolean(data.admitted),
          queued: Boolean(data.queued),
          position: data.position || 0,
          estimatedWaitSeconds: data.estimatedWaitSeconds || 0,
          activeUsers,
          queueLength,
          trafficStatus,
        };
        this.notify();
      }
    } catch (err) {
      // If offline or network glitch, default to admitted so users are never hard-blocked
      this.state.admitted = true;
      this.state.queued = false;
      this.notify();
    }
  }

  startHeartbeat(currentUser) {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.checkQueueStatus(currentUser);

    // Heartbeat every 8s when admitted, every 3s when waiting in queue
    this.pollInterval = setInterval(() => {
      this.checkQueueStatus(currentUser);
    }, this.state.queued ? 3000 : 8000);
  }

  stopHeartbeat() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    try {
      fetch('/api/traffic/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId, action: 'leave' }),
        keepalive: true,
      });
    } catch (_) {}
  }
}

export const trafficQueueService = new TrafficQueueService();
