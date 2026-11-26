-- ==============================================================================
-- 009_public_read_staff_presence.sql
-- VRSEC Incubation Centre Management System
-- Enable Public & Anonymous Read Access for Global Admin Lab Presence
-- ==============================================================================
--
-- PURPOSE:
-- 1. Allows all portal sessions (authenticated students, staff, mentors, and anon visitors)
--    to read real-time administrator laboratory presence from public.staff_presence.
-- 2. Preserves strict write isolation: Only authorized administrators, substitute admins,
--    and faculty mentors can modify their presence records.
--
-- ==============================================================================

-- 1. Ensure RLS is active on public.staff_presence
ALTER TABLE IF EXISTS public.staff_presence ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive SELECT policy if present
DROP POLICY IF EXISTS "Authenticated users view staff presence" ON public.staff_presence;
DROP POLICY IF EXISTS "Allow public read staff presence" ON public.staff_presence;

-- 3. Create non-blocking SELECT policy accessible to both anon and authenticated clients
CREATE POLICY "Allow public read staff presence" ON public.staff_presence
  FOR SELECT TO anon, authenticated
  USING (true);

-- 4. Re-affirm strict administrative write policy (INSERT / UPDATE / DELETE restricted)
DROP POLICY IF EXISTS "Staff and Admins manage staff presence" ON public.staff_presence;
CREATE POLICY "Staff and Admins manage staff presence" ON public.staff_presence
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir', 'staff'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir', 'staff'));

-- 5. Enable Realtime replication for public.staff_presence if publication exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_presence;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Table already added to publication
    NULL;
END $$;
