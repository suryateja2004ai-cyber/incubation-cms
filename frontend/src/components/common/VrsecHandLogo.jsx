import React from 'react';

/**
 * VRSEC Hand Symbol Emblem
 * The official emblem of Velagapudi Ramakrishna Siddhartha Engineering College
 * (Siddhartha Academy of Higher Education - SAHE):
 * Depicting the open hand (Jnana Mudra) bearing the lamp of eternal knowledge (Jnana Deepam)
 * with radiant wisdom rays encased in the collegiate navy & gold seal.
 */
export default function VrsecHandLogo({ size = 36, className = '', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-label="VRSEC Official Hand Emblem"
    >
      <defs>
        {/* Outer Ring Gradients */}
        <linearGradient id="vrsecGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>

        <linearGradient id="vrsecNavy" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        <linearGradient id="flameGlow" x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="40%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fef08a" />
        </linearGradient>

        <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer Golden Border */}
      <circle cx="50" cy="50" r="48" fill="url(#vrsecGold)" stroke="#b45309" strokeWidth="1.5" />

      {/* Inner Collegiate Navy Field */}
      <circle cx="50" cy="50" r="43" fill="url(#vrsecNavy)" stroke="#fbbf24" strokeWidth="1" />

      {/* Radiant Wisdom Sunburst Rays (Behind Hand & Lamp) */}
      <g stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" opacity="0.65">
        <line x1="50" y1="12" x2="50" y2="18" />
        <line x1="32" y1="17" x2="36" y2="22" />
        <line x1="68" y1="17" x2="64" y2="22" />
        <line x1="18" y1="30" x2="24" y2="33" />
        <line x1="82" y1="30" x2="76" y2="33" />
      </g>

      {/* Sacred Jnana Deepam (Lamp of Knowledge) Rising from the Palm */}
      {/* Flame */}
      <path
        d="M50 14 C46 22 43 27 46 32 C48 35 52 35 54 32 C57 27 54 22 50 14 Z"
        fill="url(#flameGlow)"
        filter="url(#subtleGlow)"
      />
      {/* Inner White Flame Core */}
      <path
        d="M50 20 C48 24 47 27 48.5 29.5 C49.5 31 50.5 31 51.5 29.5 C53 27 52 24 50 20 Z"
        fill="#ffffff"
      />
      {/* Diya / Oil Bowl on Palm */}
      <path
        d="M39 33 C39 33 42 37 50 37 C58 37 61 33 61 33 C61 33 58 40 50 40 C42 40 39 33 39 33 Z"
        fill="url(#vrsecGold)"
        stroke="#d97706"
        strokeWidth="0.8"
      />

      {/* THE VRSEC HAND SYMBOL (Abhaya & Jnana Mudra - Palm facing forward, fingers reaching up) */}
      {/* Wrist / Forearm */}
      <path
        d="M43 85 L43 72 C43 68 44 64 42 58 L37 53 C35.5 51.5 36.5 48.5 39 49 C41 49.5 43 51 44 53 L45 54 L45 42 C45 40 47.5 40 47.5 42 L47.5 52 L48.5 52 L48.5 39 C48.5 37 51 37 51 39 L51 52 L52 52 L52 41 C52 39 54.5 39 54.5 41 L54.5 53 L55.5 53 L55.5 44 C55.5 42 58 42 58 44 L58 58 C58 63 56 68 56 72 L56 85 Z"
        fill="#ffffff"
        stroke="#f59e0b"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Palm Detail Lines */}
      <path
        d="M44 58 C47 62 53 62 55 58"
        stroke="#d97706"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <path
        d="M46 64 C48 67 52 67 54 64"
        stroke="#d97706"
        strokeWidth="0.8"
        strokeLinecap="round"
      />

      {/* Golden Lotus Petals / Foundation Ring at Base */}
      <path
        d="M30 83 C35 79 43 78 50 78 C57 78 65 79 70 83 C66 87 58 89 50 89 C42 89 34 87 30 83 Z"
        fill="url(#vrsecGold)"
        stroke="#b45309"
        strokeWidth="1"
      />

      {/* VRSEC Text Ribbon Arc on Bottom */}
      <text
        x="50"
        y="86"
        fill="#1e3a8a"
        fontSize="6.5"
        fontWeight="800"
        textAnchor="middle"
        fontFamily="'Inter', 'Arial', sans-serif"
        letterSpacing="1.2px"
      >
        VRSEC
      </text>
    </svg>
  );
}
