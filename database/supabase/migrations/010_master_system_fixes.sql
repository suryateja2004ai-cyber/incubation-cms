-- ==============================================================================
-- 010_master_system_fixes.sql
-- VRSEC Incubation Centre Management System
-- Master Fixes: Atomic Component Issue/Return Grants, Unique Tag Constraints,
-- Project Deletion Policies, and Event/Achievement Administrative Controls
-- ==============================================================================
-- NOTE: Prepared for User Approval.
-- Do not execute in production without explicit administrator confirmation.
-- ==============================================================================

-- 1. Ensure Unique Component Tag at DB level to prevent concurrent insertion collision
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_components_component_number'
  ) THEN
    ALTER TABLE IF EXISTS public.components
      ADD CONSTRAINT uq_components_component_number UNIQUE (component_number);
  END IF;
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- 2. Grant execution permissions on atomic inventory procedures strictly to authenticated staff/admin
-- LEAST-PRIVILEGE AUDIT: 'anon' is explicitly revoked to prevent unauthenticated access.
DO $$
BEGIN
  -- Restrict and grant execution on issue_components_atomic strictly to authenticated
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'issue_components_atomic'
  ) THEN
    REVOKE ALL ON FUNCTION public.issue_components_atomic FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.issue_components_atomic TO authenticated;
  END IF;

  -- Restrict and grant execution on return_components_atomic strictly to authenticated
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'return_components_atomic'
  ) THEN
    REVOKE ALL ON FUNCTION public.return_components_atomic FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.return_components_atomic TO authenticated;
  END IF;
END $$;

-- 3. Projects Table: Administrative Delete & Write Policies
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sir and Admins can delete projects" ON public.projects;
CREATE POLICY "Sir and Admins can delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

DROP POLICY IF EXISTS "Sir and Admins can update projects" ON public.projects;
CREATE POLICY "Sir and Admins can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  )
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

-- 4. Achievements Table: Administrative Delete & Update Policies
ALTER TABLE IF EXISTS public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sir and Admins can delete achievements" ON public.achievements;
CREATE POLICY "Sir and Admins can delete achievements" ON public.achievements
  FOR DELETE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

DROP POLICY IF EXISTS "Sir and Admins can update achievements" ON public.achievements;
CREATE POLICY "Sir and Admins can update achievements" ON public.achievements
  FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  )
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

-- 5. Events Table: Administrative Delete & Update Policies
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sir and Admins can delete events" ON public.events;
CREATE POLICY "Sir and Admins can delete events" ON public.events
  FOR DELETE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

DROP POLICY IF EXISTS "Sir and Admins can update events" ON public.events;
CREATE POLICY "Sir and Admins can update events" ON public.events
  FOR UPDATE TO authenticated
  USING (
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  )
  WITH CHECK (
    public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  );

-- 6. Ensure real-time replication for events, achievements, and projects
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.achievements;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
