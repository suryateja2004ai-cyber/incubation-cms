// src/pages/Analytics.jsx
// Attendance Analytics Graph, Equipment-Usage Graph (Two completely SEPARATE graphs),
// and Excel Attendance Export for Admin and Substitute Admin.

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  Cpu,
  Users,
  TrendingUp,
  Layers,
  AlertCircle,
  Clock,
  CheckCircle2,
  Filter,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import {
  getAttendanceAnalytics,
  getEquipmentUsageAnalytics,
  getAttendanceExportData,
  getAttendanceHistoryByDateRange,
  getIncubationReportingMetrics,
  toLocalDateKey,
  subscribeToDb,
} from '../../db/database';
import { downloadAttendanceExcel } from '../../utils/excelExport';
import { formatDisplayDate } from '../../utils/dateFormatter';

export default function Analytics({ onToast }) {
  const [attendancePeriod, setAttendancePeriod] = useState('week'); // 'week' | 'month' | 'year'
  const [equipmentPeriod, setEquipmentPeriod] = useState('week'); // 'week' | 'month' | 'year'

  const [attendanceData, setAttendanceData] = useState([]);
  const [equipmentData, setEquipmentData] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loadError, setLoadError] = useState('');

  // Student Attendance History Subsection States
  const [historyTab, setHistoryTab] = useState('today'); // 'today' | 'yesterday' | 'day_before' | 'custom'
  const todayStr = toLocalDateKey(new Date());
  const [customFromDate, setCustomFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toLocalDateKey(d);
  });
  const [customToDate, setCustomToDate] = useState(todayStr);
  const [historyResult, setHistoryResult] = useState({
    records: [],
    totalVisits: 0,
    totalUniqueStudents: 0,
    totalHours: '0.0',
    startDate: todayStr,
    endDate: todayStr,
  });

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDb(() => loadData());
    return () => unsubscribe();
  }, [attendancePeriod, equipmentPeriod, historyTab, customFromDate, customToDate]);

  function loadData() {
    try {
      setLoadError('');
      setAttendanceData(getAttendanceAnalytics(attendancePeriod));
      setEquipmentData(getEquipmentUsageAnalytics(equipmentPeriod));
      setMetrics(getIncubationReportingMetrics());
      loadAttendanceHistory(historyTab);
    } catch (err) {
      console.error('Error loading analytics data:', err);
      setLoadError(err.message || 'Failed to load analytics data from database.');
    }
  }

  function loadAttendanceHistory(tab = historyTab) {
    let start = todayStr;
    let end = todayStr;

    if (tab === 'today') {
      start = todayStr;
      end = todayStr;
    } else if (tab === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      start = toLocalDateKey(y);
      end = start;
    } else if (tab === 'day_before') {
      const db = new Date();
      db.setDate(db.getDate() - 2);
      start = toLocalDateKey(db);
      end = start;
    } else if (tab === 'custom') {
      if (customFromDate && customToDate && customFromDate > customToDate) {
        setLoadError('From Date cannot be later than To Date.');
        return;
      }
      start = customFromDate || todayStr;
      end = customToDate || todayStr;
    }

    const result = getAttendanceHistoryByDateRange(start, end);
    setHistoryResult({
      ...result,
      startDate: start,
      endDate: end,
    });
  }

  function handleExportExcel() {
    try {
      const exportPayload = {
        ...historyResult,
        generatedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      };
      downloadAttendanceExcel(exportPayload, `Incubation_Attendance_${historyTab}`);
      if (onToast) onToast('Attendance records exported as genuine Excel (.xlsx) workbook successfully!');
    } catch (err) {
      alert(err.message);
    }
  }

  const hasAttendanceRecords = attendanceData && attendanceData.some((d) => (d.studentsCount || 0) > 0);
  const hasEquipmentRecords = equipmentData && equipmentData.some((d) => (d.borrowersCount || 0) > 0);

  return (
    <div>
      {/* Error Banner */}
      {loadError && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} />
          <span>{loadError}</span>
        </div>
      )}

      {/* Header & Excel Export Action */}
      <div className="flex-between" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Laboratory Analytics & Reporting
          </h2>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            Daily attendance and equipment usage analytics with Excel spreadsheet export
          </p>
        </div>

        <button type="button" className="btn btn-success" onClick={handleExportExcel}>
          <FileSpreadsheet size={18} /> Download Attendance Excel
        </button>
      </div>

      {/* ==================== INCUBATION KPI SUMMARY ==================== */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid var(--primary)' }}>
            <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Lab Hours Logged</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.2rem' }}>
              {metrics.totalHoursLogged} hrs
            </div>
            <div className="text-xs text-muted" style={{ marginTop: '0.2rem' }}>
              {metrics.activeInLab} inside now • {metrics.totalVisits} total visits
            </div>
          </div>

          <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #0ea5e9' }}>
            <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>ECE & Dept Projects</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0ea5e9', marginTop: '0.2rem' }}>
              {metrics.projects.total} Projects
            </div>
            <div className="text-xs text-muted" style={{ marginTop: '0.2rem' }}>
              ECE: {metrics.projects.byBranch.ECE} • CSE/IT: {metrics.projects.byBranch.CSE + metrics.projects.byBranch.IT} • {metrics.projects.prototypesReady} Prototypes
            </div>
          </div>

          <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #16a34a' }}>
            <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Research & IEEE</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
              {metrics.research.published} Papers
            </div>
            <div className="text-xs text-muted" style={{ marginTop: '0.2rem' }}>
              {metrics.research.ieeeIndexed} IEEE • {metrics.research.scopusIndexed} Scopus • {metrics.research.underReview} Under Review
            </div>
          </div>

          <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #f59e0b' }}>
            <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Inventory Usability</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
              {metrics.inventory.availabilityRate}%
            </div>
            <div className="text-xs text-muted" style={{ marginTop: '0.2rem' }}>
              {metrics.inventory.totalPhysicalItems} items in stock • {metrics.inventory.currentlyBorrowed} borrowed
            </div>
          </div>

          <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #8b5cf6' }}>
            <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Prize Money & Honors</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#8b5cf6', marginTop: '0.2rem' }}>
              ₹{metrics.achievements.totalPrizeMoney.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-muted" style={{ marginTop: '0.2rem' }}>
              {metrics.achievements.totalHonors} permanent national honors
            </div>
          </div>
        </div>
      )}

      {/* ==================== GRAPH 1: ATTENDANCE ANALYTICS GRAPH ==================== */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Users size={20} className="icon-primary" />
            <div>
              <h3 className="card-title">1. Student Attendance Graph</h3>
              <p className="text-xs text-muted">Number of students who visited the lab each day</p>
            </div>
          </div>

          {/* Period Selector */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {['week', 'month', 'year'].map((p) => (
              <button
                key={p}
                type="button"
                className={`btn-badge ${attendancePeriod === p ? 'active' : ''}`}
                style={{
                  textTransform: 'capitalize',
                  background: attendancePeriod === p ? 'var(--primary)' : '#f1f5f9',
                  color: attendancePeriod === p ? '#fff' : '#475569',
                  fontWeight: attendancePeriod === p ? 700 : 500,
                  padding: '0.35rem 0.75rem',
                }}
                onClick={() => setAttendancePeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="card-body" style={{ height: '320px', minHeight: '320px' }}>
          {!hasAttendanceRecords ? (
            <div
              style={{
                height: '100%',
                minHeight: '280px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--neutral-300)',
                padding: '2rem',
                textAlign: 'center',
                gap: '0.5rem',
              }}
            >
              <Users size={36} style={{ color: 'var(--neutral-400)' }} />
              <div style={{ fontWeight: 700, color: 'var(--neutral-800)', fontSize: '1rem' }}>
                No attendance records for this {attendancePeriod}
              </div>
              <p className="text-xs text-muted" style={{ margin: 0, maxWidth: '360px' }}>
                No student lab check-in records found within the selected {attendancePeriod}. Recorded visits will automatically plot here.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={attendanceData} margin={{ top: 10, right: 20, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(val) => [`${val} Students`, 'Attendance']} />
                <Bar dataKey="studentsCount" name="Students in Lab" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ==================== GRAPH 2: EQUIPMENT USAGE GRAPH (SEPARATE!) ==================== */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Cpu size={20} style={{ color: '#0ea5e9' }} />
            <div>
              <h3 className="card-title">2. Equipment-Usage Graph</h3>
              <p className="text-xs text-muted">Number of students who borrowed components each day (Kept separate from attendance)</p>
            </div>
          </div>

          {/* Period Selector */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {['week', 'month', 'year'].map((p) => (
              <button
                key={p}
                type="button"
                className={`btn-badge ${equipmentPeriod === p ? 'active' : ''}`}
                style={{
                  textTransform: 'capitalize',
                  background: equipmentPeriod === p ? '#0ea5e9' : '#f1f5f9',
                  color: equipmentPeriod === p ? '#fff' : '#475569',
                  fontWeight: equipmentPeriod === p ? 700 : 500,
                  padding: '0.35rem 0.75rem',
                }}
                onClick={() => setEquipmentPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="card-body" style={{ height: '320px', minHeight: '320px' }}>
          {!hasEquipmentRecords ? (
            <div
              style={{
                height: '100%',
                minHeight: '280px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--neutral-300)',
                padding: '2rem',
                textAlign: 'center',
                gap: '0.5rem',
              }}
            >
              <Cpu size={36} style={{ color: 'var(--neutral-400)' }} />
              <div style={{ fontWeight: 700, color: 'var(--neutral-800)', fontSize: '1rem' }}>
                No equipment-usage records for this {equipmentPeriod}
              </div>
              <p className="text-xs text-muted" style={{ margin: 0, maxWidth: '360px' }}>
                No component borrowing transactions recorded within the selected {equipmentPeriod}. Issued items will automatically plot here.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={equipmentData} margin={{ top: 10, right: 20, left: -20, bottom: 20 }}>
                <defs>
                  <linearGradient id="equipGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(val) => [`${val} Students`, 'Component Borrowers']} />
                <Area type="monotone" dataKey="borrowersCount" name="Component Borrowers" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#equipGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ==================== SUBSECTION: STUDENT ATTENDANCE HISTORY ==================== */}
      <div className="card" style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
        <div className="card-header flex-between" style={{ flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--neutral-200)', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Calendar size={22} className="icon-primary" />
            <div>
              <h3 className="card-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                Student Attendance History
              </h3>
              <p className="text-xs text-muted" style={{ margin: '0.15rem 0 0' }}>
                Detailed entry/exit attendance logs with duration, status, and genuine Excel (.xlsx) export
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Quick Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.35rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'day_before', label: 'Day Before Yesterday' },
                { id: 'custom', label: 'Custom Date Range' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  style={{
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.82rem',
                    fontWeight: historyTab === tab.id ? 700 : 500,
                    background: historyTab === tab.id ? 'var(--primary)' : 'transparent',
                    color: historyTab === tab.id ? '#fff' : 'var(--neutral-600)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => {
                    setHistoryTab(tab.id);
                    loadAttendanceHistory(tab.id);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button type="button" className="btn btn-success" onClick={handleExportExcel} style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
              <FileSpreadsheet size={16} /> Download Attendance Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker bar */}
        {historyTab === 'custom' && (
          <div style={{ background: '#f8fafc', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-xs" style={{ fontWeight: 600, color: 'var(--neutral-700)' }}>From Date:</span>
              <input
                type="date"
                className="input-field"
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-xs" style={{ fontWeight: 600, color: 'var(--neutral-700)' }}>To Date:</span>
              <input
                type="date"
                className="input-field"
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}
              onClick={() => loadAttendanceHistory('custom')}
            >
              View Attendance
            </button>
          </div>
        )}

        {/* Summary Metric Pills */}
        <div style={{ display: 'flex', gap: '1rem', padding: '0.85rem 1.25rem', background: '#fafafa', borderBottom: '1px solid var(--neutral-200)', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--neutral-700)' }}>
            Showing: <strong>{historyTab === 'custom' ? `${formatDisplayDate(historyResult.startDate)} to ${formatDisplayDate(historyResult.endDate)}` : historyTab.replace('_', ' ').toUpperCase()}</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--neutral-700)' }}>
            Total Visits: <strong style={{ color: 'var(--primary)' }}>{historyResult.totalVisits}</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--neutral-700)' }}>
            Unique Students: <strong style={{ color: '#16a34a' }}>{historyResult.totalUniqueStudents}</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--neutral-700)' }}>
            Total Completed Lab Time: <strong style={{ color: '#0ea5e9' }}>{historyResult.totalHours} hrs</strong>
          </div>
        </div>

        {/* History Table */}
        <div className="card-body" style={{ padding: 0 }}>
          {historyResult.records.length === 0 ? (
            <div
              style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Calendar size={40} style={{ color: 'var(--neutral-400)' }} />
              <div style={{ fontWeight: 700, color: 'var(--neutral-800)', fontSize: '1.05rem' }}>
                No attendance records for {historyTab === 'custom' ? 'this date range' : historyTab.replace('_', ' ')}
              </div>
              <p className="text-xs text-muted" style={{ margin: 0, maxWidth: '420px' }}>
                No student lab check-in sessions were found for the selected period. New attendance recorded at the entrance station will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>#</th>
                    <th>Student Name</th>
                    <th>Roll Number</th>
                    <th>Department</th>
                    <th>Date</th>
                    <th>Entry Time</th>
                    <th>Exit Time</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Visits on Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyResult.records.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600, color: 'var(--neutral-500)', fontSize: '0.85rem' }}>
                        {row.serialNumber}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>
                        {row.studentName}
                        {row.flaggedForAdminReview && (
                          <span className="badge badge-warning text-xs" style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>
                            Flagged for Review
                          </span>
                        )}
                      </td>
                      <td className="font-mono text-xs">{row.rollNumber}</td>
                      <td>
                        <span className="badge badge-neutral text-xs">{row.department}</span>
                      </td>
                      <td className="text-xs" style={{ color: 'var(--neutral-700)' }}>{formatDisplayDate(row.attendanceDate)}</td>
                      <td className="text-xs" style={{ color: 'var(--neutral-700)' }}>{row.entryTime}</td>
                      <td className="text-xs">
                        {row.rawStatus === 'inside' ? (
                          <span className="badge badge-info text-xs">Currently Inside</span>
                        ) : row.rawStatus === 'incomplete' ? (
                          <span className="badge badge-danger text-xs">Incomplete / No Exit</span>
                        ) : (
                          row.exitTime
                        )}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {row.duration}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            row.rawStatus === 'completed'
                              ? 'badge-success'
                              : row.rawStatus === 'inside'
                              ? 'badge-info'
                              : 'badge-warning'
                          }`}
                          style={{ fontSize: '0.75rem' }}
                        >
                          {row.visitStatus}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                          {row.visitsCountOnDate}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
