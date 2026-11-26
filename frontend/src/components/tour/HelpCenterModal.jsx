// src/components/tour/HelpCenterModal.jsx
// Interactive Help & Tutorials Center Modal
// Displays categorized tutorials, Complete Portal Tour, progress badges, search, and resume/restart options

import React, { useState, useMemo } from 'react';
import {
  HelpCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  Search,
  Sparkles,
  Layers,
  GraduationCap,
  Sliders,
  Users,
  Cpu,
  BookOpen,
  X,
  Compass,
} from 'lucide-react';
import { getTutorialsForRole, TUTORIAL_CATEGORIES } from '../../services/tour/TutorialRegistry';
import {
  getTourProgress,
  isTutorialCompleted,
  getResumeStep,
  resetAllTutorialProgress,
} from '../../services/tour/TutorialProgressService';

export default function HelpCenterModal({
  isOpen,
  onClose,
  currentUser,
  onStartTutorial,
  onRestartTutorial,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const role = currentUser?.role || (currentUser?.rollNumber ? 'student' : 'admin');
  const roleTutorials = useMemo(() => getTutorialsForRole(role), [role]);
  const progress = useMemo(() => getTourProgress(currentUser), [currentUser, isOpen]);

  // Separate Complete Tour from individual tutorials
  const completeTour = useMemo(
    () => roleTutorials.find((t) => t.isCompleteTour) || null,
    [roleTutorials]
  );

  const individualTutorials = useMemo(
    () => roleTutorials.filter((t) => !t.isCompleteTour),
    [roleTutorials]
  );

  // Filter tutorials by search query and category
  const filteredTutorials = useMemo(() => {
    return individualTutorials.filter((tut) => {
      if (selectedCategory === 'COMPLETED') {
        if (!progress.completedTutorials[tut.id]) return false;
      } else if (selectedCategory !== 'ALL' && tut.category !== selectedCategory) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          tut.title.toLowerCase().includes(q) ||
          tut.description.toLowerCase().includes(q) ||
          tut.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [individualTutorials, selectedCategory, searchQuery, progress]);

  const completedCount = useMemo(() => {
    return roleTutorials.filter((t) => progress.completedTutorials[t.id]).length;
  }, [roleTutorials, progress]);

  if (!isOpen) return null;

  const completeTourProgress = completeTour ? progress.inProgressTutorials[completeTour.id] : null;
  const isCompleteTourDone = completeTour ? Boolean(progress.completedTutorials[completeTour.id]) : false;

  return (
    <div
      className="modal-backdrop"
      style={{
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: '920px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          padding: 0,
          background: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >
              <HelpCircle size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  Help & Guided Tours
                </h3>
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.55rem',
                    borderRadius: 999,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {role === 'admin' ? 'Super Admin' : role === 'sir' ? 'Lab Director' : role === 'staff' ? 'Lab Staff' : 'Student'}
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', margin: 0, opacity: 0.9 }}>
                Interactive personal instructor for the Incubation Centre portal
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{
              color: '#ffffff',
              background: 'rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              width: 32,
              height: 32,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search tutorials, operations, components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.25rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', maxWidth: '100%', paddingBottom: '2px' }}>
            <button
              type="button"
              className={`btn-badge ${selectedCategory === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('ALL')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 999,
                fontSize: '0.78rem',
                fontWeight: 600,
                background: selectedCategory === 'ALL' ? 'var(--primary)' : '#ffffff',
                color: selectedCategory === 'ALL' ? '#ffffff' : 'var(--neutral-700)',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
              }}
            >
              All ({individualTutorials.length})
            </button>

            {Object.values(TUTORIAL_CATEGORIES).map((cat) => {
              const count = individualTutorials.filter((t) => t.category === cat).length;
              if (count === 0) return null;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 999,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: isSelected ? 'var(--primary)' : '#ffffff',
                    color: isSelected ? '#ffffff' : 'var(--neutral-700)',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat} ({count})
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSelectedCategory('COMPLETED')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 999,
                fontSize: '0.78rem',
                fontWeight: 600,
                background: selectedCategory === 'COMPLETED' ? '#10b981' : '#ffffff',
                color: selectedCategory === 'COMPLETED' ? '#ffffff' : '#047857',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <CheckCircle2 size={13} /> Completed ({completedCount})
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* FEATURED: COMPLETE PORTAL TOUR HERO BANNER */}
          {completeTour && selectedCategory === 'ALL' && !searchQuery.trim() && (
            <div
              style={{
                background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                border: '2px solid #c7d2fe',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '14px',
                    background: '#4f46e5',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 16px -4px rgba(79, 70, 229, 0.4)',
                  }}
                >
                  <Compass size={28} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span
                      style={{
                        background: '#4f46e5',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 999,
                      }}
                    >
                      FEATURED
                    </span>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e1b4b', margin: 0 }}>
                      {completeTour.title}
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#3730a3', margin: 0, maxWidth: '520px', lineHeight: 1.4 }}>
                    {completeTour.description}
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', fontSize: '0.75rem', color: '#4338ca', fontWeight: 600 }}>
                    <span>⏱ ~{completeTour.estimatedMinutes} minutes</span>
                    <span>• {completeTour.steps.length} interactive steps</span>
                    {isCompleteTourDone && <span style={{ color: '#047857' }}>✓ Completed</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {completeTourProgress ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => onStartTutorial(completeTour.id, completeTourProgress.currentStepIndex)}
                    style={{ fontWeight: 700, padding: '0.55rem 1.15rem' }}
                  >
                    <Play size={15} fill="currentColor" /> Resume (Step {completeTourProgress.currentStepIndex + 1})
                  </button>
                ) : isCompleteTourDone ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => onRestartTutorial(completeTour.id)}
                    style={{ fontWeight: 700, padding: '0.55rem 1.15rem' }}
                  >
                    <RotateCcw size={15} /> Restart Tour
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => onStartTutorial(completeTour.id, 0)}
                    style={{ fontWeight: 700, padding: '0.55rem 1.15rem' }}
                  >
                    <Play size={15} fill="currentColor" /> Start Complete Tour
                  </button>
                )}
              </div>
            </div>
          )}

          {/* INDIVIDUAL TUTORIALS GRID */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                Individual Feature Tutorials ({filteredTutorials.length})
              </h4>
              <span className="text-muted text-xs">
                Click any tutorial to start interactive walkthrough
              </span>
            </div>

            {filteredTutorials.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px dashed #cbd5e1',
                }}
              >
                <BookOpen size={36} style={{ color: '#94a3b8', margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.92rem', color: '#64748b', fontWeight: 600 }}>
                  No tutorials matched your current search or category filter.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '1rem' }}>
                {filteredTutorials.map((tut) => {
                  const isDone = Boolean(progress.completedTutorials[tut.id]);
                  const inProg = progress.inProgressTutorials[tut.id];

                  return (
                    <div
                      key={tut.id}
                      style={{
                        background: '#ffffff',
                        border: isDone ? '1.5px solid #a7f3d0' : inProg ? '1.5px solid #c7d2fe' : '1px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      <div>
                        {/* Top Tag Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: 'var(--neutral-500)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                            }}
                          >
                            {tut.category}
                          </span>

                          {isDone ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                background: '#dcfce7',
                                color: '#15803d',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: 999,
                              }}
                            >
                              <CheckCircle2 size={12} /> Completed
                            </span>
                          ) : inProg ? (
                            <span
                              style={{
                                background: '#e0e7ff',
                                color: '#3730a3',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: 999,
                              }}
                            >
                              Step {inProg.currentStepIndex + 1}
                            </span>
                          ) : tut.safeLearningMode ? (
                            <span
                              style={{
                                background: '#fef3c7',
                                color: '#92400e',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: 999,
                              }}
                              title="Safe Learning: Real database records will not be modified"
                            >
                              Safe Learning
                            </span>
                          ) : null}
                        </div>

                        <h5 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--neutral-900)', marginBottom: '0.35rem' }}>
                          {tut.title}
                        </h5>

                        <p style={{ fontSize: '0.82rem', color: 'var(--neutral-600)', lineHeight: 1.45, margin: 0 }}>
                          {tut.description}
                        </p>
                      </div>

                      {/* Footer Info & Actions */}
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                          <span>⏱ {tut.estimatedMinutes} min</span>
                          <span>{tut.steps.length} steps</span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {inProg ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => onStartTutorial(tut.id, inProg.currentStepIndex)}
                                style={{ flex: 1, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                              >
                                <Play size={13} fill="currentColor" /> Resume
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => onRestartTutorial(tut.id)}
                                title="Restart from beginning"
                                style={{ padding: '0.35rem 0.6rem' }}
                              >
                                <RotateCcw size={13} />
                              </button>
                            </>
                          ) : isDone ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => onRestartTutorial(tut.id)}
                                style={{ flex: 1, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                              >
                                <RotateCcw size={13} /> Restart
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => onStartTutorial(tut.id, 0)}
                                style={{ flex: 1, fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                              >
                                Replay
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => onStartTutorial(tut.id, 0)}
                              style={{ width: '100%', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                            >
                              <Play size={13} fill="currentColor" /> Start Tutorial
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--neutral-600)' }}>
            Completed <strong>{completedCount}</strong> of <strong>{roleTutorials.length}</strong> available tutorials for your role.
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Close Help Center
          </button>
        </div>
      </div>
    </div>
  );
}
