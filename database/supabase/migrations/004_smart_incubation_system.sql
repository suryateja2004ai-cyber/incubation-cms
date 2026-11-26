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
