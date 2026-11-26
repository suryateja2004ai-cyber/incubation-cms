// tests/unit/test_guided_tour_system.mjs
// Verification & Comprehensive Test Suite for Interactive Help & Guided Tour System

import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Mock localStorage for node environment
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
global.window = { localStorage: localStorageMock };
global.localStorage = localStorageMock;

// Import services and registries
import {
  TUTORIALS,
  TUTORIAL_CATEGORIES,
  getTutorialsForRole,
  getTutorialById,
} from '../../frontend/src/services/tour/TutorialRegistry.js';

import {
  getTourProgress,
  saveTourProgress,
  markTutorialStarted,
  saveStepProgress,
  markTutorialCompleted,
  resetTutorialProgress,
  isTutorialCompleted,
  getResumeStep,
} from '../../frontend/src/services/tour/TutorialProgressService.js';

console.log('🧪 Starting Interactive Help & Guided Tour Test Suite...\n');

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. INVARIANT CHECKS
runTest('Invariant Check: sampleData.js is exactly 22,676 bytes', () => {
  const size = fs.statSync('frontend/src/db/sampleData.js').size;
  assert.strictEqual(size, 22676, `sampleData.js size was ${size}`);
});

runTest('Invariant Check: data_base_backup.js is exactly 61,794 bytes', () => {
  const size = fs.statSync('frontend/src/db/data_base_backup.js').size;
  assert.strictEqual(size, 61794, `data_base_backup.js size was ${size}`);
});

// 2. TUTORIAL REGISTRY & ROLE FILTERING
runTest('Role-Based Filtering: Admin / Sir / Sub-Admin receives all administrative tutorials', () => {
  const adminTours = getTutorialsForRole('admin');
  const sirTours = getTutorialsForRole('sir');
  const subAdminTours = getTutorialsForRole('substitute_admin');

  assert.ok(adminTours.length >= 7, 'Admin should have full access to tutorials');
  assert.strictEqual(adminTours.length, sirTours.length, 'Sir should have same tutorials as Admin');
  assert.strictEqual(adminTours.length, subAdminTours.length, 'Substitute admin should have same as Admin');

  // Verify key admin tutorials exist
  const tourIds = adminTours.map((t) => t.id);
  assert.ok(tourIds.includes('tour_complete_admin'), 'Complete Admin tour must exist');
  assert.ok(tourIds.includes('tour_issue_component'), 'Issue component tour must exist');
  assert.ok(tourIds.includes('tour_return_component'), 'Return component tour must exist');
  assert.ok(tourIds.includes('tour_component_inventory'), 'Inventory tour must exist');
  assert.ok(tourIds.includes('tour_unified_attendance'), 'Attendance tour must exist');
  assert.ok(tourIds.includes('tour_lab_controls'), 'Lab controls tour must exist');
  assert.ok(tourIds.includes('tour_student_accounts'), 'Student accounts tour must exist');
});

runTest('Role-Based Filtering: Staff strictly receives desk operations only', () => {
  const staffTours = getTutorialsForRole('staff');
  const staffTourIds = staffTours.map((t) => t.id);

  assert.ok(staffTourIds.includes('tour_complete_staff'), 'Complete Staff tour must exist');
  assert.ok(staffTourIds.includes('tour_issue_component'), 'Issue components desk tour must exist');
  assert.ok(staffTourIds.includes('tour_return_component'), 'Return components desk tour must exist');
  assert.ok(staffTourIds.includes('tour_component_inventory'), 'Component inventory tour must exist');
  assert.ok(staffTourIds.includes('tour_unified_attendance'), 'Attendance tour must exist');

  // Ensure restricted admin-only sections are NOT exposed to staff
  assert.strictEqual(staffTourIds.includes('tour_complete_admin'), false, 'Staff must not see complete admin tour');
  assert.strictEqual(staffTourIds.includes('tour_student_accounts'), false, 'Staff must not see admin student account management tour');
});

runTest('Role-Based Filtering: Students strictly receive student portal & showcase tutorials', () => {
  const studentTours = getTutorialsForRole('student');
  const studentTourIds = studentTours.map((t) => t.id);

  assert.ok(studentTourIds.includes('tour_complete_student'), 'Complete student tour must exist');
  assert.ok(studentTourIds.includes('tour_lab_controls'), 'Student lab controls tour must exist');

  // Ensure administrative issue/return/account operations are NOT exposed to student
  assert.strictEqual(studentTourIds.includes('tour_complete_admin'), false, 'Student must not see complete admin tour');
  assert.strictEqual(studentTourIds.includes('tour_complete_staff'), false, 'Student must not see complete staff tour');
  assert.strictEqual(studentTourIds.includes('tour_issue_component'), false, 'Student must not see admin issue component tour');
  assert.strictEqual(studentTourIds.includes('tour_return_component'), false, 'Student must not see admin return component tour');
  assert.strictEqual(studentTourIds.includes('tour_student_accounts'), false, 'Student must not see student accounts tour');
});

// 3. TUTORIAL PROGRESS & PERSISTENCE
runTest('Progress Persistence: Tracks started, current step, and completed tutorials per user', () => {
  const adminUser = { id: 'admin_1', role: 'admin', name: 'Dr. Faculty Admin' };
  localStorageMock.clear();

  // Fresh user progress
  let progress = getTourProgress(adminUser);
  assert.deepStrictEqual(progress.completedTutorials, {});
  assert.deepStrictEqual(progress.inProgressTutorials, {});
  assert.strictEqual(isTutorialCompleted(adminUser, 'tour_issue_component'), false);

  // Start Issue Component tutorial
  markTutorialStarted(adminUser, 'tour_issue_component');
  assert.strictEqual(getResumeStep(adminUser, 'tour_issue_component'), 0);

  // Advance step progress
  saveStepProgress(adminUser, 'tour_issue_component', 2);
  assert.strictEqual(getResumeStep(adminUser, 'tour_issue_component'), 2);

  // Complete tutorial
  markTutorialCompleted(adminUser, 'tour_issue_component');
  assert.strictEqual(isTutorialCompleted(adminUser, 'tour_issue_component'), true);

  // Verify inProgress is cleaned up upon completion
  progress = getTourProgress(adminUser);
  assert.strictEqual(progress.inProgressTutorials['tour_issue_component'], undefined);
  assert.ok(progress.completedTutorials['tour_issue_component'].completedAt);
  assert.strictEqual(progress.completedTutorials['tour_issue_component'].timesCompleted, 1);

  // Restart tutorial
  resetTutorialProgress(adminUser, 'tour_issue_component');
  assert.strictEqual(isTutorialCompleted(adminUser, 'tour_issue_component'), false);
});

runTest('Progress Persistence: Multi-user isolation prevents state leaks between users', () => {
  const userA = { rollNumber: '238W1A0477', role: 'student', name: 'Student A' };
  const userB = { rollNumber: '238W1A0478', role: 'student', name: 'Student B' };

  markTutorialCompleted(userA, 'tour_complete_student');

  assert.strictEqual(isTutorialCompleted(userA, 'tour_complete_student'), true);
  assert.strictEqual(isTutorialCompleted(userB, 'tour_complete_student'), false, 'User B must not inherit User A completion');
});

// 4. ACTION-DRIVEN CONFIGURATION & SAFE LEARNING MODE
runTest('Action-Driven Structure: Every tutorial step defines selector, placement, and expected action', () => {
  for (const tut of TUTORIALS) {
    assert.ok(tut.id, 'Tutorial must have id');
    assert.ok(tut.title, 'Tutorial must have title');
    assert.ok(tut.category, 'Tutorial must have category');
    assert.ok(Array.isArray(tut.steps) && tut.steps.length > 0, `${tut.id} must have non-empty steps`);

    tut.steps.forEach((step, idx) => {
      assert.ok(step.id, `Step ${idx} of ${tut.id} must have id`);
      assert.ok(step.title, `Step ${idx} of ${tut.id} must have title`);
      assert.ok(step.instruction, `Step ${idx} of ${tut.id} must have instruction`);
      assert.ok(step.targetSelector, `Step ${idx} of ${tut.id} must have targetSelector`);
      assert.ok(
        ['click', 'input', 'route_change', 'next', 'confirm'].includes(step.actionType),
        `Step ${idx} of ${tut.id} actionType "${step.actionType}" must be valid`
      );
      assert.ok(step.expectedAction, `Step ${idx} of ${tut.id} must define expectedAction`);
    });
  }
});

runTest('Safe Learning Mode: Sensitive operations (issue, return, retention) are marked safeLearningMode', () => {
  const issueTut = getTutorialById('tour_issue_component');
  const returnTut = getTutorialById('tour_return_component');
  const studentAccountsTut = getTutorialById('tour_student_accounts');

  assert.strictEqual(issueTut.safeLearningMode, true, 'Issue tutorial must be in Safe Learning Mode');
  assert.strictEqual(returnTut.safeLearningMode, true, 'Return tutorial must be in Safe Learning Mode');
  assert.strictEqual(studentAccountsTut.safeLearningMode, true, 'Student accounts tutorial must be in Safe Learning Mode');

  // Verify steps have safe demo notices
  const hasNotice = issueTut.steps.some((s) => Boolean(s.safeDemoNotice));
  assert.strictEqual(hasNotice, true, 'Issue tutorial must inform user of safe demo mode');
});

// 5. STABLE TARGET ATTRIBUTES IN SOURCE CODE
runTest('Stable DOM Attributes: Navigation and page components contain declared data-tour targets', () => {
  const navbarContent = fs.readFileSync('frontend/src/components/layout/Navbar.jsx', 'utf8');
  assert.ok(navbarContent.includes('data-tour="navbar-brand"'), 'Navbar has navbar-brand target');
  assert.ok(navbarContent.includes('data-tour="navbar-help"'), 'Navbar has navbar-help button');
  assert.ok(navbarContent.includes('data-tour="main-tab-nav"'), 'Navbar has main-tab-nav target');
  assert.ok(navbarContent.includes('data-tour="voice-search"'), 'Navbar has voice-search target');
  assert.ok(navbarContent.includes('data-tour="user-profile"'), 'Navbar has user-profile target');

  const sidebarContent = fs.readFileSync('frontend/src/components/layout/Sidebar.jsx', 'utf8');
  assert.ok(sidebarContent.includes('data-tour="nav-help"'), 'Sidebar has nav-help item');
  assert.ok(sidebarContent.includes('data-tour={`nav-${item.id}`}'), 'Sidebar has dynamic data-tour items');

  const issueContent = fs.readFileSync('frontend/src/pages/admin/IssueComponent.jsx', 'utf8');
  assert.ok(issueContent.includes('data-tour="issue-roll-input"'), 'IssueComponent has issue-roll-input');
  assert.ok(issueContent.includes('data-tour="issue-catalog-search"'), 'IssueComponent has issue-catalog-search');
  assert.ok(issueContent.includes('data-tour="issue-catalog-card"'), 'IssueComponent has issue-catalog-card');
  assert.ok(issueContent.includes('data-tour="issue-cart-section"'), 'IssueComponent has issue-cart-section');
  assert.ok(issueContent.includes('data-tour="issue-submit-btn"'), 'IssueComponent has issue-submit-btn');

  const returnContent = fs.readFileSync('frontend/src/pages/admin/ReturnComponent.jsx', 'utf8');
  assert.ok(returnContent.includes('data-tour="return-roll-input"'), 'ReturnComponent has return-roll-input');
  assert.ok(returnContent.includes('data-tour="return-txns-list"'), 'ReturnComponent has return-txns-list');
  assert.ok(returnContent.includes('data-tour="return-submit-btn"'), 'ReturnComponent has return-submit-btn');

  const compContent = fs.readFileSync('frontend/src/pages/admin/Components.jsx', 'utf8');
  assert.ok(compContent.includes('data-tour="components-search-input"'), 'Components has search input target');
  assert.ok(compContent.includes('data-tour="components-category-filter"'), 'Components has category filter target');
  assert.ok(compContent.includes('data-tour="components-table"'), 'Components has table target');

  const portalContent = fs.readFileSync('frontend/src/pages/student/StudentPortal.jsx', 'utf8');
  assert.ok(portalContent.includes('data-tour="student-portal-stats"'), 'StudentPortal has stats target');
  assert.ok(portalContent.includes('data-tour="student-borrowed-items"'), 'StudentPortal has borrowed items target');
  assert.ok(portalContent.includes('data-tour="student-attendance-card"'), 'StudentPortal has attendance target');
});

// 6. MANDATORY EXIT FUNCTIONALITY
runTest('Mandatory Exit Tour: GuidedTourTooltip and Context implement requestExitTour and confirmExitTour', () => {
  const tooltipContent = fs.readFileSync('frontend/src/components/tour/GuidedTourTooltip.jsx', 'utf8');
  assert.ok(tooltipContent.includes('onRequestExit'), 'Tooltip supports onRequestExit');
  assert.ok(tooltipContent.includes('isConfirmingExit'), 'Tooltip supports isConfirmingExit state');
  assert.ok(tooltipContent.includes('Exit Guided Tour?'), 'Exit confirmation modal renders clear title');
  assert.ok(tooltipContent.includes('Yes, Exit Tour'), 'Exit confirmation modal renders confirm button');
  assert.ok(tooltipContent.includes('Stay in Tour'), 'Exit confirmation modal renders cancel button');

  const contextContent = fs.readFileSync('frontend/src/components/tour/GuidedTourContext.jsx', 'utf8');
  assert.ok(contextContent.includes('confirmExitTour'), 'Context implements confirmExitTour');
  assert.ok(contextContent.includes('cancelExitTour'), 'Context implements cancelExitTour');
  assert.ok(contextContent.includes('cleanupListeners'), 'Context cleans up observers and listeners on exit');
});

console.log(`\n🎉 ALL ${passedTests} GUIDED TOUR SYSTEM TESTS PASSED SUCCESSFULLY!`);
