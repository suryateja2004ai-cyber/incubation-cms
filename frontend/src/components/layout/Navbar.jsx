import React, { useState, useEffect } from 'react';
import {
  Menu,
  AlertTriangle,
  PackageCheck,
  LogOut,
  Sliders,
  Layers,
  Users,
  Shield,
  User,
  Sparkles,
  ScanLine,
  Mic,
  GraduationCap,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import {
  toggleStaffPresence,
  getStaffActivePresence,
  getGlobalAdminPresence,
  subscribeStaffPresenceRealtime,
  subscribeToDb,
} from '../../db/database';

export default function Navbar({
  stats,
  currentUser,
  onToggleSidebar,
  onLogout,
  mainTab = 'management',
  setMainTab,
  activeTab,
  setActiveTab,
  onOpenBarcodeScanner,
  onOpenVoiceSearch,
  onOpenHelp,
  onToast,
}) {
  const overdueCount = stats?.overdueItemsCount || 0;
  const activeCount = stats?.activeTransactionsCount || 0;
  const insideCount = stats?.studentsInsideCount || 0;

  const isStudent = currentUser?.role === 'student';
  const isStaff = currentUser?.role === 'staff';
  const isSir = currentUser?.role === 'sir';
  const isAdmin =
    currentUser?.role === 'admin' ||
    (currentUser?.rollNumber && currentUser.rollNumber.toLowerCase() === 'admin' && !currentUser?.role);
  const isAdminOrSubstitute =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'substitute_admin' ||
    currentUser?.role === 'sir' ||
    (!currentUser?.role && !isStaff && !isStudent);

  const [staffInside, setStaffInside] = useState(false);
  const [isTogglingPresence, setIsTogglingPresence] = useState(false);
  const [adminPresence, setAdminPresence] = useState(() => getGlobalAdminPresence());

  useEffect(() => {
    if (isAdminOrSubstitute && currentUser) {
      const active = getStaffActivePresence(currentUser);
      setStaffInside(Boolean(active));
    }
    setAdminPresence(getGlobalAdminPresence());

    const unsubscribe = subscribeToDb((event) => {
      if (currentUser) {
        const active = getStaffActivePresence(currentUser);
        setStaffInside(Boolean(active));
      }
      if (
        event === 'STAFF_PRESENCE_CHANGED' ||
        event === 'DATABASE_SYNCED' ||
        event === 'DATABASE_RESTORED' ||
        event === 'AUTH_CHANGED'
      ) {
        setAdminPresence(getGlobalAdminPresence());
      }
    });

    subscribeStaffPresenceRealtime();

    const interval = setInterval(() => {
      setAdminPresence(getGlobalAdminPresence());
    }, 30000);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      clearInterval(interval);
    };
  }, [currentUser, isAdminOrSubstitute]);

  async function handleToggleStaffPresence() {
    if (isTogglingPresence) return;
    setIsTogglingPresence(true);
    try {
      const res = await toggleStaffPresence(currentUser);
      setStaffInside(res.isInside);
      if (onToast) {
        if (res.isInside) {
          onToast(`Lab Entry recorded: ${res.record?.staffName || 'Admin'} is now inside the lab.`, 'success');
        } else {
          onToast(`Lab Exit recorded for ${res.record?.staffName || 'Admin'}. Time spent: ${res.record?.durationMinutes || 1} min.`, 'info');
        }
      }
    } catch (err) {
      console.error('Staff presence toggle failed:', err);
      if (onToast) onToast('Failed to update presence: ' + err.message, 'error');
    } finally {
      setIsTogglingPresence(false);
    }
  }

  return (
    <header className="navbar">
      <div className="navbar-brand" data-tour="navbar-brand">
        <button
          type="button"
          className="btn-icon mobile-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle menu"
          style={{ display: 'none' }}
        >
          <Menu size={22} />
        </button>
        <div className="navbar-brand-badge">
          VRSEC
        </div>
        <div className="navbar-brand-text">
          <h1 className="navbar-title">VRSEC Incubation Centre</h1>
          <p className="navbar-subtitle">Smart Lab Management System • Dept of ECE</p>
        </div>
      </div>

      {/* TWO MAIN APPLICATION TABS SWITCHER */}
      <div className="main-tab-nav" data-tour="main-tab-nav">
        {!isStaff && (
          <button
            type="button"
            className={`main-tab-pill ${mainTab === 'control' || activeTab === 'control' ? 'active' : ''}`}
            onClick={() => {
              if (setMainTab) setMainTab('control');
              if (setActiveTab) setActiveTab('control');
            }}
            data-tour="main-tab-control"
            title={isStudent ? 'Tab 1: Lab Controls (Lights & Fans)' : 'Tab 1: Lab Environmental & Device Controls'}
          >
            <Sliders size={16} />
            <span className="tab-full-label">{isStudent ? 'Tab 1: Lab Controls' : 'Tab 1: Control'}</span>
            <span className="tab-short-label">Control</span>
          </button>
        )}

        <button
          type="button"
          className={`main-tab-pill ${mainTab === 'management' && activeTab !== 'control' ? 'active' : ''}`}
          onClick={() => {
            if (setMainTab) setMainTab('management');
            if (activeTab === 'control') {
              if (setActiveTab) setActiveTab(isStudent ? 'student_portal' : 'dashboard');
            }
          }}
          data-tour="main-tab-management"
          title={isStudent ? 'Tab 2: My Personal Records & Portal' : isStaff ? 'Tab 2: Lab Desk Management' : 'Tab 2: Components & Lab Administration'}
        >
          <Layers size={16} />
          <span className="tab-full-label">{isStudent ? 'Tab 2: Student Portal' : isStaff ? 'Tab 2: Desk Management' : 'Tab 2: Lab Management'}</span>
          <span className="tab-short-label">{isStudent ? 'Portal' : 'Management'}</span>
        </button>
      </div>

      <div className="navbar-actions">
        {/* Help & Interactive Guided Tours Button */}
        {onOpenHelp && (
          <button
            type="button"
            className="navbar-stat-pill"
            style={{
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1.5px solid #bfdbfe',
              cursor: 'pointer',
              fontWeight: 700,
              boxShadow: '0 1px 2px rgba(29, 78, 216, 0.08)',
            }}
            onClick={onOpenHelp}
            data-tour="navbar-help"
            title="Open Help & Interactive Guided Tours"
          >
            <HelpCircle size={15} />
            <span className="hide-on-compact">Help & Tours</span>
          </button>
        )}

        {/* Global Voice Search Button */}
        {onOpenVoiceSearch && (
          <button
            type="button"
            className="navbar-stat-pill"
            style={{
              background: '#f5f3ff',
              color: '#6d28d9',
              border: '1px solid #ddd6fe',
              cursor: 'pointer',
              fontWeight: 600,
            }}
            onClick={onOpenVoiceSearch}
            data-tour="voice-search"
            title="Global Voice & Text Search across Students, Projects, Components & Domains"
          >
            <Mic size={15} />
            <span className="hide-on-compact">Voice Search</span>
          </button>
        )}

        {/* Sir / Staff "I'm Inside Lab" One-Click Presence Button */}
        {(isAdminOrSubstitute || isStaff) && (
          <button
            type="button"
            className="navbar-stat-pill"
            style={{
              background: staffInside ? '#ecfdf5' : '#f8fafc',
              color: staffInside ? '#065f46' : 'var(--neutral-700)',
              border: `1.5px solid ${staffInside ? '#10b981' : 'var(--neutral-300)'}`,
              cursor: isTogglingPresence ? 'wait' : 'pointer',
              fontWeight: 700,
              flexShrink: 0,
              opacity: isTogglingPresence ? 0.75 : 1,
              boxShadow: staffInside ? '0 1px 3px rgba(16, 185, 129, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease',
            }}
            onClick={handleToggleStaffPresence}
            disabled={isTogglingPresence}
            title={
              isTogglingPresence
                ? "Recording presence..."
                : staffInside
                ? "You are currently INSIDE the lab. Click to record your Lab Exit."
                : "You are currently OUTSIDE the lab. Click to record your Lab Entry."
            }
          >
            {isTogglingPresence ? (
              <>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    border: '2px solid currentColor',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.6s linear infinite',
                  }}
                />
                <span>Updating...</span>
              </>
            ) : staffInside ? (
              <>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#10b981',
                    display: 'inline-block',
                    boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.3)',
                  }}
                />
                <span>{currentUser?.role === 'sir' ? 'Sir Inside' : 'Inside Lab'}</span>
              </>
            ) : (
              <>
                <GraduationCap size={15} className="text-primary" />
                <span>I'm Inside Lab</span>
              </>
            )}
          </button>
        )}

        {/* Students Inside Lab Live Badge */}
        {isAdminOrSubstitute && (
          <button
            type="button"
            className="navbar-stat-pill"
            style={{
              background: insideCount > 0 ? '#ecfdf5' : 'var(--neutral-100)',
              color: insideCount > 0 ? '#065f46' : 'var(--neutral-600)',
              border: `1px solid ${insideCount > 0 ? '#a7f3d0' : 'var(--neutral-200)'}`,
              flexShrink: 0,
            }}
            onClick={() => {
              if (setMainTab) setMainTab('management');
              if (setActiveTab) setActiveTab('students_inside');
            }}
            title="View Students Currently Inside the Lab"
          >
            <Users size={15} />
            <span>{insideCount} Inside</span>
          </button>
        )}
      </div>

      {/* USER ACCOUNT & LOGOUT (ALWAYS ANCHORED AT FAR RIGHT, NEVER CLIPPED) */}
      <div className="navbar-user-section">
        {/* Global Admin Presence Indicator (Visible to every authorized portal EXCEPT Admin) */}
        {!isAdmin && (
          <div
            className="global-admin-presence-indicator"
            aria-label={adminPresence.tooltipText || (adminPresence.isInside ? `${adminPresence.adminName} is in the lab` : `${adminPresence.adminName} is outside the lab`)}
            data-testid="global-admin-presence"
            data-inside={adminPresence.isInside ? 'true' : 'false'}
            role="status"
          >
            <span
              className="presence-dot"
              style={{
                backgroundColor: adminPresence.isInside ? '#10b981' : '#ef4444',
                boxShadow: adminPresence.isInside
                  ? '0 0 0 2px rgba(16, 185, 129, 0.25), 0 0 6px rgba(16, 185, 129, 0.4)'
                  : '0 0 0 2px rgba(239, 68, 68, 0.25), 0 0 6px rgba(239, 68, 68, 0.4)',
              }}
            />
            <span className="presence-text">
              {adminPresence.visibleText || (adminPresence.isInside ? 'Admin is in lab' : 'Admin is outside the lab')}
            </span>
            <div className="presence-tooltip" role="tooltip">
              {adminPresence.tooltipText || (adminPresence.isInside
                ? `${adminPresence.adminName} is in the lab`
                : `${adminPresence.adminName} is outside the lab`)}
            </div>
          </div>
        )}

        {/* User Role Badge */}
        <div
          className="user-role-badge"
          data-tour="user-profile"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.65rem',
            borderRadius: 999,
            fontSize: '0.78rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            background:
              currentUser?.role === 'admin'
                ? '#e0e7ff'
                : currentUser?.role === 'sir'
                ? '#dcfce7'
                : currentUser?.role === 'substitute_admin'
                ? '#e0f2fe'
                : '#f1f5f9',
            color:
              currentUser?.role === 'admin'
                ? '#3730a3'
                : currentUser?.role === 'sir'
                ? '#15803d'
                : currentUser?.role === 'substitute_admin'
                ? '#0369a1'
                : '#334155',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
          title={`Logged in as ${currentUser?.name || 'User'} (${currentUser?.role || 'Admin'})`}
        >
          {currentUser?.role === 'admin' ? (
            <Shield size={14} className="text-primary" />
          ) : currentUser?.role === 'sir' ? (
            <GraduationCap size={14} style={{ color: '#16a34a' }} />
          ) : currentUser?.role === 'substitute_admin' ? (
            <Sparkles size={14} style={{ color: '#0284c7' }} />
          ) : (
            <User size={14} />
          )}
          <span>
            {currentUser?.role === 'admin'
              ? 'Admin'
              : currentUser?.role === 'sir'
              ? 'Sir'
              : currentUser?.role === 'substitute_admin'
              ? 'Sub Admin'
              : currentUser?.rollNumber || 'Student'}
          </span>
        </div>

        {/* Clear, Prominent Logout Button */}
        <button
          type="button"
          className="navbar-logout-btn"
          onClick={onLogout}
          title="Sign Out / Logout of Incubation CMS"
        >
          <LogOut size={15} />
          <span className="logout-text">Logout</span>
        </button>
      </div>

      <style>{`
        .main-tab-nav {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: var(--neutral-100);
          padding: 0.2rem 0.35rem;
          border-radius: var(--radius-lg);
          border: 1px solid var(--neutral-200);
          flex-shrink: 0;
        }
        .main-tab-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.75rem;
          border-radius: var(--radius-md);
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--neutral-600);
          background: transparent;
          border: none;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .main-tab-pill:hover {
          color: var(--neutral-900);
        }
        .main-tab-pill.active {
          background: #ffffff;
          color: var(--primary);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }
        .global-admin-presence-indicator {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.28rem 0.65rem;
          border-radius: 9999px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          margin-right: 0.35rem;
          user-select: none;
          background: #f8fafc;
          border: 1.5px solid var(--neutral-200);
          white-space: nowrap;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .global-admin-presence-indicator[data-inside="true"] {
          background: #ecfdf5;
          border-color: #a7f3d0;
          color: #065f46;
        }
        .global-admin-presence-indicator[data-inside="false"] {
          background: #fef2f2;
          border-color: #fecaca;
          color: #991b1b;
        }
        .global-admin-presence-indicator .presence-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.25s ease;
        }
        .global-admin-presence-indicator:hover .presence-dot {
          transform: scale(1.3);
        }
        .global-admin-presence-indicator .presence-text {
          font-weight: 700;
          letter-spacing: -0.2px;
          font-size: 0.76rem;
        }
        .global-admin-presence-indicator .presence-tooltip {
          visibility: hidden;
          opacity: 0;
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          background: #000000;
          color: #ffffff;
          font-size: 0.76rem;
          font-weight: 600;
          line-height: 1.35;
          padding: 0.45rem 0.75rem;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: opacity 0.15s ease, visibility 0.15s ease;
          z-index: 999999;
        }
        .global-admin-presence-indicator:hover .presence-tooltip {
          visibility: visible;
          opacity: 1;
        }
        @media (max-width: 900px) {
          .mobile-menu-btn {
            display: inline-flex !important;
          }
          .main-tab-nav {
            margin: 0 auto;
          }
          .main-tab-pill span {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
