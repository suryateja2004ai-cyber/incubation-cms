// src/components/biometrics/HeadPoseGuide.jsx
// Lightweight 3D-Style Animated Human Head Illustration for Biometric Face Registration
// Accurately demonstrates head movement from the student's own perspective:
// - Stage 1 (Straight): Neutral forward-facing head with center reticle
// - Stage 2 (Turn Left): Head animates turning toward the student's own LEFT (screen left <-) with curved arrow
// - Stage 3 (Turn Right): Head animates turning toward the student's own RIGHT (screen right ->) with curved arrow

import React from 'react';
import {
  CheckCircle2,
  Compass,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function HeadPoseGuide({
  targetPose = 'straight',
  currentStep = 1,
  poseCorrect = false,
  feedback = '',
  capturedInStep = 0,
  neededInStep = 6,
}) {
  // Normalize pose detection
  const isLeft = targetPose === 'slight_left' || targetPose === 'left' || currentStep === 2;
  const isRight = targetPose === 'slight_right' || targetPose === 'right' || currentStep === 3;
  const isStraight = !isLeft && !isRight;

  let activeMode = 'straight';
  let instruction = 'Look straight at the camera';
  let directionHint = 'Face directly forward';

  if (isLeft) {
    activeMode = 'left';
    instruction = 'Slowly turn your head slightly to your left';
    directionHint = 'Turn toward your LEFT shoulder (←)';
  } else if (isRight) {
    activeMode = 'right';
    instruction = 'Slowly turn your head slightly to your right';
    directionHint = 'Turn toward your RIGHT shoulder (→)';
  }

  return (
    <div
      className="head-pose-guide-card"
      data-testid="head-pose-guide"
      style={{
        background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: 'var(--radius-md, 10px)',
        border: `2px solid ${poseCorrect ? '#22c55e' : '#3b82f6'}`,
        boxShadow: poseCorrect
          ? '0 0 20px rgba(34, 197, 94, 0.25)'
          : '0 0 20px rgba(59, 130, 246, 0.2)',
        padding: '0.85rem',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        minWidth: '260px',
        flex: '1 1 260px',
        transition: 'all 0.3s ease',
      }}
    >
      <style>{`
        @keyframes headTurnLeftDemo {
          0%, 100% {
            transform: perspective(500px) rotateY(0deg);
          }
          40%, 75% {
            transform: perspective(500px) rotateY(-28deg);
          }
        }

        @keyframes headTurnRightDemo {
          0%, 100% {
            transform: perspective(500px) rotateY(0deg);
          }
          40%, 75% {
            transform: perspective(500px) rotateY(28deg);
          }
        }

        @keyframes headStraightIdle {
          0%, 100% {
            transform: perspective(500px) rotateY(0deg) scale(1);
          }
          50% {
            transform: perspective(500px) rotateY(0deg) scale(1.02);
          }
        }

        @keyframes arrowPulseLeft {
          0%, 100% {
            opacity: 0.3;
            transform: translateX(4px);
          }
          50% {
            opacity: 1;
            transform: translateX(-4px);
          }
        }

        @keyframes arrowPulseRight {
          0%, 100% {
            opacity: 0.3;
            transform: translateX(-4px);
          }
          50% {
            opacity: 1;
            transform: translateX(4px);
          }
        }

        @keyframes reticlePulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
          }
        }
      `}</style>

      {/* Top Header: Step Indicator Pills */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.35rem',
          marginBottom: '0.6rem',
        }}
      >
        <span
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          <Compass size={13} style={{ color: '#38bdf8' }} /> Motion Guide
        </span>

        {/* 3 Steps Pills */}
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.15rem 0.45rem',
              borderRadius: '9999px',
              background: currentStep === 1 ? (poseCorrect ? '#15803d' : '#2563eb') : currentStep > 1 ? '#334155' : '#1e293b',
              color: currentStep === 1 ? '#ffffff' : currentStep > 1 ? '#86efac' : '#64748b',
              border: `1px solid ${currentStep === 1 ? (poseCorrect ? '#4ade80' : '#60a5fa') : 'transparent'}`,
            }}
          >
            {currentStep > 1 ? '✓ Straight' : '1. Straight'}
          </span>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.15rem 0.45rem',
              borderRadius: '9999px',
              background: currentStep === 2 ? (poseCorrect ? '#15803d' : '#2563eb') : currentStep > 2 ? '#334155' : '#1e293b',
              color: currentStep === 2 ? '#ffffff' : currentStep > 2 ? '#86efac' : '#64748b',
              border: `1px solid ${currentStep === 2 ? (poseCorrect ? '#4ade80' : '#60a5fa') : 'transparent'}`,
            }}
          >
            {currentStep > 2 ? '✓ Left' : '2. Left'}
          </span>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.15rem 0.45rem',
              borderRadius: '9999px',
              background: currentStep === 3 ? (poseCorrect ? '#15803d' : '#2563eb') : '#1e293b',
              color: currentStep === 3 ? '#ffffff' : '#64748b',
              border: `1px solid ${currentStep === 3 ? (poseCorrect ? '#4ade80' : '#60a5fa') : 'transparent'}`,
            }}
          >
            3. Right
          </span>
        </div>
      </div>

      {/* Center Display: Animated 3D-Style Head Graphic */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
        }}
      >
        {/* Dynamic Curved Direction Indicator Arrow */}
        {activeMode === 'left' && (
          <div
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'arrowPulseLeft 1.5s infinite ease-in-out',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.25)',
                border: '2px solid #60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#93c5fd',
                boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)',
              }}
            >
              <ArrowLeft size={20} />
            </div>
            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#93c5fd', marginTop: '3px' }}>
              YOUR LEFT
            </span>
          </div>
        )}

        {activeMode === 'right' && (
          <div
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'arrowPulseRight 1.5s infinite ease-in-out',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.25)',
                border: '2px solid #60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#93c5fd',
                boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)',
              }}
            >
              <ArrowRight size={20} />
            </div>
            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#93c5fd', marginTop: '3px' }}>
              YOUR RIGHT
            </span>
          </div>
        )}

        {/* Forward Facing Indicator Ring (Stage 1) */}
        {activeMode === 'straight' && (
          <div
            style={{
              position: 'absolute',
              width: 140,
              height: 140,
              borderRadius: '50%',
              border: `2px dashed ${poseCorrect ? '#22c55e' : '#38bdf8'}`,
              animation: 'reticlePulse 2s infinite ease-in-out',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        )}

        {/* 3D Head Canvas Container */}
        <div
          style={{
            width: 130,
            height: 155,
            position: 'relative',
            transformOrigin: '50% 60%',
            animation:
              activeMode === 'left'
                ? 'headTurnLeftDemo 3s infinite ease-in-out'
                : activeMode === 'right'
                ? 'headTurnRightDemo 3s infinite ease-in-out'
                : 'headStraightIdle 4s infinite ease-in-out',
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: poseCorrect
              ? 'drop-shadow(0 0 12px rgba(34, 197, 94, 0.6))'
              : 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.4))',
          }}
        >
          <svg
            viewBox="0 0 140 170"
            width="100%"
            height="100%"
            style={{ overflow: 'visible' }}
          >
            <defs>
              {/* Head skin 3D gradient */}
              <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fde047" stopOpacity="0.9" />
                <stop offset="35%" stopColor="#f59e0b" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>

              {/* Shading gradient for 3D depth */}
              <linearGradient id="shadeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0.25" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
              </linearGradient>

              {/* Hair gradient */}
              <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
            </defs>

            {/* Neck */}
            <path
              d="M 54 130 L 54 165 C 54 168 86 168 86 165 L 86 130 Z"
              fill="#b45309"
            />

            {/* Left Ear (Viewer Left = Student's Left in mirrored model) */}
            <ellipse
              cx="22"
              cy="88"
              rx="6"
              ry="11"
              fill="#d97706"
              stroke="#b45309"
              strokeWidth="1.5"
            />
            {/* Right Ear */}
            <ellipse
              cx="118"
              cy="88"
              rx="6"
              ry="11"
              fill="#d97706"
              stroke="#b45309"
              strokeWidth="1.5"
            />

            {/* Head Silhouette Base */}
            <path
              d="M 30 75 C 30 35, 110 35, 110 75 C 110 115, 88 140, 70 140 C 52 140, 30 115, 30 75 Z"
              fill="url(#skinGrad)"
              stroke="#b45309"
              strokeWidth="2"
            />

            {/* 3D Depth Overlay */}
            <path
              d="M 30 75 C 30 35, 110 35, 110 75 C 110 115, 88 140, 70 140 C 52 140, 30 115, 30 75 Z"
              fill="url(#shadeGrad)"
            />

            {/* Hair Cap */}
            <path
              d="M 28 65 C 28 25, 112 25, 112 65 C 105 45, 95 38, 70 38 C 45 38, 35 45, 28 65 Z"
              fill="url(#hairGrad)"
            />

            {/* Eyebrows */}
            <path
              d="M 44 68 Q 54 64 62 67"
              stroke="#451a03"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 78 67 Q 86 64 96 68"
              stroke="#451a03"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />

            {/* Eyes */}
            <ellipse cx="53" cy="76" rx="5" ry="4" fill="#1e293b" />
            <circle cx="54.5" cy="74.5" r="1.5" fill="#ffffff" />

            <ellipse cx="87" cy="76" rx="5" ry="4" fill="#1e293b" />
            <circle cx="88.5" cy="74.5" r="1.5" fill="#ffffff" />

            {/* Nose: Stylized 3D bridge & tip */}
            <path
              d="M 70 72 L 67 96 L 74 96 Z"
              fill="#b45309"
              opacity="0.8"
            />
            <ellipse cx="70" cy="96" rx="5.5" ry="3" fill="#92400e" />

            {/* Mouth */}
            <path
              d="M 58 114 Q 70 120 82 114"
              stroke="#92400e"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Cheek glow */}
            <circle cx="43" cy="94" r="5" fill="#f43f5e" opacity="0.25" />
            <circle cx="97" cy="94" r="5" fill="#f43f5e" opacity="0.25" />

            {/* Target Reticle Forward Marker when in Stage 1 */}
            {activeMode === 'straight' && (
              <g opacity={poseCorrect ? '0.9' : '0.6'}>
                <line x1="70" y1="50" x2="70" y2="60" stroke={poseCorrect ? '#22c55e' : '#38bdf8'} strokeWidth="2" strokeLinecap="round" />
                <line x1="70" y1="126" x2="70" y2="136" stroke={poseCorrect ? '#22c55e' : '#38bdf8'} strokeWidth="2" strokeLinecap="round" />
                <line x1="26" y1="88" x2="36" y2="88" stroke={poseCorrect ? '#22c55e' : '#38bdf8'} strokeWidth="2" strokeLinecap="round" />
                <line x1="104" y1="88" x2="114" y2="88" stroke={poseCorrect ? '#22c55e' : '#38bdf8'} strokeWidth="2" strokeLinecap="round" />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Bottom Instructions Card */}
      <div
        style={{
          width: '100%',
          textAlign: 'center',
          marginTop: '0.5rem',
          padding: '0.45rem 0.6rem',
          borderRadius: 'var(--radius-sm, 6px)',
          background: poseCorrect ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          border: `1px solid ${poseCorrect ? 'rgba(34, 197, 94, 0.4)' : 'rgba(59, 130, 246, 0.3)'}`,
        }}
      >
        <div
          style={{
            fontSize: '0.86rem',
            fontWeight: 800,
            color: poseCorrect ? '#86efac' : '#93c5fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
          }}
        >
          {poseCorrect ? (
            <>
              <CheckCircle2 size={16} style={{ color: '#4ade80' }} />
              <span>Pose Correct! Hold still...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} style={{ color: '#38bdf8' }} />
              <span>{instruction}</span>
            </>
          )}
        </div>

        <div
          style={{
            fontSize: '0.72rem',
            color: '#cbd5e1',
            marginTop: '0.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
          }}
        >
          <span>{directionHint}</span>
          <span style={{ color: '#64748b' }}>•</span>
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>
            {capturedInStep} / {neededInStep} captured
          </span>
        </div>
      </div>
    </div>
  );
}
