// src/components/tour/GuidedTourOverlay.jsx
// Spotlight backdrop overlay highlighting active target element
// Leaves target element interactive and accessible to real clicks and inputs

import React from 'react';

export default function GuidedTourOverlay({ targetRect, isTourActive }) {
  if (!isTourActive) return null;

  // If target element is not found yet, show light neutral overlay
  if (!targetRect) {
    return (
      <div
        className="tour-overlay-backdrop-fallback"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          zIndex: 99990,
          pointerEvents: 'none',
          transition: 'opacity 0.25s ease',
        }}
      />
    );
  }

  // Spotlight box exactly around targetRect with generous padding
  const pad = 6;
  const top = Math.max(0, targetRect.top - pad);
  const left = Math.max(0, targetRect.left - pad);
  const width = targetRect.width + pad * 2;
  const height = targetRect.height + pad * 2;

  return (
    <div
      className="tour-spotlight"
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: '10px',
        boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.65), 0 0 20px rgba(99, 102, 241, 0.65)',
        border: '2px solid #6366f1',
        zIndex: 99990,
        pointerEvents: 'none',
        transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
      }}
    >
      <span className="tour-spotlight-pulse" />
      <style>{`
        @keyframes tourSpotlightPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(99, 102, 241, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
          }
        }
        .tour-spotlight-pulse {
          position: absolute;
          inset: -3px;
          border-radius: 12px;
          border: 2px solid rgba(99, 102, 241, 0.8);
          animation: tourSpotlightPulse 2s infinite;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
