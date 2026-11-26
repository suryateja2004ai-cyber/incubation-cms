# Local Face Recognition & Attendance Service

Local biometric microservice powering AI face registration and live attendance recognition for the Smart Incubation Centre Management System.

## Architecture

- **Engine:** InsightFace (`buffalo_l` model with ONNX Runtime on CPU)
- **Framework:** FastAPI + Uvicorn
- **Default Port:** `127.0.0.1:8001`
- **Database:** SQLite (`attendance.db`) located at `C:\Users\Asus\face_detector\data\attendance.db`
- **Biometric Storage:** Normalized 512-dimensional float32 vector embeddings.
- **Privacy Guarantee:** All camera frames are processed strictly in memory and discarded. **No photos or videos are ever saved to disk, database, or external clouds.**

## Registration Plan (Exact 10 Embeddings)

Enforces exactly 10 face embeddings per student across 3 guided poses:
1. **Look Straight:** 6 embeddings
2. **Look Slightly Left:** 2 embeddings
3. **Look Slightly Right:** 2 embeddings

## API Endpoints

- `GET /api/face/health` — Status, model availability, and database stats.
- `GET /api/face/students` — List enrolled student roll numbers and embedding counts.
- `GET /api/face/students/{roll_number}` — Check if a student is enrolled.
- `DELETE /api/face/students/{roll_number}` — Permanently delete student's biometric embeddings.
- `POST /api/face/register/session/start` — Initiate atomic 10-embedding enrollment session.
- `POST /api/face/register/session/frame` — Stream frame for pose evaluation and in-memory capture.
- `POST /api/face/register/session/cancel` — Abort session and purge uncommitted embeddings.
- `POST /api/face/register/direct` — Direct enrollment of 10 embeddings (for tests & bulk imports).
- `POST /api/face/recognize-frame` — Live frame recognition with cosine similarity and multi-face handling.

## Running the Service

### Windows Batch Script
Double-click `start_face_server.bat` or run:
```cmd
backend\face\start_face_server.bat
```

### Via Workspace NPM Script
From project root:
```bash
npm run face:start
```
