// src/components/tour/GuidedTourPointer.jsx
// Animated Hand Pointer with Smooth Pointing & Tapping Keyframes
// Points directly to the target element without blocking user interactions

import React from 'react';

export default function GuidedTourPointer({ targetRect, placement = 'bottom' }) {
  if (!targetRect) return null;

  // Calculate pointer anchor position based on target rect and preferred placement
  let x = targetRect.left + targetRect.width / 2;
  let y = targetRect.top + targetRect.height / 2;
  let rotation = 0;
  let transformOrigin = 'center';

  if (placement === 'bottom') {
    // Pointer is below element pointing UP
    x = targetRect.left + Math.min(targetRect.width / 2, 40);
    y = targetRect.bottom + 12;
    rotation = -45; // Pointing upwards-left
  } else if (placement === 'top') {
    // Pointer is above element pointing DOWN
    x = targetRect.left + Math.min(targetRect.width / 2, 40);
    y = targetRect.top - 58;
    rotation = 135; // Pointing downwards-right
  } else if (placement === 'right') {
    // Pointer is to the right pointing LEFT
    x = targetRect.right + 12;
    y = targetRect.top + Math.min(targetRect.height / 2, 24);
    rotation = -90; // Pointing left
  } else if (placement === 'left') {
    // Pointer is to the left pointing RIGHT
    x = targetRect.left - 58;
    y = targetRect.top + Math.min(targetRect.height / 2, 24);
    rotation = 90; // Pointing right
  }

  return (
    <div
      className="tour-pointer-container"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 99998,
        pointerEvents: 'none',
        transition: 'left 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
    >
      <div
        className="tour-pointer-inner"
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: transformOrigin,
        }}
      >
        {/* Pulsing indicator ring at index finger tip */}
        <span className="tour-pointer-pulse" />

        {/* Realistic Animated Hand Pointer SVG */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="tour-pointer-hand"
          style={{
            filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15))',
          }}
        >
          {/* Index Finger pointing forward */}
          <path
            d="M9 11V4C9 2.89543 9.89543 2 11 2C12.1046 2 13 2.89543 13 4V11"
            fill="#facc15"
            stroke="#b45309"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Palm and curled fingers */}
          <path
            d="M13 8C13 7.44772 13.4477 7 14 7C14.5523 7 15 7.44772 15 8V11.5M15 9C15 8.44772 15.4477 8 16 8C16.5523 8 17 8.44772 17 9V12M17 10.5C17 10.2239 17.2239 10 17.5 10C17.7761 10 18 10.2239 18 10.5V15C18 18.3137 15.3137 21 12 21H10C7.23858 21 5 18.7614 5 16V13.5C5 12.6716 5.67157 12 6.5 12C7.32843 12 8 12.6716 8 13.5V11"
            fill="#fde047"
            stroke="#b45309"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Subtle wrist cuff */}
          <rect
            x="7"
            y="20.5"
            width="8"
            height="2.5"
            rx="1"
            fill="#4f46e5"
            stroke="#3730a3"
            strokeWidth="1"
          />
        </svg>
      </div>

      <style>{`
        @keyframes tourTapBounce {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-4px, -6px) scale(0.96);
          }
        }

        @keyframes tourPulseRing {
          0% {
            transform: scale(0.4);
            opacity: 0.9;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }

        .tour-pointer-inner {
          position: relative;
          display: inline-block;
          animation: tourTapBounce 1.4s ease-in-out infinite;
        }

        .tour-pointer-pulse {
          position: absolute;
          top: 0;
          left: 10px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: rgba(79, 70, 229, 0.45);
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.6);
          animation: tourPulseRing 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
}
