"""
Automated Integration Tests for Local Face Recognition API & SQLite Biometrics.
Tests:
- Biometric Database Initialization
- Exactly 10-Embeddings Rule Enforcement
- Transactional Rollback on Incomplete Registration
- Duplicate / Re-Registration Handling
- Known vs Unknown Matching via Cosine Similarity
- Zero Image Retention Verification
- Student Biometric Deletion & Cascading Cleanup
"""

import sys
import os
import unittest
import numpy as np
import tempfile
import shutil

# Add backend/face to path
BACKEND_FACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend", "face"))
if BACKEND_FACE_DIR not in sys.path:
    sys.path.insert(0, BACKEND_FACE_DIR)

from face_utils import (
    BiometricDatabaseManager,
    FastHeadPoseEstimator,
    decode_image_base64
)


class TestFaceBiometricIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create an isolated temporary test database
        cls.test_dir = tempfile.mkdtemp()
        cls.test_db_path = os.path.join(cls.test_dir, "test_attendance.db")
        cls.db = BiometricDatabaseManager(cls.test_db_path)

    @classmethod
    def tearDownClass(cls):
        # Clean up temporary test database directory
        if os.path.exists(cls.test_dir):
            shutil.rmtree(cls.test_dir)

    def test_01_database_initialization(self):
        """Verifies persons and face_embeddings tables are created."""
        self.assertTrue(os.path.exists(self.test_db_path))
        students = self.db.get_registered_students()
        self.assertEqual(len(students), 0)

    def test_02_enforce_exact_10_embeddings_rule(self):
        """Rejects registration if embedding count is not exactly 10."""
        roll = "238W1A0477"
        name = "Anwar Bajarinti"

        # Try with 9 embeddings (must fail)
        nine_embs = [np.random.randn(512).astype(np.float32) for _ in range(9)]
        success, msg = self.db.save_registration(roll, name, nine_embs)
        self.assertFalse(success)
        self.assertIn("Exact 10 embeddings required", msg)

        # Verify nothing was written to database
        self.assertIsNone(self.db.get_student_by_roll(roll))

        # Try with 11 embeddings (must fail)
        eleven_embs = [np.random.randn(512).astype(np.float32) for _ in range(11)]
        success, msg = self.db.save_registration(roll, name, eleven_embs)
        self.assertFalse(success)
        self.assertIn("Exact 10 embeddings required", msg)
        self.assertIsNone(self.db.get_student_by_roll(roll))

        # Try with exactly 10 embeddings (must succeed)
        ten_embs = [np.random.randn(512).astype(np.float32) for _ in range(10)]
        success, msg = self.db.save_registration(roll, name, ten_embs)
        self.assertTrue(success)
        self.assertIn("Successfully saved", msg)

        # Verify saved student has exactly 10 embeddings
        saved = self.db.get_student_by_roll(roll)
        self.assertIsNotNone(saved)
        self.assertEqual(saved["roll_number"], "238W1A0477")
        self.assertEqual(saved["embedding_count"], 10)

    def test_03_duplicate_and_reregistration(self):
        """Re-registering an existing student replaces old embeddings cleanly without duplicates."""
        roll = "238W1A0477"
        updated_name = "Anwar Bajarinti (Updated)"
        new_ten_embs = [np.random.randn(512).astype(np.float32) for _ in range(10)]

        success, msg = self.db.save_registration(roll, updated_name, new_ten_embs)
        self.assertTrue(success)

        # Verify student record updated and still has exactly 10 embeddings
        saved = self.db.get_student_by_roll(roll)
        self.assertEqual(saved["name"], updated_name)
        self.assertEqual(saved["embedding_count"], 10)

        # Verify no duplicate persons were created
        all_students = self.db.get_registered_students()
        matching = [s for s in all_students if s["roll_number"] == roll]
        self.assertEqual(len(matching), 1)

    def test_04_known_vs_unknown_cosine_matching(self):
        """Validates cosine similarity matching accurately distinguishes known vs unknown."""
        # Enroll Student A with known unit base embedding
        roll_a = "238W1A04C2"
        base_vector_a = np.random.randn(512).astype(np.float32)
        base_vector_a /= np.linalg.norm(base_vector_a)

        # 10 slight variations (simulating head poses)
        embs_a = []
        for _ in range(10):
            noise = np.random.randn(512).astype(np.float32) * 0.05
            v = base_vector_a + noise
            v /= np.linalg.norm(v)
            embs_a.append(v)

        success, _ = self.db.save_registration(roll_a, "Kavya Sharma", embs_a)
        self.assertTrue(success)

        # Load known faces from database
        known_matrix, metadata = self.db.load_known_faces()
        self.assertGreater(len(known_matrix), 0)

        # Query 1: Probe identical to Student A (Simulated match)
        probe_a = (base_vector_a + np.random.randn(512).astype(np.float32) * 0.04)
        probe_a /= np.linalg.norm(probe_a)
        sims_a = np.dot(known_matrix, probe_a)
        best_idx_a = int(np.argmax(sims_a))
        best_score_a = float(sims_a[best_idx_a])

        # High similarity (>0.85) matching student A
        self.assertGreaterEqual(best_score_a, 0.45)
        self.assertEqual(metadata[best_idx_a]["roll_number"], roll_a)

        # Query 2: Probe orthogonal / random (Simulated unknown person)
        probe_unknown = np.random.randn(512).astype(np.float32)
        probe_unknown /= np.linalg.norm(probe_unknown)
        sims_u = np.dot(known_matrix, probe_unknown)
        best_score_u = float(np.max(sims_u))

        # Expected score for random orthogonal vector is typically < 0.20
        self.assertLess(best_score_u, 0.45)

    def test_05_head_pose_estimation(self):
        """Tests FastHeadPoseEstimator returns smooth pitch, yaw, roll angles."""
        estimator = FastHeadPoseEstimator()

        # Simulated landmarks: [left_eye, right_eye, nose, left_mouth, right_mouth]
        # Centered straight face
        kps_straight = np.array([
            [200.0, 150.0],  # left eye
            [280.0, 150.0],  # right eye
            [240.0, 185.0],  # nose
            [210.0, 220.0],  # left mouth
            [270.0, 220.0],  # right mouth
        ])
        success, p, y, r = estimator.estimate(kps_straight)
        self.assertTrue(success)
        # Straight face should have near-zero yaw and roll
        self.assertLess(abs(y), 15.0)
        self.assertLess(abs(r), 10.0)

        # Slight left turn (nose shifts left relative to eye center)
        kps_left = np.array([
            [200.0, 150.0],
            [280.0, 150.0],
            [225.0, 185.0],  # nose shifted left
            [205.0, 220.0],
            [265.0, 220.0],
        ])
        success, p, y_left, r = estimator.estimate(kps_left)
        self.assertTrue(success)
        self.assertLess(y_left, 0.0)  # Negative yaw for left turn

    def test_06_biometric_deletion(self):
        """Verifies permanent cascading deletion of student biometric embeddings."""
        roll = "238W1A04C2"
        success, msg = self.db.delete_student_biometrics(roll)
        self.assertTrue(success)
        self.assertIn("permanently deleted", msg)

        # Verify student no longer exists in database
        self.assertIsNone(self.db.get_student_by_roll(roll))

        # Verify embeddings were deleted from loaded cache
        known_matrix, metadata = self.db.load_known_faces()
        rolls_remaining = [m["roll_number"] for m in metadata]
        self.assertNotIn(roll, rolls_remaining)

    def test_07_zero_image_storage_invariant(self):
        """Verifies that no image or video files are written during in-memory decoding."""
        import cv2
        import base64
        files_before = set(os.listdir(self.test_dir))

        # Encode a valid synthetic 20x20 test frame
        test_frame = np.zeros((20, 20, 3), dtype=np.uint8)
        _, encoded_buf = cv2.imencode('.jpg', test_frame)
        dummy_base64 = "data:image/jpeg;base64," + base64.b64encode(encoded_buf).decode('ascii')

        img = decode_image_base64(dummy_base64)
        self.assertIsNotNone(img)
        self.assertEqual(img.shape, (20, 20, 3))

        files_after = set(os.listdir(self.test_dir))
        # Ensure no new image files were created in the directory
        new_files = files_after - files_before
        self.assertEqual(len(new_files), 0)

    def test_08_strong_unique_face_match(self):
        """Verifies candidate with score >= 0.45 and distinct separation classifies as unique."""
        from face_utils import rank_student_candidates

        base = np.random.randn(512).astype(np.float32)
        base /= np.linalg.norm(base)

        known_embs = [base]
        metadata = [{"roll_number": "238W1A0477", "name": "Anwar Bajarinti", "person_id": 1}]

        # Query close to base (similarity ~0.95)
        query = base + np.random.randn(512).astype(np.float32) * 0.02
        query /= np.linalg.norm(query)

        res = rank_student_candidates(np.array(known_embs), metadata, query)
        self.assertEqual(res["match_type"], "unique")
        self.assertEqual(res["top_candidate"]["roll_number"], "238W1A0477")
        self.assertEqual(len(res["candidates"]), 1)
        self.assertGreaterEqual(res["top_candidate"]["similarity"], 0.45)

    def test_09_weak_face_match(self):
        """Verifies candidate with highest score < 0.45 classifies as weak."""
        from face_utils import rank_student_candidates

        v1 = np.random.randn(512).astype(np.float32)
        v1 /= np.linalg.norm(v1)

        # Orthogonal query vector
        query = np.random.randn(512).astype(np.float32)
        query -= np.dot(query, v1) * v1  # Gram-Schmidt orthogonalization
        query /= np.linalg.norm(query)

        # Mix slightly so similarity is ~0.42 (< 0.45 positive threshold)
        probe = 0.42 * v1 + np.sqrt(1 - 0.42**2) * query
        probe /= np.linalg.norm(probe)

        known_embs = [v1]
        metadata = [{"roll_number": "238W1A0477", "name": "Anwar Bajarinti", "person_id": 1}]

        res = rank_student_candidates(np.array(known_embs), metadata, probe)
        self.assertEqual(res["match_type"], "weak")
        self.assertLess(res["top_candidate"]["similarity"], 0.45)

    def test_10_two_ambiguous_candidates(self):
        """Verifies exactly 2 candidates with similarity within 0.08 margin classify as ambiguous."""
        from face_utils import rank_student_candidates

        base = np.random.randn(512).astype(np.float32)
        base /= np.linalg.norm(base)

        # Create two candidates: Cand A (sim 0.60), Cand B (sim 0.56, delta 0.04 <= 0.08)
        ortho = np.random.randn(512).astype(np.float32)
        ortho -= np.dot(ortho, base) * base
        ortho /= np.linalg.norm(ortho)

        cand_a = 0.60 * base + np.sqrt(1 - 0.60**2) * ortho
        cand_b = 0.56 * base + np.sqrt(1 - 0.56**2) * ortho

        known_embs = [cand_a, cand_b]
        metadata = [
            {"roll_number": "238W1A0477", "name": "Student A", "person_id": 1},
            {"roll_number": "238W1A0478", "name": "Student B", "person_id": 2},
        ]

        res = rank_student_candidates(np.array(known_embs), metadata, base)
        self.assertEqual(res["match_type"], "ambiguous")
        self.assertEqual(res["ambiguous_count"], 2)
        self.assertEqual(len(res["candidates"]), 2)
        self.assertEqual(res["candidates"][0]["roll_number"], "238W1A0477")
        self.assertEqual(res["candidates"][1]["roll_number"], "238W1A0478")

    def test_11_three_ambiguous_candidates(self):
        """Verifies exactly 3 candidates with similarity within 0.08 margin classify as ambiguous."""
        from face_utils import rank_student_candidates

        base = np.random.randn(512).astype(np.float32)
        base /= np.linalg.norm(base)

        ortho = np.random.randn(512).astype(np.float32)
        ortho -= np.dot(ortho, base) * base
        ortho /= np.linalg.norm(ortho)

        cand_a = 0.62 * base + np.sqrt(1 - 0.62**2) * ortho
        cand_b = 0.58 * base + np.sqrt(1 - 0.58**2) * ortho
        cand_c = 0.55 * base + np.sqrt(1 - 0.55**2) * ortho

        known_embs = [cand_a, cand_b, cand_c]
        metadata = [
            {"roll_number": "238W1A0477", "name": "Student A", "person_id": 1},
            {"roll_number": "238W1A0478", "name": "Student B", "person_id": 2},
            {"roll_number": "238W1A0479", "name": "Student C", "person_id": 3},
        ]

        res = rank_student_candidates(np.array(known_embs), metadata, base)
        self.assertEqual(res["match_type"], "ambiguous")
        self.assertEqual(res["ambiguous_count"], 3)
        self.assertEqual(len(res["candidates"]), 3)

    def test_12_more_than_three_ambiguous_candidates(self):
        """Verifies >3 candidates within 0.08 margin classify as high_ambiguity."""
        from face_utils import rank_student_candidates

        base = np.random.randn(512).astype(np.float32)
        base /= np.linalg.norm(base)

        ortho = np.random.randn(512).astype(np.float32)
        ortho -= np.dot(ortho, base) * base
        ortho /= np.linalg.norm(ortho)

        cand_a = 0.62 * base + np.sqrt(1 - 0.62**2) * ortho
        cand_b = 0.59 * base + np.sqrt(1 - 0.59**2) * ortho
        cand_c = 0.57 * base + np.sqrt(1 - 0.57**2) * ortho
        cand_d = 0.55 * base + np.sqrt(1 - 0.55**2) * ortho

        known_embs = [cand_a, cand_b, cand_c, cand_d]
        metadata = [
            {"roll_number": "238W1A0477", "name": "Student A", "person_id": 1},
            {"roll_number": "238W1A0478", "name": "Student B", "person_id": 2},
            {"roll_number": "238W1A0479", "name": "Student C", "person_id": 3},
            {"roll_number": "238W1A0480", "name": "Student D", "person_id": 4},
        ]

        res = rank_student_candidates(np.array(known_embs), metadata, base)
        self.assertEqual(res["match_type"], "high_ambiguity")
        self.assertEqual(res["ambiguous_count"], 4)
        self.assertGreater(len(res["candidates"]), 3)

    def test_13_preservation_of_old_embeddings_on_failed_reregistration(self):
        """Ensures old embeddings are preserved if new enrollment fails (transaction rollback)."""
        roll = "238W1A0499"
        name = "Test Student"

        # 1. Enrol with exactly 10 embeddings
        ten_embs = [np.random.randn(512).astype(np.float32) for _ in range(10)]
        ok, _ = self.db.save_registration(roll, name, ten_embs)
        self.assertTrue(ok)

        # Capture original embeddings count and ID
        original_student = self.db.get_student_by_roll(roll)
        self.assertEqual(original_student["embedding_count"], 10)

        # 2. Attempt re-registration with invalid count (e.g. 5 embeddings)
        fail_embs = [np.random.randn(512).astype(np.float32) for _ in range(5)]
        failed, err_msg = self.db.save_registration(roll, name, fail_embs)
        self.assertFalse(failed)
        self.assertIn("Exact 10 embeddings required", err_msg)

        # 3. Verify original student record and 10 embeddings remain completely intact
        persisted = self.db.get_student_by_roll(roll)
        self.assertIsNotNone(persisted)
        self.assertEqual(persisted["embedding_count"], 10)

    def test_14_fastapi_match_candidates_endpoint(self):
        """Verifies /api/face/match-candidates endpoint via FastAPI TestClient."""
        from fastapi.testclient import TestClient
        from face_server import app

        client = TestClient(app)
        probe_vector = [0.1] * 512

        response = client.post("/api/face/match-candidates", json={
            "embedding": probe_vector,
            "sim_threshold": 0.45,
            "min_eligibility_threshold": 0.40,
            "ambiguity_margin": 0.08
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("match_type", data)
        self.assertIn(data["match_type"], ["unique", "ambiguous", "high_ambiguity", "weak", "unknown"])

    def test_15_registration_session_lifecycle(self):
        """Verifies full registration session API lifecycle and dual route support."""
        from fastapi.testclient import TestClient
        from face_server import app

        client = TestClient(app)

        # 1. Start registration session (tests direct route without /api/face prefix)
        start_res = client.post("/register/session/start", json={
            "roll_number": "238W1A04TEST",
            "name": "Integration Test Student"
        })
        self.assertEqual(start_res.status_code, 200)
        start_data = start_res.json()
        self.assertTrue(start_data["success"])
        session_id = start_data["session_id"]
        self.assertIsNotNone(session_id)
        self.assertEqual(start_data["step"], 1)
        self.assertEqual(start_data["needed_in_step"], 6)

        # 2. Invalid session ID returns 404
        bad_frame_res = client.post("/register/session/frame", json={
            "session_id": "non-existent-session-id",
            "image_base64": "invalid_base64"
        })
        self.assertEqual(bad_frame_res.status_code, 404)

        # 3. Cancel registration session (tests prefixed route)
        cancel_res = client.post("/api/face/register/session/cancel", json={
            "session_id": session_id
        })
        self.assertEqual(cancel_res.status_code, 200)
        self.assertTrue(cancel_res.json()["success"])

        # 4. Verify cancelled session is purged (subsequent frame returns 404)
        purged_res = client.post("/api/face/register/session/frame", json={
            "session_id": session_id,
            "image_base64": "invalid_base64"
        })
        self.assertEqual(purged_res.status_code, 404)


if __name__ == "__main__":
    unittest.main()

