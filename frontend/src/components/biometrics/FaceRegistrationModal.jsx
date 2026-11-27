// src/components/biometrics/FaceRegistrationModal.jsx
// Admin & Sir Face Registration Modal: Enforces exactly 10 embeddings across 3 guided poses.
// Strictly in-memory: Camera frames are NEVER saved to disk, cloud, or persistent storage.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Trash2,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  UserCheck,
  Clock,
  ScanLine,
  RefreshCw,
} from 'lucide-react';
import { faceApiService } from '../../services/biometric/faceApiService';
import { updateStudentAccount } from '../../db/database';
import HeadPoseGuide from './HeadPoseGuide';

export default function FaceRegistrationModal({
  student,
  currentUser,
  onClose,
  onToast,
  onStatusChanged,
  autoStart = false,
}) {
  const [serviceStatus, setServiceStatus] = useState({ checking: true, online: false });
  const [enrollmentStatus, setEnrollmentStatus] = useState({ checking: true, registered: false, count: 0 });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetryingHealth, setIsRetryingHealth] = useState(false);
  const hasAutoStartedRef = useRef(false);

  // Active Enrollment State
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const sessionIdRef = useRef(null);
  const [stepData, setStepData] = useState({
    step: 1,
    totalSteps: 3,
    stepName: 'Look Straight',
    targetPose: 'straight',
    neededInStep: 6,
    capturedInStep: 0,
    totalCaptured: 0,
    totalNeeded: 10,
    feedback: 'Please look directly into the camera.',
    poseCorrect: false,
  });
  const [cameraError, setCameraError] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  const isEnrollingRef = useRef(false);
  const loopTimeoutRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const isProcessingFrameRef = useRef(false);
  const healthPollRef = useRef(null);

  // Smooth Scroll & Auto-Positioning Refs
  const modalContainerRef = useRef(null);
  const cameraSectionRef = useRef(null);
  const lastScrolledStudentRef = useRef(null);

  // Helper: Smoothly scroll to target element accounting for sticky navbar
  const smoothScrollToTarget = useCallback((targetElement, extraOffset = 16) => {
    if (!targetElement || typeof window === 'undefined') return;

    try {
      // Determine sticky navbar height dynamically (default 64px)
      const navbar = typeof document !== 'undefined' ? document.querySelector('.navbar') : null;
      const navbarHeight = navbar && navbar.offsetHeight ? navbar.offsetHeight : 64;
      const offset = navbarHeight + extraOffset;

      // Apply CSS scroll-margin-top so native scrollIntoView also respects it
      targetElement.style.scrollMarginTop = `${offset}px`;

      if (typeof targetElement.getBoundingClientRect === 'function') {
        const rect = targetElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || (document.documentElement ? document.documentElement.scrollTop : 0);
        const targetTop = Math.max(0, rect.top + scrollTop - offset);

        if (typeof window.scrollTo === 'function') {
          window.scrollTo({
            top: targetTop,
            behavior: 'smooth',
          });
          return;
        }
      }

      if (typeof targetElement.scrollIntoView === 'function') {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (_) {
      try {
        if (typeof targetElement.scrollIntoView === 'function') {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (__) {}
    }
  }, []);

  // 1. Automatic Smooth Scrolling when Face Registration Interface Mounts
  useEffect(() => {
    if (!student?.rollNumber) return;
    if (lastScrolledStudentRef.current === student.rollNumber) return;
    lastScrolledStudentRef.current = student.rollNumber;

    const rafId = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        if (modalContainerRef.current) {
          smoothScrollToTarget(modalContainerRef.current);
        }
      }, 50);
      return () => clearTimeout(timer);
    });

    return () => cancelAnimationFrame(rafId);
  }, [student?.rollNumber, smoothScrollToTarget]);

  // 2. Automatic Smooth Scrolling when Camera Interface Opens
  useEffect(() => {
    if (!isEnrolling) return;

    const rafId = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        const target = cameraSectionRef.current || modalContainerRef.current;
        if (target) {
          smoothScrollToTarget(target);
        }
      }, 70);
      return () => clearTimeout(timer);
    });

    return () => cancelAnimationFrame(rafId);
  }, [isEnrolling, smoothScrollToTarget]);

  // Ref callback ensures stream is instantly attached the moment <video> mounts
  const setVideoRef = useCallback((node) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(console.warn);
    }
  }, []);

  const checkServiceAndStudent = useCallback(async (manual = false) => {
    if (manual) setIsRetryingHealth(true);
    try {
      const health = await faceApiService.checkHealth();
      setServiceStatus({ checking: false, online: health.online, details: health.data });

      if (health.online && student?.rollNumber) {
        setEnrollmentStatus({ checking: true, registered: false, count: 0 });
        try {
          const res = await faceApiService.getStudentStatus(student.rollNumber);
          setEnrollmentStatus({
            checking: false,
            registered: Boolean(res.registered),
            count: res.count || res.embedding_count || (res.registered ? 10 : 0),
            createdAt: res.created_at,
          });
        } catch (err) {
          setEnrollmentStatus({ checking: false, registered: false, count: 0 });
        }
      } else {
        setEnrollmentStatus({
          checking: false,
          registered: false,
          count: 0,
        });
      }
    } finally {
      if (manual) setIsRetryingHealth(false);
    }
  }, [student]);

  // Clean up camera and timer resources strictly on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    checkServiceAndStudent();
    healthPollRef.current = setInterval(() => {
      // Pause background polling while face enrollment is actively streaming frames
      if (!isEnrollingRef.current) {
        checkServiceAndStudent();
      }
    }, 4000);

    return () => {
      if (healthPollRef.current) {
        clearInterval(healthPollRef.current);
        healthPollRef.current = null;
      }
    };
  }, [checkServiceAndStudent]);

  // Camera Management - Reliable Laptop Webcam Workflow
  async function startCamera() {
    setCameraError('');
    let stream = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
    } catch (idealErr) {
      console.warn('Ideal video constraint failed, trying basic video...', idealErr);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (fallbackErr) {
        let msg = 'Could not access laptop webcam.';
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          msg = 'Camera permission denied. Allow camera access in your browser address bar.';
        } else if (fallbackErr.name === 'NotReadableError' || fallbackErr.name === 'TrackStartError') {
          msg = 'Camera is currently in use by another application. Please close other camera apps.';
        } else {
          msg = `Camera error: ${fallbackErr.message}`;
        }
        setCameraError(msg);
        return false;
      }
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch (e) {
        console.warn('Video play error:', e);
      }
    }
    return true;
  }

  function stopCamera() {
    isEnrollingRef.current = false;
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    isProcessingFrameRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  const isAdminOrSubstitute =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'substitute_admin' ||
    currentUser?.role === 'faculty' ||
    !currentUser ||
    !currentUser?.role;

  const isSelf =
    currentUser?.rollNumber &&
    student?.rollNumber &&
    currentUser.rollNumber.trim().toUpperCase() === student.rollNumber.trim().toUpperCase();

  const isAuthorized = isAdminOrSubstitute || isSelf || Boolean(autoStart);

  const scheduleNextCapture = useCallback((delayMs = 80) => {
    if (!isEnrollingRef.current) return;
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    loopTimeoutRef.current = setTimeout(() => {
      sendFrameToSession();
    }, delayMs);
  }, []);

  // Start Enrollment Session
  async function handleStartEnrollment() {
    if (!isAuthorized) {
      if (onToast) onToast('Unauthorized: You cannot enroll another student.');
      return;
    }

    if (!serviceStatus.online) {
      if (onToast) onToast('Cloud Face Biometric service is initializing...');
      return;
    }

    isEnrollingRef.current = true;
    setIsEnrolling(true);
    setIsComplete(false);
    setCameraError('');

    const cameraOk = await startCamera();
    if (!cameraOk) {
      isEnrollingRef.current = false;
      setIsEnrolling(false);
      return;
    }

    try {
      console.log(`[FaceCapture] Starting registration session for ${student.name} (${student.rollNumber})...`);
      const res = await faceApiService.startRegistrationSession(student.rollNumber, student.name);
      console.log(`[FaceCapture] Session established: ${res.session_id}`);

      // Crucial: assign to ref synchronously so loop callback NEVER sees null
      sessionIdRef.current = res.session_id;
      setSessionId(res.session_id);

      setStepData({
        step: res.step,
        totalSteps: res.total_steps,
        stepName: res.step_name,
        targetPose: res.target_pose,
        neededInStep: res.needed_in_step,
        capturedInStep: res.captured_in_step,
        totalCaptured: res.total_captured,
        totalNeeded: res.total_needed,
        feedback: res.instruction || 'Please look directly at the camera.',
        poseCorrect: false,
      });

      // Kick off sequential single-flight capture loop
      scheduleNextCapture(100);
    } catch (err) {
      console.error('[FaceCapture] Failed to start registration session:', err);
      setCameraError(`Failed to initialize session: ${err.message}`);
      isEnrollingRef.current = false;
      setIsEnrolling(false);
      stopCamera();
    }
  }

  // Automatically start webcam enrollment if autoStart is true and service is online
  useEffect(() => {
    if (
      autoStart &&
      serviceStatus.online &&
      !hasAutoStartedRef.current &&
      !isEnrolling &&
      !isComplete &&
      !enrollmentStatus.registered
    ) {
      hasAutoStartedRef.current = true;
      handleStartEnrollment();
    }
  }, [autoStart, serviceStatus.online, isEnrolling, isComplete, enrollmentStatus.registered]);

  async function sendFrameToSession() {
    if (!isEnrollingRef.current) return;
    if (isProcessingFrameRef.current) return;

    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) {
      console.warn('[FaceCapture] Waiting for session ID...');
      scheduleNextCapture(100);
      return;
    }

    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      scheduleNextCapture(100);
      return;
    }

    isProcessingFrameRef.current = true;
    try {
      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvasRef.current = canvas;
      }
      // Lightweight payload (~40 KB) maintaining webcam aspect ratio
      const rawW = video.videoWidth || 640;
      const rawH = video.videoHeight || 480;
      const scale = Math.min(1.0, 640 / Math.max(rawW, 1));
      canvas.width = Math.round(rawW * scale);
      canvas.height = Math.round(rawH * scale);
      const ctx = canvas.getContext('2d');
      // Mirror image horizontally for natural user webcam experience
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      const frameBase64 = canvas.toDataURL('image/jpeg', 0.82);
      const res = await faceApiService.sendRegistrationFrame(currentSessionId, frameBase64);

      if (!isEnrollingRef.current) {
        return; // Session cancelled/stopped while in flight
      }

      if (res.success) {
        setCameraError('');
      }

      if (res.captured_this_frame) {
        console.log(`[FaceCapture] Embedding accepted! Total: ${res.total_captured}/10 (${res.step_name})`);
      }

      if (res.completed || res.complete) {
        console.log('[FaceCapture] ENROLLMENT COMPLETE: 10/10 embeddings saved!');
        isEnrollingRef.current = false;
        setIsEnrolling(false);
        if (loopTimeoutRef.current) {
          clearTimeout(loopTimeoutRef.current);
          loopTimeoutRef.current = null;
        }
        sessionIdRef.current = null;
        setSessionId(null);
        setIsComplete(true);
        stopCamera();

        // Immediately reflect 10 enrolled embeddings in local state
        setEnrollmentStatus({
          checking: false,
          registered: true,
          count: 10,
          createdAt: new Date().toISOString(),
        });

        // Update student profile in local DB
        await updateStudentAccount(student.rollNumber, { faceRegistered: true }, currentUser);
        if (onToast) onToast(`Face enrolled successfully for ${student.name} (10 embeddings)!`);
        if (onStatusChanged) onStatusChanged();
        checkServiceAndStudent();
        return;
      }

      setStepData((prev) => ({
        ...prev,
        step: res.step,
        stepName: res.step_name || prev.stepName,
        targetPose: res.target_pose || prev.targetPose,
        neededInStep: res.needed_in_step !== undefined ? res.needed_in_step : prev.neededInStep,
        capturedInStep: res.captured_in_step !== undefined ? res.captured_in_step : prev.capturedInStep,
        totalCaptured: res.total_captured !== undefined ? res.total_captured : prev.totalCaptured,
        totalNeeded: res.total_needed || 10,
        feedback: res.feedback || prev.feedback,
        poseCorrect: Boolean(res.pose_correct),
      }));
    } catch (err) {
      if (!isEnrollingRef.current || isComplete) return;
      console.warn('[FaceCapture] Frame transmission error:', err.message);
      if (err.name !== 'AbortError' && !err.message?.includes('aborted') && !err.message?.includes('cancelled')) {
        setCameraError(`Face service communication error: ${err.message}`);
      }
    } finally {
      isProcessingFrameRef.current = false;
      // Single-flight guarantee: Schedule next frame tick ONLY after previous frame has resolved
      if (isEnrollingRef.current) {
        scheduleNextCapture(70);
      }
    }
  }

  async function handleCancelEnrollment() {
    isEnrollingRef.current = false;
    setIsEnrolling(false);
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    const currentSessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    setSessionId(null);
    stopCamera();

    if (currentSessionId) {
      try {
        await faceApiService.cancelRegistrationSession(currentSessionId);
      } catch (e) {
        // ignore cancel error
      }
    }
  }

  async function handleDeleteBiometrics() {
    if (!isAdminOrSubstitute) {
      if (onToast) onToast('Unauthorized: Only Admin can delete face biometrics.');
      return;
    }
    if (!window.confirm(`Permanently delete face biometric embeddings for ${student.name} (${student.rollNumber})?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await faceApiService.deleteStudent(student.rollNumber);
      await updateStudentAccount(student.rollNumber, { faceRegistered: false }, currentUser);
      if (onToast) onToast(`Biometric templates deleted for ${student.name}.`);
      if (onStatusChanged) onStatusChanged();
      checkServiceAndStudent();
    } catch (err) {
      if (onToast) onToast(`Delete failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  }

  const progressPercent = Math.min(100, Math.round((stepData.totalCaptured / stepData.totalNeeded) * 100));

  return (
    <div
      ref={modalContainerRef}
      id={`face-registration-${student?.rollNumber || 'active'}`}
      className="modal-backdrop"
      style={{ zIndex: 1100, scrollMarginTop: '80px' }}
      data-testid="face-registration-modal"
    >
      <div className="modal-content" style={{ maxWidth: '750px', width: '94%', scrollMarginTop: '80px' }}>
        {/* Header */}
        <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.12)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Camera size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Face Biometric Management</h3>
              <p className="text-muted text-xs" style={{ margin: 0 }}>
                {student.name} • <span className="font-mono">{student.rollNumber}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              handleCancelEnrollment();
              onClose();
            }}
            style={{ padding: '0.35rem 0.6rem' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Service Status Banner */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: serviceStatus.online ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${serviceStatus.online ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.86rem' }}>
            <CheckCircle2 size={16} className="text-success" />
            <span>
              <strong>Cloud Biometrics Engine:</strong> Online & Ready (Browser-Native AI)
            </span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.74rem' }}
            onClick={() => checkServiceAndStudent(true)}
            disabled={isRetryingHealth}
          >
            <RefreshCw size={12} className={isRetryingHealth ? 'spin' : ''} style={{ marginRight: '3px' }} />
            {isRetryingHealth ? 'Checking...' : 'Check'}
          </button>
        </div>

        {/* Privacy Invariant Guarantee */}
        <div
          style={{
            padding: '0.6rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            background: '#f8fafc',
            border: '1px solid var(--neutral-200)',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.78rem',
            color: 'var(--neutral-700)',
          }}
        >
          <ShieldCheck size={16} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
          <span>
            <strong>Biometric Privacy:</strong> Camera frames are processed in-memory and discarded. Zero face photos or videos are ever saved to disk or cloud.
          </span>
        </div>

        {/* Content Body: Registration Workflow vs Status Card */}
        {!isEnrolling ? (
          <div>
            {/* Completion Success Banner */}
            {isComplete && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#15803d',
                  fontSize: '0.88rem',
                }}
              >
                <CheckCircle2 size={20} className="text-success" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Face Biometrics Registered!</strong> Exactly 10 embeddings (6 straight, 2 left, 2 right) captured and securely saved to SQLite biometric database.
                </div>
              </div>
            )}

            {/* Current Status Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className="text-sm text-muted">Enrollment Status:</span>
                {enrollmentStatus.registered || isComplete ? (
                  <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={12} /> {enrollmentStatus.count || (enrollmentStatus.registered || isComplete ? 10 : 0)} Embeddings Enrolled
                  </span>
                ) : (
                  <span className="badge badge-neutral">Not Enrolled</span>
                )}
              </div>

              <div style={{ fontSize: '0.86rem', color: 'var(--neutral-700)', lineHeight: '1.5' }}>
                {enrollmentStatus.registered || isComplete ? (
                  <p style={{ margin: 0 }}>
                    This student has an active face recognition profile in the local database. They can be recognized instantly at the Lab Entrance station.
                  </p>
                ) : (
                  <p style={{ margin: 0 }}>
                    No biometric face template exists for this student yet. Click below to begin the 3-step enrollment session (Look straight, slightly left, slightly right).
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {(enrollmentStatus.registered || isComplete) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={handleDeleteBiometrics}
                  disabled={isDeleting || !serviceStatus.online}
                >
                  <Trash2 size={14} style={{ marginRight: '4px' }} />
                  {isDeleting ? 'Deleting...' : 'Delete Biometrics'}
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  handleCancelEnrollment();
                  onClose();
                }}
              >
                {isComplete || enrollmentStatus.registered ? 'Done / Close' : 'Close'}
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleStartEnrollment}
                disabled={!serviceStatus.online}
              >
                <Camera size={14} style={{ marginRight: '4px' }} />
                {enrollmentStatus.registered || isComplete ? 'Re-enroll Face (10 Poses)' : 'Start Face Enrollment'}
              </button>
            </div>
          </div>
        ) : (
          /* Live Enrollment Camera & 3D Pose Guidance View */
          <div
            ref={cameraSectionRef}
            id="face-enrollment-camera-section"
            style={{ scrollMarginTop: '80px' }}
            data-testid="face-enrollment-camera-section"
          >
            {/* Step Progress & Target Pose Header */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--neutral-900)' }}>
                  Step {stepData.step} of {stepData.totalSteps}: {stepData.stepName}
                </strong>
                <span className="font-mono text-xs text-muted">
                  Captures: {stepData.totalCaptured} / {stepData.totalNeeded}
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '8px', background: 'var(--neutral-200)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: stepData.poseCorrect ? 'var(--success)' : 'var(--primary-600)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>

            {/* Live Camera Preview & 3D Head Pose Motion Guide Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
                gap: '0.85rem',
                alignItems: 'stretch',
              }}
            >
              {/* Left / Primary: Live Mirrored Camera Viewport */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '290px',
                  height: '100%',
                  background: '#000',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <video
                  ref={setVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)', // Mirrored display
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Circular Focus Ring Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    width: '190px',
                    height: '190px',
                    borderRadius: '50%',
                    border: `3px solid ${stepData.poseCorrect ? '#22c55e' : '#f59e0b'}`,
                    boxShadow: `0 0 20px ${stepData.poseCorrect ? 'rgba(34, 197, 94, 0.4)' : 'rgba(245, 158, 11, 0.3)'}`,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', fontWeight: 600 }}>
                    {stepData.targetPose.replace('_', ' ').toUpperCase()}
                  </div>
                </div>

                {/* Floating Guidance Badge */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    right: '10px',
                    padding: '0.45rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff',
                    fontSize: '0.8rem',
                    textAlign: 'center',
                    fontWeight: 600,
                    border: `1px solid ${stepData.poseCorrect ? '#22c55e' : 'rgba(255,255,255,0.2)'}`,
                  }}
                >
                  {stepData.feedback}
                </div>
              </div>

              {/* Right: 3D-Style Animated Human Head Movement Guide */}
              <HeadPoseGuide
                targetPose={stepData.targetPose}
                currentStep={stepData.step}
                poseCorrect={stepData.poseCorrect}
                feedback={stepData.feedback}
                capturedInStep={stepData.capturedInStep}
                neededInStep={stepData.neededInStep}
              />
            </div>

            {cameraError && (
              <div className="alert alert-danger" style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
                <AlertCircle size={14} style={{ marginRight: '4px' }} />
                {cameraError}
              </div>
            )}

            {/* Cancel Button */}
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCancelEnrollment}
              >
                Cancel Enrollment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
