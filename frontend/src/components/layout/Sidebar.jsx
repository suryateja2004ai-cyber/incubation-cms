// src/components/Sidebar.jsx
// Dynamic role-based navigation sidebar
// Supports Admin, Substitute Admin, and Regular Student views

import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  UserCheck,
  History,
  Users,
  Settings,
  X,
  WifiOff,
  Sliders,
  BarChart3,
  FileText,
  User,
  Shield,
  Sparkles,
  AlertTriangle,
  ScanLine,
  Layers,
  Calendar,
  Award,
  Camera,
  HelpCircle,
} from 'lucide-react';

export default function Sidebar({
  currentUser,
  mainTab = 'management',
  setMainTab,
  activeTab,
  setActiveTab,
  isSidebarOpen,
  setIsSidebarOpen,
  overdueCount = 0,
  insideCount = 0,
  lowStockCount = 0,
  centreName = 'Incubation Centre',
  onOpenBarcodeScanner,
  onOpenHelp,
}) {
  const isStudent = currentUser?.role === 'student';
  const isStaff = currentUser?.role === 'staff';
  const isAdminOrSubstitute =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'substitute_admin' ||
    currentUser?.role === 'sir' ||
    (!currentUser?.role && !isStaff && !isStudent);

  // Navigation Items for Staff (Restricted Desk Dashboard)
  const staffCoreItems = [
    {
      id: 'dashboard',
      label: 'Staff Desk Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'issue',
      label: 'Issue Components',
      icon: ArrowUpRight,
    },
    {
      id: 'return',
      label: 'Return Components',
      icon: ArrowDownLeft,
    },
    {
      id: 'overdue',
      label: 'Overdue Tracker',
      icon: Clock,
      badge: overdueCount > 0 ? overdueCount : null,
      badgeType: 'danger',
    },
    {
      id: 'components',
      label: 'Components Inventory',
      icon: Cpu,
      badge: lowStockCount > 0 ? `${lowStockCount} Low` : null,
      badgeType: 'warning',
    },
  ];

  const staffEntranceItems = [
    {
      id: 'students_inside',
      label: 'Students Inside Lab',
      icon: Users,
      badge: insideCount > 0 ? `${insideCount} Inside` : null,
      badgeType: 'success',
    },
    {
      id: 'face_attendance',
      label: 'Face Recognition Attendance',
      icon: Camera,
    },
    {
      id: 'lab_entry_exit',
      label: 'Lab Entry / Exit',
      icon: UserCheck,
    },
  ];

  const staffRecordItems = [
    {
      id: 'transactions',
      label: 'Transactions History',
      icon: History,
    },
    {
      id: 'students',
      label: 'Student Directory (View)',
      icon: Users,
    },
    {
      id: 'projects',
      label: 'Projects & Teams',
      icon: Layers,
    },
    {
      id: 'complaints',
      label: 'Complaints',
      icon: AlertTriangle,
    },
  ];

  // Navigation Items for Admin & Substitute Admin
  const adminCoreItems = [
    {
      id: 'control',
      label: 'Tab 1: Control',
      icon: Sliders,
      isMainTab: true,
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'components',
      label: 'Components Inventory',
      icon: Cpu,
      badge: lowStockCount > 0 ? `${lowStockCount} Low` : null,
      badgeType: 'warning',
    },
    {
      id: 'issue',
      label: 'Issue Components',
      icon: ArrowUpRight,
    },
    {
      id: 'return',
      label: 'Return Components',
      icon: ArrowDownLeft,
    },
    {
      id: 'overdue',
      label: 'Overdue Tracker',
      icon: Clock,
      badge: overdueCount > 0 ? overdueCount : null,
      badgeType: 'danger',
    },
  ];

  const adminEntranceItems = [
    {
      id: 'students_inside',
      label: 'Students Inside Lab',
      icon: Users,
      badge: insideCount > 0 ? `${insideCount} Inside` : null,
      badgeType: 'success',
    },
    {
      id: 'face_attendance',
      label: 'Face Recognition Attendance',
      icon: Camera,
    },
    {
      id: 'lab_entry_exit',
      label: 'Lab Entry / Exit',
      icon: UserCheck,
    },
  ];

  const adminIncubationItems = [
    {
      id: 'projects',
      label: 'Projects & Teams',
      icon: Layers,
    },
    {
      id: 'achievements_events',
      label: 'Achievements & Events',
      icon: Award,
    },
    {
      id: 'research_papers',
      label: 'Research Publications',
      icon: FileText,
    },
    {
      id: 'complaints',
      label: 'Complaints & Shortages',
      icon: AlertTriangle,
    },
    {
      id: 'domains_holidays',
      label: 'Domains & Calendar',
      icon: Calendar,
    },
  ];

  const adminRecordItems = [
    {
      id: 'authorizations',
      label: 'Authorizations (Delegates)',
      icon: UserCheck,
    },
    {
      id: 'transactions',
      label: 'Transactions History',
      icon: History,
    },
    {
      id: 'students',
      label: 'Students & Accounts',
      icon: Users,
    },
    {
      id: 'analytics',
      label: 'Analytics & Excel Export',
      icon: BarChart3,
    },
    {
      id: 'audit_log',
      label: 'Administrative Audit Log',
      icon: FileText,
    },
    {
      id: 'settings',
      label: 'Settings & Data Backup',
      icon: Settings,
    },
  ];

  // Navigation Items for Student
  const studentItems = [
    {
      id: 'student_portal',
      label: 'My Personal Records',
      icon: LayoutDashboard,
      isStudentPortal: true,
    },
    {
      id: 'projects',
      label: 'Projects & Showcase',
      icon: Layers,
    },
    {
      id: 'achievements_events',
      label: 'Achievements & Events',
      icon: Award,
    },
    {
      id: 'research_papers',
      label: 'Research Publications',
      icon: FileText,
    },
    {
      id: 'complaints',
      label: 'Submit Complaint / Request',
      icon: AlertTriangle,
    },
    {
      id: 'control',
      label: 'Tab 1: Lab Controls',
      icon: Sliders,
      isMainTab: true,
    },
  ];

  function handleSelect(item) {
    if (item.isBarcodeScannerAction) {
      if (onOpenBarcodeScanner) onOpenBarcodeScanner();
    } else if (item.isMainTab || item.id === 'control') {
      if (setMainTab) setMainTab('control');
      if (setActiveTab) setActiveTab('control');
    } else {
      if (setMainTab) setMainTab('management');
      if (setActiveTab) setActiveTab(item.id);
    }
    setIsSidebarOpen(false);
  }

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo-icon">⚡</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--neutral-900)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {centreName}
            </h2>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: 'var(--success-text)',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }}></span>
              Offline Ready
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setIsSidebarOpen(false)}
            style={{ display: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {/* STUDENT NAVIGATION */}
          {isStudent ? (
            <>
              <span className="nav-section-title">Student Portal</span>
              {studentItems.map((item) => {
                const Icon = item.icon;
                const isActive = (item.isMainTab || item.id === 'control')
                  ? (mainTab === 'control' || activeTab === 'control')
                  : (mainTab === 'management' && activeTab !== 'control') &&
                    (activeTab === item.id || (item.isStudentPortal && (!activeTab || activeTab === 'student_portal' || activeTab === 'dashboard')));
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    data-tour={`nav-${item.id}`}
                    onClick={() => handleSelect(item)}
                  >
                    <div className="nav-item-left">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </>
          ) : isStaff ? (
            /* RESTRICTED STAFF DESK NAVIGATION */
            <>
              <span className="nav-section-title">Staff Desk Operations</span>
              {staffCoreItems.map((item) => {
                const Icon = item.icon;
                const isActive = mainTab === 'management' && activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    data-tour={`nav-${item.id}`}
                    onClick={() => handleSelect(item)}
                  >
                    <div className="nav-item-left">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className="nav-item-badge"
                        style={
                          item.badgeType === 'warning'
                            ? { background: '#fef3c7', color: '#b45309' }
                            : item.badgeType === 'danger'
                            ? { background: 'var(--danger-light)', color: 'var(--danger-text)' }
                            : {}
                        }
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              <span className="nav-section-title" style={{ marginTop: '0.75rem' }}>
                Lab Attendance & Entry
              </span>
              {staffEntranceItems.map((item) => {
                const Icon = item.icon;
                const isActive = mainTab === 'management' && activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    data-tour={`nav-${item.id}`}
                    onClick={() => handleSelect(item)}
                  >
                    <div className="nav-item-left">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className="nav-item-badge"
                        style={{ background: '#d1fae5', color: '#065f46' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              <span className="nav-section-title" style={{ marginTop: '0.75rem' }}>
                Records & Verification
              </span>
              {staffRecordItems.map((item) => {
                const Icon = item.icon;
                const isActive = mainTab === 'management' && activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    data-tour={`nav-${item.id}`}
                    onClick={() => handleSelect(item)}
                  >
                    <div className="nav-item-left">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </>
          ) : (
            /* ADMIN / SUBSTITUTE ADMIN NAVIGATION */
            <>
              <span className="nav-section-title">Core Operations</span>
              {adminCoreItems.map((item) => {
                const Icon = item.icon;
                const isActive = (item.isMainTab || item.id === 'control')
                  ? (mainTab === 'control' || activeTab === 'control')
                  : (mainTab === 'management' && activeTab !== 'control') && activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    data-tour={`nav-${item.id}`}
                    onClick={() => handleSelect(item)}
                  >
                    <div className="nav-item-left">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className="nav-item-badge"
                        style={
                          item.badgeType === 'warning'
                            ? { background: '#fef3c7', color: '#b45309' }
                            : item.badgeType === 'danger'
                            ? { background: 'var(--danger-light)', color: 'var(--danger-text)' }
                            : {}
                        }
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              <span className="nav-section-title" style={{ marginTop: '0.75rem' }}>
                Lab Entrance & Attendance
              </span>
              {adminEntranceItems.map((item) => {
                const Icon = item.icon;
                const isActive = mainTab === 'management' && activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    data-tour={`nav-${item.id}`}
                    onClick={() => handleSelect(item)}
                  >
                    <div className="nav-item-left">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className="nav-item-badge"
                        style={{ background: '#d1fae5', color: '#065f46' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              <span className="nav-section-title" style={{ marginTop: '0.75rem' }}>
                Incubation & Research
              </span>
              {adminIncubationItems.map((item) => {
                const Icon = item.icon;
                const isActive = mainTab === 'management' && activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    data-tour={`nav-${item.id}`}
                    onClick={() => handleSelect(item)}
                  >
                    <div className="nav-item-left">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}

              <span className="nav-section-title" style={{ marginTop: '0.75rem' }}>
                Management & Records
              </span>
              {adminRecordItems.map((item) => {
                const Icon = item.icon;
                const isActive = mainTab === 'management' && activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    data-tour={`nav-${item.id}`}
                    onClick={() => handleSelect(item)}
                  >
                    <div className="nav-item-left">
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* HELP & TUTORIALS NAV ITEM (ACCESSIBLE TO ALL ROLES) */}
          <span className="nav-section-title" style={{ marginTop: '0.85rem' }}>
            Help & Guidance
          </span>
          <button
            type="button"
            className="nav-item"
            data-tour="nav-help"
            onClick={() => {
              if (onOpenHelp) onOpenHelp();
              setIsSidebarOpen(false);
            }}
            style={{
              color: 'var(--primary)',
              fontWeight: 700,
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
            }}
          >
            <div className="nav-item-left">
              <HelpCircle size={18} style={{ color: 'var(--primary)' }} />
              <span>Help & Guided Tours</span>
            </div>
          </button>
        </nav>

        {/* User Card at bottom of sidebar */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-info">
              <div
                className="user-avatar"
                style={{
                  background:
                    currentUser?.role === 'admin'
                      ? 'var(--primary)'
                      : currentUser?.role === 'substitute_admin'
                      ? '#0284c7'
                      : currentUser?.role === 'sir'
                      ? '#7c3aed'
                      : currentUser?.role === 'staff'
                      ? '#d97706'
                      : '#10b981',
                }}
              >
                {currentUser?.name
                  ? currentUser.name.slice(0, 2).toUpperCase()
                  : 'AD'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: 'var(--neutral-900)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {currentUser?.name || 'Lab Admin'}
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--neutral-500)' }}>
                  {currentUser?.role === 'admin'
                    ? 'Super Admin'
                    : currentUser?.role === 'sir'
                    ? 'Lab Director / Sir'
                    : currentUser?.role === 'substitute_admin'
                    ? 'Substitute Admin'
                    : currentUser?.role === 'staff'
                    ? 'Lab Staff / Assistant'
                    : `Student: ${currentUser?.rollNumber || ''}`}
                </div>
              </div>
            </div>
            <span title="Offline Database Persistent">
              <WifiOff size={16} style={{ color: 'var(--neutral-400)' }} />
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
