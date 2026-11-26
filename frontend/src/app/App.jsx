// src/App.jsx
// Main Application Coordinator & View Router
// Features: Two Main Tabs ("Control" & "Components / Lab Management"),
// Role-Based Routing (Admin, Substitute Admin, Student),
// Biometric Entrance Station Kiosk Mode, Global Camera OCR Modal, and Reactive State Container.

import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import {
  initDatabase,
  getDashboardStats,
  getSettings,
  getCurrentUser,
  setCurrentUser,
  logoutUser,
  subscribeToDb,
  getStudentsRetentionAudit,
  deleteStudentEligibleRetentionData,
} from '../db/database';

import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import VoiceSearchModal from '../components/search/VoiceSearchModal';

// Pages
import ControlTab from '../pages/admin/ControlTab';
import Dashboard from '../pages/admin/Dashboard';
import Components from '../pages/admin/Components';
import IssueComponent from '../pages/admin/IssueComponent';
import ReturnComponent from '../pages/admin/ReturnComponent';
import Overdue from '../pages/admin/Overdue';
import Authorizations from '../pages/admin/Authorizations';
import Transactions from '../pages/admin/Transactions';
import Students from '../pages/admin/Students';
import StudentsInside from '../pages/lab/StudentsInside';
import LabEntryExit from '../pages/lab/LabEntryExit';
import FaceAttendance from '../pages/lab/FaceAttendance';
import Analytics from '../pages/admin/Analytics';
import AuditLog from '../pages/admin/AuditLog';
import StudentPortal from '../pages/student/StudentPortal';
import BackupRestore from '../pages/admin/BackupRestore';
import Login from '../pages/auth/Login';
import Projects from '../pages/projects/Projects';
import Complaints from '../pages/complaints/Complaints';
import AchievementsEvents from '../pages/events/AchievementsEvents';
import ResearchPapers from '../pages/research/ResearchPapers';
import DomainsHolidays from '../pages/admin/DomainsHolidays';
import ErrorBoundary from '../components/common/ErrorBoundary';
import QrEntryChoiceModal from '../components/common/QrEntryChoiceModal';
import { GuidedTourProvider, useGuidedTour } from '../components/tour/GuidedTourContext';
import GuidedTourHost from '../components/tour/GuidedTourHost';

export default function App() {
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [currentUser, setCurrentUserState] = useState(null);

  // Two Main Application Tabs: 'control' (Tab 1) | 'management' (Tab 2)
  const [mainTab, setMainTab] = useState('management');

  // Sub-navigation under 'management'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Standalone Biometric Entrance Station Kiosk Mode (can be launched from login)
  const [isEntranceStationKiosk, setIsEntranceStationKiosk] = useState(false);

  const [scannedStudentData, setScannedStudentData] = useState(null);

  // Voice Search Modal state
  const [isVoiceSearchOpen, setIsVoiceSearchOpen] = useState(false);

  // Live Stats & Settings
  const [dashboardStats, setDashboardStats] = useState(null);
  const [settings, setSettings] = useState({});

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // Automatic Retention Expiration Detection State (Admin confirmation)
  const [dismissedRetentionRolls, setDismissedRetentionRolls] = useState(new Set());
  const [activeRetentionPromptStudent, setActiveRetentionPromptStudent] = useState(null);

  // QR Code Access Choice Screen ("Install as App" vs "Continue on Web")
  const [showQrChoiceModal, setShowQrChoiceModal] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);

  function addToast(message) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }

  // Detect QR Code Entry (?entry=qr) and Capture PWA install prompt
  useEffect(() => {
    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('entry') === 'qr') {
          setShowQrChoiceModal(true);
        }
      } catch (err) {
        // Fallback for older browsers
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      }
    };
  }, []);

  function handleDismissQrChoice() {
    setShowQrChoiceModal(false);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('entry');
        const cleanUrl = url.pathname + (url.search ? url.search : '') + url.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (e) {
        // Safe fallback
      }
    }
  }

  // Initialize offline IndexedDB database on startup
  useEffect(() => {
    let isMounted = true;

    // Safety watchdog: ensure splash screen NEVER stays longer than 600ms under any circumstance
    const watchdogTimer = setTimeout(() => {
      if (isMounted) {
        setIsDbLoaded(true);
      }
    }, 600);

    async function setupDb() {
      try {
        await initDatabase();
        if (!isMounted) return;
        const user = getCurrentUser();
        setCurrentUserState(user);
        if (user?.role === 'student') {
          setActiveTab('student_portal');
        }
        setDashboardStats(getDashboardStats());
        setSettings(getSettings());
        setIsDbLoaded(true);
      } catch (err) {
        console.error('Database initialization error:', err);
        if (isMounted) setIsDbLoaded(true);
      } finally {
        clearTimeout(watchdogTimer);
      }
    }
    setupDb();

    const unsubscribe = subscribeToDb((changeType, data) => {
      setDashboardStats(getDashboardStats());
      setSettings(getSettings());
      if (changeType === 'AUTH_CHANGED') {
        setCurrentUserState(data);
      }
    });
    return () => {
      isMounted = false;
      clearTimeout(watchdogTimer);
      unsubscribe();
    };
  }, []);

  // Automatic Retention Expiration Detection
  // Checks if any student's individual retention period has completed and prompts Admin for confirmation
  useEffect(() => {
    if (!isDbLoaded) return;
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'substitute_admin';
    if (!isAdmin) return;

    try {
      const audit = getStudentsRetentionAudit();
      const nextCandidate = (audit.expiredEligible || []).find(
        (s) => !dismissedRetentionRolls.has(s.rollNumber.toUpperCase())
      );
      if (nextCandidate && !activeRetentionPromptStudent) {
        setActiveRetentionPromptStudent(nextCandidate);
      }
    } catch (e) {
      console.warn('Retention auto-detection check error:', e);
    }
  }, [isDbLoaded, currentUser, dashboardStats, dismissedRetentionRolls, activeRetentionPromptStudent]);

  function handleCancelRetentionDeletion() {
    if (!activeRetentionPromptStudent) return;
    const roll = activeRetentionPromptStudent.rollNumber.toUpperCase();
    setDismissedRetentionRolls((prev) => new Set([...prev, roll]));
    setActiveRetentionPromptStudent(null);
    addToast(`Retention data kept for ${activeRetentionPromptStudent.name} (${roll}).`);
  }

  async function handleConfirmRetentionDeletion() {
    if (!activeRetentionPromptStudent) return;
    const student = activeRetentionPromptStudent;
    const roll = student.rollNumber.toUpperCase();
    try {
      await deleteStudentEligibleRetentionData(student.rollNumber, currentUser);
      setDismissedRetentionRolls((prev) => new Set([...prev, roll]));
      setActiveRetentionPromptStudent(null);
      addToast(`Eligible retention data deleted for ${student.name} (${student.rollNumber}).`);
    } catch (err) {
      addToast(`Deletion failed: ${err.message}`);
    }
  }



  function handleOpenReturnWithRoll(roll) {
    setScannedStudentData({ rollNumber: roll, name: '' });
    setMainTab('management');
    setActiveTab('return');
  }

  function handleOpenIssueWithStudent(student) {
    setScannedStudentData({ rollNumber: student.rollNumber, name: student.name });
    setMainTab('management');
    setActiveTab('issue');
  }

  function handleLoginSuccess(user) {
    setCurrentUserState(user);
    setIsEntranceStationKiosk(false);
    addToast(`Welcome, ${user.name} (${user.role === 'student' ? user.rollNumber : user.role})!`);
    if (user.role === 'student') {
      setMainTab('management'); // Student Portal
      setActiveTab('student_portal');
    } else {
      setMainTab('management');
      setActiveTab('dashboard');
    }
  }

  async function handleLogout() {
    await logoutUser();
    setCurrentUserState(null);
    addToast('You have been signed out.');
  }

  // If database is still initializing, show clean splash
  if (!isDbLoaded) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div className="spinner-large"></div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--neutral-900)' }}>
          Loading Incubation-CMS...
        </h3>
        <p className="text-muted text-sm">Opening persistent offline database</p>
      </div>
    );
  }

  // Standalone Lab Entry / Exit Station Kiosk (accessible from login or direct link)
  if (isEntranceStationKiosk) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1rem' }}>
        <div
          style={{
            maxWidth: '960px',
            margin: '0 auto 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem' }}>⚡</span>
            <strong style={{ fontSize: '1.1rem', color: 'var(--neutral-900)' }}>
              {settings.incubationCenterName || 'Incubation Centre'} — Entrance Kiosk
            </strong>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsEntranceStationKiosk(false)}
          >
            ← Back to System Login
          </button>
        </div>
        <LabEntryExit onToast={addToast} currentUser={currentUser} />
        {/* Floating Toast Container */}
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className="toast">
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
        <QrEntryChoiceModal
          isOpen={showQrChoiceModal}
          onClose={handleDismissQrChoice}
          deferredPrompt={deferredInstallPrompt}
        />
      </div>
    );
  }

  // If user is not logged in, show login screen
  if (!currentUser) {
    return (
      <>
        <Login
          onLogin={handleLoginSuccess}
          onOpenEntranceStation={() => setIsEntranceStationKiosk(true)}
          centreName={settings.incubationCenterName || 'Incubation Centre'}
        />
        <QrEntryChoiceModal
          isOpen={showQrChoiceModal}
          onClose={handleDismissQrChoice}
          deferredPrompt={deferredInstallPrompt}
        />
      </>
    );
  }

  return (
    <GuidedTourProvider
      currentUser={currentUser}
      mainTab={mainTab}
      setMainTab={setMainTab}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onToast={addToast}
    >
      <AuthenticatedAppLayout
        currentUser={currentUser}
        mainTab={mainTab}
        setMainTab={setMainTab}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        dashboardStats={dashboardStats}
        settings={settings}
        toasts={toasts}
        addToast={addToast}
        scannedStudentData={scannedStudentData}
        setScannedStudentData={setScannedStudentData}
        isVoiceSearchOpen={isVoiceSearchOpen}
        setIsVoiceSearchOpen={setIsVoiceSearchOpen}
        activeRetentionPromptStudent={activeRetentionPromptStudent}
        handleCancelRetentionDeletion={handleCancelRetentionDeletion}
        handleConfirmRetentionDeletion={handleConfirmRetentionDeletion}
        showQrChoiceModal={showQrChoiceModal}
        handleDismissQrChoice={handleDismissQrChoice}
        deferredInstallPrompt={deferredInstallPrompt}
        handleOpenReturnWithRoll={handleOpenReturnWithRoll}
        handleOpenIssueWithStudent={handleOpenIssueWithStudent}
        handleLogout={handleLogout}
      />
    </GuidedTourProvider>
  );
}

function AuthenticatedAppLayout({
  currentUser,
  mainTab,
  setMainTab,
  activeTab,
  setActiveTab,
  isSidebarOpen,
  setIsSidebarOpen,
  dashboardStats,
  settings,
  toasts,
  addToast,
  scannedStudentData,
  setScannedStudentData,
  isVoiceSearchOpen,
  setIsVoiceSearchOpen,
  activeRetentionPromptStudent,
  handleCancelRetentionDeletion,
  handleConfirmRetentionDeletion,
  showQrChoiceModal,
  handleDismissQrChoice,
  deferredInstallPrompt,
  handleOpenReturnWithRoll,
  handleOpenIssueWithStudent,
  handleLogout,
}) {
  const { openHelpCenter } = useGuidedTour();
  const isStudent = currentUser?.role === 'student';
  const isStaff = currentUser?.role === 'staff';
  const isAdminOrSubstitute =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'substitute_admin' ||
    currentUser?.role === 'sir' ||
    (!currentUser?.role && !isStaff && !isStudent);

  return (
    <div className="app-container">
      {/* SIDEBAR NAVIGATION - Isolated in ErrorBoundary */}
      <ErrorBoundary title="Sidebar Navigation" fallbackStyle="minimal">
        <Sidebar
          currentUser={currentUser}
          mainTab={mainTab}
          setMainTab={setMainTab}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          overdueCount={dashboardStats?.overdueItemsCount || 0}
          insideCount={dashboardStats?.studentsInsideCount || 0}
          lowStockCount={dashboardStats?.lowStockCount || 0}
          centreName={settings.incubationCenterName || 'Incubation Centre'}
          onOpenHelp={openHelpCenter}
        />
      </ErrorBoundary>

      {/* MAIN VIEWPORT */}
      <div className="main-wrapper">
        {/* TOP NAVBAR - Isolated in ErrorBoundary */}
        <ErrorBoundary title="Top Navigation Bar" fallbackStyle="minimal">
          <Navbar
            stats={dashboardStats}
            currentUser={currentUser}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onLogout={handleLogout}
            mainTab={mainTab}
            setMainTab={setMainTab}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenVoiceSearch={() => setIsVoiceSearchOpen(true)}
            onOpenHelp={openHelpCenter}
            onToast={addToast}
          />
        </ErrorBoundary>

        {/* ACTIVE PAGE CONTENT */}
        <main className="content-body">
          <ErrorBoundary
            onReset={() => {
              setMainTab('management');
              setActiveTab(isStudent ? 'student_portal' : 'dashboard');
            }}
          >
          {/* TAB 1: CONTROL (Environmental & Hardware Controls) */}
          {(mainTab === 'control' || activeTab === 'control') && (
            !isStaff ? (
              <ErrorBoundary title="Lab Controls & Environment" onReset={() => setActiveTab('control')}>
                <ControlTab currentUser={currentUser} onToast={addToast} />
              </ErrorBoundary>
            ) : (
              <div className="card" style={{ margin: '2rem 1rem' }}>
                <div className="card-body" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
                  <AlertTriangle size={52} style={{ color: 'var(--danger)', margin: '0 auto 1.25rem' }} />
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                    Hardware & Environmental Control Restricted
                  </h3>
                  <p className="text-muted" style={{ maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                    Direct relay actuation and laboratory environmental overrides are strictly restricted to Lab Administrators and Faculty Directors.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setMainTab('management');
                      setActiveTab('dashboard');
                    }}
                  >
                    Return to Lab Management
                  </button>
                </div>
              </div>
            )
          )}

          {/* TAB 2: COMPONENTS / LAB MANAGEMENT OR STUDENT PORTAL */}
          {mainTab === 'management' && activeTab !== 'control' && (
            <>
              {/* REGULAR STUDENT VIEW: Private Student Portal & Student Pages */}
              {isStudent && (
                <>
                  {(activeTab === 'student_portal' || !activeTab || activeTab === 'dashboard') && (
                    <ErrorBoundary title="Student Portal" onReset={() => setActiveTab('student_portal')}>
                      <StudentPortal currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}
                  {activeTab === 'projects' && (
                    <ErrorBoundary title="Projects & Showcase" onReset={() => setActiveTab('projects')}>
                      <Projects currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}
                  {activeTab === 'achievements_events' && (
                    <ErrorBoundary title="Achievements & Events" onReset={() => setActiveTab('achievements_events')}>
                      <AchievementsEvents currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}
                  {activeTab === 'research_papers' && (
                    <ErrorBoundary title="Research Papers" onReset={() => setActiveTab('research_papers')}>
                      <ResearchPapers currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}
                  {activeTab === 'complaints' && (
                    <ErrorBoundary title="Complaints & Grievances" onReset={() => setActiveTab('complaints')}>
                      <Complaints currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}
                  {/* Fallback for unrecognized student route - NEVER BLANK */}
                  {!['student_portal', 'dashboard', 'projects', 'achievements_events', 'research_papers', 'complaints'].includes(activeTab) && (
                    <ErrorBoundary title="Student Portal" onReset={() => setActiveTab('student_portal')}>
                      <StudentPortal currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}
                </>
              )}

              {/* RESTRICTED STAFF DESK MANAGEMENT VIEWS */}
              {isStaff && (
                <>
                  {(activeTab === 'dashboard' || !activeTab) && (
                    <ErrorBoundary title="Staff Desk Dashboard" onReset={() => setActiveTab('dashboard')}>
                      <Dashboard
                        setActiveTab={setActiveTab}
                        currentUser={currentUser}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'components' && (
                    <ErrorBoundary title="Components Inventory" onReset={() => setActiveTab('components')}>
                      <Components onToast={addToast} currentUser={currentUser} isReadOnly={true} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'issue' && (
                    <ErrorBoundary title="Issue Components" onReset={() => setActiveTab('issue')}>
                      <IssueComponent
                        currentUser={currentUser}
                        scannedStudent={scannedStudentData}
                        onClearScannedStudent={() => setScannedStudentData(null)}
                        onToast={addToast}
                        setActiveTab={setActiveTab}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'return' && (
                    <ErrorBoundary title="Return Components" onReset={() => setActiveTab('return')}>
                      <ReturnComponent
                        currentUser={currentUser}
                        scannedStudent={scannedStudentData}
                        onClearScannedStudent={() => setScannedStudentData(null)}
                        onToast={addToast}
                        setActiveTab={setActiveTab}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'overdue' && (
                    <ErrorBoundary title="Overdue Tracker" onReset={() => setActiveTab('overdue')}>
                      <Overdue
                        setActiveTab={setActiveTab}
                        onToast={addToast}
                        onOpenReturnWithRoll={handleOpenReturnWithRoll}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'students_inside' && (
                    <ErrorBoundary title="Students Inside Lab" onReset={() => setActiveTab('students_inside')}>
                      <StudentsInside currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'face_attendance' && (
                    <ErrorBoundary title="Face Biometric Attendance" onReset={() => setActiveTab('face_attendance')}>
                      <FaceAttendance
                        currentUser={currentUser}
                        onToast={addToast}
                        onSwitchToManual={() => setActiveTab('lab_entry_exit')}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'lab_entry_exit' && (
                    <ErrorBoundary title="Lab Entry / Exit Station" onReset={() => setActiveTab('lab_entry_exit')}>
                      <LabEntryExit
                        currentUser={currentUser}
                        onToast={addToast}
                        onOpenFaceAttendance={() => setActiveTab('face_attendance')}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'transactions' && (
                    <ErrorBoundary title="Transaction History" onReset={() => setActiveTab('transactions')}>
                      <Transactions
                        setActiveTab={setActiveTab}
                        onOpenReturnWithRoll={handleOpenReturnWithRoll}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'students' && (
                    <ErrorBoundary title="Students Directory" onReset={() => setActiveTab('students')}>
                      <Students
                        currentUser={currentUser}
                        setActiveTab={setActiveTab}
                        onOpenIssueWithStudent={handleOpenIssueWithStudent}
                        onOpenReturnWithRoll={handleOpenReturnWithRoll}
                        onToast={addToast}
                        isReadOnly={true}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'projects' && (
                    <ErrorBoundary title="Projects & Showcase" onReset={() => setActiveTab('projects')}>
                      <Projects currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'complaints' && (
                    <ErrorBoundary title="Complaints & Grievances" onReset={() => setActiveTab('complaints')}>
                      <Complaints currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}

                  {/* RESTRICTED ACCESS CATCH-ALL FOR STAFF */}
                  {['authorizations', 'analytics', 'audit_log', 'settings', 'domains_holidays', 'control'].includes(activeTab) && (
                    <div className="card" style={{ margin: '2rem 1rem' }}>
                      <div className="card-body" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
                        <AlertTriangle size={52} style={{ color: 'var(--danger)', margin: '0 auto 1.25rem' }} />
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                          Administrative Section Restricted
                        </h3>
                        <p className="text-muted" style={{ maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                          Staff accounts do not have permission to access administrative audits, analytics export, authorizations, or system backups.
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setActiveTab('dashboard')}
                        >
                          Return to Staff Desk Dashboard
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Fallback for unrecognized staff route - NEVER BLANK */}
                  {!['dashboard', 'components', 'issue', 'return', 'overdue', 'students_inside', 'face_attendance', 'lab_entry_exit', 'transactions', 'students', 'projects', 'complaints', 'authorizations', 'analytics', 'audit_log', 'settings', 'domains_holidays', 'control'].includes(activeTab) && (
                    <ErrorBoundary title="Staff Desk Dashboard" onReset={() => setActiveTab('dashboard')}>
                      <Dashboard
                        setActiveTab={setActiveTab}
                        currentUser={currentUser}
                      />
                    </ErrorBoundary>
                  )}
                </>
              )}

              {/* ADMIN, SIR & SUBSTITUTE ADMIN MANAGEMENT VIEWS */}
              {isAdminOrSubstitute && (
                <>
                  {activeTab === 'dashboard' && (
                    <ErrorBoundary title="Administrative Dashboard" onReset={() => setActiveTab('dashboard')}>
                      <Dashboard
                        setActiveTab={setActiveTab}
                        currentUser={currentUser}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'components' && (
                    <ErrorBoundary title="Components Inventory" onReset={() => setActiveTab('components')}>
                      <Components onToast={addToast} currentUser={currentUser} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'issue' && (
                    <ErrorBoundary title="Issue Components" onReset={() => setActiveTab('issue')}>
                      <IssueComponent
                        currentUser={currentUser}
                        scannedStudent={scannedStudentData}
                        onClearScannedStudent={() => setScannedStudentData(null)}
                        onToast={addToast}
                        setActiveTab={setActiveTab}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'return' && (
                    <ErrorBoundary title="Return Components" onReset={() => setActiveTab('return')}>
                      <ReturnComponent
                        currentUser={currentUser}
                        scannedStudent={scannedStudentData}
                        onClearScannedStudent={() => setScannedStudentData(null)}
                        onToast={addToast}
                        setActiveTab={setActiveTab}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'overdue' && (
                    <ErrorBoundary title="Overdue Tracker" onReset={() => setActiveTab('overdue')}>
                      <Overdue
                        setActiveTab={setActiveTab}
                        onToast={addToast}
                        onOpenReturnWithRoll={handleOpenReturnWithRoll}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'students_inside' && (
                    <ErrorBoundary title="Students Inside Lab" onReset={() => setActiveTab('students_inside')}>
                      <StudentsInside currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'face_attendance' && (
                    <ErrorBoundary title="Face Biometric Attendance" onReset={() => setActiveTab('face_attendance')}>
                      <FaceAttendance
                        currentUser={currentUser}
                        onToast={addToast}
                        onSwitchToManual={() => setActiveTab('lab_entry_exit')}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'lab_entry_exit' && (
                    <ErrorBoundary title="Lab Entry / Exit Station" onReset={() => setActiveTab('lab_entry_exit')}>
                      <LabEntryExit
                        currentUser={currentUser}
                        onToast={addToast}
                        onOpenFaceAttendance={() => setActiveTab('face_attendance')}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'projects' && (
                    <ErrorBoundary title="Projects & Showcase" onReset={() => setActiveTab('projects')}>
                      <Projects currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'achievements_events' && (
                    <ErrorBoundary title="Achievements & Events" onReset={() => setActiveTab('achievements_events')}>
                      <AchievementsEvents currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'research_papers' && (
                    <ErrorBoundary title="Research Papers" onReset={() => setActiveTab('research_papers')}>
                      <ResearchPapers currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'complaints' && (
                    <ErrorBoundary title="Complaints & Grievances" onReset={() => setActiveTab('complaints')}>
                      <Complaints currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'domains_holidays' && (
                    <ErrorBoundary title="Domains & Holiday Management" onReset={() => setActiveTab('domains_holidays')}>
                      <DomainsHolidays currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'authorizations' && (
                    <ErrorBoundary title="Authorizations Management" onReset={() => setActiveTab('authorizations')}>
                      <Authorizations
                        onToast={addToast}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'transactions' && (
                    <ErrorBoundary title="Transaction History" onReset={() => setActiveTab('transactions')}>
                      <Transactions
                        setActiveTab={setActiveTab}
                        onOpenReturnWithRoll={handleOpenReturnWithRoll}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'students' && (
                    <ErrorBoundary title="Student Accounts Management" onReset={() => setActiveTab('students')}>
                      <Students
                        currentUser={currentUser}
                        setActiveTab={setActiveTab}
                        onOpenIssueWithStudent={handleOpenIssueWithStudent}
                        onOpenReturnWithRoll={handleOpenReturnWithRoll}
                        onToast={addToast}
                      />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'analytics' && (
                    <ErrorBoundary title="Analytics Dashboard" onReset={() => setActiveTab('analytics')}>
                      <Analytics onToast={addToast} currentUser={currentUser} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'audit_log' && (
                    <ErrorBoundary title="System Audit Logs" onReset={() => setActiveTab('audit_log')}>
                      <AuditLog currentUser={currentUser} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'settings' && (
                    <ErrorBoundary title="Backup & Restore Settings" onReset={() => setActiveTab('settings')}>
                      <BackupRestore onToast={addToast} />
                    </ErrorBoundary>
                  )}

                  {activeTab === 'student_portal' && (
                    <ErrorBoundary title="Student Portal Preview" onReset={() => setActiveTab('dashboard')}>
                      <StudentPortal currentUser={currentUser} onToast={addToast} />
                    </ErrorBoundary>
                  )}

                  {/* Fallback for unrecognized admin route - NEVER BLANK */}
                  {(!activeTab || !['dashboard', 'components', 'issue', 'return', 'overdue', 'students_inside', 'face_attendance', 'lab_entry_exit', 'projects', 'achievements_events', 'research_papers', 'complaints', 'domains_holidays', 'authorizations', 'transactions', 'students', 'analytics', 'audit_log', 'settings', 'student_portal'].includes(activeTab)) && (
                    <ErrorBoundary title="Administrative Dashboard" onReset={() => setActiveTab('dashboard')}>
                      <Dashboard
                        setActiveTab={setActiveTab}
                        currentUser={currentUser}
                      />
                    </ErrorBoundary>
                  )}
                </>
              )}
            </>
          )}

          {/* FALLBACK FOR UNRECOGNIZED MAIN TAB - NEVER BLANK */}
          {mainTab !== 'control' && mainTab !== 'management' && (
            <div className="card" style={{ margin: '2rem 1rem', textAlign: 'center', padding: '3rem 2rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem' }}>View Reset</h3>
              <p className="text-muted" style={{ marginBottom: '1.5rem' }}>An unknown navigation state was detected. Click below to return to your dashboard.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setMainTab('management');
                  setActiveTab(isStudent ? 'student_portal' : 'dashboard');
                }}
              >
                Return to Dashboard
              </button>
            </div>
          )}
          </ErrorBoundary>
        </main>
      </div>

      {/* AUTOMATIC RETENTION EXPIRATION ADMIN CONFIRMATION MODAL */}
      {activeRetentionPromptStudent && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={22} className="text-warning" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Retention Period Completed</h3>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', border: '1px solid var(--neutral-200)', fontSize: '0.9rem' }}>
              <div style={{ marginBottom: '0.45rem' }}>
                <span className="text-muted">Student:</span>{' '}
                <strong>{activeRetentionPromptStudent.name} / {activeRetentionPromptStudent.rollNumber}</strong>
              </div>
              <div style={{ marginBottom: '0.45rem' }}>
                <span className="text-muted">Incubation Start Date:</span>{' '}
                <strong className="font-mono">{activeRetentionPromptStudent.incubationStartDate || '—'}</strong>
              </div>
              <div style={{ marginBottom: '0.45rem' }}>
                <span className="text-muted">Retention Period:</span>{' '}
                <strong>
                  {activeRetentionPromptStudent.retention?.retentionYears || activeRetentionPromptStudent.retentionPeriodYears || 4} year
                  {(activeRetentionPromptStudent.retention?.retentionYears || activeRetentionPromptStudent.retentionPeriodYears) === 1 ? '' : 's'}
                </strong>
              </div>
              <div>
                <span className="text-muted">Retention Completed:</span>{' '}
                <strong className="font-mono text-danger">
                  {activeRetentionPromptStudent.retention?.retentionEndDate || activeRetentionPromptStudent.retentionEndDate || '—'}
                </strong>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--neutral-700)', marginBottom: '1.5rem', lineHeight: '1.45' }}>
              The retention period for this student's eligible data has been completed. Do you want to delete the eligible data?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelRetentionDeletion}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmRetentionDeletion}
              >
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}



      {/* GLOBAL VOICE & MULTI-FILTER SEARCH MODAL */}
      <VoiceSearchModal
        isOpen={isVoiceSearchOpen}
        onClose={() => setIsVoiceSearchOpen(false)}
        currentUser={currentUser}
        onSelectResult={(item) => {
          setIsVoiceSearchOpen(false);
          setMainTab('management');
          if (item.category === 'student') {
            if (currentUser?.role === 'student') {
              setActiveTab('student_portal');
            } else {
              setActiveTab('students');
            }
          } else if (item.category === 'project') {
            setActiveTab('projects');
          } else if (item.category === 'component') {
            setActiveTab('components');
          } else if (item.category === 'domain') {
            if (currentUser?.role === 'student') {
              setActiveTab('projects');
            } else {
              setActiveTab('domains_holidays');
            }
          }
        }}
      />

      {/* QR CODE ENTRY CHOICE MODAL ("Install as App" vs "Continue on Web") */}
      <QrEntryChoiceModal
        isOpen={showQrChoiceModal}
        onClose={handleDismissQrChoice}
        deferredPrompt={deferredInstallPrompt}
      />

      {/* FLOATING TOAST NOTIFICATIONS */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* GUIDED TOUR SPOTLIGHT, HAND POINTER, TOOLTIP & HELP CENTER */}
      <GuidedTourHost currentUser={currentUser} />
    </div>
  );
}
