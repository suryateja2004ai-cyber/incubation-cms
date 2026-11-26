-- ==============================================================================
-- 014_centralized_cloud_face_embeddings.sql
-- High-Security Centralized Biometric Vector Storage & Face Matching Engine
--
-- Biometric Security Architecture:
--   1. Zero Direct Vector Exposure:
--      All direct table SELECT/INSERT/UPDATE permissions on public.student_face_embeddings
--      are explicitly REVOKED from PUBLIC, anon, and authenticated frontend roles.
--   2. Strict Row-Level Security:
--      RLS is enabled and FORCED. Only backend operations via service_role are granted access.
--   3. Backend-Only Face Matching RPC:
--      The match_face_embeddings function is restricted exclusively to service_role.
--      Standard browser sessions cannot call this RPC directly.
--   4. Standardized Column & Return Field Naming:
--      Table column is student_name. The RPC returns both student_name and name
--      (aliased) for full compatibility with frontend/backend/Python consumers.
--   5. Information Minimization:
--      Vector similarity matching returns student metadata and match similarity,
--      never returning raw embedding vectors to any caller.
--   6. Hardware-Standard 512-D Vectors:
--      pgvector extension configured for FaceNet / MobileFaceNet 512-dimensional
--      L2-normalized float embeddings with Cosine Distance optimization.
--   7. Safe Rollback Strategy:
--      Never run bare DROP TABLE CASCADE in production. If rolling back, rename table
--      to student_face_embeddings_backup_YYYYMMDD to preserve registered biometric data.
-- ==============================================================================

-- 1. Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Create Biometric Embeddings Table
CREATE TABLE IF NOT EXISTS public.student_face_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number text NOT NULL,
  student_name text NOT NULL,
  embedding extensions.vector(512) NOT NULL,
  capture_quality numeric(4, 3) NOT NULL DEFAULT 1.000,
  source_device text NOT NULL DEFAULT 'lab_kiosk',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

-- Fast metadata lookup index
CREATE INDEX IF NOT EXISTS idx_face_embeddings_roll
  ON public.student_face_embeddings(roll_number);

-- Cosine Distance HNSW Index for sub-millisecond similarity search across thousands of vectors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_face_embeddings_cosine_hnsw'
  ) THEN
    BEGIN
      CREATE INDEX idx_face_embeddings_cosine_hnsw
        ON public.student_face_embeddings
        USING hnsw (embedding extensions.vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    EXCEPTION WHEN OTHERS THEN
      -- Fallback to IVFFlat if HNSW is unavailable in older Postgres build
      CREATE INDEX idx_face_embeddings_cosine_ivf
        ON public.student_face_embeddings
        USING ivfflat (embedding extensions.vector_cosine_ops)
        WITH (lists = 10);
    END;
  END IF;
END $$;

-- 3. Row Level Security & Access Lockdown
ALTER TABLE public.student_face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_face_embeddings FORCE ROW LEVEL SECURITY;

-- Explicitly revoke all direct access from public, anon, and authenticated roles
REVOKE ALL ON TABLE public.student_face_embeddings FROM PUBLIC, anon, authenticated;

-- Grant table access exclusively to service_role
GRANT ALL ON TABLE public.student_face_embeddings TO service_role;

DROP POLICY IF EXISTS service_role_face_embeddings_policy ON public.student_face_embeddings;
CREATE POLICY service_role_face_embeddings_policy ON public.student_face_embeddings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. High-Performance, Secure Face Matching RPC
-- Note: Embeddings are normalized, so 1 - (embedding <=> p_query) yields cosine similarity.
-- Returns both student_name and name to satisfy both frontend and Python backend mappings.
CREATE OR REPLACE FUNCTION public.match_face_embeddings(
  p_query_embedding extensions.vector(512),
  p_match_threshold float DEFAULT 0.65,
  p_match_count integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  roll_number text,
  student_name text,
  name text,
  similarity float,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fe.id,
    fe.roll_number,
    fe.student_name,
    fe.student_name AS name,
    ROUND((1 - (fe.embedding <=> p_query_embedding))::numeric, 4)::float AS similarity,
    fe.created_at
  FROM public.student_face_embeddings fe
  WHERE (1 - (fe.embedding <=> p_query_embedding)) >= p_match_threshold
  ORDER BY fe.embedding <=> p_query_embedding ASC
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, pg_catalog, public, pg_temp;

-- 5. Lock Down RPC Execution Permissions
-- Only the backend service_role (used by Cloudflare Pages Functions and FastAPI server)
-- is permitted to execute face matching.
REVOKE ALL ON FUNCTION public.match_face_embeddings(extensions.vector, float, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_face_embeddings(extensions.vector, float, integer) TO service_role;
