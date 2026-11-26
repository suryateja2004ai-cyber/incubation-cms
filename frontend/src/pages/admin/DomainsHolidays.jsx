// src/pages/admin/DomainsHolidays.jsx
// Incubation Domains & Working-Day Holidays Management (Sir / Admin only)
// Configures research domains and maintains holiday calendar for student streaks.

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Calendar,
  Plus,
  Trash2,
  Tag,
  ShieldCheck,
  Flame,
  CheckCircle2,
  Power,
  ToggleLeft,
  ToggleRight,
  Clock,
  LogOut,
  Users,
  Sparkles,
} from 'lucide-react';
import {
  getDomains,
  createDomain,
  deleteDomain,
  toggleDomainStatus,
  getHolidays,
  addHoliday,
  deleteHoliday,
  getProjects,
  getResearchPapers,
  getSettings,
  updateSettings,
  executeAutoEndOfDayCheckout,
  getStudentsCurrentlyInside,
  subscribeToDb,
} from '../../db/database';
import { formatDisplayDate } from '../../utils/dateFormatter';

export default function DomainsHolidays({ currentUser, onToast }) {
  const [activeTab, setActiveTab] = useState('domains'); // 'domains' or 'holidays'
  const [domains, setDomains] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [projects, setProjects] = useState([]);
  const [papers, setPapers] = useState([]);

  // Modals / Form state
  const [newDomainName, setNewDomainName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayType, setNewHolidayType] = useState('institute');

  // Lab Timings & Auto Checkout State
  const [labOpeningTime, setLabOpeningTime] = useState('09:00');
  const [labClosingTime, setLabClosingTime] = useState('17:00');
  const [autoCheckoutEnabled, setAutoCheckoutEnabled] = useState(true);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [workingDays, setWorkingDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const [studentsInsideCount, setStudentsInsideCount] = useState(0);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDb(() => loadData());
    return () => unsubscribe();
  }, []);

  function loadData() {
    setDomains(getDomains());
    setHolidays(getHolidays());
    setProjects(getProjects());
    setPapers(getResearchPapers());

    const settings = getSettings();
    const timings = settings.labTimings || {};
    setLabOpeningTime(timings.openingTime || '09:00');
    setLabClosingTime(timings.closingTime || '17:00');
    setAutoCheckoutEnabled(timings.autoCheckoutEnabled !== false);
    setTimezone(timings.timezone || 'Asia/Kolkata');
    setWorkingDays(timings.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    setStudentsInsideCount((getStudentsCurrentlyInside() || []).length);
  }

  async function handleSaveLabTimings(e) {
    e.preventDefault();
    try {
      await updateSettings(
        {
          labTimings: {
            openingTime: labOpeningTime,
            closingTime: labClosingTime,
            autoCheckoutEnabled,
            timezone,
            workingDays,
          },
        },
        currentUser
      );
      onToast('Lab operating hours and auto-checkout configuration saved.');
    } catch (err) {
      onToast(`Error saving lab timings: ${err.message}`);
    }
  }

  async function handleRunManualCheckout() {
    if (
      !confirm(
        'Run End-of-Day Checkout now? This will immediately close all active inside visits with exitMethod "automatic_end_of_day".'
      )
    ) {
      return;
    }
    setIsCheckingOut(true);
    try {
      const res = await executeAutoEndOfDayCheckout({ forceNow: true, actor: currentUser });
      if (res.success) {
        onToast(`End-of-day checkout complete: ${res.closedCount} active visit(s) closed.`);
        loadData();
      } else {
        onToast(`Checkout skipped: ${res.reason}`);
      }
    } catch (err) {
      onToast(`Error executing checkout: ${err.message}`);
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function handleAddDomain(e) {
    e.preventDefault();
    if (!newDomainName.trim()) return;
    try {
      await createDomain(newDomainName, currentUser);
      onToast(`Domain "${newDomainName.trim()}" added successfully.`);
      setNewDomainName('');
      loadData();
    } catch (err) {
      onToast(`Error adding domain: ${err.message}`);
    }
  }

  async function handleDeleteDomain(domainName) {
    if (!confirm(`Are you sure you want to remove domain "${domainName}"?`)) return;
    try {
      await deleteDomain(domainName, currentUser);
      onToast(`Domain "${domainName}" deleted.`);
      loadData();
    } catch (err) {
      onToast(`Error deleting domain: ${err.message}`);
    }
  }

  async function handleToggleDomain(domainName) {
    try {
      const res = await toggleDomainStatus(domainName, currentUser);
      onToast(`Domain "${domainName}" marked as ${res.active ? 'Active' : 'Deactivated'}.`);
      loadData();
    } catch (err) {
      onToast(`Error toggling domain status: ${err.message}`);
    }
  }

  async function handleAddHoliday(e) {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName.trim()) return;
    try {
      await addHoliday(
        { date: newHolidayDate, name: newHolidayName, type: newHolidayType },
        currentUser
      );
      onToast(`Holiday "${newHolidayName.trim()}" registered.`);
      setNewHolidayDate('');
      setNewHolidayName('');
      loadData();
    } catch (err) {
      onToast(`Error adding holiday: ${err.message}`);
    }
  }

  async function handleDeleteHoliday(holidayId) {
    try {
      await deleteHoliday(holidayId, currentUser);
      onToast('Holiday removed.');
      loadData();
    } catch (err) {
      onToast(`Error deleting holiday: ${err.message}`);
    }
  }

  return (
    <div className="page-container" style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Domains & Working-Day Calendar
          </h2>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            Faculty & Admin controls for incubation research fields and streak-preserving holiday dates.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--neutral-200)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'domains' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('domains')}
        >
          <Globe size={14} style={{ marginRight: '4px' }} />
          Incubation Domains ({domains.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'holidays' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('holidays')}
        >
          <Calendar size={14} style={{ marginRight: '4px' }} />
          Holidays & Streak Calendar ({holidays.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'timings' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('timings')}
        >
          <Clock size={14} style={{ marginRight: '4px' }} />
          Lab Operating Hours & Auto-Checkout
        </button>
      </div>

      {/* TAB 1: DOMAINS */}
      {activeTab === 'domains' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Domains List */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>
              Active Incubation Domains
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {domains.map((d, idx) => {
                const name = typeof d === 'string' ? d : d.name;
                const isActive = typeof d === 'string' ? true : d.active !== false;
                const projCount = projects.filter((p) => p.domain === name).length;
                const paperCount = papers.filter((p) => p.domain === name).length;

                return (
                  <div
                    key={idx}
                    className="flex-between"
                    style={{
                      padding: '0.75rem 1rem',
                      background: isActive ? '#f8fafc' : '#f1f5f9',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--neutral-200)',
                      opacity: isActive ? 1 : 0.75,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--neutral-900)' }}>{name}</strong>
                        <span
                          className={`badge ${isActive ? 'badge-success' : 'badge-secondary'}`}
                          style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="text-xs text-muted" style={{ marginTop: '0.2rem' }}>
                        {projCount} project{projCount === 1 ? '' : 's'} • {paperCount} publication{paperCount === 1 ? '' : 's'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className={`btn ${isActive ? 'btn-secondary' : 'btn-success'} btn-sm`}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                        onClick={() => handleToggleDomain(name)}
                        title={isActive ? 'Deactivate Domain' : 'Activate Domain'}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        type="button"
                        className="btn-icon"
                        style={{ color: 'var(--danger-text)' }}
                        onClick={() => handleDeleteDomain(name)}
                        title="Delete Domain"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Domain Form */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Add New Domain
            </h3>
            <p className="text-xs text-muted" style={{ marginBottom: '1rem' }}>
              Adds a research domain across projects, paper catalog, and voice search.
            </p>

            <form onSubmit={handleAddDomain}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label" htmlFor="newDomainName">Domain Name *</label>
                <input
                  id="newDomainName"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Biomedical Instrumentation"
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <Plus size={16} /> Add Domain
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: HOLIDAYS & STREAK CALENDAR */}
      {activeTab === 'holidays' && (
        <div>
          {/* Explanation Alert */}
          <div className="alert alert-info" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Flame size={24} style={{ color: '#ea580c', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.92rem' }}>Working-Day Streak Protection Engine</strong>
              <p style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>
                All Sundays are automatically skipped. Institute and national holidays added below do <strong>NOT</strong> break student daily lab streaks.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', alignItems: 'flex-start' }}>
            {/* Holidays Table */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>
                Registered Institute & National Holidays
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {holidays.map((h) => (
                  <div
                    key={h.id || h.date}
                    className="flex-between"
                    style={{
                      padding: '0.75rem 1rem',
                      background: '#f8fafc',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--neutral-200)',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.92rem' }}>{h.name}</strong>
                      <div className="text-xs text-muted font-mono" style={{ marginTop: '0.2rem' }}>
                        Date: {formatDisplayDate(h.date)} • Type: {h.type || 'institute'}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-icon"
                      style={{ color: 'var(--danger-text)' }}
                      onClick={() => handleDeleteHoliday(h.id)}
                      title="Remove Holiday"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Holiday Form */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                Register New Holiday
              </h3>
              <p className="text-xs text-muted" style={{ marginBottom: '1rem' }}>
                Protects student working-day attendance streaks when lab is closed.
              </p>

              <form onSubmit={handleAddHoliday}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="input-label" htmlFor="newHolidayDate">Holiday Date *</label>
                  <input
                    id="newHolidayDate"
                    type="date"
                    className="input-field"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="input-label" htmlFor="newHolidayName">Holiday Name / Occasion *</label>
                  <input
                    id="newHolidayName"
                    type="text"
                    className="input-field"
                    placeholder="e.g. College Tech Fest or Pongal"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="input-label" htmlFor="newHolidayType">Holiday Classification</label>
                  <select
                    id="newHolidayType"
                    className="input-field"
                    value={newHolidayType}
                    onChange={(e) => setNewHolidayType(e.target.value)}
                  >
                    <option value="institute">College / Institute Holiday</option>
                    <option value="national">National Holiday</option>
                    <option value="festival">Festival Holiday</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  <Plus size={16} /> Save Holiday
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LAB OPERATING HOURS & AUTO-CHECKOUT */}
      {activeTab === 'timings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Timings Configuration Form */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  background: '#eff6ff',
                  color: 'var(--primary-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--neutral-900)' }}>
                  Lab Operating Hours & Auto-Checkout
                </h3>
                <p className="text-muted text-xs" style={{ margin: '0.2rem 0 0' }}>
                  Define official lab hours and enable automated checkout for students who forget to check out
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveLabTimings}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="input-label" htmlFor="labOpeningTime">Lab Opening Time *</label>
                  <input
                    id="labOpeningTime"
                    type="time"
                    className="input-field"
                    value={labOpeningTime}
                    onChange={(e) => setLabOpeningTime(e.target.value)}
                    required
                  />
                  <span className="input-hint">Default: 09:00 AM</span>
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="labClosingTime">Lab Closing Time *</label>
                  <input
                    id="labClosingTime"
                    type="time"
                    className="input-field"
                    value={labClosingTime}
                    onChange={(e) => setLabClosingTime(e.target.value)}
                    required
                  />
                  <span className="input-hint">Default: 05:00 PM</span>
                </div>
              </div>

              {/* Auto Checkout Toggle */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoCheckoutEnabled}
                    onChange={(e) => setAutoCheckoutEnabled(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.92rem', color: 'var(--neutral-900)' }}>
                      Enable Automatic End-of-Day Checkout
                    </strong>
                    <p className="text-muted text-xs" style={{ margin: '0.15rem 0 0' }}>
                      Automatically marks all open student sessions as completed at closing time ({labClosingTime}).
                    </p>
                  </div>
                </label>
              </div>

              {/* Working Days */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label">Lab Working Days</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                    const isSelected = workingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => {
                          if (isSelected) {
                            setWorkingDays(workingDays.filter((d) => d !== day));
                          } else {
                            setWorkingDays([...workingDays, day]);
                          }
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Timezone */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="input-label" htmlFor="timezone">Timezone</label>
                <input
                  id="timezone"
                  type="text"
                  className="input-field"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled
                />
                <span className="input-hint">Indian Standard Time (IST)</span>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <CheckCircle2 size={16} /> Save Timings & Auto-Checkout Configuration
              </button>
            </form>
          </div>

          {/* Right Column: Live Status & Manual Action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Live Inside Lab Status Card */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live Active Sessions
                </span>
                <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Users size={13} /> {studentsInsideCount} Inside
                </span>
              </div>

              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--neutral-900)', marginBottom: '0.25rem' }}>
                {studentsInsideCount} {studentsInsideCount === 1 ? 'Student' : 'Students'}
              </div>
              <p className="text-muted text-xs" style={{ margin: 0 }}>
                {studentsInsideCount > 0
                  ? `These students currently have active inside visits that will be auto-closed at ${labClosingTime}.`
                  : 'No active student sessions currently inside the incubation lab.'}
              </p>
            </div>

            {/* Manual Auto-Checkout Trigger Card */}
            <div
              className="card"
              style={{
                padding: '1.25rem',
                border: '1px solid #fde68a',
                background: '#fffbeb',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#b45309' }}>
                <LogOut size={18} />
                <strong style={{ fontSize: '0.95rem' }}>Instant End-of-Day Checkout</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#78350f', lineHeight: '1.45', marginBottom: '1rem' }}>
                Need to close all active visits right now? Trigger manual checkout to set exit timestamps for all inside students, calculate their durations, and reset active inside counts to zero.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  background: '#ffffff',
                  borderColor: '#d97706',
                  color: '#b45309',
                  fontWeight: 700,
                }}
                onClick={handleRunManualCheckout}
                disabled={isCheckingOut || studentsInsideCount === 0}
              >
                <LogOut size={14} style={{ marginRight: '6px' }} />
                {isCheckingOut ? 'Executing Checkout...' : `Run End-of-Day Checkout Now (${studentsInsideCount} Active)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
