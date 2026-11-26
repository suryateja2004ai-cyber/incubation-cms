// src/services/esp32Service.js
// Two-way communication service for ESP32 and physical lab hardware controllers
// Strictly delineates REAL HARDWARE MODE vs SIMULATION/TEST MODE
// 5 Distinct Device States: COMMAND_SENT, WAITING_CONFIRMATION, CONFIRMED, FAILED, OFFLINE

import { updateDeviceConfirmedState, setDeviceCommandState, getSettings } from '../../db/database.js';

export const HARDWARE_MODES = {
  REAL_HARDWARE: 'REAL_HARDWARE',
  SIMULATION: 'SIMULATION',
};

export const DEVICE_HARDWARE_STATES = {
  COMMAND_SENT: 'COMMAND_SENT',
  WAITING_CONFIRMATION: 'WAITING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  OFFLINE: 'OFFLINE',
};

class Esp32Service {
  constructor() {
    this.gatewayEndpoint = 'http://127.0.0.1:5050';
    this.endpoint = 'http://esp32-lab.local';
    this.isGatewayOnline = false;
    this.isLocalLabNetwork = false;
    this.isOnline = true;
    this.isEmergencyFallbackActive = false;
    this.mode = HARDWARE_MODES.SIMULATION; // Default to simulation until real controller connected
    this.pollTimer = null;
    this.statusListeners = new Set();
    this.deviceStates = new Map(); // deviceId -> { state, lastConfirmedAt, error }

    // Preserve function binding across all callers and destructuring
    this.checkGatewayHealth = this.checkGatewayHealth.bind(this);
    this.getMode = this.getMode.bind(this);
    this.setMode = this.setMode.bind(this);
    this.getDeviceState = this.getDeviceState.bind(this);
    this.setDeviceState = this.setDeviceState.bind(this);
    this.subscribeStatus = this.subscribeStatus.bind(this);
    this.notifyStatus = this.notifyStatus.bind(this);
    this.setEmergencyFallback = this.setEmergencyFallback.bind(this);
    this.sendCommand = this.sendCommand.bind(this);
    this.handlePhysicalSwitchEvent = this.handlePhysicalSwitchEvent.bind(this);
  }

  async checkGatewayHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${this.gatewayEndpoint}/api/gateway/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        this.isGatewayOnline = data.status === 'online';
        this.isLocalLabNetwork = Boolean(data.isLocalLabNetwork);
      } else {
        this.isGatewayOnline = false;
        this.isLocalLabNetwork = false;
      }
    } catch {
      this.isGatewayOnline = false;
      this.isLocalLabNetwork = false;
    }
    this.notifyStatus();
    return {
      isGatewayOnline: this.isGatewayOnline,
      isLocalLabNetwork: this.isLocalLabNetwork,
    };
  }

  init() {
    try {
      this.checkGatewayHealth().catch(() => {});
      const settings = getSettings();
      if (settings.esp32Endpoint) {
        this.endpoint = settings.esp32Endpoint;
      }
      this.isEmergencyFallbackActive = Boolean(settings.emergencyFallbackActive);
      
      const savedMode = localStorage.getItem('inc_cms_hardware_mode');
      if (savedMode && HARDWARE_MODES[savedMode]) {
        this.mode = savedMode;
      }
    } catch {
      // Ignore during initial load
    }
  }

  getMode() {
    return this.mode;
  }

  setMode(newMode) {
    if (!HARDWARE_MODES[newMode]) {
      throw new Error(`Invalid hardware mode: ${newMode}`);
    }
    this.mode = newMode;
    try {
      localStorage.setItem('inc_cms_hardware_mode', newMode);
    } catch {
      // Storage unavailable
    }
    this.notifyStatus();
    return this.mode;
  }

  getDeviceState(deviceId) {
    return this.deviceStates.get(deviceId) || {
      state: DEVICE_HARDWARE_STATES.CONFIRMED,
      lastConfirmedAt: null,
      error: null,
    };
  }

  setDeviceState(deviceId, state, error = null) {
    this.deviceStates.set(deviceId, {
      state,
      lastConfirmedAt: state === DEVICE_HARDWARE_STATES.CONFIRMED ? new Date().toISOString() : undefined,
      error,
    });
    this.notifyStatus();
  }

  subscribeStatus(callback) {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  notifyStatus() {
    const payload = {
      isOnline: this.isOnline,
      isGatewayOnline: this.isGatewayOnline,
      isLocalLabNetwork: this.isLocalLabNetwork,
      mode: this.mode,
      fallback: this.isEmergencyFallbackActive,
      deviceStates: Object.fromEntries(this.deviceStates),
    };
    this.statusListeners.forEach((cb) => {
      try {
        cb(payload);
      } catch {
        // Listener error safety
      }
    });
  }

  setEmergencyFallback(active) {
    this.isEmergencyFallbackActive = active;
    this.notifyStatus();
  }

  /**
   * 1. Website -> Physical Device
   * Sends control payload to ESP32 controller
   * Adheres strictly to the 5 lifecycle states
   */
  async sendCommand(deviceId, state, brightness = null, speed = null, actor = null) {
    // 1. Mark state: COMMAND_SENT
    this.setDeviceState(deviceId, DEVICE_HARDWARE_STATES.COMMAND_SENT);
    await setDeviceCommandState(deviceId, state, brightness, speed, actor);

    // 2. Mark state: WAITING_CONFIRMATION
    this.setDeviceState(deviceId, DEVICE_HARDWARE_STATES.WAITING_CONFIRMATION);

    // If emergency fallback is active: immediate local confirmation without network ping
    if (this.isEmergencyFallbackActive) {
      updateDeviceConfirmedState(deviceId, state, brightness, speed);
      this.setDeviceState(deviceId, DEVICE_HARDWARE_STATES.CONFIRMED);
      return {
        success: true,
        mode: 'emergency_fallback',
        confirmed: state,
        hardwareState: DEVICE_HARDWARE_STATES.CONFIRMED,
      };
    }

    // A. REAL HARDWARE MODE: Routed strictly through Local Lab Gateway
    if (this.mode === HARDWARE_MODES.REAL_HARDWARE) {
      // SECURITY CHECK: Verify Local Lab Gateway is online and reachable on local subnet
      if (!this.isGatewayOnline) {
        await this.checkGatewayHealth();
      }

      if (!this.isGatewayOnline) {
        this.setDeviceState(deviceId, DEVICE_HARDWARE_STATES.FAILED, 'Local Lab Gateway unavailable');
        throw new Error(
          'Device Control Blocked: Physical device control is restricted to the local laboratory network. ' +
          'Remote operation from outside the lab or through the cloud is prohibited.'
        );
      }

      try {
        const payload = {
          deviceId,
          action: state,
          brightness: brightness !== null ? Number(brightness) : undefined,
          speed: speed !== null ? Number(speed) : undefined,
          timestamp: Date.now(),
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const actorToken = actor?.token || actor?.authId || (actor?.role ? `mock-token-${actor.role}` : '');
        const reqNonce = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
        const reqTimestamp = Date.now().toString();

        const response = await fetch(`${this.gatewayEndpoint}/api/gateway/device/control`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Timestamp': reqTimestamp,
            'X-Request-Nonce': reqNonce,
            'X-Requested-With': 'VRSECLabGateway',
            'X-Lab-CSRF': '1',
            ...(actorToken ? { Authorization: `Bearer ${actorToken}` } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Local Gateway returned HTTP error ${response.status}`);
        }

        const data = await response.json();
        const confirmedActual = data.confirmedState || state;
        updateDeviceConfirmedState(deviceId, confirmedActual, brightness, speed);
        this.isOnline = true;
        this.setDeviceState(deviceId, DEVICE_HARDWARE_STATES.CONFIRMED);
        return {
          success: true,
          mode: HARDWARE_MODES.REAL_HARDWARE,
          confirmedState: confirmedActual,
          hardwareState: DEVICE_HARDWARE_STATES.CONFIRMED,
        };
      } catch (err) {
        const isAbort = err.name === 'AbortError';
        const errMsg = isAbort
          ? 'Local Lab Gateway did not respond within 2.5s timeout'
          : (err.message || 'Failed to communicate with Local Lab Gateway');

        this.isOnline = false;
        this.setDeviceState(deviceId, DEVICE_HARDWARE_STATES.FAILED, errMsg);
        throw new Error(`[LOCAL GATEWAY ERROR] ${errMsg}. Device marked as FAILED.`);
      }
    }

    // B. SIMULATION / TEST MODE: Explicitly flagged as simulation
    await new Promise((res) => setTimeout(res, 350)); // Realistic relay switching delay
    updateDeviceConfirmedState(deviceId, state, brightness, speed);
    this.setDeviceState(deviceId, DEVICE_HARDWARE_STATES.CONFIRMED);

    return {
      success: true,
      mode: HARDWARE_MODES.SIMULATION,
      confirmedState: state,
      hardwareState: DEVICE_HARDWARE_STATES.CONFIRMED,
      note: 'Simulated actual confirmation (Test Mode)',
    };
  }

  /**
   * 2. Physical Switch -> Website
   * Updates state when physical wall switch or speed regulator is toggled
   */
  handlePhysicalSwitchEvent(deviceId, actualState, brightness = null, speed = null, isSimulated = false) {
    const updated = updateDeviceConfirmedState(deviceId, actualState, brightness, speed);
    this.setDeviceState(deviceId, DEVICE_HARDWARE_STATES.CONFIRMED);
    return {
      ...updated,
      isSimulated,
      mode: this.mode,
    };
  }
}

export const esp32Service = new Esp32Service();
esp32Service.init();

// Standalone function export for direct checkGatewayHealth usage
export const checkGatewayHealth = () => esp32Service.checkGatewayHealth();

// Export class and instance both as named and default exports
export { Esp32Service };
export default esp32Service;
