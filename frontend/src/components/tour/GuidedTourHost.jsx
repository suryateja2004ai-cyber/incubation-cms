// src/components/tour/GuidedTourHost.jsx
// Guided Tour Visual Coordinator
// Mounts the spotlight overlay, animated hand pointer, floating instruction card, and Help Center modal

import React from 'react';
import { useGuidedTour } from './GuidedTourContext';
import GuidedTourOverlay from './GuidedTourOverlay';
import GuidedTourPointer from './GuidedTourPointer';
import GuidedTourTooltip from './GuidedTourTooltip';
import HelpCenterModal from './HelpCenterModal';

export default function GuidedTourHost({ currentUser }) {
  const {
    activeTutorial,
    currentStep,
    currentStepIndex,
    totalSteps,
    isTourActive,
    isConfirmingExit,
    isHelpCenterOpen,
    targetRect,
    nextStep,
    previousStep,
    skipStep,
    pauseTour,
    requestExitTour,
    confirmExitTour,
    cancelExitTour,
    startTutorial,
    restartTour,
    closeHelpCenter,
  } = useGuidedTour();

  return (
    <>
      {/* 1. Spotlight Dimmed Backdrop Overlay */}
      <GuidedTourOverlay
        targetRect={targetRect}
        isTourActive={isTourActive}
      />

      {/* 2. Animated Hand Pointer pointing to target */}
      {isTourActive && targetRect && (
        <GuidedTourPointer
          targetRect={targetRect}
          placement={currentStep?.placement || 'bottom'}
        />
      )}

      {/* 3. Floating Instruction Card near target */}
      {isTourActive && currentStep && (
        <GuidedTourTooltip
          currentStep={currentStep}
          currentStepIndex={currentStepIndex}
          totalSteps={totalSteps}
          targetRect={targetRect}
          onNext={nextStep}
          onPrevious={previousStep}
          onSkip={skipStep}
          onPause={pauseTour}
          onRequestExit={requestExitTour}
          isConfirmingExit={isConfirmingExit}
          onConfirmExit={confirmExitTour}
          onCancelExit={cancelExitTour}
          safeLearningMode={Boolean(activeTutorial?.safeLearningMode)}
        />
      )}

      {/* 4. Help & Guided Tutorials Center Modal */}
      <HelpCenterModal
        isOpen={isHelpCenterOpen}
        onClose={closeHelpCenter}
        currentUser={currentUser}
        onStartTutorial={startTutorial}
        onRestartTutorial={restartTour}
      />
    </>
  );
}
