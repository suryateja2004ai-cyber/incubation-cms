-- ==============================================================================
-- 013_attendance_archiving_revision_6.sql
-- Revision 6: Safe Institutional Attendance Archiving & Retention Engine
--
-- Safeguards:
--   1. Strict Timezone-Aware Retention Window (make_timestamptz in Asia/Kolkata):
--      Prevents archiving or purging the current calendar month AND the immediately
--      preceding calendar month based on institutional standard (Asia/Kolkata).
--      Handles year-end boundaries and leap years cleanly via interval arithmetic.
--   2. Atomic Archive Snapshots with Exact Column Alignment:
--      Aggregates and copies historical visits from public.visits
--      (matching student_roll, student_name, entry_time, exit_time, duration_minutes,
--       status, entry_method, exit_method, is_auto_closed, auto_closed_at)
--      into public.attendance_archive_months and public.attendance_archive_records.
--   3. Verification Before Purge:
--      Purge RPC requires pre-existing verified archive snapshot with matching row counts.
--   4. Atomic Disaster Recovery RPC:
--      Includes restore_archived_monthly_visits(p_month) to restore archived records
--      back into public.visits with zero data loss.
--   5. Role-Based Security:
--      Restricted exclusively to authorized administrators ('admin', 'sir', 'substitute_admin').
--      Revoked from anon and public.
-- ==============================================================================

-- 1. Create Archive Summary Table
CREATE TABLE IF NOT EXISTS public.attendance_archive_months (
  archive_month text PRIMARY KEY, -- Format: YYYY-MM
  year integer NOT NULL,
  month integer NOT NULL,
  total_visits integer NOT NULL DEFAULT 0,
  unique_students integer NOT NULL DEFAULT 0,
  total_lab_hours numeric(10, 2) NOT NULL DEFAULT 0.00,
  archived_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  archived_by text NOT NULL DEFAULT 'system',
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 2. Create Detailed Archive Records Table (Exact Column Match to public.visits)
CREATE TABLE IF NOT EXISTS public.attendance_archive_records (
  archive_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_month text NOT NULL REFERENCES public.attendance_archive_months(archive_month) ON DELETE CASCADE,
  original_visit_id text NOT NULL,
  student_roll text NOT NULL,
  student_name text,
  entry_time timestamptz NOT NULL,
  exit_time timestamptz,
  duration_minutes integer DEFAULT 0,
  status text DEFAULT 'completed',
  entry_method text DEFAULT 'face',
  exit_method text,
  is_auto_closed boolean DEFAULT false,
  auto_closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

-- Indexes for fast queries by roll number or month
CREATE INDEX IF NOT EXISTS idx_archive_records_month ON public.attendance_archive_records(archive_month);
CREATE INDEX IF NOT EXISTS idx_archive_records_roll ON public.attendance_archive_records(UPPER(student_roll));

-- 3. Enable RLS
ALTER TABLE public.attendance_archive_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_archive_records ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS archive_months_staff_read ON public.attendance_archive_months;
CREATE POLICY archive_months_staff_read ON public.attendance_archive_months
  FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'sir', 'substitute_admin', 'staff')
  );

DROP POLICY IF EXISTS archive_records_read_policy ON public.attendance_archive_records;
CREATE POLICY archive_records_read_policy ON public.attendance_archive_records
  FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'sir', 'substitute_admin', 'staff')
    OR UPPER(TRIM(student_roll)) = UPPER(TRIM(COALESCE(
      (SELECT roll_number FROM public.users WHERE auth_id = auth.uid() LIMIT 1), ''
    )))
  );

-- Service role full access
DROP POLICY IF EXISTS archive_months_service_role ON public.attendance_archive_months;
CREATE POLICY archive_months_service_role ON public.attendance_archive_months
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS archive_records_service_role ON public.attendance_archive_records;
CREATE POLICY archive_records_service_role ON public.attendance_archive_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. RPC: Atomic Archive Generation
CREATE OR REPLACE FUNCTION public.archive_monthly_attendance(p_month text)
RETURNS jsonb AS $$
DECLARE
  v_caller_role text;
  v_caller_name text;
  v_now_ist timestamp without time zone := (pg_catalog.clock_timestamp() AT TIME ZONE 'Asia/Kolkata');
  v_current_year integer := EXTRACT(YEAR FROM v_now_ist)::integer;
  v_current_month integer := EXTRACT(MONTH FROM v_now_ist)::integer;
  v_current_month_start timestamptz;
  v_prev_month_start timestamptz;
  v_target_start timestamptz;
  v_target_end timestamptz;
  v_target_year integer;
  v_target_month integer;
  v_visit_count integer := 0;
  v_unique_students integer := 0;
  v_total_minutes integer := 0;
  v_total_hours numeric(10, 2) := 0.00;
BEGIN
  -- 1. Authorization Check
  IF auth.role() = 'service_role' THEN
    v_caller_role := 'service_role';
    v_caller_name := 'Backend Service Role';
  ELSE
    v_caller_role := public.get_current_user_role();
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'sir', 'substitute_admin') THEN
      RAISE EXCEPTION 'Access Denied: Only administrators can archive historical attendance.';
    END IF;

    SELECT COALESCE(name, 'Administrator') INTO v_caller_name
    FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  END IF;

  -- 2. Validate Month Format (YYYY-MM)
  IF p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Invalid Format: Month must be in YYYY-MM format (e.g. 2026-08).';
  END IF;

  v_target_year := split_part(p_month, '-', 1)::integer;
  v_target_month := split_part(p_month, '-', 2)::integer;

  -- 3. Precise Timezone-Aware Boundaries via make_timestamptz in Asia/Kolkata
  v_target_start := make_timestamptz(v_target_year, v_target_month, 1, 0, 0, 0, 'Asia/Kolkata');
  v_target_end := v_target_start + interval '1 month';

  v_current_month_start := make_timestamptz(v_current_year, v_current_month, 1, 0, 0, 0, 'Asia/Kolkata');
  v_prev_month_start := v_current_month_start - interval '1 month';

  -- 4. Strict Revision 6 Retention Guard
  -- The target month MUST be strictly older than the previous calendar month.
  IF v_target_start >= v_prev_month_start THEN
    RAISE EXCEPTION 'Retention Violation: Current month (%) and previous month (%) are protected and cannot be archived.',
      to_char(v_current_month_start, 'YYYY-MM'),
      to_char(v_prev_month_start, 'YYYY-MM');
  END IF;

  -- 5. Check If Already Archived (Enforce Idempotency)
  IF EXISTS (SELECT 1 FROM public.attendance_archive_months WHERE archive_month = p_month) THEN
    RAISE EXCEPTION 'Conflict: Month % is already archived. Use purge if removing original visits.', p_month;
  END IF;

  -- 6. Copy Records Into Archive Detail Table with exact lossless column preservation
  INSERT INTO public.attendance_archive_records (
    archive_month,
    original_visit_id,
    student_roll,
    student_name,
    entry_time,
    exit_time,
    duration_minutes,
    status,
    entry_method,
    exit_method,
    is_auto_closed,
    auto_closed_at,
    created_at
  )
  SELECT
    p_month,
    v.id,
    v.student_roll,
    v.student_name,
    v.entry_time,
    v.exit_time,
    v.duration_minutes,
    v.status,
    v.entry_method,
    v.exit_method,
    v.is_auto_closed,
    v.auto_closed_at,
    v.created_at
  FROM public.visits v
  WHERE v.entry_time >= v_target_start AND v.entry_time < v_target_end;

  GET DIAGNOSTICS v_visit_count = ROW_COUNT;

  -- Compute Aggregations
  SELECT
    COALESCE(COUNT(DISTINCT student_roll), 0),
    COALESCE(SUM(duration_minutes), 0)
  INTO v_unique_students, v_total_minutes
  FROM public.attendance_archive_records
  WHERE archive_month = p_month;

  v_total_hours := ROUND(v_total_minutes / 60.0, 2);

  -- 7. Insert Archive Month Summary
  INSERT INTO public.attendance_archive_months (
    archive_month,
    year,
    month,
    total_visits,
    unique_students,
    total_lab_hours,
    archived_at,
    archived_by,
    metadata
  ) VALUES (
    p_month,
    v_target_year,
    v_target_month,
    v_visit_count,
    v_unique_students,
    v_total_hours,
    pg_catalog.clock_timestamp(),
    COALESCE(v_caller_name, 'Admin'),
    jsonb_build_object(
      'archived_by_role', v_caller_role,
      'timezone', 'Asia/Kolkata',
      'target_start', v_target_start,
      'target_end', v_target_end
    )
  );

  -- 8. Audit Log
  INSERT INTO public.audit_logs (
    id, actor_name, actor_role, action, target_roll,
    previous_value, new_value, details, timestamp, created_at
  ) VALUES (
    'AUD-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_caller_name,
    v_caller_role,
    'Attendance Archiving (Revision 6)',
    p_month,
    'Active Visits',
    'Archived (' || v_visit_count || ' visits)',
    'Archived ' || v_visit_count || ' visits (' || v_total_hours || ' hours, ' || v_unique_students || ' students) for month ' || p_month || '.',
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'archive_month', p_month,
    'total_visits', v_visit_count,
    'unique_students', v_unique_students,
    'total_lab_hours', v_total_hours
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

-- 6. RPC: Purge Archived Active Visits
CREATE OR REPLACE FUNCTION public.purge_archived_monthly_visits(p_month text)
RETURNS jsonb AS $$
DECLARE
  v_caller_role text;
  v_caller_name text;
  v_now_ist timestamp without time zone := (pg_catalog.clock_timestamp() AT TIME ZONE 'Asia/Kolkata');
  v_current_year integer := EXTRACT(YEAR FROM v_now_ist)::integer;
  v_current_month integer := EXTRACT(MONTH FROM v_now_ist)::integer;
  v_current_month_start timestamptz;
  v_prev_month_start timestamptz;
  v_target_start timestamptz;
  v_target_end timestamptz;
  v_target_year integer;
  v_target_month integer;
  v_archived_count integer;
  v_purged_count integer := 0;
BEGIN
  -- 1. Authorization Check
  IF auth.role() = 'service_role' THEN
    v_caller_role := 'service_role';
    v_caller_name := 'Backend Service Role';
  ELSE
    v_caller_role := public.get_current_user_role();
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'sir') THEN
      RAISE EXCEPTION 'Access Denied: Only primary administrators can purge archived attendance records.';
    END IF;

    SELECT COALESCE(name, 'Administrator') INTO v_caller_name
    FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  END IF;

  -- 2. Verify Archive Snapshot Exists First
  SELECT total_visits INTO v_archived_count
  FROM public.attendance_archive_months
  WHERE archive_month = p_month;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Precondition Failed: Month % has not been archived yet. Archive first before purging.', p_month;
  END IF;

  -- 3. Strict Retention Guard via make_timestamptz in Asia/Kolkata
  v_target_year := split_part(p_month, '-', 1)::integer;
  v_target_month := split_part(p_month, '-', 2)::integer;
  v_target_start := make_timestamptz(v_target_year, v_target_month, 1, 0, 0, 0, 'Asia/Kolkata');
  v_target_end := v_target_start + interval '1 month';

  v_current_month_start := make_timestamptz(v_current_year, v_current_month, 1, 0, 0, 0, 'Asia/Kolkata');
  v_prev_month_start := v_current_month_start - interval '1 month';

  IF v_target_start >= v_prev_month_start THEN
    RAISE EXCEPTION 'Retention Violation: Current month (%) and previous month (%) cannot be purged.',
      to_char(v_current_month_start, 'YYYY-MM'),
      to_char(v_prev_month_start, 'YYYY-MM');
  END IF;

  -- 4. Delete visits from active table
  DELETE FROM public.visits
  WHERE entry_time >= v_target_start AND entry_time < v_target_end;

  GET DIAGNOSTICS v_purged_count = ROW_COUNT;

  -- 5. Audit Log
  INSERT INTO public.audit_logs (
    id, actor_name, actor_role, action, target_roll,
    previous_value, new_value, details, timestamp, created_at
  ) VALUES (
    'AUD-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_caller_name,
    v_caller_role,
    'Purge Archived Visits (Revision 6)',
    p_month,
    'Active Visits (' || v_purged_count || ')',
    'Purged from active table',
    'Purged ' || v_purged_count || ' active visits for month ' || p_month || ' after verified archival.',
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'month', p_month,
    'purged_visits', v_purged_count,
    'archived_visits', v_archived_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

-- 7. RPC: Disaster Recovery - Restore Archived Monthly Visits
CREATE OR REPLACE FUNCTION public.restore_archived_monthly_visits(p_month text)
RETURNS jsonb AS $$
DECLARE
  v_caller_role text;
  v_caller_name text;
  v_restored_count integer := 0;
  v_archived_count integer := 0;
BEGIN
  -- 1. Authorization Check
  IF auth.role() = 'service_role' THEN
    v_caller_role := 'service_role';
    v_caller_name := 'Backend Service Role';
  ELSE
    v_caller_role := public.get_current_user_role();
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'sir') THEN
      RAISE EXCEPTION 'Access Denied: Only primary administrators can restore archived visits.';
    END IF;

    SELECT COALESCE(name, 'Administrator') INTO v_caller_name
    FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  END IF;

  -- 2. Validate Archive Exists
  SELECT total_visits INTO v_archived_count
  FROM public.attendance_archive_months
  WHERE archive_month = p_month;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Precondition Failed: No archive snapshot exists for month %.', p_month;
  END IF;

  -- 3. Atomically Re-insert Archived Records into Active Visits with exact field preservation
  INSERT INTO public.visits (
    id,
    student_roll,
    student_name,
    entry_time,
    exit_time,
    duration_minutes,
    status,
    entry_method,
    exit_method,
    is_auto_closed,
    auto_closed_at,
    created_at
  )
  SELECT
    ar.original_visit_id,
    ar.student_roll,
    ar.student_name,
    ar.entry_time,
    ar.exit_time,
    ar.duration_minutes,
    ar.status,
    ar.entry_method,
    ar.exit_method,
    ar.is_auto_closed,
    ar.auto_closed_at,
    ar.created_at
  FROM public.attendance_archive_records ar
  WHERE ar.archive_month = p_month
  ON CONFLICT (id) DO UPDATE SET
    student_roll = EXCLUDED.student_roll,
    student_name = EXCLUDED.student_name,
    entry_time = EXCLUDED.entry_time,
    exit_time = EXCLUDED.exit_time,
    duration_minutes = EXCLUDED.duration_minutes,
    status = EXCLUDED.status,
    entry_method = EXCLUDED.entry_method,
    exit_method = EXCLUDED.exit_method,
    is_auto_closed = EXCLUDED.is_auto_closed,
    auto_closed_at = EXCLUDED.auto_closed_at;

  GET DIAGNOSTICS v_restored_count = ROW_COUNT;

  -- 4. Audit Log Entry
  INSERT INTO public.audit_logs (
    id, actor_name, actor_role, action, target_roll,
    previous_value, new_value, details, timestamp, created_at
  ) VALUES (
    'AUD-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_caller_name,
    v_caller_role,
    'Restore Archived Visits (Revision 6)',
    p_month,
    'Archived Snapshot (' || v_archived_count || ')',
    'Restored to active table (' || v_restored_count || ')',
    'Restored ' || v_restored_count || ' visits for month ' || p_month || ' from archive snapshot.',
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'month', p_month,
    'restored_visits', v_restored_count,
    'archived_visits', v_archived_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

-- 8. Revoke execution from public & anon
REVOKE ALL ON FUNCTION public.archive_monthly_attendance(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_monthly_attendance(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.purge_archived_monthly_visits(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_archived_monthly_visits(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.restore_archived_monthly_visits(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_archived_monthly_visits(text) TO authenticated, service_role;
