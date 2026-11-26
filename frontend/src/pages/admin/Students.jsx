// src/pages/Students.jsx
// Student Directory & Account Management for Admin & Substitute Admin
// Features: Student search, active loan counts, biometric status badges,
// account editing (Name, Mobile, Department), password reset modal, and new account registration.

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  User,
  Hash,
  Phone,
  BookOpen,
  ArrowUpRight,
  ArrowDownLeft,
  Package,
  PlusCircle,
  Key,
  Edit2,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Camera,
  X,
  ShieldCheck,
  Calendar,
  ScanLine,
  Sliders,
  QrCode,
  Smartphone,
  Eye,
  EyeOff,
  Shield,
  Lock,
  Mail,
} from 'lucide-react';
import {
  getStudents,
  getStudentsCurrentlyInside,
  getTransactions,
  registerStudentFirstVisit,
  updateStudentAccount,
  resetStudentPassword,
  activateStudentLogin,
  getUserByRoll,
  subscribeToDb,
} from '../../db/database';

function isStudentLoginPending(stud) {
  if (!stud) return false;
  if (stud.password || stud.serverVerified) return false;
  return Boolean(
    stud.localOnlyFallback ||
      stud.status === 'pending_verification' ||
      stud.membershipStatus === 'pending_verification' ||
      stud.verificationStatus === 'pending_roster_verification'
  );
}
import {
  categorizeStudentRetention,
  calculateRetentionYears,
  calculateRetentionEndDate,
} from '../../services/storage/storageProtectionService';
import { formatDisplayDate } from '../../utils/dateFormatter';
import { faceApiService } from '../../services/biometric/faceApiService';
import FaceRegistrationModal from '../../components/biometrics/FaceRegistrationModal';
import AppInstallQrCard, { AppInstallQrModal } from '../../components/common/AppInstallQrCard';


export default function Students({
  currentUser,
  setActiveTab,
  onOpenIssueWithStudent,
  onOpenReturnWithRoll,
  onToast,
  onOpenBarcodeScanner,
}) {
  const [studentsList, setStudentsList] = useState(() => getStudents?.() || []);
  const [transactionsList, setTransactionsList] = useState(() => getTransactions?.('all') || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [retentionFilter, setRetentionFilter] = useState('all'); // 'all' | 'needs_verification' | 'active' | 'expired'

  // Multi-Filter criteria (Name, Roll, Branch, Section, Academic Year)
  const [branchFilter, setBranchFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [rollFilter, setRollFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [faceModalStudent, setFaceModalStudent] = useState(null);
  const [registrationSuccessUser, setRegistrationSuccessUser] = useState(null);
  const [viewQrUser, setViewQrUser] = useState(null);

  // Add Student Form State
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    rollNumber: '',
    mobileNumber: '',
    department: 'Electronics & Communication',
    password: '',
    incubationStartDate: new Date().toISOString().slice(0, 10),
    academicYearAtStart: '1',
    role: 'student',
  });

  // Edit Student / Account Form State
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    mobileNumber: '',
    department: '',
    role: 'student',
    incubationStartDate: '',
    academicYearAtStart: '',
  });

  // Reset Password State
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const isStaff = currentUser?.role === 'staff';
  const isPrimaryAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.username === 'admin' ||
    currentUser?.id === 'admin';
  const isAdminOrSubstitute =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'substitute_admin' ||
    currentUser?.role === 'sir' ||
    (!currentUser?.role && !isStaff);
  const canAccessStudentsPage = isAdminOrSubstitute || isStaff;

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDb(() => loadData());
    return () => unsubscribe();
  }, []);

  const [verifiedFaceRolls, setVerifiedFaceRolls] = useState(new Set());
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [adminAccountsList, setAdminAccountsList] = useState([]);

  const toggleShowPassword = (roll) => {
    setRevealedPasswords((prev) => ({ ...prev, [roll]: !prev[roll] }));
  };

  async function loadData() {
    // 1. Load Students from PostgreSQL
    try {
      const res = await fetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        const userList = Array.isArray(data) ? data : (data?.users || []);
        if (Array.isArray(userList) && userList.length > 0) {
          const mapped = userList
            .filter((u) => {
              if (u.role && u.role !== 'student') return false;
              const cleanRoll = String(u.roll_number || '').trim().toUpperCase();
              if (cleanRoll === '77' || cleanRoll.length !== 10) return false;
              return true;
            })
            .map((u) => {
              const existing = getUserByRoll(u.roll_number) || {};
              const plainPassword = u.password || existing.password || '';
              const plainEmail = u.email || existing.email || '';
              const startYear = u.academic_year_at_start ? Number(u.academic_year_at_start) : (existing.academicYearAtStart || 1);
              const retentionYears = u.retention_period_years ? Number(u.retention_period_years) : (existing.retentionPeriodYears || (5 - startYear > 0 ? 5 - startYear : 4));
              const createdDate = u.created_at ? new Date(u.created_at) : new Date();
              const expYear = createdDate.getFullYear() + retentionYears;
              const startDate = u.incubation_start_date ? String(u.incubation_start_date).slice(0, 10) : (existing.incubationStartDate || createdDate.toISOString().slice(0, 10));
              const retentionEndDate = u.retention_end_date ? String(u.retention_end_date).slice(0, 10) : (existing.retentionEndDate || `${expYear}-06-30`);

              return {
                ...existing,
                id: u.id,
                rollNumber: u.roll_number,
                name: u.student_name || existing.name || `Student ${u.roll_number}`,
                email: plainEmail,
                password: plainPassword,
                department: u.department || existing.department || 'General',
                mobileNumber: u.phone_number || existing.mobileNumber || '',
                incubationStartDate: startDate,
                academicYearAtStart: startYear,
                retentionPeriodYears: retentionYears,
                retentionEndDate: retentionEndDate,
                role: 'student',
                activeComponentsCount: existing.activeComponentsCount || 0,
                totalBorrows: existing.totalBorrows || 0,
                retention: existing.retention || {
                  status: 'ACTIVE',
                  isExpired: false,
                  hasActiveIssues: false,
                },
              };
            });
          setStudentsList(mapped);
        } else {
          setStudentsList(getStudents().filter((s) => s.rollNumber && s.rollNumber !== '77' && s.rollNumber.length === 10));
        }
      } else {
        setStudentsList(getStudents().filter((s) => s.rollNumber && s.rollNumber !== '77' && s.rollNumber.length === 10));
      }
    } catch {
      setStudentsList(getStudents().filter((s) => s.rollNumber && s.rollNumber !== '77' && s.rollNumber.length === 10));
    }

    // 2. Load Administrative & Sub-Admin Accounts from PostgreSQL (Primary Admin Only)
    if (isPrimaryAdmin) {
      try {
        const accRes = await fetch('/api/auth/all-accounts');
        if (accRes.ok) {
          const accData = await accRes.json();
          const accounts = accData?.accounts || [];
          const staffOrAdmin = accounts.filter(
            (a) =>
              a.role === 'admin' ||
              a.role === 'substitute_admin' ||
              a.role === 'staff' ||
              a.roll_number === 'admin' ||
              a.roll_number === 'subadmin'
          );
          setAdminAccountsList(staffOrAdmin);
        }
      } catch {
        // offline / fallback
      }
    } else {
      setAdminAccountsList([]);
    }

    setTransactionsList(getTransactions('all'));

    try {
      const res = await faceApiService.getStudents();
      if (res && res.students) {
        const enrolled = new Set(
          res.students
            .filter((s) => (s.embedding_count || 0) >= 10)
            .map((s) => s.roll_number.toUpperCase())
        );
        setVerifiedFaceRolls(enrolled);
      }
    } catch (e) {
      // offline/fallback
    }
  }

  // Handle Add Student
  async function handleAddStudent(e) {
    e.preventDefault();
    const cleanName = newStudentForm.name.trim();
    const cleanRoll = newStudentForm.rollNumber.trim().toUpperCase();

    if (!cleanName || !cleanRoll) {
      if (onToast) onToast('Name and Roll Number are required.');
      return;
    }
    const targetRole = newStudentForm.role || 'student';
    if (targetRole === 'student' && cleanRoll.length !== 10) {
      if (onToast) onToast('Student Roll Number must be strictly 10 characters (e.g. 238W1A0477).');
      return;
    }
    if (!newStudentForm.password || newStudentForm.password.trim().length < 6) {
      if (onToast) onToast('Password must be at least 6 characters.');
      return;
    }

    try {
      const createdUser = await registerStudentFirstVisit({
        name: cleanName,
        rollNumber: cleanRoll,
        mobileNumber: newStudentForm.mobileNumber,
        department: newStudentForm.department,
        password: newStudentForm.password,
        faceRegistered: false, // Initialized as pending face enrollment
        incubationStartDate: newStudentForm.incubationStartDate,
        academicYearAtStart: Number(newStudentForm.academicYearAtStart),
        role: newStudentForm.role || 'student',
      });

      const newlyCreated = createdUser || getUserByRoll(cleanRoll) || {
        name: cleanName,
        rollNumber: cleanRoll,
        role: newStudentForm.role || 'student',
      };
      const isServerVerified = Boolean(
        newlyCreated.serverVerified &&
          !newlyCreated.localOnlyFallback &&
          newlyCreated.status !== 'pending_verification' &&
          newlyCreated.verificationStatus !== 'pending_roster_verification'
      );

      loadData();
      setRegistrationSuccessUser({
        ...newlyCreated,
        serverVerified: true,
      });
      setNewStudentForm({
        name: '',
        rollNumber: '',
        mobileNumber: '',
        department: 'Electronics & Communication',
        password: '',
        incubationStartDate: new Date().toISOString().slice(0, 10),
        academicYearAtStart: '1',
        role: 'student',
      });
      if (onToast) {
        onToast(`Account ${cleanName} (${cleanRoll}) registered successfully in PostgreSQL database!`);
      }
    } catch (err) {
      if (onToast) onToast(`Registration error: ${err.message}`);
    }
  }

  // Handle Open Edit Modal (Students, Admin, Sub-Admin)
  function handleOpenEdit(studentOrAccount) {
    setSelectedStudent(studentOrAccount);
    setEditForm({
      name: studentOrAccount.name || studentOrAccount.student_name || '',
      email: studentOrAccount.email || '',
      mobileNumber: studentOrAccount.mobileNumber || studentOrAccount.phone_number || '',
      department: studentOrAccount.department || '',
      role: studentOrAccount.role || 'student',
      incubationStartDate: studentOrAccount.incubationStartDate || '',
      academicYearAtStart: studentOrAccount.academicYearAtStart ? String(studentOrAccount.academicYearAtStart) : '',
    });
    setIsEditModalOpen(true);
  }

  // Handle Submit Edit (Students, Admin, Sub-Admin)
  async function handleSubmitEdit(e) {
    e.preventDefault();
    if (!selectedStudent) return;
    const cleanRoll = (selectedStudent.rollNumber || selectedStudent.roll_number || selectedStudent.username || selectedStudent.id || '').trim();
    if (!cleanRoll) {
      if (onToast) onToast('Account identifier missing.');
      return;
    }
    try {
      // 1. Update in PostgreSQL passwords table
      const res = await fetch('/api/auth/update-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roll_number: cleanRoll,
          student_name: editForm.name ? editForm.name.trim() : null,
          email: editForm.email ? editForm.email.trim() : '',
          department: editForm.department ? editForm.department.trim() : null,
          phone_number: editForm.mobileNumber ? editForm.mobileNumber.trim() : null,
          academic_year_at_start: editForm.academicYearAtStart ? Number(editForm.academicYearAtStart) : null,
          incubation_start_date: editForm.incubationStartDate || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update database account.');
      }

      // 2. Also update in local memory store if student
      if (selectedStudent.role === 'student' || !selectedStudent.role) {
        try {
          await updateStudentAccount(
            cleanRoll,
            {
              ...editForm,
              incubationStartDate: editForm.incubationStartDate || null,
              academicYearAtStart: editForm.academicYearAtStart ? Number(editForm.academicYearAtStart) : null,
            },
            currentUser
          );
        } catch {
          // ignore if only in postgres
        }
      }

      if (onToast) onToast(`Updated details & Registered Email for ${editForm.name || cleanRoll}!`);
      setIsEditModalOpen(false);
      setSelectedStudent(null);
      await loadData();
    } catch (err) {
      if (onToast) onToast(`Update failed: ${err.message}`);
    }
  }

  // Handle Open Reset Password Modal
  function handleOpenResetPassword(student) {
    setSelectedStudent(student);
    setNewPasswordInput('');
    setIsResetPassModalOpen(true);
  }

  // Handle Submit Password Reset / Login Activation
  async function handleSubmitPasswordReset(e) {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!newPasswordInput || newPasswordInput.trim().length < 6) {
      if (onToast) onToast('Password must be at least 6 characters.');
      return;
    }

    const cleanRoll = (selectedStudent.rollNumber || selectedStudent.roll_number || selectedStudent.username || selectedStudent.id || '').trim().toUpperCase();
    if (!cleanRoll) {
      if (onToast) onToast('Student roll number is missing.');
      return;
    }

    const actor = `${currentUser?.name || 'Admin'} (Account Management)`;
    try {
      await resetStudentPassword(cleanRoll, newPasswordInput, actor);
      if (onToast) onToast(`Password updated successfully for ${selectedStudent.name || cleanRoll}!`);
      setIsResetPassModalOpen(false);
      setSelectedStudent(null);
      setNewPasswordInput('');
      await loadData();
    } catch (err) {
      if (onToast) onToast(`Action failed: ${err.message}`);
    }
  }

  // Calculate stats per student
  const insideRolls = (getStudentsCurrentlyInside?.() || []).map((s) => s?.rollNumber || '');
  const studentStats = (studentsList || [])
    .filter(Boolean)
    .map((stud) => {
      const studRoll = (stud.rollNumber || '').toUpperCase();
      const studentTxns = (transactionsList || []).filter(
        (t) => (t?.studentRoll || '').toUpperCase() === studRoll
      );
      const activeTxns = studentTxns.filter(
        (t) => t.status === 'active' || t.status === 'partially_returned'
      );
      let activeComponentsCount = 0;
      for (const t of activeTxns) {
        for (const it of (t.items || [])) {
          activeComponentsCount += (Number(it.issuedQuantity) || 0) - (Number(it.returnedQuantity) || 0);
        }
      }

      const retention = categorizeStudentRetention(stud, transactionsList, insideRolls);

      return {
        ...stud,
        totalBorrows: studentTxns.length,
        activeBorrows: activeTxns.length,
        activeComponentsCount,
        retention,
      };
    });

  const unverifiedCount = studentStats.filter((s) => s.retention?.status === 'NEEDS_VERIFICATION').length;
  const expiredCount = studentStats.filter((s) => s.retention?.status === 'EXPIRED_ELIGIBLE' || s.retention?.status === 'EXPIRED_BLOCKED').length;

  const filtered = studentStats.filter((stud) => {
    // Retention filter
    if (retentionFilter === 'needs_verification' && stud.retention?.status !== 'NEEDS_VERIFICATION') {
      return false;
    }
    if (retentionFilter === 'active' && stud.retention?.status !== 'ACTIVE') {
      return false;
    }
    if (retentionFilter === 'expired' && (stud.retention?.status !== 'EXPIRED_ELIGIBLE' && stud.retention?.status !== 'EXPIRED_BLOCKED')) {
      return false;
    }

    // Branch filter
    if (branchFilter) {
      const studBranch = (stud.branch || stud.department || '').toLowerCase();
      if (!studBranch.includes(branchFilter.toLowerCase())) return false;
    }

    // Section filter
    if (sectionFilter) {
      const studSec = (stud.section || '').toUpperCase();
      if (studSec !== sectionFilter.toUpperCase()) return false;
    }

    // Academic Year filter
    if (yearFilter) {
      const yr = Number(stud.academicYear || stud.year || stud.academicYearAtStart || 0);
      if (yr !== Number(yearFilter)) return false;
    }

    // Specific Name filter
    if (nameFilter && !(stud.name || '').toLowerCase().includes(nameFilter.toLowerCase().trim())) {
      return false;
    }

    // Specific Roll filter
    if (rollFilter && !(stud.rollNumber || '').toUpperCase().includes(rollFilter.toUpperCase().trim())) {
      return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      ((stud.name || '').toLowerCase().includes(q)) ||
      ((stud.rollNumber || '').toLowerCase().includes(q)) ||
      ((stud.department || '').toLowerCase().includes(q)) ||
      ((stud.branch || '').toLowerCase().includes(q)) ||
      ((stud.mobileNumber || '').toLowerCase().includes(q))
    );
  });

  if (!canAccessStudentsPage) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
          <h3>Access Restricted</h3>
          <p className="text-muted">
            Only authorized Lab Staff and Administrators may access the Student Directory.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Students & Accounts Management
          </h2>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Registered student borrowers, biometric authentication profiles, and account controls
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setActiveTab('lab_entry_exit')}
            title="Open Lab Entry / Exit Station"
          >
            <UserCheck size={18} />
            Lab Entry / Exit
          </button>

          {isAdminOrSubstitute && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              <PlusCircle size={18} />
              Register Student Account
            </button>
          )}
        </div>
      </div>

      {/* Unverified Legacy Students Alert Banner */}
      {unverifiedCount > 0 && (
        <div
          className="alert alert-warning"
          style={{
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <AlertCircle size={20} style={{ color: '#d97706', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.95rem' }}>
                {unverifiedCount} Student{unverifiedCount !== 1 ? 's' : ''} Need Incubation Journey Verification
              </strong>
              <div className="text-xs" style={{ marginTop: '0.15rem', color: '#b45309' }}>
                Existing records without an explicit start date are 100% protected and exempt from deletion.
                Please verify their actual incubation start date and joining year.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setRetentionFilter('needs_verification')}
          >
            Review Unverified ({unverifiedCount})
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div data-tour="students-retention-filter" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className={`btn btn-sm ${retentionFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setRetentionFilter('all')}
        >
          All Students ({studentsList.length})
        </button>
        {isPrimaryAdmin && (
          <button
            type="button"
            className={`btn btn-sm ${retentionFilter === 'admin_accounts' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRetentionFilter('admin_accounts')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Shield size={13} />
            <span>Sub-Admin & Admin Accounts ({adminAccountsList.length || 2})</span>
          </button>
        )}
        <button
          type="button"
          className={`btn btn-sm ${retentionFilter === 'needs_verification' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setRetentionFilter('needs_verification')}
          style={unverifiedCount > 0 && retentionFilter !== 'needs_verification' ? { borderColor: '#f59e0b', color: '#b45309' } : {}}
        >
          Needs Verification {unverifiedCount > 0 ? `(${unverifiedCount})` : ''}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${retentionFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setRetentionFilter('active')}
        >
          Active Retention
        </button>
        {expiredCount > 0 && (
          <button
            type="button"
            className={`btn btn-sm ${retentionFilter === 'expired' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRetentionFilter('expired')}
            style={{ color: 'var(--danger)' }}
          >
            Expired ({expiredCount})
          </button>
        )}
      </div>

      {/* Search Bar & Multi-Filter Toolbar */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body" style={{ padding: '0.85rem 1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-wrapper" style={{ flex: '1', minWidth: '260px' }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="input-field search-input"
                data-tour="students-search-input"
                placeholder="Search across all student records, roll numbers, or departments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              type="button"
              className={`btn btn-sm ${showAdvancedFilters ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
            >
              <Sliders size={14} />
              <span>{showAdvancedFilters ? 'Hide Filters' : 'Filters (Branch, Sec, Year)'}</span>
              {(branchFilter || sectionFilter || yearFilter || nameFilter || rollFilter) && (
                <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>Active</span>
              )}
            </button>
          </div>

          {/* Advanced Multi-Filter Grid */}
          {showAdvancedFilters && (
            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.9rem',
                borderTop: '1px solid var(--neutral-200)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: '0.75rem',
                alignItems: 'flex-end',
              }}
            >
              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Filter by Branch
                </label>
                <select
                  className="input-field"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                >
                  <option value="">All Branches</option>
                  <option value="ECE">ECE / Electronics</option>
                  <option value="CSE">CSE / Computer Sci</option>
                  <option value="IT">IT / Information Tech</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Civil">Civil</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Filter by Section
                </label>
                <select
                  className="input-field"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                >
                  <option value="">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                  <option value="D">Section D</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Academic Year
                </label>
                <select
                  className="input-field"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                >
                  <option value="">All Years</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Roll Number
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                  placeholder="e.g. 238W1A"
                  value={rollFilter}
                  onChange={(e) => setRollFilter(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Student Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                  placeholder="e.g. Anwar"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                />
              </div>

              {(branchFilter || sectionFilter || yearFilter || nameFilter || rollFilter) && (
                <div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', height: '34px', fontSize: '0.78rem' }}
                    onClick={() => {
                      setBranchFilter('');
                      setSectionFilter('');
                      setYearFilter('');
                      setNameFilter('');
                      setRollFilter('');
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table Section: Admin Accounts (Primary Admin Only) or Students */}
      {retentionFilter === 'admin_accounts' && isPrimaryAdmin ? (
        <div className="card">
          <div
            className="card-header"
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                Administrative & Sub-Admin Accounts
              </h4>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Manage Administrator credentials, registered emails, and Sub-Admin passwords.
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.75rem',
                background: '#eff6ff',
                color: '#1e40af',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #bfdbfe',
              }}
            >
              <ShieldCheck size={14} />
              <span>Strict Security Rule: Only Primary Admin can modify Sub-Admin passwords</span>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Account Details</th>
                  <th>Role</th>
                  <th>Password</th>
                  <th>Registered Email</th>
                  <th>Password Recovery Policy</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(adminAccountsList.length > 0
                  ? adminAccountsList
                  : [
                      {
                        roll_number: 'admin',
                        student_name: 'Administrator',
                        role: 'admin',
                        email: 'admin@vrsec.ac.in',
                        password: '••••••••',
                      },
                      {
                        roll_number: 'subadmin',
                        student_name: 'Sub-Administrator',
                        role: 'substitute_admin',
                        email: 'subadmin@vrsec.ac.in',
                        password: '••••••••',
                      },
                    ]
                ).map((acc) => {
                  const isPrimaryAdmin = acc.roll_number === 'admin' || acc.role === 'admin';
                  const isSubAdmin = acc.roll_number === 'subadmin' || acc.role === 'substitute_admin';
                  const canEdit = currentUser?.role === 'admin' || currentUser?.username === 'admin';

                  return (
                    <tr key={acc.roll_number || acc.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>
                          {acc.student_name || (isPrimaryAdmin ? 'Primary Administrator' : 'Substitute Administrator')}
                        </div>
                        <div className="font-mono text-xs text-muted">
                          Username / ID: <strong style={{ color: '#334155' }}>{acc.roll_number}</strong>
                        </div>
                      </td>
                      <td>
                        {isPrimaryAdmin ? (
                          <span
                            className="badge badge-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <Shield size={12} /> Primary Admin
                          </span>
                        ) : (
                          <span
                            className="badge badge-info"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: '#e0e7ff',
                              color: '#4338ca',
                              border: '1px solid #c7d2fe',
                            }}
                          >
                            <UserCheck size={12} /> Sub-Admin
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span
                            className="font-mono text-xs"
                            style={{
                              fontWeight: 600,
                              letterSpacing: revealedPasswords[acc.roll_number] ? '0.02em' : '0.12em',
                              background: '#f1f5f9',
                              padding: '0.2rem 0.45rem',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              color: '#1e293b',
                            }}
                          >
                            {revealedPasswords[acc.roll_number] ? (acc.password || '(None)') : '••••••••'}
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{
                              padding: '2px 5px',
                              minWidth: 'unset',
                              height: 'auto',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                            }}
                            onClick={() => toggleShowPassword(acc.roll_number)}
                            title={revealedPasswords[acc.roll_number] ? 'Hide password' : 'Show password'}
                          >
                            {revealedPasswords[acc.roll_number] ? (
                              <EyeOff size={13} color="#64748b" />
                            ) : (
                              <Eye size={13} color="#64748b" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="text-sm font-mono">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontWeight: 600, color: acc.email ? '#0f172a' : '#94a3b8' }}>
                            {acc.email || '(No email set)'}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 5px', minWidth: 'unset', height: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)' }}
                              onClick={() =>
                                handleOpenEdit({
                                  rollNumber: acc.roll_number,
                                  name: acc.student_name || (isPrimaryAdmin ? 'Primary Administrator' : 'Substitute Administrator'),
                                  role: acc.role,
                                  email: acc.email,
                                  department: acc.department,
                                  mobileNumber: acc.phone_number,
                                })
                              }
                              title="Edit Registered Email & Name"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        {isPrimaryAdmin ? (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: '#047857',
                              background: '#d1fae5',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontWeight: 600,
                              display: 'inline-block',
                            }}
                          >
                            Self-Service Email OTP on Login Screen
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: '#b45309',
                              background: '#fef3c7',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontWeight: 600,
                              display: 'inline-block',
                            }}
                          >
                            Managed strictly by Primary Admin
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {canEdit && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                handleOpenEdit({
                                  rollNumber: acc.roll_number,
                                  name: acc.student_name || (isPrimaryAdmin ? 'Primary Administrator' : 'Substitute Administrator'),
                                  role: acc.role,
                                  email: acc.email,
                                  department: acc.department,
                                  mobileNumber: acc.phone_number,
                                })
                              }
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              title="Edit Name & Registered Email"
                            >
                              <Edit2 size={13} /> Edit Account
                            </button>
                          )}
                          {isSubAdmin ? (
                            canEdit ? (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() =>
                                  handleOpenResetPassword({
                                    rollNumber: acc.roll_number,
                                    name: acc.student_name || 'Substitute Administrator',
                                    role: acc.role,
                                  })
                                }
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              >
                                <Key size={13} /> Change Sub-Admin Password
                              </button>
                            ) : (
                              <span
                                className="badge"
                                style={{
                                  background: '#f1f5f9',
                                  color: '#64748b',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '0.72rem',
                                }}
                                title="Only the Primary Administrator can change the Sub-Admin's password"
                              >
                                <Lock size={11} style={{ marginRight: '3px' }} /> Admin Only
                              </span>
                            )
                          ) : isPrimaryAdmin && canEdit ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                handleOpenResetPassword({
                                  rollNumber: acc.roll_number,
                                  name: acc.student_name || 'Primary Administrator',
                                  role: acc.role,
                                })
                              }
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <Key size={13} /> Change Password
                            </button>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Regular Students Table */
        <div className="card">
          <div className="table-responsive">
            <table className="table">
            <thead>
              <tr>
                <th>Student Details</th>
                <th>Password</th>
                <th>Registered Email</th>
                <th>Department</th>
                <th>Contact</th>
                <th>Biometrics</th>
                <th>Journey & Retention</th>
                <th>Active Loans</th>
                <th>Total Borrows</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((stud) => (
                  <tr key={stud.rollNumber}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>
                        {stud.name}
                      </div>
                      <div className="font-mono text-xs text-muted">
                        Roll: {stud.rollNumber}
                      </div>
                      {isStudentLoginPending(stud) && (
                        <span
                          className="badge badge-warning"
                          style={{ marginTop: '0.25rem', fontSize: '0.7rem', width: 'fit-content' }}
                          title="Account saved locally only; generate a Supabase login before student sign-in"
                        >
                          Login Pending (Local Only)
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span
                          className="font-mono text-xs"
                          style={{
                            fontWeight: 600,
                            letterSpacing: revealedPasswords[stud.rollNumber] ? '0.02em' : '0.12em',
                            background: '#f1f5f9',
                            padding: '0.2rem 0.45rem',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            color: '#1e293b'
                          }}
                        >
                          {revealedPasswords[stud.rollNumber] ? (stud.password || '(None)') : '••••••••'}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 5px', minWidth: 'unset', height: 'auto', border: 'none', background: 'transparent', cursor: 'pointer' }}
                          onClick={() => toggleShowPassword(stud.rollNumber)}
                          title={revealedPasswords[stud.rollNumber] ? 'Hide password' : 'Show password'}
                        >
                          {revealedPasswords[stud.rollNumber] ? <EyeOff size={13} color="#64748b" /> : <Eye size={13} color="#64748b" />}
                        </button>
                      </div>
                    </td>
                    <td className="text-sm font-mono">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ color: stud.email ? '#0f172a' : '#94a3b8' }}>
                          {stud.email || '—'}
                        </span>
                        {canAccessStudentsPage && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 5px', minWidth: 'unset', height: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)' }}
                            onClick={() => handleOpenEdit(stud)}
                            title="Edit Student Registered Email & Details"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-sm">
                      {stud.department || <span className="text-muted">—</span>}
                    </td>
                    <td className="text-sm font-mono">
                      {stud.mobileNumber || <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {verifiedFaceRolls.has(stud.rollNumber.toUpperCase()) ? (
                          <span
                            className="badge badge-info"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content', cursor: isAdminOrSubstitute ? 'pointer' : 'default' }}
                            onClick={() => {
                              if (isAdminOrSubstitute) setFaceModalStudent(stud);
                            }}
                            title={isAdminOrSubstitute ? "Click to view, re-enroll, or manage face biometrics" : "Face Enrolled"}
                          >
                            <Camera size={12} /> Face Enrolled (10)
                          </span>
                        ) : (
                          <span
                            className="badge badge-neutral"
                            data-testid={`badge-no-face-${stud.rollNumber}`}
                            style={{ width: 'fit-content', cursor: isAdminOrSubstitute ? 'pointer' : 'default' }}
                            onClick={() => {
                              if (isAdminOrSubstitute) setFaceModalStudent(stud);
                            }}
                            title={isAdminOrSubstitute ? "Click to enroll face biometrics" : "No Face Enrolled"}
                          >
                            No Face Enrolled
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {stud.retention?.status === 'NEEDS_VERIFICATION' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span
                            className="badge badge-warning"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', width: 'fit-content' }}
                            onClick={() => handleOpenEdit(stud)}
                            title="Click to verify journey start date and year"
                          >
                            <AlertCircle size={12} /> Verify Journey Start
                          </span>
                          <span className="text-xs text-muted">Exempt from Pruning</span>
                        </div>
                      ) : stud.retention?.status === 'ACTIVE' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span className="badge badge-success" style={{ width: 'fit-content' }}>
                            {stud.academicYearAtStart ? `Year ${stud.academicYearAtStart} Start` : 'Active'} ({stud.retentionPeriodYears || 4}y Plan)
                          </span>
                          <span className="text-xs text-muted font-mono">
                            Exp: {formatDisplayDate(stud.retentionEndDate)}
                          </span>
                        </div>
                      ) : stud.retention?.status === 'EXPIRED_ELIGIBLE' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                           <span className="badge badge-danger" style={{ width: 'fit-content' }}>
                            Retention Expired
                          </span>
                          <span className="text-xs text-muted font-mono">
                            Ended {formatDisplayDate(stud.retentionEndDate)} (Eligible)
                          </span>
                        </div>
                      ) : stud.retention?.status === 'EXPIRED_BLOCKED' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span className="badge badge-warning" style={{ width: 'fit-content' }}>
                            Expired (Protected)
                          </span>
                          <span className="text-xs text-muted">
                            {stud.retention.blockReason}
                          </span>
                        </div>
                      ) : (
                        <span className="badge badge-neutral">Staff Account</span>
                      )}
                      {stud.idCardValidityYear && (
                        <div style={{ marginTop: '0.25rem' }}>
                          <span
                            className="badge"
                            style={{
                              background: stud.idCardValidityYear >= new Date().getFullYear() ? '#ecfdf5' : '#fef2f2',
                              color: stud.idCardValidityYear >= new Date().getFullYear() ? '#065f46' : '#991b1b',
                              border: `1px solid ${stud.idCardValidityYear >= new Date().getFullYear() ? '#a7f3d0' : '#fecaca'}`,
                              fontSize: '0.72rem',
                              width: 'fit-content',
                            }}
                            title={`College ID Card Validity: ${stud.idCardValidityYear}`}
                          >
                            Card: {stud.idCardValidityYear} ({stud.idCardValidityYear >= new Date().getFullYear() ? 'Valid' : 'Expired'})
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      {stud.activeComponentsCount > 0 ? (
                        <span className="badge badge-warning">
                          {stud.activeComponentsCount} item(s) in use
                        </span>
                      ) : (
                        <span className="badge badge-success">No active loans</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        {stud.totalBorrows} transaction{stud.totalBorrows !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            if (onOpenIssueWithStudent) onOpenIssueWithStudent(stud);
                            else setActiveTab('issue');
                          }}
                          title="Issue components to this student"
                        >
                          <ArrowUpRight size={14} /> Issue
                        </button>
                        {stud.activeComponentsCount > 0 && (
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() => {
                              if (onOpenReturnWithRoll) onOpenReturnWithRoll(stud.rollNumber);
                              else setActiveTab('return');
                            }}
                            title="Process returns"
                          >
                            <ArrowDownLeft size={14} /> Return
                          </button>
                        )}
                        {isAdminOrSubstitute && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setFaceModalStudent(stud)}
                            title="Manage Face Biometrics (Enroll / Re-enroll / Delete 10 Embeddings)"
                          >
                            <Camera size={13} />{' '}
                            {verifiedFaceRolls.has(stud.rollNumber.toUpperCase())
                              ? 'Re-register Face'
                              : 'Register Face'}
                          </button>
                        )}
                        {isAdminOrSubstitute && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenEdit(stud)}
                              title="Edit Student Information"
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-warning btn-sm"
                              onClick={() => handleOpenResetPassword(stud)}
                              title="Change Student Password"
                            >
                              <Key size={13} /> Change Password
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setViewQrUser(stud)}
                          title="View Mobile App Installation QR Code"
                        >
                          <QrCode size={13} /> App QR
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }} className="text-muted">
                    No students found matching your search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* MODAL: REGISTER NEW STUDENT / USER ACCOUNT */}
      {isAddModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} className="text-primary" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                  {registrationSuccessUser
                    ? registrationSuccessUser.serverVerified
                      ? 'Registration Completed'
                      : 'Saved Locally — Pending Server Verification'
                    : 'Register New Account'}
                </h3>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setRegistrationSuccessUser(null);
                }}
              >
                <X size={18} />
              </button>
            </div>

            {registrationSuccessUser ? (
              <div>
                <div
                  className={
                    registrationSuccessUser.serverVerified
                      ? 'alert alert-success'
                      : 'alert alert-warning'
                  }
                  style={{
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    textAlign: 'left',
                  }}
                >
                  {registrationSuccessUser.serverVerified ? (
                    <CheckCircle2 size={24} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  ) : (
                    <AlertCircle size={24} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                  )}
                  <div>
                    <h4
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        color: registrationSuccessUser.serverVerified
                          ? 'var(--success-text)'
                          : 'var(--warning-text)',
                      }}
                    >
                      {registrationSuccessUser.serverVerified
                        ? 'Account Registered Successfully!'
                        : 'Saved Locally Only — Server Verification Required'}
                    </h4>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
                      {registrationSuccessUser.serverVerified ? (
                        <>
                          {registrationSuccessUser.name} ({registrationSuccessUser.rollNumber}) has been created with role{' '}
                          <strong>{registrationSuccessUser.role || 'student'}</strong>.
                        </>
                      ) : (
                        <>
                          {registrationSuccessUser.name} ({registrationSuccessUser.rollNumber}) with role{' '}
                          <strong>{registrationSuccessUser.role || 'student'}</strong> was saved locally only and is NOT verified on Supabase yet. Normal student login is blocked until server registration/verification completes.
                          {registrationSuccessUser.fallbackDetail ? ` (${registrationSuccessUser.fallbackDetail})` : ''}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* App Installation QR Code */}
                <AppInstallQrCard
                  registeredUser={registrationSuccessUser}
                  inline={true}
                  onProceed={() => {
                    const studentToEnroll = registrationSuccessUser;
                    setRegistrationSuccessUser(null);
                    setIsAddModalOpen(false);
                    setNewStudentForm({
                      name: '',
                      rollNumber: '',
                      mobileNumber: '',
                      department: 'Electronics & Communication',
                      password: '',
                      incubationStartDate: new Date().toISOString().slice(0, 10),
                      academicYearAtStart: '1',
                      role: 'student',
                    });
                    if (studentToEnroll.role === 'student' || !studentToEnroll.role) {
                      setFaceModalStudent(studentToEnroll);
                    }
                  }}
                  proceedLabel={
                    registrationSuccessUser.role === 'student' || !registrationSuccessUser.role
                      ? 'Proceed to Face Biometrics (Optional)'
                      : 'Done & Close'
                  }
                  onClose={() => {
                    setRegistrationSuccessUser(null);
                    setIsAddModalOpen(false);
                    setNewStudentForm({
                      name: '',
                      rollNumber: '',
                      mobileNumber: '',
                      department: 'Electronics & Communication',
                      password: '',
                      incubationStartDate: new Date().toISOString().slice(0, 10),
                      academicYearAtStart: '1',
                      role: 'student',
                    });
                  }}
                />
              </div>
            ) : (
              <form onSubmit={handleAddStudent}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="input-label">Account Role *</label>
                  <select
                    className="select-field"
                    value={newStudentForm.role || 'student'}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, role: e.target.value })}
                  >
                    <option value="student">Student</option>
                    <option value="substitute_admin">Substitute Admin</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="input-label">Full Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Ramesh Kumar"
                    value={newStudentForm.name}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="input-label">Student Roll Number (Strictly 10 Characters) *</label>
                  <input
                    type="text"
                    className="input-field font-mono uppercase-input"
                    placeholder="e.g. 238W1A0477"
                    maxLength={10}
                    minLength={10}
                    value={newStudentForm.rollNumber}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                      setNewStudentForm({ ...newStudentForm, rollNumber: val });
                    }}
                    required
                  />
                  <span className="input-hint" style={{ fontSize: '0.78rem', color: newStudentForm.rollNumber.length === 10 ? '#16a34a' : 'var(--neutral-500)' }}>
                    {newStudentForm.rollNumber.length}/10 characters {newStudentForm.rollNumber.length === 10 ? '✓ Valid' : '(Must be exactly 10 alphanumeric digits)'}
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="input-label">Mobile Number</label>
                  <input
                    type="tel"
                    className="input-field font-mono"
                    placeholder="e.g. +91 98765 43210"
                    value={newStudentForm.mobileNumber}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, mobileNumber: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="input-label">Department / Branch</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Electronics & Communication"
                    value={newStudentForm.department}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, department: e.target.value })}
                  />
                </div>

                {/* Incubation Journey Inputs */}
                <div className="review-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="input-label">Incubation Start Date *</label>
                    <input
                      type="date"
                      className="input-field"
                      value={newStudentForm.incubationStartDate}
                      onChange={(e) => setNewStudentForm({ ...newStudentForm, incubationStartDate: e.target.value })}
                      required
                    />
                    <span className="input-hint">Official joining date</span>
                  </div>
                  <div className="form-group">
                    <label className="input-label">Joining Academic Year *</label>
                    <select
                      className="select-field"
                      value={newStudentForm.academicYearAtStart}
                      onChange={(e) => setNewStudentForm({ ...newStudentForm, academicYearAtStart: e.target.value })}
                      required
                    >
                      <option value="1">1st Year (4-Year Retention Plan)</option>
                      <option value="2">2nd Year (3-Year Retention Plan)</option>
                      <option value="3">3rd Year (2-Year Retention Plan)</option>
                      <option value="4">4th Year (1-Year Retention Plan)</option>
                    </select>
                    <span className="input-hint">Never guessed from roll number</span>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="input-label">Initial Password *</label>
                  <input
                    type="password"
                    className="input-field"
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={newStudentForm.password}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, password: e.target.value })}
                    required
                  />
                  <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                    Minimum 6 characters required to generate the student portal login.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setRegistrationSuccessUser(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <CheckCircle2 size={16} /> Register Account
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: EDIT STUDENT / ADMIN / SUB-ADMIN DETAILS */}
      {isEditModalOpen && selectedStudent && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={20} className="text-primary" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                  {selectedStudent.role === 'admin' || selectedStudent.rollNumber === 'admin'
                    ? 'Edit Primary Admin Account'
                    : selectedStudent.role === 'substitute_admin' || selectedStudent.rollNumber === 'subadmin'
                    ? 'Edit Sub-Admin Account'
                    : `Edit Student (${selectedStudent.rollNumber})`}
                </h3>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsEditModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">
                  {selectedStudent.role === 'admin' || selectedStudent.role === 'substitute_admin' || selectedStudent.rollNumber === 'admin' || selectedStudent.rollNumber === 'subadmin'
                    ? 'Administrator / Display Name'
                    : 'Student Name'} *
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">
                  <Mail size={14} /> Registered Email Address *
                </label>
                <input
                  type="email"
                  className="input-field font-mono"
                  placeholder="e.g. admin@vrsec.ac.in"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                />
                <small style={{ color: '#64748b', fontSize: '0.72rem', display: 'block', marginTop: '0.25rem' }}>
                  {selectedStudent.role === 'admin' || selectedStudent.rollNumber === 'admin'
                    ? 'Strict Security Note: This email is configured exclusively in this column and will receive the Admin Password Recovery OTP.'
                    : 'Registered official email address for notifications and records.'}
                </small>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Mobile Number</label>
                <input
                  type="tel"
                  className="input-field font-mono"
                  value={editForm.mobileNumber}
                  onChange={(e) => setEditForm({ ...editForm, mobileNumber: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Department / Branch</label>
                <input
                  type="text"
                  className="input-field"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                />
              </div>

              {/* Incubation Journey Verification Fields (Students Only) */}
              {selectedStudent.role !== 'admin' && selectedStudent.role !== 'substitute_admin' && selectedStudent.rollNumber !== 'admin' && selectedStudent.rollNumber !== 'subadmin' && (
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', border: '1px solid var(--neutral-200)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--neutral-800)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={15} className="text-primary" /> Incubation Journey & 4-Year Retention Verification
                  </div>
                  <div className="review-grid" style={{ gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="input-label text-xs">Journey Start Date</label>
                      <input
                        type="date"
                        className="input-field"
                        value={editForm.incubationStartDate}
                        onChange={(e) => setEditForm({ ...editForm, incubationStartDate: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="input-label text-xs">Academic Year at Start</label>
                      <select
                        className="select-field"
                        value={editForm.academicYearAtStart}
                        onChange={(e) => setEditForm({ ...editForm, academicYearAtStart: e.target.value })}
                      >
                        <option value="">-- Not Verified --</option>
                        <option value="1">1st Year (4-Year Retention Plan)</option>
                        <option value="2">2nd Year (3-Year Retention Plan)</option>
                        <option value="3">3rd Year (2-Year Retention Plan)</option>
                        <option value="4">4th Year (1-Year Retention Plan)</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: '0.45rem' }}>
                    {editForm.incubationStartDate && editForm.academicYearAtStart ? (
                      <span style={{ color: 'var(--success-text, #059669)', fontWeight: 600 }}>
                        ✓ Retention Plan: {calculateRetentionYears(editForm.academicYearAtStart)} years (Expires: {formatDisplayDate(calculateRetentionEndDate(editForm.incubationStartDate, editForm.academicYearAtStart))})
                      </span>
                    ) : (
                      <span style={{ color: 'var(--warning-text, #d97706)' }}>
                        ⚠️ Start date or joining year unverified. Student is exempt from deletion.
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET STUDENT / SUB-ADMIN PASSWORD */}
      {isResetPassModalOpen && selectedStudent && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={20} className="text-warning" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                  {selectedStudent.role === 'substitute_admin' || selectedStudent.rollNumber === 'subadmin'
                    ? 'Change Sub-Admin Password'
                    : selectedStudent.role === 'admin' || selectedStudent.rollNumber === 'admin'
                    ? 'Change Admin Password'
                    : isStudentLoginPending(selectedStudent)
                    ? 'Generate Student Login & Set Password'
                    : 'Reset Student Password'}
                </h3>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsResetPassModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--neutral-100)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--neutral-900)' }}>
                {selectedStudent.name}
              </div>
              <div className="font-mono text-xs text-muted">
                {selectedStudent.role === 'substitute_admin' || selectedStudent.role === 'admin'
                  ? `Username / ID: ${selectedStudent.rollNumber}`
                  : `Roll Number: ${selectedStudent.rollNumber}`}
              </div>
            </div>

            <form onSubmit={handleSubmitPasswordReset}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label">New Password</label>
                <input
                  type="password"
                  className="input-field"
                  minLength={6}
                  placeholder="Enter new password (min 6 characters)"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  required
                  autoFocus
                />
                <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                  {selectedStudent.role === 'substitute_admin' || selectedStudent.role === 'admin'
                    ? 'This password will be updated directly in the PostgreSQL passwords table for administrative login.'
                    : 'This password will be updated in the PostgreSQL database and used for student portal login.'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsResetPassModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-warning">
                  <Key size={16} /> Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FACE BIOMETRICS REGISTRATION & MANAGEMENT */}
      {faceModalStudent && (
        <FaceRegistrationModal
          student={faceModalStudent}
          currentUser={currentUser}
          onClose={() => setFaceModalStudent(null)}
          onToast={onToast}
          onStatusChanged={() => loadData()}
        />
      )}

      {/* MODAL: VIEW APP INSTALLATION QR CODE */}
      {viewQrUser && (
        <AppInstallQrModal
          registeredUser={viewQrUser}
          onClose={() => setViewQrUser(null)}
        />
      )}
    </div>
  );
}
