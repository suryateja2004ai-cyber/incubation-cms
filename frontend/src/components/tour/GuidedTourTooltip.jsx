// src/components/tour/GuidedTourTooltip.jsx
// Floating instruction panel anchored near the highlighted target element
// Includes step indicators, action directions, navigation controls, and mandatory exit dialog

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Pause,
  AlertTriangle,
  GraduationCap,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export default function GuidedTourTooltip({
  currentStep,
  currentStepIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrevious,
  onSkip,
  onPause,
  onRequestExit,
  isConfirmingExit,
  onConfirmExit,
  onCancelExit,
  safeLearningMode = false,
}) {
  if (!currentStep) return null;

  // Compute position relative to viewport
  const cardWidth = 380;
  let top = 100;
  let left = 100;
  const placement = currentStep.placement || 'bottom';

  if (targetRect) {
    if (placement === 'bottom') {
      top = targetRect.bottom + 18;
      left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
    } else if (placement === 'top') {
      top = targetRect.top - 240;
      left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
    } else if (placement === 'right') {
      top = targetRect.top;
      left = targetRect.right + 20;
    } else if (placement === 'left') {
      top = targetRect.top;
      left = targetRect.left - cardWidth - 20;
    }

    // Viewport clamping
    if (typeof window !== 'undefined') {
      const pad = 16;
      left = Math.max(pad, Math.min(window.innerWidth - cardWidth - pad, left));
      top = Math.max(pad, Math.min(window.innerHeight - 300, top));
    }
  } else {
    // Center of screen if target is loading/transitioning
    if (typeof window !== 'undefined') {
      left = Math.max(16, (window.innerWidth - cardWidth) / 2);
      top = Math.max(80, (window.innerHeight - 260) / 2);
    }
  }

  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <>
      {/* Active Instruction Tooltip Card */}
      <div
        className="tour-tooltip-card"
        style={{
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          width: `${cardWidth}px`,
          maxWidth: 'calc(100vw - 32px)',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 35px -8px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(15, 23, 42, 0.08)',
          zIndex: 99999,
          padding: '1.25rem',
          transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {/* Top Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: '#e0e7ff',
                color: '#3730a3',
                fontSize: '0.74rem',
                fontWeight: 800,
                padding: '0.2rem 0.6rem',
                borderRadius: 999,
                letterSpacing: '0.02em',
              }}
            >
              <Sparkles size={12} />
              STEP {currentStepIndex + 1} OF {totalSteps}
            </span>

            {(safeLearningMode || currentStep.safeDemoNotice) && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: 999,
                }}
                title="Safe Demonstration: Real database records will not be modified"
              >
                <GraduationCap size={12} />
                Safe Learning
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              className="btn-icon"
              onClick={onPause}
              title="Pause tutorial"
              style={{ width: 28, height: 28, borderRadius: 6 }}
            >
              <Pause size={14} />
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={onRequestExit}
              title="Exit tour at any time"
              style={{ width: 28, height: 28, borderRadius: 6, color: 'var(--danger)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Title & Subtitle */}
        <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--neutral-900)', marginBottom: '0.2rem' }}>
          {currentStep.title}
        </h4>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.65rem' }}>
          {currentStep.subtitle}
        </div>

        {/* Clear Explanation */}
        <p style={{ fontSize: '0.88rem', color: 'var(--neutral-700)', lineHeight: 1.5, marginBottom: '0.85rem' }}>
          {currentStep.instruction}
        </p>

        {/* Expected Action Box */}
        {currentStep.expectedAction && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.55rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              marginBottom: '0.85rem',
            }}
          >
            <span style={{ fontSize: '1rem' }}>👉</span>
            <span>{currentStep.expectedAction}</span>
          </div>
        )}

        {/* Safe Demo Notice if applicable */}
        {currentStep.safeDemoNotice && (
          <div
            style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              padding: '0.45rem 0.65rem',
              fontSize: '0.75rem',
              color: '#065f46',
              marginBottom: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <CheckCircle2 size={13} />
            <span>{currentStep.safeDemoNotice}</span>
          </div>
        )}

        {/* Progress Bar Dots */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '0.85rem', alignItems: 'center' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 2,
                background: i === currentStepIndex ? 'var(--primary)' : i < currentStepIndex ? '#a5b4fc' : '#e2e8f0',
                transition: 'background 0.2s ease',
              }}
            />
          ))}
        </div>

        {/* Controls Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRequestExit}
            style={{ color: 'var(--danger)', fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
          >
            Exit Tour
          </button>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {currentStepIndex > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onPrevious}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}

            {!isLastStep && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onSkip}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', color: 'var(--neutral-600)' }}
              >
                Skip
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onNext}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', fontWeight: 700 }}
            >
              {isLastStep ? 'Complete 🎉' : 'Next'} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Mandatory Exit Confirmation Modal */}
      {isConfirmingExit && (
        <div
          className="modal-backdrop"
          style={{
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.75)',
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '440px',
              padding: '1.5rem',
              borderRadius: '16px',
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#fef2f2',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                  Exit Guided Tour?
                </h3>
                <span className="text-muted text-xs">Are you sure you want to exit the tour?</span>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--neutral-600)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Your progress has been automatically saved. Any real actions you have performed remain completely intact, and you will return directly to normal portal usage.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onCancelExit}
              >
                Stay in Tour
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={onConfirmExit}
              >
                Yes, Exit Tour
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
