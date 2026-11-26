"""
Local Face Recognition FastAPI Server for Smart Incubation CMS.
Runs locally on http://127.0.0.1:8001.
Reuses InsightFace buffalo_l & SQLite attendance.db.
Zero biometric image retention - strictly in-memory processing.
"""

import os
import sys
import time
import uuid
import threading
from typing import Optional, List, Dict, Any
import numpy as np
import cv2
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure local face_detector path is accessible if available
FACE_DETECTOR_DIR = r"C:\Users\Asus\face_detector"
if os.path.exists(FACE_DETECTOR_DIR) and FACE_DETECTOR_DIR not in sys.path:
    sys.path.insert(0, FACE_DETECTOR_DIR)

# Import local utilities
from face_utils import (
    FastHeadPoseEstimator,
    BiometricDatabaseManager,
    decode_image_base64,
    DEFAULT_DB_PATH,
    rank_student_candidates,
)

app = FastAPI(
    title="Smart Incubation Face Recognition Service",
    description="Local biometric service powering face registration and live attendance matching.",
    version="1.0.0"
)

# Strict localhost CORS configuration
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS")
if allowed_origins_env:
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    allowed_origins = [
        "https://incubation-cms.pages.dev",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.pages\.dev",
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ==============================================================================
# 1. INITIALIZE FACE ENGINE & DATABASE
# ==============================================================================
db_manager = BiometricDatabaseManager(DEFAULT_DB_PATH)

print(f"[FACE SERVER] Initializing SQLite Biometric Database at: {db_manager.db_path}")

# In-memory known embeddings cache
known_embeddings = np.empty((0, 512), dtype=np.float32)
known_metadata: List[Dict[str, Any]] = []
cache_lock = threading.Lock()

def reload_known_faces():
    global known_embeddings, known_metadata
    with cache_lock:
        embs, meta = db_manager.load_known_faces()
        known_embeddings = embs
        known_metadata = meta
        unique_rolls = len(set(m["roll_number"] for m in meta))
        print(f"[FACE SERVER] Reloaded {len(embs)} template embeddings across {unique_rolls} registered students.")

# Load initial cache
reload_known_faces()

# Initialize InsightFace model
face_analysis_app = None
model_init_lock = threading.Lock()

def get_face_engine():
    global face_analysis_app
    if face_analysis_app is None:
        with model_init_lock:
            if face_analysis_app is None:
                print("[FACE SERVER] Loading InsightFace buffalo_l model on CPU...")
                import insightface
                from insightface.app import FaceAnalysis
                app_instance = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
                app_instance.prepare(ctx_id=0, det_size=(256, 256))
                face_analysis_app = app_instance
                print("[FACE SERVER] InsightFace buffalo_l loaded successfully and ready.")
    return face_analysis_app

# Warm up model on startup if insightface is installed
try:
    get_face_engine()
except Exception as e:
    print(f"[FACE SERVER WARNING] InsightFace initialization error: {e}")

# ==============================================================================
# 2. EXACT 10-EMBEDDING REGISTRATION SESSION MANAGER
# ==============================================================================
REGISTRATION_STEPS = [
    {
        "name": "Look Straight",
        "target_pose": "straight",
        "needed": 6,
        "description": "Please look directly at the camera."
    },
    {
        "name": "Turn Slightly Left",
        "target_pose": "slight_left",
        "needed": 2,
        "description": "Turn your head slightly to your left."
    },
    {
        "name": "Turn Slightly Right",
        "target_pose": "slight_right",
        "needed": 2,
        "description": "Turn your head slightly to your right."
    },
]
TOTAL_REQUIRED_EMBEDDINGS = 10  # 6 + 2 + 2

active_sessions: Dict[str, Dict[str, Any]] = {}
session_lock = threading.Lock()

def cleanup_stale_sessions():
    now = time.time()
    with session_lock:
        expired = [sid for sid, s in active_sessions.items() if now - s.get("created_at", now) > 600]
        for sid in expired:
            del active_sessions[sid]

# ==============================================================================
# 3. REQUEST / RESPONSE SCHEMAS
# ==============================================================================
class StartSessionRequest(BaseModel):
    roll_number: str
    name: str

class FrameSessionRequest(BaseModel):
    session_id: str
    image_base64: str

class CancelSessionRequest(BaseModel):
    session_id: str

class DirectRegisterRequest(BaseModel):
    roll_number: str
    name: str
    embeddings: List[List[float]] = Field(..., description="List of exactly 10 512-dim embedding vectors")

class RecognizeFrameRequest(BaseModel):
    image_base64: str
    sim_threshold: float = 0.38
    min_eligibility_threshold: float = 0.30
    ambiguity_margin: float = 0.08

class CandidateMatchTestRequest(BaseModel):
    embedding: List[float]
    sim_threshold: float = 0.38
    min_eligibility_threshold: float = 0.30
    ambiguity_margin: float = 0.08

# ==============================================================================
# 4. API ENDPOINTS
# ==============================================================================

@app.get("/health")
@app.get("/api/face/health")
def health_check():
    """Returns status of face service, InsightFace engine, and SQLite database."""
    engine_ready = face_analysis_app is not None
    students = db_manager.get_registered_students()
    total_embeddings = len(known_embeddings)
    return {
        "status": "online",
        "service": "face_recognition",
        "engine_ready": engine_ready,
        "model": "buffalo_l",
        "providers": ["CPUExecutionProvider"],
        "database": {
            "path": db_manager.db_path,
            "exists": os.path.exists(db_manager.db_path),
            "registered_students_count": len(students),
            "total_embeddings_count": total_embeddings,
        },
        "registration_rule": {
            "total_embeddings_per_student": TOTAL_REQUIRED_EMBEDDINGS,
            "steps": REGISTRATION_STEPS,
        },
    }

@app.get("/api/students")
@app.get("/api/face/students")
def list_registered_students():
    """Lists all students with enrolled biometric face profiles. Does not expose raw embeddings."""
    students = db_manager.get_registered_students()
    return {
        "success": True,
        "students": students,
        "count": len(students)
    }

@app.get("/api/students/{roll_number}")
@app.get("/api/face/students/{roll_number}")
def get_student_biometrics(roll_number: str):
    """Checks if a student has registered biometric embeddings."""
    student = db_manager.get_student_by_roll(roll_number)
    if not student:
        return {
            "registered": False,
            "roll_number": roll_number.strip().upper(),
            "embedding_count": 0,
        }
    return {
        "registered": True,
        "roll_number": student["roll_number"],
        "name": student["name"],
        "created_at": student["created_at"],
        "embedding_count": student["embedding_count"],
    }

@app.delete("/api/students/{roll_number}")
@app.delete("/api/face/students/{roll_number}")
def delete_student_biometrics(roll_number: str):
    """Deletes all biometric embeddings and person record for a student."""
    success, msg = db_manager.delete_student_biometrics(roll_number)
    if not success:
        raise HTTPException(status_code=404, detail=msg)
    reload_known_faces()
    return {
        "success": True,
        "message": msg,
        "roll_number": roll_number.strip().upper(),
    }

# --- REGISTRATION SESSION FLOW ---

@app.post("/register/session/start")
@app.post("/api/face/register/session/start")
def start_registration_session(req: StartSessionRequest):
    """Initializes a new atomic registration session enforcing 10 embeddings."""
    cleanup_stale_sessions()
    clean_roll = req.roll_number.strip().upper()
    clean_name = req.name.strip()

    if not clean_roll or not clean_name:
        raise HTTPException(status_code=400, detail="Student Roll Number and Name are required.")
    if len(clean_roll) != 10:
        raise HTTPException(status_code=400, detail="Student Roll Number must be strictly 10 characters (e.g. 238W1A0477).")

    session_id = str(uuid.uuid4())
    session_data = {
        "session_id": session_id,
        "roll_number": clean_roll,
        "name": clean_name,
        "created_at": time.time(),
        "step_idx": 0,
        "step_captured": 0,
        "total_captured": 0,
        "embeddings": [],
        "pose_estimator": FastHeadPoseEstimator(),
        "baseline_samples": [],
        "baseline_pose": None,
        "last_capture_time": 0.0,
    }

    with session_lock:
        # Purge any previous sessions for the same student roll number
        stale_sids = [sid for sid, s in active_sessions.items() if s.get("roll_number") == clean_roll]
        for sid in stale_sids:
            del active_sessions[sid]
        active_sessions[session_id] = session_data

    print(f"[FACE SERVER] Session started: {session_id[:8]} for student {clean_name} ({clean_roll})")

    first_step = REGISTRATION_STEPS[0]
    return {
        "success": True,
        "session_id": session_id,
        "roll_number": clean_roll,
        "name": clean_name,
        "step": 1,
        "total_steps": len(REGISTRATION_STEPS),
        "target_pose": first_step["target_pose"],
        "step_name": first_step["name"],
        "needed_in_step": first_step["needed"],
        "captured_in_step": 0,
        "total_captured": 0,
        "total_needed": TOTAL_REQUIRED_EMBEDDINGS,
        "instruction": first_step["description"],
    }

@app.post("/register/session/frame")
@app.post("/api/face/register/session/frame")
def process_registration_frame(req: FrameSessionRequest):
    """
    Ingests one webcam frame in memory.
    Evaluates head pose and face dimensions.
    If matching current step criteria, captures 512-dim embedding without storing image.
    When 10 embeddings are collected, commits atomically to database.
    """
    with session_lock:
        session = active_sessions.get(req.session_id)
    if not session:
        print(f"[FACE SERVER WARNING] Frame rejected: Session '{req.session_id}' not found or expired.")
        raise HTTPException(status_code=404, detail="Registration session expired or not found. Please restart.")

    img = decode_image_base64(req.image_base64)
    if img is None:
        print(f"[FACE SERVER WARNING] Session {req.session_id[:8]}: Base64 decoding failed.")
        raise HTTPException(status_code=400, detail="Invalid image frame base64 encoding.")

    engine = get_face_engine()
    if engine is None:
        raise HTTPException(status_code=500, detail="Face engine unavailable.")

    h, w = img.shape[:2]
    faces = engine.get(img)

    # No face detected
    if not faces:
        return {
            "success": True,
            "face_detected": False,
            "feedback": "No face detected. Center your face in the camera.",
            "completed": False,
            "step": session["step_idx"] + 1,
            "total_steps": len(REGISTRATION_STEPS),
            "total_captured": session["total_captured"],
            "total_needed": TOTAL_REQUIRED_EMBEDDINGS,
        }

    # Pick largest face
    faces_sorted = sorted(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
    main_face = faces_sorted[0]
    bbox = [int(v) for v in main_face.bbox]

    face_w = bbox[2] - bbox[0]
    face_h = bbox[3] - bbox[1]
    if min(face_w, face_h) < 35:
        return {
            "success": True,
            "face_detected": True,
            "bbox": bbox,
            "feedback": "Move slightly closer to the camera.",
            "completed": False,
            "step": session["step_idx"] + 1,
            "total_steps": len(REGISTRATION_STEPS),
            "total_captured": session["total_captured"],
            "total_needed": TOTAL_REQUIRED_EMBEDDINGS,
        }

    # Pose estimation
    estimator = session["pose_estimator"]
    has_pose, pitch, yaw, roll = estimator.estimate(main_face.kps)
    if not has_pose:
        return {
            "success": True,
            "face_detected": True,
            "bbox": bbox,
            "feedback": "Face landmarks unclear. Ensure good lighting.",
            "completed": False,
            "step": session["step_idx"] + 1,
            "total_steps": len(REGISTRATION_STEPS),
            "total_captured": session["total_captured"],
            "total_needed": TOTAL_REQUIRED_EMBEDDINGS,
        }

    # Automatically sample user resting baseline during initial straight frames (matching register.py)
    if session["step_idx"] == 0 and len(session["baseline_samples"]) < 2:
        session["baseline_samples"].append((pitch, yaw, roll))
        bp = sum(s[0] for s in session["baseline_samples"]) / len(session["baseline_samples"])
        by = sum(s[1] for s in session["baseline_samples"]) / len(session["baseline_samples"])
        br = sum(s[2] for s in session["baseline_samples"]) / len(session["baseline_samples"])
        session["baseline_pose"] = (bp, by, br)

    base_p, base_y, base_r = session["baseline_pose"] or (pitch, yaw, roll)
    rel_pitch = pitch - base_p
    rel_yaw   = yaw - base_y
    rel_roll  = roll - base_r

    current_step = REGISTRATION_STEPS[session["step_idx"]]
    target_pose = current_step["target_pose"]

    pose_correct = False
    guidance = ""

    if target_pose == "straight":
        # Straight-pose: relative to user's natural resting baseline or standard frontal webcam angle
        is_straight = (abs(rel_yaw) <= 18.0 and abs(rel_pitch) <= 20.0) or (abs(yaw) <= 18.0 and abs(pitch) <= 25.0)
        if is_straight:
            pose_correct = True
            # Adapt resting straight baseline smoothly
            bp, by, br = session["baseline_pose"] or (pitch, yaw, roll)
            session["baseline_pose"] = (0.8 * bp + 0.2 * pitch, 0.8 * by + 0.2 * yaw, 0.8 * br + 0.2 * roll)
        else:
            guidance = "Look directly at the camera."

    elif target_pose == "slight_left":
        # Left turn: negative yaw in mirrored webcam space
        if rel_yaw <= -3.5 or yaw <= -4.0:
            pose_correct = True
        else:
            guidance = "Turn your head slightly to your left."

    elif target_pose == "slight_right":
        # Right turn: positive yaw in mirrored webcam space
        if rel_yaw >= 3.5 or yaw >= 4.0:
            pose_correct = True
        else:
            guidance = "Turn your head slightly to your right."

    now = time.time()
    captured_this_frame = False

    if not pose_correct:
        print(
            f"[FACE SERVER] Session {req.session_id[:8]} [Step {session['step_idx']+1}: {target_pose}] "
            f"Face={face_w}x{face_h} | pitch={pitch:.1f}, yaw={yaw:.1f} (base_y={base_y:.1f}, rel_y={rel_yaw:.1f}, rel_p={rel_pitch:.1f}) "
            f"-> waiting ({guidance or current_step['description']})"
        )

    if pose_correct:
        # Minimum burst interval between captures (90ms)
        if now - session["last_capture_time"] >= 0.09:
            raw_emb = main_face.embedding.flatten().astype(np.float32)
            if raw_emb.shape == (512,) and np.all(np.isfinite(raw_emb)):
                norm = float(np.linalg.norm(raw_emb))
                if norm > 1e-6:
                    norm_emb = raw_emb / norm
                else:
                    norm_emb = raw_emb

                session["embeddings"].append(norm_emb)
                session["step_captured"] += 1
                session["total_captured"] += 1
                session["last_capture_time"] = now
                captured_this_frame = True

                print(
                    f"[FACE SERVER] Capture accepted: {session['total_captured']}/{TOTAL_REQUIRED_EMBEDDINGS} "
                    f"({current_step['name']} {session['step_captured']}/{current_step['needed']}) "
                    f"| yaw={yaw:.1f}, pitch={pitch:.1f}, shape={norm_emb.shape}, finite=True, norm={norm:.4f}"
                )

                # Advance step if step quota met
                if session["step_captured"] >= current_step["needed"]:
                    session["step_idx"] += 1
                    session["step_captured"] = 0

    # Check if all 10 embeddings have been collected
    if session["total_captured"] >= TOTAL_REQUIRED_EMBEDDINGS:
        all_embs = session["embeddings"][:TOTAL_REQUIRED_EMBEDDINGS]
        print(f"[FACE SERVER] All 10 embeddings captured! Committing to SQLite attendance.db for {session['name']} ({session['roll_number']})...")
        success, msg = db_manager.save_registration(
            session["roll_number"],
            session["name"],
            all_embs
        )
        # Clear session
        with session_lock:
            if req.session_id in active_sessions:
                del active_sessions[req.session_id]

        if not success:
            print(f"[FACE SERVER ERROR] Database commit failed: {msg}")
            raise HTTPException(status_code=500, detail=f"Database commit failed: {msg}")

        reload_known_faces()
        print(f"[FACE SERVER SUCCESS] Successfully saved 10 embeddings for {session['name']} ({session['roll_number']}). Profile active.")
        return {
            "success": True,
            "face_detected": True,
            "bbox": bbox,
            "completed": True,
            "total_captured": TOTAL_REQUIRED_EMBEDDINGS,
            "total_needed": TOTAL_REQUIRED_EMBEDDINGS,
            "message": f"Student {session['name']} ({session['roll_number']}) registered successfully with 10 embeddings!",
        }

    active_step_info = REGISTRATION_STEPS[session["step_idx"]]
    return {
        "success": True,
        "face_detected": True,
        "bbox": bbox,
        "completed": False,
        "captured_this_frame": captured_this_frame,
        "step": session["step_idx"] + 1,
        "total_steps": len(REGISTRATION_STEPS),
        "target_pose": active_step_info["target_pose"],
        "step_name": active_step_info["name"],
        "needed_in_step": active_step_info["needed"],
        "captured_in_step": session["step_captured"],
        "total_captured": session["total_captured"],
        "total_needed": TOTAL_REQUIRED_EMBEDDINGS,
        "pose": {
            "pitch": round(pitch, 1),
            "yaw": round(yaw, 1),
            "roll": round(roll, 1),
            "rel_yaw": round(rel_yaw, 1),
        },
        "pose_correct": pose_correct,
        "feedback": "Hold still, capturing..." if pose_correct else (guidance or active_step_info["description"]),
    }

@app.post("/register/session/cancel")
@app.post("/api/face/register/session/cancel")
def cancel_registration_session(req: CancelSessionRequest):
    """Cancels registration session and purges all captured embeddings from memory."""
    with session_lock:
        if req.session_id in active_sessions:
            del active_sessions[req.session_id]
    print(f"[FACE SERVER] Registration session {req.session_id[:8]} cancelled.")
    return {"success": True, "message": "Registration session cancelled. Memory purged."}

@app.post("/api/face/register/direct")
def register_direct(req: DirectRegisterRequest):
    """
    Direct registration endpoint with exactly 10 512-dim embedding vectors.
    Useful for testing, backups, and scripted enrollments.
    """
    clean_roll = req.roll_number.strip().upper()
    if len(clean_roll) != 10:
        raise HTTPException(status_code=400, detail="Student Roll Number must be strictly 10 characters.")

    if len(req.embeddings) != TOTAL_REQUIRED_EMBEDDINGS:
        raise HTTPException(
            status_code=400,
            detail=f"Exactly {TOTAL_REQUIRED_EMBEDDINGS} embeddings required. Got {len(req.embeddings)}."
        )

    emb_arrays = [np.array(e, dtype=np.float32) for e in req.embeddings]
    for i, e in enumerate(emb_arrays):
        if e.shape != (512,):
            raise HTTPException(
                status_code=400,
                detail=f"Embedding index {i} invalid dimension {e.shape}. Must be 512 floats."
            )

    success, msg = db_manager.save_registration(req.roll_number, req.name, emb_arrays)
    if not success:
        raise HTTPException(status_code=500, detail=msg)

    reload_known_faces()
    return {
        "success": True,
        "message": msg,
        "roll_number": req.roll_number.strip().upper(),
        "embeddings_count": len(emb_arrays),
    }

# --- LIVE RECOGNITION FLOW ---

@app.post("/api/recognize")
@app.post("/recognize")
@app.post("/api/face/recognize")
@app.post("/api/face/recognize-frame")
def recognize_frame(req: RecognizeFrameRequest):
    """
    Processes a webcam frame in memory.
    Detects all visible faces and matches against enrolled SQLite embeddings.
    Zero image retention - frame is discarded upon response.
    """
    img = decode_image_base64(req.image_base64)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid frame base64 string.")

    engine = get_face_engine()
    if engine is None:
        raise HTTPException(status_code=500, detail="Face engine not loaded.")

    start_t = time.time()
    faces = engine.get(img)
    latency_ms = round((time.time() - start_t) * 1000, 1)

    if not faces:
        return {
            "success": True,
            "count": 0,
            "faces": [],
            "primary_face": None,
            "latency_ms": latency_ms,
            "message": "No face detected.",
        }

    detections = []
    with cache_lock:
        current_known_embs = known_embeddings
        current_meta = known_metadata

    for face in faces:
        bbox = [int(v) for v in face.bbox]
        area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])

        emb = face.embedding.flatten().astype(np.float32)
        norm = np.linalg.norm(emb)
        if norm > 1e-6:
            emb = emb / norm

        matched_student = None
        max_score = 0.0

        ranking = rank_student_candidates(
            current_known_embs,
            current_meta,
            emb,
            min_eligibility_threshold=req.min_eligibility_threshold,
            positive_match_threshold=req.sim_threshold,
            ambiguity_margin=req.ambiguity_margin,
        )

        top_cand = ranking["top_candidate"]
        match_type = ranking["match_type"]
        candidates = ranking["candidates"]
        amb_count = ranking["ambiguous_count"]

        if match_type in ["unique", "ambiguous", "high_ambiguity"]:
            detections.append({
                "bbox": bbox,
                "area": area,
                "is_known": True,
                "roll_number": top_cand["roll_number"],
                "name": top_cand["name"],
                "similarity": top_cand["similarity"],
                "status": "recognized" if match_type == "unique" else "ambiguous",
                "match_type": match_type,
                "candidates": candidates,
                "ambiguous_count": amb_count,
            })
        else:
            detections.append({
                "bbox": bbox,
                "area": area,
                "is_known": False,
                "roll_number": None,
                "name": "Unknown Person",
                "similarity": top_cand["similarity"] if top_cand else 0.0,
                "status": "unknown",
                "match_type": match_type,
                "candidates": [],
                "ambiguous_count": 0,
            })

    # Sort faces by area (largest / closest first)
    detections.sort(key=lambda d: d["area"], reverse=True)
    primary = detections[0] if detections else None

    warning = None
    if len(detections) > 1:
        warning = f"{len(detections)} faces visible. Matching primary centered person."

    return {
        "success": True,
        "count": len(detections),
        "faces": detections,
        "primary_face": primary,
        "warning": warning,
        "latency_ms": latency_ms,
    }


@app.post("/api/face/match-candidates")
def match_candidates_direct(req: CandidateMatchTestRequest):
    """
    Direct candidate ranking and ambiguity evaluation for a given 512-dim embedding.
    Does not require webcam video frames.
    """
    with cache_lock:
        current_known_embs = known_embeddings
        current_meta = known_metadata

    ranking = rank_student_candidates(
        current_known_embs,
        current_meta,
        np.array(req.embedding, dtype=np.float32),
        min_eligibility_threshold=req.min_eligibility_threshold,
        positive_match_threshold=req.sim_threshold,
        ambiguity_margin=req.ambiguity_margin,
    )
    return {
        "success": True,
        **ranking
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("face_server:app", host="127.0.0.1", port=8001, reload=False)
