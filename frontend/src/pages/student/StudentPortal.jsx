// src/pages/student/StudentPortal.jsx
// Comprehensive Student Login Dashboard & Innovation Workspace
// Strict Privacy: Student views ONLY their own data.
// Features: Working-day streak (Sundays & holidays preserved), presence status,
// daily/total/avg lab time, borrowed components, personal projects, permanent achievements,
// research publications, self-affirmation book, complaint submission, customizable avatar, and APK QR download.

import React, { useState, useEffect } from 'react';
import {
  User,
  Cpu,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Phone,
  BookOpen,
  Hash,
  History,
  ShieldCheck,
  Package,
  Flame,
  FolderGit2,
  Trophy,
  Heart,
  MessageSquareWarning,
  QrCode,
  Download,
  ExternalLink,
  Plus,
  Palette,
  Megaphone,
  Bot,
  Rocket,
  Sparkles,
  Award,
  GraduationCap,
} from 'lucide-react';
import {
  getStudentPersonalStats,
  createSelfReflection,
  createComplaint,
  updateProject,
  getCategories,
  subscribeToDb,
} from '../../db/database';
import AppInstallQrCard from '../../components/common/AppInstallQrCard';
import { formatDisplayDate } from '../../utils/dateFormatter';
import CategoryBreadcrumb from '../../utils/categoryHelper.jsx';
import { generateGoogleCalendarUrl, downloadIcsFile } from '../../utils/calendarExport';

export default function StudentPortal({ currentUser, onToast }) {
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [portalTab, setPortalTab] = useState('overview'); // 'overview', 'announcements_events', 'projects', 'achievements', 'papers', 'self_book', 'complaint', 'apk'
  const [avatarTheme, setAvatarTheme] = useState('indigo');
  const [avatarType, setAvatarType] = useState('initials'); // 'initials', 'robot', 'rocket', 'chip', 'scholar'

  // Self reflection state
  const [newRefTitle, setNewRefTitle] = useState('');
  const [newRefContent, setNewRefContent] = useState('');
  const [isSelfModalOpen, setIsSelfModalOpen] = useState(false);

  // Complaint form state
  const [cmpType, setCmpType] = useState('equipment_environment');
  const [cmpItem, setCmpItem] = useState('');
  const [cmpDesc, setCmpDesc] = useState('');

  // Title request modal state
  const [titleModalProject, setTitleModalProject] = useState(null);
  const [requestedTitle, setRequestedTitle] = useState('');

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDb(() => loadData());
    return () => unsubscribe();
  }, [currentUser]);

  function loadData() {
    if (!currentUser?.rollNumber) return;
    const personal = getStudentPersonalStats(currentUser.rollNumber);
    setStats(personal);
    setCategories(getCategories());
    if (personal?.avatarTheme) {
      setAvatarTheme(personal.avatarTheme);
    }
  }

  async function handleAddReflection(e) {
    e.preventDefault();
    if (!newRefTitle || !newRefContent) return;
    try {
      await createSelfReflection(
        {
          title: newRefTitle,
          content: newRefContent,
          isPrivate: true,
          studentRoll: currentUser?.rollNumber,
        },
        currentUser
      );
      onToast('Reflection saved to your private Self Book.');
      setIsSelfModalOpen(false);
      setNewRefTitle('');
      setNewRefContent('');
      loadData();
    } catch (err) {
      onToast(`Error saving reflection: ${err.message}`);
    }
  }

  async function handleSubmitComplaint(e) {
    e.preventDefault();
    if (!cmpItem || !cmpDesc) return;
    try {
      await createComplaint({
        type: cmpType,
        itemName: cmpItem,
        description: cmpDesc,
        reportedByRoll: currentUser?.rollNumber,
        reportedByName: currentUser?.name || 'Student',
      });
      onToast('Report submitted directly to Lab Incharge & Administrators.');
      setCmpItem('');
      setCmpDesc('');
      loadData();
    } catch (err) {
      onToast(`Submission error: ${err.message}`);
    }
  }

  async function handleRequestTitleChange(e) {
    e.preventDefault();
    if (!titleModalProject || !requestedTitle.trim()) return;
    try {
      const res = await updateProject(
        titleModalProject.id,
        { title: requestedTitle },
        currentUser
      );
      onToast(res.message || 'Title change request submitted for faculty approval.');
      setTitleModalProject(null);
      setRequestedTitle('');
      loadData();
    } catch (err) {
      onToast(`Request error: ${err.message}`);
    }
  }

  if (!stats) {
    return (
      <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center', maxWidth: '580px', margin: '2.5rem auto' }}>
        <div className="spinner-large" style={{ margin: '0 auto 1.25rem' }}></div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--neutral-900)', marginBottom: '0.5rem' }}>
          Loading Student Portal...
        </h3>
        <p className="text-muted text-sm">Synchronizing personal attendance, projects, and component records.</p>
      </div>
    );
  }

  // Safe initials generator with fallback to currentUser or 'Student'
  const studentName = stats?.student?.name || currentUser?.name || 'Student';
  const initials = studentName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('') || 'ST';

  // Theme palettes
  const THEMES = {
    indigo: { bg: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', text: '#ffffff' },
    emerald: { bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', text: '#ffffff' },
    amber: { bg: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', text: '#ffffff' },
    rose: { bg: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)', text: '#ffffff' },
    violet: { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', text: '#ffffff' },
    cyan: { bg: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)', text: '#ffffff' },
  };

  const currentThemeStyle = THEMES[avatarTheme] || THEMES.indigo;

  return (
    <div className="student-portal-container" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* STUDENT PROFILE HERO HEADER */}
      <div
        className="card"
        style={{
          padding: '1.75rem',
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid var(--neutral-200)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            {/* Customizable Avatar Badge (Initials or SVG Illustration) */}
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: currentThemeStyle.bg,
                color: currentThemeStyle.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                fontWeight: 900,
                letterSpacing: '1px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                flexShrink: 0,
              }}
            >
              {avatarType === 'robot' ? (
                <Bot size={34} />
              ) : avatarType === 'rocket' ? (
                <Rocket size={34} />
              ) : avatarType === 'chip' ? (
                <Cpu size={34} />
              ) : avatarType === 'scholar' ? (
                <GraduationCap size={34} />
              ) : (
                initials
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                  {stats.student.name}
                </h2>
                <span
                  style={{
                    background: '#e0e7ff',
                    color: '#3730a3',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '0.2rem 0.6rem',
                    borderRadius: 999,
                  }}
                >
                  {stats.branch || 'ECE'} • Sec {stats.section || 'A'} • Year {stats.year || 3}
                </span>
                {stats.student.faceRegistered ? (
                  <span
                    style={{
                      background: '#ecfdf5',
                      color: '#065f46',
                      border: '1px solid #a7f3d0',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.6rem',
                      borderRadius: 999,
                    }}
                    title="Face biometric template is active in local recognition system"
                  >
                    Face Enrolled
                  </span>
                ) : (
                  <span
                    style={{
                      background: '#f1f5f9',
                      color: '#64748b',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.6rem',
                      borderRadius: 999,
                    }}
                    title="Contact Admin or Sir to enroll face biometrics"
                  >
                    No Face Enrolled
                  </span>
                )}
              </div>
              <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>
                Roll Number: <strong className="font-mono text-primary">{stats.student.rollNumber}</strong> • VRSEC Incubation Scholar
              </p>
            </div>
          </div>

          {/* Live Presence Pill & Theme Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Avatar Theme Color & SVG Style Pickers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Palette Color Picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: 999 }}>
                <Palette size={14} className="text-muted" />
                {Object.keys(THEMES).map((thKey) => (
                  <button
                    key={thKey}
                    type="button"
                    onClick={() => setAvatarTheme(thKey)}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: THEMES[thKey].bg,
                      border: avatarTheme === thKey ? '2px solid #000' : 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    title={`Select ${thKey} theme`}
                  />
                ))}
              </div>

              {/* Inline SVG Avatar Style Picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#f1f5f9', padding: '0.25rem 0.45rem', borderRadius: 999 }}>
                {[
                  { id: 'initials', label: 'Initials', icon: null },
                  { id: 'robot', label: 'Robot AI', icon: Bot },
                  { id: 'rocket', label: 'Rocket', icon: Rocket },
                  { id: 'chip', label: 'Hardware Chip', icon: Cpu },
                  { id: 'scholar', label: 'Scholar Cap', icon: GraduationCap },
                ].map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setAvatarType(av.id)}
                    style={{
                      background: avatarType === av.id ? 'var(--neutral-900)' : 'transparent',
                      color: avatarType === av.id ? '#fff' : 'var(--neutral-600)',
                      border: 'none',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    title={`Avatar: ${av.label}`}
                  >
                    {av.icon ? <av.icon size={12} /> : 'Aa'}
                  </button>
                ))}
              </div>
            </div>

            {/* Presence status */}
            <div
              className="navbar-stat-pill"
              style={{
                background: stats.isCurrentlyInside ? '#ecfdf5' : '#f8fafc',
                color: stats.isCurrentlyInside ? '#065f46' : 'var(--neutral-600)',
                border: `1px solid ${stats.isCurrentlyInside ? '#a7f3d0' : 'var(--neutral-200)'}`,
                padding: '0.45rem 0.9rem',
                fontWeight: 700,
              }}
            >
              {stats.isCurrentlyInside ? <CheckCircle2 size={16} /> : <Clock size={16} />}
              <span>
                {stats.isCurrentlyInside
                  ? `Inside Lab (${stats.currentInsideDurationText})`
                  : 'Currently Outside Lab'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVE LAB ANNOUNCEMENTS BANNER */}
      {stats.announcements && stats.announcements.length > 0 && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {stats.announcements.map((ann) => {
            const daysLeft = Math.max(1, Math.ceil((new Date(ann.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
            return (
              <div
                key={ann.id}
                className="alert alert-info"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  border: '1px solid #93c5fd',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Megaphone size={20} className="text-primary" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{ann.category}</span>
                      <strong style={{ fontSize: '0.92rem', color: '#1e3a8a' }}>{ann.title}</strong>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#1e40af', margin: '0.2rem 0 0', lineHeight: '1.35' }}>
                      {ann.message}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                  {ann.externalUrl && (
                    <a
                      href={ann.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem' }}
                    >
                      <ExternalLink size={12} style={{ marginRight: '4px' }} /> Details
                    </a>
                  )}
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: '#475569',
                      background: 'rgba(255,255,255,0.7)',
                      padding: '0.2rem 0.45rem',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }}
                  >
                    Active ({daysLeft}d left)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* OVERDUE WARNING BANNER */}
      {stats.overdueItems.length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={24} style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: '0.95rem' }}>Action Required: You have {stats.overdueItems.length} overdue component(s)!</strong>
            <p style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Please return the following equipment to the Incubation Centre immediately:
            </p>
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {stats.overdueItems.map((it, idx) => (
                <div key={idx} className="font-mono text-xs" style={{ fontWeight: 600 }}>
                  • {it.componentName} {it.individualIds?.length > 0 ? `(${it.individualIds.join(', ')})` : ''} — Due Date: {formatDisplayDate(it.dueDate)} (Overdue by {it.daysOverdue} days)
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5 KEY PERSONAL METRIC CARDS */}
      <div className="stats-grid" data-tour="student-portal-stats" style={{ marginBottom: '1.5rem' }}>
        {/* Working-day daily streak */}
        <div className="stat-card" style={{ borderLeft: '4px solid #f97316', background: 'linear-gradient(135deg, #ffffff 0%, #fff7ed 100%)' }}>
          <div className="stat-card-left">
            <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>Working-Day Streak</span>
              <span
                style={{ fontSize: '0.68rem', background: '#ffedd5', color: '#c2410c', padding: '1px 6px', borderRadius: 999, fontWeight: 700, cursor: 'help' }}
                title="Sundays and college holidays do NOT break your streak!"
              >
                Holidays Immune
              </span>
            </span>
            <span className="stat-value" style={{ color: '#ea580c', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Flame size={26} className="text-warning" style={{ color: '#ea580c', fill: stats.workingDayStreak > 0 ? '#ea580c' : 'none' }} />
              <span>{stats.workingDayStreak}</span>
              <small style={{ fontSize: '0.9rem', color: '#9a3412', fontWeight: 600 }}>consecutive working days</small>
            </span>
            <span className="stat-subtext" style={{ color: '#9a3412', fontSize: '0.75rem' }}>
              {stats.workingDayStreak > 0 ? '🔥 Active lab visit streak maintained' : 'Visit the lab today to begin your streak!'}
            </span>
          </div>
          <div className="stat-icon-wrapper" style={{ background: '#ffedd5', color: '#ea580c' }}>
            <Flame size={26} />
          </div>
        </div>

        {/* Today's Lab Time */}
        <div className="stat-card stat-success">
          <div className="stat-card-left">
            <span className="stat-label">Today's Lab Time</span>
            <span className="stat-value">
              {stats.dailyLabTimeMinutes} <small style={{ fontSize: '0.9rem' }}>mins</small>
            </span>
            <span className="stat-subtext">Logged during today's sessions</span>
          </div>
          <div className="stat-icon-wrapper">
            <Clock size={24} />
          </div>
        </div>

        {/* Total Lab Time */}
        <div className="stat-card stat-primary">
          <div className="stat-card-left">
            <span className="stat-label">Total Lab Hours</span>
            <span className="stat-value">{stats.totalTimeSpentHours} <small style={{ fontSize: '0.9rem' }}>hrs</small></span>
            <span className="stat-subtext">{stats.totalTimeSpentMinutes} total minutes inside</span>
          </div>
          <div className="stat-icon-wrapper">
            <Calendar size={24} />
          </div>
        </div>

        {/* Average Visit Duration */}
        <div className="stat-card stat-warning">
          <div className="stat-card-left">
            <span className="stat-label">Avg Session Time</span>
            <span className="stat-value">{stats.avgSessionMinutes} <small style={{ fontSize: '0.9rem' }}>mins</small></span>
            <span className="stat-subtext">Across {stats.totalVisitsCount} visits</span>
          </div>
          <div className="stat-icon-wrapper">
            <Clock size={24} />
          </div>
        </div>

        {/* Borrowed Components */}
        <div className="stat-card stat-primary">
          <div className="stat-card-left">
            <span className="stat-label">Borrowed Hardware</span>
            <span className="stat-value">{stats.activeIssuedItems.length}</span>
            <span className="stat-subtext">Currently taken components</span>
          </div>
          <div className="stat-icon-wrapper">
            <Cpu size={24} />
          </div>
        </div>
      </div>

      {/* PORTAL NAVIGATION TABS */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--neutral-200)',
          paddingBottom: '0.5rem',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          className={`btn ${portalTab === 'overview' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setPortalTab('overview')}
        >
          <Cpu size={14} style={{ marginRight: '4px' }} />
          Borrowed Equipment & History
        </button>
        <button
          type="button"
          className={`btn ${portalTab === 'announcements_events' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setPortalTab('announcements_events')}
        >
          <Megaphone size={14} style={{ marginRight: '4px' }} />
          Notices & Events ({(stats.announcements?.length || 0) + (stats.events?.length || 0)})
        </button>
        <button
          type="button"
          className={`btn ${portalTab === 'projects' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setPortalTab('projects')}
        >
          <FolderGit2 size={14} style={{ marginRight: '4px' }} />
          My Projects ({stats.projects.length})
        </button>
        <button
          type="button"
          className={`btn ${portalTab === 'achievements' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setPortalTab('achievements')}
        >
          <Trophy size={14} style={{ marginRight: '4px' }} />
          Achievements ({stats.achievements.length})
        </button>
        <button
          type="button"
          className={`btn ${portalTab === 'papers' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setPortalTab('papers')}
        >
          <BookOpen size={14} style={{ marginRight: '4px' }} />
          Research Papers ({stats.researchPapers.length})
        </button>
        <button
          type="button"
          className={`btn ${portalTab === 'self_book' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setPortalTab('self_book')}
        >
          <Heart size={14} style={{ marginRight: '4px' }} />
          Self Book / Reflections
        </button>
        <button
          type="button"
          className={`btn ${portalTab === 'complaint' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setPortalTab('complaint')}
        >
          <MessageSquareWarning size={14} style={{ marginRight: '4px' }} />
          Report Issue / Request Part
        </button>
        <button
          type="button"
          className={`btn ${portalTab === 'apk' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setPortalTab('apk')}
        >
          <QrCode size={14} style={{ marginRight: '4px' }} />
          Mobile App APK
        </button>
      </div>

      {/* TAB 1: OVERVIEW (Borrowed Components & History) */}
      {portalTab === 'overview' && (
        <div data-tour="student-borrowed-items" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* CURRENTLY ISSUED COMPONENTS */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Cpu size={18} /> My Currently Borrowed Components
              </h3>
              <span className="badge badge-warning">{stats.activeIssuedItems.length} Active</span>
            </div>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Qty</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.activeIssuedItems.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>
                        You currently do not have any borrowed components.
                      </td>
                    </tr>
                  ) : (
                    stats.activeIssuedItems.map((it, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{it.componentName}</strong>
                          <div style={{ marginTop: '0.2rem' }}>
                            <CategoryBreadcrumb component={it} categories={categories} fontSize="0.75rem" />
                          </div>
                          {it.individualIds?.length > 0 && (
                            <div className="font-mono text-xs text-muted" style={{ marginTop: '0.2rem' }}>
                              IDs: {it.individualIds.join(', ')}
                            </div>
                          )}
                        </td>
                        <td>{it.remainingQuantity}</td>
                        <td>{formatDisplayDate(it.issueDate)}</td>
                        <td>
                          <span className={it.isOverdue ? 'text-danger font-bold' : ''}>
                            {formatDisplayDate(it.dueDate)}
                          </span>
                        </td>
                        <td>
                          {it.isOverdue ? (
                            <span className="badge badge-danger">Overdue by {it.daysOverdue}d</span>
                          ) : (() => {
                            const msLeft = new Date(it.dueDate).getTime() - Date.now();
                            const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
                            if (daysLeft <= 0) return <span className="badge badge-warning">Due Today</span>;
                            return <span className="badge badge-success">Due in {daysLeft}d</span>;
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* LAB VISITS TIMELINE */}
          <div className="card" data-tour="student-attendance-card">
            <div className="card-header">
              <h3 className="card-title">
                <History size={18} /> My Lab Visit History
              </h3>
              <span className="badge badge-primary">{stats.visitHistory.length} Sessions</span>
            </div>

            {/* Notification if student had a visit auto-closed at closing time */}
            {(() => {
              const recentAutoClosed = (stats.visitHistory || []).find(
                (v) => v && (v.exitMethod === 'automatic_end_of_day' || v.isAutoClosed)
              );
              if (!recentAutoClosed) return null;
              return (
                <div
                  style={{
                    margin: '1rem 1.25rem 0',
                    padding: '0.75rem 1rem',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontSize: '0.84rem',
                    color: '#92400e',
                  }}
                >
                  <Clock size={16} style={{ color: '#d97706', flexShrink: 0 }} />
                  <div>
                    <strong>Notice:</strong> Your lab visit on {formatDisplayDate(recentAutoClosed.entryTime)} was automatically closed at lab closing time ({new Date(recentAutoClosed.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).
                  </div>
                </div>
              );
            })()}

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Entry Time</th>
                    <th>Exit Time</th>
                    <th>Duration</th>
                    <th>Entry Method</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.visitHistory.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>
                        No lab attendance records logged yet.
                      </td>
                    </tr>
                  ) : (
                    stats.visitHistory.slice(0, 10).map((v) => (
                      <tr key={v.id}>
                        <td className="font-mono">{formatDisplayDate(v.entryTime)}</td>
                        <td>{new Date(v.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          {v.exitTime ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span>{new Date(v.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {(v.exitMethod === 'automatic_end_of_day' || v.isAutoClosed) && (
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '0.1rem 0.4rem',
                                    background: '#fef3c7',
                                    color: '#b45309',
                                    border: '1px solid #fde68a',
                                    fontWeight: 700,
                                  }}
                                  title="This visit was automatically closed at lab closing time because no manual checkout was recorded"
                                >
                                  Auto-Closed
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="badge badge-success">Still Inside</span>
                          )}
                        </td>
                        <td>{v.durationFormatted || (v.durationMinutes ? `${v.durationMinutes} min` : 'In Progress')}</td>
                        <td>
                          <span className="badge badge-secondary">{v.entryMethod || 'Manual'}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: NOTICES & EVENTS */}
      {portalTab === 'announcements_events' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Active Announcements */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Megaphone size={18} /> Active Lab Broadcasts & Faculty Notices
              </h3>
              <span className="badge badge-primary">{stats.announcements?.length || 0} Active</span>
            </div>
            <div className="card-body">
              {(!stats.announcements || stats.announcements.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--neutral-500)' }}>
                  No active broadcasts at this moment. Regular lab schedules apply.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {stats.announcements.map((ann) => (
                    <div
                      key={ann.id}
                      style={{
                        padding: '1.25rem',
                        background: '#f8fafc',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--neutral-200)',
                      }}
                    >
                      <div className="flex-between" style={{ marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="badge badge-primary">{ann.category}</span>
                          <span className="badge badge-secondary">Audience: {ann.targetAudience || 'All Students'}</span>
                        </div>
                        <span className="text-xs text-muted">
                          Expires: {formatDisplayDate(ann.expiresAt)}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--neutral-900)', marginBottom: '0.35rem' }}>
                        {ann.title}
                      </h4>
                      <p style={{ fontSize: '0.88rem', color: 'var(--neutral-700)', lineHeight: '1.45', margin: 0 }}>
                        {ann.message}
                      </p>
                      {ann.externalUrl && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <a
                            href={ann.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                          >
                            <ExternalLink size={12} /> External Details & Registration
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Hackathons & Innovation Day Events */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Calendar size={18} /> Flagship Hackathons & VRSEC Innovation Day Events
              </h3>
              <span className="badge badge-success">{stats.events?.length || 0} Events</span>
            </div>
            <div className="card-body">
              {(!stats.events || stats.events.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--neutral-500)' }}>
                  No event records cataloged yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
                  {stats.events.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        padding: '1.25rem',
                        background: evt.isInnovationDay ? 'linear-gradient(135deg, #ffffff 0%, #fdf4ff 100%)' : '#ffffff',
                        border: evt.isInnovationDay ? '1px solid #f0abfc' : '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                        <span className={`badge ${evt.isInnovationDay ? 'badge-primary' : 'badge-secondary'}`}>
                          {evt.isInnovationDay ? 'VRSEC Innovation Day' : 'Technical Challenge'}
                        </span>
                        <span className="text-xs font-mono text-muted">{formatDisplayDate(evt.eventDate)}</span>
                      </div>

                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                        {evt.title}
                      </h4>
                      {evt.theme && (
                        <p style={{ fontSize: '0.8rem', color: '#6d28d9', fontWeight: 600, marginTop: '0.2rem' }}>
                          Theme: {evt.theme}
                        </p>
                      )}
                      <p style={{ fontSize: '0.84rem', color: 'var(--neutral-600)', margin: '0.5rem 0', lineHeight: '1.4' }}>
                        {evt.description}
                      </p>

                      {evt.prizes && (
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#16a34a', marginBottom: '0.5rem' }}>
                          Prizes: {evt.prizes}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.85rem', borderTop: '1px solid var(--neutral-100)', paddingTop: '0.65rem' }}>
                        {(evt.registrationUrl || evt.externalUrl) && (
                          <a
                            href={evt.registrationUrl || evt.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                          >
                            <ExternalLink size={12} /> Register Now
                          </a>
                        )}
                        <a
                          href={generateGoogleCalendarUrl(evt)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                        >
                          <Calendar size={12} /> Add to Google Calendar
                        </a>
                        <button
                          type="button"
                          onClick={() => downloadIcsFile(evt)}
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                        >
                          <Download size={12} /> .ICS
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY PROJECTS */}
      {portalTab === 'projects' && (
        <div>
          {stats.projects.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <FolderGit2 size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No projects assigned yet</h4>
              <p className="text-muted text-sm">You are not listed on any registered incubation projects.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {stats.projects.map((p) => (
                <div key={p.id} className="card" style={{ padding: '1.25rem' }}>
                  <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                    <span className="badge badge-primary">{p.domain}</span>
                    <span className="badge badge-success">{p.status}</span>
                  </div>

                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--neutral-900)', marginBottom: '0.35rem' }}>
                    {p.title}
                  </h3>

                  {p.titleChangeRequest && (
                    <div
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        padding: '0.4rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        color: '#1d4ed8',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Pending title request: "{p.titleChangeRequest.requestedTitle}"
                    </div>
                  )}

                  <p style={{ fontSize: '0.84rem', color: 'var(--neutral-600)', margin: '0.5rem 0 1rem', lineHeight: '1.4' }}>
                    {p.objectives}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--neutral-100)', paddingTop: '0.75rem' }}>
                    <div>
                      {p.prototypeAvailable ? (
                        <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>
                          ✓ Prototype Ready
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                          Design Stage
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setTitleModalProject(p);
                        setRequestedTitle(p.title);
                      }}
                    >
                      Request Title Change
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACHIEVEMENTS */}
      {portalTab === 'achievements' && (
        <div>
          {stats.achievements.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Trophy size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No permanent achievements yet</h4>
              <p className="text-muted text-sm">Awards won in Smart India Hackathon and national challenges will appear here.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {stats.achievements.map((ach) => (
                <div
                  key={ach.id}
                  className="card"
                  style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #ffffff 0%, #fdfbf7 100%)',
                    border: '1px solid #fef3c7',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Trophy size={20} style={{ color: '#d97706' }} />
                    <span className="badge badge-warning">Permanent Record</span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                    {ach.title}
                  </h3>

                  <p style={{ fontSize: '0.84rem', color: 'var(--neutral-600)', margin: '0.45rem 0 1rem' }}>
                    {ach.description}
                  </p>

                  {ach.prizeMoney > 0 && (
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#16a34a', marginBottom: '0.5rem' }}>
                      Prize Won: ₹{ach.prizeMoney.toLocaleString('en-IN')}
                    </div>
                  )}

                  <div style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', borderTop: '1px solid var(--neutral-100)', paddingTop: '0.5rem' }}>
                    Awarded by: <strong>{ach.awardedBy}</strong> on {formatDisplayDate(ach.dateAwarded)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RESEARCH PAPERS */}
      {portalTab === 'papers' && (
        <div>
          {stats.researchPapers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <BookOpen size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No research publications</h4>
              <p className="text-muted text-sm">Publications authored by you will be cataloged here with DOI links.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {stats.researchPapers.map((p) => (
                <div key={p.id} className="card" style={{ padding: '1.25rem' }}>
                  <div className="flex-between" style={{ marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span className="badge badge-primary">{p.paperType}</span>
                      <span className="badge badge-secondary">{p.domain}</span>
                    </div>
                    {p.externalUrl && (
                      <a href={p.externalUrl} target="_blank" rel="noopener noreferrer" className="btn-icon">
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                    {p.title}
                  </h3>
                  <div style={{ fontSize: '0.84rem', color: 'var(--neutral-600)', marginTop: '0.25rem' }}>
                    Venue: {p.venue}
                  </div>
                  {p.doi && (
                    <div className="font-mono text-xs text-primary" style={{ marginTop: '0.35rem' }}>
                      DOI: {p.doi}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SELF-AFFIRMATION / SELF BOOK */}
      {portalTab === 'self_book' && (
        <div>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Student Self-Affirmation Book</h3>
              <p className="text-muted text-xs">A private journal to write your technical insights, daily breakthroughs & goals.</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsSelfModalOpen(true)}
            >
              <Plus size={16} /> New Entry
            </button>
          </div>

          {stats.selfReflections.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Heart size={36} style={{ color: '#ec4899', opacity: 0.5, margin: '0 auto 0.75rem' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Your Self Book is empty</h4>
              <p className="text-muted text-sm">Write down what you learned today, circuit debugging milestones, or future ambitions.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {stats.selfReflections.map((r) => (
                <div
                  key={r.id}
                  className="card"
                  style={{
                    padding: '1.25rem',
                    background: 'linear-gradient(135deg, #ffffff 0%, #fff1f2 100%)',
                    borderLeft: '4px solid #f43f5e',
                  }}
                >
                  <div className="flex-between text-xs text-muted" style={{ marginBottom: '0.35rem' }}>
                    <span>{formatDisplayDate(r.date)}</span>
                    <span className="badge badge-secondary">Private Journal</span>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                    {r.title}
                  </h4>
                  <p style={{ fontSize: '0.88rem', color: 'var(--neutral-700)', lineHeight: '1.45', marginTop: '0.45rem' }}>
                    {r.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: REPORT ISSUE / COMPLAINT */}
      {portalTab === 'complaint' && (
        <div className="card" style={{ maxWidth: '640px', margin: '0 auto', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.35rem' }}>
            Submit Lab Issue or Equipment Shortage
          </h3>
          <p className="text-muted text-xs" style={{ marginBottom: '1.25rem' }}>
            Reports are forwarded directly to Sir / Faculty Lab Incharge and Administrators.
          </p>

          <form onSubmit={handleSubmitComplaint}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="input-label" htmlFor="cmpType">Category *</label>
              <select
                id="cmpType"
                className="input-field"
                value={cmpType}
                onChange={(e) => setCmpType(e.target.value)}
              >
                <option value="equipment_environment">Equipment & Environment (Fans, AC, Lights, Soldering, Power)</option>
                <option value="component_availability">Component Availability (Missing ICs, ESP32, Resistors, Sensors)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="input-label" htmlFor="cmpItem">Item / Component Name *</label>
              <input
                id="cmpItem"
                type="text"
                className="input-field"
                placeholder="e.g. Bench 3 Soldering Tip or ESP32-CAM"
                value={cmpItem}
                onChange={(e) => setCmpItem(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="input-label" htmlFor="cmpDesc">Description *</label>
              <textarea
                id="cmpDesc"
                className="input-field"
                rows={4}
                placeholder="Describe the problem, location, or which project requires this part..."
                value={cmpDesc}
                onChange={(e) => setCmpDesc(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Submit Report
            </button>
          </form>
        </div>
      )}

      {/* TAB 7: MOBILE APP PWA INSTALLATION */}
      {portalTab === 'apk' && (
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <AppInstallQrCard
            registeredUser={currentUser}
            inline={true}
          />
        </div>
      )}

      {/* SELF BOOK MODAL */}
      {isSelfModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setIsSelfModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '480px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem' }}>
              Add Self-Affirmation Entry
            </h3>

            <form onSubmit={handleAddReflection}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label" htmlFor="refTitle">Milestone / Focus *</label>
                <input
                  id="refTitle"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Mastered FreeRTOS Task Scheduling"
                  value={newRefTitle}
                  onChange={(e) => setNewRefTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label" htmlFor="refContent">Notes & Reflection *</label>
                <textarea
                  id="refContent"
                  className="input-field"
                  rows={4}
                  placeholder="Reflect on today's hardware breakthroughs or challenges solved..."
                  value={newRefContent}
                  onChange={(e) => setNewRefContent(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsSelfModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save to Self Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST PROJECT TITLE CHANGE MODAL */}
      {titleModalProject && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setTitleModalProject(null)}>
          <div className="modal-content" style={{ maxWidth: '480px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Request Project Title Change
            </h3>
            <p className="text-muted text-xs" style={{ marginBottom: '1rem' }}>
              Official project title changes are strictly reviewed and approved by Sir / Faculty Mentor.
            </p>

            <form onSubmit={handleRequestTitleChange}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <span className="text-muted text-xs">Current Official Title:</span>
                <div style={{ fontWeight: 700, marginTop: '0.2rem' }}>{titleModalProject.title}</div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label" htmlFor="requestedTitle">Proposed New Title *</label>
                <input
                  id="requestedTitle"
                  type="text"
                  className="input-field"
                  value={requestedTitle}
                  onChange={(e) => setRequestedTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setTitleModalProject(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit to Faculty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
