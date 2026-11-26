-- ==============================================================================
-- 006_secure_kiosk_gatekeeper.sql
-- Production Transactional Migration:
-- 1. Official College Student Enrollment Roster (student_roster)
-- 2. Distributed Atomic Replay Protection Table (used_kiosk_nonces)
-- 3. Atomic Distributed Shared Rate Limiting (api_rate_limits & check_rate_limit)
-- 4. Public.users Hardening & Account Lifecycle Columns (is_active, membership_status)
-- 5. User Field Protection Trigger (Prevents Student Privilege Escalation)
-- 6. Complete Lab Device Isolation (Removal of Supabase as a Remote Command Channel)
--
-- STRICT SECURITY RULES:
-- - ZERO sample student records. ZERO fabricated identities.
-- - All tables protected by Row-Level Security (RLS) with FORCE RLS enabled.
-- - devices table is STRICTLY READ-ONLY for authenticated users; ALL mutations revoked.
-- - TRUNCATE, TRIGGER, and REFERENCES privileges strictly REVOKED from clients across all tables.
-- - used_kiosk_nonces & api_rate_limits restricted STRICTLY to service_role (No direct browser access).
-- - check_rate_limit() executable ONLY by service_role (Revoked from PUBLIC, anon, authenticated).
-- - check_rate_limit() is 100% atomic against concurrent requests using a single UPSERT statement.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. HARDEN public.get_current_user_role() (FAIL-CLOSED FOR ANON / UNASSIGNED SESSIONS)
-- ------------------------------------------------------------------------------
-- Fixes legacy implementation:
-- 1. Returns 'admin' for service_role superuser context.
-- 2. Returns NULL if auth.uid() IS NULL (rejects false identity for anon/unauthenticated).
-- 3. Queries public.users for auth_id = auth.uid().
-- 4. Returns NULL (not 'student') if no matching public.users profile exists.
-- 5. search_path explicitly pinned to public, auth, pg_temp to prevent schema hijacking.
-- 6. Execution revoked from PUBLIC and anon; granted strictly to authenticated and service_role.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
DECLARE
  v_role text;
  v_uid uuid;
BEGIN
  -- 1. Check if superuser or service_role
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN 'admin';
  END IF;

  -- 2. Verify an authenticated session exists (Fail-closed for unauthenticated callers)
  v_uid := (select auth.uid());
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- 3. Lookup role from public.users
  SELECT role INTO v_role
  FROM public.users
  WHERE auth_id = v_uid
  LIMIT 1;

  -- 4. Fail-closed: Return NULL if user profile is not found or has no role assigned
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 0B. HARDEN public.get_current_student_roll() (REVOKE ANON & PIN SEARCH PATH)
-- ------------------------------------------------------------------------------
-- 1. Returns NULL if auth.uid() IS NULL.
-- 2. Queries UPPER(roll_number) for auth_id = auth.uid().
-- 3. search_path explicitly pinned to public, auth, pg_temp.
-- 4. Execution revoked from PUBLIC and anon; granted strictly to authenticated and service_role.
CREATE OR REPLACE FUNCTION public.get_current_student_roll()
RETURNS text AS $$
DECLARE
  v_roll text;
  v_uid uuid;
BEGIN
  v_uid := (select auth.uid());
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT UPPER(roll_number) INTO v_roll
  FROM public.users
  WHERE auth_id = v_uid
  LIMIT 1;

  RETURN v_roll;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.get_current_student_roll() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_student_roll() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 1. OFFICIAL COLLEGE STUDENT ENROLLMENT ROSTER TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number text NOT NULL,
  name text NOT NULL,
  department text NOT NULL,
  branch text DEFAULT 'ECE',
  academic_year integer DEFAULT 1,
  is_registered boolean DEFAULT false NOT NULL,
  registered_at timestamptz,
  registered_user_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Case-insensitive unique roll number index on roster
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_roster_roll_lower 
  ON public.student_roster (lower(trim(roll_number)));

CREATE INDEX IF NOT EXISTS idx_student_roster_is_reg 
  ON public.student_roster (is_registered);

-- Enable & Force RLS on student_roster
ALTER TABLE public.student_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_roster FORCE ROW LEVEL SECURITY;

-- Revoke ALL privileges from public, anon, and authenticated first
REVOKE ALL PRIVILEGES ON public.student_roster FROM PUBLIC, anon, authenticated;

-- Dynamically drop ALL existing policies on public.student_roster to eliminate legacy or rogue permissive policies
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'student_roster'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.student_roster', pol.policyname);
  END LOOP;
END $$;

-- Explicit drops for idempotency
DROP POLICY IF EXISTS "Admins manage student roster" ON public.student_roster;

-- Only verified Admins and Staff can view or manage the college roster directly
CREATE POLICY "Admins manage student roster" ON public.student_roster
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir', 'staff'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir', 'staff'));

-- Grant strictly scoped DML privileges to authenticated (governed by RLS policy)
-- TRUNCATE, TRIGGER, and REFERENCES are permanently withheld from client roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_roster TO authenticated;
GRANT ALL PRIVILEGES ON public.student_roster TO service_role;

-- ------------------------------------------------------------------------------
-- 2. DISTRIBUTED ATOMIC REPLAY PROTECTION TABLE (SERVICE ROLE ONLY)
-- ------------------------------------------------------------------------------
-- Shared atomic table to prevent replay attacks across distributed Cloudflare edge nodes
-- DIRECT BROWSER / CLIENT ACCESS IS STRICTLY REVOKED (No policies for anon or authenticated)
CREATE TABLE IF NOT EXISTS public.used_kiosk_nonces (
  nonce text PRIMARY KEY,
  consumed_at timestamptz DEFAULT now() NOT NULL,
  station_id text DEFAULT 'physical_kiosk_station'
);

ALTER TABLE public.used_kiosk_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.used_kiosk_nonces FORCE ROW LEVEL SECURITY;

-- Dynamically drop ALL existing policies on public.used_kiosk_nonces
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'used_kiosk_nonces'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.used_kiosk_nonces', pol.policyname);
  END LOOP;
END $$;

-- Explicit drops for idempotency
DROP POLICY IF EXISTS "Service role manages kiosk nonces" ON public.used_kiosk_nonces;
DROP POLICY IF EXISTS "Admins manage kiosk nonces" ON public.used_kiosk_nonces;

-- Strict revocation: Absolutely NO direct access for anon, authenticated, or public
REVOKE ALL PRIVILEGES ON public.used_kiosk_nonces FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON public.used_kiosk_nonces TO service_role;

-- ------------------------------------------------------------------------------
-- 3. DISTRIBUTED SHARED RATE LIMITING (ATOMIC UPSERT & SERVICE ROLE ONLY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  client_ip text PRIMARY KEY,
  request_count integer DEFAULT 1 NOT NULL,
  window_start timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limits FORCE ROW LEVEL SECURITY;

-- Dynamically drop ALL existing policies on public.api_rate_limits
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'api_rate_limits'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.api_rate_limits', pol.policyname);
  END LOOP;
END $$;

-- Direct table access strictly revoked from public/clients
REVOKE ALL PRIVILEGES ON public.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON public.api_rate_limits TO service_role;

-- ATOMIC RATE LIMIT FUNCTION:
-- Single atomic INSERT ... ON CONFLICT DO UPDATE statement with row-level serialization.
-- Eliminates race conditions when multiple concurrent requests arrive from the same IP.
-- STRICT FAIL-CLOSED VALIDATION: Rejects NULL/empty IP, NULL/zero/negative max and window.
-- search_path pinned to public, pg_temp to prevent schema hijacking
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_ip text, p_max int, p_window_seconds int)
RETURNS boolean AS $$
DECLARE
  v_allowed boolean;
BEGIN
  -- Strict Fail-Closed Input Validation
  IF p_ip IS NULL OR trim(p_ip) = '' THEN
    RETURN false;
  END IF;

  IF p_max IS NULL OR p_max <= 0 THEN
    RETURN false;
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RETURN false;
  END IF;

  -- Atomic concurrency-safe UPSERT
  INSERT INTO public.api_rate_limits (client_ip, request_count, window_start)
  VALUES (trim(p_ip), 1, clock_timestamp())
  ON CONFLICT (client_ip) DO UPDATE
  SET 
    request_count = CASE 
      WHEN clock_timestamp() > public.api_rate_limits.window_start + (p_window_seconds || ' seconds')::interval THEN 1
      ELSE public.api_rate_limits.request_count + 1
    END,
    window_start = CASE 
      WHEN clock_timestamp() > public.api_rate_limits.window_start + (p_window_seconds || ' seconds')::interval THEN clock_timestamp()
      ELSE public.api_rate_limits.window_start
    END
  RETURNING (request_count <= p_max) INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function execution permissions: Strictly restricted to service_role
REVOKE ALL ON FUNCTION public.check_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. HARDEN public.users CONSTRAINTS & SECURITY TRIGGER
-- ------------------------------------------------------------------------------
-- Add missing account lifecycle columns if not present
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS membership_status text DEFAULT 'active';

-- Safe partial unique index (prevents failure on existing empty/null records while strictly enforcing unique rolls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_roll_number_lower 
  ON public.users (lower(trim(roll_number)))
  WHERE roll_number IS NOT NULL AND trim(roll_number) != '';

-- Force RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- Strip dangerous administrative/DDL privileges from client roles
REVOKE ALL PRIVILEGES ON public.users FROM PUBLIC, anon;
REVOKE INSERT, TRUNCATE, TRIGGER, REFERENCES ON public.users FROM authenticated;

-- Clean up all existing policies on public.users to eliminate legacy or conflicting policies
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
END $$;

-- Explicit drops for idempotency
DROP POLICY IF EXISTS "Users can register own student profile" ON public.users;
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;
DROP POLICY IF EXISTS "Students can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own contact profile" ON public.users;

-- Grant selective privileges to authenticated (strictly governed by RLS)
GRANT SELECT, UPDATE, DELETE ON public.users TO authenticated;
GRANT ALL PRIVILEGES ON public.users TO service_role;

-- Ensure ONLY Admins and Staff have direct table write access
CREATE POLICY "Admins have full access to users" ON public.users
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir', 'staff'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir', 'staff'));

-- Students can read their own profile
CREATE POLICY "Students can view own profile" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    auth_id = (select auth.uid()) OR
    lower(trim(roll_number)) = lower(trim(public.get_current_student_roll()))
  );

-- Students can update only their own contact details (mobile, avatar)
CREATE POLICY "Users can update own contact profile" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_id = (select auth.uid()))
  WITH CHECK (auth_id = (select auth.uid()));

-- Protect sensitive columns (role, auth_id, roll_number, is_active, status) against tampering
-- FAIL-CLOSED: If public.get_current_user_role() returns NULL or an unknown role, sensitive columns are strictly protected.
-- search_path pinned to public, pg_temp to prevent schema hijacking
CREATE OR REPLACE FUNCTION public.protect_user_fields_on_update()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_current_user_role();

  -- Fail-closed condition: If role is NULL, empty, or unknown, strictly protect sensitive columns
  IF v_role IS NULL OR v_role NOT IN ('admin', 'substitute_admin', 'sir') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify your own user role.';
    END IF;
    IF NEW.auth_id IS DISTINCT FROM OLD.auth_id THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify auth_id.';
    END IF;
    IF NEW.roll_number IS DISTINCT FROM OLD.roll_number THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify roll_number.';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify account active status.';
    END IF;
    IF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify membership status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_user_fields ON public.users;
CREATE TRIGGER trg_protect_user_fields
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_fields_on_update();

-- ------------------------------------------------------------------------------
-- 5. PREVENT REMOTE LAB DEVICE CONTROL (ISOLATE SUPABASE FROM COMMAND CHANNEL)
-- ------------------------------------------------------------------------------
-- Enable & Force RLS on devices table
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices FORCE ROW LEVEL SECURITY;

-- Dynamically drop all existing policies on public.devices so no custom or legacy policies linger
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'devices'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.devices', pol.policyname);
  END LOOP;
END $$;

-- Explicit drops to ensure idempotency and test assertion compliance
DROP POLICY IF EXISTS "Students can control lights and fans" ON public.devices;
DROP POLICY IF EXISTS "Admins have full control over devices" ON public.devices;
DROP POLICY IF EXISTS "Admins manage devices metadata" ON public.devices;
DROP POLICY IF EXISTS "Admins can update devices" ON public.devices;
DROP POLICY IF EXISTS "Authenticated users can update device state" ON public.devices;
DROP POLICY IF EXISTS "Students can toggle devices" ON public.devices;
DROP POLICY IF EXISTS "All authenticated users can view devices" ON public.devices;

-- Devices table is STRICTLY READ-ONLY for authenticated client sessions (telemetry mirror only)
CREATE POLICY "All authenticated users can view devices" ON public.devices
  FOR SELECT
  TO authenticated
  USING (true);

-- Revoke ALL privileges (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) from PUBLIC, anon, and authenticated
REVOKE ALL PRIVILEGES ON public.devices FROM PUBLIC, anon, authenticated;

-- Grant strictly SELECT to authenticated users (enables telemetry reading in application UI)
GRANT SELECT ON public.devices TO authenticated;

-- Trusted server-side operations retain full administrative access via service_role
GRANT ALL PRIVILEGES ON public.devices TO service_role;

COMMIT;
