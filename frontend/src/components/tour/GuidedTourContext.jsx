// src/components/tour/GuidedTourContext.jsx
// Guided Tour State Machine & Context Provider
// Handles active tour lifecycle, step progression, dynamic element tracking, and safe cleanup

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getTutorialById, getTutorialsForRole } from '../../services/tour/TutorialRegistry';
import {
  getTourProgress,
  markTutorialStarted,
  saveStepProgress,
  markTutorialCompleted,
  resetTutorialProgress,
  isTutorialCompleted,
  getResumeStep,
} from '../../services/tour/TutorialProgressService';

const GuidedTourContext = createContext(null);

export function useGuidedTour() {
  const context = useContext(GuidedTourContext);
  if (!context) {
    throw new Error('useGuidedTour must be used within a GuidedTourProvider');
  }
  return context;
}

export function GuidedTourProvider({
  children,
  currentUser,
  mainTab,
  setMainTab,
  activeTab,
  setActiveTab,
  onToast,
}) {
  const [activeTutorialId, setActiveTutorialId] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);
  const [isHelpCenterOpen, setIsHelpCenterOpen] = useState(false);
  const [targetRect, setTargetRect] = useState(null);
  const [targetElement, setTargetElement] = useState(null);

  const activeTutorial = activeTutorialId ? getTutorialById(activeTutorialId) : null;
  const currentStep = activeTutorial?.steps?.[currentStepIndex] || null;
  const totalSteps = activeTutorial?.steps?.length || 0;
  const isTourActive = Boolean(activeTutorial && !isPaused);

  const cleanListenersRef = useRef(null);
  const observerRef = useRef(null);

  // Safely recalculate target element bounding rect
  const updateTargetRect = useCallback(() => {
    if (!currentStep?.targetSelector || typeof document === 'undefined') {
      setTargetRect(null);
      setTargetElement(null);
      return;
    }

    try {
      const el = document.querySelector(currentStep.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right,
        });
        setTargetElement(el);

        // Smoothly scroll element into view if not comfortably visible
        const isOutOfView =
          rect.top < 70 ||
          rect.bottom > window.innerHeight - 70 ||
          rect.left < 20 ||
          rect.right > window.innerWidth - 20;

        if (isOutOfView && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
      } else {
        setTargetRect(null);
        setTargetElement(null);
      }
    } catch (e) {
      console.warn('Target rect calculation error:', e);
      setTargetRect(null);
      setTargetElement(null);
    }
  }, [currentStep]);

  // Clean up any dynamic event listeners
  const cleanupListeners = useCallback(() => {
    if (cleanListenersRef.current) {
      cleanListenersRef.current();
      cleanListenersRef.current = null;
    }
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  // Advance to next step safely
  const nextStep = useCallback(() => {
    if (!activeTutorial) return;

    cleanupListeners();
    const nextIndex = currentStepIndex + 1;

    if (nextIndex >= totalSteps) {
      // Completed tutorial!
      markTutorialCompleted(currentUser, activeTutorial.id);
      setActiveTutorialId(null);
      setCurrentStepIndex(0);
      setTargetRect(null);
      setTargetElement(null);
      if (onToast) {
        onToast(`🎉 Tutorial "${activeTutorial.title}" completed!`);
      }
    } else {
      setCurrentStepIndex(nextIndex);
      saveStepProgress(currentUser, activeTutorial.id, nextIndex);
    }
  }, [activeTutorial, currentStepIndex, totalSteps, currentUser, cleanupListeners, onToast]);

  // Step back
  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      cleanupListeners();
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      saveStepProgress(currentUser, activeTutorial?.id, prevIndex);
    }
  }, [currentStepIndex, activeTutorial, currentUser, cleanupListeners]);

  // Skip step
  const skipStep = useCallback(() => {
    nextStep();
  }, [nextStep]);

  // Start tutorial
  const startTutorial = useCallback((tutorialId, startStep = 0) => {
    const tut = getTutorialById(tutorialId);
    if (!tut) return;

    cleanupListeners();
    setIsHelpCenterOpen(false);
    setIsPaused(false);
    setIsConfirmingExit(false);
    setActiveTutorialId(tutorialId);
    setCurrentStepIndex(startStep);
    markTutorialStarted(currentUser, tutorialId);

    // If starting route differs, switch route smoothly
    if (tut.startingRoute) {
      if (tut.startingRoute.mainTab && setMainTab) setMainTab(tut.startingRoute.mainTab);
      if (tut.startingRoute.activeTab && setActiveTab) setActiveTab(tut.startingRoute.activeTab);
    }
  }, [currentUser, setMainTab, setActiveTab, cleanupListeners]);

  // Pause / Resume
  const pauseTour = useCallback(() => {
    cleanupListeners();
    setIsPaused(true);
    setTargetRect(null);
    setTargetElement(null);
    if (onToast) onToast('Tutorial paused. You can resume anytime from Help.');
  }, [cleanupListeners, onToast]);

  const resumeTour = useCallback(() => {
    setIsPaused(false);
  }, []);

  const restartTour = useCallback((tutorialId) => {
    const id = tutorialId || activeTutorialId;
    if (!id) return;
    resetTutorialProgress(currentUser, id);
    startTutorial(id, 0);
  }, [activeTutorialId, currentUser, startTutorial]);

  // Mandatory Exit handling
  const requestExitTour = useCallback(() => {
    setIsConfirmingExit(true);
  }, []);

  const cancelExitTour = useCallback(() => {
    setIsConfirmingExit(false);
  }, []);

  const confirmExitTour = useCallback(() => {
    cleanupListeners();
    setIsConfirmingExit(false);
    setIsPaused(false);
    setActiveTutorialId(null);
    setCurrentStepIndex(0);
    setTargetRect(null);
    setTargetElement(null);
    if (onToast) onToast('Tutorial exited. Normal portal usage restored.');
  }, [cleanupListeners, onToast]);

  // Auto route adjustment if step requires a specific route
  useEffect(() => {
    if (!isTourActive || !currentStep) return;

    if (currentStep.route) {
      const needsMainChange = currentStep.route.mainTab && currentStep.route.mainTab !== mainTab;
      const needsActiveChange = currentStep.route.activeTab && currentStep.route.activeTab !== activeTab;

      if (needsMainChange && setMainTab) {
        setMainTab(currentStep.route.mainTab);
      }
      if (needsActiveChange && setActiveTab) {
        setActiveTab(currentStep.route.activeTab);
      }
    }
  }, [isTourActive, currentStep, mainTab, activeTab, setMainTab, setActiveTab]);

  // Monitor target element in DOM and attach interaction listeners
  useEffect(() => {
    if (!isTourActive || !currentStep) {
      cleanupListeners();
      setTargetRect(null);
      setTargetElement(null);
      return;
    }

    cleanupListeners();

    // Check periodically until element is rendered
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      updateTargetRect();
      if (document.querySelector(currentStep.targetSelector) || attempts > 25) {
        clearInterval(interval);
      }
    }, 120);

    // Window scroll and resize listeners
    const handleScrollResize = () => {
      updateTargetRect();
    };

    window.addEventListener('resize', handleScrollResize, { passive: true });
    window.addEventListener('scroll', handleScrollResize, { passive: true, capture: true });

    // Mutation observer to handle dynamic modal opens or table renders
    const observer = new MutationObserver(() => {
      updateTargetRect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    observerRef.current = observer;

    // Attach action listener if waiting for user interaction (click, input, etc.)
    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      if (currentStep.actionType === 'click') {
        const handleClick = () => {
          setTimeout(() => {
            nextStep();
          }, 250);
        };
        el.addEventListener('click', handleClick);
        cleanListenersRef.current = () => el.removeEventListener('click', handleClick);
      } else if (currentStep.actionType === 'input') {
        let timer = null;
        const handleInput = (e) => {
          if (e.target.value && e.target.value.trim().length >= 3) {
            clearTimeout(timer);
            timer = setTimeout(() => {
              nextStep();
            }, 900);
          }
        };
        el.addEventListener('input', handleInput);
        cleanListenersRef.current = () => {
          clearTimeout(timer);
          el.removeEventListener('input', handleInput);
        };
      }
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleScrollResize);
      window.removeEventListener('scroll', handleScrollResize, { capture: true });
      cleanupListeners();
    };
  }, [isTourActive, currentStep, nextStep, updateTargetRect, cleanupListeners]);

  const value = {
    activeTutorial,
    activeTutorialId,
    currentStep,
    currentStepIndex,
    totalSteps,
    isTourActive,
    isPaused,
    isConfirmingExit,
    isHelpCenterOpen,
    targetRect,
    targetElement,
    startTutorial,
    nextStep,
    previousStep,
    skipStep,
    pauseTour,
    resumeTour,
    restartTour,
    requestExitTour,
    cancelExitTour,
    confirmExitTour,
    openHelpCenter: () => setIsHelpCenterOpen(true),
    closeHelpCenter: () => setIsHelpCenterOpen(false),
  };

  return <GuidedTourContext.Provider value={value}>{children}</GuidedTourContext.Provider>;
}
