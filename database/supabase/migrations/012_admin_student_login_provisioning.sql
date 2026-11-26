-- ==============================================================================
-- 012_admin_student_login_provisioning.sql
-- Safe & Idempotent Migration: Admin Account Login Provisioning RPC
--
-- Purpose:
--   Allows authorized Administrators / Sir / Substitute Admins to atomically
--   provision or link a Supabase Auth account (auth_id) to a public.users
--   profile and student_roster entry without requiring direct table INSERT
--   privileges on public.users (which remain revoked under Migration 007).
--   Enables local dev servers (Vite) and account repair tools to generate real
--   student logins safely under full server-side RBAC enforcement.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_provision_user_profile(
  p_auth_id uuid,
  p_roll_number text,
  p_name text,
  p_role text DEFAULT 'student',
  p_mobile_number text DEFAULT '',
  p_department text DEFAULT 'Electronics & Communication Engineering',
  p_branch text DEFAULT 'ECE',
  p_section text DEFAULT 'A',
  p_academic_year integer DEFAULT 1,
  p_face_registered boolean DEFAULT false,
  p_face_photo_url text DEFAULT NULL,
  p_incubation_start_date date DEFAULT NULL,
  p_academic_year_at_start integer DEFAULT 1,
  p_retention_period_years integer DEFAULT 4,
  p_retention_end_date date DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_caller_auth_id uuid;
  v_caller_role text;
  v_caller_active boolean;
  v_caller_name text;
  v_clean_roll text;
  v_clean_name text;
  v_target_role text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_existing_user public.users%ROWTYPE;
  v_user_id text;
  v_roster_id uuid;
  v_dept text;
  v_branch text;
  v_section text;
  v_start_date date;
  v_start_year integer;
  v_retention_years integer;
  v_result public.users%ROWTYPE;
BEGIN
  -- 1. Caller Authentication & Authorization Check
  IF auth.role() = 'service_role' THEN
    v_caller_role := 'service_role';
    v_caller_name := 'Backend Service Role';
  ELSE
    v_caller_auth_id := auth.uid();
    IF v_caller_auth_id IS NULL THEN
      RAISE EXCEPTION 'Access Denied: Authentication required to provision user profiles.';
    END IF;

    v_caller_role := public.get_current_user_role();
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'substitute_admin', 'sir') THEN
      RAISE EXCEPTION 'Access Denied: Only authorized administrators can provision user accounts.';
    END IF;

    SELECT is_active, COALESCE(name, 'Administrator')
    INTO v_caller_active, v_caller_name
    FROM public.users
    WHERE auth_id = v_caller_auth_id
    LIMIT 1;

    IF v_caller_active IS FALSE THEN
      RAISE EXCEPTION 'Access Denied: Caller account is deactivated.';
    END IF;
  END IF;

  -- 2. Input & Privilege Validation
  IF p_auth_id IS NULL THEN
    RAISE EXCEPTION 'Invalid Payload: auth_id is required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_id) THEN
    RAISE EXCEPTION 'Invalid Payload: Referenced Supabase Auth identity does not exist.';
  END IF;

  v_clean_roll := UPPER(TRIM(COALESCE(p_roll_number, '')));
  v_clean_name := TRIM(COALESCE(p_name, ''));
  v_target_role := LOWER(TRIM(COALESCE(p_role, 'student')));

  IF v_clean_roll = '' OR v_clean_name = '' THEN
    RAISE EXCEPTION 'Invalid Payload: roll_number and name are required.';
  END IF;

  IF v_target_role NOT IN ('student', 'staff', 'substitute_admin', 'admin', 'sir') THEN
    RAISE EXCEPTION 'Invalid Payload: Unsupported target role "%".', v_target_role;
  END IF;

  IF v_caller_role = 'substitute_admin' AND v_target_role NOT IN ('student', 'staff') THEN
    RAISE EXCEPTION 'Access Denied: Substitute admins can only provision student or staff accounts.';
  END IF;

  IF v_target_role = 'sir' AND v_caller_role != 'sir' THEN
    RAISE EXCEPTION 'Access Denied: Only sir may provision a sir account.';
  END IF;

  IF v_target_role = 'student' AND v_clean_roll IN ('ADMIN', 'SUBADMIN', 'SIR', 'STAFF', 'SUPERVISOR') THEN
    RAISE EXCEPTION 'Invalid Roll Number: Reserved administrative identifier.';
  END IF;

  v_dept := COALESCE(NULLIF(TRIM(p_department), ''), 'Electronics & Communication Engineering');
  v_branch := COALESCE(NULLIF(TRIM(p_branch), ''), 'ECE');
  v_section := COALESCE(NULLIF(TRIM(p_section), ''), 'A');
  v_start_date := COALESCE(p_incubation_start_date, v_now::date);
  v_start_year := COALESCE(p_academic_year_at_start, p_academic_year, 1);
  v_retention_years := COALESCE(p_retention_period_years, 4);

  -- 3. Prevent Hijacking & Link Existing Unlinked Row or Create New Row
  SELECT * INTO v_existing_user
  FROM public.users
  WHERE auth_id = p_auth_id
     OR UPPER(TRIM(roll_number)) = v_clean_roll
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_user.auth_id IS NOT NULL AND v_existing_user.auth_id != p_auth_id THEN
      RAISE EXCEPTION 'Conflict: Account "%" is already linked to a different login.', v_clean_roll;
    END IF;

    IF UPPER(TRIM(COALESCE(v_existing_user.roll_number, ''))) != v_clean_roll THEN
      RAISE EXCEPTION 'Conflict: Provided auth_id is already linked to another roll number.';
    END IF;

    v_user_id := v_existing_user.id;

    UPDATE public.users
    SET
      auth_id = p_auth_id,
      name = COALESCE(NULLIF(v_clean_name, ''), v_existing_user.name),
      is_active = CASE
        WHEN v_existing_user.membership_status = 'pending_verification' THEN true
        ELSE COALESCE(v_existing_user.is_active, true)
      END,
      membership_status = CASE
        WHEN v_existing_user.membership_status = 'pending_verification' OR v_existing_user.membership_status IS NULL
          THEN 'active'
        ELSE v_existing_user.membership_status
      END,
      updated_at = v_now
    WHERE id = v_user_id
    RETURNING * INTO v_result;
  ELSE
    v_user_id := 'USER-' || UPPER(SUBSTRING(REPLACE(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 10));

    INSERT INTO public.users (
      id,
      auth_id,
      roll_number,
      name,
      role,
      is_active,
      membership_status,
      mobile_number,
      department,
      branch,
      section,
      academic_year,
      face_registered,
      face_photo_url,
      incubation_start_date,
      academic_year_at_start,
      retention_period_years,
      retention_end_date,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_auth_id,
      v_clean_roll,
      v_clean_name,
      v_target_role,
      true,
      'active',
      TRIM(COALESCE(p_mobile_number, '')),
      v_dept,
      v_branch,
      v_section,
      COALESCE(p_academic_year, v_start_year, 1),
      COALESCE(p_face_registered, false),
      p_face_photo_url,
      v_start_date,
      v_start_year,
      v_retention_years,
      p_retention_end_date,
      v_now,
      v_now
    )
    RETURNING * INTO v_result;
  END IF;

  -- 4. Upsert & Claim Student Roster Record for Student Accounts
  IF v_target_role = 'student' THEN
    SELECT id INTO v_roster_id
    FROM public.student_roster
    WHERE UPPER(TRIM(roll_number)) = v_clean_roll
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.student_roster
      SET
        is_registered = true,
        registered_at = COALESCE(registered_at, v_now),
        registered_user_id = v_user_id,
        updated_at = v_now
      WHERE id = v_roster_id;
    ELSE
      INSERT INTO public.student_roster (
        roll_number,
        name,
        department,
        branch,
        academic_year,
        is_registered,
        registered_at,
        registered_user_id,
        created_at,
        updated_at
      ) VALUES (
        v_clean_roll,
        v_clean_name,
        v_dept,
        v_branch,
        v_start_year,
        true,
        v_now,
        v_user_id,
        v_now,
        v_now
      );
    END IF;
  END IF;

  -- 5. Immutable Audit Log Entry
  INSERT INTO public.audit_logs (
    id,
    actor_name,
    actor_role,
    action,
    target_roll,
    previous_value,
    new_value,
    details,
    timestamp,
    created_at
  ) VALUES (
    'AUD-' || UPPER(SUBSTRING(REPLACE(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 10)),
    v_caller_name,
    v_caller_role,
    'Admin Account Provisioning (RPC)',
    v_clean_roll,
    CASE WHEN v_existing_user.id IS NOT NULL THEN 'Unlinked Profile' ELSE 'New Account' END,
    'Active ' || v_target_role || ' Profile (' || v_user_id || ')',
    'Administrator ' || v_caller_name || ' (' || v_caller_role || ') provisioned login for ' || v_clean_name || ' (' || v_clean_roll || ').',
    v_now,
    v_now
  );

  RETURN pg_catalog.to_jsonb(v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_provision_user_profile(
  uuid, text, text, text, text, text, text, text, integer, boolean, text, date, integer, integer, date
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_provision_user_profile(
  uuid, text, text, text, text, text, text, text, integer, boolean, text, date, integer, integer, date
) TO authenticated, service_role;
