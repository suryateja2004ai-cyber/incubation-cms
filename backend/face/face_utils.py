"""
Utility classes and helpers for Face Recognition & Head Pose Estimation.
Compatible with InsightFace buffalo_l and SQLite biometric storage.
"""

import os
import math
import sqlite3
import base64
import numpy as np
import cv2
from typing import Optional, Tuple, Dict, Any, List
from datetime import datetime

# Default database location pointing to existing face_detector project
DEFAULT_DB_PATH = os.environ.get(
    "FACE_DB_PATH",
    r"C:\Users\Asus\face_detector\data\attendance.db"
)


class FastHeadPoseEstimator:
    """
    Ultra-fast 2D landmark head pose estimation using eye, nose, and mouth geometry.
    Returns: success, pitch_deg, yaw_deg, roll_deg
    """
    def __init__(self, alpha: float = 0.55):
        self.smooth_pitch = None
        self.smooth_yaw = None
        self.smooth_roll = None
        self.alpha = alpha

    def reset(self):
        self.smooth_pitch = None
        self.smooth_yaw = None
        self.smooth_roll = None

    def estimate(self, kps: Optional[np.ndarray]) -> Tuple[bool, float, float, float]:
        if kps is None or len(kps) != 5:
            return False, 0.0, 0.0, 0.0

        pts = np.array(kps, dtype=np.float64)
        le, re, nose, lm, rm = pts[0], pts[1], pts[2], pts[3], pts[4]

        # Roll: eye horizontal angle
        d_eye = re - le
        roll_raw = math.degrees(math.atan2(d_eye[1], d_eye[0]))

        # Yaw: horizontal nose offset relative to eye midpoint
        eye_width = max(1.0, np.linalg.norm(re - le))
        eye_unit = (re - le) / eye_width
        eye_mid = (le + re) / 2.0
        h_offset = np.dot(nose - eye_mid, eye_unit)
        yaw_ratio = h_offset / (eye_width / 2.0)
        yaw_raw = float(np.clip(yaw_ratio * 45.0, -60.0, 60.0))

        # Pitch: vertical nose displacement ratio relative to eyes and mouth
        mouth_mid = (lm + rm) / 2.0
        dist_eye_nose = np.linalg.norm(nose - eye_mid)
        dist_nose_mouth = np.linalg.norm(mouth_mid - nose)
        total_v = dist_eye_nose + dist_nose_mouth

        if total_v > 1e-3:
            v_ratio = dist_eye_nose / total_v
            pitch_raw = float(np.clip((v_ratio - 0.490) * 110.0, -50.0, 50.0))
        else:
            pitch_raw = 0.0

        if self.smooth_pitch is None:
            self.smooth_pitch = pitch_raw
            self.smooth_yaw = yaw_raw
            self.smooth_roll = roll_raw
        else:
            self.smooth_pitch = self.alpha * pitch_raw + (1.0 - self.alpha) * self.smooth_pitch
            self.smooth_yaw   = self.alpha * yaw_raw   + (1.0 - self.alpha) * self.smooth_yaw
            self.smooth_roll  = self.alpha * roll_raw  + (1.0 - self.alpha) * self.smooth_roll

        return True, float(self.smooth_pitch), float(self.smooth_yaw), float(self.smooth_roll)


class BiometricDatabaseManager:
    """
    Thread-safe SQLite manager for persons, face_embeddings, and attendance.
    Ensures cascading deletion, transactional registration, and vector serialization.
    """
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS persons (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    roll_number TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS face_embeddings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    person_id INTEGER NOT NULL,
                    embedding BLOB NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE CASCADE
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS attendance (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    person_id INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    UNIQUE(person_id, date),
                    FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE CASCADE
                )
            """)
            conn.commit()
        finally:
            conn.close()

    def load_known_faces(self) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT p.id, p.roll_number, p.name, fe.embedding
                FROM persons p
                JOIN face_embeddings fe ON p.id = fe.person_id
            """)
            rows = cur.fetchall()

            if not rows:
                return np.empty((0, 512), dtype=np.float32), []

            embeddings = []
            metadata = []
            for person_id, roll_number, name, emb_blob in rows:
                emb = np.frombuffer(emb_blob, dtype=np.float32)
                norm = np.linalg.norm(emb)
                if norm > 1e-6:
                    emb = emb / norm
                embeddings.append(emb)
                metadata.append({
                    "person_id": person_id,
                    "roll_number": roll_number.strip().upper(),
                    "name": name.strip(),
                })

            return np.vstack(embeddings).astype(np.float32), metadata
        finally:
            conn.close()

    def get_registered_students(self) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT p.id, p.roll_number, p.name, p.created_at, COUNT(fe.id) as emb_count
                FROM persons p
                LEFT JOIN face_embeddings fe ON p.id = fe.person_id
                GROUP BY p.id
                ORDER BY p.name ASC
            """)
            rows = cur.fetchall()
            return [
                {
                    "id": row[0],
                    "roll_number": row[1].strip().upper(),
                    "name": row[2].strip(),
                    "created_at": row[3],
                    "embedding_count": row[4],
                }
                for row in rows
            ]
        finally:
            conn.close()

    def get_student_by_roll(self, roll_number: str) -> Optional[Dict[str, Any]]:
        clean_roll = roll_number.strip().upper()
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT p.id, p.roll_number, p.name, p.created_at, COUNT(fe.id) as emb_count
                FROM persons p
                LEFT JOIN face_embeddings fe ON p.id = fe.person_id
                WHERE UPPER(p.roll_number) = ?
                GROUP BY p.id
            """, (clean_roll,))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "id": row[0],
                "roll_number": row[1].strip().upper(),
                "name": row[2].strip(),
                "created_at": row[3],
                "embedding_count": row[4],
            }
        finally:
            conn.close()

    def save_registration(self, roll_number: str, name: str, embeddings: List[np.ndarray]) -> Tuple[bool, str]:
        """
        Atomically saves person and embeddings in a single SQLite transaction.
        Enforces exactly 10 embeddings per student rule.
        """
        clean_roll = roll_number.strip().upper()
        clean_name = name.strip()

        if len(clean_roll) != 10:
            return False, "Student Roll Number must be strictly 10 characters."

        if len(embeddings) != 10:
            return False, f"Exact 10 embeddings required. Received {len(embeddings)}."

        conn = self._get_connection()
        try:
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cur = conn.cursor()
            conn.execute("BEGIN TRANSACTION")

            # Check if student already exists; if so, replace existing profile
            cur.execute("SELECT id FROM persons WHERE UPPER(roll_number) = ?", (clean_roll,))
            existing = cur.fetchone()
            if existing:
                person_id = existing[0]
                cur.execute("DELETE FROM face_embeddings WHERE person_id = ?", (person_id,))
                cur.execute("UPDATE persons SET name = ?, created_at = ? WHERE id = ?", (clean_name, now_str, person_id))
            else:
                cur.execute(
                    "INSERT INTO persons (roll_number, name, created_at) VALUES (?, ?, ?)",
                    (clean_roll, clean_name, now_str)
                )
                person_id = cur.lastrowid

            for emb in embeddings:
                norm = np.linalg.norm(emb)
                if norm > 1e-6:
                    normalized_emb = emb / norm
                else:
                    normalized_emb = emb
                blob_data = normalized_emb.astype(np.float32).tobytes()
                cur.execute(
                    "INSERT INTO face_embeddings (person_id, embedding, created_at) VALUES (?, ?, ?)",
                    (person_id, blob_data, now_str)
                )

            conn.commit()
            return True, f"Successfully saved {len(embeddings)} embeddings for {clean_name} ({clean_roll})."
        except Exception as e:
            conn.rollback()
            return False, str(e)
        finally:
            conn.close()

    def delete_student_biometrics(self, roll_number: str) -> Tuple[bool, str]:
        clean_roll = roll_number.strip().upper()
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT id, name FROM persons WHERE UPPER(roll_number) = ?", (clean_roll,))
            row = cur.fetchone()
            if not row:
                return False, f"Student with roll number '{clean_roll}' not found."

            person_id, name = row[0], row[1]
            conn.execute("BEGIN TRANSACTION")
            cur.execute("DELETE FROM face_embeddings WHERE person_id = ?", (person_id,))
            cur.execute("DELETE FROM attendance WHERE person_id = ?", (person_id,))
            cur.execute("DELETE FROM persons WHERE id = ?", (person_id,))
            conn.commit()
            return True, f"Biometric records for {name} ({clean_roll}) permanently deleted."
        except Exception as e:
            conn.rollback()
            return False, str(e)
        finally:
            conn.close()


def decode_image_base64(image_data: str) -> Optional[np.ndarray]:
    """
    Decodes data URI or raw base64 string directly into BGR OpenCV image in memory.
    The frame is NOT saved to disk or persistent storage.
    """
    try:
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        raw_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(raw_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None


def rank_student_candidates(
    known_embeddings: np.ndarray,
    metadata: List[Dict[str, Any]],
    query_embedding: np.ndarray,
    min_eligibility_threshold: float = 0.30,
    positive_match_threshold: float = 0.38,
    ambiguity_margin: float = 0.08,
) -> Dict[str, Any]:
    """
    Ranks enrolled student candidates against a query face embedding using cosine similarity.
    Evaluates:
    - Peak similarity per unique student.
    - Ambiguity status based on similarity spread.
    - Returns match_type: 'unique' | 'ambiguous' | 'high_ambiguity' | 'weak' | 'unknown'.
    """
    if len(known_embeddings) == 0 or len(metadata) == 0:
        return {
            "match_type": "unknown",
            "top_candidate": None,
            "candidates": [],
            "all_eligible_count": 0,
            "ambiguous_count": 0,
        }

    q_emb = np.asarray(query_embedding, dtype=np.float32).flatten()
    q_norm = np.linalg.norm(q_emb)
    if q_norm > 1e-6:
        q_emb = q_emb / q_norm

    sims = np.dot(known_embeddings, q_emb)

    # Group similarities by student (each student can have up to 10 or 20 embeddings)
    student_peaks: Dict[str, Dict[str, Any]] = {}
    for idx, meta in enumerate(metadata):
        roll = meta["roll_number"].strip().upper()
        score = float(sims[idx])
        if roll not in student_peaks or score > student_peaks[roll]["similarity"]:
            student_peaks[roll] = {
                "roll_number": roll,
                "name": meta["name"].strip(),
                "person_id": meta.get("person_id"),
                "similarity": round(score, 4),
            }

    # Filter by minimum eligibility threshold (0.40) and sort descending
    eligible_candidates = [
        c for c in student_peaks.values() if c["similarity"] >= min_eligibility_threshold
    ]
    eligible_candidates.sort(key=lambda c: c["similarity"], reverse=True)

    if not eligible_candidates:
        return {
            "match_type": "unknown",
            "top_candidate": None,
            "candidates": [],
            "all_eligible_count": 0,
            "ambiguous_count": 0,
        }

    top_candidate = eligible_candidates[0]
    top_score = top_candidate["similarity"]

    # If even the top candidate does not reach positive match threshold (0.45) -> weak match
    if top_score < positive_match_threshold:
        return {
            "match_type": "weak",
            "top_candidate": top_candidate,
            "candidates": eligible_candidates,
            "all_eligible_count": len(eligible_candidates),
            "ambiguous_count": len(eligible_candidates),
        }

    # Identify candidates within ambiguity margin of the top match
    ambiguous_candidates = [
        c for c in eligible_candidates if (top_score - c["similarity"]) <= ambiguity_margin
    ]

    amb_count = len(ambiguous_candidates)

    if amb_count == 1:
        match_type = "unique"
    elif amb_count <= 3:
        match_type = "ambiguous"
    else:
        match_type = "high_ambiguity"

    return {
        "match_type": match_type,
        "top_candidate": top_candidate,
        "candidates": ambiguous_candidates,
        "all_eligible_count": len(eligible_candidates),
        "ambiguous_count": amb_count,
    }

