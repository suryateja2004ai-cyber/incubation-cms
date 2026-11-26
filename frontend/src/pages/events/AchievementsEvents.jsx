// src/pages/events/AchievementsEvents.jsx
// Permanent Achievements, Active Lab Announcements (2-3 day expiry), and Innovation Day History

import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Award,
  Megaphone,
  Calendar,
  Plus,
  Clock,
  CheckCircle2,
  DollarSign,
  Sparkles,
  Users,
  ChevronRight,
  ExternalLink,
  Archive,
  Trash2,
  Globe,
  Edit2,
} from 'lucide-react';
import {
  getAchievements,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  getActiveAnnouncements,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  archiveAnnouncement,
  deleteAnnouncement,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  subscribeToDb,
} from '../../db/database';
import { formatDisplayDate } from '../../utils/dateFormatter';

export default function AchievementsEvents({ currentUser, onToast }) {
  const [activeTab, setActiveTab] = useState('achievements'); // 'achievements', 'announcements', 'events'
  const [achievements, setAchievements] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);

  // Modals
  const [isAchievementModalOpen, setIsAchievementModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  // Edit Modals
  const [editingAchievement, setEditingAchievement] = useState(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  // Form states
  const [achTitle, setAchTitle] = useState('');
  const [achDesc, setAchDesc] = useState('');
  const [achRoll, setAchRoll] = useState('');
  const [achName, setAchName] = useState('');
  const [achPrize, setAchPrize] = useState(10000);
  const [achOrg, setAchOrg] = useState('Smart India Hackathon / IEEE');
  const [achUrl, setAchUrl] = useState('');
  const [achIsExternal, setAchIsExternal] = useState(true);

  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [annCategory, setAnnCategory] = useState('General Notice');
  const [annDuration, setAnnDuration] = useState(3);
  const [annAudience, setAnnAudience] = useState('all');
  const [annUrl, setAnnUrl] = useState('');

  const [evtTitle, setEvtTitle] = useState('');
  const [evtTheme, setEvtTheme] = useState('');
  const [evtDate, setEvtDate] = useState('');
  const [evtOrganizer, setEvtOrganizer] = useState('VRSEC Incubation Centre & Dept of ECE');
  const [evtPrizes, setEvtPrizes] = useState('₹1,00,000');
  const [evtIsInnovation, setEvtIsInnovation] = useState(true);
  const [evtDesc, setEvtDesc] = useState('');
  const [evtUrl, setEvtUrl] = useState('');
  const [evtOutcomes, setEvtOutcomes] = useState('');

  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDb(() => loadData());
    return () => unsubscribe();
  }, []);

  function loadData() {
    setAchievements(getAchievements());
    setAnnouncements(getAnnouncements());
    setEvents(getEvents());
  }

  async function handleCreateAchievementSubmit(e) {
    e.preventDefault();
    try {
      await createAchievement(
        {
          title: achTitle,
          description: achDesc,
          awardedToRoll: achRoll,
          studentName: achName || achRoll,
          prizeMoney: Number(achPrize) || 0,
          awardedBy: currentUser?.name || 'Dr. K. Venkatesh (Lab Incharge / Sir)',
          awardingOrganization: achOrg,
          verificationUrl: achUrl,
          isExternalAward: achIsExternal,
        },
        currentUser
      );
      onToast(`Permanent achievement awarded to ${achRoll}!`);
      setIsAchievementModalOpen(false);
      setAchTitle('');
      setAchDesc('');
      setAchRoll('');
      setAchName('');
      setAchUrl('');
      loadData();
    } catch (err) {
      onToast(`Error awarding achievement: ${err.message}`);
    }
  }

  async function handleCreateAnnouncementSubmit(e) {
    e.preventDefault();
    try {
      await createAnnouncement(
        {
          title: annTitle,
          message: annMsg,
          category: annCategory,
          durationDays: Number(annDuration) || 3,
          targetAudience: annAudience,
          externalUrl: annUrl,
        },
        currentUser
      );
      onToast('Announcement posted with automatic expiration!');
      setIsAnnouncementModalOpen(false);
      setAnnTitle('');
      setAnnMsg('');
      setAnnUrl('');
      loadData();
    } catch (err) {
      onToast(`Error posting announcement: ${err.message}`);
    }
  }

  async function handleArchiveAnnouncement(id) {
    try {
      await archiveAnnouncement(id, currentUser);
      onToast('Announcement archived.');
      loadData();
    } catch (err) {
      onToast(`Archive error: ${err.message}`);
    }
  }

  async function handleDeleteAnnouncement(id) {
    if (!confirm('Are you sure you want to permanently delete this announcement?')) return;
    try {
      await deleteAnnouncement(id, currentUser);
      onToast('Announcement deleted.');
      loadData();
    } catch (err) {
      onToast(`Delete error: ${err.message}`);
    }
  }

  async function handleDeleteAchievement(id) {
    if (!confirm('Are you sure you want to permanently delete this achievement?')) return;
    try {
      await deleteAchievement(id, currentUser);
      onToast('Achievement deleted.');
      loadData();
    } catch (err) {
      onToast(`Delete error: ${err.message}`);
    }
  }

  async function handleDeleteEvent(id) {
    if (!confirm('Are you sure you want to permanently delete this Innovation Day event?')) return;
    try {
      await deleteEvent(id, currentUser);
      onToast('Event deleted.');
      loadData();
    } catch (err) {
      onToast(`Delete error: ${err.message}`);
    }
  }

  async function handleSaveEditAchievement(e) {
    e.preventDefault();
    if (!editingAchievement) return;
    try {
      await updateAchievement(editingAchievement.id, editingAchievement, currentUser);
      onToast('Achievement updated.');
      setEditingAchievement(null);
      loadData();
    } catch (err) {
      onToast(`Update error: ${err.message}`);
    }
  }

  async function handleSaveEditAnnouncement(e) {
    e.preventDefault();
    if (!editingAnnouncement) return;
    try {
      await updateAnnouncement(editingAnnouncement.id, editingAnnouncement, currentUser);
      onToast('Announcement updated.');
      setEditingAnnouncement(null);
      loadData();
    } catch (err) {
      onToast(`Update error: ${err.message}`);
    }
  }

  async function handleSaveEditEvent(e) {
    e.preventDefault();
    if (!editingEvent) return;
    try {
      await updateEvent(editingEvent.id, editingEvent, currentUser);
      onToast('Event updated.');
      setEditingEvent(null);
      loadData();
    } catch (err) {
      onToast(`Update error: ${err.message}`);
    }
  }

  async function handleCreateEventSubmit(e) {
    e.preventDefault();
    try {
      await createEvent(
        {
          title: evtTitle,
          theme: evtTheme,
          eventDate: evtDate,
          organizer: evtOrganizer,
          prizes: evtPrizes,
          isInnovationDay: evtIsInnovation,
          description: evtDesc,
          externalUrl: evtUrl,
          outcomes: evtOutcomes,
        },
        currentUser
      );
      onToast('Innovation event created!');
      setIsEventModalOpen(false);
      setEvtTitle('');
      setEvtTheme('');
      setEvtDate('');
      setEvtUrl('');
      setEvtOutcomes('');
      loadData();
    } catch (err) {
      onToast(`Error creating event: ${err.message}`);
    }
  }

  const activeAnnouncements = getActiveAnnouncements();

  return (
    <div className="page-container" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Achievements, Announcements & Innovation Day
          </h2>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            Permanent national hackathon honors, lab notices, and historical VRSEC Innovation Day records.
          </p>
        </div>

        {isSirOrAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAnnouncementModalOpen(true)}
            >
              <Megaphone size={16} /> Post Notice
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsAchievementModalOpen(true)}
            >
              <Award size={16} /> Award Achievement
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--neutral-200)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'achievements' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('achievements')}
        >
          <Trophy size={14} style={{ marginRight: '4px' }} />
          Permanent Achievements ({achievements.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'announcements' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('announcements')}
        >
          <Megaphone size={14} style={{ marginRight: '4px' }} />
          Active Announcements ({activeAnnouncements.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'events' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('events')}
        >
          <Calendar size={14} style={{ marginRight: '4px' }} />
          Innovation Day History ({events.length})
        </button>
      </div>

      {/* TAB 1: PERMANENT ACHIEVEMENTS */}
      {activeTab === 'achievements' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className="card"
              style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #ffffff 0%, #fdfbf7 100%)',
                border: '1px solid #fef3c7',
                boxShadow: 'var(--shadow-md)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: 60,
                  height: 60,
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trophy size={28} style={{ color: '#d97706' }} />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '0.2rem 0.6rem',
                    borderRadius: 999,
                    border: '1px solid #fde68a',
                  }}
                >
                  PERMANENT RECORD
                </span>
              </div>

              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--neutral-900)', marginBottom: '0.35rem' }}>
                {ach.title}
              </h3>

              <p style={{ fontSize: '0.85rem', color: 'var(--neutral-600)', lineHeight: '1.45', marginBottom: '1rem' }}>
                {ach.description}
              </p>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                }}
              >
                <div className="flex-between" style={{ marginBottom: '0.35rem' }}>
                  <span className="text-xs text-muted">Awarded To:</span>
                  <strong style={{ fontSize: '0.88rem' }}>{ach.studentName} ({ach.awardedToRoll})</strong>
                </div>

                {ach.prizeMoney > 0 && (
                  <div className="flex-between" style={{ marginBottom: '0.35rem' }}>
                    <span className="text-xs text-muted">Prize Money:</span>
                    <strong style={{ fontSize: '0.95rem', color: '#16a34a' }}>
                      ₹{ach.prizeMoney.toLocaleString('en-IN')}
                    </strong>
                  </div>
                )}

                {ach.awardingOrganization && (
                  <div className="flex-between" style={{ marginBottom: '0.35rem' }}>
                    <span className="text-xs text-muted">Organization:</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{ach.awardingOrganization}</span>
                  </div>
                )}

                <div className="flex-between">
                  <span className="text-xs text-muted">Awarded By:</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{ach.awardedBy}</span>
                </div>
              </div>

              <div className="flex-between" style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>
                {ach.verificationUrl ? (
                  <a
                    href={ach.verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary flex-center"
                    style={{ gap: '4px', textDecoration: 'underline' }}
                  >
                    <ExternalLink size={12} /> Verify Credential
                  </a>
                ) : <span />}
                <span>Award Date: {formatDisplayDate(ach.dateAwarded)}</span>
              </div>

              {isSirOrAdmin && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px solid #fef3c7', paddingTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => setEditingAchievement({ ...ach })}
                    title="Edit Achievement"
                  >
                    <Edit2 size={12} style={{ marginRight: '3px' }} /> Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => handleDeleteAchievement(ach.id)}
                    title="Delete Achievement"
                  >
                    <Trash2 size={12} style={{ marginRight: '3px' }} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: ACTIVE ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <div>
          {activeAnnouncements.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Megaphone size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No active notices</h4>
              <p className="text-muted text-sm">All recent announcements have naturally expired.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeAnnouncements.map((ann) => {
                const diffMs = new Date(ann.expiresAt).getTime() - Date.now();
                const daysRemaining = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

                return (
                  <div
                    key={ann.id}
                    className="card"
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderLeft: '4px solid var(--primary)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    }}
                  >
                    <div className="flex-between" style={{ marginBottom: '0.45rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge badge-primary">{ann.category}</span>
                        <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>
                          ⏱ Expires in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}
                        </span>
                      </div>
                      <span className="text-xs text-muted">{formatDisplayDate(ann.createdAt)}</span>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--neutral-900)', marginBottom: '0.35rem' }}>
                      {ann.title}
                    </h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--neutral-700)', lineHeight: '1.45', margin: '0.45rem 0' }}>
                      {ann.message}
                    </p>

                    <div className="flex-between" style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span>Posted by: <strong>{ann.createdBy}</strong></span>
                        {ann.targetAudience && (
                          <span style={{ background: '#e2e8f0', padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.7rem' }}>
                            Audience: {ann.targetAudience}
                          </span>
                        )}
                        {ann.externalUrl && (
                          <a
                            href={ann.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary flex-center"
                            style={{ gap: '3px', textDecoration: 'underline' }}
                          >
                            <ExternalLink size={12} /> External Link
                          </a>
                        )}
                      </div>

                      {isSirOrAdmin && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => setEditingAnnouncement({ ...ann })}
                            title="Edit Notice"
                          >
                            <Edit2 size={12} style={{ marginRight: '3px' }} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => handleArchiveAnnouncement(ann.id)}
                            title="Archive Notice"
                          >
                            <Archive size={12} style={{ marginRight: '3px' }} /> Archive
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            title="Delete Notice"
                          >
                            <Trash2 size={12} style={{ marginRight: '3px' }} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INNOVATION DAY & EVENTS */}
      {activeTab === 'events' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {isSirOrAdmin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEventModalOpen(true)}
              >
                <Plus size={16} /> Add Innovation Day Event
              </button>
            </div>
          )}

          {events.map((evt) => (
            <div
              key={evt.id}
              className="card"
              style={{
                padding: '1.5rem',
                borderLeft: evt.isInnovationDay ? '4px solid #f59e0b' : '4px solid var(--primary)',
              }}
            >
              <div className="flex-between" style={{ marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className={`badge ${evt.isInnovationDay ? 'badge-warning' : 'badge-primary'}`}>
                      {evt.isInnovationDay ? 'VRSEC Innovation Day' : 'Centre Event'}
                    </span>
                    <span className="font-mono text-xs text-muted">Year {evt.year}</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                    {evt.title}
                  </h3>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a' }}>
                    Prizes: {evt.prizes}
                  </div>
                  <div className="text-xs text-muted">{formatDisplayDate(evt.eventDate)}</div>
                </div>
              </div>

              {evt.theme && (
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                  Theme: "{evt.theme}"
                </div>
              )}

              <p style={{ fontSize: '0.85rem', color: 'var(--neutral-600)', lineHeight: '1.45', marginBottom: '1rem' }}>
                {evt.description}
              </p>

              {/* Winners Table */}
              {evt.winners && evt.winners.length > 0 && (
                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--neutral-500)', marginBottom: '0.5rem' }}>
                    Honored Winners & Projects
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {evt.winners.map((w, idx) => (
                      <div key={idx} className="flex-between text-xs">
                        <span>
                          <strong>{w.rank}:</strong> {w.team} — <em>{w.project}</em>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {evt.organizer && (
                <div style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', marginTop: '0.5rem' }}>
                  Organized by: <strong>{evt.organizer}</strong>
                </div>
              )}
              {evt.outcomes && (
                <div style={{ fontSize: '0.8rem', color: 'var(--neutral-600)', marginTop: '0.25rem' }}>
                  Key Outcomes: {evt.outcomes}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1rem', borderTop: '1px solid var(--neutral-200)', paddingTop: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {(evt.registrationUrl || evt.externalUrl) && (
                    <a
                      href={evt.registrationUrl || evt.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                    >
                      <ExternalLink size={13} /> Register Now
                    </a>
                  )}
                </div>

                {isSirOrAdmin && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                      onClick={() => setEditingEvent({ ...evt })}
                      title="Edit Innovation Event"
                    >
                      <Edit2 size={12} style={{ marginRight: '3px' }} /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                      onClick={() => handleDeleteEvent(evt.id)}
                      title="Delete Innovation Event"
                    >
                      <Trash2 size={12} style={{ marginRight: '3px' }} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AWARD ACHIEVEMENT MODAL */}
      {isAchievementModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setIsAchievementModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy size={22} className="text-primary" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Award Permanent Achievement</h3>
              </div>
            </div>

            <form onSubmit={handleCreateAchievementSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label" htmlFor="achTitle">Achievement / Honor Title *</label>
                <input
                  id="achTitle"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Smart India Hackathon 2026 Winner"
                  value={achTitle}
                  onChange={(e) => setAchTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label" htmlFor="achRoll">Student Roll No. *</label>
                  <input
                    id="achRoll"
                    type="text"
                    className="input-field"
                    placeholder="e.g. 238W1A0477"
                    value={achRoll}
                    onChange={(e) => setAchRoll(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="achName">Student Full Name</label>
                  <input
                    id="achName"
                    type="text"
                    className="input-field"
                    placeholder="e.g. Anwar Bajarinti"
                    value={achName}
                    onChange={(e) => setAchName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label" htmlFor="achOrg">Awarding Organization</label>
                  <input
                    id="achOrg"
                    type="text"
                    className="input-field"
                    placeholder="e.g. AICTE / IEEE / Govt of India"
                    value={achOrg}
                    onChange={(e) => setAchOrg(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="achPrize">Prize Money (₹)</label>
                  <input
                    id="achPrize"
                    type="number"
                    className="input-field"
                    value={achPrize}
                    onChange={(e) => setAchPrize(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label" htmlFor="achUrl">Verification Link / Certificate URL (Optional)</label>
                <input
                  id="achUrl"
                  type="url"
                  className="input-field"
                  placeholder="https://hackathon.gov.in/winners/2026..."
                  value={achUrl}
                  onChange={(e) => setAchUrl(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={achIsExternal}
                    onChange={(e) => setAchIsExternal(e.target.checked)}
                  />
                  <span>External / National Level Honor (Received outside VRSEC)</span>
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label" htmlFor="achDesc">Citation / Description</label>
                <textarea
                  id="achDesc"
                  className="input-field"
                  rows={3}
                  placeholder="Details of the innovation, problem statement solved, and honor awarded..."
                  value={achDesc}
                  onChange={(e) => setAchDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAchievementModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Award Permanent Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POST ANNOUNCEMENT MODAL */}
      {isAnnouncementModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setIsAnnouncementModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Megaphone size={22} className="text-primary" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Post Lab Announcement</h3>
              </div>
            </div>

            <form onSubmit={handleCreateAnnouncementSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label" htmlFor="annTitle">Notice Title *</label>
                <input
                  id="annTitle"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Prototype Submissions Open"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label" htmlFor="annCategory">Category</label>
                  <select
                    id="annCategory"
                    className="input-field"
                    value={annCategory}
                    onChange={(e) => setAnnCategory(e.target.value)}
                  >
                    <option value="General Notice">General Notice</option>
                    <option value="Innovation Day">Innovation Day</option>
                    <option value="Component Restock">Component Restock</option>
                    <option value="Workshop / Hackathon">Workshop / Hackathon</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="annDuration">Auto-Expire In (Days)</label>
                  <select
                    id="annDuration"
                    className="input-field"
                    value={annDuration}
                    onChange={(e) => setAnnDuration(Number(e.target.value))}
                  >
                    <option value={1}>1 Day</option>
                    <option value={2}>2 Days</option>
                    <option value={3}>3 Days (Recommended)</option>
                    <option value={5}>5 Days</option>
                    <option value={7}>7 Days</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label" htmlFor="annAudience">Target Audience</label>
                  <select
                    id="annAudience"
                    className="input-field"
                    value={annAudience}
                    onChange={(e) => setAnnAudience(e.target.value)}
                  >
                    <option value="all">All Members & Visitors</option>
                    <option value="students">Students Only</option>
                    <option value="admins">Admin / Lab Incharges</option>
                    <option value="faculty">Faculty Mentors</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="annUrl">External Link (Optional)</label>
                  <input
                    id="annUrl"
                    type="url"
                    className="input-field"
                    placeholder="https://..."
                    value={annUrl}
                    onChange={(e) => setAnnUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label" htmlFor="annMsg">Notice Message *</label>
                <textarea
                  id="annMsg"
                  className="input-field"
                  rows={4}
                  placeholder="Detailed text for student researchers and visitors..."
                  value={annMsg}
                  onChange={(e) => setAnnMsg(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAnnouncementModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE EVENT MODAL */}
      {isEventModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setIsEventModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={22} className="text-primary" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Create Innovation Day / Event</h3>
              </div>
            </div>

            <form onSubmit={handleCreateEventSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label" htmlFor="evtTitle">Event Title *</label>
                <input
                  id="evtTitle"
                  type="text"
                  className="input-field"
                  placeholder="e.g. VRSEC Innovation Day 2026"
                  value={evtTitle}
                  onChange={(e) => setEvtTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label" htmlFor="evtTheme">Theme</label>
                <input
                  id="evtTheme"
                  type="text"
                  className="input-field"
                  placeholder="e.g. AI-Driven IoT & Edge Hardware"
                  value={evtTheme}
                  onChange={(e) => setEvtTheme(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label" htmlFor="evtDate">Date *</label>
                  <input
                    id="evtDate"
                    type="date"
                    className="input-field"
                    value={evtDate}
                    onChange={(e) => setEvtDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="evtPrizes">Prize Pool</label>
                  <input
                    id="evtPrizes"
                    type="text"
                    className="input-field"
                    value={evtPrizes}
                    onChange={(e) => setEvtPrizes(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label" htmlFor="evtOrganizer">Organizer</label>
                  <input
                    id="evtOrganizer"
                    type="text"
                    className="input-field"
                    value={evtOrganizer}
                    onChange={(e) => setEvtOrganizer(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="evtUrl">External / Registration Link</label>
                  <input
                    id="evtUrl"
                    type="url"
                    className="input-field"
                    placeholder="https://..."
                    value={evtUrl}
                    onChange={(e) => setEvtUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label" htmlFor="evtOutcomes">Key Outcomes / Highlights</label>
                <input
                  id="evtOutcomes"
                  type="text"
                  className="input-field"
                  placeholder="e.g. 40 prototypes presented, 3 patents filed"
                  value={evtOutcomes}
                  onChange={(e) => setEvtOutcomes(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label" htmlFor="evtDesc">Description</label>
                <textarea
                  id="evtDesc"
                  className="input-field"
                  rows={3}
                  value={evtDesc}
                  onChange={(e) => setEvtDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEventModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ACHIEVEMENT MODAL */}
      {editingAchievement && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setEditingAchievement(null)}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={22} className="text-primary" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Edit Achievement</h3>
              </div>
            </div>

            <form onSubmit={handleSaveEditAchievement}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Achievement / Honor Title *</label>
                <input
                  type="text"
                  className="input-field"
                  value={editingAchievement.title || ''}
                  onChange={(e) => setEditingAchievement({ ...editingAchievement, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label">Awardee Roll Number</label>
                  <input
                    type="text"
                    className="input-field uppercase-input"
                    value={editingAchievement.awardedToRoll || ''}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, awardedToRoll: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="input-label">Student Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingAchievement.studentName || ''}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, studentName: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label">Prize / Grant Money (₹)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={editingAchievement.prizeMoney || 0}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, prizeMoney: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="input-label">Awarding Organization</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingAchievement.awardingOrganization || ''}
                    onChange={(e) => setEditingAchievement({ ...editingAchievement, awardingOrganization: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Verification / Certificate URL</label>
                <input
                  type="url"
                  className="input-field"
                  value={editingAchievement.verificationUrl || ''}
                  onChange={(e) => setEditingAchievement({ ...editingAchievement, verificationUrl: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label">Description / Citation</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={editingAchievement.description || ''}
                  onChange={(e) => setEditingAchievement({ ...editingAchievement, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingAchievement(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ANNOUNCEMENT MODAL */}
      {editingAnnouncement && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setEditingAnnouncement(null)}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={22} className="text-primary" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Edit Announcement</h3>
              </div>
            </div>

            <form onSubmit={handleSaveEditAnnouncement}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Title *</label>
                <input
                  type="text"
                  className="input-field"
                  value={editingAnnouncement.title || ''}
                  onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label">Category</label>
                  <select
                    className="input-field"
                    value={editingAnnouncement.category || 'General Notice'}
                    onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, category: e.target.value })}
                  >
                    <option value="General Notice">General Notice</option>
                    <option value="Lab Timings">Lab Timings</option>
                    <option value="Component Shortage">Component Shortage</option>
                    <option value="Project Submissions">Project Submissions</option>
                    <option value="Hackathon Alert">Hackathon Alert</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="input-label">Audience</label>
                  <select
                    className="input-field"
                    value={editingAnnouncement.targetAudience || 'all'}
                    onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, targetAudience: e.target.value })}
                  >
                    <option value="all">All Students & Staff</option>
                    <option value="students">Students Only</option>
                    <option value="staff">Staff Only</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">External Action URL</label>
                <input
                  type="url"
                  className="input-field"
                  value={editingAnnouncement.externalUrl || ''}
                  onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, externalUrl: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label">Message *</label>
                <textarea
                  className="input-field"
                  rows={4}
                  value={editingAnnouncement.message || ''}
                  onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, message: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingAnnouncement(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EVENT MODAL */}
      {editingEvent && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setEditingEvent(null)}>
          <div className="modal-content" style={{ maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={22} className="text-primary" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Edit Event</h3>
              </div>
            </div>

            <form onSubmit={handleSaveEditEvent}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Event Title *</label>
                <input
                  type="text"
                  className="input-field"
                  value={editingEvent.title || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label">Event Date *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={editingEvent.eventDate ? editingEvent.eventDate.split('T')[0] : ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, eventDate: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="input-label">Theme</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingEvent.theme || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, theme: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label">Total Cash Prizes</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingEvent.prizes || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, prizes: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="input-label">Registration / External Link</label>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://..."
                    value={editingEvent.externalUrl || editingEvent.registrationUrl || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, externalUrl: e.target.value, registrationUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Key Outcomes / Highlights</label>
                <input
                  type="text"
                  className="input-field"
                  value={editingEvent.outcomes || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, outcomes: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label">Description</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={editingEvent.description || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingEvent(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
