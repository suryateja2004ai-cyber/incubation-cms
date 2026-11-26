// src/components/zones/ZoneGestureMonitor.jsx
// Interactive 3x3 Zone-Based Hand Gesture & Independent Appliance Monitoring Dashboard
// Features: Independent Zone-wise Light/Fan States (Z1-Z9), Distinction between Physical
// Relays (GPIO22/GPIO23) and Simulated Zones, Non-Blocking 10s Vacancy, and Palm/Back Gestures.

import React, { useState, useEffect } from 'react';
import {
  Eye,
  Hand,
  Lightbulb,
  Fan,
  Users,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Cpu,
  Tv,
} from 'lucide-react';
import zoneGestureService, {
  GESTURE_ORIENTATIONS,
  GESTURE_ACTIONS,
  DEFAULT_ZONE_MAPPING,
} from '../../services/esp32/zoneGestureService.js';

export default function ZoneGestureMonitor() {
  const [telemetry, setTelemetry] = useState(zoneGestureService.getTelemetrySnapshot());
  const [selectedPersonId, setSelectedPersonId] = useState('P-1');

  useEffect(() => {
    const unsubscribe = zoneGestureService.subscribe((snapshot) => {
      setTelemetry(snapshot);
    });
    return () => unsubscribe();
  }, []);

  const { zones, persons, appliances } = telemetry;

  // Simulation test handlers
  const handleSimulateEnter = (zId) => {
    zoneGestureService.updatePersonPresence(selectedPersonId, zId);
  };

  const handleSimulateRemove = () => {
    zoneGestureService.removePerson(selectedPersonId);
  };

  const handleSimulateGesture = (orientation) => {
    for (let i = 0; i < 5; i++) {
      zoneGestureService.processHandGesture(selectedPersonId, orientation);
    }
  };

  return (
    <div
      className="card"
      style={{
        marginBottom: '1.5rem',
        border: '1px solid var(--neutral-200)',
        boxShadow: 'var(--shadow-sm)',
        borderRadius: 'var(--radius-lg)',
        background: '#ffffff',
      }}
    >
      {/* Header */}
      <div className="card-header flex-between" style={{ borderBottom: '1px solid var(--neutral-100)', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Hand size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--neutral-900)' }}>
              Independent 3×3 Zone-Based Appliance & Gesture Control
            </h3>
            <p className="text-muted" style={{ fontSize: '0.78rem', margin: 0 }}>
              Independent light/fan demand per zone • Physical Relays: GPIO22 (Light 1) &amp; GPIO23 (Light 2) • Simulated Zones: Z2, Z4–Z9.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {telemetry.isLiveConnected ? (
            <span className="badge badge-success text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sparkles size={12} /> Live CV Controller ({telemetry.fps} FPS)
            </span>
          ) : (
            <span className="badge badge-warning text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={12} /> CV Standby (Independent Sim Mode)
            </span>
          )}
          <span className="badge badge-primary text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Cpu size={12} /> 2 Physical Relays (Active HIGH)
          </span>
          <span className="badge badge-success text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={12} /> 10s Non-Blocking Vacancy
          </span>
        </div>
      </div>

      <div className="card-body" style={{ padding: '1.25rem' }}>
        {/* Main Grid & Telemetry Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* 1. 3x3 Grid Visualizer with Independent Status */}
          <div>
            <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--neutral-700)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Eye size={15} /> 3×3 Zone Matrix (Independent Zone States)
              </h4>
              <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                Click zone to simulate person
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem',
                aspectRatio: '4/3',
                background: '#f8fafc',
                padding: '0.6rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--neutral-200)',
              }}
            >
              {Object.values(zones || {}).map((z) => {
                const isOccupied = z.occupants && z.occupants.length > 0;
                const hasVacancyTimer = z.vacancyRemainingSec > 0;
                const isLightOn = z.lightRequested === 'ON';
                const isFanOn = z.fanRequested === 'ON';
                const isPhysical = z.deviceType === 'physical';

                return (
                  <div
                    key={z.id}
                    onClick={() => handleSimulateEnter(z.id)}
                    style={{
                      borderRadius: 'var(--radius-sm)',
                      border: isOccupied
                        ? '2px solid #0284c7'
                        : hasVacancyTimer
                        ? '2px dashed #f59e0b'
                        : '1px solid #cbd5e1',
                      background: isOccupied
                        ? '#f0f9ff'
                        : hasVacancyTimer
                        ? '#fffbeb'
                        : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '0.45rem',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.15s ease',
                    }}
                    title={`Click to simulate person in ${z.id}`}
                  >
                    {/* Zone Header & Type Badge */}
                    <div className="flex-between">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: isOccupied ? '#0369a1' : '#334155' }}>
                          {z.id}
                        </span>
                        <span
                          style={{
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            padding: '0.05rem 0.25rem',
                            borderRadius: '3px',
                            background: isPhysical ? '#dbeafe' : '#f1f5f9',
                            color: isPhysical ? '#1d4ed8' : '#64748b',
                            border: isPhysical ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                          }}
                        >
                          {isPhysical ? `GPIO ${z.physicalPin}` : 'SIM'}
                        </span>
                      </div>
                      {isOccupied && (
                        <span className="badge badge-primary text-xs" style={{ padding: '0.1rem 0.3rem', fontSize: '0.62rem' }}>
                          {z.occupants.length} Occ
                        </span>
                      )}
                    </div>

                    {/* Independent Appliance States for THIS zone */}
                    <div style={{ marginTop: '0.2rem', marginBottom: '0.2rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: isLightOn ? '#15803d' : '#94a3b8',
                        }}
                      >
                        <Lightbulb size={12} />
                        <span>Light: {isLightOn ? 'ON' : 'OFF'}</span>
                        {z.lightMode === 'gesture_override' && (
                          <span style={{ fontSize: '0.55rem', color: '#b45309' }}>(Ovr)</span>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          color: isFanOn ? '#0284c7' : '#94a3b8',
                        }}
                      >
                        <Fan size={11} />
                        <span>Fan: {isFanOn ? 'ON' : 'OFF'}</span>
                        {z.fanMode === 'gesture_override' && (
                          <span style={{ fontSize: '0.55rem', color: '#b45309' }}>(Ovr)</span>
                        )}
                      </div>
                    </div>

                    {/* Footer / Vacancy countdown */}
                    {hasVacancyTimer ? (
                      <div
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          color: '#b45309',
                          background: '#fef3c7',
                          padding: '0.1rem 0.2rem',
                          borderRadius: '3px',
                          textAlign: 'center',
                        }}
                      >
                        ⏳ {z.vacancyRemainingSec}s grace
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.62rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isOccupied ? z.occupants.join(', ') : 'Vacant'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-muted" style={{ fontSize: '0.72rem', marginTop: '0.4rem' }}>
              💡 Each tile reflects its own independent requested state. Only Z1 and Z3 actuate physical relays.
            </p>
          </div>

          {/* 2. Live Person & Gesture Telemetry */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--neutral-700)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Users size={15} /> Person Tracking & Gesture Telemetry
            </h4>

            {persons.length === 0 ? (
              <div
                style={{
                  padding: '1.25rem',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed #cbd5e1',
                  color: 'var(--neutral-500)',
                  fontSize: '0.85rem',
                }}
              >
                No persons currently tracked in webcam view. Click a zone on the left or use sandbox buttons below.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {persons.map((p) => {
                  const zInfo = zones[p.zone];
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '0.65rem 0.75rem',
                        border: '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-md)',
                        background: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem',
                      }}
                    >
                      <div className="flex-between">
                        <span style={{ fontWeight: 700, color: 'var(--neutral-900)', fontSize: '0.88rem' }}>
                          👤 Track ID: {p.id}
                        </span>
                        <span className="badge badge-info text-xs">Occupying {p.zone}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', fontSize: '0.76rem' }}>
                        <div>
                          <strong className="text-muted">Hand Orientation:</strong>{' '}
                          <span
                            style={{
                              fontWeight: 600,
                              color:
                                p.orientation === GESTURE_ORIENTATIONS.PALM_FACING
                                  ? '#0284c7'
                                  : p.orientation === GESTURE_ORIENTATIONS.BACK_OF_HAND
                                  ? '#eab308'
                                  : 'var(--neutral-600)',
                            }}
                          >
                            {p.orientation === GESTURE_ORIENTATIONS.PALM_FACING
                              ? '🖐️ Palm Facing'
                              : p.orientation === GESTURE_ORIENTATIONS.BACK_OF_HAND
                              ? '🤚 Back of Hand'
                              : 'None / Uncertain'}
                          </span>
                        </div>
                        <div>
                          <strong className="text-muted">Gesture Action:</strong>{' '}
                          <span style={{ fontWeight: 600 }}>
                            {p.lastAction === GESTURE_ACTIONS.FAN_OFF
                              ? '⚡ Fan OFF (Zone)'
                              : p.lastAction === GESTURE_ACTIONS.LIGHT_OFF
                              ? '⚡ Light OFF (Zone)'
                              : 'Idle'}
                          </span>
                        </div>
                        <div>
                          <strong className="text-muted">Zone Device Type:</strong>{' '}
                          <span style={{ fontWeight: 600, color: zInfo?.deviceType === 'physical' ? '#1d4ed8' : '#64748b' }}>
                            {zInfo?.deviceType === 'physical' ? `Physical (GPIO ${zInfo?.physicalPin})` : 'Simulated'}
                          </span>
                        </div>
                        <div>
                          <strong className="text-muted">Stability:</strong>{' '}
                          <span>{p.frameCount} / 5 frames</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Interactive Testing Sandbox Toolbar */}
            <div
              style={{
                marginTop: '0.85rem',
                padding: '0.75rem',
                background: '#f1f5f9',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--neutral-800)' }}>
                🛠️ Hardware & Independent Zone Test Sandbox
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleSimulateEnter('Z1')}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                >
                  Enter Z1 (Relay 1 ON)
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleSimulateEnter('Z3')}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                >
                  Enter Z3 (Relay 2 ON)
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleSimulateEnter('Z2')}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                >
                  Enter Z2 (Simulated)
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={handleSimulateRemove}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem', color: '#b91c1c' }}
                >
                  Vacate (10s Timer)
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => handleSimulateGesture(GESTURE_ORIENTATIONS.PALM_FACING)}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                >
                  🖐️ Palm (Fan OFF)
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => handleSimulateGesture(GESTURE_ORIENTATIONS.BACK_OF_HAND)}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                >
                  🤚 Back (Light OFF)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Comprehensive Zone-wise & Physical Relay Status Table */}
        <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--neutral-200)', paddingTop: '1rem' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--neutral-700)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Cpu size={15} /> Independent Zone-Wise State vs. Physical Hardware Relays
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--neutral-200)' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Zone ID</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Hardware Classification</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Occupancy</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Zone Light Requested</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Zone Fan Requested</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>ESP32 Relay Status</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>10s Vacancy Timer</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(zones || {}).map((z) => {
                  const isOcc = z.occupants && z.occupants.length > 0;
                  const isLightOn = z.lightRequested === 'ON';
                  const isFanOn = z.fanRequested === 'ON';
                  const isPhysical = z.deviceType === 'physical';

                  return (
                    <tr key={z.id} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                      <td style={{ padding: '0.45rem 0.5rem', fontWeight: 700 }}>{z.id}</td>
                      <td style={{ padding: '0.45rem 0.5rem' }}>
                        {isPhysical ? (
                          <span className="badge badge-primary text-xs">
                            Physical Light {z.id === 'Z1' ? '1 (GPIO 22)' : '2 (GPIO 23)'}
                          </span>
                        ) : (
                          <span className="badge badge-secondary text-xs" style={{ background: '#f1f5f9', color: '#64748b' }}>
                            Simulated Zone
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem' }}>
                        {isOcc ? (
                          <span style={{ color: '#15803d', fontWeight: 600 }}>
                            ● Person Detected ({z.occupants.join(', ')})
                          </span>
                        ) : z.vacancyRemainingSec > 0 ? (
                          <span style={{ color: '#b45309', fontWeight: 600 }}>
                            ⏳ Vacated (Grace Active)
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>○ Empty</span>
                        )}
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            background: isLightOn ? '#dcfce7' : '#f1f5f9',
                            color: isLightOn ? '#15803d' : '#64748b',
                          }}
                        >
                          {isLightOn ? 'ON' : 'OFF'} {z.lightMode === 'gesture_override' ? '(Override)' : ''}
                        </span>
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem' }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: isFanOn ? '#0284c7' : '#94a3b8',
                          }}
                        >
                          {isFanOn ? 'ON' : 'OFF'} {z.fanMode === 'gesture_override' ? '(Override)' : ''}
                        </span>
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem' }}>
                        {isPhysical ? (
                          <span
                            style={{
                              fontWeight: 700,
                              color: z.relayConfirmed === 'ON' ? '#15803d' : '#64748b',
                            }}
                          >
                            {z.relayConfirmed === 'ON' ? '⚡ RELAY ACTIVE (HIGH)' : '○ RELAY IDLE (LOW)'}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            Simulated ({isLightOn ? 'Active' : 'Idle'})
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem' }}>
                        {z.vacancyRemainingSec > 0 ? (
                          <span style={{ color: '#b45309', fontWeight: 700 }}>
                            {z.vacancyRemainingSec}s remaining
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Inactive</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
