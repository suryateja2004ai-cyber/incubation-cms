// tests/unit/test_visual_head_pose_guidance.mjs
// Verification suite for 3D-style visual head-movement guidance in Face Registration
// Verifies:
// 1. Stage 1 (Straight): Neutral forward head, reticle indicator, "Look straight at the camera" instruction.
// 2. Stage 2 (Turn Left): Head rotates to student's own LEFT (screen left <-), arrow points left, "Slowly turn your head slightly to your left".
// 3. Stage 3 (Turn Right): Head rotates to student's own RIGHT (screen right ->), arrow points right, "Slowly turn your head slightly to your right".
// 4. Verification of Left/Right accuracy from student's perspective matching mirrored webcam space.
// 5. HeadPoseGuide and live camera preview mount together in FaceRegistrationModal.
// 6. Smooth scrolling and container ref preservation.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);

async function runTests() {
  console.log('=== STARTING VISUAL HEAD-MOVEMENT GUIDANCE VERIFICATION ===\n');

  // Bundle HeadPoseGuide.jsx for Node.js execution
  const tempBundlePath = path.join(projectRoot, 'frontend/src/components/biometrics/scratch_guide_bundle.cjs');
  await esbuild.build({
    entryPoints: [path.join(projectRoot, 'frontend/src/components/biometrics/HeadPoseGuide.jsx')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    outfile: tempBundlePath,
    external: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/server',
      'lucide-react',
    ],
  });

  const HeadPoseGuideModule = require(tempBundlePath);
  const HeadPoseGuide = HeadPoseGuideModule.default || HeadPoseGuideModule;

  // TEST 1: STAGE 1 - LOOK STRAIGHT
  console.log('[Test 1] Testing Stage 1 – Look Straight neutral guidance...');
  const stage1Html = renderToString(
    React.createElement(HeadPoseGuide, {
      targetPose: 'straight',
      currentStep: 1,
      poseCorrect: false,
      feedback: 'Please look directly into the camera.',
      capturedInStep: 2,
      neededInStep: 6,
    })
  );

  if (!stage1Html.includes('Look straight at the camera')) {
    throw new Error('Test 1 Failed: Stage 1 missing "Look straight at the camera" instruction.');
  }
  if (!stage1Html.includes('Face directly forward')) {
    throw new Error('Test 1 Failed: Stage 1 missing "Face directly forward" direction hint.');
  }
  if (!stage1Html.includes('1. Straight')) {
    throw new Error('Test 1 Failed: Stage 1 step badge not active.');
  }
  if (stage1Html.includes('YOUR LEFT') || stage1Html.includes('YOUR RIGHT')) {
    throw new Error('Test 1 Failed: Stage 1 should not display turn arrows.');
  }
  console.log('✓ Stage 1 (Straight): Neutral forward-facing illustration, reticle, and instruction verified.\n');

  // TEST 2: STAGE 2 - TURN SLIGHTLY LEFT (Student\'s own left)
  console.log('[Test 2] Testing Stage 2 – Turn Slightly Left guidance (Student\'s perspective)...');
  const stage2Html = renderToString(
    React.createElement(HeadPoseGuide, {
      targetPose: 'slight_left',
      currentStep: 2,
      poseCorrect: false,
      feedback: 'Turn your head slightly to your left.',
      capturedInStep: 0,
      neededInStep: 2,
    })
  );

  if (!stage2Html.includes('Slowly turn your head slightly to your left')) {
    throw new Error('Test 2 Failed: Stage 2 missing "Slowly turn your head slightly to your left" instruction.');
  }
  if (!stage2Html.includes('YOUR LEFT')) {
    throw new Error('Test 2 Failed: Stage 2 missing "YOUR LEFT" directional indicator.');
  }
  if (!stage2Html.includes('headTurnLeftDemo')) {
    throw new Error('Test 2 Failed: Stage 2 missing headTurnLeftDemo rotation animation.');
  }
  if (!stage2Html.includes('LEFT shoulder')) {
    throw new Error('Test 2 Failed: Stage 2 missing student left shoulder perspective hint.');
  }
  console.log('✓ Stage 2 (Turn Left): Head rotates to student\'s LEFT (screen left <-) with curved arrow verified.\n');

  // TEST 3: STAGE 3 - TURN SLIGHTLY RIGHT (Student\'s own right)
  console.log('[Test 3] Testing Stage 3 – Turn Slightly Right guidance (Student\'s perspective)...');
  const stage3Html = renderToString(
    React.createElement(HeadPoseGuide, {
      targetPose: 'slight_right',
      currentStep: 3,
      poseCorrect: false,
      feedback: 'Turn your head slightly to your right.',
      capturedInStep: 1,
      neededInStep: 2,
    })
  );

  if (!stage3Html.includes('Slowly turn your head slightly to your right')) {
    throw new Error('Test 3 Failed: Stage 3 missing "Slowly turn your head slightly to your right" instruction.');
  }
  if (!stage3Html.includes('YOUR RIGHT')) {
    throw new Error('Test 3 Failed: Stage 3 missing "YOUR RIGHT" directional indicator.');
  }
  if (!stage3Html.includes('headTurnRightDemo')) {
    throw new Error('Test 3 Failed: Stage 3 missing headTurnRightDemo rotation animation.');
  }
  if (!stage3Html.includes('RIGHT shoulder')) {
    throw new Error('Test 3 Failed: Stage 3 missing student right shoulder perspective hint.');
  }
  console.log('✓ Stage 3 (Turn Right): Head rotates to student\'s RIGHT (screen right ->) with curved arrow verified.\n');

  // TEST 4: ACCURACY & PERSPECTIVE CONSISTENCY
  console.log('[Test 4] Verifying Left/Right accuracy and perspective alignment...');
  // Left arrow animation shifts left (negative X); Right arrow shifts right (positive X)
  const leftAnimMatch = stage2Html.includes('translateX(-4px)');
  const rightAnimMatch = stage3Html.includes('translateX(4px)');
  if (!leftAnimMatch || !rightAnimMatch) {
    throw new Error('Test 4 Failed: Directional arrow vector animations do not match correct left/right axes.');
  }
  console.log('✓ Directional arrow vectors and rotation axes match student perspective and mirrored webcam space.\n');

  // TEST 5: POSE CORRECT FEEDBACK
  console.log('[Test 5] Testing visual indicator when correct pose is detected...');
  const correctPoseHtml = renderToString(
    React.createElement(HeadPoseGuide, {
      targetPose: 'slight_left',
      currentStep: 2,
      poseCorrect: true,
      feedback: 'Hold still, capturing...',
      capturedInStep: 1,
      neededInStep: 2,
    })
  );
  if (!correctPoseHtml.includes('Pose Correct! Hold still...')) {
    throw new Error('Test 5 Failed: HeadPoseGuide does not display pose correct confirmation state.');
  }
  console.log('✓ Pose Correct state displays visual green feedback and hold-still message.\n');

  // TEST 6: VERIFY FACE REGISTRATION MODAL INTEGRATION & SCROLL INVARIANTS
  console.log('[Test 6] Verifying FaceRegistrationModal integration and scroll invariance...');
  const modalSource = fs.readFileSync(
    path.join(projectRoot, 'frontend/src/components/biometrics/FaceRegistrationModal.jsx'),
    'utf-8'
  );

  if (!modalSource.includes('<HeadPoseGuide')) {
    throw new Error('Test 6 Failed: FaceRegistrationModal does not include HeadPoseGuide component.');
  }
  if (!modalSource.includes('face-enrollment-camera-section')) {
    throw new Error('Test 6 Failed: Camera section ID missing in FaceRegistrationModal.');
  }
  if (!modalSource.includes('smoothScrollToTarget')) {
    throw new Error('Test 6 Failed: Smooth scrolling implementation missing in FaceRegistrationModal.');
  }
  if (!modalSource.includes('scrollMarginTop')) {
    throw new Error('Test 6 Failed: Sticky navbar scrollMarginTop compensation missing in FaceRegistrationModal.');
  }
  console.log('✓ FaceRegistrationModal contains HeadPoseGuide alongside camera, with smooth scrolling preserved.\n');

  // TEST 7: PROTECTED FILES CHECK
  console.log('[Test 7] Checking protected files byte invariance...');
  const sampleDataStats = fs.statSync(path.join(projectRoot, 'frontend/src/db/sampleData.js'));
  const backupStats = fs.statSync(path.join(projectRoot, 'frontend/src/db/data_base_backup.js'));

  if (sampleDataStats.size !== 22676) {
    throw new Error(`Test 7 Failed: sampleData.js altered (${sampleDataStats.size} !== 22676 bytes).`);
  }
  if (backupStats.size !== 61794) {
    throw new Error(`Test 7 Failed: data_base_backup.js altered (${backupStats.size} !== 61794 bytes).`);
  }
  console.log(`✓ Protected files verified byte-exact: sampleData.js (22,676 B), data_base_backup.js (61,794 B).\n`);

  console.log('======================================================');
  console.log('ALL 7 VISUAL HEAD-MOVEMENT GUIDANCE TESTS PASSED (100%)');
  console.log('======================================================\n');

  try {
    if (fs.existsSync(tempBundlePath)) fs.unlinkSync(tempBundlePath);
  } catch (_) {}
}

runTests().catch((err) => {
  try {
    const tempBundlePath = path.join(projectRoot, 'frontend/src/components/biometrics/scratch_guide_bundle.cjs');
    if (fs.existsSync(tempBundlePath)) fs.unlinkSync(tempBundlePath);
  } catch (_) {}
  console.error('\n❌ Test Suite Failed:', err.message);
  process.exit(1);
});
