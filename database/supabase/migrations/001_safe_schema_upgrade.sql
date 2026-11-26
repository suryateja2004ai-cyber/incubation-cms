-- ==============================================================================
-- 001_safe_schema_upgrade.sql
-- Safe Non-Destructive Schema Upgrade & Comprehensive Row Level Security (RLS)
--
-- IMPORTANT:
-- 1. DO NOT DROP ANY EXISTING TABLES.
-- 2. This script uses "ADD COLUMN IF NOT EXISTS" for all schema adjustments.
-- 3. Enables clean mapping between Supabase Auth (auth.uid()) and public.users.
-- 4. Enforces strict Student Privacy Isolation (no student can see another's data).
-- ==============================================================================

-- ==============================================================================
-- 1. SCHEMA UPGRADE (Non-destructive column additions)
-- ==============================================================================

-- USERS TABLE
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS roll_number text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text DEFAULT 'student';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mobile_number text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fingerprint_ids integer[] DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS finger_labels text[] DEFAULT '{ "Right Thumb", "Right Index", "Left Index" }';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS face_registered boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS face_photo_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure roll_number has an index for high-speed student lookups
CREATE INDEX IF NOT EXISTS idx_users_roll_number ON public.users (UPPER(roll_number));
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users (auth_id);

-- COMPONENTS TABLE
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS category text DEFAULT 'Other electronic components';
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS tracking_mode text DEFAULT 'aggregate';
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS total_quantity integer DEFAULT 0;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS available_quantity integer DEFAULT 0;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS issued_quantity integer DEFAULT 0;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS damaged_quantity integer DEFAULT 0;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS lost_quantity integer DEFAULT 0;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS low_stock_threshold integer DEFAULT 3;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS default_overdue_days integer DEFAULT 7;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS individual_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- DEVICES TABLE
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS commanded_state text DEFAULT 'OFF';
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS actual_state text DEFAULT 'OFF';
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS brightness integer DEFAULT 100;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS speed integer DEFAULT 1;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT true;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS hardware_status text DEFAULT 'confirmed';
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS power_rating_watts numeric DEFAULT 0;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS daily_kwh numeric DEFAULT 0;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS weekly_kwh numeric DEFAULT 0;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS monthly_kwh numeric DEFAULT 0;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS yearly_kwh numeric DEFAULT 0;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS last_hardware_sync timestamptz;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- VISITS TABLE
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS student_roll text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS student_name text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS entry_time timestamptz DEFAULT now();
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS exit_time timestamptz;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS duration_minutes integer;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS status text DEFAULT 'inside';
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS entry_method text DEFAULT 'fingerprint';
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS exit_method text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_visits_student_roll ON public.visits (UPPER(student_roll));
CREATE INDEX IF NOT EXISTS idx_visits_status ON public.visits (status);

-- TRANSACTIONS TABLE
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS student_roll text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS student_name text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS authorized_by text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS issue_date timestamptz DEFAULT now();
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS overall_due_date timestamptz;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS returned_date timestamptz;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_transactions_student_roll ON public.transactions (UPPER(student_roll));
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions (status);

-- AUTHORIZATIONS TABLE
ALTER TABLE public.authorizations ADD COLUMN IF NOT EXISTS primary_student_roll text;
ALTER TABLE public.authorizations ADD COLUMN IF NOT EXISTS primary_student_name text;
ALTER TABLE public.authorizations ADD COLUMN IF NOT EXISTS authorized_student_roll text;
ALTER TABLE public.authorizations ADD COLUMN IF NOT EXISTS authorized_student_name text;
ALTER TABLE public.authorizations ADD COLUMN IF NOT EXISTS scope text DEFAULT 'both';
ALTER TABLE public.authorizations ADD COLUMN IF NOT EXISTS valid_from timestamptz DEFAULT now();
ALTER TABLE public.authorizations ADD COLUMN IF NOT EXISTS valid_until timestamptz;
ALTER TABLE public.authorizations ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.authorizations ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.authorizations ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.authorizations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- SETTINGS TABLE
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS key text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS value jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS incubation_center_name text DEFAULT 'Incubation Centre';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS college_name text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS default_retention_days integer DEFAULT 30;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS electricity_tariff_per_kwh numeric DEFAULT 7.50;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS emergency_fallback_active boolean DEFAULT false;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS esp32_endpoint text DEFAULT 'http://esp32-lab.local';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- AUDIT LOGS TABLE
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_name text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_roll text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_component_id text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS previous_value text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_value text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS timestamp timestamptz DEFAULT now();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ==============================================================================
-- 2. SECURE SERVER-SIDE ROLE AND ROLL RESOLUTION FUNCTIONS
-- ==============================================================================

-- Function to get current user's role from public.users linked via auth_id
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  -- 1. Check if superuser or service_role
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN 'admin';
  END IF;

  -- 2. Lookup role from public.users
  SELECT role INTO v_role
  FROM public.users
  WHERE auth_id = (select auth.uid())
  LIMIT 1;

  RETURN COALESCE(v_role, 'student');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth;

-- Function to get current authenticated student's roll number
CREATE OR REPLACE FUNCTION public.get_current_student_roll()
RETURNS text AS $$
DECLARE
  v_roll text;
BEGIN
  SELECT UPPER(roll_number) INTO v_roll
  FROM public.users
  WHERE auth_id = (select auth.uid())
  LIMIT 1;

  RETURN v_roll;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth;

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Ensure RLS is active
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- USERS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;
CREATE POLICY "Admins have full access to users" ON public.users
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

DROP POLICY IF EXISTS "Students can view own profile" ON public.users;
CREATE POLICY "Students can view own profile" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    auth_id = (select auth.uid()) OR
    UPPER(roll_number) = public.get_current_student_roll()
  );

DROP POLICY IF EXISTS "Users can register own student profile" ON public.users;
CREATE POLICY "Users can register own student profile" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_id = (select auth.uid()) AND
    role = 'student'
  );

DROP POLICY IF EXISTS "Users can update own contact profile" ON public.users;
CREATE POLICY "Users can update own contact profile" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_id = (select auth.uid()))
  WITH CHECK (auth_id = (select auth.uid()));

-- Protect sensitive columns against student modification
CREATE OR REPLACE FUNCTION public.protect_user_fields_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF public.get_current_user_role() NOT IN ('admin', 'substitute_admin', 'sir') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify your own user role.';
    END IF;
    IF NEW.auth_id IS DISTINCT FROM OLD.auth_id THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify auth_id.';
    END IF;
    IF NEW.roll_number IS DISTINCT FROM OLD.roll_number THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify roll_number.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_protect_user_fields ON public.users;
CREATE TRIGGER trg_protect_user_fields
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_fields_on_update();

-- ------------------------------------------------------------------------------
-- COMPONENTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "All authenticated users can browse components" ON public.components;
CREATE POLICY "All authenticated users can browse components" ON public.components
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage components" ON public.components;
CREATE POLICY "Admins manage components" ON public.components
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

-- ------------------------------------------------------------------------------
-- DEVICES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "All authenticated users can view devices" ON public.devices;
CREATE POLICY "All authenticated users can view devices" ON public.devices
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins have full control over devices" ON public.devices;
CREATE POLICY "Admins have full control over devices" ON public.devices
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

DROP POLICY IF EXISTS "Students can control lights and fans" ON public.devices;
CREATE POLICY "Students can control lights and fans" ON public.devices
  FOR UPDATE
  TO authenticated
  USING (type IN ('light', 'fan'))
  WITH CHECK (type IN ('light', 'fan'));

-- Protect device telemetry against student alteration
CREATE OR REPLACE FUNCTION public.protect_devices_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF public.get_current_user_role() NOT IN ('admin', 'substitute_admin', 'sir', 'staff') THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.name IS DISTINCT FROM OLD.name OR
       NEW.type IS DISTINCT FROM OLD.type OR
       NEW.location IS DISTINCT FROM OLD.location OR
       NEW.power_rating_watts IS DISTINCT FROM OLD.power_rating_watts OR
       NEW.daily_kwh IS DISTINCT FROM OLD.daily_kwh OR
       NEW.weekly_kwh IS DISTINCT FROM OLD.weekly_kwh OR
       NEW.monthly_kwh IS DISTINCT FROM OLD.monthly_kwh OR
       NEW.yearly_kwh IS DISTINCT FROM OLD.yearly_kwh THEN
      RAISE EXCEPTION 'Access Denied: Students may only switch device state, brightness, or speed.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_protect_devices ON public.devices;
CREATE TRIGGER trg_protect_devices
  BEFORE UPDATE ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_devices_on_update();

-- ------------------------------------------------------------------------------
-- VISITS POLICIES
-- Kiosk / Lab Presence Protection: Only authenticated Staff, Sir, and Admins
-- can insert or manage visits. Students have ZERO insert/update access to prevent
-- remote fabrication of attendance records.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage visits" ON public.visits;
CREATE POLICY "Admins manage visits" ON public.visits
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir', 'staff'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir', 'staff'));

DROP POLICY IF EXISTS "Students view own visits" ON public.visits;
CREATE POLICY "Students view own visits" ON public.visits
  FOR SELECT
  TO authenticated
  USING (UPPER(student_roll) = public.get_current_student_roll());

DROP POLICY IF EXISTS "Students insert own visits" ON public.visits;

-- ------------------------------------------------------------------------------
-- TRANSACTIONS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage transactions" ON public.transactions;
CREATE POLICY "Admins manage transactions" ON public.transactions
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

DROP POLICY IF EXISTS "Students view own transactions" ON public.transactions;
CREATE POLICY "Students view own transactions" ON public.transactions
  FOR SELECT
  TO authenticated
  USING (UPPER(student_roll) = public.get_current_student_roll());

-- ------------------------------------------------------------------------------
-- AUTHORIZATIONS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage authorizations" ON public.authorizations;
CREATE POLICY "Admins manage authorizations" ON public.authorizations
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

DROP POLICY IF EXISTS "Students view related authorizations" ON public.authorizations;
CREATE POLICY "Students view related authorizations" ON public.authorizations
  FOR SELECT
  TO authenticated
  USING (
    UPPER(primary_student_roll) = public.get_current_student_roll() OR
    UPPER(authorized_student_roll) = public.get_current_student_roll()
  );

DROP POLICY IF EXISTS "Students can create peer authorizations" ON public.authorizations;
CREATE POLICY "Students can create peer authorizations" ON public.authorizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    UPPER(primary_student_roll) = public.get_current_student_roll() OR
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

DROP POLICY IF EXISTS "Students can revoke own authorizations" ON public.authorizations;
CREATE POLICY "Students can revoke own authorizations" ON public.authorizations
  FOR UPDATE
  TO authenticated
  USING (
    UPPER(primary_student_roll) = public.get_current_student_roll() OR
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  )
  WITH CHECK (
    UPPER(primary_student_roll) = public.get_current_student_roll() OR
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

-- ------------------------------------------------------------------------------
-- SETTINGS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view general settings" ON public.settings;
CREATE POLICY "All users can view general settings" ON public.settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage settings" ON public.settings;
CREATE POLICY "Admins manage settings" ON public.settings
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

-- ------------------------------------------------------------------------------
-- AUDIT LOGS POLICIES (Immutable trail)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure audit logs are tamper-proof and immutable
CREATE OR REPLACE FUNCTION public.prevent_audit_log_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_immutable_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_immutable_audit_logs
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_tampering();
