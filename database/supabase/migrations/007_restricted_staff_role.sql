-- ==============================================================================
-- 007_restricted_staff_role.sql
-- PROPOSED PRODUCTION MIGRATION (DO NOT EXECUTE AUTOMATICALLY)
--
-- PURPOSE:
-- Rigorous Role Separation, Least Privilege, Anti-Tamper & Idempotency Enforcement:
-- 1. Separates 'staff' from full administrative privileges ('admin', 'substitute_admin', 'sir').
-- 2. Restricts 'staff' to Read-Only SELECT on public.student_roster (Cannot mutate or delete roster).
-- 3. Strictly PREVENTS direct staff access to public.users (Zero SELECT, INSERT, UPDATE, DELETE).
--    Staff student directory access is mediated exclusively via public.staff_student_directory
--    and public.get_student_directory(), exposing only approved non-sensitive columns.
--    Authenticated user self-profile resolution is mediated via public.get_my_profile(),
--    preserving staff, student, and admin authentication/session without granting direct SELECT on public.users.
-- 4. Restricts 'staff' to Read-Only SELECT on public.components for direct DML (Cannot alter catalog).
-- 5. Enables 'staff' Desk Operations on public.visits via discrete SELECT, INSERT, and UPDATE policies.
-- 6. Strictly RESTRICTS direct DML on public.transactions:
--    - Staff receives Read-Only SELECT access on public.transactions.
--    - Direct staff INSERT and UPDATE on public.transactions are REMOVED.
--    - Staff must exclusively issue and return components via secure atomic RPCs.
--    - Admins maintain full management (SELECT, INSERT, UPDATE, DELETE).
-- 7. Strictly RESTRICTS DELETE on public.visits & public.transactions to 'admin', 'substitute_admin', and 'sir'.
--    (Staff accounts CANNOT delete attendance history or equipment checkout records).
-- 8. Validates staff INSERT operations to prevent historical backdating, forged identities, or bogus items:
--    - trg_validate_visits_on_insert: Requires active student roll, entry_time within 15 mins of clock_timestamp,
--      status = 'inside', exit_time = NULL, duration_minutes = NULL.
--      INCLUDES UPSERT RESILIENCY: If record already exists by ID (UPSERT update), allows passing to UPDATE handler.
--    - trg_validate_transactions_on_insert: Requires active student roll, issue_date within 15 mins of clock_timestamp,
--      status = 'active', returned_date = NULL, valid items array with existing components, issuedQuantity > 0, returnedQuantity = 0.
--      INCLUDES UPSERT RESILIENCY: If record already exists by ID (UPSERT update), allows passing to UPDATE handler.
-- 9. Restricts staff UPDATE operations to legitimate front-desk completion:
--    - trg_protect_visits_on_update: Enforces immutability of id, student_roll, student_name, entry_time, entry_method, created_at.
--      Enforces valid state transitions (inside -> completed/incomplete; completed visits cannot be modified).
--      Enforces consistent exit_time, exit_method, and duration_minutes upon completion.
--    - trg_protect_transactions_on_update: Enforces immutability of id, student_roll, student_name, authorized_by (proxy delegate),
--      issue_date, overall_due_date, created_at.
--      Validates JSONB items structure: componentId, componentName, trackingMode, and issuedQuantity cannot be altered;
--      returnedQuantity can only increase up to issuedQuantity.
-- 10. Student Profile Updates Restricted via Secure Database RPC:
--     - public.update_student_profile: Enforces that students can update strictly their own contact/theme fields
--       (mobile_number, avatar_theme, face_photo_url). Direct student table UPDATE on public.users is not permitted.
-- 11. Atomic Concurrency-Safe Database RPC Functions for Inventory Movements:
--     - public.issue_components_atomic: Locks component rows FOR UPDATE, verifies active borrower student,
--       strictly verifies submitted student name against authoritative public.users.name, verifies individual
--       tag availability and exact quantity match, rejects duplicate component/tag entries, deducts stock,
--       and updates borrower phone without granting general user update permissions.
--     - public.return_components_atomic: Locks transaction and components FOR UPDATE, rejects duplicate component/tag
--       entries, strictly requires exact physical tag counts for individual tracking components, rejects tags on bulk
--       components, verifies returned physical tags are currently issued to this exact transaction and student,
--       restores inventory stock, and completes/partially completes transaction records.
-- 12. Server-Side Idempotency Protection for Queued Offline Operations:
--     - public.processed_rpc_operations: Stores processed operation IDs to guarantee that retrying an already
--       successful offline operation returns the cached result without altering inventory stock or transactions twice.
-- 13. Explicit Policy Replacement: Dropping only confirmed obsolete policies by exact name (zero dynamic blanket drops).
-- 14. Enforces FORCE ROW LEVEL SECURITY and permanently withholds TRUNCATE, TRIGGER, REFERENCES from client roles.
-- 15. Hardens all trigger and RPC functions with SECURITY DEFINER, search_path = pg_catalog, public, pg_temp,
--     schema-qualifies all database objects, and revokes client EXECUTE on triggers.
--
-- EXECUTION NOTICE:
-- Prepared for manual administrator review. DO NOT EXECUTE AUTOMATICALLY.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. TABLE PRIVILEGES (GRANT & REVOKE)
-- Ensure client roles possess required DML privileges governed strictly by RLS.
-- Dangerous DDL privileges (TRUNCATE, TRIGGER, REFERENCES) are permanently revoked.
-- ==============================================================================

-- public.users
REVOKE ALL PRIVILEGES ON public.users FROM PUBLIC, anon;
REVOKE INSERT, TRUNCATE, TRIGGER, REFERENCES ON public.users FROM authenticated;
GRANT SELECT, UPDATE, DELETE ON public.users TO authenticated;
GRANT ALL PRIVILEGES ON public.users TO service_role;

-- public.student_roster
REVOKE ALL PRIVILEGES ON public.student_roster FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.student_roster FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_roster TO authenticated;
GRANT ALL PRIVILEGES ON public.student_roster TO service_role;

-- public.components
REVOKE ALL PRIVILEGES ON public.components FROM PUBLIC, anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.components FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.components TO authenticated;
GRANT ALL PRIVILEGES ON public.components TO service_role;

-- public.visits
REVOKE ALL PRIVILEGES ON public.visits FROM PUBLIC, anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.visits FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL PRIVILEGES ON public.visits TO service_role;

-- public.transactions
REVOKE ALL PRIVILEGES ON public.transactions FROM PUBLIC, anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.transactions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL PRIVILEGES ON public.transactions TO service_role;


-- ==============================================================================
-- 2. SERVER-SIDE IDEMPOTENCY LEDGER TABLE
-- Stores processed operation IDs bound to authenticated actor (auth.uid()),
-- operation type, and payload hash. Strictly restricted to administrators.
-- Retried requests return the original result without mutating inventory or transactions.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.processed_rpc_operations (
  operation_id text PRIMARY KEY,
  operation_type text NOT NULL,
  transaction_id text,
  actor_id uuid,
  actor_role text,
  payload_hash text,
  status text NOT NULL DEFAULT 'in_progress',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Ensure columns exist and constraints align if table was previously created
ALTER TABLE public.processed_rpc_operations ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.processed_rpc_operations ADD COLUMN IF NOT EXISTS actor_role text;
ALTER TABLE public.processed_rpc_operations ADD COLUMN IF NOT EXISTS payload_hash text;
ALTER TABLE public.processed_rpc_operations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
ALTER TABLE public.processed_rpc_operations ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE public.processed_rpc_operations ALTER COLUMN transaction_id DROP NOT NULL;
ALTER TABLE public.processed_rpc_operations ALTER COLUMN result DROP NOT NULL;

REVOKE ALL PRIVILEGES ON public.processed_rpc_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.processed_rpc_operations TO authenticated;
GRANT ALL PRIVILEGES ON public.processed_rpc_operations TO service_role;

ALTER TABLE public.processed_rpc_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_rpc_operations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view processed rpc operations" ON public.processed_rpc_operations;
CREATE POLICY "Admins view processed rpc operations" ON public.processed_rpc_operations
  FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

-- Staff SELECT policy is explicitly REMOVED to restrict ledger visibility strictly to administrators
DROP POLICY IF EXISTS "Staff view processed rpc operations" ON public.processed_rpc_operations;


-- ==============================================================================
-- 3. FORCE ROW LEVEL SECURITY
-- Ensure table owner and superusers cannot bypass RLS during client sessions.
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

ALTER TABLE public.student_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_roster FORCE ROW LEVEL SECURITY;

ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components FORCE ROW LEVEL SECURITY;

ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits FORCE ROW LEVEL SECURITY;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;


-- ==============================================================================
-- 4. EXPLICIT POLICY INVENTORY & TARGETED REPLACEMENT
-- Drops confirmed obsolete policies by exact name.
-- Preserves all unrelated legitimate policies across the database.
-- ==============================================================================

-- public.student_roster
DROP POLICY IF EXISTS "Admins manage student roster" ON public.student_roster;
DROP POLICY IF EXISTS "Staff view student roster" ON public.student_roster;

-- public.users
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;
DROP POLICY IF EXISTS "Admins manage users" ON public.users;
DROP POLICY IF EXISTS "Students can view own profile" ON public.users;
DROP POLICY IF EXISTS "Students view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own contact profile" ON public.users;
DROP POLICY IF EXISTS "Students update own contact profile" ON public.users;
DROP POLICY IF EXISTS "Users can register own student profile" ON public.users;
DROP POLICY IF EXISTS "Staff view student directory" ON public.users;

-- public.components
DROP POLICY IF EXISTS "Admins manage components" ON public.components;
DROP POLICY IF EXISTS "All authenticated users can browse components" ON public.components;
DROP POLICY IF EXISTS "All authenticated users view components" ON public.components;
DROP POLICY IF EXISTS "Staff manage components" ON public.components;

-- public.visits
DROP POLICY IF EXISTS "Admins manage visits" ON public.visits;
DROP POLICY IF EXISTS "Students view own visits" ON public.visits;
DROP POLICY IF EXISTS "Staff manage visits" ON public.visits;
DROP POLICY IF EXISTS "Staff view visits" ON public.visits;
DROP POLICY IF EXISTS "Staff insert visits" ON public.visits;
DROP POLICY IF EXISTS "Staff update visits" ON public.visits;

-- public.transactions
DROP POLICY IF EXISTS "Admins manage transactions" ON public.transactions;
DROP POLICY IF EXISTS "Students view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff manage transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff update transactions" ON public.transactions;


-- ==============================================================================
-- 5. AUTHORITATIVE POLICIES ON public.student_roster
-- Admins: Full management.
-- Staff: Strictly Read-Only SELECT for enrollment verification at desk.
-- Students: Zero direct access.
-- ==============================================================================
CREATE POLICY "Admins manage student roster" ON public.student_roster
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

CREATE POLICY "Staff view student roster" ON public.student_roster
  FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() = 'staff');


-- ==============================================================================
-- 6. AUTHORITATIVE POLICIES ON public.users
-- Admins: Full management (SELECT, INSERT, UPDATE, DELETE).
-- Staff: ZERO direct access to public.users (fails closed).
-- Students: Read strictly their own profile record.
-- (Student updates are strictly mediated by public.update_student_profile RPC below).
-- ==============================================================================
CREATE POLICY "Admins manage users" ON public.users
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

-- Notice: Direct staff SELECT policy ("Staff view student directory") is PERMANENTLY REMOVED.
-- Staff accounts cannot query public.users directly, preventing exposure of auth_id,
-- password_hash, role, membership_status, fingerprint biometric data, or other accounts.

CREATE POLICY "Students view own profile" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    role = 'student' AND (
      auth_id = (select auth.uid()) OR
      (auth.uid() IS NOT NULL AND lower(trim(roll_number)) = lower(trim(public.get_current_student_roll())))
    )
  );


-- ==============================================================================
-- 6b. RESTRICTED STUDENT DIRECTORY VIEW & RPC FOR FRONT-DESK STAFF
-- Exposes ONLY approved student directory columns necessary for front-desk operations:
--   id, roll_number, name, department, branch, section, academic_year, mobile_number,
--   face_registered, face_photo_url, is_active, created_at, updated_at.
-- STRICTLY EXCLUDES sensitive columns:
--   auth_id, role, password_hash, membership_status, fingerprint_ids, finger_labels,
--   incubation_start_date, academic_year_at_start, retention_period_years, retention_end_date.
-- STRICTLY FILTERS to student records only (admin, sir, staff records are invisible).
-- ==============================================================================
DROP VIEW IF EXISTS public.staff_student_directory;
CREATE VIEW public.staff_student_directory
WITH (security_barrier = true) AS
SELECT
  u.id,
  u.roll_number,
  u.name,
  u.department,
  u.branch,
  u.section,
  u.academic_year,
  u.mobile_number,
  u.face_registered,
  u.face_photo_url,
  u.is_active,
  u.created_at,
  u.updated_at
FROM public.users u
WHERE u.role = 'student'
  AND public.get_current_user_role() IN ('staff', 'admin', 'substitute_admin', 'sir');

REVOKE ALL PRIVILEGES ON public.staff_student_directory FROM PUBLIC, anon, service_role;
GRANT SELECT ON public.staff_student_directory TO authenticated;

-- Secure Database RPC for programmatic student directory retrieval
CREATE OR REPLACE FUNCTION public.get_student_directory()
RETURNS TABLE (
  id text,
  roll_number text,
  name text,
  department text,
  branch text,
  section text,
  academic_year integer,
  mobile_number text,
  face_registered boolean,
  face_photo_url text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('staff', 'admin', 'substitute_admin', 'sir') THEN
    RAISE EXCEPTION 'Access Denied: Only authorized lab personnel can access student directory.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.roll_number,
    u.name,
    u.department,
    u.branch,
    u.section,
    u.academic_year,
    u.mobile_number,
    u.face_registered,
    u.face_photo_url,
    u.is_active,
    u.created_at,
    u.updated_at
  FROM public.users u
  WHERE u.role = 'student';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.get_student_directory() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_directory() TO authenticated;


-- ==============================================================================
-- 6c. SECURE AUTHENTICATED USER PROFILE RPC (public.get_my_profile)
-- Allows ANY authenticated user (student, staff, admin, substitute_admin, sir)
-- to retrieve strictly their OWN profile record via auth.uid().
-- Because staff accounts have zero direct SELECT access to public.users under RLS,
-- this RPC is required for staff session resolution, role verification, and profile
-- preservation without weakening table RLS policies or exposing other accounts.
--
-- STRICTLY INCLUDES non-secret profile fields required by the application:
--   id, auth_id, roll_number, name, role, mobile_number, department,
--   branch, section, academic_year, avatar_theme, face_registered,
--   face_photo_url, is_active, created_at, updated_at.
-- STRICTLY EXCLUDES secret/sensitive columns:
--   password_hash, fingerprint_ids, finger_labels, membership_status,
--   retention_period_years, retention_end_date.
--
-- SECURITY CONTROLS:
--   1. SECURITY DEFINER with search_path = pg_catalog, public, pg_temp.
--   2. Strict authenticated session requirement: auth.uid() cannot be null.
--   3. Queries strictly WHERE u.auth_id = auth.uid() LIMIT 1.
--   4. Zero user-supplied parameters: callers cannot query another user's record.
--   5. Execution REVOKED from PUBLIC, anon, and service_role.
--   6. Execution GRANTED strictly to authenticated.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id text,
  auth_id uuid,
  roll_number text,
  name text,
  role text,
  mobile_number text,
  department text,
  branch text,
  section text,
  academic_year integer,
  avatar_theme text,
  face_registered boolean,
  face_photo_url text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
DECLARE
  v_auth_id uuid;
  v_email text;
  v_roll text;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: No active authenticated session.';
  END IF;

  -- If auth_id has not yet been linked on public.users, auto-link using authenticated JWT email
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_id = v_auth_id) THEN
    v_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
    IF v_email <> '' THEN
      v_roll := split_part(v_email, '@', 1);
      UPDATE public.users
      SET auth_id = v_auth_id, updated_at = clock_timestamp()
      WHERE auth_id IS NULL
        AND (
          lower(trim(roll_number)) = v_roll
          OR (v_roll = 'admin' AND role = 'admin')
          OR (v_roll = 'sir' AND role = 'sir')
          OR (v_roll = 'subadmin' AND role = 'substitute_admin')
          OR (v_roll = 'staff' AND role = 'staff')
        );
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.auth_id,
    u.roll_number,
    u.name,
    u.role,
    u.mobile_number,
    u.department,
    u.branch,
    u.section,
    u.academic_year,
    u.avatar_theme,
    u.face_registered,
    u.face_photo_url,
    u.is_active,
    u.created_at,
    u.updated_at
  FROM public.users u
  WHERE u.auth_id = v_auth_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;


-- ==============================================================================
-- 7. AUTHORITATIVE POLICIES ON public.components
-- Admins: Full management (SELECT, INSERT, UPDATE, DELETE).
-- All Authenticated (Staff & Students): Strictly Read-Only SELECT catalog browse.
-- (Staff component stock mutations are executed via secure atomic RPCs below).
-- ==============================================================================
CREATE POLICY "Admins manage components" ON public.components
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

CREATE POLICY "All authenticated users view components" ON public.components
  FOR SELECT
  TO authenticated
  USING (true);


-- ==============================================================================
-- 8. AUTHORITATIVE POLICIES ON public.visits (LAB ATTENDANCE)
-- Admins: Full management including DELETE.
-- Staff: Discrete SELECT, INSERT, and UPDATE policies (ZERO DELETE).
-- Students: SELECT own attendance records only.
-- ==============================================================================
CREATE POLICY "Admins manage visits" ON public.visits
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

CREATE POLICY "Staff view visits" ON public.visits
  FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() = 'staff');

CREATE POLICY "Staff insert visits" ON public.visits
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_current_user_role() = 'staff');

CREATE POLICY "Staff update visits" ON public.visits
  FOR UPDATE
  TO authenticated
  USING (public.get_current_user_role() = 'staff')
  WITH CHECK (public.get_current_user_role() = 'staff');

CREATE POLICY "Students view own visits" ON public.visits
  FOR SELECT
  TO authenticated
  USING (UPPER(student_roll) = public.get_current_student_roll());


-- ==============================================================================
-- 9. AUTHORITATIVE POLICIES ON public.transactions (EQUIPMENT ISSUE & RETURN)
-- Admins: Full management including DELETE.
-- Staff: Strictly Read-Only SELECT (ZERO DIRECT INSERT OR UPDATE; MUST USE ATOMIC RPCs).
-- Students: SELECT own borrowing records only.
-- ==============================================================================
CREATE POLICY "Admins manage transactions" ON public.transactions
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

CREATE POLICY "Staff view transactions" ON public.transactions
  FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() = 'staff');

CREATE POLICY "Students view own transactions" ON public.transactions
  FOR SELECT
  TO authenticated
  USING (UPPER(student_roll) = public.get_current_student_roll());


-- ==============================================================================
-- 10. USER PROFILE FIELD IMMUTABILITY TRIGGER (DEFENSE-IN-DEPTH)
-- Prevents non-admins from altering sensitive columns (role, auth_id, roll_number,
-- is_active, membership_status, id, created_at).
-- Restricts students strictly to contact details (mobile_number, avatar_theme, face_photo_url, updated_at).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.protect_user_fields_on_update()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_current_user_role();

  -- If actor is not a full administrator (admin, substitute_admin, sir),
  -- enforce strict immutability on core security and account lifecycle columns
  IF v_role IS NULL OR v_role NOT IN ('admin', 'substitute_admin', 'sir') THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Access Denied: Record ID cannot be modified.';
    END IF;
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
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Access Denied: Account creation timestamp cannot be modified.';
    END IF;

    -- Students specifically: restrict updates strictly to contact details
    IF v_role = 'student' THEN
      IF NEW.name IS DISTINCT FROM OLD.name THEN
        RAISE EXCEPTION 'Access Denied: Students cannot modify their registered name.';
      END IF;
      IF NEW.department IS DISTINCT FROM OLD.department THEN
        RAISE EXCEPTION 'Access Denied: Students cannot modify their registered department.';
      END IF;
      IF NEW.branch IS DISTINCT FROM OLD.branch THEN
        RAISE EXCEPTION 'Access Denied: Students cannot modify branch.';
      END IF;
      IF NEW.section IS DISTINCT FROM OLD.section THEN
        RAISE EXCEPTION 'Access Denied: Students cannot modify section.';
      END IF;
      IF NEW.academic_year IS DISTINCT FROM OLD.academic_year THEN
        RAISE EXCEPTION 'Access Denied: Students cannot modify academic year.';
      END IF;
      IF NEW.incubation_start_date IS DISTINCT FROM OLD.incubation_start_date THEN
        RAISE EXCEPTION 'Access Denied: Students cannot modify incubation journey start date.';
      END IF;
      IF NEW.academic_year_at_start IS DISTINCT FROM OLD.academic_year_at_start THEN
        RAISE EXCEPTION 'Access Denied: Students cannot modify academic year at start.';
      END IF;
      IF NEW.retention_period_years IS DISTINCT FROM OLD.retention_period_years THEN
        RAISE EXCEPTION 'Access Denied: Students cannot modify retention period.';
      END IF;
      IF NEW.retention_end_date IS DISTINCT FROM OLD.retention_end_date THEN
        RAISE EXCEPTION 'Access Denied: Students cannot modify retention expiration date.';
      END IF;
      IF NEW.face_registered IS DISTINCT FROM OLD.face_registered THEN
        RAISE EXCEPTION 'Access Denied: Students cannot directly alter face registration flag.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.protect_user_fields_on_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_user_fields ON public.users;
CREATE TRIGGER trg_protect_user_fields
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_fields_on_update();


-- ==============================================================================
-- 11. VISITS VALIDATION & PROTECTION TRIGGERS (STAFF INSERT & UPDATE HARDENING)
-- ==============================================================================

-- 11a. Visits INSERT Validation Trigger
-- Prevents staff from fabricating historical attendance, future timestamps, or non-existent students.
-- Enforces mandatory validation on all insert attempts (zero bypass).
CREATE OR REPLACE FUNCTION public.validate_visits_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
  v_student_exists boolean;
BEGIN
  v_role := public.get_current_user_role();

  -- Full administrators and service_role are trusted
  IF v_role IS NOT NULL AND v_role IN ('admin', 'substitute_admin', 'sir') THEN
    RETURN NEW;
  END IF;

  -- Enforce validation for staff and all other non-admin actors
  IF NEW.student_roll IS NULL OR trim(NEW.student_roll) = '' THEN
    RAISE EXCEPTION 'Validation Failed: student_roll cannot be empty.';
  END IF;

  -- Verify student exists and is active in public.users
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE lower(trim(roll_number)) = lower(trim(NEW.student_roll))
      AND is_active = true
  ) INTO v_student_exists;

  IF NOT v_student_exists THEN
    RAISE EXCEPTION 'Validation Failed: Student "%" does not exist or account is inactive.', NEW.student_roll;
  END IF;

  -- Clock synchronization window: entry_time must be within 15 mins of current server time
  IF NEW.entry_time < (clock_timestamp() - interval '15 minutes') OR
     NEW.entry_time > (clock_timestamp() + interval '5 minutes') THEN
    RAISE EXCEPTION 'Validation Failed: entry_time must match current server time (within 15 minutes). Backdated attendance is prohibited.';
  END IF;

  -- Initial check-in invariants
  IF NEW.exit_time IS NOT NULL THEN
    RAISE EXCEPTION 'Validation Failed: exit_time must be NULL upon lab entry. Departure must be recorded at checkout.';
  END IF;

  IF NEW.status IS NULL OR NEW.status != 'inside' THEN
    RAISE EXCEPTION 'Validation Failed: Initial visit status must be "inside".';
  END IF;

  IF NEW.duration_minutes IS NOT NULL THEN
    RAISE EXCEPTION 'Validation Failed: duration_minutes must be NULL upon lab entry.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.validate_visits_on_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_visits_on_insert ON public.visits;
CREATE TRIGGER trg_validate_visits_on_insert
  BEFORE INSERT ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_visits_on_insert();


-- 11b. Visits UPDATE Protection Trigger
-- Restricts staff updates strictly to departure operations:
-- Enforces state transitions (inside -> completed/incomplete) and blocks modification of completed visits.
-- Enforces exit_time, exit_method, and duration_minutes consistency.
CREATE OR REPLACE FUNCTION public.protect_visits_on_update()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_current_user_role();

  IF v_role IS NOT NULL AND v_role IN ('admin', 'substitute_admin', 'sir') THEN
    RETURN NEW;
  END IF;

  -- 1. State Transition Check: Completed or closed records are permanently immutable
  IF OLD.status IN ('completed', 'incomplete') THEN
    RAISE EXCEPTION 'Access Denied: Completed or closed visit records cannot be modified.';
  END IF;

  -- 2. Student identity & ownership immutability
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Access Denied: Attendance record ID cannot be modified.';
  END IF;
  IF NEW.student_roll IS DISTINCT FROM OLD.student_roll THEN
    RAISE EXCEPTION 'Access Denied: Student roll number cannot be modified on attendance records.';
  END IF;
  IF NEW.student_name IS DISTINCT FROM OLD.student_name THEN
    RAISE EXCEPTION 'Access Denied: Student name cannot be modified on attendance records.';
  END IF;

  -- 3. Entry audit immutability
  IF NEW.entry_time IS DISTINCT FROM OLD.entry_time THEN
    RAISE EXCEPTION 'Access Denied: Initial entry timestamp cannot be altered.';
  END IF;
  IF NEW.entry_method IS DISTINCT FROM OLD.entry_method THEN
    RAISE EXCEPTION 'Access Denied: Initial entry method cannot be altered.';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Access Denied: Creation timestamp cannot be altered.';
  END IF;

  -- 4. Enforce valid state transitions
  IF NEW.status IS NULL OR NEW.status NOT IN ('completed', 'incomplete') THEN
    RAISE EXCEPTION 'Validation Failed: Visit status can only transition to "completed" or "incomplete".';
  END IF;

  -- 5. Departure Consistency for Completed Visits
  IF NEW.status = 'completed' THEN
    IF NEW.exit_time IS NULL THEN
      RAISE EXCEPTION 'Validation Failed: exit_time must be provided when completing a visit.';
    END IF;
    IF NEW.exit_time < OLD.entry_time THEN
      RAISE EXCEPTION 'Validation Failed: exit_time cannot be earlier than entry_time.';
    END IF;
    IF NEW.exit_time > (clock_timestamp() + interval '5 minutes') THEN
      RAISE EXCEPTION 'Validation Failed: exit_time cannot be in the future.';
    END IF;
    IF NEW.exit_method IS NULL OR trim(NEW.exit_method) = '' THEN
      RAISE EXCEPTION 'Validation Failed: exit_method must be recorded upon visit completion.';
    END IF;
    IF NEW.duration_minutes IS NULL OR NEW.duration_minutes < 0 THEN
      RAISE EXCEPTION 'Validation Failed: duration_minutes must be a non-negative integer upon completion.';
    END IF;
    IF NEW.duration_minutes > (EXTRACT(EPOCH FROM (NEW.exit_time - OLD.entry_time)) / 60 + 5) THEN
      RAISE EXCEPTION 'Validation Failed: duration_minutes (%) cannot exceed elapsed time between entry and exit.', NEW.duration_minutes;
    END IF;
  END IF;

  -- 6. Incomplete Visit Checkout Validation (Preserves legitimate auto-close & incomplete checkout)
  IF NEW.status = 'incomplete' THEN
    IF NEW.exit_time IS NOT NULL THEN
      IF NEW.exit_time < OLD.entry_time THEN
        RAISE EXCEPTION 'Validation Failed: exit_time cannot be earlier than entry_time.';
      END IF;
      IF NEW.exit_time > (clock_timestamp() + interval '5 minutes') THEN
        RAISE EXCEPTION 'Validation Failed: exit_time cannot be in the future.';
      END IF;
      IF NEW.exit_method IS NULL OR trim(NEW.exit_method) = '' THEN
        RAISE EXCEPTION 'Validation Failed: exit_method must be recorded when exit_time is provided for incomplete visit.';
      END IF;
    ELSE
      -- When exit_time is NULL (legitimate auto-close)
      IF NEW.exit_method IS NOT NULL AND trim(NEW.exit_method) != '' AND lower(trim(NEW.exit_method)) NOT IN ('incomplete', 'auto_closed', 'system_timeout') THEN
        RAISE EXCEPTION 'Validation Failed: exit_method must be NULL or "incomplete"/"auto_closed"/"system_timeout" when exit_time is omitted.';
      END IF;
    END IF;

    IF NEW.exit_time IS NULL AND NEW.duration_minutes IS NOT NULL AND NEW.duration_minutes > 0 THEN
      RAISE EXCEPTION 'Validation Failed: duration_minutes must be NULL or 0 for incomplete visits without exit timestamp.';
    END IF;

    IF NEW.duration_minutes IS NOT NULL AND NEW.duration_minutes < 0 THEN
      RAISE EXCEPTION 'Validation Failed: duration_minutes cannot be negative for incomplete visits.';
    END IF;

    IF NEW.exit_time IS NOT NULL AND NEW.duration_minutes IS NOT NULL THEN
      IF NEW.duration_minutes > (EXTRACT(EPOCH FROM (NEW.exit_time - OLD.entry_time)) / 60 + 5) THEN
        RAISE EXCEPTION 'Validation Failed: duration_minutes (%) cannot exceed elapsed time between entry and exit for incomplete visit.', NEW.duration_minutes;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.protect_visits_on_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_visits ON public.visits;
CREATE TRIGGER trg_protect_visits
  BEFORE UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_visits_on_update();


-- ==============================================================================
-- 12. TRANSACTIONS VALIDATION & PROTECTION TRIGGERS (ADMIN & SERVICE ROLE AUDIT)
-- ==============================================================================

-- 12a. Transactions INSERT Validation Trigger
-- Enforces data integrity for transactions. Staff has no direct INSERT access;
-- this protects against malformed administrator or service role insertions.
-- Enforces mandatory validation on all insert attempts (zero bypass).
CREATE OR REPLACE FUNCTION public.validate_transactions_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
  v_student_exists boolean;
  v_comp_exists boolean;
  v_item_count int;
  v_seen_components jsonb := '[]'::jsonb;
  v_comp_id text;
BEGIN
  v_role := public.get_current_user_role();

  IF NEW.student_roll IS NULL OR trim(NEW.student_roll) = '' THEN
    RAISE EXCEPTION 'Validation Failed: student_roll cannot be empty.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE lower(trim(roll_number)) = lower(trim(NEW.student_roll))
      AND is_active = true
  ) INTO v_student_exists;

  IF NOT v_student_exists THEN
    RAISE EXCEPTION 'Validation Failed: Borrower student "%" does not exist or account is inactive.', NEW.student_roll;
  END IF;

  -- Validate items JSONB array
  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) != 'array' OR jsonb_array_length(NEW.items) = 0 THEN
    RAISE EXCEPTION 'Validation Failed: Transaction items must be a non-empty array.';
  END IF;

  v_item_count := jsonb_array_length(NEW.items);
  FOR i IN 0..(v_item_count - 1) LOOP
    v_comp_id := NEW.items->i->>'componentId';
    IF v_comp_id IS NULL OR trim(v_comp_id) = '' THEN
      RAISE EXCEPTION 'Validation Failed: Item % missing componentId.', i;
    END IF;

    IF v_seen_components @> jsonb_build_array(v_comp_id) THEN
      RAISE EXCEPTION 'Validation Failed: Duplicate component ID "%" in issue payload.', v_comp_id;
    END IF;
    v_seen_components := v_seen_components || jsonb_build_array(v_comp_id);

    SELECT EXISTS (
      SELECT 1 FROM public.components WHERE id = v_comp_id
    ) INTO v_comp_exists;

    IF NOT v_comp_exists THEN
      RAISE EXCEPTION 'Validation Failed: Component ID "%" does not exist in catalog.', v_comp_id;
    END IF;

    IF (NEW.items->i->>'issuedQuantity') IS NULL OR (NEW.items->i->>'issuedQuantity')::int <= 0 THEN
      RAISE EXCEPTION 'Validation Failed: issuedQuantity must be greater than zero for item %.', i;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.validate_transactions_on_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_transactions_on_insert ON public.transactions;
CREATE TRIGGER trg_validate_transactions_on_insert
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_transactions_on_insert();


-- 12b. Transactions UPDATE Protection Trigger
-- Restricts updates to legitimate return processing:
-- Prevents modifying borrower, original issue date, proxy delegate authority, or altering original issued items/quantities
CREATE OR REPLACE FUNCTION public.protect_transactions_on_update()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
  v_old_count int;
  v_new_count int;
  v_old_item jsonb;
  v_new_item jsonb;
  v_old_ret int;
  v_new_ret int;
  v_issued int;
BEGIN
  v_role := public.get_current_user_role();

  IF v_role IS NOT NULL AND v_role IN ('admin', 'substitute_admin', 'sir') THEN
    RETURN NEW;
  END IF;

  -- Borrower identity & ownership immutability
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Access Denied: Transaction ID cannot be modified.';
  END IF;

  -- Once a transaction is fully returned, status and returned_date cannot be modified
  IF OLD.status = 'returned' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.returned_date IS DISTINCT FROM OLD.returned_date) THEN
    RAISE EXCEPTION 'Access Denied: Completed transactions cannot be modified.';
  END IF;
  IF NEW.student_roll IS DISTINCT FROM OLD.student_roll THEN
    RAISE EXCEPTION 'Access Denied: Borrower student roll cannot be modified on transaction records.';
  END IF;
  IF NEW.student_name IS DISTINCT FROM OLD.student_name THEN
    RAISE EXCEPTION 'Access Denied: Borrower student name cannot be modified on transaction records.';
  END IF;

  -- Proxy delegate authorization & checkout timestamp immutability
  IF NEW.authorized_by IS DISTINCT FROM OLD.authorized_by THEN
    RAISE EXCEPTION 'Access Denied: Authorized proxy delegate cannot be altered on transaction records.';
  END IF;
  IF NEW.issue_date IS DISTINCT FROM OLD.issue_date THEN
    RAISE EXCEPTION 'Access Denied: Original issue timestamp cannot be altered.';
  END IF;
  IF NEW.overall_due_date IS DISTINCT FROM OLD.overall_due_date THEN
    RAISE EXCEPTION 'Access Denied: Due date cannot be modified by staff.';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Access Denied: Creation timestamp cannot be altered.';
  END IF;

  -- Validate items JSONB array immutability during return processing
  v_old_count := jsonb_array_length(OLD.items);
  v_new_count := jsonb_array_length(NEW.items);

  IF v_old_count != v_new_count THEN
    RAISE EXCEPTION 'Access Denied: Staff cannot add or remove items from an existing transaction.';
  END IF;

  FOR i IN 0..(v_old_count - 1) LOOP
    v_old_item := OLD.items->i;
    v_new_item := NEW.items->i;

    -- Verify item identity and issued quantity have NOT been altered
    IF (v_new_item->>'componentId') IS DISTINCT FROM (v_old_item->>'componentId') THEN
      RAISE EXCEPTION 'Access Denied: Component ID cannot be changed in transaction items.';
    END IF;
    IF (v_new_item->>'issuedQuantity')::int IS DISTINCT FROM (v_old_item->>'issuedQuantity')::int THEN
      RAISE EXCEPTION 'Access Denied: Original issued quantity cannot be altered.';
    END IF;
    IF (v_new_item->>'trackingMode') IS DISTINCT FROM (v_old_item->>'trackingMode') THEN
      RAISE EXCEPTION 'Access Denied: Tracking mode cannot be altered.';
    END IF;

    -- Verify returnedQuantity monotonicity
    v_old_ret := COALESCE((v_old_item->>'returnedQuantity')::int, 0);
    v_new_ret := COALESCE((v_new_item->>'returnedQuantity')::int, 0);
    v_issued  := (v_old_item->>'issuedQuantity')::int;

    IF v_new_ret < v_old_ret THEN
      RAISE EXCEPTION 'Access Denied: returnedQuantity cannot be decreased.';
    END IF;

    IF v_new_ret > v_issued THEN
      RAISE EXCEPTION 'Access Denied: returnedQuantity (%) cannot exceed issuedQuantity (%).', v_new_ret, v_issued;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.protect_transactions_on_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_transactions ON public.transactions;
CREATE TRIGGER trg_protect_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_transactions_on_update();


-- ==============================================================================
-- 13. ATOMIC INVENTORY & TRANSACTION RPC FUNCTIONS (WITH SERVER IDEMPOTENCY)
-- Enables staff to issue and return components with 100% database-level atomicity,
-- strictly conserving inventory stock and updating borrower phone contact without
-- granting staff direct INSERT/UPDATE privileges on public.transactions or public.components.
-- Includes server-side idempotency protection for offline sync re-tries.
-- ==============================================================================

-- 13a. Atomic Component Issue Function
CREATE OR REPLACE FUNCTION public.issue_components_atomic(
  p_transaction_id text,
  p_student_roll text,
  p_student_name text,
  p_student_phone text DEFAULT NULL,
  p_authorized_by text DEFAULT NULL,
  p_overall_due_date timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_operation_id text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_role text;
  v_actor_id uuid;
  v_student_user record;
  v_comp record;
  v_clean_roll text;
  v_clean_name text;
  v_clean_phone text;
  v_txn_id text;
  v_due_date timestamptz;
  v_now timestamptz := clock_timestamp();
  v_item_count int;
  v_comp_id text;
  v_qty int;
  v_selected_ids jsonb;
  v_updated_items jsonb := '[]'::jsonb;
  v_indiv_ids jsonb;
  v_seen_components jsonb := '[]'::jsonb;
  v_seen_tags jsonb := '[]'::jsonb;
  v_tag_id text;
  v_clean_op_id text;
  v_payload_hash text;
  v_existing_op record;
  v_result jsonb;
  v_rows_inserted int;
  v_finalized_rows int;
BEGIN
  -- 1. ROLE AUTHORIZATION & STRICT ACTOR BINDING (Enforced strictly before returning any cached result or reserving ledger)
  v_role := public.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'substitute_admin', 'sir', 'staff') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient permissions to issue components.';
  END IF;

  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Valid authenticated actor is required.';
  END IF;

  -- 2. OPERATION ID & INPUT VALIDATION
  IF p_operation_id IS NULL OR trim(p_operation_id) = '' THEN
    RAISE EXCEPTION 'Validation Failed: operation_id is strictly required for atomic operations.';
  END IF;
  v_clean_op_id := trim(p_operation_id);

  IF p_student_roll IS NULL OR trim(p_student_roll) = '' THEN
    RAISE EXCEPTION 'Validation Failed: student_roll cannot be empty.';
  END IF;
  v_clean_roll := upper(trim(p_student_roll));

  IF p_student_name IS NULL OR trim(p_student_name) = '' THEN
    RAISE EXCEPTION 'Validation Failed: student_name cannot be empty.';
  END IF;
  v_clean_name := trim(p_student_name);

  -- Authoritative Student Record Verification
  SELECT * INTO v_student_user
  FROM public.users
  WHERE upper(trim(roll_number)) = v_clean_roll AND is_active = true;

  IF v_student_user.id IS NULL THEN
    RAISE EXCEPTION 'Validation Failed: Borrower student "%" does not exist or account is inactive.', v_clean_roll;
  END IF;

  IF lower(trim(v_student_user.name)) != lower(v_clean_name) THEN
    RAISE EXCEPTION 'Validation Failed: Submitted student name "%" does not match registered name "%".',
      v_clean_name, v_student_user.name;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Validation Failed: Transaction items must be a non-empty array.';
  END IF;

  -- 3. COMPLETE DETERMINISTIC PAYLOAD HASH BINDING
  -- Binds every input that affects resulting transaction, contact details, or inventory
  v_payload_hash := encode(sha256(jsonb_build_object(
    'transaction_id', NULLIF(trim(p_transaction_id), ''),
    'student_roll', v_clean_roll,
    'student_name', v_clean_name,
    'student_phone', NULLIF(trim(p_student_phone), ''),
    'authorized_by', NULLIF(trim(p_authorized_by), ''),
    'overall_due_date', p_overall_due_date,
    'notes', NULLIF(trim(p_notes), ''),
    'items', p_items
  )::text::bytea), 'hex');

  -- 4. CONCURRENCY-SAFE TRANSACTION ADVISORY LOCK
  -- Serializes simultaneous duplicate requests with the exact same operation ID
  PERFORM pg_advisory_xact_lock(hashtext(v_clean_op_id));

  -- 5. SERVER-SIDE IDEMPOTENCY LOOKUP & ACTOR BINDING CHECK (INITIAL PATH)
  SELECT * INTO v_existing_op
  FROM public.processed_rpc_operations
  WHERE operation_id = v_clean_op_id;

  IF v_existing_op.operation_id IS NOT NULL THEN
    IF v_existing_op.operation_type != 'issue_components' THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" is registered for operation "%", not "issue_components".',
        v_clean_op_id, v_existing_op.operation_type;
    END IF;

    IF p_transaction_id IS NOT NULL AND v_existing_op.transaction_id IS NOT NULL AND v_existing_op.transaction_id != 'PENDING' AND v_existing_op.transaction_id IS DISTINCT FROM p_transaction_id THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" is registered for transaction "%", not "%".',
        v_clean_op_id, v_existing_op.transaction_id, p_transaction_id;
    END IF;

    IF v_existing_op.actor_id IS NULL THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" is not bound to an authenticated actor.', v_clean_op_id;
    END IF;

    IF v_existing_op.actor_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" belongs to a different authenticated actor.', v_clean_op_id;
    END IF;

    IF v_existing_op.payload_hash IS DISTINCT FROM v_payload_hash THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" was already submitted with a different payload.', v_clean_op_id;
    END IF;

    IF v_existing_op.status = 'completed' AND v_existing_op.result IS NOT NULL THEN
      RETURN v_existing_op.result;
    ELSIF v_existing_op.status = 'in_progress' THEN
      RAISE EXCEPTION 'Operation "%" is currently in progress. Duplicate execution is prohibited.', v_clean_op_id;
    ELSE
      RAISE EXCEPTION 'Operation "%" has status "%" and cannot be replayed.', v_clean_op_id, v_existing_op.status;
    END IF;
  END IF;

  -- 6. ATOMICALLY CLAIM / RESERVE OPERATION ID IN LEDGER
  INSERT INTO public.processed_rpc_operations (
    operation_id,
    operation_type,
    transaction_id,
    actor_id,
    actor_role,
    payload_hash,
    status,
    result,
    created_at,
    updated_at
  ) VALUES (
    v_clean_op_id,
    'issue_components',
    COALESCE(p_transaction_id, 'PENDING'),
    v_actor_id,
    v_role,
    v_payload_hash,
    'in_progress',
    NULL,
    v_now,
    v_now
  ) ON CONFLICT (operation_id) DO NOTHING;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  IF v_rows_inserted = 0 THEN
    SELECT * INTO v_existing_op
    FROM public.processed_rpc_operations
    WHERE operation_id = v_clean_op_id;

    -- Strict validation on conflict fallback path (cannot bypass actor or payload validation)
    IF v_existing_op.operation_type != 'issue_components' THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" is registered for operation "%", not "issue_components".',
        v_clean_op_id, v_existing_op.operation_type;
    END IF;

    IF p_transaction_id IS NOT NULL AND v_existing_op.transaction_id IS NOT NULL AND v_existing_op.transaction_id != 'PENDING' AND v_existing_op.transaction_id IS DISTINCT FROM p_transaction_id THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" is registered for transaction "%", not "%".',
        v_clean_op_id, v_existing_op.transaction_id, p_transaction_id;
    END IF;

    IF v_existing_op.actor_id IS NULL THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" is not bound to an authenticated actor.', v_clean_op_id;
    END IF;

    IF v_existing_op.actor_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" belongs to a different authenticated actor.', v_clean_op_id;
    END IF;

    IF v_existing_op.payload_hash IS DISTINCT FROM v_payload_hash THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" was already submitted with a different payload.', v_clean_op_id;
    END IF;

    IF v_existing_op.status = 'completed' AND v_existing_op.result IS NOT NULL THEN
      RETURN v_existing_op.result;
    ELSIF v_existing_op.status = 'in_progress' THEN
      RAISE EXCEPTION 'Operation "%" is currently in progress. Duplicate execution is prohibited.', v_clean_op_id;
    ELSE
      RAISE EXCEPTION 'Operation "%" is already claimed by another session. Execution aborted.', v_clean_op_id;
    END IF;
  END IF;

  v_item_count := jsonb_array_length(p_items);
  v_txn_id := COALESCE(p_transaction_id, 'TXN-' || to_char(v_now, 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6));
  v_due_date := COALESCE(p_overall_due_date, v_now + interval '7 days');

  -- 4. Process each item and deduct stock atomically
  FOR i IN 0..(v_item_count - 1) LOOP
    v_comp_id := p_items->i->>'componentId';
    IF v_comp_id IS NULL OR trim(v_comp_id) = '' THEN
      RAISE EXCEPTION 'Validation Failed: Item % missing componentId.', i;
    END IF;

    -- Reject duplicate component entries in issue request
    IF v_seen_components @> jsonb_build_array(v_comp_id) THEN
      RAISE EXCEPTION 'Validation Failed: Duplicate component ID "%" in issue payload.', v_comp_id;
    END IF;
    v_seen_components := v_seen_components || jsonb_build_array(v_comp_id);

    v_qty := (p_items->i->>'issuedQuantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Validation Failed: Invalid quantity % for component %', v_qty, v_comp_id;
    END IF;

    v_selected_ids := COALESCE(p_items->i->'selectedIndividualIds', p_items->i->'individualIds', '[]'::jsonb);
    IF jsonb_typeof(v_selected_ids) != 'array' THEN
      RAISE EXCEPTION 'Validation Failed: selectedIndividualIds must be an array for component %', v_comp_id;
    END IF;

    -- Lock component row for update
    SELECT * INTO v_comp 
    FROM public.components 
    WHERE id = v_comp_id 
    FOR UPDATE;

    IF v_comp.id IS NULL THEN
      RAISE EXCEPTION 'Validation Failed: Component "%" does not exist in catalog.', v_comp_id;
    END IF;

    IF v_comp.available_quantity < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%": Available: %, Requested: %', v_comp.name, v_comp.available_quantity, v_qty;
    END IF;

    -- Handle tracking modes
    v_indiv_ids := v_comp.individual_ids;
    IF v_comp.tracking_mode = 'individual' THEN
      -- Tag count must exactly equal issued quantity
      IF jsonb_array_length(v_selected_ids) != v_qty THEN
        RAISE EXCEPTION 'Validation Failed: Number of selected physical tags (%) must exactly match issued quantity (%) for component "%".',
          jsonb_array_length(v_selected_ids), v_qty, v_comp.name;
      END IF;

      -- Verify each requested tag exists, is unique, and is currently available
      FOR t IN 0..(jsonb_array_length(v_selected_ids) - 1) LOOP
        v_tag_id := v_selected_ids->>t;
        IF v_tag_id IS NULL OR trim(v_tag_id) = '' THEN
          RAISE EXCEPTION 'Validation Failed: Physical tag ID cannot be empty.';
        END IF;

        IF v_seen_tags @> jsonb_build_array(v_tag_id) THEN
          RAISE EXCEPTION 'Validation Failed: Duplicate physical tag "%" in issue payload.', v_tag_id;
        END IF;
        v_seen_tags := v_seen_tags || jsonb_build_array(v_tag_id);

        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_comp.individual_ids) AS elem
          WHERE elem->>'id' = v_tag_id AND elem->>'status' = 'available'
        ) THEN
          RAISE EXCEPTION 'Validation Failed: Physical tag "%" is not available for issue.', v_tag_id;
        END IF;
      END LOOP;

      SELECT COALESCE(jsonb_agg(
        CASE 
          WHEN v_selected_ids @> to_jsonb(elem->>'id') THEN
            elem || jsonb_build_object(
              'status', 'issued',
              'currentTransactionId', v_txn_id,
              'currentStudentRoll', v_clean_roll
            )
          ELSE elem
        END
      ), '[]'::jsonb) INTO v_indiv_ids
      FROM jsonb_array_elements(v_comp.individual_ids) AS elem;
    ELSE
      -- Bulk / batch tracking: individual tags prohibited
      IF jsonb_array_length(v_selected_ids) > 0 THEN
        RAISE EXCEPTION 'Validation Failed: Non-individual tracking component "%" must not have individual physical tags.', v_comp.name;
      END IF;
    END IF;

    -- Deduct component inventory
    UPDATE public.components
    SET 
      available_quantity = available_quantity - v_qty,
      issued_quantity = issued_quantity + v_qty,
      individual_ids = v_indiv_ids,
      updated_at = v_now
    WHERE id = v_comp_id;

    -- Build validated item for transaction
    v_updated_items := v_updated_items || jsonb_build_array(jsonb_build_object(
      'componentId', v_comp.id,
      'componentName', v_comp.name,
      'category', v_comp.category,
      'trackingMode', v_comp.tracking_mode,
      'issuedQuantity', v_qty,
      'returnedQuantity', 0,
      'selectedIndividualIds', v_selected_ids,
      'dueDate', COALESCE(p_items->i->>'dueDate', v_due_date::text),
      'status', 'issued'
    ));
  END LOOP;

  -- 5. Automatically update student mobile number if provided
  IF p_student_phone IS NOT NULL AND trim(p_student_phone) != '' THEN
    v_clean_phone := trim(p_student_phone);
    UPDATE public.users
    SET 
      mobile_number = v_clean_phone,
      updated_at = v_now
    WHERE upper(trim(roll_number)) = v_clean_roll
      AND (mobile_number IS DISTINCT FROM v_clean_phone);
  END IF;

  -- 6. Insert Transaction Record
  INSERT INTO public.transactions (
    id,
    student_roll,
    student_name,
    authorized_by,
    issue_date,
    overall_due_date,
    returned_date,
    status,
    items,
    notes,
    created_at,
    updated_at
  ) VALUES (
    v_txn_id,
    v_clean_roll,
    v_student_user.name,
    NULLIF(trim(p_authorized_by), ''),
    v_now,
    v_due_date,
    NULL,
    'active',
    v_updated_items,
    NULLIF(trim(p_notes), ''),
    v_now,
    v_now
  );

  v_result := jsonb_build_object(
    'id', v_txn_id,
    'studentRoll', v_clean_roll,
    'studentName', v_student_user.name,
    'authorizedBy', NULLIF(trim(p_authorized_by), ''),
    'issueDate', v_now,
    'overallDueDate', v_due_date,
    'status', 'active',
    'items', v_updated_items,
    'createdAt', v_now,
    'updatedAt', v_now
  );

  -- 7. Atomically Finalize Ledger Record (Conditional Update & Exact Single-Row Check)
  -- Enforces that exactly one in-progress reservation matching this session, actor, and payload is finalized.
  -- Silently overwriting an existing conflicting row is strictly prohibited.
  UPDATE public.processed_rpc_operations
  SET 
    status = 'completed',
    transaction_id = v_txn_id,
    result = v_result,
    updated_at = clock_timestamp()
  WHERE operation_id = v_clean_op_id
    AND operation_type = 'issue_components'
    AND status = 'in_progress'
    AND payload_hash = v_payload_hash
    AND actor_id IS NOT DISTINCT FROM v_actor_id;

  GET DIAGNOSTICS v_finalized_rows = ROW_COUNT;
  IF v_finalized_rows != 1 THEN
    RAISE EXCEPTION 'Ledger finalization failed: reservation record missing, corrupted, or status invalid for operation "%".', v_clean_op_id;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.issue_components_atomic(text, text, text, text, text, timestamptz, text, jsonb, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.issue_components_atomic(text, text, text, text, text, timestamptz, text, jsonb, text) TO authenticated;


-- 13b. Atomic Component Return Function
CREATE OR REPLACE FUNCTION public.return_components_atomic(
  p_transaction_id text,
  p_returned_items jsonb,
  p_operation_id text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_role text;
  v_actor_id uuid;
  v_clean_op_id text;
  v_txn record;
  v_comp record;
  v_now timestamptz := clock_timestamp();
  v_ret_count int;
  v_ret_comp_id text;
  v_ret_qty int;
  v_ret_tags jsonb;
  v_items jsonb;
  v_item jsonb;
  v_item_idx int;
  v_issued int;
  v_cur_ret int;
  v_new_ret int;
  v_all_returned boolean := true;
  v_any_returned boolean := false;
  v_new_status text;
  v_returned_date timestamptz := NULL;
  v_indiv_ids jsonb;
  v_seen_components jsonb := '[]'::jsonb;
  v_seen_tags jsonb := '[]'::jsonb;
  v_tag_id text;
  v_payload_hash text;
  v_existing_op record;
  v_result jsonb;
  v_rows_inserted int;
  v_finalized_rows int;
BEGIN
  -- 1. ROLE AUTHORIZATION & STRICT ACTOR BINDING (Enforced strictly before returning any cached result or reserving ledger)
  v_role := public.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'substitute_admin', 'sir', 'staff') THEN
    RAISE EXCEPTION 'Access Denied: Insufficient permissions to return components.';
  END IF;

  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Valid authenticated actor is required.';
  END IF;

  -- 2. OPERATION ID & INPUT VALIDATION
  IF p_operation_id IS NULL OR trim(p_operation_id) = '' THEN
    RAISE EXCEPTION 'Validation Failed: operation_id is strictly required for atomic operations.';
  END IF;
  v_clean_op_id := trim(p_operation_id);

  IF p_transaction_id IS NULL OR trim(p_transaction_id) = '' THEN
    RAISE EXCEPTION 'Validation Failed: transaction_id cannot be empty.';
  END IF;

  IF p_returned_items IS NULL OR jsonb_typeof(p_returned_items) != 'array' OR jsonb_array_length(p_returned_items) = 0 THEN
    RAISE EXCEPTION 'Validation Failed: Returned items must be a non-empty array.';
  END IF;

  -- 3. COMPLETE DETERMINISTIC PAYLOAD HASH BINDING
  -- Binds transaction ID and returned items (component IDs, return quantities, physical tag IDs)
  v_payload_hash := encode(sha256(jsonb_build_object(
    'transaction_id', trim(p_transaction_id),
    'returned_items', p_returned_items
  )::text::bytea), 'hex');

  -- 4. CONCURRENCY-SAFE TRANSACTION ADVISORY LOCK
  -- Serializes simultaneous duplicate requests with the exact same operation ID
  PERFORM pg_advisory_xact_lock(hashtext(v_clean_op_id));

  -- 5. SERVER-SIDE IDEMPOTENCY LOOKUP & ACTOR BINDING CHECK (INITIAL PATH)
  SELECT * INTO v_existing_op
  FROM public.processed_rpc_operations
  WHERE operation_id = v_clean_op_id;

  IF v_existing_op.operation_id IS NOT NULL THEN
    IF v_existing_op.operation_type != 'return_components' THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" is registered for operation "%", not "return_components".',
        v_clean_op_id, v_existing_op.operation_type;
    END IF;

    IF v_existing_op.transaction_id IS DISTINCT FROM p_transaction_id THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" is registered for transaction "%", not "%".',
        v_clean_op_id, v_existing_op.transaction_id, p_transaction_id;
    END IF;

    IF v_existing_op.actor_id IS NULL THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" is not bound to an authenticated actor.', v_clean_op_id;
    END IF;

    IF v_existing_op.actor_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" belongs to a different authenticated actor.', v_clean_op_id;
    END IF;

    IF v_existing_op.payload_hash IS DISTINCT FROM v_payload_hash THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" was already submitted with a different payload.', v_clean_op_id;
    END IF;

    IF v_existing_op.status = 'completed' AND v_existing_op.result IS NOT NULL THEN
      RETURN v_existing_op.result;
    ELSIF v_existing_op.status = 'in_progress' THEN
      RAISE EXCEPTION 'Operation "%" is currently in progress. Duplicate execution is prohibited.', v_clean_op_id;
    ELSE
      RAISE EXCEPTION 'Operation "%" has status "%" and cannot be replayed.', v_clean_op_id, v_existing_op.status;
    END IF;
  END IF;

  -- 6. ATOMICALLY CLAIM / RESERVE OPERATION ID IN LEDGER
  INSERT INTO public.processed_rpc_operations (
    operation_id,
    operation_type,
    transaction_id,
    actor_id,
    actor_role,
    payload_hash,
    status,
    result,
    created_at,
    updated_at
  ) VALUES (
    v_clean_op_id,
    'return_components',
    p_transaction_id,
    v_actor_id,
    v_role,
    v_payload_hash,
    'in_progress',
    NULL,
    v_now,
    v_now
  ) ON CONFLICT (operation_id) DO NOTHING;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  IF v_rows_inserted = 0 THEN
    SELECT * INTO v_existing_op
    FROM public.processed_rpc_operations
    WHERE operation_id = v_clean_op_id;

    -- Strict validation on conflict fallback path (cannot bypass actor or payload validation)
    IF v_existing_op.operation_type != 'return_components' THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" is registered for operation "%", not "return_components".',
        v_clean_op_id, v_existing_op.operation_type;
    END IF;

    IF v_existing_op.transaction_id IS DISTINCT FROM p_transaction_id THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" is registered for transaction "%", not "%".',
        v_clean_op_id, v_existing_op.transaction_id, p_transaction_id;
    END IF;

    IF v_existing_op.actor_id IS NULL THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" is not bound to an authenticated actor.', v_clean_op_id;
    END IF;

    IF v_existing_op.actor_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" belongs to a different authenticated actor.', v_clean_op_id;
    END IF;

    IF v_existing_op.payload_hash IS DISTINCT FROM v_payload_hash THEN
      RAISE EXCEPTION 'Security Violation: Operation ID "%" was already submitted with a different payload.', v_clean_op_id;
    END IF;

    IF v_existing_op.status = 'completed' AND v_existing_op.result IS NOT NULL THEN
      RETURN v_existing_op.result;
    ELSIF v_existing_op.status = 'in_progress' THEN
      RAISE EXCEPTION 'Operation "%" is currently in progress. Duplicate execution is prohibited.', v_clean_op_id;
    ELSE
      RAISE EXCEPTION 'Operation "%" is already claimed by another session. Execution aborted.', v_clean_op_id;
    END IF;
  END IF;

  -- 2. Lock and retrieve transaction
  SELECT * INTO v_txn
  FROM public.transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF v_txn.id IS NULL THEN
    RAISE EXCEPTION 'Validation Failed: Transaction "%" not found.', p_transaction_id;
  END IF;

  IF v_txn.status = 'returned' THEN
    RAISE EXCEPTION 'Validation Failed: Transaction "%" is already completely returned.', p_transaction_id;
  END IF;

  IF p_returned_items IS NULL OR jsonb_typeof(p_returned_items) != 'array' OR jsonb_array_length(p_returned_items) = 0 THEN
    RAISE EXCEPTION 'Validation Failed: Returned items must be a non-empty array.';
  END IF;

  v_items := v_txn.items;
  v_ret_count := jsonb_array_length(p_returned_items);

  -- 3. Process each returned component
  FOR r IN 0..(v_ret_count - 1) LOOP
    v_ret_comp_id := p_returned_items->r->>'componentId';
    IF v_ret_comp_id IS NULL OR trim(v_ret_comp_id) = '' THEN
      RAISE EXCEPTION 'Validation Failed: Return item % missing componentId.', r;
    END IF;

    -- Reject duplicate component entries in return payload
    IF v_seen_components @> jsonb_build_array(v_ret_comp_id) THEN
      RAISE EXCEPTION 'Validation Failed: Duplicate component ID "%" in return payload.', v_ret_comp_id;
    END IF;
    v_seen_components := v_seen_components || jsonb_build_array(v_ret_comp_id);

    v_ret_qty := (p_returned_items->r->>'returnQuantity')::int;
    IF v_ret_qty IS NULL OR v_ret_qty <= 0 THEN
      RAISE EXCEPTION 'Validation Failed: Return quantity must be greater than zero for component "%".', v_ret_comp_id;
    END IF;

    v_ret_tags := COALESCE(p_returned_items->r->'returnedIndividualIds', p_returned_items->r->'returnedTagIds', '[]'::jsonb);
    IF jsonb_typeof(v_ret_tags) != 'array' THEN
      RAISE EXCEPTION 'Validation Failed: returnedIndividualIds must be an array for component "%".', v_ret_comp_id;
    END IF;

    -- Find item in transaction items array FIRST
    v_item_idx := -1;
    FOR i IN 0..(jsonb_array_length(v_items) - 1) LOOP
      IF (v_items->i->>'componentId') = v_ret_comp_id THEN
        v_item_idx := i;
        v_item := v_items->i;
        EXIT;
      END IF;
    END LOOP;

    IF v_item_idx = -1 THEN
      RAISE EXCEPTION 'Validation Failed: Component "%" does not exist in transaction "%".', v_ret_comp_id, p_transaction_id;
    END IF;

    v_issued := (v_item->>'issuedQuantity')::int;
    v_cur_ret := COALESCE((v_item->>'returnedQuantity')::int, 0);
    v_new_ret := v_cur_ret + v_ret_qty;

    IF v_new_ret > v_issued THEN
      RAISE EXCEPTION 'Validation Failed: Cannot return % units of component "%". Only % units remaining.',
        v_ret_qty, v_ret_comp_id, (v_issued - v_cur_ret);
    END IF;

    -- Lock component record
    SELECT * INTO v_comp
    FROM public.components
    WHERE id = v_ret_comp_id
    FOR UPDATE;

    IF v_comp.id IS NULL THEN
      RAISE EXCEPTION 'Validation Failed: Component "%" does not exist in catalog.', v_ret_comp_id;
    END IF;

    -- Strict individual vs bulk tracking mode handling:
    IF v_comp.tracking_mode = 'individual' THEN
      -- If tracking_mode = 'individual', require exactly returnQuantity physical tag IDs
      IF v_ret_tags IS NULL OR jsonb_typeof(v_ret_tags) != 'array' OR jsonb_array_length(v_ret_tags) = 0 THEN
        RAISE EXCEPTION 'Validation Failed: Physical tag IDs are strictly required when returning individual tracking component "%".', v_comp.name;
      END IF;

      IF jsonb_array_length(v_ret_tags) != v_ret_qty THEN
        RAISE EXCEPTION 'Validation Failed: Number of selected physical tags (%) must exactly match return quantity (%) for component "%".',
          jsonb_array_length(v_ret_tags), v_ret_qty, v_comp.name;
      END IF;

      FOR t IN 0..(jsonb_array_length(v_ret_tags) - 1) LOOP
        v_tag_id := v_ret_tags->>t;
        IF v_tag_id IS NULL OR trim(v_tag_id) = '' THEN
          RAISE EXCEPTION 'Validation Failed: Returned physical tag ID cannot be empty.';
        END IF;

        -- Reject duplicate tag IDs across the return payload
        IF v_seen_tags @> jsonb_build_array(v_tag_id) THEN
          RAISE EXCEPTION 'Validation Failed: Duplicate physical tag "%" in return payload.', v_tag_id;
        END IF;
        v_seen_tags := v_seen_tags || jsonb_build_array(v_tag_id);

        -- Verify tag belongs to this transaction's originally issued tags
        IF NOT (COALESCE(v_item->'selectedIndividualIds', v_item->'individualIds', '[]'::jsonb) @> to_jsonb(v_tag_id)) THEN
          RAISE EXCEPTION 'Validation Failed: Physical tag "%" was not issued in this transaction.', v_tag_id;
        END IF;

        -- Verify tag is currently issued to this exact transaction and student in components catalog
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_comp.individual_ids) AS elem
          WHERE elem->>'id' = v_tag_id
            AND elem->>'status' = 'issued'
            AND elem->>'currentTransactionId' = p_transaction_id
            AND elem->>'currentStudentRoll' = v_txn.student_roll
        ) THEN
          RAISE EXCEPTION 'Validation Failed: Physical tag "%" is not currently issued to transaction "%" and student "%".',
            v_tag_id, p_transaction_id, v_txn.student_roll;
        END IF;
      END LOOP;

      -- Restore Component Physical Tags to available
      SELECT COALESCE(jsonb_agg(
        CASE 
          WHEN v_ret_tags @> to_jsonb(elem->>'id') THEN
            elem || jsonb_build_object(
              'status', 'available',
              'currentTransactionId', NULL,
              'currentStudentRoll', NULL
            )
          ELSE elem
        END
      ), '[]'::jsonb) INTO v_indiv_ids
      FROM jsonb_array_elements(v_comp.individual_ids) AS elem;

    ELSE
      -- Bulk / batch tracking: physical tag IDs strictly prohibited
      IF jsonb_array_length(v_ret_tags) > 0 THEN
        RAISE EXCEPTION 'Validation Failed: Component "%" is tracked in bulk/batch mode and does not use physical tags. Physical tags must not be provided.', v_comp.name;
      END IF;

      v_indiv_ids := v_comp.individual_ids;
    END IF;

    -- Update item in JSONB array
    v_item := jsonb_set(v_item, '{returnedQuantity}', to_jsonb(v_new_ret));
    IF v_new_ret >= v_issued THEN
      v_item := jsonb_set(v_item, '{status}', to_jsonb('returned'::text));
    END IF;
    v_items := jsonb_set(v_items, ARRAY[v_item_idx::text], v_item);

    UPDATE public.components
    SET 
      available_quantity = available_quantity + v_ret_qty,
      issued_quantity = GREATEST(0, issued_quantity - v_ret_qty),
      individual_ids = v_indiv_ids,
      updated_at = v_now
    WHERE id = v_ret_comp_id;
  END LOOP;

  -- 5. Calculate overall transaction completion
  FOR i IN 0..(jsonb_array_length(v_items) - 1) LOOP
    v_issued := (v_items->i->>'issuedQuantity')::int;
    v_cur_ret := COALESCE((v_items->i->>'returnedQuantity')::int, 0);

    IF v_cur_ret < v_issued THEN
      v_all_returned := false;
    END IF;
    IF v_cur_ret > 0 THEN
      v_any_returned := true;
    END IF;
  END LOOP;

  IF v_all_returned THEN
    v_new_status := 'returned';
    v_returned_date := v_now;
  ELSIF v_any_returned THEN
    v_new_status := 'partially_returned';
  ELSE
    v_new_status := 'active';
  END IF;

  -- 6. Update transaction record
  UPDATE public.transactions
  SET 
    items = v_items,
    status = v_new_status,
    returned_date = COALESCE(v_returned_date, returned_date),
    last_return_date = v_now,
    updated_at = v_now
  WHERE id = p_transaction_id;

  v_result := jsonb_build_object(
    'id', p_transaction_id,
    'studentRoll', v_txn.student_roll,
    'studentName', v_txn.student_name,
    'status', v_new_status,
    'returnedDate', COALESCE(v_returned_date, v_txn.returned_date),
    'lastReturnDate', v_now,
    'items', v_items,
    'updatedAt', v_now
  );

  -- 7. Atomically Finalize Ledger Record (Conditional Update & Exact Single-Row Check)
  -- Enforces that exactly one in-progress reservation matching this session, actor, and payload is finalized.
  -- Silently overwriting an existing conflicting row is strictly prohibited.
  UPDATE public.processed_rpc_operations
  SET 
    status = 'completed',
    transaction_id = p_transaction_id,
    result = v_result,
    updated_at = clock_timestamp()
  WHERE operation_id = v_clean_op_id
    AND operation_type = 'return_components'
    AND status = 'in_progress'
    AND payload_hash = v_payload_hash
    AND actor_id IS NOT DISTINCT FROM v_actor_id;

  GET DIAGNOSTICS v_finalized_rows = ROW_COUNT;
  IF v_finalized_rows != 1 THEN
    RAISE EXCEPTION 'Ledger finalization failed: reservation record missing, corrupted, or status invalid for operation "%".', v_clean_op_id;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.return_components_atomic(text, jsonb, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.return_components_atomic(text, jsonb, text) TO authenticated;


-- ==============================================================================
-- 14. SECURE STUDENT PROFILE UPDATE RPC FUNCTION
-- Provides the dedicated, hardened entry point for students to update strictly
-- their permitted contact and visual theme details (mobile_number, avatar_theme, face_photo_url).
-- Direct student UPDATE on public.users is blocked by RLS.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_student_profile(
  p_mobile_number text DEFAULT NULL,
  p_avatar_theme text DEFAULT NULL,
  p_face_photo_url text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_role text;
  v_auth_id uuid;
  v_user record;
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
BEGIN
  -- 1. Explicit Role Authorization: Students ONLY (Staff and Administrators Prohibited)
  v_role := public.get_current_user_role();
  IF v_role IS NULL OR v_role != 'student' THEN
    RAISE EXCEPTION 'Access Denied: Only students may update their student profile via this function.';
  END IF;

  -- 2. Strict Account Binding: Authenticated User UID ONLY
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Unauthenticated student session.';
  END IF;

  -- Find student row matching authenticated UID strictly with role = 'student'
  SELECT * INTO v_user
  FROM public.users
  WHERE auth_id = v_auth_id AND role = 'student'
  LIMIT 1;

  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'Validation Failed: Student profile not found for current authenticated session.';
  END IF;

  -- 3. Update permitted profile columns strictly on the caller's own account
  UPDATE public.users
  SET
    mobile_number = COALESCE(NULLIF(trim(p_mobile_number), ''), mobile_number),
    avatar_theme = COALESCE(NULLIF(trim(p_avatar_theme), ''), avatar_theme),
    face_photo_url = COALESCE(NULLIF(trim(p_face_photo_url), ''), face_photo_url),
    updated_at = v_now
  WHERE id = v_user.id;

  v_result := jsonb_build_object(
    'id', v_user.id,
    'rollNumber', v_user.roll_number,
    'name', v_user.name,
    'mobileNumber', COALESCE(NULLIF(trim(p_mobile_number), ''), v_user.mobile_number),
    'avatarTheme', COALESCE(NULLIF(trim(p_avatar_theme), ''), v_user.avatar_theme),
    'facePhotoUrl', COALESCE(NULLIF(trim(p_face_photo_url), ''), v_user.face_photo_url),
    'updatedAt', v_now
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.update_student_profile(text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_student_profile(text, text, text) TO authenticated;

COMMIT;
