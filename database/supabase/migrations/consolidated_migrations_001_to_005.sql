-- ==============================================================================
-- CONSOLIDATED DATABASE MIGRATION SCRIPT (001, 002, 004, 005)
-- Incubation Centre Management System • Supabase PostgreSQL
--
-- Target Project: sqiiamgdljfzpwaiomhp
-- Prerequisite: 000_base_schema.sql (ALREADY EXECUTED & CONFIRMED)
-- Excluded: 003_id_card_barcode_and_validity.sql (CANCELLED)
--
-- Instructions:
-- 1. Open Supabase Dashboard -> SQL Editor (https://supabase.com/dashboard/project/sqiiamgdljfzpwaiomhp/sql/new)
-- 2. Paste this entire script into the editor.
-- 3. Click "Run" (or Ctrl + Enter).
-- 4. Check the verification results returned at the bottom.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- STAGE 1 / 4: 001_safe_schema_upgrade.sql
-- Upgrades Base Tables, Links Supabase Auth, Provisions RLS, Functions & Triggers
-- ==============================================================================
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


-- ==============================================================================
-- STAGE 2 / 4: 002_incubation_start_and_storage.sql
-- Adds Student Journey Columns & Storage Stats Monitoring RPC
-- ==============================================================================
-- ==============================================================================
-- 002_incubation_start_and_storage.sql
-- Safe Non-Destructive Migration: Student Incubation Journey Start Date & Storage Metrics
--
-- IMPORTANT:
-- 1. DO NOT DROP ANY EXISTING TABLES.
-- 2. Uses ADD COLUMN IF NOT EXISTS.
-- 3. Adds secure PostgreSQL RPC for storage monitoring.
-- ==============================================================================

-- 1. ADD INCUBATION JOURNEY & RETENTION COLUMNS TO USERS TABLE
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS incubation_start_date date;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS academic_year_at_start integer;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS retention_period_years integer;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS retention_end_date date;

-- Add index for retention queries
CREATE INDEX IF NOT EXISTS idx_users_retention_end_date ON public.users (retention_end_date);
CREATE INDEX IF NOT EXISTS idx_users_incubation_start_date ON public.users (incubation_start_date);

-- 2. SECURE STORAGE METRICS RPC FUNCTION
-- Allows Admin & Substitute Admin to query PostgreSQL database and public schema footprint
CREATE OR REPLACE FUNCTION public.get_database_storage_stats()
RETURNS jsonb AS $$
DECLARE
  db_size bigint;
  tbl_size bigint;
  users_cnt bigint;
  components_cnt bigint;
  transactions_cnt bigint;
  visits_cnt bigint;
  audit_cnt bigint;
BEGIN
  -- Verify caller role is Admin, Substitute Admin, or Sir
  IF public.get_current_user_role() NOT IN ('admin', 'substitute_admin', 'sir') THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required to inspect storage metrics.';
  END IF;

  SELECT pg_database_size(current_database()) INTO db_size;

  SELECT COALESCE(SUM(pg_total_relation_size(c.oid)), 0)
  INTO tbl_size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public';

  SELECT COUNT(*) INTO users_cnt FROM public.users;
  SELECT COUNT(*) INTO components_cnt FROM public.components;
  SELECT COUNT(*) INTO transactions_cnt FROM public.transactions;
  SELECT COUNT(*) INTO visits_cnt FROM public.visits;
  SELECT COUNT(*) INTO audit_cnt FROM public.audit_logs;

  RETURN jsonb_build_object(
    'databaseSizeBytes', db_size,
    'publicSchemaSizeBytes', tbl_size,
    'usersCount', users_cnt,
    'componentsCount', components_cnt,
    'transactionsCount', transactions_cnt,
    'visitsCount', visits_cnt,
    'auditLogsCount', audit_cnt,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth;


-- ==============================================================================
-- STAGE 3 / 4: 004_smart_incubation_system.sql
-- Provisions 11 Smart Module Tables with text PKs, Title Protection & Strict RLS
-- ==============================================================================
-- ==============================================================================
-- 004_smart_incubation_system.sql
-- Safe Migration: Smart Incubation Centre Management System
--
-- Adds:
-- 1. Projects & Teams management with strict title protection & expenditure tracking
-- 2. Permanent Achievements & Configurable Announcements
-- 3. Complaints System (Equipment/Environment & Component shortages)
-- 4. Research Papers metadata with public/private visibility
-- 5. Student Self-Affirmation & Reflection Book (strictly student-isolated)
-- 6. Innovation Day & Centre Events
-- 7. Holidays & Working-Day Streak tracking
-- 8. Domains management
-- 9. Staff / Sir "I'm Inside Lab" presence tracking
-- 10. Nested category & unique component number on components
--
-- Security: Strict Row-Level Security (RLS) with zero unrestricted public writes.
-- Primary Keys: text PRIMARY KEY to support domain IDs (e.g. PROJ-001, CMP-001).
-- ==============================================================================

-- 1. ADD COLUMNS TO USERS
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS branch text DEFAULT 'ECE';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS section text DEFAULT 'A';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS academic_year integer DEFAULT 3;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_theme text DEFAULT 'indigo';

-- 2. ADD COLUMNS TO COMPONENTS
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS component_number text;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS parent_category text;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS location_details text;

-- Create unique index on component_number where not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_components_component_number_unique 
  ON public.components (LOWER(TRIM(component_number))) 
  WHERE component_number IS NOT NULL AND component_number != '';

-- 3. DOMAINS TABLE
CREATE TABLE IF NOT EXISTS public.domains (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

-- 4. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title text NOT NULL,
  team_id text,
  leader_roll text NOT NULL,
  members jsonb DEFAULT '[]'::jsonb,
  objectives text,
  domain text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'in_progress')),
  github_link text,
  linkedin_link text,
  demo_url text,
  budget numeric(10, 2) DEFAULT 0,
  approved_budget numeric(10, 2) DEFAULT 0,
  estimated_budget numeric(10, 2) DEFAULT 0,
  funding_source text DEFAULT 'College Incubation Seed Fund',
  expenditures jsonb DEFAULT '[]'::jsonb,
  total_spent numeric(10, 2) DEFAULT 0,
  remaining_budget numeric(10, 2) DEFAULT 0,
  contributions jsonb DEFAULT '[]'::jsonb,
  prototype_available boolean DEFAULT false,
  achievement_ids jsonb DEFAULT '[]'::jsonb,
  title_change_request jsonb, -- Stores pending student title requests for Sir/Admin approval
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_leader_roll ON public.projects (leader_roll);
CREATE INDEX IF NOT EXISTS idx_projects_domain ON public.projects (domain);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status);

-- 5. TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.teams (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  leader_roll text NOT NULL,
  member_rolls jsonb DEFAULT '[]'::jsonb,
  domain text,
  project_id text,
  budget numeric(10, 2) DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_leader_roll ON public.teams (leader_roll);

-- 6. PERMANENT ACHIEVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.achievements (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title text NOT NULL,
  description text,
  awarded_to_roll text NOT NULL,
  student_name text NOT NULL,
  prize_money numeric(10, 2) DEFAULT 0,
  awarded_by text NOT NULL,
  date_awarded date DEFAULT CURRENT_DATE,
  is_permanent boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_student ON public.achievements (awarded_to_roll);

-- 7. ANNOUNCEMENTS TABLE (Configurable expiration)
CREATE TABLE IF NOT EXISTS public.announcements (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title text NOT NULL,
  message text NOT NULL,
  category text DEFAULT 'General',
  active boolean DEFAULT true,
  expires_at timestamptz NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements (active, expires_at);

-- 8. EVENTS & INNOVATION DAY TABLE
CREATE TABLE IF NOT EXISTS public.events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title text NOT NULL,
  theme text,
  event_date date NOT NULL,
  prizes text,
  winners jsonb DEFAULT '[]'::jsonb,
  is_innovation_day boolean DEFAULT false,
  year integer,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON public.events (event_date);

-- 9. COMPLAINTS TABLE (Equipment/Environment & Component shortages)
CREATE TABLE IF NOT EXISTS public.complaints (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type text NOT NULL CHECK (type IN ('equipment_environment', 'component_availability')),
  item_name text NOT NULL,
  description text NOT NULL,
  reported_by_roll text NOT NULL,
  reported_by_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints (status);
CREATE INDEX IF NOT EXISTS idx_complaints_reported_by ON public.complaints (reported_by_roll);

-- 10. RESEARCH PAPERS TABLE (Metadata only, DOI / External link, public/private toggle)
CREATE TABLE IF NOT EXISTS public.research_papers (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title text NOT NULL,
  authors jsonb DEFAULT '[]'::jsonb,
  student_roll text NOT NULL,
  team_name text,
  domain text,
  venue text,
  paper_type text DEFAULT 'conference' CHECK (paper_type IN ('IEEE', 'conference', 'journal', 'workshop', 'other')),
  doi text,
  external_url text,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_student ON public.research_papers (student_roll);
CREATE INDEX IF NOT EXISTS idx_research_domain ON public.research_papers (domain);

-- 11. SELF-AFFIRMATION / STUDENT REFLECTION BOOK
CREATE TABLE IF NOT EXISTS public.self_reflections (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_roll text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  is_private boolean DEFAULT true,
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reflections_student ON public.self_reflections (student_roll);

-- 12. HOLIDAYS TABLE (For accurate working-day streak computation)
CREATE TABLE IF NOT EXISTS public.holidays (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date date NOT NULL UNIQUE,
  name text NOT NULL,
  type text DEFAULT 'institute' CHECK (type IN ('sunday', 'institute', 'national', 'festival')),
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays (date);

-- 13. STAFF / SIR "I'M INSIDE LAB" PRESENCE TRACKING
CREATE TABLE IF NOT EXISTS public.staff_presence (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  staff_email text NOT NULL,
  staff_name text NOT NULL,
  role text NOT NULL,
  entry_time timestamptz NOT NULL DEFAULT now(),
  exit_time timestamptz,
  duration_minutes integer,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_presence_active ON public.staff_presence (active, staff_email);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation: Role-based admin access and student-isolated data policies.
-- Zero unrestricted public writes.
-- ==============================================================================

ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_presence ENABLE ROW LEVEL SECURITY;

-- DOMAINS POLICIES
DROP POLICY IF EXISTS "Authenticated users can view domains" ON public.domains;
CREATE POLICY "Authenticated users can view domains" ON public.domains
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage domains" ON public.domains;
CREATE POLICY "Admins manage domains" ON public.domains
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

-- PROJECTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
CREATE POLICY "Authenticated users can view projects" ON public.projects
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage all projects" ON public.projects;
CREATE POLICY "Admins manage all projects" ON public.projects
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

DROP POLICY IF EXISTS "Students can insert projects" ON public.projects;
CREATE POLICY "Students can insert projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    UPPER(leader_roll) = public.get_current_student_roll() OR
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

DROP POLICY IF EXISTS "Leaders can update own projects" ON public.projects;
CREATE POLICY "Leaders can update own projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (
    UPPER(leader_roll) = public.get_current_student_roll() OR
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  )
  WITH CHECK (
    UPPER(leader_roll) = public.get_current_student_roll() OR
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

-- Protect project title and approved budget from unauthorized student alteration
CREATE OR REPLACE FUNCTION public.protect_projects_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF public.get_current_user_role() NOT IN ('admin', 'substitute_admin', 'sir') THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      RAISE EXCEPTION 'Access Denied: Official project title changes require Sir or Admin approval.';
    END IF;
    IF NEW.approved_budget IS DISTINCT FROM OLD.approved_budget THEN
      RAISE EXCEPTION 'Access Denied: Approved project budget can only be modified by Sir or Admin.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_protect_projects ON public.projects;
CREATE TRIGGER trg_protect_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_projects_on_update();

-- TEAMS POLICIES
DROP POLICY IF EXISTS "Authenticated users can view teams" ON public.teams;
CREATE POLICY "Authenticated users can view teams" ON public.teams
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage teams" ON public.teams;
CREATE POLICY "Admins manage teams" ON public.teams
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

DROP POLICY IF EXISTS "Leaders can insert teams" ON public.teams;
CREATE POLICY "Leaders can insert teams" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (
    UPPER(leader_roll) = public.get_current_student_roll() OR
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

DROP POLICY IF EXISTS "Leaders can update own teams" ON public.teams;
CREATE POLICY "Leaders can update own teams" ON public.teams
  FOR UPDATE TO authenticated
  USING (
    UPPER(leader_roll) = public.get_current_student_roll() OR
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  )
  WITH CHECK (
    UPPER(leader_roll) = public.get_current_student_roll() OR
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

-- ACHIEVEMENTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can view achievements" ON public.achievements;
CREATE POLICY "Authenticated users can view achievements" ON public.achievements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage achievements" ON public.achievements;
CREATE POLICY "Admins manage achievements" ON public.achievements
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

-- ANNOUNCEMENTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can view active announcements" ON public.announcements;
CREATE POLICY "Authenticated users can view active announcements" ON public.announcements
  FOR SELECT TO authenticated USING (active = true);

DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
CREATE POLICY "Admins manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

-- EVENTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can view events" ON public.events;
CREATE POLICY "Authenticated users can view events" ON public.events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage events" ON public.events;
CREATE POLICY "Admins manage events" ON public.events
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

-- COMPLAINTS POLICIES (Student isolated: students only see/manage their own complaints)
DROP POLICY IF EXISTS "Admins manage all complaints" ON public.complaints;
CREATE POLICY "Admins manage all complaints" ON public.complaints
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

DROP POLICY IF EXISTS "Students can view own complaints" ON public.complaints;
CREATE POLICY "Students can view own complaints" ON public.complaints
  FOR SELECT TO authenticated
  USING (UPPER(reported_by_roll) = public.get_current_student_roll());

DROP POLICY IF EXISTS "Students can insert own complaints" ON public.complaints;
CREATE POLICY "Students can insert own complaints" ON public.complaints
  FOR INSERT TO authenticated
  WITH CHECK (UPPER(reported_by_roll) = public.get_current_student_roll());

-- RESEARCH PAPERS POLICIES
DROP POLICY IF EXISTS "Read public or own research papers" ON public.research_papers;
CREATE POLICY "Read public or own research papers" ON public.research_papers
  FOR SELECT TO authenticated
  USING (
    is_public = true OR
    UPPER(student_roll) = public.get_current_student_roll() OR
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

DROP POLICY IF EXISTS "Admins manage research papers" ON public.research_papers;
CREATE POLICY "Admins manage research papers" ON public.research_papers
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

DROP POLICY IF EXISTS "Students can submit own research papers" ON public.research_papers;
CREATE POLICY "Students can submit own research papers" ON public.research_papers
  FOR INSERT TO authenticated
  WITH CHECK (UPPER(student_roll) = public.get_current_student_roll());

-- SELF REFLECTIONS POLICIES (STRICTLY ISOLATED: students only see their own)
DROP POLICY IF EXISTS "Students manage own reflections" ON public.self_reflections;
CREATE POLICY "Students manage own reflections" ON public.self_reflections
  FOR ALL TO authenticated
  USING (UPPER(student_roll) = public.get_current_student_roll())
  WITH CHECK (UPPER(student_roll) = public.get_current_student_roll());

-- HOLIDAYS POLICIES
DROP POLICY IF EXISTS "Authenticated users view holidays" ON public.holidays;
CREATE POLICY "Authenticated users view holidays" ON public.holidays
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage holidays" ON public.holidays;
CREATE POLICY "Admins manage holidays" ON public.holidays
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));

-- STAFF PRESENCE POLICIES
DROP POLICY IF EXISTS "Authenticated users view staff presence" ON public.staff_presence;
CREATE POLICY "Authenticated users view staff presence" ON public.staff_presence
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Staff and Admins manage staff presence" ON public.staff_presence;
CREATE POLICY "Staff and Admins manage staff presence" ON public.staff_presence
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir', 'staff'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir', 'staff'));


-- ==============================================================================
-- STAGE 4 / 4: 005_component_category_hierarchy.sql
-- Provisions Category Hierarchy, Links Components FK & Seeds Root Taxonomy
-- ==============================================================================
-- ==============================================================================
-- 005_component_category_hierarchy.sql
-- Safe Non-Destructive Migration: Multi-Level Component Category Hierarchy
--
-- Persists arbitrary parent-child category tree in Supabase PostgreSQL.
-- Preserves 100% of existing components, categories, and inventory associations.
-- ==============================================================================

-- 1. COMPONENT CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.component_categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  parent_id text REFERENCES public.component_categories(id) ON DELETE RESTRICT,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for high-performance child lookups
CREATE INDEX IF NOT EXISTS idx_component_categories_parent_id 
  ON public.component_categories(parent_id);

-- 2. EXTEND COMPONENTS TABLE (SAFE COLUMN ADDITIONS)
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS category_id text 
  REFERENCES public.component_categories(id) ON DELETE SET NULL;

ALTER TABLE public.components ADD COLUMN IF NOT EXISTS location_photo_url text;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS location_photo_ref text;

-- 3. INITIAL SEED CATEGORIES (SAFE: ONLY INSERT IF MISSING)
INSERT INTO public.component_categories (id, name, parent_id, description)
VALUES 
  -- Root Categories
  ('CAT-ROOT-ELECTRONICS', 'Electronics', NULL, 'Electronic components, boards, and modules'),
  ('CAT-ROOT-DISPLAYS', 'Displays', NULL, 'Display panels, screens, and indicators'),
  ('CAT-ROOT-MOTORS', 'Motors & Actuators', NULL, 'Electric motors, servos, and drive mechanisms'),
  ('CAT-ROOT-TOOLS', 'Tools & Lab Equipment', NULL, 'Laboratory test equipment, soldering, and hand tools'),
  ('CAT-ROOT-OTHER', 'Other electronic components', NULL, 'Passives, hardware, and miscellaneous lab supplies'),

  -- Level 2: Under Electronics
  ('CAT-MICROCONTROLLERS', 'Microcontrollers', 'CAT-ROOT-ELECTRONICS', 'Microcontroller development boards and ICs'),
  ('CAT-SENSORS', 'Sensors', 'CAT-ROOT-ELECTRONICS', 'Environmental, optical, and physical sensors'),
  ('CAT-COMM-MODULES', 'Communication Modules', 'CAT-ROOT-ELECTRONICS', 'Wireless and wired transceivers'),
  ('CAT-POWER-MODULES', 'Power Modules', 'CAT-ROOT-ELECTRONICS', 'Voltage regulators, buck/boost converters, and batteries'),

  -- Level 3: Under Microcontrollers
  ('CAT-ESP32', 'ESP32', 'CAT-MICROCONTROLLERS', 'Espressif ESP32 series'),
  ('CAT-ARDUINO', 'Arduino', 'CAT-MICROCONTROLLERS', 'Arduino compatible boards'),
  ('CAT-STM32', 'STM32', 'CAT-MICROCONTROLLERS', 'ARM Cortex-M development boards'),
  ('CAT-RASPBERRY-PI', 'Raspberry Pi', 'CAT-MICROCONTROLLERS', 'Single-board computers and RP2040 microcontrollers'),

  -- Level 4: Under ESP32
  ('CAT-ESP32-WROOM', 'ESP32-WROOM', 'CAT-ESP32', 'ESP32-WROOM series'),
  ('CAT-ESP32-WROVER', 'ESP32-WROVER', 'CAT-ESP32', 'ESP32-WROVER series with PSRAM'),
  ('CAT-ESP32-C3', 'ESP32-C3', 'CAT-ESP32', 'ESP32-C3 RISC-V series'),

  -- Level 5: Under ESP32-WROOM
  ('CAT-ESP32-WROOM-32', 'ESP32-WROOM-32', 'CAT-ESP32-WROOM', 'Standard dual-core ESP32-WROOM-32 modules'),
  ('CAT-ESP32-WROOM-32E', 'ESP32-WROOM-32E', 'CAT-ESP32-WROOM', 'Enhanced PCB antenna ESP32-WROOM-32E modules'),

  -- Level 3: Under Sensors
  ('CAT-TEMP-SENSORS', 'Temperature Sensors', 'CAT-SENSORS', 'Temperature and humidity sensing ICs'),
  ('CAT-ULTRASONIC', 'Ultrasonic Sensors', 'CAT-SENSORS', 'Distance and sonar rangefinder modules'),
  ('CAT-GAS-SENSORS', 'Gas Sensors', 'CAT-SENSORS', 'Air quality and gas detection probes'),
  ('CAT-OPTICAL-SENSORS', 'Optical & Light Sensors', 'CAT-SENSORS', 'Photodiodes, LDRs, and colour sensors'),

  -- Level 4: Under Temperature Sensors
  ('CAT-LM35', 'LM35 Precision Centigrade', 'CAT-TEMP-SENSORS', 'Analog precision temperature sensors'),
  ('CAT-DS18B20', 'DS18B20 1-Wire Digital', 'CAT-TEMP-SENSORS', 'Digital 1-wire waterproof temperature probes'),

  -- Level 4: Under Ultrasonic
  ('CAT-HCSR04', 'HC-SR04 Rangefinder', 'CAT-ULTRASONIC', 'Ultrasonic distance measuring modules'),

  -- Level 4: Under Gas Sensors
  ('CAT-MQ135', 'MQ-135 Air Quality Probe', 'CAT-GAS-SENSORS', 'Hazardous gas and air quality sensor modules'),

  -- Level 3: Under Communication Modules
  ('CAT-WIFI', 'Wi-Fi Modules', 'CAT-COMM-MODULES', 'Wi-Fi transceivers and adapters'),
  ('CAT-BLUETOOTH', 'Bluetooth Modules', 'CAT-COMM-MODULES', 'BLE and Classic Bluetooth transceivers'),
  ('CAT-LORA', 'LoRa Transceivers', 'CAT-COMM-MODULES', 'Long-range low-power RF modules'),

  -- Level 4: Under Bluetooth
  ('CAT-HC05', 'HC-05 Classic Bluetooth', 'CAT-BLUETOOTH', 'UART serial Bluetooth modules'),
  ('CAT-HC06', 'HC-06 Bluetooth Slave', 'CAT-BLUETOOTH', 'UART slave Bluetooth modules')
ON CONFLICT (id) DO NOTHING;

-- 4. ROW LEVEL SECURITY (RLS) FOR COMPONENT CATEGORIES
ALTER TABLE public.component_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.component_categories;
CREATE POLICY "Authenticated users can view categories" ON public.component_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage categories" ON public.component_categories;
CREATE POLICY "Admins manage categories" ON public.component_categories
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));



COMMIT;


-- ==============================================================================
-- VERIFICATION QUERIES (RUN AFTER EXECUTION TO CONFIRM ALL 20 TABLES & SECURITY)
-- ==============================================================================

-- 1. Verify All 20 Application Tables Exist
SELECT 
  table_name,
  (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Verify RLS is Enabled on All 20 Tables (rowsecurity should be TRUE for all)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Verify All Provisioned RLS Policies Count by Table
SELECT tablename, count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 4. Verify Active Security Triggers
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 5. Verify Database Storage Stats RPC Function
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'get_database_storage_stats';

