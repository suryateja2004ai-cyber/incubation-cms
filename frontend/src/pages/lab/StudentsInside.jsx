// src/pages/StudentsInside.jsx
// Students Currently Inside the Lab Indicator
// Admin/Substitute view: Full list & live duration of all students inside
// Regular student view: Private personal presence indicator only (Strict Privacy)

import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  LogOut,
  Building,
  Briefcase,
  UserPlus,
} from 'lucide-react';
import {
  getStudentsCurrentlyInside,
  getStudentPersonalStats,
  recordLabExit,
  subscribeToDb,
  fetchActiveVisitors,
  recordVisitorLabExit,
} from '../../db/database';

export default function StudentsInside({ currentUser, onToast }) {
  const [insideStudents, setInsideStudents] = useState([]);
  const [insideVisitors, setInsideVisitors] = useState([]);
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'visitors'
  const [studentStats, setStudentStats] = useState(null);

  const isStudent = currentUser?.role === 'student';
  const isAdminOrSubstitute = currentUser?.role === 'admin' || currentUser?.role === 'substitute_admin';

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDb(() => loadData());
    const interval = setInterval(loadData, 30000); // Live duration refresh every 30s
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentUser]);

  async function loadData() {
    if (isAdminOrSubstitute) {
      const students = (getStudentsCurrentlyInside() || []).filter(
        (s) => s && s.studentRoll && s.studentRoll !== '77' && s.studentRoll.length === 10
      );
      setInsideStudents(students);
      try {
        const visitors = await fetchActiveVisitors();
        setInsideVisitors(visitors);
      } catch (_) {}
    } else if (isStudent) {
      setStudentStats(getStudentPersonalStats(currentUser.rollNumber));
    }
  }

  async function handleExitStudent(roll) {
    if (confirm(`Record lab exit for student ${roll}?`)) {
      try {
        const res = await recordLabExit(roll, 'admin_manual');
        loadData();
        const duration = res?.durationMinutes ?? (res?.visit?.durationMinutes ?? 0);
        if (onToast) onToast(`Recorded exit for ${roll}. Duration: ${duration} min.`);
      } catch (err) {
        alert(err.message);
      }
    }
  }

  async function handleExitVisitor(vis) {
    if (confirm(`Record lab exit for visitor ${vis.full_name}?`)) {
      try {
        await recordVisitorLabExit(vis.visitor_id || vis.id, currentUser);
        loadData();
        if (onToast) onToast(`Recorded lab exit for visitor ${vis.full_name}.`);
      } catch (err) {
        alert(err.message);
      }
    }
  }

  // ==================== REGULAR STUDENT VIEW (Strict Privacy) ====================
  if (isStudent) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <UserCheck size={20} className="icon-primary" /> My Lab Presence Status
            </h3>
          </div>
          <div className="card-body" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            {studentStats?.isCurrentlyInside ? (
              <div>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <CheckCircle2 size={36} />
                </div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                  You are currently inside the lab.
                </h3>
                <div style={{ marginTop: '1rem', background: 'var(--neutral-50)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'inline-block', textAlign: 'left' }}>
                  <div style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                    Entry Time: <strong>{studentStats?.activeVisit?.entryTime ? new Date(studentStats.activeVisit.entryTime).toLocaleTimeString() : 'Active'}</strong>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700 }}>
                    Time in lab: {studentStats.currentInsideDurationText}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--neutral-100)', color: 'var(--neutral-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <Clock size={36} />
                </div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--neutral-800)' }}>
                  You are currently not inside the lab.
                </h3>
                <p className="text-sm text-muted" style={{ marginTop: '0.5rem' }}>
                  Verify your identity at the entrance station with face recognition or roll number when you arrive.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== ADMIN & SUBSTITUTE ADMIN VIEW ====================
  const totalInside = insideStudents.length + insideVisitors.length;

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            People Currently Inside the Lab
          </h2>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            Real-time tracking of active laboratory students and registered guest visitors
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="stat-card" style={{ padding: '0.65rem 1.25rem', minWidth: '160px', marginBottom: 0 }}>
            <div className="stat-card-left">
              <span className="stat-label">Students Inside</span>
              <span className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>
                {insideStudents.length} Students
              </span>
            </div>
          </div>

          <div className="stat-card" style={{ padding: '0.65rem 1.25rem', minWidth: '160px', marginBottom: 0 }}>
            <div className="stat-card-left">
              <span className="stat-label">Visitors Inside</span>
              <span className="stat-value" style={{ fontSize: '1.4rem', color: '#0d9488' }}>
                {insideVisitors.length} Visitors
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher: Registered Students vs Visitors */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-sm"
          style={{
            background: activeTab === 'students' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'students' ? '#fff' : 'var(--neutral-700)',
            border: 'none',
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            padding: '0.45rem 1rem',
          }}
          onClick={() => setActiveTab('students')}
        >
          <Users size={15} style={{ marginRight: '6px' }} />
          Registered Students ({insideStudents.length})
        </button>

        <button
          type="button"
          className="btn btn-sm"
          style={{
            background: activeTab === 'visitors' ? '#0d9488' : 'transparent',
            color: activeTab === 'visitors' ? '#fff' : 'var(--neutral-700)',
            border: 'none',
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            padding: '0.45rem 1rem',
          }}
          onClick={() => setActiveTab('visitors')}
        >
          <Building size={15} style={{ marginRight: '6px' }} />
          Lab Visitors & Guests ({insideVisitors.length})
        </button>
      </div>

      {activeTab === 'students' && (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll Number</th>
                  <th>Entry Time</th>
                  <th>Time Spent Inside</th>
                  <th>Verification Method</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {insideStudents.length > 0 ? (
                  insideStudents.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>
                          {item.studentName}
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-sm" style={{ fontWeight: 600 }}>
                          {item.studentRoll}
                        </span>
                      </td>
                      <td className="text-sm">
                        {item.entryTime ? new Date(item.entryTime).toLocaleTimeString() : 'Active'}
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontWeight: 700 }}>
                          <Clock size={12} /> {item.durationText}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {item.entryMethod || 'Biometric'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleExitStudent(item.studentRoll)}
                          title="Record lab exit"
                        >
                          <LogOut size={14} /> Record Exit
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }} className="text-muted">
                      No students are currently inside the lab.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'visitors' && (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Visitor Name</th>
                  <th>Category</th>
                  <th>Department / Organization</th>
                  <th>Purpose of Visit</th>
                  <th>Entry Time</th>
                  <th>Time Inside</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {insideVisitors.length > 0 ? (
                  insideVisitors.map((vis) => {
                    const elapsedMins = Math.max(0, Math.round((Date.now() - new Date(vis.entry_time).getTime()) / 60000));
                    const hours = Math.floor(elapsedMins / 60);
                    const mins = elapsedMins % 60;
                    const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

                    return (
                      <tr key={vis.visitor_id || vis.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>
                            {vis.full_name}
                          </div>
                          {vis.phone_number && (
                            <span className="font-mono text-xs text-muted">{vis.phone_number}</span>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ background: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4' }}>
                            {vis.visitor_type}
                          </span>
                        </td>
                        <td className="text-sm">
                          {vis.organization_or_dept}
                        </td>
                        <td className="text-sm">
                          <strong>{vis.purpose_of_visit}</strong>
                          {vis.host_or_accompanied_by && (
                            <div className="text-xs text-muted">Host: {vis.host_or_accompanied_by}</div>
                          )}
                        </td>
                        <td className="text-sm">
                          {vis.entry_time ? new Date(vis.entry_time).toLocaleTimeString() : 'Active'}
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ fontWeight: 700 }}>
                            <Clock size={12} /> {durationText}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleExitVisitor(vis)}
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            title="Record visitor exit"
                          >
                            <LogOut size={14} /> Record Exit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }} className="text-muted">
                      No external visitors or guest faculty are currently inside the lab.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
