// src/services/esp32/zoneGestureService.js
// Production Zone-Based Appliance & Hand Gesture Monitoring Service for Smart Lab
// Coordinates 3x3 Zone Grid (Z1-Z9), Independent Zone-Wise State, Multi-Person Telemetry,
// 10-Second Non-Blocking Vacancy Timers, Hand Gestures, and Physical Relay Arbitration.

import esp32Service from './esp32Service.js';

export const GESTURE_ORIENTATIONS = {
  NONE: 'NONE',
  PALM_FACING: 'PALM_FACING',
  BACK_OF_HAND: 'BACK_OF_HAND',
  UNCERTAIN: 'UNCERTAIN',
};

export const GESTURE_ACTIONS = {
  NONE: 'NONE',
  FAN_OFF: 'FAN_OFF',
  LIGHT_OFF: 'LIGHT_OFF',
};

// Verified Physical Prototype:
// Only 2 physical lights connected to ESP32:
// - Light 1 -> GPIO22 (Active HIGH) -> Mapped to Zone 1
// - Light 2 -> GPIO23 (Active HIGH) -> Mapped to Zone 3
// - Zones 2, 4, 5, 6, 7, 8, 9 are Simulated Appliance Zones
export const DEFAULT_ZONE_MAPPING = {
  Z1: { lightId: 'DEV-LIGHT-1', fanId: 'DEV-FAN-1', deviceType: 'physical', physicalPin: 22, section: 'Physical Light 1 (GPIO 22)' },
  Z2: { lightId: 'SIM-LIGHT-2', fanId: 'SIM-FAN-2', deviceType: 'simulated', physicalPin: null, section: 'Zone 2 (Simulated)' },
  Z3: { lightId: 'DEV-LIGHT-2', fanId: 'DEV-FAN-2', deviceType: 'physical', physicalPin: 23, section: 'Physical Light 2 (GPIO 23)' },
  Z4: { lightId: 'SIM-LIGHT-4', fanId: 'SIM-FAN-4', deviceType: 'simulated', physicalPin: null, section: 'Zone 4 (Simulated)' },
  Z5: { lightId: 'SIM-LIGHT-5', fanId: 'SIM-FAN-5', deviceType: 'simulated', physicalPin: null, section: 'Zone 5 (Simulated)' },
  Z6: { lightId: 'SIM-LIGHT-6', fanId: 'SIM-FAN-6', deviceType: 'simulated', physicalPin: null, section: 'Zone 6 (Simulated)' },
  Z7: { lightId: 'SIM-LIGHT-7', fanId: 'SIM-FAN-7', deviceType: 'simulated', physicalPin: null, section: 'Zone 7 (Simulated)' },
  Z8: { lightId: 'SIM-LIGHT-8', fanId: 'SIM-FAN-8', deviceType: 'simulated', physicalPin: null, section: 'Zone 8 (Simulated)' },
  Z9: { lightId: 'SIM-LIGHT-9', fanId: 'SIM-FAN-9', deviceType: 'simulated', physicalPin: null, section: 'Zone 9 (Simulated)' },
};

class ZoneGestureService {
  constructor() {
    this.listeners = new Set();
    this.vacancyTimeoutMs = 10000; // 10.0-second non-blocking vacancy timer
    this.stabilityFrames = 5;      // Consecutive frames required
    this.cooldownMs = 2000;        // Debounce cooldown

    // Initialize 3x3 Zones with Independent State
    this.zones = {};
    for (let i = 1; i <= 9; i++) {
      const z = `Z${i}`;
      const mapping = DEFAULT_ZONE_MAPPING[z];
      this.zones[z] = {
        id: z,
        occupants: new Set(),
        vacancyStartedAt: null,
        manualLight: null,          // null (Auto) | 'OFF' (Gesture Override)
        manualFan: null,            // null (Auto) | 'OFF' (Gesture Override)
        lightRequested: 'OFF',      // Independent zone requested status ('ON' | 'OFF')
        fanRequested: 'OFF',        // Independent zone requested status ('ON' | 'OFF')
        lightMode: 'auto',          // 'auto' | 'gesture_override'
        fanMode: 'auto',            // 'auto' | 'gesture_override'
        deviceType: mapping?.deviceType || 'simulated',
        physicalPin: mapping?.physicalPin || null,
        lightId: mapping?.lightId || `SIM-LIGHT-${i}`,
        fanId: mapping?.fanId || `SIM-FAN-${i}`,
        section: mapping?.section || `Zone ${z}`,
        relayConfirmed: mapping?.deviceType === 'physical' ? 'OFF' : 'SIMULATED_OFF',
      };
    }

    // Active Tracked Persons: Map<personId, { id, zone, orientation, frameCount, lastTriggerAt, lastAction }>
    this.trackedPersons = new Map();

    // Actual Hardware / Appliance States
    this.applianceStates = {
      'DEV-LIGHT-1': { state: 'OFF', mode: 'auto' },
      'DEV-LIGHT-2': { state: 'OFF', mode: 'auto' },
      'DEV-FAN-1': { state: 'OFF', mode: 'auto' },
      'DEV-FAN-2': { state: 'OFF', mode: 'auto' },
    };

    // Live Python Controller Telemetry Link
    this.telemetryEndpoint = 'http://127.0.0.1:8002/api/zone-telemetry';
    this.isLiveConnected = false;
    this.cameraOnline = false;
    this.fps = 0;

    this.timerInterval = null;
    this.startBackgroundTimer();
  }

  startBackgroundTimer() {
    if (this.timerInterval) return;
    this.timerInterval = setInterval(() => {
      this.tickVacancyTimers();
      if (typeof fetch !== 'undefined') {
        this.pollPythonTelemetry().catch(() => {});
      }
    }, 400);
  }

  async pollPythonTelemetry() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 350);
      const res = await fetch(this.telemetryEndpoint, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        this.isLiveConnected = true;
        this.cameraOnline = Boolean(data.camera_online);
        this.fps = data.fps || 0;

        // Sync live zones from python controller if present
        if (data.zones && typeof data.zones === 'object') {
          for (const [zId, zData] of Object.entries(data.zones)) {
            if (this.zones[zId]) {
              this.zones[zId].occupants = new Set(zData.occupants || []);
              this.zones[zId].manualLight = zData.manual_light ?? null;
              this.zones[zId].manualFan = zData.manual_fan ?? null;
              this.zones[zId].lightRequested = zData.light_requested || (zData.occupants?.length > 0 ? 'ON' : 'OFF');
              this.zones[zId].fanRequested = zData.fan_requested || (zData.occupants?.length > 0 ? 'ON' : 'OFF');
              this.zones[zId].lightMode = zData.light_mode || 'auto';
              this.zones[zId].fanMode = zData.fan_mode || 'auto';
              this.zones[zId].deviceType = zData.device_type || this.zones[zId].deviceType;
              this.zones[zId].physicalPin = zData.physical_pin !== undefined ? zData.physical_pin : this.zones[zId].physicalPin;
              this.zones[zId].relayConfirmed = zData.relay_confirmed || this.zones[zId].relayConfirmed;

              if (zData.vacancy_remaining > 0) {
                this.zones[zId].vacancyStartedAt = Date.now() - (this.vacancyTimeoutMs - zData.vacancy_remaining * 1000);
              } else if (this.zones[zId].occupants.size > 0) {
                this.zones[zId].vacancyStartedAt = null;
              }
            }
          }
        }

        // Sync live persons
        if (Array.isArray(data.persons)) {
          this.trackedPersons.clear();
          for (const p of data.persons) {
            this.trackedPersons.set(p.id, {
              id: p.id,
              zone: p.zone,
              orientation: p.orientation || GESTURE_ORIENTATIONS.NONE,
              frameCount: p.frameCount || 0,
              lastAction: p.lastAction || GESTURE_ACTIONS.NONE,
              lastTriggerAt: p.lastTriggerAt || 0,
            });
          }
        }

        if (data.device_states) {
          for (const [k, v] of Object.entries(data.device_states)) {
            const uiId = k.replace('-0', '-');
            if (this.applianceStates[uiId]) {
              this.applianceStates[uiId].state = v;
            }
          }
        }

        this.notify();
      } else {
        this.isLiveConnected = false;
      }
    } catch {
      this.isLiveConnected = false;
    }
  }

  stopBackgroundTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getTelemetrySnapshot());
    return () => this.listeners.delete(listener);
  }

  notify() {
    const snapshot = this.getTelemetrySnapshot();
    this.listeners.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (err) {
        console.error('[ZoneGestureService] Error in listener:', err);
      }
    });
  }

  getTelemetrySnapshot() {
    const now = Date.now();
    const zonesSnapshot = {};
    for (const [zId, zData] of Object.entries(this.zones)) {
      const remainingSec = zData.vacancyStartedAt
        ? Math.max(0, (this.vacancyTimeoutMs - (now - zData.vacancyStartedAt)) / 1000)
        : 0;

      zonesSnapshot[zId] = {
        id: zId,
        occupants: Array.from(zData.occupants),
        isOccupied: zData.occupants.size > 0,
        vacancyRemainingSec: Number(remainingSec.toFixed(1)),
        manualLight: zData.manualLight,
        manualFan: zData.manualFan,
        lightRequested: zData.lightRequested,
        fanRequested: zData.fanRequested,
        lightMode: zData.lightMode,
        fanMode: zData.fanMode,
        deviceType: zData.deviceType,
        physicalPin: zData.physicalPin,
        lightId: zData.lightId,
        fanId: zData.fanId,
        section: zData.section,
        relayConfirmed: zData.relayConfirmed,
      };
    }

    const personsSnapshot = Array.from(this.trackedPersons.values()).map((p) => ({
      id: p.id,
      zone: p.zone,
      orientation: p.orientation,
      frameCount: p.frameCount,
      lastAction: p.lastAction,
      isStable: p.frameCount >= this.stabilityFrames,
      canTrigger: (now - p.lastTriggerAt) >= this.cooldownMs,
    }));

    return {
      zones: zonesSnapshot,
      persons: personsSnapshot,
      appliances: { ...this.applianceStates },
      isLiveConnected: this.isLiveConnected,
      cameraOnline: this.cameraOnline,
      fps: this.fps,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update person position and zone occupancy.
   * Maintains individual person tracking IDs and handles zone transitions cleanly.
   */
  updatePersonPresence(personId, newZone) {
    const person = this.trackedPersons.get(personId) || {
      id: personId,
      zone: newZone,
      orientation: GESTURE_ORIENTATIONS.NONE,
      frameCount: 0,
      lastTriggerAt: 0,
      lastAction: GESTURE_ACTIONS.NONE,
    };

    const oldZone = person.zone;
    if (oldZone !== newZone && this.zones[oldZone]) {
      this.zones[oldZone].occupants.delete(personId);
      if (this.zones[oldZone].occupants.size === 0) {
        this.zones[oldZone].vacancyStartedAt = Date.now();
      }
    }

    person.zone = newZone;
    this.trackedPersons.set(personId, person);

    if (this.zones[newZone]) {
      const wasEmpty = this.zones[newZone].occupants.size === 0;
      this.zones[newZone].occupants.add(personId);
      // Cancel vacancy timer if person enters/returns
      if (this.zones[newZone].vacancyStartedAt !== null) {
        this.zones[newZone].vacancyStartedAt = null;
      }
      if (wasEmpty) {
        // Fresh entry into vacant zone resets manual overrides
        this.zones[newZone].manualLight = null;
        this.zones[newZone].manualFan = null;
      }
    }

    this.recomputeApplianceStates();
    this.notify();
  }

  removePerson(personId) {
    const person = this.trackedPersons.get(personId);
    if (!person) return;

    if (this.zones[person.zone]) {
      this.zones[person.zone].occupants.delete(personId);
      if (this.zones[person.zone].occupants.size === 0) {
        this.zones[person.zone].vacancyStartedAt = Date.now();
      }
    }

    this.trackedPersons.delete(personId);
    this.recomputeApplianceStates();
    this.notify();
  }

  /**
   * Process detected hand orientation for a specific person.
   */
  processHandGesture(personId, rawOrientation) {
    const person = this.trackedPersons.get(personId);
    if (!person) return;

    const now = Date.now();

    // Stability buffer
    if (rawOrientation === GESTURE_ORIENTATIONS.PALM_FACING || rawOrientation === GESTURE_ORIENTATIONS.BACK_OF_HAND) {
      if (person.orientation === rawOrientation) {
        person.frameCount += 1;
      } else {
        person.orientation = rawOrientation;
        person.frameCount = 1;
      }
    } else {
      person.frameCount = Math.max(0, person.frameCount - 1);
      if (person.frameCount === 0) {
        person.orientation = GESTURE_ORIENTATIONS.NONE;
      }
    }

    // Trigger action when stability & cooldown met
    if (person.frameCount >= this.stabilityFrames && (now - person.lastTriggerAt) >= this.cooldownMs) {
      const zoneId = person.zone;
      const zone = this.zones[zoneId];

      if (person.orientation === GESTURE_ORIENTATIONS.PALM_FACING) {
        // Gesture A: Palm Facing Camera -> Fan OFF in that person's zone
        if (zone) zone.manualFan = 'OFF';
        person.lastTriggerAt = now;
        person.lastAction = GESTURE_ACTIONS.FAN_OFF;
      } else if (person.orientation === GESTURE_ORIENTATIONS.BACK_OF_HAND) {
        // Gesture B: Back of Hand -> Light OFF in that person's zone
        if (zone) zone.manualLight = 'OFF';
        person.lastTriggerAt = now;
        person.lastAction = GESTURE_ACTIONS.LIGHT_OFF;
      }
      this.recomputeApplianceStates();
    }

    this.notify();
  }

  tickVacancyTimers() {
    const now = Date.now();
    let stateChanged = false;

    for (const [, zData] of Object.entries(this.zones)) {
      if (zData.vacancyStartedAt !== null) {
        const elapsed = now - zData.vacancyStartedAt;
        if (elapsed >= this.vacancyTimeoutMs) {
          // 10s continuous vacancy reached: reset overrides and turn OFF
          zData.vacancyStartedAt = null;
          zData.manualLight = null;
          zData.manualFan = null;
          stateChanged = true;
        }
      }
    }

    if (stateChanged) {
      this.recomputeApplianceStates();
      this.notify();
    }
  }

  recomputeApplianceStates() {
    // 1. Calculate INDEPENDENT requested state for EVERY zone (Z1 through Z9)
    for (const [, zData] of Object.entries(this.zones)) {
      const isOccupied = zData.occupants.size > 0;
      const withinGracePeriod = zData.vacancyStartedAt !== null;

      // Independent Light Requested
      if (zData.manualLight === 'OFF') {
        zData.lightRequested = 'OFF';
        zData.lightMode = 'gesture_override';
      } else if (isOccupied || withinGracePeriod) {
        zData.lightRequested = 'ON';
        zData.lightMode = 'auto';
      } else {
        zData.lightRequested = 'OFF';
        zData.lightMode = 'auto';
      }

      // Independent Fan Requested
      if (zData.manualFan === 'OFF') {
        zData.fanRequested = 'OFF';
        zData.fanMode = 'gesture_override';
      } else if (isOccupied || withinGracePeriod) {
        zData.fanRequested = 'ON';
        zData.fanMode = 'auto';
      } else {
        zData.fanRequested = 'OFF';
        zData.fanMode = 'auto';
      }

      // If simulated, relayConfirmed tracks requested state directly
      if (zData.deviceType !== 'physical') {
        zData.relayConfirmed = zData.lightRequested === 'ON' ? 'SIMULATED_ON' : 'SIMULATED_OFF';
      }
    }

    // 2. Physical Relay Demand Arbitration
    // A physical light is ON if ANY physical zone mapped to it requests ON
    const physicalTargets = {
      'DEV-LIGHT-1': 'OFF',
      'DEV-LIGHT-2': 'OFF',
    };

    for (const [, zData] of Object.entries(this.zones)) {
      if (zData.deviceType === 'physical' && zData.lightId) {
        if (zData.lightRequested === 'ON') {
          physicalTargets[zData.lightId] = 'ON';
        }
      }
    }

    // Dispatch transitions to physical devices (Deduplicated)
    for (const [devId, targetState] of Object.entries(physicalTargets)) {
      const current = this.applianceStates[devId];
      if (current && current.state !== targetState) {
        this.dispatchApplianceState(devId, targetState);
      }
    }

    // Update relayConfirmed for physical zones
    for (const [, zData] of Object.entries(this.zones)) {
      if (zData.deviceType === 'physical') {
        zData.relayConfirmed = this.applianceStates[zData.lightId]?.state || 'OFF';
      }
    }
  }

  dispatchApplianceState(deviceId, state, mode = 'auto') {
    this.applianceStates[deviceId] = { state, mode };
    // Synchronize with existing esp32Service without blocking
    if (typeof esp32Service?.sendCommand === 'function') {
      try {
        const promise = esp32Service.sendCommand(deviceId, state);
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {});
        }
      } catch {
        // Safe synchronous fallback
      }
    }
  }
}

export const zoneGestureService = new ZoneGestureService();
export default zoneGestureService;
