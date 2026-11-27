// src/pages/Login.jsx
// Role-Based Authentication (Admin, Substitute Admin, Regular Student)
// Supports username or Roll Number login with password, quick test credentials,
// and direct launch of the Biometric Entrance/Exit Station.

import React, { useState } from 'react';
import {
  Lock,
  User,
  Key,
  ShieldCheck,
  AlertCircle,
  Cpu,
  WifiOff,
  UserCheck,
  Users,
  Shield,
  Mail,
  CheckCircle2,
  X,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { loginUser } from '../../db/database';
import VrsecHandLogo from '../../components/common/VrsecHandLogo';

export default function Login({ onLogin, onOpenEntranceStation, centreName = 'Incubation Centre' }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if username is admin to conditionally display Forgot Admin Password
  const isAdminIdentifier = identifier.trim().toLowerCase() === 'admin';

  // Admin Email OTP Password Recovery Modal States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1); // 1: Request OTP, 2: Enter OTP & New Password
  const [recoveryId, setRecoveryId] = useState('admin');
  const [recoveryEmail, setRecoveryEmail] = useState('admin@vrsec.ac.in');
  const [recoveryOtp, setRecoveryOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryMsg, setRecoveryMsg] = useState('');
  const [deliveredOtpInfo, setDeliveredOtpInfo] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessBanner('');
    setIsLoading(true);

    try {
      const user = await loginUser(identifier, password);
      onLogin(user);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleQuickFill(id, pass) {
    setIdentifier(id);
    setPassword(pass);
    setError('');
    setSuccessBanner('');
  }

  // Handle Request Admin OTP
  async function handleRequestOtp(e) {
    e.preventDefault();
    setRecoveryError('');
    setRecoveryMsg('');
    setDeliveredOtpInfo(null);
    setRecoveryLoading(true);

    const cleanId = String(recoveryId).trim().toLowerCase();
    if (cleanId !== 'admin') {
      setRecoveryLoading(false);
      setRecoveryError(
        'Self-service OTP reset is strictly reserved for the Primary Administrator. Sub-Admins, Staff, and Students must contact the Administrator to change their password.'
      );
      return;
    }

    try {
      const res = await fetch('/api/auth/admin/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRecoveryError(data.error || 'Failed to generate OTP.');
      } else {
        setRecoveryStep(2);
        setRecoveryMsg(data.message);
        setDeliveredOtpInfo({
          email: data.maskedEmail || data.email,
          otp: data.otpDemo,
        });
      }
    } catch (err) {
      setRecoveryError(`Network error: ${err.message}`);
    } finally {
      setRecoveryLoading(false);
    }
  }

  // Handle Verify OTP and Reset Admin Password
  async function handleVerifyOtpAndReset(e) {
    e.preventDefault();
    setRecoveryError('');
    setRecoveryLoading(true);

    if (!recoveryOtp || recoveryOtp.trim().length !== 6) {
      setRecoveryLoading(false);
      setRecoveryError('Please enter the 6-digit OTP code sent to your email.');
      return;
    }
    if (!newPassword || newPassword.trim().length < 6) {
      setRecoveryLoading(false);
      setRecoveryError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setRecoveryLoading(false);
      setRecoveryError('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      const res = await fetch('/api/auth/admin/verify-otp-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'admin',
          otp: recoveryOtp.trim(),
          new_password: newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRecoveryError(data.error || 'OTP verification failed.');
      } else {
        // Success! Pre-populate the login form with new password
        setIdentifier('admin');
        setPassword(newPassword.trim());
        setSuccessBanner('Admin password updated successfully! You can now log in below.');
        setIsForgotModalOpen(false);
        setRecoveryStep(1);
        setRecoveryOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setDeliveredOtpInfo(null);
      }
    } catch (err) {
      setRecoveryError(`Network error: ${err.message}`);
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        padding: '1.5rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          boxShadow: 'var(--shadow-xl)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
        }}
      >
        {/* Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #312e81 100%)',
            padding: '2.5rem 2rem 2rem',
            textAlign: 'center',
            color: '#ffffff',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25))',
            }}
          >
            <VrsecHandLogo size={60} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Incubation-CMS
          </h2>
          <p style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: '0.25rem' }}>
            Component & Equipment Management System
          </p>
        </div>

        {/* Login Form */}
        <div className="card-body" style={{ padding: '2rem' }}>
          {successBanner && (
            <div
              className="alert alert-success"
              style={{
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#ecfdf5',
                borderColor: '#a7f3d0',
                color: '#065f46',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
              }}
            >
              <CheckCircle2 size={18} className="text-success" />
              <span style={{ fontSize: '0.85rem' }}>{successBanner}</span>
            </div>
          )}

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="input-label" htmlFor="identifier">
                <User size={15} /> Username or Student Roll Number
              </label>
              <input
                id="identifier"
                type="text"
                className="input-field"
                placeholder="Roll No. (e.g. 238W1A0477) or admin"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="input-label" htmlFor="password" style={{ margin: 0 }}>
                  <Key size={15} /> Password
                </label>
                {isAdminIdentifier && (
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onClick={() => {
                      setError('');
                      setRecoveryError('');
                      setRecoveryMsg('');
                      setRecoveryStep(1);
                      setRecoveryId('admin');
                      setRecoveryEmail('admin@vrsec.ac.in');
                      setIsForgotModalOpen(true);
                    }}
                  >
                    Forgot Admin Password?
                  </button>
                )}
              </div>
              <input
                id="password"
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={isLoading}
            >
              <ShieldCheck size={18} />
              {isLoading ? 'Signing In...' : 'Sign In to Lab System'}
            </button>
          </form>
        </div>
      </div>

      {/* Admin Email OTP Password Recovery Modal */}
      {isForgotModalOpen && (
        <div
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
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-xl, 16px)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              animation: 'modalSlideIn 0.2s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    backgroundColor: '#e0e7ff',
                    color: '#4338ca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Shield size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>
                    Admin Password Recovery
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                    Email OTP Verification Portal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem' }}>
              {/* Notice Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  marginBottom: '1.25rem',
                  fontSize: '0.8rem',
                  color: '#1e40af',
                }}
              >
                <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Strict Security Policy:</strong> Direct Email OTP reset is reserved
                  strictly for the <strong>Primary Administrator</strong>. Sub-Admin, Staff, and
                  Student accounts can only be updated inside the Administrator portal.
                </span>
              </div>

              {recoveryError && (
                <div
                  className="alert alert-danger"
                  style={{
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{recoveryError}</span>
                </div>
              )}

              {recoveryStep === 1 ? (
                /* Step 1: Request OTP to pre-registered email */
                <form onSubmit={handleRequestOtp}>
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="input-label" htmlFor="recoveryId">
                      <User size={14} /> Admin Identifier
                    </label>
                    <input
                      id="recoveryId"
                      type="text"
                      className="input-field"
                      value={recoveryId}
                      readOnly
                      style={{ background: '#f8fafc', color: '#334155', fontWeight: 600 }}
                    />
                  </div>

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.85rem',
                      marginBottom: '1.5rem',
                      fontSize: '0.82rem',
                      color: '#475569',
                      lineHeight: '1.45',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>
                      <Mail size={15} color="var(--primary)" />
                      <span>OTP Delivery via Pre-Registered Email</span>
                    </div>
                    <div>
                      The 6-digit verification code will be sent strictly to the Administrator&apos;s <strong>Registered Email</strong> previously configured in the Admin Portal accounts table.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsForgotModalOpen(false)}
                      disabled={recoveryLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={recoveryLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      {recoveryLoading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>Sending OTP...</span>
                        </>
                      ) : (
                        <>
                          <Mail size={16} />
                          <span>Send OTP to Registered Email</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Step 2: Enter OTP & Set New Password */
                <form onSubmit={handleVerifyOtpAndReset}>
                  {deliveredOtpInfo && (
                    <div
                      style={{
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                        padding: '0.85rem',
                        marginBottom: '1.25rem',
                        fontSize: '0.82rem',
                        color: '#166534',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <CheckCircle2 size={16} color="#16a34a" />
                        <span>OTP Dispatched Successfully</span>
                      </div>
                      <div style={{ marginTop: '0.35rem', color: '#15803d' }}>
                        A 6-digit verification code was sent to <strong>{deliveredOtpInfo.email}</strong>.
                      </div>
                      {deliveredOtpInfo.otp && (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.4rem 0.6rem',
                            background: '#dcfce7',
                            borderRadius: '6px',
                            fontWeight: 700,
                            letterSpacing: '1px',
                            fontSize: '0.9rem',
                            display: 'inline-block',
                          }}
                        >
                          Dev/Test OTP: {deliveredOtpInfo.otp}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="input-label" htmlFor="recoveryOtp">
                      <Key size={14} /> Enter 6-Digit Email OTP
                    </label>
                    <input
                      id="recoveryOtp"
                      type="text"
                      className="input-field"
                      maxLength={6}
                      placeholder="123456"
                      value={recoveryOtp}
                      onChange={(e) => setRecoveryOtp(e.target.value.replace(/\D/g, ''))}
                      style={{
                        fontSize: '1.2rem',
                        letterSpacing: '4px',
                        textAlign: 'center',
                        fontWeight: 700,
                      }}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="input-label" htmlFor="newPassword">
                      <Lock size={14} /> New Admin Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="newPassword"
                        type={showNewPass ? 'text' : 'password'}
                        className="input-field"
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        style={{ paddingRight: '2.5rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          display: 'flex',
                        }}
                      >
                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="input-label" htmlFor="confirmPassword">
                      <Lock size={14} /> Confirm New Admin Password
                    </label>
                    <input
                      id="confirmPassword"
                      type={showNewPass ? 'text' : 'password'}
                      className="input-field"
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setRecoveryStep(1);
                        setRecoveryError('');
                      }}
                      disabled={recoveryLoading}
                    >
                      Back
                    </button>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setIsForgotModalOpen(false)}
                        disabled={recoveryLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={recoveryLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        {recoveryLoading ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" />
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={16} />
                            <span>Reset Password</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
