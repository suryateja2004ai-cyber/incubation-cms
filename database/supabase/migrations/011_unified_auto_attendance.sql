-- ============================================================================
-- Migration: 011_unified_auto_attendance.sql
-- Description: Unified Automatic Lab Attendance & End-of-Day Checkout
-- Features:
--   1. Partial unique index to enforce single active session per student at DB level.
--   2. Atomic toggle_lab_attendance RPC (auto-detects entry vs exit).
--   3. Idempotent auto_checkout_end_of_day() function for closing time checkout.
--   4. Least-privilege grants to authenticated and service_role.
-- ============================================================================

-- Step 1: Ensure visits table has necessary columns for auto-checkout tracking
ALTER TABLE IF EXISTS visits 
  ADD COLUMN IF NOT EXISTS exit_method text,
  ADD COLUMN IF NOT EXISTS is_auto_closed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_closed_at timestamptz;

-- Step 2: Concurrency & Integrity Guard
-- Prevent duplicate concurrent inside visits for the same student
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_student_visit 
  ON visits (student_roll) 
  WHERE status = 'inside' AND exit_time IS NULL;

-- Step 3: Atomic Unified Attendance RPC
-- Automatically records ENTRY (if outside) or EXIT (if inside) in one call.
CREATE OR REPLACE FUNCTION toggle_lab_attendance(
  p_student_roll text,
  p_method text DEFAULT 'Face Recognition',
  p_actor_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student record;
  v_active_visit record;
  v_now timestamptz := clock_timestamp();
  v_today_key text := to_char(v_now AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD');
  v_duration_seconds integer;
  v_duration_minutes integer;
  v_duration_formatted text;
  v_new_id text;
  v_result jsonb;
BEGIN
  -- Validate roll number
  IF p_student_roll IS NULL OR trim(p_student_roll) = '' THEN
    RAISE EXCEPTION 'Student roll number is strictly required.';
  END IF;

  p_student_roll := upper(trim(p_student_roll));

  -- Lookup student
  SELECT id, name, roll_number, department 
  INTO v_student
  FROM users 
  WHERE upper(roll_number) = p_student_roll
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student with Roll Number "%" is not registered in the system.', p_student_roll;
  END IF;

  -- Check for existing active inside visit
  SELECT *
  INTO v_active_visit
  FROM visits
  WHERE upper(student_roll) = p_student_roll
    AND status = 'inside'
    AND exit_time IS NULL
  ORDER BY entry_time DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- ========================================================================
    -- CASE A: Student is outside -> Record LAB ENTRY
    -- ========================================================================
    v_new_id := 'VISIT-' || replace(v_today_key, '-', '') || '-' || substr(md5(random()::text), 1, 4);

    INSERT INTO visits (
      id,
      student_roll,
      student_name,
      entry_time,
      exit_time,
      duration_minutes,
      duration_seconds,
      duration_formatted,
      status,
      entry_method,
      flagged_for_admin_review,
      created_at
    ) VALUES (
      v_new_id,
      v_student.roll_number,
      v_student.name,
      v_now,
      NULL,
      NULL,
      NULL,
      'Currently Inside',
      'inside',
      p_method,
      false,
      v_now
    );

    -- Log audit entry
    INSERT INTO audit_logs (
      id,
      actor_name,
      actor_role,
      action,
      target_roll,
      details,
      created_at
    ) VALUES (
      'AUDIT-' || substr(md5(random()::text), 1, 8),
      COALESCE(p_actor_name, v_student.name),
      'Student',
      'Lab Entry',
      v_student.roll_number,
      'Entered lab via ' || p_method || '.',
      v_now
    );

    v_result := jsonb_build_object(
      'success', true,
      'action', 'ENTRY',
      'status', 'inside',
      'student_roll', v_student.roll_number,
      'student_name', v_student.name,
      'visit_id', v_new_id,
      'entry_time', v_now,
      'message', 'Welcome! Your lab entry has been recorded.'
    );

    RETURN v_result;

  ELSE
    -- ========================================================================
    -- CASE B: Student is inside -> Record LAB EXIT
    -- ========================================================================
    v_duration_seconds := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_active_visit.entry_time))::integer);
    v_duration_minutes := (v_duration_seconds / 60);

    IF v_duration_minutes < 60 THEN
      v_duration_formatted := v_duration_minutes || 'm';
    ELSE
      v_duration_formatted := (v_duration_minutes / 60) || 'h ' || (v_duration_minutes % 60) || 'm';
    END IF;

    UPDATE visits
    SET 
      exit_time = v_now,
      duration_minutes = v_duration_minutes,
      duration_seconds = v_duration_seconds,
      duration_formatted = v_duration_formatted,
      status = 'completed',
      exit_method = p_method,
      updated_at = v_now
    WHERE id = v_active_visit.id;

    -- Log audit exit
    INSERT INTO audit_logs (
      id,
      actor_name,
      actor_role,
      action,
      target_roll,
      details,
      created_at
    ) VALUES (
      'AUDIT-' || substr(md5(random()::text), 1, 8),
      COALESCE(p_actor_name, v_student.name),
      'Student',
      'Lab Exit',
      v_student.roll_number,
      'Exited lab via ' || p_method || '. Duration: ' || v_duration_formatted || '.',
      v_now
    );

    v_result := jsonb_build_object(
      'success', true,
      'action', 'EXIT',
      'status', 'completed',
      'student_roll', v_student.roll_number,
      'student_name', v_student.name,
      'visit_id', v_active_visit.id,
      'entry_time', v_active_visit.entry_time,
      'exit_time', v_now,
      'duration_minutes', v_duration_minutes,
      'duration_formatted', v_duration_formatted,
      'message', 'Your lab exit has been recorded. Thank you!'
    );

    RETURN v_result;
  END IF;
END;
$$;

-- Step 4: Automatic End-of-Day Checkout Function
-- Automatically completes all open visits that were left inside at closing time
CREATE OR REPLACE FUNCTION auto_checkout_end_of_day(
  p_closing_time text DEFAULT '17:00',
  p_actor_name text DEFAULT 'System Scheduler'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_rec record;
  v_closed_count integer := 0;
  v_duration_seconds integer;
  v_duration_minutes integer;
  v_duration_formatted text;
BEGIN
  FOR v_rec IN 
    SELECT id, student_roll, student_name, entry_time 
    FROM visits 
    WHERE status = 'inside' AND exit_time IS NULL
    FOR UPDATE
  LOOP
    v_duration_seconds := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_rec.entry_time))::integer);
    v_duration_minutes := (v_duration_seconds / 60);

    IF v_duration_minutes < 60 THEN
      v_duration_formatted := v_duration_minutes || 'm';
    ELSE
      v_duration_formatted := (v_duration_minutes / 60) || 'h ' || (v_duration_minutes % 60) || 'm';
    END IF;

    UPDATE visits
    SET 
      exit_time = v_now,
      duration_minutes = v_duration_minutes,
      duration_seconds = v_duration_seconds,
      duration_formatted = v_duration_formatted,
      status = 'completed',
      exit_method = 'automatic_end_of_day',
      is_auto_closed = true,
      auto_closed_at = v_now,
      updated_at = v_now
    WHERE id = v_rec.id;

    INSERT INTO audit_logs (
      id,
      actor_name,
      actor_role,
      action,
      target_roll,
      details,
      created_at
    ) VALUES (
      'AUDIT-' || substr(md5(random()::text), 1, 8),
      p_actor_name,
      'System',
      'Auto End-of-Day Exit',
      v_rec.student_roll,
      'Automatically checked out at configured lab closing time (' || p_closing_time || '). Duration: ' || v_duration_formatted || '.',
      v_now
    );

    v_closed_count := v_closed_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'closed_count', v_closed_count,
    'timestamp', v_now,
    'closing_time', p_closing_time
  );
END;
$$;

-- Step 5: Least-Privilege Grants
-- Authenticated users (students at entrance station / kiosk or faculty) can call toggle_lab_attendance
GRANT EXECUTE ON FUNCTION toggle_lab_attendance(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_checkout_end_of_day(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_lab_attendance(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION auto_checkout_end_of_day(text, text) TO service_role;

-- Step 6: pg_cron Scheduling (Optional / Reference)
-- If pg_cron extension is enabled in Supabase project:
-- SELECT cron.schedule(
--   'auto-checkout-incubation-lab',
--   '0 17 * * 1-6', -- 5:00 PM Monday through Saturday
--   $$SELECT auto_checkout_end_of_day('17:00');$$
-- );
