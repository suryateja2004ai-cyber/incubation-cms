-- ==============================================================================
-- 000_base_schema.sql
-- Foundational Base Schema Migration for VRSEC Incubation Centre Management System
--
-- Creates the 8 initial core tables required prior to running safe upgrades.
-- All tables use text primary keys to support domain-prefixed application IDs
-- (e.g. USER-001, COMP-001, DEV-LIGHT-1, VISIT-YYYYMMDD-XXXX, TXN-YYYYMMDD-XXXX).
--
-- Safe & Idempotent: Uses CREATE TABLE IF NOT EXISTS throughout.
-- ==============================================================================

-- 1. USERS (FOUNDATIONAL)
CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  roll_number text,
  name text NOT NULL,
  role text DEFAULT 'student' CHECK (role IN ('student', 'admin', 'substitute_admin', 'sir', 'staff')),
  mobile_number text,
  department text,
  password_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_roll_number_base ON public.users (UPPER(roll_number));

-- 2. COMPONENTS (FOUNDATIONAL)
CREATE TABLE IF NOT EXISTS public.components (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text DEFAULT 'Other electronic components',
  description text,
  tracking_mode text DEFAULT 'aggregate',
  total_quantity integer DEFAULT 0,
  available_quantity integer DEFAULT 0,
  issued_quantity integer DEFAULT 0,
  damaged_quantity integer DEFAULT 0,
  lost_quantity integer DEFAULT 0,
  low_stock_threshold integer DEFAULT 3,
  default_overdue_days integer DEFAULT 7,
  location text,
  individual_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. DEVICES (FOUNDATIONAL)
CREATE TABLE IF NOT EXISTS public.devices (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  location text,
  commanded_state text DEFAULT 'OFF',
  actual_state text DEFAULT 'OFF',
  brightness integer DEFAULT 100,
  speed integer DEFAULT 1,
  is_online boolean DEFAULT true,
  hardware_status text DEFAULT 'confirmed',
  power_rating_watts numeric DEFAULT 0,
  daily_kwh numeric DEFAULT 0,
  weekly_kwh numeric DEFAULT 0,
  monthly_kwh numeric DEFAULT 0,
  yearly_kwh numeric DEFAULT 0,
  last_hardware_sync timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. VISITS (FOUNDATIONAL)
CREATE TABLE IF NOT EXISTS public.visits (
  id text PRIMARY KEY,
  student_roll text NOT NULL,
  student_name text NOT NULL,
  entry_time timestamptz DEFAULT now(),
  exit_time timestamptz,
  duration_minutes integer,
  status text DEFAULT 'inside',
  entry_method text DEFAULT 'face',
  exit_method text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_student_roll_base ON public.visits (UPPER(student_roll));
CREATE INDEX IF NOT EXISTS idx_visits_status_base ON public.visits (status);

-- 5. TRANSACTIONS (FOUNDATIONAL)
CREATE TABLE IF NOT EXISTS public.transactions (
  id text PRIMARY KEY,
  student_roll text NOT NULL,
  student_name text NOT NULL,
  authorized_by text,
  issue_date timestamptz DEFAULT now(),
  overall_due_date timestamptz,
  returned_date timestamptz,
  status text DEFAULT 'active',
  items jsonb DEFAULT '[]'::jsonb,
  last_return_date timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_student_roll_base ON public.transactions (UPPER(student_roll));
CREATE INDEX IF NOT EXISTS idx_transactions_status_base ON public.transactions (status);

-- 6. AUTHORIZATIONS (FOUNDATIONAL)
CREATE TABLE IF NOT EXISTS public.authorizations (
  id text PRIMARY KEY,
  primary_student_roll text NOT NULL,
  primary_student_name text NOT NULL,
  authorized_student_roll text NOT NULL,
  authorized_student_name text NOT NULL,
  scope text DEFAULT 'both',
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  status text DEFAULT 'active',
  reason text,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_primary_roll_base ON public.authorizations (UPPER(primary_student_roll));
CREATE INDEX IF NOT EXISTS idx_auth_authorized_roll_base ON public.authorizations (UPPER(authorized_student_roll));

-- 7. SETTINGS (FOUNDATIONAL)
CREATE TABLE IF NOT EXISTS public.settings (
  id text PRIMARY KEY,
  key text UNIQUE,
  value jsonb,
  incubation_center_name text DEFAULT 'Incubation Centre',
  college_name text,
  default_retention_days integer DEFAULT 30,
  electricity_tariff_per_kwh numeric DEFAULT 7.50,
  emergency_fallback_active boolean DEFAULT false,
  esp32_endpoint text DEFAULT 'http://esp32-lab.local',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8. AUDIT LOGS (FOUNDATIONAL)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY,
  timestamp timestamptz DEFAULT now(),
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  target_roll text,
  target_component_id text,
  previous_value text,
  new_value text,
  details text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp_base ON public.audit_logs (timestamp DESC);
