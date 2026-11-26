// src/pages/Overdue.jsx
// Overdue tracker and management view with severity filters, overdue day counters, and direct return actions

import React, { useState, useEffect } from 'react';
import {
  Clock,
  AlertTriangle,
  Calendar,
  User,
  ArrowDownLeft,
  Filter,
  CheckCircle,
  Sliders,
  Bell,
  Mail,
  Phone,
  Database,
  Search,
  RefreshCw,
} from 'lucide-react';
import {
  getTransactions,
  getOverdueDays,
  getRemainingDays,
  isItemOverdue,
  getSettings,
  updateSettings,
  subscribeToDb,
} from '../../db/database';
import { formatDisplayDate } from '../../utils/dateFormatter';

export default function Overdue({ setActiveTab, onToast, onOpenReturnWithRoll }) {
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState({ defaultOverdueDays: 7 });
  const [filterSeverity, setFilterSeverity] = useState('all'); // 'all' | 'critical' | 'moderate' | 'duesoon'
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [tempDefaultDays, setTempDefaultDays] = useState(7);

  // PostgreSQL Overdue Tracker states
  const [pgOverdueList, setPgOverdueList] = useState([]);
  const [isChecking, setIsChecking] = useState(false);
  const [hasCheckedDb, setHasCheckedDb] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState(null);

  useEffect(() => {
    loadData();
    fetchPgOverdues();
    const unsubscribe = subscribeToDb(() => loadData());
    return () => unsubscribe();
  }, []);

  function loadData() {
    const allTxns = getTransactions('all');
    setTransactions(allTxns);
    const currSettings = getSettings();
    setSettings(currSettings);
    setTempDefaultDays(currSettings.defaultOverdueDays || 7);
  }

  async function fetchPgOverdues() {
    try {
      const res = await fetch('/api/overdue-components');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          setPgOverdueList(json.data);
          setHasCheckedDb(true);
        }
      }
    } catch (err) {
      console.warn('Could not fetch PostgreSQL overdues:', err);
    }
  }

  async function handleCheckOverdues() {
    setIsChecking(true);
    try {
      const res = await fetch('/api/check-overdues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        const overdues = json.data || [];
        setPgOverdueList(overdues);
        setHasCheckedDb(true);
        setLastCheckedTime(new Date());
        if (onToast) {
          onToast(
            overdues.length > 0
              ? `Check Overdues complete! Found ${overdues.length} student(s) past end date (stored in PostgreSQL).`
              : 'Check Overdues complete! Zero students currently past end date.'
          );
        }
      } else {
        throw new Error('Failed to check overdues in database');
      }
    } catch (err) {
      console.error('Check overdues error:', err);
      if (onToast) onToast('Failed to check overdues: ' + err.message);
    } finally {
      setIsChecking(false);
    }
  }

  function handleSaveSettings(e) {
    e.preventDefault();
    const days = Math.max(1, Number(tempDefaultDays) || 7);
    updateSettings({ defaultOverdueDays: days });
    setIsEditingSettings(false);
    if (onToast) onToast(`Default overdue duration set to ${days} days.`);
  }

  // Extract all active or overdue item records
  const itemRecords = [];
  for (const txn of transactions) {
    if (txn.status === 'returned') continue;

    for (const item of txn.items) {
      const remaining = item.issuedQuantity - item.returnedQuantity;
      if (remaining <= 0) continue;

      const isLate = isItemOverdue(item);
      const overdueDays = getOverdueDays(item.dueDate);
      const remainingDays = getRemainingDays(item.dueDate);

      let severity = 'ontime';
      if (isLate) {
        severity = overdueDays > 7 ? 'critical' : 'moderate';
      } else if (remainingDays <= 2) {
        severity = 'duesoon';
      }

      itemRecords.push({
        txnId: txn.id,
        studentName: txn.studentName,
        studentRoll: txn.studentRoll,
        componentId: item.componentId,
        componentName: item.componentName,
        category: item.category,
        remainingQuantity: remaining,
        individualIds: (item.individualIds || []).filter(
          (id) => !(item.returnedIndividualIds || []).includes(id)
        ),
        issueDate: txn.issueDate,
        dueDate: item.dueDate,
        isLate,
        overdueDays,
        remainingDays,
        severity,
      });
    }
  }

  // Merge items from PostgreSQL public.overdue_components with local records
  const effectiveItems = [...itemRecords];
  if (hasCheckedDb && Array.isArray(pgOverdueList)) {
    for (const pgItem of pgOverdueList) {
      const exists = effectiveItems.some(
        (local) => local.txnId === pgItem.transaction_id && local.componentId === pgItem.component_id
      );
      if (!exists) {
        effectiveItems.push({
          txnId: pgItem.transaction_id,
          studentName: pgItem.student_name,
          studentRoll: pgItem.registration_number,
          phone: pgItem.phone_number,
          componentId: pgItem.component_id,
          componentName: pgItem.component_name,
          category: pgItem.category,
          remainingQuantity: pgItem.remaining_quantity,
          individualIds: pgItem.individual_ids || [],
          issueDate: pgItem.issue_date,
          dueDate: pgItem.due_date,
          isLate: true,
          overdueDays: pgItem.overdue_days,
          remainingDays: 0,
          severity: pgItem.severity,
          fromPg: true,
        });
      }
    }
  }

  // Filter items
  const filteredItems = effectiveItems.filter((rec) => {
    if (filterSeverity === 'all') return rec.isLate || rec.severity === 'duesoon';
    if (filterSeverity === 'critical') return rec.severity === 'critical';
    if (filterSeverity === 'moderate') return rec.severity === 'moderate';
    if (filterSeverity === 'duesoon') return rec.severity === 'duesoon';
    return true;
  });

  const criticalCount = effectiveItems.filter((r) => r.severity === 'critical').length;
  const moderateCount = effectiveItems.filter((r) => r.severity === 'moderate').length;
  const dueSoonCount = effectiveItems.filter((r) => r.severity === 'duesoon').length;

  return (
    <div>
      {/* Header & Settings */}
      <div className="flex-between" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Overdue Tracker & Policy
          </h2>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Monitor unreturned components past due date and configure lab return policies
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={isChecking}
            onClick={handleCheckOverdues}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}
          >
            <RefreshCw size={16} className={isChecking ? 'spin' : ''} />
            {isChecking ? 'Scanning Issued Table in DB...' : 'Check Overdues'}
          </button>
          <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}>
            <Database size={14} /> PostgreSQL Connected (public.overdue_components)
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsEditingSettings(!isEditingSettings)}
          >
            <Sliders size={16} /> Configure Loan Durations
          </button>
        </div>
      </div>

      {/* OVERDUE SCAN SUMMARY BANNER */}
      {hasCheckedDb && (
        <div className="card" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', marginBottom: '1.25rem', padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} style={{ color: 'var(--success)' }} />
              <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                Scanned <strong>public.issued_components</strong> end dates. Identified <strong>{pgOverdueList.length}</strong> overdue loan(s) stored in <strong>public.overdue_components</strong>.
              </span>
            </div>
            {lastCheckedTime && (
              <span className="text-xs text-muted">
                Last checked: {lastCheckedTime.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* OVERDUE DURATION SETTINGS DRAWER */}
      {isEditingSettings && (
        <div className="card" style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-border)', marginBottom: '1.5rem' }}>
          <div className="card-body">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>
              Incubation Centre Overdue Policies
            </h3>
            <p className="text-sm text-muted" style={{ marginBottom: '1rem' }}>
              Loans exceeding this duration without return will automatically trigger overdue warnings across the dashboard.
            </p>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Default Overall Overdue Duration (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  className="input-field"
                  style={{ width: '160px' }}
                  value={tempDefaultDays}
                  onChange={(e) => setTempDefaultDays(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Save Policy
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditingSettings(false)}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* OVERDUE METRIC CARDS */}
      <div className="stats-grid">
        <div className="stat-card stat-danger">
          <div className="stat-card-left">
            <span className="stat-label">Critical (&gt; 7 Days Overdue)</span>
            <span className="stat-value">{criticalCount}</span>
            <span className="stat-subtext">Immediate follow-up required</span>
          </div>
          <div className="stat-icon-wrapper">
            <AlertTriangle size={24} />
          </div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-card-left">
            <span className="stat-label">Moderate (1-7 Days Overdue)</span>
            <span className="stat-value">{moderateCount}</span>
            <span className="stat-subtext">Recently expired loans</span>
          </div>
          <div className="stat-icon-wrapper">
            <Clock size={24} />
          </div>
        </div>

        <div className="stat-card stat-primary">
          <div className="stat-card-left">
            <span className="stat-label">Due Soon (Next 48 Hours)</span>
            <span className="stat-value">{dueSoonCount}</span>
            <span className="stat-subtext">Upcoming return deadlines</span>
          </div>
          <div className="stat-icon-wrapper">
            <Calendar size={24} />
          </div>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn-badge ${filterSeverity === 'all' ? 'active' : ''}`}
              style={{
                background: filterSeverity === 'all' ? 'var(--neutral-900)' : 'var(--neutral-100)',
                color: filterSeverity === 'all' ? '#fff' : 'var(--neutral-700)',
                padding: '0.4rem 0.85rem',
              }}
              onClick={() => setFilterSeverity('all')}
            >
              All Alerts ({itemRecords.filter((r) => r.isLate || r.severity === 'duesoon').length})
            </button>

            <button
              type="button"
              className={`btn-badge ${filterSeverity === 'critical' ? 'active' : ''}`}
              style={{
                background: filterSeverity === 'critical' ? 'var(--danger)' : 'var(--neutral-100)',
                color: filterSeverity === 'critical' ? '#fff' : 'var(--neutral-700)',
                padding: '0.4rem 0.85rem',
              }}
              onClick={() => setFilterSeverity('critical')}
            >
              Critical Overdue ({criticalCount})
            </button>

            <button
              type="button"
              className={`btn-badge ${filterSeverity === 'moderate' ? 'active' : ''}`}
              style={{
                background: filterSeverity === 'moderate' ? 'var(--warning)' : 'var(--neutral-100)',
                color: filterSeverity === 'moderate' ? '#fff' : 'var(--neutral-700)',
                padding: '0.4rem 0.85rem',
              }}
              onClick={() => setFilterSeverity('moderate')}
            >
              Moderate Overdue ({moderateCount})
            </button>

            <button
              type="button"
              className={`btn-badge ${filterSeverity === 'duesoon' ? 'active' : ''}`}
              style={{
                background: filterSeverity === 'duesoon' ? 'var(--primary)' : 'var(--neutral-100)',
                color: filterSeverity === 'duesoon' ? '#fff' : 'var(--neutral-700)',
                padding: '0.4rem 0.85rem',
              }}
              onClick={() => setFilterSeverity('duesoon')}
            >
              Due Within 48 Hrs ({dueSoonCount})
            </button>
          </div>
        </div>
      </div>

      {/* OVERDUE ITEMS TABLE */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Student Details</th>
                <th>Component & Physical Tag(s)</th>
                <th>Qty Outstanding</th>
                <th>Issue Date</th>
                <th>End Date (Due Date)</th>
                <th>Status / Days Overdue</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item, idx) => (
                  <tr key={`${item.txnId}-${item.componentId}-${idx}`}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>
                        {item.studentName}
                      </div>
                      <div className="font-mono text-xs text-muted">
                        Roll: {item.studentRoll}
                      </div>
                      {item.phone && (
                        <div className="text-xs" style={{ color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                          <Phone size={11} /> {item.phone}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.componentName}</div>
                      <div className="text-xs text-muted">{item.category}</div>
                      {item.individualIds && item.individualIds.length > 0 && (
                        <div className="id-chips-container" style={{ marginTop: '0.35rem' }}>
                          {item.individualIds.map((tag) => (
                            <span key={tag} className="id-chip id-chip-issued">{tag}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <strong style={{ fontSize: '1rem', color: item.isLate ? 'var(--danger-text)' : 'inherit' }}>
                        {item.remainingQuantity} unit(s)
                      </strong>
                    </td>
                    <td className="text-sm">
                      {formatDisplayDate(item.issueDate)}
                    </td>
                    <td className="text-sm">
                      <strong>{formatDisplayDate(item.dueDate)}</strong>
                    </td>
                    <td>
                      {item.severity === 'critical' && (
                        <span className="badge badge-danger">
                          <AlertTriangle size={12} /> Overdue by {item.overdueDays} days!
                        </span>
                      )}
                      {item.severity === 'moderate' && (
                        <span className="badge badge-warning">
                          <Clock size={12} /> Overdue by {item.overdueDays} days
                        </span>
                      )}
                      {item.severity === 'duesoon' && (
                        <span className="badge badge-info">
                          Due in {item.remainingDays <= 0 ? 'Today' : `${item.remainingDays} days`}
                        </span>
                      )}
                      {item.severity === 'ontime' && (
                        <span className="badge badge-success">On Schedule</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => {
                          if (onOpenReturnWithRoll) {
                            onOpenReturnWithRoll(item.studentRoll);
                          } else {
                            setActiveTab('return');
                          }
                        }}
                      >
                        <ArrowDownLeft size={14} /> Process Return
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }} className="text-muted">
                    <CheckCircle size={32} style={{ color: 'var(--success)', margin: '0 auto 0.5rem' }} />
                    <p style={{ fontWeight: 600, color: 'var(--neutral-800)' }}>
                      No items currently matching this overdue filter!
                    </p>
                    <span className="text-xs">All borrowed components are either returned or within their loan duration.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
