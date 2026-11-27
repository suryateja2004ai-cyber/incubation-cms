// src/components/common/TrafficQueueModal.jsx
// Virtual Waiting Room & Peak Traffic Access Queue

import React, { useState, useEffect } from 'react';
import { Clock, Shield, Users, Sparkles, RefreshCw, Layers } from 'lucide-react';
import VrsecHandLogo from './VrsecHandLogo';

export default function TrafficQueueModal({ queueState, onBypassAdmin }) {
  const { position, estimatedWaitSeconds, queueLength, activeUsers } = queueState || {};
  const [secondsLeft, setSecondsLeft] = useState(estimatedWaitSeconds || 10);

  useEffect(() => {
    setSecondsLeft(estimatedWaitSeconds || 10);
  }, [estimatedWaitSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        animation: 'fadeIn 0.25s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#ffffff',
          borderRadius: '16px',
          padding: '2rem 1.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Top Header Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <VrsecHandLogo size={52} />
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem' }}>
          VRSEC Incubation Centre
        </h2>
        <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '0 0 1.5rem' }}>
          Virtual Traffic Waiting Room • High Concurrency Protection
        </p>

        {/* Live Queue Counter Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid #c7d2fe',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Your Position in Line
          </div>
          <div style={{ fontSize: '3.2rem', fontWeight: 900, color: '#312e81', lineHeight: 1.1, margin: '0.35rem 0' }}>
            #{position || 1}
          </div>
          <div style={{ fontSize: '0.84rem', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
            <Clock size={15} className="text-indigo-600" />
            Estimated wait: <strong>~{secondsLeft}s</strong>
          </div>
        </div>

        {/* Live Telemetry Info */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            textAlign: 'left',
          }}
        >
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Active Lab Users</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{activeUsers || 42} Online</div>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Queue Length</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4f46e5' }}>{queueLength || 1} Waiting</div>
          </div>
        </div>

        {/* Informative Note */}
        <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
          To ensure reliable database speed and uninterrupted attendance tracking for all 1,400+ students, new visitors are smoothly queued. You will be automatically admitted as soon as your turn arrives.
        </p>

        {onBypassAdmin && (
          <button
            type="button"
            onClick={onBypassAdmin}
            style={{
              marginTop: '1rem',
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.72rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Admin / Faculty Priority Access
          </button>
        )}
      </div>
    </div>
  );
}
