// src/components/common/QrEntryChoiceModal.jsx
// Choice screen presented when scanning the website QR code (?entry=qr)
// Offers "Install as an App" (PWA install prompt, iOS Safari guide, or standalone status)
// and "Continue on Web" (standard browser access).

import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Globe,
  Share,
  PlusSquare,
  CheckCircle2,
  Info,
  X,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

export default function QrEntryChoiceModal({
  isOpen,
  onClose,
  deferredPrompt = null,
}) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [viewMode, setViewMode] = useState('choice'); // 'choice' | 'ios_guide' | 'android_guide' | 'installed'
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone mode (already installed & running as PWA)
    const standaloneMatch = window.matchMedia('(display-mode: standalone)').matches;
    const navStandalone = window.navigator && window.navigator.standalone === true;
    if (standaloneMatch || navStandalone) {
      setIsStandalone(true);
    }

    // Detect iOS
    const ua = window.navigator.userAgent || '';
    const isAppleMobile = /iPhone|iPad|iPod/i.test(ua) && !window.MSStream;
    setIsIos(isAppleMobile);
  }, []);

  if (!isOpen) return null;

  async function handleInstallAsApp() {
    if (isStandalone) {
      setViewMode('installed');
      return;
    }

    // If native PWA install prompt is available (Android Chrome, Edge, etc.)
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setInstallSuccess(true);
          setTimeout(() => {
            onClose();
          }, 1800);
          return;
        }
      } catch (err) {
        console.warn('PWA install prompt failed:', err);
      }
    }

    // If iOS Safari, show the iOS installation instructions
    if (isIos) {
      setViewMode('ios_guide');
      return;
    }

    // Generic mobile/desktop browser without immediate deferredPrompt
    setViewMode('android_guide');
  }

  function handleContinueOnWeb() {
    onClose();
  }

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-xl, 1rem)',
          maxWidth: '480px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)',
            color: '#ffffff',
            padding: '1.75rem 1.5rem',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>

          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <Smartphone size={30} style={{ color: '#ffffff' }} />
          </div>

          <h2
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              margin: '0 0 0.35rem',
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            Welcome to Incubation Centre Management System
          </h2>
          <p
            style={{
              fontSize: '0.92rem',
              color: 'rgba(255, 255, 255, 0.9)',
              margin: 0,
              fontWeight: 500,
            }}
          >
            How would you like to access the website?
          </p>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem' }}>
          {/* Default Choice View */}
          {viewMode === 'choice' && !installSuccess && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Option 1: Install as an App */}
              <button
                type="button"
                className="btn"
                onClick={handleInstallAsApp}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.1rem 1.25rem',
                  borderRadius: 'var(--radius-lg, 0.75rem)',
                  background: 'linear-gradient(135deg, var(--primary, #2563eb) 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Smartphone size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                      Install as an App
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.2rem' }}>
                      Add to home screen for fast fullscreen offline access
                    </div>
                  </div>
                </div>
                <ChevronRight size={20} style={{ opacity: 0.8 }} />
              </button>

              {/* Option 2: Continue as Web */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleContinueOnWeb}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.1rem 1.25rem',
                  borderRadius: 'var(--radius-lg, 0.75rem)',
                  background: '#f8fafc',
                  color: 'var(--neutral-900, #0f172a)',
                  border: '1px solid var(--neutral-300, #cbd5e1)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: 'var(--neutral-700, #334155)',
                    }}
                  >
                    <Globe size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                      Continue as Web
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--neutral-500, #64748b)', marginTop: '0.2rem' }}>
                      Browse directly in this web browser
                    </div>
                  </div>
                </div>
                <ChevronRight size={20} style={{ color: 'var(--neutral-400, #94a3b8)' }} />
              </button>

              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md, 0.5rem)',
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.78rem',
                  color: 'var(--neutral-600, #475569)',
                }}
              >
                <Info size={16} style={{ color: 'var(--primary, #2563eb)', flexShrink: 0 }} />
                <span>
                  You can change your choice anytime. No app store download or account permissions required.
                </span>
              </div>
            </div>
          )}

          {/* Installed Confirmation State */}
          {installSuccess && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <CheckCircle2 size={48} style={{ color: 'var(--success, #16a34a)', margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--neutral-900, #0f172a)' }}>
                Application Installed!
              </h3>
              <p className="text-sm text-muted" style={{ margin: '0.5rem 0 1.25rem' }}>
                The VRSEC Incubation Centre app has been added to your device.
              </p>
              <button type="button" className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
                Enter Application
              </button>
            </div>
          )}

          {/* Already Installed Standalone Mode */}
          {viewMode === 'installed' && !installSuccess && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <CheckCircle2 size={48} style={{ color: 'var(--success, #16a34a)', margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--neutral-900, #0f172a)' }}>
                App is already installed on your device
              </h3>
              <p className="text-sm text-muted" style={{ margin: '0.5rem 0 1.25rem' }}>
                You are currently running the installed Incubation Centre application.
              </p>
              <button type="button" className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
                Continue to App
              </button>
            </div>
          )}

          {/* iOS Safari Installation Guide */}
          {viewMode === 'ios_guide' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span className="badge badge-primary">iOS Safari Setup</span>
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>How to Install:</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--primary-light, #eff6ff)',
                      color: 'var(--primary, #2563eb)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    1
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--neutral-800, #1e293b)' }}>
                    Tap the <strong>Share</strong> button at the bottom of Safari{' '}
                    <Share size={15} style={{ display: 'inline', verticalAlign: '-2px', color: 'var(--primary, #2563eb)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--primary-light, #eff6ff)',
                      color: 'var(--primary, #2563eb)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    2
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--neutral-800, #1e293b)' }}>
                    Scroll down and tap <strong>Add to Home Screen</strong>{' '}
                    <PlusSquare size={15} style={{ display: 'inline', verticalAlign: '-2px', color: 'var(--primary, #2563eb)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--primary-light, #eff6ff)',
                      color: 'var(--primary, #2563eb)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    3
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--neutral-800, #1e293b)' }}>
                    Tap <strong>Add</strong> in the top-right corner to finish.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setViewMode('choice')}
                  style={{ flex: 1 }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onClose}
                  style={{ flex: 1 }}
                >
                  I've Installed It
                </button>
              </div>
            </div>
          )}

          {/* Android / Desktop Manual Guide */}
          {viewMode === 'android_guide' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span className="badge badge-primary">Browser Installation</span>
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>How to Install:</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--primary-light, #eff6ff)',
                      color: 'var(--primary, #2563eb)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    1
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--neutral-800, #1e293b)' }}>
                    Open your browser menu (<strong>⋮</strong> or <strong>⋯</strong> in the top or bottom corner).
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--primary-light, #eff6ff)',
                      color: 'var(--primary, #2563eb)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    2
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--neutral-800, #1e293b)' }}>
                    Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--primary-light, #eff6ff)',
                      color: 'var(--primary, #2563eb)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    3
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--neutral-800, #1e293b)' }}>
                    Confirm the prompt. The app icon will appear on your device home screen!
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setViewMode('choice')}
                  style={{ flex: 1 }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onClose}
                  style={{ flex: 1 }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
