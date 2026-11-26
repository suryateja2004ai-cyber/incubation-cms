// src/services/tour/TutorialProgressService.js
// Persistent storage service for Interactive Help & Guided Tour progress
// Scoped per user (roll number or role) and isolated in localStorage

const STORAGE_KEY_PREFIX = 'inc_cms_tour_progress_v1';

function getUserKey(user) {
  if (!user) return `${STORAGE_KEY_PREFIX}_guest`;
  const identifier = user.rollNumber || user.id || user.name || user.role || 'default';
  return `${STORAGE_KEY_PREFIX}_${String(identifier).toLowerCase().trim()}`;
}

export function getTourProgress(user) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { completedTutorials: {}, inProgressTutorials: {}, dismissedWelcome: false };
  }
  try {
    const raw = window.localStorage.getItem(getUserKey(user));
    if (!raw) {
      return { completedTutorials: {}, inProgressTutorials: {}, dismissedWelcome: false };
    }
    const parsed = JSON.parse(raw);
    return {
      completedTutorials: parsed.completedTutorials || {},
      inProgressTutorials: parsed.inProgressTutorials || {},
      dismissedWelcome: Boolean(parsed.dismissedWelcome),
    };
  } catch (e) {
    console.warn('Failed to read tour progress from localStorage:', e);
    return { completedTutorials: {}, inProgressTutorials: {}, dismissedWelcome: false };
  }
}

export function saveTourProgress(user, progress) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = getUserKey(user);
    window.localStorage.setItem(key, JSON.stringify(progress));
  } catch (e) {
    console.warn('Failed to save tour progress to localStorage:', e);
  }
}

export function markTutorialStarted(user, tutorialId) {
  const progress = getTourProgress(user);
  if (!progress.inProgressTutorials[tutorialId]) {
    progress.inProgressTutorials[tutorialId] = {
      currentStepIndex: 0,
      startedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
    };
  } else {
    progress.inProgressTutorials[tutorialId].lastAccessedAt = new Date().toISOString();
  }
  saveTourProgress(user, progress);
  return progress;
}

export function saveStepProgress(user, tutorialId, stepIndex) {
  const progress = getTourProgress(user);
  const current = progress.inProgressTutorials[tutorialId] || {
    startedAt: new Date().toISOString(),
  };
  progress.inProgressTutorials[tutorialId] = {
    ...current,
    currentStepIndex: stepIndex,
    lastAccessedAt: new Date().toISOString(),
  };
  saveTourProgress(user, progress);
  return progress;
}

export function markTutorialCompleted(user, tutorialId) {
  const progress = getTourProgress(user);
  const now = new Date().toISOString();
  const times = (progress.completedTutorials[tutorialId]?.timesCompleted || 0) + 1;

  progress.completedTutorials[tutorialId] = {
    completedAt: now,
    timesCompleted: times,
  };
  delete progress.inProgressTutorials[tutorialId];
  saveTourProgress(user, progress);
  return progress;
}

export function resetTutorialProgress(user, tutorialId) {
  const progress = getTourProgress(user);
  delete progress.completedTutorials[tutorialId];
  delete progress.inProgressTutorials[tutorialId];
  saveTourProgress(user, progress);
  return progress;
}

export function resetAllTutorialProgress(user) {
  const progress = { completedTutorials: {}, inProgressTutorials: {}, dismissedWelcome: false };
  saveTourProgress(user, progress);
  return progress;
}

export function isTutorialCompleted(user, tutorialId) {
  const progress = getTourProgress(user);
  return Boolean(progress.completedTutorials[tutorialId]);
}

export function getResumeStep(user, tutorialId) {
  const progress = getTourProgress(user);
  return progress.inProgressTutorials[tutorialId]?.currentStepIndex || 0;
}

export function setDismissedWelcome(user, dismissed = true) {
  const progress = getTourProgress(user);
  progress.dismissedWelcome = dismissed;
  saveTourProgress(user, progress);
}
