// src/pages/LabEntryExit.jsx
// Biometric Entrance/Exit Station: Face Recognition, Manual Identification,
// First-Visit Registration, "Is this your roll number?" confirmation with inline "Reset Password" button.

import React, { useState, useEffect } from 'react';
import {
  Camera,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  Key,
  UserPlus,
  Lock,
  UserCheck,
  ShieldCheck,
  Sparkles,
  ScanLine,
  X,
  Filter,
  Building,
  LogOut,
  Users,
} from 'lucide-react';
import {
  recordLabEntry,
  recordLabExit,
  toggleLabAttendance,
  registerStudentFirstVisit,
  resetStudentPassword,
  getUserByRoll,
  getAllUsers,
  getStudentActiveVisit,
  getRollNumberPrefixSuggestions,
  subscribeToDb,
  recordVisitorLabEntry,
  recordVisitorLabExit,
  fetchActiveVisitors,
} from '../../db/database';
import {
  combinePrefixAndSuffix,
  validateStudentRollNumber,
  normalizeRollNumber,
} from '../../utils/rollNumberPrefixHelper';
import { biometricService } from '../../services/biometric/biometricService';
import FaceRegistrationModal from '../../components/biometrics/FaceRegistrationModal';
import AppInstallQrCard from '../../components/common/AppInstallQrCard';


export default function LabEntryExit({ currentUser, onToast, onOpenBarcodeScanner, onOpenFaceAttendance }) {
  const [activeMode, setActiveMode] = useState('attendance'); // 'attendance' | 'first_registration'

  // Identification State
  const [selectedMethod, setSelectedMethod] = useState('face'); // 'face' | 'manual'
  const [isScanning, setIsScanning] = useState(false);
  const [manualRollInput, setManualRollInput] = useState('');
  const [faceModalStudent, setFaceModalStudent] = useState(null);

  // Intelligent Prefix Suggestions State
  const [selectedPrefix, setSelectedPrefix] = useState('');
  const [suffixInput, setSuffixInput] = useState('');
  const [prefixSearchQuery, setPrefixSearchQuery] = useState('');
  const [prefixSuggestions, setPrefixSuggestions] = useState([]);
  const [liveStudentMatch, setLiveStudentMatch] = useState(null);
  const [liveValidationError, setLiveValidationError] = useState('');

  // Load prefix suggestions dynamically from registered students
  useEffect(() => {
    loadPrefixes();
    const unsubscribe = subscribeToDb(() => {
      loadPrefixes();
    });
    return () => unsubscribe();
  }, []);

  function loadPrefixes() {
    const suggestions = getRollNumberPrefixSuggestions();
    setPrefixSuggestions(suggestions);
  }

  function handleSelectMethod(method) {
    setSelectedMethod(method);
    setErrorMessage('');
    setCompletionMessage(null);
    setIdentifiedStudent(null);
    if (method === 'manual') {
      loadPrefixes();
    }
  }

  function handleSelectPrefix(pfx) {
    setSelectedPrefix(pfx);
    setSuffixInput('');
    setLiveStudentMatch(null);
    setLiveValidationError('');
    setManualRollInput(pfx);
  }

  function handleClearPrefix() {
    setSelectedPrefix('');
    setSuffixInput('');
    setLiveStudentMatch(null);
    setLiveValidationError('');
    setManualRollInput('');
  }

  function handleSuffixChange(val) {
    const cleanSuffix = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2);
    setSuffixInput(cleanSuffix);
    const combined = combinePrefixAndSuffix(selectedPrefix, cleanSuffix);
    setManualRollInput(combined);

    if (combined.length === 10) {
      const res = validateStudentRollNumber(combined, getUserByRoll);
      if (res.isValid && res.student) {
        setLiveStudentMatch(res.student);
        setLiveValidationError('');
      } else {
        setLiveStudentMatch(null);
        setLiveValidationError(res.message);
      }
    } else {
      setLiveStudentMatch(null);
      setLiveValidationError('');
    }
  }

  function handleFullRollChange(val) {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    setManualRollInput(clean);

    if (clean.length === 10) {
      const res = validateStudentRollNumber(clean, getUserByRoll);
      if (res.isValid && res.student) {
        setLiveStudentMatch(res.student);
        setLiveValidationError('');
      } else {
        setLiveStudentMatch(null);
        setLiveValidationError(res.message);
      }
    } else {
      setLiveStudentMatch(null);
      setLiveValidationError('');
    }
  }

  // Confirmation Step State
  // When recognized: shows roll number, "Is this your roll number?", and "Reset Password"
  const [identifiedStudent, setIdentifiedStudent] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [resetError, setResetError] = useState('');

  // Result messages
  const [completionMessage, setCompletionMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Mode Switch Handler - cleanly resets all transient UI states
  function handleModeSwitch(newMode) {
    setActiveMode(newMode);
    setIdentifiedStudent(null);
    setCompletionMessage(null);
    setErrorMessage('');
    setManualRollInput('');
    setSelectedPrefix('');
    setSuffixInput('');
    setLiveStudentMatch(null);
    setLiveValidationError('');
    setIsScanning(false);
    setIsConfirming(false);
  }

  // First-Visit Registration Form State
  const [regName, setRegName] = useState('');
  const [regRoll, setRegRoll] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDepartment, setRegDepartment] = useState('Electronics & Communication Engineering');
  const [regStartDate, setRegStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [regAcademicYear, setRegAcademicYear] = useState('1');
  const [enrollmentStep, setEnrollmentStep] = useState(null);

  // Visitor Attendance Form State (Non-Registered & Occasional Visitors)
  const [visitorName, setVisitorName] = useState('');
  const [visitorType, setVisitorType] = useState('Visiting Faculty');
  const [visitorOrg, setVisitorOrg] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [visitorPurpose, setVisitorPurpose] = useState('');
  const [visitorHost, setVisitorHost] = useState('');
  const [visitorRemarks, setVisitorRemarks] = useState('');
  const [isSubmittingVisitor, setIsSubmittingVisitor] = useState(false);
  const [activeVisitorsList, setActiveVisitorsList] = useState([]);

  useEffect(() => {
    loadActiveVisitors();
  }, []);

  async function loadActiveVisitors() {
    try {
      const visitors = await fetchActiveVisitors();
      setActiveVisitorsList(visitors);
    } catch (_) {}
  }

  async function handleVisitorEntry(e) {
    e.preventDefault();
    setErrorMessage('');
    if (!visitorName.trim() || !visitorOrg.trim() || !visitorPurpose.trim()) {
      setErrorMessage('Visitor Name, Department/Organization, and Purpose of Visit are required.');
      return;
    }
    setIsSubmittingVisitor(true);
    try {
      const res = await recordVisitorLabEntry({
        fullName: visitorName,
        visitorType,
        organizationOrDept: visitorOrg,
        phoneNumber: visitorPhone,
        email: visitorEmail,
        purposeOfVisit: visitorPurpose,
        hostOrAccompaniedBy: visitorHost,
        remarks: visitorRemarks,
      });

      setCompletionMessage({
        type: 'success',
        action: 'ENTRY',
        title: 'Visitor Lab Entry Recorded',
        subtitle: `${visitorName} • ${visitorType}`,
        details: `Welcome, ${visitorName}! Lab visit record saved. Visitor ID: ${res.visitor_id || 'Active'}.`,
      });
      if (onToast) onToast(`Welcome ${visitorName}! Visitor entry logged.`);

      setVisitorName('');
      setVisitorOrg('');
      setVisitorPhone('');
      setVisitorEmail('');
      setVisitorPurpose('');
      setVisitorHost('');
      setVisitorRemarks('');
      loadActiveVisitors();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to record visitor entry.');
    } finally {
      setIsSubmittingVisitor(false);
    }
  }

  async function handleVisitorExitClick(visitor) {
    try {
      await recordVisitorLabExit(visitor.visitor_id, currentUser);
      setCompletionMessage({
        type: 'success',
        action: 'EXIT',
        title: 'Visitor Lab Exit Recorded',
        subtitle: `${visitor.full_name} (${visitor.visitor_type})`,
        details: `Exit logged for ${visitor.full_name}. Visit completed and saved in PostgreSQL.`,
      });
      if (onToast) onToast(`Exit logged for visitor ${visitor.full_name}.`);
      loadActiveVisitors();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to record visitor exit.');
    }
  }

  // 1. Run Identification (Face / Manual)
  async function handleIdentify() {
    setErrorMessage('');
    setCompletionMessage(null);
    setIsScanning(true);

    try {
      let result;
      if (selectedMethod === 'face') {
        if (onOpenFaceAttendance) {
          onOpenFaceAttendance();
          return;
        }
        result = await biometricService.identifyFace();
      } else {
        if (liveStudentMatch) {
          result = { user: liveStudentMatch, rollNumber: liveStudentMatch.rollNumber };
        } else {
          result = biometricService.identifyManual(manualRollInput);
        }
      }

      // Display identified student for unified attendance confirmation
      setIdentifiedStudent(result.user);
    } catch (err) {
      setErrorMessage(err.message || 'Identification failed. Please try again or use manual entry.');
    } finally {
      setIsScanning(false);
    }
  }

  // 2. Student Confirms "Is this your roll number?" -> YES
  async function handleConfirmYes() {
    if (!identifiedStudent || isConfirming) return;
    setIsConfirming(true);
    setErrorMessage('');
    setCompletionMessage(null);

    try {
      // Unified Automatic Attendance: System automatically determines whether entering or exiting
      const res = await toggleLabAttendance(identifiedStudent.rollNumber, selectedMethod);

      if (res.action === 'ENTRY') {
        const entryTimeStr = res.visit?.entryTime
          ? new Date(res.visit.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

        setCompletionMessage({
          type: 'success',
          action: 'ENTRY',
          title: 'Lab Entry Recorded',
          subtitle: `Roll Number: ${identifiedStudent.rollNumber} (${identifiedStudent.name})`,
          details: `Welcome! Entry time recorded: ${entryTimeStr}. Your lab session is now active.`,
        });
        if (onToast) onToast(`Welcome ${identifiedStudent.name}! Lab entry recorded.`);
      } else {
        // EXIT
        const durationStr = res.durationFormatted || (res.durationMinutes ? `${res.durationMinutes} min` : '');
        setCompletionMessage({
          type: 'success',
          action: 'EXIT',
          title: 'Lab Exit Recorded',
          subtitle: `Roll Number: ${identifiedStudent.rollNumber} (${identifiedStudent.name})`,
          details: `Thanks for visiting the lab, ${identifiedStudent.name}! ${durationStr ? `Time spent in lab: ${durationStr}. ` : ''}Visit record saved.`,
        });
        if (onToast) onToast(`Lab exit recorded for ${identifiedStudent.name}! Duration: ${durationStr || 'Completed'}`);
      }

      setIdentifiedStudent(null);
      setManualRollInput('');
      setSelectedPrefix('');
      setSuffixInput('');
      setLiveStudentMatch(null);
      setLiveValidationError('');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to record lab attendance. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  }

  // 3. Student Confirms "Is this your roll number?" -> NO
  function handleConfirmNo() {
    setIdentifiedStudent(null);
    setErrorMessage('Please try identifying yourself again with face recognition or manual entry.');
  }

  // 4. Reset Password during identification
  function handleSavePasswordReset(e) {
    e.preventDefault();
    setResetError('');
    try {
      resetStudentPassword(identifiedStudent.rollNumber, newPasswordInput, `${identifiedStudent.name} (Entrance Station)`);
      setIsResetPasswordModalOpen(false);
      setNewPasswordInput('');
      if (onToast) onToast('Password reset successfully! You can now confirm your roll number.');
    } catch (err) {
      setResetError(err.message);
    }
  }

  // 5. First-Visit Registration Submission
  async function handleFirstVisitRegister(e) {
    e.preventDefault();
    setErrorMessage('');

    const cleanRoll = regRoll.trim().toUpperCase();
    if (!cleanRoll) {
      setErrorMessage('Roll Number is required.');
      return;
    }
    if (cleanRoll.length !== 10) {
      setErrorMessage('Student Roll Number must be strictly 10 characters (e.g. 238W1A0477).');
      return;
    }
    if (!regPassword || regPassword.trim().length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    try {
      setEnrollmentStep('Saving student credentials into PostgreSQL database...');

      // Register or update student record in database and passwords table
      const newUser = await registerStudentFirstVisit({
        name: regName.trim(),
        rollNumber: cleanRoll,
        mobileNumber: regMobile.trim(),
        password: regPassword,
        department: regDepartment,
        faceRegistered: false,
        incubationStartDate: regStartDate,
        academicYearAtStart: Number(regAcademicYear),
      });

      // Automatically record their first lab entry visit!
      try {
        await recordLabEntry(cleanRoll, 'manual');
      } catch (visitErr) {
        console.warn('Initial lab entry recording:', visitErr?.message);
      }

      setEnrollmentStep(null);

      // Clear the form
      setRegName('');
      setRegRoll('');
      setRegMobile('');
      setRegPassword('');
      setRegStartDate(new Date().toISOString().slice(0, 10));
      setRegAcademicYear('1');

      // Set immediate verified success completion state
      setActiveMode('attendance');
      setCompletionMessage({
        type: 'success',
        action: 'ENTRY',
        title: 'Registration & First Lab Visit Recorded!',
        subtitle: `Roll Number: ${newUser.rollNumber} (${newUser.name})`,
        details: `Account successfully created in PostgreSQL passwords table. First lab session is now ACTIVE. You can now log in to the Student Portal with your Roll Number and Password.`,
        student: newUser,
      });

      if (onToast) {
        onToast(`Account ${newUser.name} (${newUser.rollNumber}) added to database and checked into lab!`);
      }
    } catch (err) {
      setEnrollmentStep(null);
      setErrorMessage(err.message);
    }
  }

  // Handle closing / completion of face registration modal
  function handleCloseFaceModal() {
    if (!faceModalStudent) return;
    const studentRoll = faceModalStudent.rollNumber;
    const studentName = faceModalStudent.name;
    const currentRecord = getUserByRoll(studentRoll);
    const effectiveRecord = currentRecord || faceModalStudent;
    const isFaceDone = Boolean(effectiveRecord?.faceRegistered);

    setFaceModalStudent(null);
    setActiveMode('attendance');

    setCompletionMessage({
      type: 'success',
      action: 'ENTRY',
      title: 'First Lab Visit Active!',
      subtitle: `Welcome ${studentName}! User ID: ${studentRoll}`,
      details: isFaceDone
        ? `Face embeddings and account successfully registered in PostgreSQL database. Lab session is active.`
        : `Account saved to PostgreSQL passwords table. Lab session is active. You can log in to the Student Portal anytime.`,
      student: effectiveRecord || { name: studentName, rollNumber: studentRoll },
    });
    if (onToast) onToast(`Welcome ${studentName}! Lab entry active.`);

    if (isFaceDone) {
      setCompletionMessage({
        type: 'success',
        title: 'Registration Complete!',
        subtitle: `Welcome ${studentName}! Your User ID is ${studentRoll}.`,
        details: `10 face embeddings and ${currentRecord?.retentionPeriodYears || 4}-year retention journey registered. You can now enter the lab.`,
        student: currentRecord || { name: studentName, rollNumber: studentRoll },
      });
      if (onToast) onToast(`Welcome ${studentName}! Face recognition registered.`);
    } else {
      setCompletionMessage({
        type: 'warning',
        title: 'Account Created (Face Pending)',
        subtitle: `Student account registered for ${studentName} (${studentRoll}).`,
        details: `Student account created. Face enrollment is pending and can be completed anytime by an admin in the Student Directory.`,
        student: currentRecord || { name: studentName, rollNumber: studentRoll },
      });
      if (onToast) onToast(`Student account registered. Face enrollment pending.`);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Physical Lab Entrance & Exit Station
          </h2>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            Biometric student identification, daily attendance (roll number only), and lab duration tracking
          </p>
        </div>

        {/* Mode Switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', background: '#e2e8f0', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              background: activeMode === 'attendance' ? 'var(--primary)' : 'transparent',
              color: activeMode === 'attendance' ? '#fff' : 'var(--neutral-700)',
              border: 'none',
              fontWeight: 700,
            }}
            onClick={() => handleModeSwitch('attendance')}
          >
            Registered Students
          </button>

          <button
            type="button"
            className="btn btn-sm"
            style={{
              background: activeMode === 'visitor' ? '#0d9488' : 'transparent',
              color: activeMode === 'visitor' ? '#fff' : 'var(--neutral-700)',
              border: 'none',
              fontWeight: 700,
            }}
            onClick={() => {
              handleModeSwitch('visitor');
              loadActiveVisitors();
            }}
          >
            Guest / Visitor Attendance
          </button>

          <button
            type="button"
            className="btn btn-sm"
            style={{
              background: activeMode === 'first_registration' ? 'var(--primary)' : 'transparent',
              color: activeMode === 'first_registration' ? '#fff' : 'var(--neutral-700)',
              border: 'none',
              fontWeight: 700,
            }}
            onClick={() => handleModeSwitch('first_registration')}
          >
            First Lab Visit (Register)
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {completionMessage && (
        <div
          className={`alert ${
            completionMessage.type === 'info'
              ? 'alert-info'
              : completionMessage.type === 'warning'
              ? 'alert-warning'
              : 'alert-success'
          }`}
          style={{
            marginBottom: '1.25rem',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            {completionMessage.type === 'warning' ? (
              <AlertCircle
                size={28}
                style={{
                  color: '#d97706',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              />
            ) : (
              <CheckCircle2
                size={28}
                style={{
                  color: completionMessage.type === 'info' ? 'var(--info)' : 'var(--success)',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              />
            )}
            <div>
              <h3
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color:
                    completionMessage.type === 'info'
                      ? 'var(--info-text, #1e40af)'
                      : completionMessage.type === 'warning'
                      ? '#b45309'
                      : 'var(--success-text)',
                }}
              >
                {completionMessage.title}
              </h3>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', marginTop: '0.2rem' }}>
                {completionMessage.subtitle}
              </div>
              <div className="text-xs text-muted" style={{ marginTop: '0.25rem' }}>
                {completionMessage.details}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{
              padding: '0.25rem 0.5rem',
              minWidth: 'auto',
              color: 'var(--neutral-600)',
              cursor: 'pointer',
              lineHeight: 1,
            }}
            onClick={() => setCompletionMessage(null)}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Post-Registration Mobile App Installation QR Code */}
      {completionMessage && completionMessage.student && (
        <div style={{ maxWidth: '640px', margin: '0 auto 1.5rem' }}>
          <AppInstallQrCard
            registeredUser={completionMessage.student}
            inline={true}
            onClose={() => setCompletionMessage(null)}
          />
        </div>
      )}

      {/* ==================== NORMAL ENTRY & EXIT STATION ==================== */}
      {activeMode === 'attendance' && (
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          {/* STEP 1: IDENTIFICATION METHODS */}
          {!identifiedStudent && (
            <div className="card" data-tour="entrance-kiosk-methods">
              <div className="card-header">
                <h3 className="card-title">
                  Identify for Lab Attendance
                </h3>
                <span className="badge badge-info">Unified Attendance</span>
              </div>

              <div className="card-body">
                <p className="text-sm text-muted" style={{ marginBottom: '1.25rem' }}>
                  Look into the camera lens or enter your roll number to verify your identity:
                </p>

                {/* Identification Method Selectors */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <button
                    type="button"
                    className="card"
                    style={{
                      padding: '1rem',
                      textAlign: 'center',
                      border: selectedMethod === 'face' ? '2px solid var(--primary)' : '1px solid var(--neutral-200)',
                      background: selectedMethod === 'face' ? 'var(--primary-light)' : '#fff',
                      cursor: 'pointer',
                      marginBottom: 0,
                    }}
                    onClick={() => handleSelectMethod('face')}
                  >
                    <Camera size={28} style={{ color: selectedMethod === 'face' ? 'var(--primary)' : 'var(--neutral-500)', margin: '0 auto 0.5rem' }} />
                    <strong style={{ display: 'block', fontSize: '0.85rem' }}>Face Recognition</strong>
                  </button>

                  <button
                    type="button"
                    className="card"
                    style={{
                      padding: '1rem',
                      textAlign: 'center',
                      border: selectedMethod === 'manual' ? '2px solid var(--primary)' : '1px solid var(--neutral-200)',
                      background: selectedMethod === 'manual' ? 'var(--primary-light)' : '#fff',
                      cursor: 'pointer',
                      marginBottom: 0,
                    }}
                    onClick={() => handleSelectMethod('manual')}
                  >
                    <Search size={28} style={{ color: selectedMethod === 'manual' ? 'var(--primary)' : 'var(--neutral-500)', margin: '0 auto 0.5rem' }} />
                    <strong style={{ display: 'block', fontSize: '0.85rem' }}>Manual Roll No</strong>
                  </button>
                </div>

                {/* Method Specific UI */}

                {selectedMethod === 'manual' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                    {/* STEP 1: DYNAMIC PREFIX SUGGESTIONS */}
                    <div
                      data-tour="entrance-roll-suggestions"
                      style={{
                        background: '#f8fafc',
                        border: '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.1rem',
                      }}
                    >
                      <div className="flex-between" style={{ marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--neutral-900)' }}>
                            Batch Roll Number Prefix
                          </strong>
                          <span className="text-xs text-muted" style={{ display: 'block' }}>
                            Automatically discovered from registered students
                          </span>
                        </div>
                        <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                          {prefixSuggestions.length} Discovered Prefix{prefixSuggestions.length === 1 ? '' : 'es'}
                        </span>
                      </div>

                      {/* Live filter input if prefixes exist */}
                      {prefixSuggestions.length > 3 && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <input
                            type="text"
                            className="input-field uppercase-input"
                            placeholder="Filter prefix (e.g. 238...)"
                            value={prefixSearchQuery}
                            onChange={(e) => setPrefixSearchQuery(e.target.value)}
                            style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                          />
                        </div>
                      )}

                      {/* Prefix Suggestion Badges */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {(() => {
                          const cleanFilter = prefixSearchQuery.trim().toUpperCase();
                          const displayed = cleanFilter
                            ? prefixSuggestions.filter((p) => p.prefix.includes(cleanFilter))
                            : prefixSuggestions;

                          if (displayed.length === 0) {
                            return <span className="text-xs text-muted">No matching batch prefixes discovered.</span>;
                          }

                          return displayed.map((item) => {
                            const isSelected = selectedPrefix === item.prefix;
                            return (
                              <button
                                key={item.prefix}
                                type="button"
                                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                                style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 800,
                                  fontSize: '0.88rem',
                                  padding: '0.4rem 0.75rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.45rem',
                                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--neutral-300)',
                                }}
                                onClick={() => handleSelectPrefix(item.prefix)}
                              >
                                <span>{item.prefix}</span>
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '0.1rem 0.35rem',
                                    background: isSelected ? 'rgba(255,255,255,0.3)' : '#e2e8f0',
                                    color: isSelected ? '#ffffff' : 'var(--neutral-700)',
                                  }}
                                  title={`${item.count} registered student(s)`}
                                >
                                  {item.count}
                                </span>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* STEP 2: SUFFIX ENTRY OR DIRECT FULL ROLL ENTRY */}
                    {selectedPrefix ? (
                      <div
                        style={{
                          background: '#ffffff',
                          border: '2px solid var(--primary)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1.25rem',
                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)',
                        }}
                      >
                        <div className="flex-between" style={{ marginBottom: '0.65rem' }}>
                          <label className="input-label" style={{ margin: 0, fontWeight: 700 }}>
                            Enter Remaining 2 Characters (Student Serial / Section)
                          </label>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem', color: 'var(--neutral-600)' }}
                            onClick={handleClearPrefix}
                          >
                            <X size={13} style={{ marginRight: '3px' }} /> Change Prefix
                          </button>
                        </div>

                        {/* Combined Interactive Formula Box */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                          <div
                            style={{
                              background: '#eff6ff',
                              border: '1.5px solid #bfdbfe',
                              color: 'var(--primary-700)',
                              padding: '0.6rem 0.9rem',
                              borderRadius: 'var(--radius-sm)',
                              fontFamily: 'monospace',
                              fontWeight: 900,
                              fontSize: '1.25rem',
                              letterSpacing: '1px',
                            }}
                          >
                            {selectedPrefix}
                          </div>
                          <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--neutral-400)' }}>+</span>
                          <input
                            type="text"
                            className="input-field uppercase-input"
                            placeholder="77"
                            maxLength={2}
                            value={suffixInput}
                            onChange={(e) => handleSuffixChange(e.target.value)}
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '1.25rem',
                              fontWeight: 900,
                              letterSpacing: '1px',
                              width: '95px',
                              textAlign: 'center',
                              borderColor: liveStudentMatch ? '#16a34a' : 'var(--neutral-300)',
                            }}
                            autoFocus
                          />
                        </div>

                        {/* Live Formula Preview */}
                        <div
                          className="font-mono text-xs"
                          style={{
                            color: 'var(--neutral-600)',
                            background: '#f8fafc',
                            padding: '0.4rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--neutral-200)',
                          }}
                        >
                          Result: <strong>{selectedPrefix}</strong> + <strong>{suffixInput || '??'}</strong> ={' '}
                          <strong style={{ color: 'var(--neutral-900)' }}>
                            {combinePrefixAndSuffix(selectedPrefix, suffixInput)}
                          </strong>{' '}
                          ({combinePrefixAndSuffix(selectedPrefix, suffixInput).length}/10 characters)
                        </div>
                      </div>
                    ) : (
                      /* Fallback: Direct Full 10-Character Input */
                      <div className="form-group">
                        <label className="input-label">Or Type Full 10-Character Roll Number Directly</label>
                        <input
                          type="text"
                          className="input-field uppercase-input"
                          placeholder="e.g. 238W1A0477"
                          maxLength={10}
                          value={manualRollInput}
                          onChange={(e) => handleFullRollChange(e.target.value)}
                        />
                        <span className="input-hint">
                          Click any prefix suggestion above to auto-fill the first 8 characters
                        </span>
                      </div>
                    )}

                    {/* MATCHED STUDENT VERIFIED CARD PREVIEW */}
                    {liveStudentMatch && (
                      <div
                        style={{
                          background: '#f0fdf4',
                          border: '1.5px solid #86efac',
                          borderRadius: 'var(--radius-md)',
                          padding: '1.1rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                          <strong style={{ fontSize: '0.92rem', color: '#15803d' }}>
                            Student Identified
                          </strong>
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--neutral-900)' }}>
                          {liveStudentMatch.name}
                        </div>
                        <div className="font-mono text-xs text-muted" style={{ marginTop: '0.2rem' }}>
                          Roll Number: <strong>{liveStudentMatch.rollNumber}</strong> • {liveStudentMatch.department || 'Incubation Student'}
                        </div>
                        {(() => {
                          const active = getStudentActiveVisit(liveStudentMatch.rollNumber);
                          return (
                            <div style={{ marginTop: '0.6rem' }}>
                              <span
                                className={`badge ${active ? 'badge-warning' : 'badge-success'}`}
                                style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 0.6rem' }}
                              >
                                {active ? 'Currently Inside Lab • Next: Record Exit' : 'Currently Outside Lab • Next: Record Entry'}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* LIVE VALIDATION ERROR MESSAGE */}
                    {liveValidationError && (
                      <div
                        style={{
                          background: '#fff1f2',
                          border: '1px solid #fecdd3',
                          color: '#9f1239',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.75rem 1rem',
                          fontSize: '0.86rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                        <span>{liveValidationError}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedMethod === 'face' && (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <p className="text-sm text-muted" style={{ marginBottom: '0.75rem' }}>
                      Look directly into the camera lens for automated facial recognition.
                    </p>
                    {onOpenFaceAttendance && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ marginBottom: '0.5rem' }}
                        onClick={onOpenFaceAttendance}
                      >
                        <Camera size={14} style={{ marginRight: '4px' }} />
                        Launch Live Face Recognition Station
                      </button>
                    )}
                  </div>
                )}

                {/* ATTENDANCE CONFIRMATION ACTION BUTTON */}
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  onClick={handleIdentify}
                  disabled={
                    isScanning ||
                    (selectedMethod === 'manual' && (!liveStudentMatch || manualRollInput.length !== 10))
                  }
                >
                  {isScanning ? (
                    'Recognizing Student...'
                  ) : selectedMethod === 'face' ? (
                    <>
                      <Camera size={18} style={{ marginRight: '6px' }} /> Launch Live Face Recognition Station <ArrowRight size={18} />
                    </>
                  ) : (
                    <>
                      Verify Identity & Confirm Attendance <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CONFIRMATION SCREEN ("Is this your roll number?" + "Reset Password" button) */}
          {identifiedStudent && (
            <div className="card" style={{ border: '2px solid var(--primary)', boxShadow: 'var(--shadow-lg)' }}>
              <div className="card-header" style={{ background: 'var(--primary-light)', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
                  Student Identified
                </h3>
              </div>

              <div className="card-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Detected Roll Number
                </span>
                <div
                  className="font-mono"
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 900,
                    color: 'var(--neutral-900)',
                    margin: '0.25rem 0 0.5rem',
                  }}
                >
                  {identifiedStudent.rollNumber}
                </div>

                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--neutral-800)', marginBottom: '0.75rem' }}>
                  {identifiedStudent.name}
                </div>

                {/* Auto Status Badge: Determines Entry or Exit */}
                {(() => {
                  const activeVisit = getStudentActiveVisit(identifiedStudent.rollNumber);
                  return (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <span
                        className={`badge ${activeVisit ? 'badge-warning' : 'badge-success'}`}
                        style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem', fontWeight: 700 }}
                      >
                        {activeVisit
                          ? 'Inside Lab • Recording Lab Exit'
                          : 'Outside Lab • Recording Lab Entry'}
                      </span>
                      {activeVisit?.entryTime && (
                        <div className="text-xs text-muted" style={{ marginTop: '0.35rem' }}>
                          Session started at {new Date(activeVisit.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--neutral-800)', marginBottom: '1.5rem' }}>
                  Is this your roll number?
                </div>

                {/* YES and NO Confirmation Buttons */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-success btn-lg"
                    style={{ minWidth: '150px' }}
                    onClick={handleConfirmYes}
                    disabled={isConfirming}
                  >
                    <CheckCircle2 size={20} /> {isConfirming ? 'Confirming...' : 'YES, Confirm'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-lg"
                    style={{ minWidth: '150px' }}
                    onClick={handleConfirmNo}
                    disabled={isConfirming}
                  >
                    NO, Retry
                  </button>
                </div>

                {/* INLINE RESET PASSWORD BUTTON (NO separate question asked!) */}
                <div style={{ borderTop: '1px solid var(--neutral-200)', paddingTop: '1.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsResetPasswordModalOpen(true)}
                  >
                    <Key size={14} /> Reset Password
                  </button>
                  <span className="input-hint" style={{ marginTop: '0.35rem' }}>
                    Forgot your account password? Change it now and return here to complete entry.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== GUEST & VISITOR LAB ATTENDANCE ==================== */}
      {activeMode === 'visitor' && (
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building size={20} className="icon-primary" /> Guest & Visitor Lab Attendance
                </h3>
                <p className="text-sm text-muted" style={{ margin: '0.25rem 0 0' }}>
                  For visiting faculty, external delegates, industry experts, and occasional lab visitors without permanent registration.
                </p>
              </div>
              <span className="badge badge-info" style={{ background: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4', fontWeight: 700 }}>
                No Student Account Needed
              </span>
            </div>

            <div className="card-body">
              <form onSubmit={handleVisitorEntry}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="input-label">Visitor Full Name <span className="required-star">*</span></label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Dr. K. Srinivas / Mr. Rajesh Sharma"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    required
                  />
                </div>

                <div className="review-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="input-label">Visitor Category <span className="required-star">*</span></label>
                    <select
                      className="input-field"
                      value={visitorType}
                      onChange={(e) => setVisitorType(e.target.value)}
                      required
                    >
                      <option value="Visiting Faculty">Visiting Faculty (Other Dept / College)</option>
                      <option value="Guest / Delegate">Guest / Delegate</option>
                      <option value="External Student">External Student / Researcher</option>
                      <option value="Industry Expert">Industry Expert / Mentor</option>
                      <option value="Vendor / Maintenance">Vendor / Technical Maintenance</option>
                      <option value="Other Visitor">Other Visitor</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="input-label">Department / College / Organization <span className="required-star">*</span></label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Mechanical Engg / IIT Madras / TCS"
                      value={visitorOrg}
                      onChange={(e) => setVisitorOrg(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="review-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="input-label">Contact Mobile Number (Optional)</label>
                    <input
                      type="tel"
                      className="input-field font-mono"
                      placeholder="+91 98765 43210"
                      value={visitorPhone}
                      onChange={(e) => setVisitorPhone(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="input-label">Lab Host / Accompanied By (Optional)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Dr. Surya Prasad / ECE Dept"
                      value={visitorHost}
                      onChange={(e) => setVisitorHost(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="input-label">Purpose of Lab Visit <span className="required-star">*</span></label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Project Consultation, Guest Lecture, Equipment Demonstration, Lab Tour"
                    value={visitorPurpose}
                    onChange={(e) => setVisitorPurpose(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', background: '#0d9488', borderColor: '#0d9488', fontWeight: 700 }}
                  disabled={isSubmittingVisitor}
                >
                  <CheckCircle2 size={18} />
                  {isSubmittingVisitor ? 'Recording Lab Entry...' : 'Record Visitor Lab Entry'}
                </button>
              </form>
            </div>
          </div>

          {/* ACTIVE VISITORS CURRENTLY INSIDE THE LAB */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
                <Clock size={18} style={{ color: '#0d9488' }} /> Visitors Currently Inside Lab ({activeVisitorsList.length})
              </h3>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={loadActiveVisitors}
                title="Refresh Visitors List"
              >
                Refresh List
              </button>
            </div>

            <div className="card-body" style={{ padding: '0.75rem' }}>
              {activeVisitorsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: 'var(--neutral-500)', fontSize: '0.88rem' }}>
                  No guest visitors are currently inside the lab.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeVisitorsList.map((vis) => (
                    <div
                      key={vis.visitor_id || vis.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.85rem 1rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 'var(--radius-md)',
                        gap: '1rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.98rem', color: 'var(--neutral-900)' }}>{vis.full_name}</strong>
                          <span className="badge badge-info" style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1' }}>
                            {vis.visitor_type}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--neutral-600)', marginTop: '0.25rem' }}>
                          <span>{vis.organization_or_dept}</span>
                          <span style={{ margin: '0 0.4rem' }}>•</span>
                          <span>Purpose: <strong>{vis.purpose_of_visit}</strong></span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--neutral-500)', marginTop: '0.2rem' }}>
                          Entered: {new Date(vis.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {vis.host_or_accompanied_by && <span> • Host: {vis.host_or_accompanied_by}</span>}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleVisitorExitClick(vis)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#dc2626', borderColor: '#fca5a5' }}
                        title="Record Visitor Exit"
                      >
                        <LogOut size={14} /> Record Exit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== FIRST LAB VISIT REGISTRATION ==================== */}
      {activeMode === 'first_registration' && (
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <UserPlus size={20} className="icon-primary" /> First Lab Visit: Student Registration
              </h3>
              <span className="badge badge-primary">Face Biometrics + Password</span>
            </div>

            <div className="card-body">
              <p className="text-sm text-muted" style={{ marginBottom: '1.25rem' }}>
                On your first visit, register your student details and face biometrics. Your Roll Number will become your User ID.
              </p>

              <form onSubmit={handleFirstVisitRegister}>
                <div className="review-grid">
                  <div className="form-group">
                    <label className="input-label">Student Full Name <span className="required-star">*</span></label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Anwar Bajarinti"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="input-label">Roll Number (User ID) <span className="required-star">*</span></label>
                    <input
                      type="text"
                      className="input-field uppercase-input font-mono"
                      placeholder="e.g. 238W1A0477"
                      maxLength={10}
                      minLength={10}
                      value={regRoll}
                      onChange={(e) => setRegRoll(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                      required
                    />
                    <span className="input-hint" style={{ fontSize: '0.78rem', color: regRoll.length === 10 ? '#16a34a' : 'var(--neutral-500)' }}>
                      {regRoll.length}/10 characters {regRoll.length === 10 ? '✓ Valid' : '(Must be strictly 10 characters)'}
                    </span>
                  </div>
                </div>

                <div className="review-grid">
                  <div className="form-group">
                    <label className="input-label">Mobile Number</label>
                    <input
                      type="tel"
                      className="input-field"
                      placeholder="+91 98765 43210"
                      value={regMobile}
                      onChange={(e) => setRegMobile(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="input-label">Create Account Password <span className="required-star">*</span></label>
                    <input
                      type="password"
                      className="input-field"
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Incubation Journey & Academic Year at Start */}
                <div className="review-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="input-label">
                      Incubation Journey Start Date <span className="required-star">*</span>
                    </label>
                    <input
                      type="date"
                      className="input-field"
                      value={regStartDate}
                      onChange={(e) => setRegStartDate(e.target.value)}
                      required
                    />
                    <span className="input-hint">Official date student joined the incubation lab</span>
                  </div>

                  <div className="form-group">
                    <label className="input-label">
                      Academic Year at Joining <span className="required-star">*</span>
                    </label>
                    <select
                      className="select-field"
                      value={regAcademicYear}
                      onChange={(e) => setRegAcademicYear(e.target.value)}
                      required
                    >
                      <option value="1">1st Year (4-Year Retention Plan)</option>
                      <option value="2">2nd Year (3-Year Retention Plan)</option>
                      <option value="3">3rd Year (2-Year Retention Plan)</option>
                      <option value="4">4th Year (1-Year Retention Plan)</option>
                    </select>
                    <span className="input-hint">
                      Retention period is strictly calculated from this date & year. Never guessed from roll numbers.
                    </span>
                  </div>
                </div>

                {/* Biometric Guidance Note */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontSize: '0.82rem',
                    color: '#166534',
                  }}
                >
                  <ShieldCheck size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <div>
                    <strong>Biometric Enrollment:</strong> First, your student account is created. Then, the camera opens automatically to guide you through capturing exactly 10 face embeddings (6 straight, 2 left, 2 right).
                  </div>
                </div>

                {enrollmentStep && (
                  <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                    <Sparkles size={18} />
                    <span>{enrollmentStep}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  disabled={Boolean(enrollmentStep)}
                  data-testid="btn-register-account-face"
                >
                  {enrollmentStep ? 'Registering Account...' : 'Register Account & Open Face Enrollment'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================== RESET PASSWORD MODAL ==================== */}
      {isResetPasswordModalOpen && identifiedStudent && (
        <div className="modal-overlay" onClick={() => setIsResetPasswordModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSavePasswordReset}>
              <div className="modal-header">
                <div className="modal-title-group">
                  <Key size={22} className="icon-primary" />
                  <div>
                    <h3 className="modal-title">Reset Password</h3>
                    <p className="modal-subtitle">Roll Number: {identifiedStudent.rollNumber}</p>
                  </div>
                </div>
              </div>

              <div className="modal-body">
                {resetError && (
                  <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                    <AlertCircle size={16} />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="input-label">New Password</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Enter new password (min 4 characters)"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsResetPasswordModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save New Password & Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== FACE REGISTRATION MODAL ==================== */}
      {faceModalStudent && (
        <FaceRegistrationModal
          student={faceModalStudent}
          currentUser={currentUser}
          autoStart={true}
          onClose={handleCloseFaceModal}
          onToast={onToast}
          onStatusChanged={() => {
            // Biometric record updated in background
          }}
        />
      )}
    </div>
  );
}
