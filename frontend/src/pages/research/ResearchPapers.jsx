// src/pages/research/ResearchPapers.jsx
// Research Publications & Conference Papers Catalog
// Metadata-only storage (Zero Heavy PDF Blobs to guarantee storage protection)
// Features: Domain filter, IEEE/Journal badges, DOI links, and Public/Private toggle.

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  ExternalLink,
  Globe,
  Lock,
  Tag,
  Users,
  Award,
  Trash2,
  Edit2,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import {
  getResearchPapers,
  createResearchPaper,
  updateResearchPaper,
  deleteResearchPaper,
  getDomains,
  subscribeToDb,
} from '../../db/database';
import { formatDisplayDate } from '../../utils/dateFormatter';

export default function ResearchPapers({ currentUser, onToast }) {
  const [papers, setPapers] = useState([]);
  const [domains, setDomains] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [authorsText, setAuthorsText] = useState(currentUser?.name || '');
  const [studentRoll, setStudentRoll] = useState(currentUser?.rollNumber || '');
  const [teamName, setTeamName] = useState('');
  const [domain, setDomain] = useState('');
  const [venue, setVenue] = useState('');
  const [paperType, setPaperType] = useState('conference');
  const [doi, setDoi] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [status, setStatus] = useState('published');
  const [publicationDate, setPublicationDate] = useState(new Date().toISOString().slice(0, 10));
  const [isScopusIndexed, setIsScopusIndexed] = useState(false);
  const [isIeeeIndexed, setIsIeeeIndexed] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [editingPaperId, setEditingPaperId] = useState(null);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDb(() => loadData());
    return () => unsubscribe();
  }, []);

  async function loadData() {
    const localPapers = getResearchPapers();
    setPapers(localPapers);
    setDomains(getDomains());

    try {
      const res = await fetch('/api/publications');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data) && json.data.length > 0) {
          const pgPapers = json.data.map((p) => ({
            id: p.id,
            title: p.title,
            abstract: p.abstract || '',
            domain: p.domain || 'IoT & Embedded Systems',
            paperType: p.paper_type || 'conference',
            venue: p.journal_conference_name || '',
            studentRoll: p.student_roll || '',
            studentName: p.student_name || '',
            authors: Array.isArray(p.authors) ? p.authors : [p.student_name || 'Author'],
            doi: p.doi || '',
            externalUrl: p.external_url || '',
            publicationDate: p.publication_date || p.created_at || new Date().toISOString(),
            isPublic: true,
            status: 'published',
          }));

          const combined = [...localPapers];
          pgPapers.forEach((pgP) => {
            if (!combined.some((cp) => cp.id === pgP.id || cp.title.toLowerCase() === pgP.title.toLowerCase())) {
              combined.push(pgP);
            }
          });
          setPapers(combined);
        }
      }
    } catch {
      // offline fallback
    }
  }

  function resetForm() {
    setTitle('');
    setAuthorsText(currentUser?.name || '');
    setStudentRoll(currentUser?.rollNumber || '');
    setTeamName('');
    setDomain('');
    setVenue('');
    setPaperType('conference');
    setDoi('');
    setExternalUrl('');
    setRepositoryUrl('');
    setStatus('published');
    setPublicationDate(new Date().toISOString().slice(0, 10));
    setIsScopusIndexed(false);
    setIsIeeeIndexed(false);
    setIsPublic(true);
    setEditingPaperId(null);
  }

  function handleOpenCreate() {
    resetForm();
    setIsSubmitModalOpen(true);
  }

  function handleOpenEdit(p) {
    setEditingPaperId(p.id);
    setTitle(p.title || '');
    setAuthorsText((p.authors || []).join(', '));
    setStudentRoll(p.studentRoll || '');
    setTeamName(p.teamName || '');
    setDomain(p.domain || '');
    setVenue(p.venue || '');
    setPaperType(p.paperType || 'conference');
    setDoi(p.doi || '');
    setExternalUrl(p.externalUrl || '');
    setRepositoryUrl(p.repositoryUrl || '');
    setStatus(p.status || 'published');
    setPublicationDate(p.publicationDate ? p.publicationDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setIsScopusIndexed(!!p.isScopusIndexed);
    setIsIeeeIndexed(!!p.isIeeeIndexed);
    setIsPublic(p.isPublic !== false);
    setIsSubmitModalOpen(true);
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this research publication entry?')) return;
    try {
      await deleteResearchPaper(id, currentUser);
      onToast('Research publication removed.');
      loadData();
    } catch (err) {
      onToast(`Error deleting paper: ${err.message}`);
    }
  }

  function canManagePaper(p) {
    if (!currentUser) return false;
    const isSirOrAdmin =
      currentUser.role === 'admin' ||
      currentUser.role === 'sir' ||
      currentUser.role === 'substitute_admin';
    if (isSirOrAdmin) return true;
    if (currentUser.rollNumber && currentUser.rollNumber === p.studentRoll) return true;
    if (currentUser.name && currentUser.name === p.submittedBy) return true;
    return false;
  }

  async function handleSubmitPaper(e) {
    e.preventDefault();
    try {
      const authors = authorsText
        ? authorsText.split(',').map((a) => a.trim())
        : [currentUser?.name || 'Author'];

      const chosenDomain = (domain || '').trim() || 'IoT & Embedded Systems';

      const payload = {
        title,
        authors,
        studentRoll: studentRoll || currentUser?.rollNumber || '',
        teamName,
        domain: chosenDomain,
        venue,
        paperType,
        doi,
        externalUrl,
        repositoryUrl,
        status,
        publicationDate,
        isScopusIndexed,
        isIeeeIndexed,
        isPublic,
      };

      if (editingPaperId) {
        await updateResearchPaper(editingPaperId, payload, currentUser);
        onToast(`Paper "${title}" updated successfully!`);
      } else {
        await createResearchPaper(payload, currentUser);
        onToast(`Research paper "${title}" registered successfully in ${chosenDomain}!`);
      }

      // Also persist to PostgreSQL backend /api/publications
      try {
        await fetch('/api/publications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingPaperId || undefined,
            title,
            abstract: venue || '',
            domain: chosenDomain,
            paper_type: paperType,
            journal_conference_name: venue,
            student_roll: studentRoll || currentUser?.rollNumber || 'STUDENT',
            student_name: currentUser?.name || authors[0] || 'Student',
            authors,
            doi,
            external_url: externalUrl,
            publication_date: publicationDate,
          }),
        });
      } catch (pgErr) {
        console.warn('[PostgreSQL publications sync]:', pgErr.message);
      }

      setIsSubmitModalOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      onToast(`Error submitting paper: ${err.message}`);
    }
  }

  const filteredPapers = papers.filter((p) => {
    if (selectedDomain !== 'all' && p.domain !== selectedDomain) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchRoll = (p.studentRoll || '').toLowerCase().includes(q);
      const matchDomain = (p.domain || '').toLowerCase().includes(q);
      const matchVenue = (p.venue || '').toLowerCase().includes(q);
      const matchAuthors = (p.authors || []).some((a) => a.toLowerCase().includes(q));
      if (!matchTitle && !matchRoll && !matchDomain && !matchVenue && !matchAuthors) return false;
    }
    return true;
  });

  return (
    <div className="page-container" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Research Papers & Conference Publications
          </h2>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            Faculty & student peer-reviewed papers (IEEE, Springer, Elsevier, Journals) with DOI links.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleOpenCreate}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} />
          <span>Register Research Paper</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--neutral-400)',
              }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Search papers by title, author, DOI, venue, or student roll number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--neutral-600)' }}>
              Domain:
            </span>
            <select
              className="input-field"
              style={{ width: 'auto', padding: '0.45rem 1rem' }}
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
            >
              <option value="all">All Domains ({papers.length})</option>
              {domains.map((d, idx) => {
                const name = typeof d === 'string' ? d : d.name;
                return (
                  <option key={idx} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* PAPERS LIST */}
      {filteredPapers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <BookOpen size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No research papers found</h4>
          <p className="text-muted text-sm">Register your IEEE, journal, or conference publication metadata above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredPapers.map((p) => {
            const statusConfig = {
              published: { label: 'Published', bg: '#dcfce7', color: '#15803d' },
              accepted: { label: 'Accepted', bg: '#dbeafe', color: '#1e40af' },
              submitted: { label: 'Under Review', bg: '#fef3c7', color: '#92400e' },
              in_progress: { label: 'In Progress', bg: '#f3e8ff', color: '#7e22ce' },
              planning: { label: 'Planning', bg: '#f1f5f9', color: '#475569' },
            }[p.status || 'published'] || { label: p.status || 'Published', bg: '#f1f5f9', color: '#475569' };

            const canManage = canManagePaper(p);

            return (
              <div
                key={p.id}
                className="card"
                style={{
                  padding: '1.5rem',
                  borderLeft: p.paperType === 'IEEE' ? '4px solid #1d4ed8' : '4px solid #10b981',
                }}
              >
                <div className="flex-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.6rem',
                          borderRadius: 999,
                          background: p.paperType === 'IEEE' ? '#dbeafe' : '#dcfce7',
                          color: p.paperType === 'IEEE' ? '#1e40af' : '#15803d',
                          textTransform: 'uppercase',
                        }}
                      >
                        {p.paperType}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: 999,
                          background: statusConfig.bg,
                          color: statusConfig.color,
                        }}
                      >
                        {statusConfig.label}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: 999,
                          background: '#f1f5f9',
                          color: '#475569',
                        }}
                      >
                        {p.domain}
                      </span>
                      {p.isIeeeIndexed && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: 999,
                            background: '#dbeafe',
                            color: '#1e40af',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <CheckCircle2 size={11} /> IEEE Indexed
                        </span>
                      )}
                      {p.isScopusIndexed && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: 999,
                            background: '#ffedd5',
                            color: '#c2410c',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Award size={11} /> Scopus / SCI
                        </span>
                      )}
                      {p.isPublic ? (
                        <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>Public</span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>Private</span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--neutral-900)', lineHeight: '1.4' }}>
                      {p.title}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {p.externalUrl && (
                      <a
                        href={p.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <span>Publisher</span>
                        <ExternalLink size={13} />
                      </a>
                    )}
                    {p.repositoryUrl && (
                      <a
                        href={p.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <span>Pre-print</span>
                        <FileText size={13} />
                      </a>
                    )}
                    {canManage && (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(p)}
                          title="Edit Publication"
                          style={{ padding: '0.35rem 0.6rem' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(p.id)}
                          title="Delete Publication"
                          style={{ padding: '0.35rem 0.6rem' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--neutral-600)', marginBottom: '0.75rem' }}>
                  <strong>Authors:</strong> {(p.authors || []).join(', ')}
                </div>

                {p.venue && (
                  <div style={{ fontSize: '0.84rem', color: 'var(--neutral-700)', marginBottom: '0.5rem' }}>
                    <strong>Venue / Conference:</strong> {p.venue}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.78rem',
                    color: 'var(--neutral-500)',
                    borderTop: '1px solid var(--neutral-100)',
                    paddingTop: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <div>
                    {p.doi && (
                      <span>
                        DOI: <strong className="font-mono text-primary">{p.doi}</strong>
                      </span>
                    )}
                    {p.studentRoll && (
                      <span style={{ marginLeft: '1rem' }}>
                        Affiliated Student: <strong className="font-mono">{p.studentRoll}</strong>
                      </span>
                    )}
                  </div>
                  <span>{formatDisplayDate(p.publicationDate || p.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REGISTER / EDIT PAPER MODAL */}
      {isSubmitModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setIsSubmitModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={22} className="text-primary" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                  {editingPaperId ? 'Edit Research Publication' : 'Register Research Paper'}
                </h3>
              </div>
            </div>

            <form onSubmit={handleSubmitPaper}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label" htmlFor="title">Paper Title *</label>
                <input
                  id="title"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Design of Energy-Harvesting BLE Sensor Node"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label" htmlFor="authorsText">Authors (Comma-separated) *</label>
                <input
                  id="authorsText"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Anwar Bajarinti, Dr. K. Venkatesh"
                  value={authorsText}
                  onChange={(e) => setAuthorsText(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label" htmlFor="studentRoll">Student Roll No.</label>
                  <input
                    id="studentRoll"
                    type="text"
                    className="input-field"
                    placeholder="e.g. 238W1A0477"
                    value={studentRoll}
                    onChange={(e) => setStudentRoll(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="teamName">Team / Research Group Name</label>
                  <input
                    id="teamName"
                    type="text"
                    className="input-field"
                    placeholder="Optional team label (e.g. IoT Wing)"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label" htmlFor="status">Publication Status</label>
                  <select
                    id="status"
                    className="input-field"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="planning">Planning / Conception</option>
                    <option value="in_progress">Drafting / Experimentation</option>
                    <option value="submitted">Submitted (Under Review)</option>
                    <option value="accepted">Accepted (Camera Ready)</option>
                    <option value="published">Published</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="publicationDate">Publication Date</label>
                  <input
                    id="publicationDate"
                    type="date"
                    className="input-field"
                    value={publicationDate}
                    onChange={(e) => setPublicationDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label" htmlFor="paperType">Publication Type</label>
                  <select
                    id="paperType"
                    className="input-field"
                    value={paperType}
                    onChange={(e) => setPaperType(e.target.value)}
                  >
                    <option value="IEEE">IEEE Conference / Journal</option>
                    <option value="conference">National / International Conference</option>
                    <option value="journal">Scopus / SCI Indexed Journal</option>
                    <option value="workshop">Technical Workshop</option>
                    <option value="other">Other Peer-Reviewed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="venue">Conference / Journal Venue Name</label>
                  <input
                    id="venue"
                    type="text"
                    className="input-field"
                    placeholder="e.g. IEEE ICAIOT 2026 or Springer CCIS"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                  />
                </div>
              </div>

              {/* DOI AND WRITABLE RESEARCH DOMAIN SECTION */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <label className="input-label" htmlFor="doi" style={{ marginBottom: 0, fontWeight: 700, color: 'var(--neutral-900)' }}>
                        DOI (Digital Object Identifier)
                      </label>
                    </div>
                    <input
                      id="doi"
                      type="text"
                      className="input-field"
                      placeholder="e.g. 10.1109/ICAIOT.2026.1042"
                      value={doi}
                      onChange={(e) => setDoi(e.target.value)}
                    />
                    <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                      Permanent digital code assigned to your publication.
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <label className="input-label" htmlFor="domain" style={{ marginBottom: 0, fontWeight: 700, color: 'var(--neutral-900)' }}>
                        Research Domain <span className="required-star">*</span>
                      </label>
                      <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>Write or Select</span>
                    </div>
                    <input
                      id="domain"
                      type="text"
                      list="domain-options"
                      className="input-field"
                      placeholder="Write your domain (e.g. IoT, AI/ML, VLSI)"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      required
                    />
                    <datalist id="domain-options">
                      <option value="IoT & Embedded Systems" />
                      <option value="Artificial Intelligence & Machine Learning" />
                      <option value="VLSI & Semiconductor Design" />
                      <option value="Robotics & Autonomous Systems" />
                      <option value="Cyber Security & Cryptography" />
                      <option value="Cloud & Edge Computing" />
                      <option value="Wireless Sensor Networks (WSN)" />
                      <option value="Signal Processing & Telecommunications" />
                      <option value="Electric Vehicles & Power Electronics" />
                      <option value="Renewable Energy & Smart Grids" />
                      <option value="Bio-Medical Instrumentation" />
                      <option value="Computer Vision & Deep Learning" />
                      {domains.map((d, idx) => {
                        const name = typeof d === 'string' ? d : d.name;
                        return <option key={idx} value={name} />;
                      })}
                    </datalist>
                    <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                      You can type any specialized academic or engineering domain.
                    </span>
                  </div>
                </div>

                {/* Helpful Explanatory Callout */}
                <div style={{ marginTop: '0.75rem', padding: '0.55rem 0.75rem', background: '#eff6ff', borderRadius: '6px', borderLeft: '3px solid #2563eb', fontSize: '0.78rem', color: '#1e40af', lineHeight: 1.45 }}>
                  💡 <strong>What does DOI mean?</strong> A <em>Digital Object Identifier</em> (DOI) is a unique, permanent alphanumeric string (e.g. <code>10.1109/...</code>) assigned by international registration agencies (like Crossref or IEEE) to persistently identify and link academic research papers, journal articles, and patents across the web.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="input-label" htmlFor="externalUrl">External Publisher URL</label>
                  <input
                    id="externalUrl"
                    type="url"
                    className="input-field"
                    placeholder="https://ieeexplore.ieee.org/document/..."
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="input-label" htmlFor="repositoryUrl">Pre-print / Repository URL</label>
                  <input
                    id="repositoryUrl"
                    type="url"
                    className="input-field"
                    placeholder="https://arxiv.org/abs/..."
                    value={repositoryUrl}
                    onChange={(e) => setRepositoryUrl(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.86rem' }}>
                  <input
                    type="checkbox"
                    checked={isIeeeIndexed}
                    onChange={(e) => setIsIeeeIndexed(e.target.checked)}
                  />
                  <span>Verified IEEE Indexed</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.86rem' }}>
                  <input
                    type="checkbox"
                    checked={isScopusIndexed}
                    onChange={(e) => setIsScopusIndexed(e.target.checked)}
                  />
                  <span>Verified Scopus / SCI Indexed</span>
                </label>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  <strong style={{ fontSize: '0.88rem' }}>Make Paper Publicly Visible in Incubation Showcase</strong>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsSubmitModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPaperId ? 'Update Publication' : 'Save Publication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
