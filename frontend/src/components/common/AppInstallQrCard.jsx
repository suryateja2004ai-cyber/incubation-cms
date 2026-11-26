// src/components/common/AppInstallQrCard.jsx
// Displays Mobile App Installation QR Code for Android Chrome / iOS Safari PWA installation.
// STRICT PRIVACY & SECURITY:
// - Always encodes the verified production HTTPS URL (never localhost, never tokens/passwords).
// - Configurable via VITE_APP_URL.
// - Works across all registered account types (Student, Admin, Subadmin).

import React, { useState, useMemo } from 'react';
import { QrCode, Copy, Check, ExternalLink, Smartphone, Info, X } from 'lucide-react';
import { generateQrSvg } from '../../utils/qrCodeGenerator';

// Default production URL guaranteed with QR entry parameter
export const DEFAULT_APP_URL = 'https://incubation-cms.pages.dev/?entry=qr';

export function getAppInstallationUrl() {
  let envUrl = null;
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.env) {
      envUrl = import.meta.env.VITE_APP_URL || import.meta.env.VITE_PRODUCTION_URL;
    }
  } catch (e) {
    // CJS or test fallback
  }
  if (!envUrl && typeof process !== 'undefined' && process?.env) {
    envUrl = process.env.VITE_APP_URL || process.env.VITE_PRODUCTION_URL;
  }
  let baseUrl = 'https://incubation-cms.pages.dev';
  if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('https://')) {
    baseUrl = envUrl.trim();
  }
  baseUrl = baseUrl.replace(/\/+$/, '');
  if (!baseUrl.includes('entry=qr')) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}entry=qr`;
  }
  return baseUrl;
}

export default function AppInstallQrCard({
  registeredUser = null,
  onClose = null,
  onProceed = null,
  proceedLabel = 'Continue',
  inline = false,
}) {
  const [copied, setCopied] = useState(false);
  const [showPlatformGuide, setShowPlatformGuide] = useState(false);

  const targetUrl = useMemo(() => getAppInstallationUrl(), []);

  // Generate crisp QR SVG markup (size: 190)
  const qrData = useMemo(() => {
    try {
      return generateQrSvg(targetUrl, { size: 190, margin: 2 });
    } catch (e) {
      console.error('Failed to generate QR code SVG:', e);
      return null;
    }
  }, [targetUrl]);

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  const content = (
    <div
      className="app-install-qr-card"
      style={{
        background: '#ffffff',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        boxShadow: inline ? 'none' : 'var(--shadow-xl)',
        maxWidth: inline ? '100%' : '480px',
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'left' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--primary) 0%, #312e81 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Smartphone size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
              Install Mobile Application
            </h3>
            <p className="text-muted text-xs" style={{ margin: 0 }}>
              VRSEC Incubation Centre PWA
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Account Info Pill if available */}
      {registeredUser && (
        <div
          style={{
            background: 'var(--neutral-100)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem 0.75rem',
            marginBottom: '1rem',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: 'var(--neutral-600)' }}>Registered Account:</span>
          <span style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>
            {registeredUser.name} ({registeredUser.rollNumber || registeredUser.role || 'User'})
          </span>
        </div>
      )}

      {/* Scannable QR Code Frame */}
      <div
        style={{
          display: 'inline-block',
          padding: '0.75rem',
          background: '#ffffff',
          border: '2px solid var(--neutral-200)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)',
          marginBottom: '1rem',
        }}
      >
        {qrData ? (
          <div
            dangerouslySetInnerHTML={{ __html: qrData.svg }}
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          />
        ) : (
          <div style={{ width: 190, height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QrCode size={64} className="text-muted" />
          </div>
        )}
      </div>

      {/* Required Instructions */}
      <div style={{ margin: '0 0 1rem', padding: '0 0.5rem' }}>
        <p
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            color: 'var(--neutral-900)',
            lineHeight: 1.4,
            marginBottom: '0.5rem',
          }}
        >
          Scan this QR code with your mobile phone to open and install the VRSEC Incubation Centre app.
        </p>
        <p className="text-xs text-muted" style={{ lineHeight: 1.45, margin: 0 }}>
          Open your mobile camera or barcode scanner and point it at the QR code above. No app store or APK download required.
        </p>
      </div>

      {/* Fallback HTTPS URL & Copy Button */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid var(--neutral-300)',
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ textAlign: 'left', overflow: 'hidden' }}>
          <div className="text-xs text-muted" style={{ fontWeight: 600 }}>
            Fallback HTTPS Link
          </div>
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-primary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {targetUrl}
            </span>
            <ExternalLink size={12} style={{ flexShrink: 0 }} />
          </a>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleCopyUrl}
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy URL'}</span>
        </button>
      </div>

      {/* Platform Instructions Toggle */}
      <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem', width: '100%', justifyContent: 'center' }}
          onClick={() => setShowPlatformGuide(!showPlatformGuide)}
        >
          <Info size={14} style={{ marginRight: '4px' }} />
          {showPlatformGuide ? 'Hide Installation Guide' : 'How to install on Android & iOS?'}
        </button>

        {showPlatformGuide && (
          <div
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              background: '#f1f5f9',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.75rem',
              lineHeight: 1.5,
              color: 'var(--neutral-700)',
            }}
          >
            <div style={{ marginBottom: '0.4rem' }}>
              <strong style={{ color: 'var(--neutral-900)' }}>Android (Google Chrome):</strong>
              <div>1. Open link in Chrome.</div>
              <div>2. Tap browser menu <strong>⋮</strong> and select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.</div>
            </div>
            <div>
              <strong style={{ color: 'var(--neutral-900)' }}>iOS (Apple Safari):</strong>
              <div>1. Open link in Safari.</div>
              <div>2. Tap the Share button <strong>⎋</strong> and select <strong>"Add to Home Screen"</strong>.</div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
        {onProceed ? (
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onProceed}
          >
            {proceedLabel}
          </button>
        ) : onClose ? (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onClose}
          >
            Close
          </button>
        ) : null}
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  // Modal Backdrop
  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      {content}
    </div>
  );
}

export { AppInstallQrCard as AppInstallQrModal };

