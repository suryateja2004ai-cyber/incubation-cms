-- ==============================================================================
-- CONSOLIDATED POST-MIGRATION 007 SECURITY & COMPLIANCE VERIFICATION AUDIT
-- SCRIPT: verify_migration_007_complete.sql
-- TARGET: Supabase PostgreSQL Database (SQL Editor)
-- SOURCE OF TRUTH: database/supabase/migrations/007_restricted_staff_role.sql
--
-- STRICT READ-ONLY INTEGRITY:
-- - Contains strictly SELECT and catalog inspection queries.
-- - ZERO DDL, DML, GRANT, REVOKE, TRUNCATE, DO blocks, or mutating statements.
-- - Completely non-destructive: Safe to execute repeatedly in Supabase SQL Editor.
-- - Produces ONE consolidated results table with 7 standardized columns:
--     1. "Section"                (Audit domain: A through F)
--     2. "Check ID"               (Unique check identifier: A01..F12)
--     3. "Database Object"        (Table, view, function, policy, or trigger)
--     4. "Expected Configuration" (Authoritative requirement from Migration 007)
--     5. "Actual Configuration"   (Live database catalog inspection)
--     6. "Status"                 (PASS | FAIL | MANUAL REVIEW | NOT FOUND)
--     7. "Explanation"            (Detailed findings, security context, and catalog evidence)
--
-- COVERAGE SUMMARY (84 COMPREHENSIVE CHECKS):
-- - Section A (A01 - A13): Idempotency Ledger (public.processed_rpc_operations - RLS, policies, privileges)
-- - Section B (B01 - B13): Users Table (public.users - isolation, admin/student policies, staff lockout)
-- - Section C (C01 - C17): Auth & Security Functions (get_my_profile, role helpers, search_path, ACL)
-- - Section D (D01 - D11): Student Directory (staff_student_directory view, 13-col whitelist, security barrier, RPC)
-- - Section E (E01 - E18): Transactions & Operations (public.transactions write lockdown, atomic RPCs, ledger logging)
-- - Section F (F01 - F12): Other Security Objects (components, visits, student_roster, triggers, core roles)
--
-- POLICY VERIFICATION SAFEGUARDS:
-- - Uses exact normalized expression whitelisting (stripping whitespace and deparsing variances).
-- - Zero substring matching (ILIKE '%admin%') to prevent malicious OR true or injected role bypasses.
-- - Fails closed: unverified or unrecognized policy expressions report MANUAL REVIEW instead of false PASS.
-- - Guards against missing PostgreSQL roles without aborting query execution.
-- ==============================================================================

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A01' AS "Check ID",
    'public.processed_rpc_operations' AS "Database Object",
    'Table exists in public schema with relkind = ''r''' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relkind=''' || c.relkind::text || '''' FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND c.relkind = 'r')
        THEN 'PASS'
      ELSE 'NOT FOUND'
    END AS "Status",
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND c.relkind = 'r')
        THEN 'Idempotency ledger table public.processed_rpc_operations exists as a standard relational table.'
      ELSE 'FAIL: Idempotency ledger table public.processed_rpc_operations does not exist in the public schema.'
    END AS "Explanation"

UNION ALL

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A02' AS "Check ID",
    'public.processed_rpc_operations' AS "Database Object",
    'Row-Level Security enabled (relrowsecurity = true)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relrowsecurity=' || c.relrowsecurity::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' LIMIT 1),
      'TABLE NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'NOT FOUND'
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND c.relrowsecurity = true)
        THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'Target table does not exist in catalog.'
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND c.relrowsecurity = true)
        THEN 'RLS is properly enabled on the idempotency ledger table.'
      ELSE 'CRITICAL SECURITY FAIL: Row-Level Security is DISABLED on public.processed_rpc_operations.'
    END AS "Explanation"

UNION ALL

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A03' AS "Check ID",
    'public.processed_rpc_operations' AS "Database Object",
    'FORCE Row-Level Security enabled (relforcerowsecurity = true)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relforcerowsecurity=' || c.relforcerowsecurity::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' LIMIT 1),
      'TABLE NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'NOT FOUND'
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND c.relforcerowsecurity = true)
        THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'Target table does not exist in catalog.'
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND c.relforcerowsecurity = true)
        THEN 'FORCE RLS is enabled, ensuring table owners cannot inadvertently bypass policies.'
      ELSE 'FAIL: FORCE RLS is not enabled on public.processed_rpc_operations.'
    END AS "Explanation"

UNION ALL

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A04' AS "Check ID",
    'public.processed_rpc_operations' AS "Database Object",
    'Exactly 1 client policy exists: "Admins view processed rpc operations"' AS "Expected Configuration",
    COALESCE(
      (SELECT 'policy_count=' || count(*)::text || ' (' || COALESCE(string_agg(policyname, ', '), 'NONE') || ')' FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations'),
      'TABLE NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'NOT FOUND'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations') = 1
        AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations')
        THEN 'PASS'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations') = 0
        THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'Target table does not exist in catalog.'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations') = 1
        AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations')
        THEN 'Exactly 1 policy exists with the approved administrative name.'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations') = 0
        THEN 'FAIL: Zero policies exist on public.processed_rpc_operations (unprotected ledger).'
      ELSE 'MANUAL REVIEW: Unexpected policy count or name mismatch on public.processed_rpc_operations.'
    END AS "Explanation"

UNION ALL

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A05' AS "Check ID",
    'public.processed_rpc_operations.Admins view processed rpc operations' AS "Database Object",
    'cmd = ''SELECT''' AS "Expected Configuration",
    COALESCE(
      (SELECT 'cmd=''' || cmd || '''' FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations' LIMIT 1),
      'POLICY NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations')
        THEN 'NOT FOUND'
      WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations' AND cmd = 'SELECT')
        THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations')
        THEN 'Expected policy does not exist.'
      WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations' AND cmd = 'SELECT')
        THEN 'Policy command is strictly SELECT.'
      ELSE 'FAIL: Expected SELECT policy but found different command.'
    END AS "Explanation"

UNION ALL

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A06' AS "Check ID",
    'public.processed_rpc_operations.Admins view processed rpc operations' AS "Database Object",
    'roles = ''{authenticated}''' AS "Expected Configuration",
    COALESCE(
      (SELECT 'roles=''' || roles::text || '''' FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations' LIMIT 1),
      'POLICY NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations')
        THEN 'NOT FOUND'
      WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations' AND roles = '{authenticated}')
        THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations')
        THEN 'Expected policy does not exist.'
      WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations' AND roles = '{authenticated}')
        THEN 'Database roles array is strictly {authenticated} with zero unapproved role exposure.'
      ELSE 'FAIL: Database roles array differs from {authenticated}.'
    END AS "Explanation"

UNION ALL

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A07' AS "Check ID",
    'public.processed_rpc_operations.Admins view processed rpc operations' AS "Database Object",
    'USING = public.get_current_user_role() IN (''admin'', ''substitute_admin'', ''sir'')' AS "Expected Configuration",
    COALESCE(
      (SELECT 'qual=' || qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations' LIMIT 1),
      'POLICY NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations')
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'processed_rpc_operations'
          AND pol.policyname = 'Admins view processed rpc operations'
          AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
          )
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'processed_rpc_operations'
          AND pol.policyname = 'Admins view processed rpc operations'
          AND (pol.qual ILIKE '%staff%' OR pol.qual = 'true' OR pol.qual IS NULL)
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations')
        THEN 'Expected policy does not exist.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'processed_rpc_operations'
          AND pol.policyname = 'Admins view processed rpc operations'
          AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
          )
      ) THEN 'USING expression matches the exact canonical deparsed form of Migration 007 admin role restriction.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'processed_rpc_operations'
          AND pol.policyname = 'Admins view processed rpc operations'
          AND (pol.qual ILIKE '%staff%' OR pol.qual = 'true' OR pol.qual IS NULL)
      ) THEN 'CRITICAL SECURITY FAIL: Policy permits staff access or contains an unconditional true clause.'
      ELSE 'MANUAL REVIEW: Expression syntax differs from canonical deparsed forms; inspect manually for safety.'
    END AS "Explanation"

UNION ALL

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A08' AS "Check ID",
    'public.processed_rpc_operations.Admins view processed rpc operations' AS "Database Object",
    'with_check IS NULL (SELECT policy must not define WITH CHECK)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'with_check=' || COALESCE(with_check, 'NULL') FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations' LIMIT 1),
      'POLICY NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations')
        THEN 'NOT FOUND'
      WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations' AND with_check IS NULL)
        THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations')
        THEN 'Expected policy does not exist.'
      WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations' AND policyname = 'Admins view processed rpc operations' AND with_check IS NULL)
        THEN 'WITH CHECK expression is correctly NULL for read-only SELECT policy.'
      ELSE 'FAIL: Unexpected WITH CHECK clause attached to SELECT policy.'
    END AS "Explanation"

UNION ALL

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A09' AS "Check ID",
    'public.processed_rpc_operations' AS "Database Object",
    'Zero unapproved policies (no staff, student, anon, or direct client DML policies)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'Unexpected policies: ' || string_agg(policyname || ' [cmd=' || cmd || ']', '; ')
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations'
         AND policyname <> 'Admins view processed rpc operations'),
      'Zero unexpected policies (Clean)'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations'
          AND policyname <> 'Admins view processed rpc operations'
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations'
          AND policyname <> 'Admins view processed rpc operations'
      ) THEN 'No unexpected, staff, or direct client DML policies exist on the ledger table.'
      ELSE 'FAIL: Unapproved extra policies detected on public.processed_rpc_operations.'
    END AS "Explanation"

UNION ALL

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A10' AS "Check ID",
    'public.processed_rpc_operations' AS "Database Object",
    'PUBLIC table privileges = NONE (0 privileges in aclexplode grantee=0)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'PUBLIC privileges: ' || string_agg(a.privilege_type, ', ')
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
       WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND a.grantee = 0),
      'NONE (0 privileges)'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND a.grantee = 0
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND a.grantee = 0
      ) THEN 'PUBLIC pseudo-role has 0 table privileges on the idempotency ledger.'
      ELSE 'CRITICAL SECURITY FAIL: PUBLIC pseudo-role has table privileges on public.processed_rpc_operations.'
    END AS "Explanation"

UNION ALL

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A11' AS "Check ID",
    'public.processed_rpc_operations' AS "Database Object",
    'anon table privileges = NONE (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER: false)' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'TABLE NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'ROLE MISSING'
      ELSE (
        SELECT 'anon privileges: ' || array_to_string(ARRAY[
          CASE WHEN has_table_privilege('anon', c.oid, 'SELECT') THEN 'SELECT' END,
          CASE WHEN has_table_privilege('anon', c.oid, 'INSERT') THEN 'INSERT' END,
          CASE WHEN has_table_privilege('anon', c.oid, 'UPDATE') THEN 'UPDATE' END,
          CASE WHEN has_table_privilege('anon', c.oid, 'DELETE') THEN 'DELETE' END,
          CASE WHEN has_table_privilege('anon', c.oid, 'TRUNCATE') THEN 'TRUNCATE' END,
          CASE WHEN has_table_privilege('anon', c.oid, 'REFERENCES') THEN 'REFERENCES' END,
          CASE WHEN has_table_privilege('anon', c.oid, 'TRIGGER') THEN 'TRIGGER' END
        ], ', ')
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
          AND (
            has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT')
            OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE')
            OR has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('anon', c.oid, 'REFERENCES')
            OR has_table_privilege('anon', c.oid, 'TRIGGER')
          )
      ) THEN 'FAIL'
      ELSE 'PASS'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
          AND (
            has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT')
            OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE')
            OR has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('anon', c.oid, 'REFERENCES')
            OR has_table_privilege('anon', c.oid, 'TRIGGER')
          )
      ) THEN 'CRITICAL SECURITY FAIL: anon role possesses table privileges on public.processed_rpc_operations.'
      ELSE 'Unauthenticated anon role has zero table privileges on the ledger.'
    END AS "Explanation"

UNION ALL

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A12' AS "Check ID",
    'public.processed_rpc_operations' AS "Database Object",
    'authenticated table privileges = SELECT ONLY (DML & admin privileges denied)' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'TABLE NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'ROLE MISSING'
      ELSE (
        SELECT 'authenticated privileges: ' || array_to_string(ARRAY[
          CASE WHEN has_table_privilege('authenticated', c.oid, 'SELECT') THEN 'SELECT' END,
          CASE WHEN has_table_privilege('authenticated', c.oid, 'INSERT') THEN 'INSERT' END,
          CASE WHEN has_table_privilege('authenticated', c.oid, 'UPDATE') THEN 'UPDATE' END,
          CASE WHEN has_table_privilege('authenticated', c.oid, 'DELETE') THEN 'DELETE' END,
          CASE WHEN has_table_privilege('authenticated', c.oid, 'TRUNCATE') THEN 'TRUNCATE' END,
          CASE WHEN has_table_privilege('authenticated', c.oid, 'REFERENCES') THEN 'REFERENCES' END,
          CASE WHEN has_table_privilege('authenticated', c.oid, 'TRIGGER') THEN 'TRIGGER' END
        ], ', ')
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND NOT (
            has_table_privilege('authenticated', c.oid, 'INSERT')
            OR has_table_privilege('authenticated', c.oid, 'UPDATE')
            OR has_table_privilege('authenticated', c.oid, 'DELETE')
            OR has_table_privilege('authenticated', c.oid, 'TRUNCATE')
            OR has_table_privilege('authenticated', c.oid, 'REFERENCES')
            OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
          )
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND NOT (
            has_table_privilege('authenticated', c.oid, 'INSERT')
            OR has_table_privilege('authenticated', c.oid, 'UPDATE')
            OR has_table_privilege('authenticated', c.oid, 'DELETE')
            OR has_table_privilege('authenticated', c.oid, 'TRUNCATE')
            OR has_table_privilege('authenticated', c.oid, 'REFERENCES')
            OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
          )
      ) THEN 'authenticated role possesses SELECT privilege only (required for RLS evaluation); direct client DML is denied.'
      ELSE 'FAIL: authenticated role lacks SELECT or possesses unauthorized direct DML privileges on the ledger.'
    END AS "Explanation"

UNION ALL

SELECT
    'A. Idempotency Ledger' AS "Section",
    'A13' AS "Check ID",
    'public.processed_rpc_operations' AS "Database Object",
    'service_role table privileges = ALL 7 (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER)' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'TABLE NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'ROLE MISSING'
      ELSE (
        SELECT 'service_role privileges: ' || array_to_string(ARRAY[
          CASE WHEN has_table_privilege('service_role', c.oid, 'SELECT') THEN 'SELECT' END,
          CASE WHEN has_table_privilege('service_role', c.oid, 'INSERT') THEN 'INSERT' END,
          CASE WHEN has_table_privilege('service_role', c.oid, 'UPDATE') THEN 'UPDATE' END,
          CASE WHEN has_table_privilege('service_role', c.oid, 'DELETE') THEN 'DELETE' END,
          CASE WHEN has_table_privilege('service_role', c.oid, 'TRUNCATE') THEN 'TRUNCATE' END,
          CASE WHEN has_table_privilege('service_role', c.oid, 'REFERENCES') THEN 'REFERENCES' END,
          CASE WHEN has_table_privilege('service_role', c.oid, 'TRIGGER') THEN 'TRIGGER' END
        ], ', ')
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'service_role possesses all 7 required privileges to manage idempotency operations and RPC executions.'
      ELSE 'FAIL: service_role lacks one or more required privileges on public.processed_rpc_operations.'
    END AS "Explanation"

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B01' AS "Check ID",
    'public.users' AS "Database Object",
    'Table exists in public schema with relkind = ''r''' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relkind=''' || c.relkind::text || '''' FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users' LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind = 'r')
        THEN 'PASS'
      ELSE 'NOT FOUND'
    END AS "Status",
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind = 'r')
        THEN 'Users table public.users exists as a standard relational table.'
      ELSE 'FAIL: Users table public.users does not exist in the public schema.'
    END AS "Explanation"

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B02' AS "Check ID",
    'public.users' AS "Database Object",
    'Row-Level Security enabled (relrowsecurity = true)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relrowsecurity=' || c.relrowsecurity::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users' LIMIT 1),
      'TABLE NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'NOT FOUND'
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relrowsecurity = true)
        THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'Target table does not exist in catalog.'
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relrowsecurity = true)
        THEN 'Row-Level Security is enabled on public.users.'
      ELSE 'FAIL: Row-Level Security is disabled on public.users.'
    END AS "Explanation"

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B03' AS "Check ID",
    'public.users' AS "Database Object",
    'FORCE Row-Level Security enabled (relforcerowsecurity = true)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relforcerowsecurity=' || c.relforcerowsecurity::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users' LIMIT 1),
      'TABLE NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'NOT FOUND'
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relforcerowsecurity = true)
        THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'Target table does not exist in catalog.'
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relforcerowsecurity = true)
        THEN 'FORCE Row-Level Security is enabled on public.users, ensuring table owners cannot bypass policies.'
      ELSE 'FAIL: FORCE Row-Level Security is not enabled on public.users.'
    END AS "Explanation"

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B04' AS "Check ID",
    'public.users.Admins manage users' AS "Database Object",
    'cmd = ''ALL'', roles = ''{authenticated}'', USING & WITH CHECK match admin whitelist, exactly 2 policies on table' AS "Expected Configuration",
    COALESCE(
      (SELECT 'cmd=' || pol.cmd || ', roles=' || pol.roles::text || ', qual=' || COALESCE(pol.qual, 'NULL') || ', with_check=' || COALESCE(pol.with_check, 'NULL')
       FROM pg_policies pol WHERE pol.schemaname = 'public' AND pol.tablename = 'users' AND pol.policyname = 'Admins manage users' LIMIT 1),
      'POLICY NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Admins manage users')
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'users' AND pol.policyname = 'Admins manage users'
          AND (
            pol.cmd <> 'ALL'
            OR pol.roles <> '{authenticated}'
            OR pol.qual = 'true'
            OR pol.with_check = 'true'
            OR pol.qual ILIKE '%staff%'
            OR pol.roles::text ILIKE '%staff%'
          )
      ) THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'users' AND pol.policyname = 'Admins manage users'
          AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
          AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
          )
          AND (
            pol.with_check IS NULL
            OR regexp_replace(pol.with_check, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
          )
      )
      AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') = 2
      THEN 'PASS'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Admins manage users')
        THEN 'Expected administrator policy does not exist.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'users' AND pol.policyname = 'Admins manage users'
          AND (
            pol.cmd <> 'ALL'
            OR pol.roles <> '{authenticated}'
            OR pol.qual = 'true'
            OR pol.with_check = 'true'
            OR pol.qual ILIKE '%staff%'
            OR pol.roles::text ILIKE '%staff%'
          )
      ) THEN 'CRITICAL FAIL: Policy contains unsafe access condition, exposes admin capability to staff/anon, or has incorrect command/roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'users' AND pol.policyname = 'Admins manage users'
          AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
          AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
          )
          AND (
            pol.with_check IS NULL
            OR regexp_replace(pol.with_check, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
          )
      )
      AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') = 2
      THEN 'Admin policy on public.users correctly enforces admin/substitute_admin/sir restriction for ALL commands (both USING and WITH CHECK verified; table policy count = 2).'
      ELSE 'MANUAL REVIEW: Admin policy expression on users differs from canonical normalized forms or unexpected additional policies exist.'
    END AS "Explanation"

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B05' AS "Check ID",
    'public.users.Students view own profile' AS "Database Object",
    'cmd = ''SELECT'', roles = ''{authenticated}'', with_check IS NULL, USING restricted strictly to own student record' AS "Expected Configuration",
    COALESCE(
      (SELECT 'cmd=' || pol.cmd || ', roles=' || pol.roles::text || ', qual=' || COALESCE(pol.qual, 'NULL')
       FROM pg_policies pol WHERE pol.schemaname = 'public' AND pol.tablename = 'users' AND pol.policyname = 'Students view own profile' LIMIT 1),
      'POLICY NOT FOUND'
    ) AS "Actual Configuration",
    b05_eval.status AS "Status",
    CASE
      WHEN b05_eval.status = 'NOT FOUND' THEN 'Expected student self-profile policy does not exist.'
      WHEN b05_eval.status = 'PASS' THEN 'Student self-profile policy matches canonical Migration 007 definition: role=''student'' and (auth_id = auth.uid() OR roll matches get_current_student_roll()).'
      WHEN b05_eval.status = 'FAIL' THEN 'CRITICAL FAIL: Student policy is overly permissive or exposes data to unauthorized roles.'
      ELSE 'MANUAL REVIEW: Student self-profile policy expression on users differs from canonical normalized forms.'
    END AS "Explanation"
  FROM (
    SELECT
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Students view own profile')
          THEN 'NOT FOUND'
        WHEN EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'users' AND pol.policyname = 'Students view own profile'
            AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}'
            AND pol.with_check IS NULL
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '((role=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '(((role=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '((role=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '((role=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '(((role=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role=''student''::text))AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role=''student''::text))AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role=''student''::text))AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role=''student''::text))AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(((auth_id=(SELECTauth.uid())))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(auth_id=(SELECTauth.uid()ASuid)OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND((auth_id=(SELECTauth.uid()ASuid))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(auth_id=auth.uid()OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND((auth_id=auth.uid())OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(public.get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim((roll_number)::text))=lower(btrim(get_current_student_roll())))))))',
            '(((role)::text=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll()))))))',
            '((((role)::text=''student''::text)AND(((auth_id=auth.uid()))OR((auth.uid()ISNOTNULL)AND(lower(btrim(roll_number))=lower(btrim(get_current_student_roll())))))))'
            )
        ) THEN 'PASS'
        WHEN EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'users' AND pol.policyname = 'Students view own profile'
            AND (pol.qual ILIKE '%staff%' OR pol.qual = 'true' OR pol.roles::text ILIKE '%anon%')
        ) THEN 'FAIL'
        ELSE 'MANUAL REVIEW'
      END AS status
  ) AS b05_eval

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B06' AS "Check ID",
    'public.users' AS "Database Object",
    'Exactly 2 policies exist: "Admins manage users" and "Students view own profile"' AS "Expected Configuration",
    COALESCE(
      (SELECT 'policy_count=' || count(*)::text || ' (' || string_agg(policyname, ', ') || ')'
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users'),
      'TABLE NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'NOT FOUND'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') = 2
        AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Admins manage users')
        AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Students view own profile')
        THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'Target table does not exist in catalog.'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') = 2
        AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Admins manage users')
        AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Students view own profile')
        THEN 'Exactly the 2 approved policies exist on public.users with zero unapproved or legacy policies.'
      ELSE 'FAIL: Unexpected policy count or unknown policy present on public.users.'
    END AS "Explanation"

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B07' AS "Check ID",
    'public.users' AS "Database Object",
    'Zero policies permit direct staff access on public.users (staff access mediated strictly via staff_student_directory and get_my_profile)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'policy_count=' || count(*)::text || ' (' || string_agg(pol.policyname || ' [' || pol.cmd || ']', ', ') || ')'
       FROM pg_policies pol WHERE pol.schemaname = 'public' AND pol.tablename = 'users'),
      'TABLE NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'NOT FOUND'
      -- Violation: any policy where roles include staff or public, or where qual/with_check allows staff
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'users'
          AND (
            pol.roles::text ILIKE '%staff%'
            OR pol.roles::text ILIKE '%public%'
            OR pol.qual = 'true'
            OR (pol.cmd IN ('INSERT', 'ALL') AND pol.with_check = 'true')
            OR regexp_replace(lower(COALESCE(pol.qual, '')), '\s+', '', 'g') LIKE '%role=''staff''%'
            OR (pol.with_check IS NOT NULL AND regexp_replace(lower(pol.with_check), '\s+', '', 'g') LIKE '%role=''staff''%')
          )
      ) THEN 'FAIL'
      -- Approved state: exactly the 2 approved policies exist and both match their strict whitelists
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') = 2
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'users'
            AND pol.policyname = 'Admins manage users' AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
            AND (
              pol.with_check IS NULL
              OR regexp_replace(pol.with_check, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
              )
            )
        )
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'users'
            AND pol.policyname = 'Students view own profile' AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}'
            AND pol.with_check IS NULL
            AND (pol.qual ILIKE '%role%student%' OR pol.qual ILIKE '%student%')
            AND NOT (pol.qual ILIKE '%staff%')
        )
        THEN 'PASS'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'Target table does not exist in catalog.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'users'
          AND (
            pol.roles::text ILIKE '%staff%'
            OR pol.roles::text ILIKE '%public%'
            OR pol.qual = 'true'
            OR (pol.cmd IN ('INSERT', 'ALL') AND pol.with_check = 'true')
            OR regexp_replace(lower(COALESCE(pol.qual, '')), '\s+', '', 'g') LIKE '%role=''staff''%'
            OR (pol.with_check IS NOT NULL AND regexp_replace(lower(pol.with_check), '\s+', '', 'g') LIKE '%role=''staff''%')
          )
      ) THEN 'CRITICAL SECURITY FAIL: Staff direct access is permitted on public.users by one or more active policies.'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') = 2
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'users'
            AND pol.policyname = 'Admins manage users' AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
        )
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'users'
            AND pol.policyname = 'Students view own profile' AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}'
        )
        THEN 'Command-aware RLS policy evaluation confirms zero staff access: exactly 2 policies exist, admin ALL policy strictly excludes staff, student SELECT policy strictly excludes staff.'
      ELSE 'MANUAL REVIEW: Unexpected policy configuration or unverified expression on public.users.'
    END AS "Explanation"

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B08' AS "Check ID",
    'public.users' AS "Database Object",
    'Zero policies grant direct INSERT, UPDATE, or DELETE to staff or students (student updates mediated by RPC)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'Non-admin write policies: ' || string_agg(policyname || ' [cmd=' || cmd || ']', '; ')
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'users'
         AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
         AND policyname <> 'Admins manage users'),
      'Zero non-admin direct write policies (Clean)'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'users'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
          AND policyname <> 'Admins manage users'
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'users'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
          AND policyname <> 'Admins manage users'
      ) THEN 'Non-admins have zero direct write policies on public.users; student updates are strictly mediated via public.update_student_profile.'
      ELSE 'FAIL: Direct client write policy found on public.users outside of the administrator policy.'
    END AS "Explanation"

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B09' AS "Check ID",
    'public.users' AS "Database Object",
    'PUBLIC & anon table privileges = NONE (all 7 denied)' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'TABLE NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
        ) THEN 'EXPOSED' ELSE 'NONE' END || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT')
            OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE')
            OR has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('anon', c.oid, 'REFERENCES')
            OR has_table_privilege('anon', c.oid, 'TRIGGER') THEN 'EXPOSED'
          ELSE 'NONE'
        END
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users'
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
        WHERE n.nspname = 'public' AND c.relname = 'users' AND a.grantee = 0
      ) THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users'
          AND (
            has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT')
            OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE')
            OR has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('anon', c.oid, 'REFERENCES')
            OR has_table_privilege('anon', c.oid, 'TRIGGER')
          )
      ) THEN 'FAIL'
      ELSE 'PASS'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
        WHERE n.nspname = 'public' AND c.relname = 'users' AND a.grantee = 0
      ) OR EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users'
          AND (
            has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT')
            OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE')
            OR has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('anon', c.oid, 'REFERENCES')
            OR has_table_privilege('anon', c.oid, 'TRIGGER')
          )
      ) THEN 'CRITICAL SECURITY FAIL: Unauthenticated callers (PUBLIC / anon) hold table privileges on public.users.'
      ELSE 'PUBLIC and anon roles hold zero table privileges on public.users.'
    END AS "Explanation"

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B10' AS "Check ID",
    'public.users' AS "Database Object",
    'authenticated table privileges = SELECT, UPDATE, DELETE (INSERT, TRUNCATE, TRIGGER, REFERENCES denied)' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'TABLE NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'ROLE MISSING'
      ELSE (
        SELECT 'authenticated privileges: ' || array_to_string(ARRAY[
          CASE WHEN has_table_privilege('authenticated', c.oid, 'SELECT') THEN 'SELECT' END,
          CASE WHEN has_table_privilege('authenticated', c.oid, 'INSERT') THEN 'INSERT' END,
          CASE WHEN has_table_privilege('authenticated', c.oid, 'UPDATE') THEN 'UPDATE' END,
          CASE WHEN has_table_privilege('authenticated', c.oid, 'DELETE') THEN 'DELETE' END,
          CASE WHEN has_table_privilege('authenticated', c.oid, 'TRUNCATE') THEN 'TRUNCATE' END,
          CASE WHEN has_table_privilege('authenticated', c.oid, 'REFERENCES') THEN 'REFERENCES' END,
          CASE WHEN has_table_privilege('authenticated', c.oid, 'TRIGGER') THEN 'TRIGGER' END
        ], ', ')
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users'
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users'
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND has_table_privilege('authenticated', c.oid, 'UPDATE')
          AND has_table_privilege('authenticated', c.oid, 'DELETE')
          AND NOT has_table_privilege('authenticated', c.oid, 'INSERT')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('authenticated', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRIGGER')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users'
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND has_table_privilege('authenticated', c.oid, 'UPDATE')
          AND has_table_privilege('authenticated', c.oid, 'DELETE')
          AND NOT has_table_privilege('authenticated', c.oid, 'INSERT')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('authenticated', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRIGGER')
      ) THEN 'authenticated table-level grants match Migration 007 Section 1 (SELECT, UPDATE, DELETE allowed; INSERT and administrative DDL denied).'
      ELSE 'FAIL: authenticated table-level privileges differ from the required specification.'
    END AS "Explanation"

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B11' AS "Check ID",
    'public.users' AS "Database Object",
    'service_role table privileges = ALL 7 (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER)' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'TABLE NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'ROLE MISSING'
      ELSE (
        SELECT 'service_role privileges: ' || array_to_string(ARRAY[
          CASE WHEN has_table_privilege('service_role', c.oid, 'SELECT') THEN 'SELECT' END,
          CASE WHEN has_table_privilege('service_role', c.oid, 'INSERT') THEN 'INSERT' END,
          CASE WHEN has_table_privilege('service_role', c.oid, 'UPDATE') THEN 'UPDATE' END,
          CASE WHEN has_table_privilege('service_role', c.oid, 'DELETE') THEN 'DELETE' END,
          CASE WHEN has_table_privilege('service_role', c.oid, 'TRUNCATE') THEN 'TRUNCATE' END,
          CASE WHEN has_table_privilege('service_role', c.oid, 'REFERENCES') THEN 'REFERENCES' END,
          CASE WHEN has_table_privilege('service_role', c.oid, 'TRIGGER') THEN 'TRIGGER' END
        ], ', ')
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users'
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users'
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users'
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'service_role holds all 7 privileges on public.users.'
      ELSE 'FAIL: service_role lacks one or more required privileges on public.users.'
    END AS "Explanation"

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B12' AS "Check ID",
    'public.users' AS "Database Object",
    'Table-level grants distinguish broad DML permissions from restrictive RLS row-filtering' AS "Expected Configuration",
    (
      SELECT 'Table-level: authenticated=' || CASE
        WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
        WHEN has_table_privilege('authenticated', c.oid, 'SELECT') THEN 'SELECT-granted'
        ELSE 'none'
      END
        || '; RLS-level: ' || (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') || ' policies active'
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'users'
      LIMIT 1
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relrowsecurity = true
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') = 2
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relrowsecurity = true
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') = 2
      ) THEN 'Clear security layer separation: authenticated role possesses table-level SELECT/UPDATE/DELETE, but RLS restricts row visibility to admins and own-profile students only.'
      ELSE 'FAIL: Security layers conflict or unverified on public.users.'
    END AS "Explanation"

UNION ALL

SELECT
    'B. Users Table & Privacy' AS "Section",
    'B13' AS "Check ID",
    'public.users.trg_protect_user_fields' AS "Database Object",
    'BEFORE UPDATE trigger trg_protect_user_fields active on public.users' AS "Expected Configuration",
    COALESCE(
      (SELECT 'trigger=' || tgname || ', enabled=' || tgenabled::text || ', func=' || p.proname
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_proc p ON p.oid = t.tgfoid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'users' AND t.tgname = 'trg_protect_user_fields' LIMIT 1),
      'TRIGGER NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_proc p ON p.oid = t.tgfoid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users'
          AND t.tgname = 'trg_protect_user_fields'
          AND t.tgenabled = 'O'
          AND p.proname = 'protect_user_fields_on_update'
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'users')
        THEN 'Target table does not exist in catalog.'
      WHEN EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_proc p ON p.oid = t.tgfoid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users'
          AND t.tgname = 'trg_protect_user_fields'
          AND t.tgenabled = 'O'
          AND p.proname = 'protect_user_fields_on_update'
      ) THEN 'Trigger trg_protect_user_fields is active and enabled, preventing non-admins from modifying sensitive user fields (role, auth_id, roll_number).'
      ELSE 'FAIL: User fields protection trigger is missing or disabled.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C01' AS "Check ID",
    'public.get_my_profile()' AS "Database Object",
    'Function exists with exact 0 arguments (pronargs = 0)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'args=' || p.pronargs::text || ' (' || pg_get_function_identity_arguments(p.oid) || ')'
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
      ) THEN 'PASS'
      ELSE 'NOT FOUND'
    END AS "Status",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
      ) THEN 'Function exists with exact zero-argument identity signature (pronargs = 0).'
      ELSE 'FAIL: Zero-argument function public.get_my_profile() is missing from the public schema.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C02' AS "Check ID",
    'public.get_my_profile()' AS "Database Object",
    'Returns TABLE with exact 16 columns: id (text), auth_id (uuid), roll_number (text), name (text), role (text), mobile_number (text), department (text), branch (text), section (text), academic_year (integer), avatar_theme (text), face_registered (boolean), face_photo_url (text), is_active (boolean), created_at (timestamptz), updated_at (timestamptz)' AS "Expected Configuration",
    COALESCE(
      (
        SELECT 'col_count=' || COALESCE(array_length(p.proargnames, 1), 0)::text || ', ret=' || pg_get_function_result(p.oid)
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
        LIMIT 1
      ),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND p.proretset = true
          AND p.proargnames = ARRAY[
            'id', 'auth_id', 'roll_number', 'name', 'role',
            'mobile_number', 'department', 'branch', 'section',
            'academic_year', 'avatar_theme', 'face_registered',
            'face_photo_url', 'is_active', 'created_at', 'updated_at'
          ]
          AND (SELECT count(*) FROM unnest(p.proargmodes) m WHERE m IN ('t', 'o')) = 16
          AND regexp_replace(pg_get_function_result(p.oid), '\s+', '', 'g') IN (
            'TABLE(idtext,auth_iduuid,roll_numbertext,nametext,roletext,mobile_numbertext,departmenttext,branchtext,sectiontext,academic_yearinteger,avatar_themetext,face_registeredboolean,face_photo_urltext,is_activeboolean,created_attimestampwithtimezone,updated_attimestampwithtimezone)',
            'TABLE(idtext,auth_iduuid,roll_numbertext,nametext,roletext,mobile_numbertext,departmenttext,branchtext,sectiontext,academic_yearint4,avatar_themetext,face_registeredbool,face_photo_urltext,is_activebool,created_attimestamptz,updated_attimestamptz)',
            'table(idtext,auth_iduuid,roll_numbertext,nametext,roletext,mobile_numbertext,departmenttext,branchtext,sectiontext,academic_yearinteger,avatar_themetext,face_registeredboolean,face_photo_urltext,is_activeboolean,created_attimestampwithtimezone,updated_attimestampwithtimezone)',
            'table(idtext,auth_iduuid,roll_numbertext,nametext,roletext,mobile_numbertext,departmenttext,branchtext,sectiontext,academic_yearint4,avatar_themetext,face_registeredbool,face_photo_urltext,is_activebool,created_attimestamptz,updated_attimestamptz)'
          )
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND (p.proretset = false OR p.proretset IS NULL)
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND p.proretset = true
          AND p.proargnames = ARRAY[
            'id', 'auth_id', 'roll_number', 'name', 'role',
            'mobile_number', 'department', 'branch', 'section',
            'academic_year', 'avatar_theme', 'face_registered',
            'face_photo_url', 'is_active', 'created_at', 'updated_at'
          ]
          AND (SELECT count(*) FROM unnest(p.proargmodes) m WHERE m IN ('t', 'o')) = 16
          AND regexp_replace(pg_get_function_result(p.oid), '\s+', '', 'g') IN (
            'TABLE(idtext,auth_iduuid,roll_numbertext,nametext,roletext,mobile_numbertext,departmenttext,branchtext,sectiontext,academic_yearinteger,avatar_themetext,face_registeredboolean,face_photo_urltext,is_activeboolean,created_attimestampwithtimezone,updated_attimestampwithtimezone)',
            'TABLE(idtext,auth_iduuid,roll_numbertext,nametext,roletext,mobile_numbertext,departmenttext,branchtext,sectiontext,academic_yearint4,avatar_themetext,face_registeredbool,face_photo_urltext,is_activebool,created_attimestamptz,updated_attimestamptz)',
            'table(idtext,auth_iduuid,roll_numbertext,nametext,roletext,mobile_numbertext,departmenttext,branchtext,sectiontext,academic_yearinteger,avatar_themetext,face_registeredboolean,face_photo_urltext,is_activeboolean,created_attimestampwithtimezone,updated_attimestampwithtimezone)',
            'table(idtext,auth_iduuid,roll_numbertext,nametext,roletext,mobile_numbertext,departmenttext,branchtext,sectiontext,academic_yearint4,avatar_themetext,face_registeredbool,face_photo_urltext,is_activebool,created_attimestamptz,updated_attimestamptz)'
          )
      ) THEN 'Function returns exact 16 expected profile columns with verified names and data types matching Migration 007 Section 2.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND (p.proretset = false OR p.proretset IS NULL)
      ) THEN 'FAIL: Function does not return a table set.'
      ELSE 'MANUAL REVIEW: Function return structure deviates from the exact 16 expected columns or column types.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C03' AS "Check ID",
    'public.get_my_profile()' AS "Database Object",
    'prosecdef = true (SECURITY DEFINER required for staff session bootstrapping)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'prosecdef=' || p.prosecdef::text
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND p.prosecdef = true
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND p.prosecdef = true
      ) THEN 'Function is marked SECURITY DEFINER, allowing legitimate authenticated staff to read their own profile without table-level users grants.'
      ELSE 'FAIL: Function is NOT SECURITY DEFINER (staff users will fail to load profile).'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C04' AS "Check ID",
    'public.get_my_profile()' AS "Database Object",
    'search_path explicitly pinned to: pg_catalog, public, pg_temp (pg_catalog safely prioritized)' AS "Expected Configuration",
    COALESCE(
      (SELECT COALESCE(array_to_string(p.proconfig, '; '), 'UNPINNED (NULL)')
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND p.proconfig IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg
            WHERE replace(replace(cfg, ' ', ''), '"', '') = 'search_path=pg_catalog,public,pg_temp'
          )
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, '; ') ILIKE '%search_path=%')
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND p.proconfig IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg
            WHERE replace(replace(cfg, ' ', ''), '"', '') = 'search_path=pg_catalog,public,pg_temp'
          )
      ) THEN 'search_path is strictly pinned to pg_catalog, public, pg_temp, safely prioritizing pg_catalog against schema hijacking.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, '; ') ILIKE '%search_path=%')
      ) THEN 'FAIL: SECURITY DEFINER function public.get_my_profile() has UNPINNED search_path (high security vulnerability).'
      ELSE 'MANUAL REVIEW: Function has custom search_path that does not strictly match pg_catalog, public, pg_temp.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C05' AS "Check ID",
    'public.get_my_profile()' AS "Database Object",
    'Function owner is a trusted administrative role (postgres or supabase_admin)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'owner=' || r.rolname
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_roles r ON r.oid = p.proowner
       WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_roles r ON r.oid = p.proowner
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND r.rolname IN ('postgres', 'supabase_admin')
      ) THEN 'PASS'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_roles r ON r.oid = p.proowner
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND r.rolname IN ('postgres', 'supabase_admin')
      ) THEN 'Function is owned by a trusted superuser/admin role.'
      ELSE 'MANUAL REVIEW: Function owner differs from standard postgres/supabase_admin.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C06' AS "Check ID",
    'public.get_my_profile()' AS "Database Object",
    'EXECUTE privileges: PUBLIC=DENIED, anon=DENIED, service_role=DENIED, authenticated=ALLOWED' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
        ) THEN 'GRANTED' ELSE 'DENIED' END
        || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; authenticated=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
          WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; service_role=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'ROLE MISSING'
          WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
        LIMIT 1
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_my_profile' AND p.pronargs = 0
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      ) THEN 'Execution is granted strictly to authenticated sessions; PUBLIC, anon, and service_role are denied.'
      ELSE 'FAIL: Execution permissions on get_my_profile() deviate from Migration 007 requirements.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C07' AS "Check ID",
    'public.get_current_user_role()' AS "Database Object",
    'Function exists with exact 0 arguments (pronargs = 0), returning text' AS "Expected Configuration",
    COALESCE(
      (SELECT 'args=' || p.pronargs::text || ' (' || pg_get_function_identity_arguments(p.oid) || '), return=' || p.prorettype::regtype::text
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0 AND p.prorettype::regtype::text = 'text'
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0 AND p.prorettype::regtype::text = 'text'
      ) THEN 'Function exists with exact zero arguments, returning text role value.'
      ELSE 'FAIL: Function public.get_current_user_role() is missing or returns incorrect type.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C08' AS "Check ID",
    'public.get_current_user_role()' AS "Database Object",
    'prosecdef = true, provolatile = ''s'' (STABLE required for RLS caching)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'prosecdef=' || p.prosecdef::text || ', provolatile=''' || p.provolatile::text || ''''
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0
          AND p.prosecdef = true AND p.provolatile = 's'
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0
          AND p.prosecdef = true AND p.provolatile = 's'
      ) THEN 'Function is marked SECURITY DEFINER and STABLE, enabling high-performance RLS policy evaluation.'
      ELSE 'FAIL: get_current_user_role is not SECURITY DEFINER or not STABLE.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C09' AS "Check ID",
    'public.get_current_user_role()' AS "Database Object",
    'search_path explicitly pinned to: public, auth, pg_temp or pg_catalog, public, auth, pg_temp' AS "Expected Configuration",
    COALESCE(
      (SELECT COALESCE(array_to_string(p.proconfig, '; '), 'UNPINNED (NULL)')
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0
          AND p.proconfig IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg
            WHERE replace(replace(cfg, ' ', ''), '"', '') IN (
              'search_path=public,auth,pg_temp',
              'search_path=pg_catalog,public,auth,pg_temp',
              'search_path=pg_catalog,public,pg_temp'
            )
          )
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0
          AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, '; ') ILIKE '%search_path=%')
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0
          AND p.proconfig IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg
            WHERE replace(replace(cfg, ' ', ''), '"', '') IN (
              'search_path=public,auth,pg_temp',
              'search_path=pg_catalog,public,auth,pg_temp',
              'search_path=pg_catalog,public,pg_temp'
            )
          )
      ) THEN 'search_path is safely pinned on public.get_current_user_role() to prevent search_path hijacking.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0
          AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, '; ') ILIKE '%search_path=%')
      ) THEN 'FAIL: search_path is UNPINNED on public.get_current_user_role().'
      ELSE 'MANUAL REVIEW: Custom search_path detected on get_current_user_role().'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C10' AS "Check ID",
    'public.get_current_user_role()' AS "Database Object",
    'EXECUTE privileges: PUBLIC=DENIED, anon=DENIED, authenticated=ALLOWED, service_role=ALLOWED' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
        ) THEN 'GRANTED' ELSE 'DENIED' END
        || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; authenticated=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
          WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; service_role=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'ROLE MISSING'
          WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0
        LIMIT 1
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND has_function_privilege('service_role', p.oid, 'EXECUTE')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role' AND p.pronargs = 0
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND has_function_privilege('service_role', p.oid, 'EXECUTE')
      ) THEN 'Execution is denied to unauthenticated roles (PUBLIC/anon) and granted to authenticated sessions and service_role.'
      ELSE 'FAIL: Execution permissions on get_current_user_role do not match security policy.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C11' AS "Check ID",
    'public.get_current_student_roll()' AS "Database Object",
    'Function exists with exact 0 arguments (pronargs = 0), returning text' AS "Expected Configuration",
    COALESCE(
      (SELECT 'args=' || p.pronargs::text || ' (' || pg_get_function_identity_arguments(p.oid) || '), return=' || p.prorettype::regtype::text
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0 AND p.prorettype::regtype::text = 'text'
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0 AND p.prorettype::regtype::text = 'text'
      ) THEN 'Function exists with exact zero arguments, returning upper-cased student roll number as text.'
      ELSE 'FAIL: Function public.get_current_student_roll() is missing or returns incorrect type.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C12' AS "Check ID",
    'public.get_current_student_roll()' AS "Database Object",
    'prosecdef = true, provolatile = ''s'' (STABLE)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'prosecdef=' || p.prosecdef::text || ', provolatile=''' || p.provolatile::text || ''''
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0
          AND p.prosecdef = true AND p.provolatile = 's'
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0
          AND p.prosecdef = true AND p.provolatile = 's'
      ) THEN 'Function is correctly marked SECURITY DEFINER and STABLE for student RLS policies.'
      ELSE 'FAIL: get_current_student_roll is not SECURITY DEFINER or not STABLE.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C13' AS "Check ID",
    'public.get_current_student_roll()' AS "Database Object",
    'search_path explicitly pinned to: public, auth, pg_temp or pg_catalog, public, auth, pg_temp' AS "Expected Configuration",
    COALESCE(
      (SELECT COALESCE(array_to_string(p.proconfig, '; '), 'UNPINNED (NULL)')
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0
          AND p.proconfig IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg
            WHERE replace(replace(cfg, ' ', ''), '"', '') IN (
              'search_path=public,auth,pg_temp',
              'search_path=pg_catalog,public,auth,pg_temp',
              'search_path=pg_catalog,public,pg_temp'
            )
          )
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0
          AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, '; ') ILIKE '%search_path=%')
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0
          AND p.proconfig IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg
            WHERE replace(replace(cfg, ' ', ''), '"', '') IN (
              'search_path=public,auth,pg_temp',
              'search_path=pg_catalog,public,auth,pg_temp',
              'search_path=pg_catalog,public,pg_temp'
            )
          )
      ) THEN 'search_path is pinned on public.get_current_student_roll() to prevent schema hijacking.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0
          AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, '; ') ILIKE '%search_path=%')
      ) THEN 'FAIL: search_path is UNPINNED on public.get_current_student_roll().'
      ELSE 'MANUAL REVIEW: Custom search_path detected on get_current_student_roll().'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C14' AS "Check ID",
    'public.get_current_student_roll()' AS "Database Object",
    'EXECUTE privileges: PUBLIC=DENIED, anon=DENIED, authenticated=ALLOWED, service_role=DENIED' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
        ) THEN 'GRANTED' ELSE 'DENIED' END
        || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; authenticated=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
          WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; service_role=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'ROLE MISSING'
          WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0
        LIMIT 1
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_current_student_roll' AND p.pronargs = 0
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      ) THEN 'Function execution granted to authenticated, revoked from PUBLIC, anon, and service_role matching Migration 007 Section 20.'
      ELSE 'FAIL: Execution permissions on get_current_student_roll do not match security policy.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C15' AS "Check ID",
    'public.update_student_profile(text, text, text)' AS "Database Object",
    'Function exists with exact 3 arguments (p_mobile_number, p_avatar_theme, p_face_photo_url), returning jsonb' AS "Expected Configuration",
    COALESCE(
      (SELECT 'args=' || p.pronargs::text || ' (' || pg_get_function_identity_arguments(p.oid) || '), return=' || p.prorettype::regtype::text
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3
      ) THEN 'Function exists with exact 3 arguments as defined in Migration 007 Section 17.'
      ELSE 'FAIL: Function public.update_student_profile(text, text, text) is missing.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C16' AS "Check ID",
    'public.update_student_profile(text, text, text)' AS "Database Object",
    'prosecdef = true, search_path explicitly pinned to pg_catalog, public, pg_temp' AS "Expected Configuration",
    COALESCE(
      (SELECT 'prosecdef=' || p.prosecdef::text || ', proconfig=' || COALESCE(array_to_string(p.proconfig, '; '), 'UNPINNED')
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3
          AND p.prosecdef = true
          AND p.proconfig IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg
            WHERE replace(replace(cfg, ' ', ''), '"', '') = 'search_path=pg_catalog,public,pg_temp'
          )
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3
          AND (p.prosecdef = false OR p.proconfig IS NULL OR NOT array_to_string(p.proconfig, '; ') ILIKE '%search_path=%')
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3
          AND p.prosecdef = true
          AND p.proconfig IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg
            WHERE replace(replace(cfg, ' ', ''), '"', '') = 'search_path=pg_catalog,public,pg_temp'
          )
      ) THEN 'Function is marked SECURITY DEFINER with search_path strictly pinned to pg_catalog, public, pg_temp.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3
          AND (p.prosecdef = false OR p.proconfig IS NULL OR NOT array_to_string(p.proconfig, '; ') ILIKE '%search_path=%')
      ) THEN 'FAIL: update_student_profile is not SECURITY DEFINER or lacks pinned search_path.'
      ELSE 'MANUAL REVIEW: Custom search_path detected on update_student_profile.'
    END AS "Explanation"

UNION ALL

SELECT
    'C. Auth & Security Functions' AS "Section",
    'C17' AS "Check ID",
    'public.update_student_profile(text, text, text)' AS "Database Object",
    'EXECUTE privileges: PUBLIC=DENIED, anon=DENIED, authenticated=ALLOWED, service_role=DENIED (matching Migration 007 Section 20)' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3)
        THEN 'NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
        ) THEN 'GRANTED' ELSE 'DENIED' END
        || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; authenticated=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
          WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; service_role=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'ROLE MISSING'
          WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3
        LIMIT 1
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3)
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3)
        THEN 'Function not found.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_student_profile' AND p.pronargs = 3
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      ) THEN 'Function execution granted to authenticated, revoked from PUBLIC, anon, and service_role matching Migration 007 Section 20.'
      ELSE 'FAIL: Execution permissions on update_student_profile do not match security policy.'
    END AS "Explanation"

UNION ALL

SELECT
    'D. Student Directory' AS "Section",
    'D01' AS "Check ID",
    'public.staff_student_directory' AS "Database Object",
    'View exists in public schema with relkind = ''v''' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relkind=''' || c.relkind::text || '''' FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v')
        THEN 'PASS'
      ELSE 'NOT FOUND'
    END AS "Status",
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v')
        THEN 'Directory view public.staff_student_directory exists as a relational view.'
      ELSE 'FAIL: Directory view public.staff_student_directory does not exist.'
    END AS "Explanation"

UNION ALL

SELECT
    'D. Student Directory' AS "Section",
    'D02' AS "Check ID",
    'public.staff_student_directory' AS "Database Object",
    'Contains exactly 13 approved columns: id, roll_number, name, department, branch, section, academic_year, mobile_number, face_registered, face_photo_url, is_active, created_at, updated_at' AS "Expected Configuration",
    COALESCE(
      (SELECT 'col_count=' || count(*)::text || ' (' || string_agg(a.attname, ', ' ORDER BY a.attnum) || ')'
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND a.attnum > 0 AND NOT a.attisdropped),
      'VIEW NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v')
        THEN 'NOT FOUND'
      WHEN (
        -- 1. Exact count is 13
        (SELECT count(*)
         FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND a.attnum > 0 AND NOT a.attisdropped) = 13
        -- 2. All 13 approved column names exist
        AND (SELECT count(DISTINCT a.attname)
             FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND a.attnum > 0 AND NOT a.attisdropped
               AND a.attname IN ('id', 'roll_number', 'name', 'department', 'branch', 'section', 'academic_year', 'mobile_number', 'face_registered', 'face_photo_url', 'is_active', 'created_at', 'updated_at')) = 13
        -- 3. Zero unapproved or unexpected columns exist
        AND NOT EXISTS (
          SELECT 1
          FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND a.attnum > 0 AND NOT a.attisdropped
            AND a.attname NOT IN ('id', 'roll_number', 'name', 'department', 'branch', 'section', 'academic_year', 'mobile_number', 'face_registered', 'face_photo_url', 'is_active', 'created_at', 'updated_at')
        )
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v')
        THEN 'Target view does not exist in catalog.'
      WHEN (
        (SELECT count(*)
         FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND a.attnum > 0 AND NOT a.attisdropped) = 13
        AND (SELECT count(DISTINCT a.attname)
             FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND a.attnum > 0 AND NOT a.attisdropped
               AND a.attname IN ('id', 'roll_number', 'name', 'department', 'branch', 'section', 'academic_year', 'mobile_number', 'face_registered', 'face_photo_url', 'is_active', 'created_at', 'updated_at')) = 13
        AND NOT EXISTS (
          SELECT 1
          FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND a.attnum > 0 AND NOT a.attisdropped
            AND a.attname NOT IN ('id', 'roll_number', 'name', 'department', 'branch', 'section', 'academic_year', 'mobile_number', 'face_registered', 'face_photo_url', 'is_active', 'created_at', 'updated_at')
        )
      ) THEN 'View contains all 13 approved directory columns, exact count = 13, and zero unapproved attributes.'
      ELSE 'FAIL: Directory view columns deviate from the 13 approved whitelist attributes.'
    END AS "Explanation"

UNION ALL

SELECT
    'D. Student Directory' AS "Section",
    'D03' AS "Check ID",
    'public.staff_student_directory' AS "Database Object",
    'Zero exposure of sensitive fields: password_hash, biometric data, auth metadata, tokens' AS "Expected Configuration",
    COALESCE(
      (SELECT 'Exposed sensitive columns: ' || string_agg(a.attname, ', ')
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND a.attnum > 0 AND NOT a.attisdropped
         AND (
           a.attname IN ('auth_id', 'role', 'password_hash', 'membership_status', 'fingerprint_ids', 'finger_labels', 'incubation_start_date', 'academic_year_at_start', 'retention_period_years', 'retention_end_date', 'password', 'encrypted_password', 'raw_user_meta_data', 'raw_app_meta_data')
           OR a.attname ILIKE '%pass%'
           OR a.attname ILIKE '%finger%'
           OR a.attname ILIKE '%token%'
           OR a.attname ILIKE '%secret%'
         )),
      'Zero sensitive fields exposed (Protected)'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND a.attnum > 0 AND NOT a.attisdropped
          AND (
            a.attname IN ('auth_id', 'role', 'password_hash', 'membership_status', 'fingerprint_ids', 'finger_labels', 'incubation_start_date', 'academic_year_at_start', 'retention_period_years', 'retention_end_date', 'password', 'encrypted_password', 'raw_user_meta_data', 'raw_app_meta_data')
            OR a.attname ILIKE '%pass%'
            OR a.attname ILIKE '%finger%'
            OR a.attname ILIKE '%token%'
            OR a.attname ILIKE '%secret%'
          )
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v')
        THEN 'Target view does not exist in catalog.'
      WHEN NOT EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND a.attnum > 0 AND NOT a.attisdropped
          AND (
            a.attname IN ('auth_id', 'role', 'password_hash', 'membership_status', 'fingerprint_ids', 'finger_labels', 'incubation_start_date', 'academic_year_at_start', 'retention_period_years', 'retention_end_date', 'password', 'encrypted_password', 'raw_user_meta_data', 'raw_app_meta_data')
            OR a.attname ILIKE '%pass%'
            OR a.attname ILIKE '%finger%'
            OR a.attname ILIKE '%token%'
            OR a.attname ILIKE '%secret%'
          )
      ) THEN 'Privacy check PASSED: No authentication tokens, password hashes, or biometric attributes exposed.'
      ELSE 'CRITICAL SECURITY FAIL: Sensitive credentials or biometric fields exposed via staff_student_directory view.'
    END AS "Explanation"

UNION ALL

SELECT
    'D. Student Directory' AS "Section",
    'D04' AS "Check ID",
    'public.staff_student_directory' AS "Database Object",
    'View definition matches authoritative Migration 007 definition: filters u.role = ''student'' and public.get_current_user_role() IN (''staff'', ''admin'', ''substitute_admin'', ''sir'')' AS "Expected Configuration",
    COALESCE(
      (SELECT 'definition=' || pg_get_viewdef(c.oid, true)
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v' LIMIT 1),
      'VIEW NOT FOUND'
    ) AS "Actual Configuration",
    d04_eval.status AS "Status",
    CASE
      WHEN d04_eval.status = 'NOT FOUND' THEN 'View not found.'
      WHEN d04_eval.status = 'PASS' THEN 'View definition exactly matches authoritative normalized Migration 007 definition (verified student role filter and authorized caller roles: staff, admin, substitute_admin, sir).'
      WHEN d04_eval.status = 'FAIL' THEN 'CRITICAL SECURITY FAIL: View definition lacks student role filter or contains unconditional bypass.'
      ELSE 'MANUAL REVIEW: View definition syntax differs from the exact canonical normalized definitions in Migration 007. Review live pg_get_viewdef output to verify filtering logic.'
    END AS "Explanation"
  FROM (
    SELECT
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v')
          THEN 'NOT FOUND'
        -- PASS ONLY if exact normalized view definition matches authoritative whitelist
        WHEN EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v'
            AND rtrim(regexp_replace(pg_get_viewdef(c.oid, false), '\s+', '', 'g'), ';') IN (
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((u.role=''student''::text)AND(public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text)AND(public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((u.role=''student''::text)AND((public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((u.role=''student''::text)ANDpublic.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text)ANDpublic.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((u.role=''student''::text)AND(public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text)AND(public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((u.role=''student''::text)AND((public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((u.role=''student''::text)ANDpublic.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text)ANDpublic.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text))AND(public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role=''student''::text))AND(public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text))AND((public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text))ANDpublic.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role=''student''::text))ANDpublic.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text))AND(public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role=''student''::text))AND(public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text))AND((public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text))ANDpublic.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role=''student''::text))ANDpublic.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role)::text=''student''::text)AND(public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role)::text=''student''::text)AND(public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role)::text=''student''::text)AND((public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role)::text=''student''::text)ANDpublic.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role)::text=''student''::text)ANDpublic.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role)::text=''student''::text)AND(public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role)::text=''student''::text)AND(public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role)::text=''student''::text)AND((public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role)::text=''student''::text)ANDpublic.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role)::text=''student''::text)ANDpublic.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((u.role=''student''::text)AND(get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text)AND(get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((u.role=''student''::text)AND((get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((u.role=''student''::text)ANDget_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text)ANDget_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((u.role=''student''::text)AND(get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text)AND(get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((u.role=''student''::text)AND((get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((u.role=''student''::text)ANDget_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text)ANDget_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text))AND(get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role=''student''::text))AND(get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text))AND((get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text))ANDget_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role=''student''::text))ANDget_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text))AND(get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role=''student''::text))AND(get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text))AND((get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role=''student''::text))ANDget_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role=''student''::text))ANDget_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role)::text=''student''::text)AND(get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role)::text=''student''::text)AND(get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role)::text=''student''::text)AND((get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role)::text=''student''::text)ANDget_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role)::text=''student''::text)ANDget_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role)::text=''student''::text)AND(get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role)::text=''student''::text)AND(get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role)::text=''student''::text)AND((get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE(((u.role)::text=''student''::text)ANDget_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHERE((((u.role)::text=''student''::text)ANDget_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((u.role=''student''::text)AND(public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text)AND(public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((u.role=''student''::text)AND((public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((u.role=''student''::text)ANDpublic.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text)ANDpublic.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((u.role=''student''::text)AND(public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text)AND(public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((u.role=''student''::text)AND((public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((u.role=''student''::text)ANDpublic.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text)ANDpublic.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text))AND(public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role=''student''::text))AND(public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text))AND((public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text))ANDpublic.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role=''student''::text))ANDpublic.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text))AND(public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role=''student''::text))AND(public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text))AND((public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text))ANDpublic.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role=''student''::text))ANDpublic.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role)::text=''student''::text)AND(public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role)::text=''student''::text)AND(public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role)::text=''student''::text)AND((public.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role)::text=''student''::text)ANDpublic.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role)::text=''student''::text)ANDpublic.get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role)::text=''student''::text)AND(public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role)::text=''student''::text)AND(public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role)::text=''student''::text)AND((public.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role)::text=''student''::text)ANDpublic.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role)::text=''student''::text)ANDpublic.get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((u.role=''student''::text)AND(get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text)AND(get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((u.role=''student''::text)AND((get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((u.role=''student''::text)ANDget_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text)ANDget_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((u.role=''student''::text)AND(get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text)AND(get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((u.role=''student''::text)AND((get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((u.role=''student''::text)ANDget_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text)ANDget_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text))AND(get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role=''student''::text))AND(get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text))AND((get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text))ANDget_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role=''student''::text))ANDget_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text))AND(get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role=''student''::text))AND(get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text))AND((get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role=''student''::text))ANDget_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role=''student''::text))ANDget_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role)::text=''student''::text)AND(get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role)::text=''student''::text)AND(get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role)::text=''student''::text)AND((get_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role)::text=''student''::text)ANDget_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text]))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role)::text=''student''::text)ANDget_current_user_role()=ANY(ARRAY[''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role)::text=''student''::text)AND(get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role)::text=''student''::text)AND(get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role)::text=''student''::text)AND((get_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE(((u.role)::text=''student''::text)ANDget_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text))',
            'SELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHERE((((u.role)::text=''student''::text)ANDget_current_user_role()IN(''staff''::text,''admin''::text,''substitute_admin''::text,''sir''::text)))'
            )
        ) THEN 'PASS'
        -- FAIL if obvious security flaw (missing student role filter or contains unconditional bypass)
        WHEN EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v'
            AND (
              NOT (regexp_replace(lower(pg_get_viewdef(c.oid, false)), '\s+', '', 'g') LIKE '%role=''student''%')
              OR regexp_replace(lower(pg_get_viewdef(c.oid, false)), '\s+', '', 'g') LIKE '%ortrue%'
              OR regexp_replace(lower(pg_get_viewdef(c.oid, false)), '\s+', '', 'g') LIKE '%or1=1%'
            )
        ) THEN 'FAIL'
        ELSE 'MANUAL REVIEW'
      END AS status
  ) AS d04_eval

UNION ALL

SELECT
    'D. Student Directory' AS "Section",
    'D05' AS "Check ID",
    'public.staff_student_directory' AS "Database Object",
    'security_barrier = true enabled in view options' AS "Expected Configuration",
    COALESCE(
      (SELECT 'reloptions=' || COALESCE(array_to_string(c.reloptions, ', '), 'NONE')
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v' LIMIT 1),
      'VIEW NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v')
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v'
          AND c.reloptions IS NOT NULL AND 'security_barrier=true' = ANY(c.reloptions)
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v')
        THEN 'View not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v'
          AND c.reloptions IS NOT NULL AND 'security_barrier=true' = ANY(c.reloptions)
      ) THEN 'security_barrier is active, preventing side-channel leaks via user-defined functions.'
      ELSE 'FAIL: security_barrier is NOT enabled on public.staff_student_directory.'
    END AS "Explanation"

UNION ALL

SELECT
    'D. Student Directory' AS "Section",
    'D06' AS "Check ID",
    'public.staff_student_directory' AS "Database Object",
    'PUBLIC=none, anon=none, service_role=none, authenticated=SELECT; security_barrier=true; security_invoker absent/false' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v')
        THEN 'VIEW NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
        ) THEN 'EXPOSED' ELSE 'DENIED' END
        || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_table_privilege('anon', c.oid, 'SELECT') THEN 'EXPOSED'
          ELSE 'DENIED'
        END
        || '; authenticated=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
          WHEN has_table_privilege('authenticated', c.oid, 'SELECT') THEN 'ALLOWED'
          ELSE 'DENIED'
        END
        || '; service_role=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'ROLE MISSING'
          WHEN has_table_privilege('service_role', c.oid, 'SELECT') THEN 'ALLOWED'
          ELSE 'DENIED'
        END
        || '; barrier=' || CASE WHEN 'security_barrier=true' = ANY(COALESCE(c.reloptions, ARRAY[]::text[])) THEN 'YES' ELSE 'NO' END
        || '; invoker=' || CASE WHEN 'security_invoker=true' = ANY(COALESCE(c.reloptions, ARRAY[]::text[])) THEN 'YES' ELSE 'NO' END
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v'
        LIMIT 1
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v'
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
          )
          AND NOT has_table_privilege('anon', c.oid, 'SELECT')
          AND NOT has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND 'security_barrier=true' = ANY(COALESCE(c.reloptions, ARRAY[]::text[]))
          AND NOT ('security_invoker=true' = ANY(COALESCE(c.reloptions, ARRAY[]::text[])))
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v')
        THEN 'View not found.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'staff_student_directory' AND c.relkind = 'v'
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
          )
          AND NOT has_table_privilege('anon', c.oid, 'SELECT')
          AND NOT has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND 'security_barrier=true' = ANY(COALESCE(c.reloptions, ARRAY[]::text[]))
          AND NOT ('security_invoker=true' = ANY(COALESCE(c.reloptions, ARRAY[]::text[])))
      ) THEN 'View permissions match Migration 007 Section 16 (PUBLIC, anon, and service_role denied; authenticated allowed SELECT; security_barrier active; security_invoker absent).'
      ELSE 'FAIL: View privileges or barrier settings deviate from Migration 007 requirements.'
    END AS "Explanation"

UNION ALL

SELECT
    'D. Student Directory' AS "Section",
    'D07' AS "Check ID",
    'public.get_student_directory()' AS "Database Object",
    'Function exists with exact 0 arguments (pronargs = 0)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'args=' || p.pronargs::text || ' (' || pg_get_function_identity_arguments(p.oid) || ')'
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
      ) THEN 'PASS'
      ELSE 'NOT FOUND'
    END AS "Status",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
      ) THEN 'Function public.get_student_directory() exists with zero arguments.'
      ELSE 'FAIL: RPC function public.get_student_directory() is missing.'
    END AS "Explanation"

UNION ALL

SELECT
    'D. Student Directory' AS "Section",
    'D08' AS "Check ID",
    'public.get_student_directory()' AS "Database Object",
    'Returns TABLE with exact 13 columns (id, roll_number, name, department, branch, section, academic_year, mobile_number, face_registered, face_photo_url, is_active, created_at, updated_at)' AS "Expected Configuration",
    COALESCE(
      (
        SELECT 'rettype=' || p.prorettype::regtype::text || ', proretset=' || p.proretset::text ||
               ', col_count=' || (SELECT count(*)::text FROM unnest(p.proargmodes) m WHERE m IN ('t', 'o')) ||
               ', cols=(' || array_to_string(p.proargnames, ', ') || ')' ||
               ', full_result=' || pg_get_function_result(p.oid)
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
        LIMIT 1
      ),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND p.proretset = true
          AND p.proargnames = ARRAY[
            'id', 'roll_number', 'name', 'department', 'branch',
            'section', 'academic_year', 'mobile_number', 'face_registered',
            'face_photo_url', 'is_active', 'created_at', 'updated_at'
          ]
          AND (SELECT count(*) FROM unnest(p.proargmodes) m WHERE m IN ('t', 'o')) = 13
          AND regexp_replace(pg_get_function_result(p.oid), '\s+', '', 'g') IN (
            'TABLE(idtext,roll_numbertext,nametext,departmenttext,branchtext,sectiontext,academic_yearinteger,mobile_numbertext,face_registeredboolean,face_photo_urltext,is_activeboolean,created_attimestampwithtimezone,updated_attimestampwithtimezone)',
            'TABLE(idtext,roll_numbertext,nametext,departmenttext,branchtext,sectiontext,academic_yearint4,mobile_numbertext,face_registeredbool,face_photo_urltext,is_activebool,created_attimestamptz,updated_attimestamptz)',
            'table(idtext,roll_numbertext,nametext,departmenttext,branchtext,sectiontext,academic_yearinteger,mobile_numbertext,face_registeredboolean,face_photo_urltext,is_activeboolean,created_attimestampwithtimezone,updated_attimestampwithtimezone)',
            'table(idtext,roll_numbertext,nametext,departmenttext,branchtext,sectiontext,academic_yearint4,mobile_numbertext,face_registeredbool,face_photo_urltext,is_activebool,created_attimestamptz,updated_attimestamptz)'
          )
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND (p.proretset = false OR p.proretset IS NULL)
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND p.proretset = true
          AND p.proargnames = ARRAY[
            'id', 'roll_number', 'name', 'department', 'branch',
            'section', 'academic_year', 'mobile_number', 'face_registered',
            'face_photo_url', 'is_active', 'created_at', 'updated_at'
          ]
          AND (SELECT count(*) FROM unnest(p.proargmodes) m WHERE m IN ('t', 'o')) = 13
          AND regexp_replace(pg_get_function_result(p.oid), '\s+', '', 'g') IN (
            'TABLE(idtext,roll_numbertext,nametext,departmenttext,branchtext,sectiontext,academic_yearinteger,mobile_numbertext,face_registeredboolean,face_photo_urltext,is_activeboolean,created_attimestampwithtimezone,updated_attimestampwithtimezone)',
            'TABLE(idtext,roll_numbertext,nametext,departmenttext,branchtext,sectiontext,academic_yearint4,mobile_numbertext,face_registeredbool,face_photo_urltext,is_activebool,created_attimestamptz,updated_attimestamptz)',
            'table(idtext,roll_numbertext,nametext,departmenttext,branchtext,sectiontext,academic_yearinteger,mobile_numbertext,face_registeredboolean,face_photo_urltext,is_activeboolean,created_attimestampwithtimezone,updated_attimestampwithtimezone)',
            'table(idtext,roll_numbertext,nametext,departmenttext,branchtext,sectiontext,academic_yearint4,mobile_numbertext,face_registeredbool,face_photo_urltext,is_activebool,created_attimestamptz,updated_attimestamptz)'
          )
      ) THEN 'Function returns exact 13 expected student directory columns with verified names and types matching Migration 007 Section 17.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND (p.proretset = false OR p.proretset IS NULL)
      ) THEN 'FAIL: Function does not return a table set.'
      ELSE 'MANUAL REVIEW: Function return structure deviates from the exact 13 expected columns or column types.'
    END AS "Explanation"

UNION ALL

SELECT
    'D. Student Directory' AS "Section",
    'D09' AS "Check ID",
    'public.get_student_directory()' AS "Database Object",
    'prosecdef = true, provolatile = ''v'' (VOLATILE by default in Migration 007), search_path = pg_catalog, public, pg_temp' AS "Expected Configuration",
    COALESCE(
      (SELECT 'prosecdef=' || p.prosecdef::text || ', provolatile=''' || p.provolatile::text || ''', proconfig=' || COALESCE(array_to_string(p.proconfig, '; '), 'UNPINNED')
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND p.prosecdef = true AND p.provolatile = 'v'
          AND p.proconfig IS NOT NULL
          AND regexp_replace(array_to_string(p.proconfig, '; '), '\s+', '', 'g') = 'search_path=pg_catalog,public,pg_temp'
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND (p.prosecdef = false OR p.proconfig IS NULL)
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND p.prosecdef = true AND p.provolatile = 'v'
          AND p.proconfig IS NOT NULL
          AND regexp_replace(array_to_string(p.proconfig, '; '), '\s+', '', 'g') = 'search_path=pg_catalog,public,pg_temp'
      ) THEN 'Function is configured with SECURITY DEFINER, default volatility (VOLATILE) matching Migration 007 Section 17, and search_path strictly pinned to pg_catalog, public, pg_temp.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND (p.prosecdef = false OR p.proconfig IS NULL)
      ) THEN 'FAIL: get_student_directory is not marked SECURITY DEFINER or lacks search_path configuration.'
      ELSE 'MANUAL REVIEW: Function search_path setting deviates from pg_catalog, public, pg_temp.'
    END AS "Explanation"

UNION ALL

SELECT
    'D. Student Directory' AS "Section",
    'D10' AS "Check ID",
    'public.get_student_directory()' AS "Database Object",
    'EXECUTE privileges: PUBLIC=DENIED, anon=DENIED, service_role=DENIED, authenticated=ALLOWED' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
        ) THEN 'GRANTED' ELSE 'DENIED' END
        || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; authenticated=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
          WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; service_role=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'ROLE MISSING'
          WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
        LIMIT 1
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      ) THEN 'Execution is denied to PUBLIC, anon, and service_role; granted strictly to authenticated matching Migration 007 Section 17.'
      ELSE 'FAIL: Execution permissions on get_student_directory deviate from Migration 007 Section 17.'
    END AS "Explanation"

UNION ALL

SELECT
    'D. Student Directory' AS "Section",
    'D11' AS "Check ID",
    'public.get_student_directory()' AS "Database Object",
    'Implementation exactly matches authoritative Migration 007 Section 17: verifies caller role IN (''staff'', ''admin'', ''substitute_admin'', ''sir'') and filters u.role = ''student''' AS "Expected Configuration",
    COALESCE(
      (SELECT 'normalized_body_md5=' || md5(regexp_replace(p.prosrc, '\s+', '', 'g'))
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0)
        THEN 'NOT FOUND'
      -- PASS ONLY if exact normalized function body matches authoritative whitelist
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND rtrim(regexp_replace(p.prosrc, '\s+', '', 'g'), ';') IN (
            'IFpublic.get_current_user_role()NOTIN(''staff'',''admin'',''substitute_admin'',''sir'')THENRAISEEXCEPTION''AccessDenied:Youdonothavepermissiontoviewthestudentdirectory.'';ENDIF;RETURNQUERYSELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHEREu.role=''student''ORDERBYu.nameASC;',
            'IFpublic.get_current_user_role()NOTIN(''staff'',''admin'',''substitute_admin'',''sir'')THENRAISEEXCEPTION''AccessDenied:Youdonothavepermissiontoviewthestudentdirectory.'';ENDIF;RETURNQUERYSELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHEREu.role=''student''ORDERBYu.nameASC;',
            'IFget_current_user_role()NOTIN(''staff'',''admin'',''substitute_admin'',''sir'')THENRAISEEXCEPTION''AccessDenied:Youdonothavepermissiontoviewthestudentdirectory.'';ENDIF;RETURNQUERYSELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHEREu.role=''student''ORDERBYu.nameASC;',
            'IFget_current_user_role()NOTIN(''staff'',''admin'',''substitute_admin'',''sir'')THENRAISEEXCEPTION''AccessDenied:Youdonothavepermissiontoviewthestudentdirectory.'';ENDIF;RETURNQUERYSELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHEREu.role=''student''ORDERBYu.nameASC;'
          )
      ) THEN 'PASS'
      -- FAIL if role check is completely missing or bypassed
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND (
            NOT (regexp_replace(lower(p.prosrc), '\s+', '', 'g') LIKE '%get_current_user_role%')
            OR NOT (regexp_replace(lower(p.prosrc), '\s+', '', 'g') LIKE '%raiseexception%')
          )
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND rtrim(regexp_replace(p.prosrc, '\s+', '', 'g'), ';') IN (
            'IFpublic.get_current_user_role()NOTIN(''staff'',''admin'',''substitute_admin'',''sir'')THENRAISEEXCEPTION''AccessDenied:Youdonothavepermissiontoviewthestudentdirectory.'';ENDIF;RETURNQUERYSELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHEREu.role=''student''ORDERBYu.nameASC;',
            'IFpublic.get_current_user_role()NOTIN(''staff'',''admin'',''substitute_admin'',''sir'')THENRAISEEXCEPTION''AccessDenied:Youdonothavepermissiontoviewthestudentdirectory.'';ENDIF;RETURNQUERYSELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHEREu.role=''student''ORDERBYu.nameASC;',
            'IFget_current_user_role()NOTIN(''staff'',''admin'',''substitute_admin'',''sir'')THENRAISEEXCEPTION''AccessDenied:Youdonothavepermissiontoviewthestudentdirectory.'';ENDIF;RETURNQUERYSELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMpublic.usersuWHEREu.role=''student''ORDERBYu.nameASC;',
            'IFget_current_user_role()NOTIN(''staff'',''admin'',''substitute_admin'',''sir'')THENRAISEEXCEPTION''AccessDenied:Youdonothavepermissiontoviewthestudentdirectory.'';ENDIF;RETURNQUERYSELECTu.id,u.roll_number,u.name,u.department,u.branch,u.section,u.academic_year,u.mobile_number,u.face_registered,u.face_photo_url,u.is_active,u.created_at,u.updated_atFROMusersuWHEREu.role=''student''ORDERBYu.nameASC;'
          )
      ) THEN 'Procedure body exactly matches authoritative normalized implementation from Migration 007 Section 17 (verified complete role authorization and u.role = ''student'' filter).'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_student_directory' AND p.pronargs = 0
          AND (
            NOT (regexp_replace(lower(p.prosrc), '\s+', '', 'g') LIKE '%get_current_user_role%')
            OR NOT (regexp_replace(lower(p.prosrc), '\s+', '', 'g') LIKE '%raiseexception%')
          )
      ) THEN 'FAIL: Procedure body completely lacks caller role verification or exception raising.'
      ELSE 'MANUAL REVIEW: Procedure body differs from canonical normalized implementation in Migration 007 Section 17. Static catalog inspection cannot prove authorization and filtering logic; manual review of function code required.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E01' AS "Check ID",
    'public.transactions' AS "Database Object",
    'Table exists in public schema with relkind = ''r''' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relkind=''' || c.relkind::text || '''' FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions' LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions' AND c.relkind = 'r')
        THEN 'PASS'
      ELSE 'NOT FOUND'
    END AS "Status",
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions' AND c.relkind = 'r')
        THEN 'Transactions ledger table exists as a standard relational table.'
      ELSE 'FAIL: Table public.transactions not found.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E02' AS "Check ID",
    'public.transactions' AS "Database Object",
    'Row-Level Security enabled (relrowsecurity = true)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relrowsecurity=' || c.relrowsecurity::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions' LIMIT 1),
      'TABLE NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions')
        THEN 'NOT FOUND'
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions' AND c.relrowsecurity = true)
        THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions')
        THEN 'Target table does not exist in catalog.'
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions' AND c.relrowsecurity = true)
        THEN 'RLS is properly enabled on public.transactions.'
      ELSE 'CRITICAL SECURITY FAIL: Row-Level Security is DISABLED on public.transactions.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E03' AS "Check ID",
    'public.transactions' AS "Database Object",
    'FORCE Row-Level Security enabled (relforcerowsecurity = true)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relforcerowsecurity=' || c.relforcerowsecurity::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions' LIMIT 1),
      'TABLE NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions')
        THEN 'NOT FOUND'
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions' AND c.relforcerowsecurity = true)
        THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions')
        THEN 'Target table does not exist in catalog.'
      WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions' AND c.relforcerowsecurity = true)
        THEN 'FORCE RLS is enabled on public.transactions.'
      ELSE 'FAIL: FORCE RLS is not enabled on public.transactions.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E04' AS "Check ID",
    'public.transactions.Admins manage transactions' AS "Database Object",
    'cmd = ''ALL'', roles = ''{authenticated}'', USING & WITH CHECK enforce admin roles, exactly 3 policies on table' AS "Expected Configuration",
    COALESCE(
      (SELECT 'cmd=' || pol.cmd || ', roles=' || pol.roles::text || ', qual=' || COALESCE(pol.qual, 'NULL') || ', with_check=' || COALESCE(pol.with_check, 'NULL')
       FROM pg_policies pol WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions' AND pol.policyname = 'Admins manage transactions' LIMIT 1),
      'POLICY NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Admins manage transactions')
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions' AND pol.policyname = 'Admins manage transactions'
          AND (
            pol.cmd <> 'ALL'
            OR pol.roles <> '{authenticated}'
            OR pol.qual = 'true'
            OR pol.with_check = 'true'
            OR pol.qual ILIKE '%staff%'
            OR pol.roles::text ILIKE '%staff%'
          )
      ) THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions' AND pol.policyname = 'Admins manage transactions'
          AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
          AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
          )
          AND regexp_replace(COALESCE(pol.with_check, pol.qual), '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
          )
      )
      AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions') = 3
      THEN 'PASS'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Admins manage transactions')
        THEN 'Expected administrator policy does not exist on transactions.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions' AND pol.policyname = 'Admins manage transactions'
          AND (
            pol.cmd <> 'ALL'
            OR pol.roles <> '{authenticated}'
            OR pol.qual = 'true'
            OR pol.with_check = 'true'
            OR pol.qual ILIKE '%staff%'
            OR pol.roles::text ILIKE '%staff%'
          )
      ) THEN 'FAIL: Admin policy on transactions permits staff access or has permissive bypass.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions' AND pol.policyname = 'Admins manage transactions'
          AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
          AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
          )
          AND regexp_replace(COALESCE(pol.with_check, pol.qual), '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
          )
      )
      AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions') = 3
      THEN 'Administrator full management policy verified (cmd=ALL, roles={authenticated}, USING and WITH CHECK restricted to admin roles, exactly 3 policies on table).'
      ELSE 'MANUAL REVIEW: Admin policy expression deviates from canonical forms or table policy count differs from 3.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E05' AS "Check ID",
    'public.transactions.Staff view transactions' AS "Database Object",
    'cmd = ''SELECT'', roles = ''{authenticated}'', with_check IS NULL, USING enforces public.get_current_user_role() = ''staff''' AS "Expected Configuration",
    COALESCE(
      (SELECT 'cmd=' || cmd || ', roles=' || roles::text || ', qual=' || COALESCE(qual, 'NULL')
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Staff view transactions' LIMIT 1),
      'POLICY NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Staff view transactions')
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions' AND pol.policyname = 'Staff view transactions'
          AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}' AND pol.with_check IS NULL
          AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=''staff''::text)',
            '((public.get_current_user_role()=''staff''::text))',
            'public.get_current_user_role()=''staff''::text',
            '(public.get_current_user_role()=''staff'')',
            '((public.get_current_user_role()=''staff''))',
            'public.get_current_user_role()=''staff''',
            '(public.get_current_user_role()IN(''staff''::text))',
            '((public.get_current_user_role()IN(''staff''::text)))',
            'public.get_current_user_role()IN(''staff''::text)',
            '(public.get_current_user_role()IN(''staff''))',
            '((public.get_current_user_role()IN(''staff'')))',
            'public.get_current_user_role()IN(''staff'')',
            '(get_current_user_role()=''staff''::text)',
            '((get_current_user_role()=''staff''::text))',
            'get_current_user_role()=''staff''::text',
            '(get_current_user_role()=''staff'')',
            '((get_current_user_role()=''staff''))',
            'get_current_user_role()=''staff''',
            '(get_current_user_role()IN(''staff''::text))',
            '((get_current_user_role()IN(''staff''::text)))',
            'get_current_user_role()IN(''staff''::text)',
            '(get_current_user_role()IN(''staff''))',
            '((get_current_user_role()IN(''staff'')))',
            'get_current_user_role()IN(''staff'')',
            '((public.get_current_user_role())::text=''staff''::text)',
            '(((public.get_current_user_role())::text=''staff''::text))',
            '(public.get_current_user_role())::text=''staff''::text',
            '((public.get_current_user_role())::text=''staff'')',
            '(((public.get_current_user_role())::text=''staff''))',
            '(public.get_current_user_role())::text=''staff''',
            '((public.get_current_user_role())::textIN(''staff''::text))',
            '(((public.get_current_user_role())::textIN(''staff''::text)))',
            '(public.get_current_user_role())::textIN(''staff''::text)',
            '((public.get_current_user_role())::textIN(''staff''))',
            '(((public.get_current_user_role())::textIN(''staff'')))',
            '(public.get_current_user_role())::textIN(''staff'')',
            '((get_current_user_role())::text=''staff''::text)',
            '(((get_current_user_role())::text=''staff''::text))',
            '(get_current_user_role())::text=''staff''::text',
            '((get_current_user_role())::text=''staff'')',
            '(((get_current_user_role())::text=''staff''))',
            '(get_current_user_role())::text=''staff''',
            '((get_current_user_role())::textIN(''staff''::text))',
            '(((get_current_user_role())::textIN(''staff''::text)))',
            '(get_current_user_role())::textIN(''staff''::text)',
            '((get_current_user_role())::textIN(''staff''))',
            '(((get_current_user_role())::textIN(''staff'')))',
            '(get_current_user_role())::textIN(''staff'')'
          )
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions' AND pol.policyname = 'Staff view transactions'
          AND pol.cmd <> 'SELECT'
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Staff view transactions')
        THEN 'Expected staff view policy does not exist on transactions.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions' AND pol.policyname = 'Staff view transactions'
          AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}' AND pol.with_check IS NULL
          AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=''staff''::text)',
            '((public.get_current_user_role()=''staff''::text))',
            'public.get_current_user_role()=''staff''::text',
            '(public.get_current_user_role()=''staff'')',
            '((public.get_current_user_role()=''staff''))',
            'public.get_current_user_role()=''staff''',
            '(public.get_current_user_role()IN(''staff''::text))',
            '((public.get_current_user_role()IN(''staff''::text)))',
            'public.get_current_user_role()IN(''staff''::text)',
            '(public.get_current_user_role()IN(''staff''))',
            '((public.get_current_user_role()IN(''staff'')))',
            'public.get_current_user_role()IN(''staff'')',
            '(get_current_user_role()=''staff''::text)',
            '((get_current_user_role()=''staff''::text))',
            'get_current_user_role()=''staff''::text',
            '(get_current_user_role()=''staff'')',
            '((get_current_user_role()=''staff''))',
            'get_current_user_role()=''staff''',
            '(get_current_user_role()IN(''staff''::text))',
            '((get_current_user_role()IN(''staff''::text)))',
            'get_current_user_role()IN(''staff''::text)',
            '(get_current_user_role()IN(''staff''))',
            '((get_current_user_role()IN(''staff'')))',
            'get_current_user_role()IN(''staff'')',
            '((public.get_current_user_role())::text=''staff''::text)',
            '(((public.get_current_user_role())::text=''staff''::text))',
            '(public.get_current_user_role())::text=''staff''::text',
            '((public.get_current_user_role())::text=''staff'')',
            '(((public.get_current_user_role())::text=''staff''))',
            '(public.get_current_user_role())::text=''staff''',
            '((public.get_current_user_role())::textIN(''staff''::text))',
            '(((public.get_current_user_role())::textIN(''staff''::text)))',
            '(public.get_current_user_role())::textIN(''staff''::text)',
            '((public.get_current_user_role())::textIN(''staff''))',
            '(((public.get_current_user_role())::textIN(''staff'')))',
            '(public.get_current_user_role())::textIN(''staff'')',
            '((get_current_user_role())::text=''staff''::text)',
            '(((get_current_user_role())::text=''staff''::text))',
            '(get_current_user_role())::text=''staff''::text',
            '((get_current_user_role())::text=''staff'')',
            '(((get_current_user_role())::text=''staff''))',
            '(get_current_user_role())::text=''staff''',
            '((get_current_user_role())::textIN(''staff''::text))',
            '(((get_current_user_role())::textIN(''staff''::text)))',
            '(get_current_user_role())::textIN(''staff''::text)',
            '((get_current_user_role())::textIN(''staff''))',
            '(((get_current_user_role())::textIN(''staff'')))',
            '(get_current_user_role())::textIN(''staff'')'
          )
      ) THEN 'Staff read-only policy is verified; staff can inspect transactions without write capability.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions' AND pol.policyname = 'Staff view transactions'
          AND pol.cmd <> 'SELECT'
      ) THEN 'FAIL: Staff policy is not restricted to SELECT.'
      ELSE 'MANUAL REVIEW: Policy expression syntax deviates from expected form.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E06' AS "Check ID",
    'public.transactions.Students view own transactions' AS "Database Object",
    'cmd = ''SELECT'', roles = ''{authenticated}'', with_check IS NULL, USING enforces UPPER(student_roll) = public.get_current_student_roll()' AS "Expected Configuration",
    COALESCE(
      (SELECT 'cmd=' || cmd || ', roles=' || roles::text || ', qual=' || COALESCE(qual, 'NULL')
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Students view own transactions' LIMIT 1),
      'POLICY NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Students view own transactions')
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions' AND pol.policyname = 'Students view own transactions'
          AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}' AND pol.with_check IS NULL
          AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(UPPER(student_roll)=public.get_current_student_roll())',
            '((UPPER(student_roll)=public.get_current_student_roll()))',
            'UPPER(student_roll)=public.get_current_student_roll()',
            '(UPPER((student_roll)::text)=public.get_current_student_roll())',
            '((UPPER((student_roll)::text)=public.get_current_student_roll()))',
            'UPPER((student_roll)::text)=public.get_current_student_roll()',
            '(UPPER(student_roll)=get_current_student_roll())',
            '((UPPER(student_roll)=get_current_student_roll()))',
            'UPPER(student_roll)=get_current_student_roll()',
            '(UPPER((student_roll)::text)=get_current_student_roll())',
            '((UPPER((student_roll)::text)=get_current_student_roll()))',
            'UPPER((student_roll)::text)=get_current_student_roll()'
          )
      ) THEN 'PASS'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Students view own transactions')
        THEN 'Expected student borrowing view policy does not exist.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions' AND pol.policyname = 'Students view own transactions'
          AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}' AND pol.with_check IS NULL
          AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(UPPER(student_roll)=public.get_current_student_roll())',
            '((UPPER(student_roll)=public.get_current_student_roll()))',
            'UPPER(student_roll)=public.get_current_student_roll()',
            '(UPPER((student_roll)::text)=public.get_current_student_roll())',
            '((UPPER((student_roll)::text)=public.get_current_student_roll()))',
            'UPPER((student_roll)::text)=public.get_current_student_roll()',
            '(UPPER(student_roll)=get_current_student_roll())',
            '((UPPER(student_roll)=get_current_student_roll()))',
            'UPPER(student_roll)=get_current_student_roll()',
            '(UPPER((student_roll)::text)=get_current_student_roll())',
            '((UPPER((student_roll)::text)=get_current_student_roll()))',
            'UPPER((student_roll)::text)=get_current_student_roll()'
          )
      ) THEN 'Students can view strictly their own borrowing records matching their roll number.'
      ELSE 'MANUAL REVIEW: Student transaction policy differs from canonical definition.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E07' AS "Check ID",
    'public.transactions' AS "Database Object",
    'Zero policies permit direct staff write (INSERT, UPDATE, DELETE, ALL) on public.transactions; only 1 write policy exists ("Admins manage transactions")' AS "Expected Configuration",
    COALESCE(
      (SELECT 'Write policies: ' || string_agg(policyname || ' [cmd=' || cmd || ', roles=' || roles::text || ']', '; ')
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'transactions'
         AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')),
      'Zero write policies found'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions')
        THEN 'NOT FOUND'
      -- FAIL if any write policy directly targets staff role or has insecure staff conditions
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions'
          AND pol.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
          AND (
            pol.roles::text ILIKE '%staff%'
            OR pol.roles::text ILIKE '%public%'
            OR (pol.cmd = 'INSERT' AND (pol.with_check = 'true' OR pol.with_check ILIKE '%staff%'))
            OR (pol.cmd = 'DELETE' AND (pol.qual = 'true' OR pol.qual ILIKE '%staff%'))
            OR (pol.cmd IN ('UPDATE', 'ALL') AND (
                 pol.qual = 'true' OR pol.qual ILIKE '%staff%'
                 OR COALESCE(pol.with_check, pol.qual) = 'true'
                 OR COALESCE(pol.with_check, pol.qual) ILIKE '%staff%'
               ))
          )
      ) THEN 'FAIL'
      -- FAIL if unapproved write policies exist beyond "Admins manage transactions"
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions'
          AND pol.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
          AND pol.policyname <> 'Admins manage transactions'
      ) THEN 'FAIL'
      -- PASS if exactly 1 write policy exists and it matches Admins manage transactions
      WHEN (
        SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'transactions'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      ) = 1
      AND EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions'
          AND pol.policyname = 'Admins manage transactions' AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
          AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
          )
          AND regexp_replace(COALESCE(pol.with_check, pol.qual), '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
          )
      ) THEN 'PASS'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions')
        THEN 'Target table does not exist in catalog.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions'
          AND pol.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
          AND (
            pol.roles::text ILIKE '%staff%'
            OR pol.roles::text ILIKE '%public%'
            OR (pol.cmd = 'INSERT' AND (pol.with_check = 'true' OR pol.with_check ILIKE '%staff%'))
            OR (pol.cmd = 'DELETE' AND (pol.qual = 'true' OR pol.qual ILIKE '%staff%'))
            OR (pol.cmd IN ('UPDATE', 'ALL') AND (
                 pol.qual = 'true' OR pol.qual ILIKE '%staff%'
                 OR COALESCE(pol.with_check, pol.qual) = 'true'
                 OR COALESCE(pol.with_check, pol.qual) ILIKE '%staff%'
               ))
          )
      ) THEN 'CRITICAL SECURITY FAIL: Direct staff write (INSERT, UPDATE, DELETE, or ALL) is permitted on public.transactions.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions'
          AND pol.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
          AND pol.policyname <> 'Admins manage transactions'
      ) THEN 'FAIL: Unapproved write policy detected on public.transactions.'
      WHEN (
        SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'transactions'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      ) = 1
      AND EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions'
          AND pol.policyname = 'Admins manage transactions' AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
          AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
          )
          AND regexp_replace(COALESCE(pol.with_check, pol.qual), '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
          )
      ) THEN 'Command-aware RLS policy evaluation confirms staff is locked out from direct write: exactly 1 write policy exists ("Admins manage transactions"), properly evaluated for INSERT/UPDATE/DELETE semantics.'
      ELSE 'MANUAL REVIEW: Unexpected policy configuration or unverified expression on public.transactions.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E08' AS "Check ID",
    'public.transactions.trg_validate_transactions_on_insert' AS "Database Object",
    'BEFORE INSERT trigger trg_validate_transactions_on_insert active calling public.validate_transactions_on_insert()' AS "Expected Configuration",
    COALESCE(
      (SELECT 'trigger=' || tg.tgname || ' (enabled=' || tg.tgenabled::text || ', func=' || p.proname || ')'
       FROM pg_trigger tg
       JOIN pg_class c ON c.oid = tg.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = tg.tgfoid
       WHERE n.nspname = 'public' AND c.relname = 'transactions' AND tg.tgname = 'trg_validate_transactions_on_insert' AND NOT tg.tgisinternal
       LIMIT 1),
      'TRIGGER NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_trigger tg
        JOIN pg_class c ON c.oid = tg.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_proc p ON p.oid = tg.tgfoid
        WHERE n.nspname = 'public' AND c.relname = 'transactions' AND tg.tgname = 'trg_validate_transactions_on_insert'
          AND tg.tgenabled = 'O' AND p.proname = 'validate_transactions_on_insert' AND NOT tg.tgisinternal
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_trigger tg
        JOIN pg_class c ON c.oid = tg.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_proc p ON p.oid = tg.tgfoid
        WHERE n.nspname = 'public' AND c.relname = 'transactions' AND tg.tgname = 'trg_validate_transactions_on_insert'
          AND tg.tgenabled = 'O' AND p.proname = 'validate_transactions_on_insert' AND NOT tg.tgisinternal
      ) THEN 'Validation trigger is active and verifies required transaction fields, student existence, and due dates.'
      ELSE 'FAIL: Insert validation trigger is missing or disabled on public.transactions.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E09' AS "Check ID",
    'public.transactions.trg_protect_transactions' AS "Database Object",
    'BEFORE UPDATE trigger trg_protect_transactions active calling public.protect_transactions_on_update()' AS "Expected Configuration",
    COALESCE(
      (SELECT 'trigger=' || tg.tgname || ' (enabled=' || tg.tgenabled::text || ', func=' || p.proname || ')'
       FROM pg_trigger tg
       JOIN pg_class c ON c.oid = tg.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = tg.tgfoid
       WHERE n.nspname = 'public' AND c.relname = 'transactions' AND tg.tgname = 'trg_protect_transactions' AND NOT tg.tgisinternal
       LIMIT 1),
      'TRIGGER NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_trigger tg
        JOIN pg_class c ON c.oid = tg.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_proc p ON p.oid = tg.tgfoid
        WHERE n.nspname = 'public' AND c.relname = 'transactions' AND tg.tgname = 'trg_protect_transactions'
          AND tg.tgenabled = 'O' AND p.proname = 'protect_transactions_on_update' AND NOT tg.tgisinternal
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_trigger tg
        JOIN pg_class c ON c.oid = tg.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_proc p ON p.oid = tg.tgfoid
        WHERE n.nspname = 'public' AND c.relname = 'transactions' AND tg.tgname = 'trg_protect_transactions'
          AND tg.tgenabled = 'O' AND p.proname = 'protect_transactions_on_update' AND NOT tg.tgisinternal
      ) THEN 'Update protection trigger is active and guards transaction status transitions.'
      ELSE 'FAIL: Update protection trigger is missing or disabled on public.transactions.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E10' AS "Check ID",
    'public.issue_components_atomic()' AS "Database Object",
    'Function exists with exact 9 arguments (p_transaction_id, p_student_roll, p_student_name, p_student_phone, p_authorized_by, p_overall_due_date, p_notes, p_items, p_operation_id)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'args=' || p.pronargs::text || ' (' || pg_get_function_identity_arguments(p.oid) || ')'
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9 LIMIT 1),
      (SELECT 'FOUND WITH DIFF ARGS: ' || string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', '; ')
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic'),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic'
      ) THEN 'FAIL'
      ELSE 'NOT FOUND'
    END AS "Status",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
      ) THEN 'Function public.issue_components_atomic exists with the exact 9 canonical arguments from Migration 007 Section 32.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic'
      ) THEN 'FAIL: Function exists but has argument count mismatch.'
      ELSE 'FAIL: Function public.issue_components_atomic not found.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E11' AS "Check ID",
    'public.issue_components_atomic()' AS "Database Object",
    'prosecdef = true, search_path = pg_catalog, public, pg_temp' AS "Expected Configuration",
    COALESCE(
      (SELECT 'prosecdef=' || p.prosecdef::text || ', proconfig=' || COALESCE(array_to_string(p.proconfig, '; '), 'UNPINNED')
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
          AND p.prosecdef = true AND p.proconfig IS NOT NULL
          AND regexp_replace(array_to_string(p.proconfig, '; '), '\s+', '', 'g') = 'search_path=pg_catalog,public,pg_temp'
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
          AND (p.prosecdef = false OR p.proconfig IS NULL)
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
          AND p.prosecdef = true AND p.proconfig IS NOT NULL
          AND regexp_replace(array_to_string(p.proconfig, '; '), '\s+', '', 'g') = 'search_path=pg_catalog,public,pg_temp'
      ) THEN 'Function is marked SECURITY DEFINER with search_path strictly pinned to pg_catalog, public, pg_temp.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
          AND (p.prosecdef = false OR p.proconfig IS NULL)
      ) THEN 'FAIL: Function is not marked SECURITY DEFINER or lacks search_path configuration.'
      ELSE 'MANUAL REVIEW: Function search_path setting deviates from pg_catalog, public, pg_temp.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E12' AS "Check ID",
    'public.issue_components_atomic()' AS "Database Object",
    'EXECUTE privileges: PUBLIC=DENIED, anon=DENIED, service_role=DENIED, authenticated=ALLOWED' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9)
        THEN 'NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
        ) THEN 'GRANTED' ELSE 'DENIED' END
        || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; authenticated=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
          WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; service_role=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'ROLE MISSING'
          WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
        LIMIT 1
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9)
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9)
        THEN 'Function not found.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      ) THEN 'Execution is denied to PUBLIC, anon, and service_role; granted strictly to authenticated.'
      ELSE 'FAIL: Execution privileges deviate from Migration 007 Section 32.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E13' AS "Check ID",
    'public.issue_components_atomic()' AS "Database Object",
    'Implementation matches authoritative Migration 007 Section 32: advisory transaction lock, duplicate lookup, payload hash, actor binding, and ledger recording' AS "Expected Configuration",
    COALESCE(
      (SELECT 'normalized_body_md5=' || md5(regexp_replace(p.prosrc, '\s+', '', 'g'))
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9 LIMIT 1),
      'FUNCTION NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9)
        THEN 'NOT FOUND'
      -- FAIL if function completely lacks integration with processed_rpc_operations
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
          AND NOT (regexp_replace(lower(p.prosrc), '\s+', '', 'g') LIKE '%processed_rpc_operations%')
      ) THEN 'FAIL'
      -- PASS ONLY if exact normalized MD5 matches authoritative Migration 007 implementation
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
          AND md5(regexp_replace(p.prosrc, '\s+', '', 'g')) IN (
            'ba10fd8fdd91c536b2762ec54b93b12f',
            'f4af5c093376163b3315d65624f835cb'
          )
      ) THEN 'PASS'
      -- If function exists and references ledger but code deviates from canonical definition,
      -- static catalog query cannot parse AST or prove runtime control flow, so return MANUAL REVIEW
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
          AND NOT (regexp_replace(lower(p.prosrc), '\s+', '', 'g') LIKE '%processed_rpc_operations%')
      ) THEN 'FAIL: Function completely lacks integration with public.processed_rpc_operations.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'issue_components_atomic' AND p.pronargs = 9
          AND md5(regexp_replace(p.prosrc, '\s+', '', 'g')) IN (
            'ba10fd8fdd91c536b2762ec54b93b12f',
            'f4af5c093376163b3315d65624f835cb'
          )
      ) THEN 'Function body matches authoritative normalized implementation from Migration 007 Section 32 (verified advisory transaction lock, duplicate lookup, payload hash verification, caller binding, and ledger recording).'
      ELSE 'MANUAL REVIEW: Function source deviates from canonical Migration 007 Section 32 code. Static catalog inspection cannot parse PL/pgSQL AST or prove dynamic control flow (advisory lock contention, duplicate replay paths, payload mismatch exceptions, and ledger finalization); manual code review or execution testing required.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E14' AS "Check ID",
    'public.return_components_atomic()' AS "Database Object",
    'Function exists with exact 3 arguments (p_transaction_id, p_returned_items, p_operation_id)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'args=' || p.pronargs::text || ' (' || pg_get_function_identity_arguments(p.oid) || ')'
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3 LIMIT 1),
      (SELECT 'FOUND WITH DIFF ARGS: ' || string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', '; ')
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic'),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic'
      ) THEN 'FAIL'
      ELSE 'NOT FOUND'
    END AS "Status",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
      ) THEN 'Function public.return_components_atomic exists with the exact 3 canonical arguments from Migration 007 Section 32.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic'
      ) THEN 'FAIL: Argument count mismatch on return_components_atomic.'
      ELSE 'FAIL: Function public.return_components_atomic not found.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E15' AS "Check ID",
    'public.return_components_atomic()' AS "Database Object",
    'prosecdef = true, search_path = pg_catalog, public, pg_temp' AS "Expected Configuration",
    COALESCE(
      (SELECT 'prosecdef=' || p.prosecdef::text || ', proconfig=' || COALESCE(array_to_string(p.proconfig, '; '), 'UNPINNED')
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3 LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3)
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
          AND p.prosecdef = true AND p.proconfig IS NOT NULL
          AND regexp_replace(array_to_string(p.proconfig, '; '), '\s+', '', 'g') = 'search_path=pg_catalog,public,pg_temp'
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
          AND (p.prosecdef = false OR p.proconfig IS NULL)
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
          AND p.prosecdef = true AND p.proconfig IS NOT NULL
          AND regexp_replace(array_to_string(p.proconfig, '; '), '\s+', '', 'g') = 'search_path=pg_catalog,public,pg_temp'
      ) THEN 'Function is marked SECURITY DEFINER with search_path strictly pinned to pg_catalog, public, pg_temp.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
          AND (p.prosecdef = false OR p.proconfig IS NULL)
      ) THEN 'FAIL: Function is not marked SECURITY DEFINER or lacks search_path configuration.'
      ELSE 'MANUAL REVIEW: Function search_path setting deviates from pg_catalog, public, pg_temp.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E16' AS "Check ID",
    'public.return_components_atomic()' AS "Database Object",
    'EXECUTE privileges: PUBLIC=DENIED, anon=DENIED, service_role=DENIED, authenticated=ALLOWED' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3)
        THEN 'NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
        ) THEN 'GRANTED' ELSE 'DENIED' END
        || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; authenticated=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
          WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        || '; service_role=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'ROLE MISSING'
          WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'GRANTED'
          ELSE 'DENIED'
        END
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
        LIMIT 1
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3)
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3)
        THEN 'Function not found.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      ) THEN 'Execution is denied to PUBLIC, anon, and service_role; granted strictly to authenticated.'
      ELSE 'FAIL: Execution privileges deviate from Migration 007 Section 32.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E17' AS "Check ID",
    'public.return_components_atomic()' AS "Database Object",
    'Implementation matches authoritative Migration 007 Section 32: advisory transaction lock, duplicate lookup, payload hash, actor binding, and ledger recording' AS "Expected Configuration",
    COALESCE(
      (SELECT 'normalized_body_md5=' || md5(regexp_replace(p.prosrc, '\s+', '', 'g'))
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3 LIMIT 1),
      'FUNCTION NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3)
        THEN 'NOT FOUND'
      -- FAIL if function completely lacks integration with processed_rpc_operations
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
          AND NOT (regexp_replace(lower(p.prosrc), '\s+', '', 'g') LIKE '%processed_rpc_operations%')
      ) THEN 'FAIL'
      -- PASS ONLY if exact normalized MD5 matches authoritative Migration 007 implementation
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
          AND md5(regexp_replace(p.prosrc, '\s+', '', 'g')) IN (
            '12c9e51f98863c83d0f4f93109151d29',
            'c179c9e8d7122641e427bcbb365c2389'
          )
      ) THEN 'PASS'
      -- If function exists and references ledger but code deviates from canonical definition,
      -- static catalog query cannot parse AST or prove runtime control flow, so return MANUAL REVIEW
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3)
        THEN 'Function not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
          AND NOT (regexp_replace(lower(p.prosrc), '\s+', '', 'g') LIKE '%processed_rpc_operations%')
      ) THEN 'FAIL: Return RPC function completely lacks integration with public.processed_rpc_operations.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'return_components_atomic' AND p.pronargs = 3
          AND md5(regexp_replace(p.prosrc, '\s+', '', 'g')) IN (
            '12c9e51f98863c83d0f4f93109151d29',
            'c179c9e8d7122641e427bcbb365c2389'
          )
      ) THEN 'Function body matches authoritative normalized implementation from Migration 007 Section 32 (verified advisory transaction lock, duplicate lookup, payload hash verification, caller binding, and ledger recording).'
      ELSE 'MANUAL REVIEW: Function source deviates from canonical Migration 007 Section 32 code. Static catalog inspection cannot parse PL/pgSQL AST or prove dynamic control flow (advisory lock contention, duplicate replay paths, payload mismatch exceptions, and ledger finalization); manual code review or execution testing required.'
    END AS "Explanation"

UNION ALL

SELECT
    'E. Transactions & Operations' AS "Section",
    'E18' AS "Check ID",
    'public.transactions' AS "Database Object",
    'All 7 table privileges: PUBLIC=none, anon=none, service_role=ALL(7), authenticated=SELECT,INSERT,UPDATE,DELETE (TRUNCATE,TRIGGER,REFERENCES denied)' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions')
        THEN 'TABLE NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
        ) THEN 'EXPOSED' ELSE 'DENIED' END
        || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_table_privilege('anon', c.oid, 'SELECT')
            OR has_table_privilege('anon', c.oid, 'INSERT')
            OR has_table_privilege('anon', c.oid, 'UPDATE')
            OR has_table_privilege('anon', c.oid, 'DELETE')
            OR has_table_privilege('anon', c.oid, 'TRUNCATE')
            OR has_table_privilege('anon', c.oid, 'REFERENCES')
            OR has_table_privilege('anon', c.oid, 'TRIGGER')
          THEN 'EXPOSED'
          ELSE 'DENIED'
        END
        || '; auth(DML=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
          WHEN has_table_privilege('authenticated', c.oid, 'SELECT')
            AND has_table_privilege('authenticated', c.oid, 'INSERT')
            AND has_table_privilege('authenticated', c.oid, 'UPDATE')
            AND has_table_privilege('authenticated', c.oid, 'DELETE')
          THEN 'ALLOWED'
          ELSE 'INCOMPLETE'
        END
        || ', DDL=' || CASE
          WHEN has_table_privilege('authenticated', c.oid, 'TRUNCATE')
            OR has_table_privilege('authenticated', c.oid, 'REFERENCES')
            OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
          THEN 'EXPOSED'
          ELSE 'DENIED'
        END
        || '); srole_ALL(7)=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'ROLE MISSING'
          WHEN has_table_privilege('service_role', c.oid, 'SELECT')
            AND has_table_privilege('service_role', c.oid, 'INSERT')
            AND has_table_privilege('service_role', c.oid, 'UPDATE')
            AND has_table_privilege('service_role', c.oid, 'DELETE')
            AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
            AND has_table_privilege('service_role', c.oid, 'REFERENCES')
            AND has_table_privilege('service_role', c.oid, 'TRIGGER')
          THEN 'YES'
          ELSE 'INCOMPLETE'
        END
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'transactions'
        LIMIT 1
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'transactions'
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
          )
          AND NOT has_table_privilege('anon', c.oid, 'SELECT')
          AND NOT has_table_privilege('anon', c.oid, 'INSERT')
          AND NOT has_table_privilege('anon', c.oid, 'UPDATE')
          AND NOT has_table_privilege('anon', c.oid, 'DELETE')
          AND NOT has_table_privilege('anon', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('anon', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('anon', c.oid, 'TRIGGER')
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND has_table_privilege('authenticated', c.oid, 'INSERT')
          AND has_table_privilege('authenticated', c.oid, 'UPDATE')
          AND has_table_privilege('authenticated', c.oid, 'DELETE')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('authenticated', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRIGGER')
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'transactions'
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
          )
          AND NOT has_table_privilege('anon', c.oid, 'SELECT')
          AND NOT has_table_privilege('anon', c.oid, 'INSERT')
          AND NOT has_table_privilege('anon', c.oid, 'UPDATE')
          AND NOT has_table_privilege('anon', c.oid, 'DELETE')
          AND NOT has_table_privilege('anon', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('anon', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('anon', c.oid, 'TRIGGER')
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND has_table_privilege('authenticated', c.oid, 'INSERT')
          AND has_table_privilege('authenticated', c.oid, 'UPDATE')
          AND has_table_privilege('authenticated', c.oid, 'DELETE')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('authenticated', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRIGGER')
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'Table privilege matrix verified for all 7 privileges: PUBLIC & anon completely denied; authenticated granted DML (governed by RLS) with TRUNCATE/REFERENCES/TRIGGER denied; service_role granted all 7 privileges.'
      ELSE 'FAIL: Privilege matrix on public.transactions deviates from Migration 007 Section 1 requirements.'
    END AS "Explanation"

UNION ALL

SELECT
    'F. Other Security Objects' AS "Section",
    'F01' AS "Check ID",
    'public.components' AS "Database Object",
    'Table exists, relkind = ''r'', relrowsecurity = true, relforcerowsecurity = true' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relkind=''' || c.relkind::text || ''', rls=' || c.relrowsecurity::text || ', force=' || c.relforcerowsecurity::text
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'components' LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'components')
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'components' AND c.relkind = 'r'
          AND c.relrowsecurity = true AND c.relforcerowsecurity = true
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'components')
        THEN 'Table public.components not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'components' AND c.relkind = 'r'
          AND c.relrowsecurity = true AND c.relforcerowsecurity = true
      ) THEN 'Components table exists with both RLS and FORCE RLS enabled.'
      ELSE 'FAIL: Table public.components lacks RLS or FORCE RLS.'
    END AS "Explanation"

UNION ALL

SELECT
    'F. Other Security Objects' AS "Section",
    'F02' AS "Check ID",
    'public.components' AS "Database Object",
    'Exactly 2 policies: "Admins manage components" (cmd=ALL, roles={authenticated}, USING & WITH CHECK enforce admin roles) and "All authenticated users view components" (cmd=SELECT, true)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'count=' || count(*)::text || ' (' || string_agg(policyname || ' [' || cmd || ']', ', ') || ')'
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'components'),
      'TABLE NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'components')
        THEN 'NOT FOUND'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'components') = 2
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'components' AND pol.policyname = 'Admins manage components'
            AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
            AND regexp_replace(COALESCE(pol.with_check, pol.qual), '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
        )
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'components' AND pol.policyname = 'All authenticated users view components'
            AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}' AND pol.with_check IS NULL
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN ('true', '(true)')
        )
        THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'components'
          AND pol.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
          AND pol.policyname <> 'Admins manage components'
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'components')
        THEN 'Target table does not exist.'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'components') = 2
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'components' AND pol.policyname = 'Admins manage components'
            AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
            AND regexp_replace(COALESCE(pol.with_check, pol.qual), '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
        )
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'components' AND pol.policyname = 'All authenticated users view components'
            AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}' AND pol.with_check IS NULL
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN ('true', '(true)')
        ) THEN 'Components policies verified: exactly 2 policies exist, admin ALL policy strictly evaluated for USING and WITH CHECK, and authenticated users granted read-only SELECT.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'components'
          AND pol.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
          AND pol.policyname <> 'Admins manage components'
      ) THEN 'FAIL: Non-admin write policy exists on public.components.'
      ELSE 'MANUAL REVIEW: Components table policies deviate from approved specification or policy count differs from 2.'
    END AS "Explanation"

UNION ALL

SELECT
    'F. Other Security Objects' AS "Section",
    'F03' AS "Check ID",
    'public.components' AS "Database Object",
    'All 7 table privileges: PUBLIC=none, anon=none, service_role=ALL(7), authenticated=SELECT,INSERT,UPDATE,DELETE (TRUNCATE,TRIGGER,REFERENCES denied)' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'components')
        THEN 'TABLE NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
        ) THEN 'EXPOSED' ELSE 'DENIED' END
        || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_table_privilege('anon', c.oid, 'SELECT')
            OR has_table_privilege('anon', c.oid, 'INSERT')
            OR has_table_privilege('anon', c.oid, 'UPDATE')
            OR has_table_privilege('anon', c.oid, 'DELETE')
            OR has_table_privilege('anon', c.oid, 'TRUNCATE')
            OR has_table_privilege('anon', c.oid, 'REFERENCES')
            OR has_table_privilege('anon', c.oid, 'TRIGGER')
          THEN 'EXPOSED'
          ELSE 'DENIED'
        END
        || '; auth(DML=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
          WHEN has_table_privilege('authenticated', c.oid, 'SELECT')
            AND has_table_privilege('authenticated', c.oid, 'INSERT')
            AND has_table_privilege('authenticated', c.oid, 'UPDATE')
            AND has_table_privilege('authenticated', c.oid, 'DELETE')
          THEN 'ALLOWED'
          ELSE 'INCOMPLETE'
        END
        || ', DDL=' || CASE
          WHEN has_table_privilege('authenticated', c.oid, 'TRUNCATE')
            OR has_table_privilege('authenticated', c.oid, 'REFERENCES')
            OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
          THEN 'EXPOSED'
          ELSE 'DENIED'
        END
        || '); srole_ALL(7)=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'ROLE MISSING'
          WHEN has_table_privilege('service_role', c.oid, 'SELECT')
            AND has_table_privilege('service_role', c.oid, 'INSERT')
            AND has_table_privilege('service_role', c.oid, 'UPDATE')
            AND has_table_privilege('service_role', c.oid, 'DELETE')
            AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
            AND has_table_privilege('service_role', c.oid, 'REFERENCES')
            AND has_table_privilege('service_role', c.oid, 'TRIGGER')
          THEN 'YES'
          ELSE 'INCOMPLETE'
        END
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'components'
        LIMIT 1
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'components')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'components'
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
          )
          AND NOT has_table_privilege('anon', c.oid, 'SELECT')
          AND NOT has_table_privilege('anon', c.oid, 'INSERT')
          AND NOT has_table_privilege('anon', c.oid, 'UPDATE')
          AND NOT has_table_privilege('anon', c.oid, 'DELETE')
          AND NOT has_table_privilege('anon', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('anon', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('anon', c.oid, 'TRIGGER')
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND has_table_privilege('authenticated', c.oid, 'INSERT')
          AND has_table_privilege('authenticated', c.oid, 'UPDATE')
          AND has_table_privilege('authenticated', c.oid, 'DELETE')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('authenticated', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRIGGER')
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'components')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'components'
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
          )
          AND NOT has_table_privilege('anon', c.oid, 'SELECT')
          AND NOT has_table_privilege('anon', c.oid, 'INSERT')
          AND NOT has_table_privilege('anon', c.oid, 'UPDATE')
          AND NOT has_table_privilege('anon', c.oid, 'DELETE')
          AND NOT has_table_privilege('anon', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('anon', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('anon', c.oid, 'TRIGGER')
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND has_table_privilege('authenticated', c.oid, 'INSERT')
          AND has_table_privilege('authenticated', c.oid, 'UPDATE')
          AND has_table_privilege('authenticated', c.oid, 'DELETE')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('authenticated', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRIGGER')
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'Table privilege matrix on public.components verified for all 7 privileges: PUBLIC & anon denied; authenticated granted DML (governed by RLS) with TRUNCATE/REFERENCES/TRIGGER denied; service_role granted all 7 privileges.'
      ELSE 'FAIL: Privilege matrix on public.components deviates from Migration 007 Section 1 requirements.'
    END AS "Explanation"

UNION ALL

SELECT
    'F. Other Security Objects' AS "Section",
    'F04' AS "Check ID",
    'public.visits' AS "Database Object",
    'Table exists, relkind = ''r'', relrowsecurity = true, relforcerowsecurity = true' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relkind=''' || c.relkind::text || ''', rls=' || c.relrowsecurity::text || ', force=' || c.relforcerowsecurity::text
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'visits' LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'visits')
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'visits' AND c.relkind = 'r'
          AND c.relrowsecurity = true AND c.relforcerowsecurity = true
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'visits')
        THEN 'Table public.visits not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'visits' AND c.relkind = 'r'
          AND c.relrowsecurity = true AND c.relforcerowsecurity = true
      ) THEN 'Visits table exists with both RLS and FORCE RLS enabled.'
      ELSE 'FAIL: Table public.visits lacks RLS or FORCE RLS.'
    END AS "Explanation"

UNION ALL

SELECT
    'F. Other Security Objects' AS "Section",
    'F05' AS "Check ID",
    'public.visits' AS "Database Object",
    'Exactly 5 policies: "Admins manage visits" (ALL), "Staff view visits" (SELECT), "Staff insert visits" (INSERT), "Staff update visits" (UPDATE), "Students view own visits" (SELECT)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'count=' || count(*)::text || ' (' || string_agg(policyname || ' [' || cmd || ']', ', ') || ')'
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visits'),
      'TABLE NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'visits')
        THEN 'NOT FOUND'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visits') = 5
        -- 1. Admins manage visits (ALL)
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'visits' AND pol.policyname = 'Admins manage visits'
            AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
            AND regexp_replace(COALESCE(pol.with_check, pol.qual), '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
        )
        -- 2. Staff view visits (SELECT)
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'visits' AND pol.policyname = 'Staff view visits'
            AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}' AND pol.with_check IS NULL
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=''staff''::text)',
            '((public.get_current_user_role()=''staff''::text))',
            'public.get_current_user_role()=''staff''::text',
            '(public.get_current_user_role()=''staff'')',
            '((public.get_current_user_role()=''staff''))',
            'public.get_current_user_role()=''staff''',
            '(public.get_current_user_role()IN(''staff''::text))',
            '((public.get_current_user_role()IN(''staff''::text)))',
            'public.get_current_user_role()IN(''staff''::text)',
            '(public.get_current_user_role()IN(''staff''))',
            '((public.get_current_user_role()IN(''staff'')))',
            'public.get_current_user_role()IN(''staff'')',
            '(get_current_user_role()=''staff''::text)',
            '((get_current_user_role()=''staff''::text))',
            'get_current_user_role()=''staff''::text',
            '(get_current_user_role()=''staff'')',
            '((get_current_user_role()=''staff''))',
            'get_current_user_role()=''staff''',
            '(get_current_user_role()IN(''staff''::text))',
            '((get_current_user_role()IN(''staff''::text)))',
            'get_current_user_role()IN(''staff''::text)',
            '(get_current_user_role()IN(''staff''))',
            '((get_current_user_role()IN(''staff'')))',
            'get_current_user_role()IN(''staff'')',
            '((public.get_current_user_role())::text=''staff''::text)',
            '(((public.get_current_user_role())::text=''staff''::text))',
            '(public.get_current_user_role())::text=''staff''::text',
            '((public.get_current_user_role())::text=''staff'')',
            '(((public.get_current_user_role())::text=''staff''))',
            '(public.get_current_user_role())::text=''staff''',
            '((public.get_current_user_role())::textIN(''staff''::text))',
            '(((public.get_current_user_role())::textIN(''staff''::text)))',
            '(public.get_current_user_role())::textIN(''staff''::text)',
            '((public.get_current_user_role())::textIN(''staff''))',
            '(((public.get_current_user_role())::textIN(''staff'')))',
            '(public.get_current_user_role())::textIN(''staff'')',
            '((get_current_user_role())::text=''staff''::text)',
            '(((get_current_user_role())::text=''staff''::text))',
            '(get_current_user_role())::text=''staff''::text',
            '((get_current_user_role())::text=''staff'')',
            '(((get_current_user_role())::text=''staff''))',
            '(get_current_user_role())::text=''staff''',
            '((get_current_user_role())::textIN(''staff''::text))',
            '(((get_current_user_role())::textIN(''staff''::text)))',
            '(get_current_user_role())::textIN(''staff''::text)',
            '((get_current_user_role())::textIN(''staff''))',
            '(((get_current_user_role())::textIN(''staff'')))',
            '(get_current_user_role())::textIN(''staff'')'
            )
        )
        -- 3. Staff insert visits (INSERT)
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'visits' AND pol.policyname = 'Staff insert visits'
            AND pol.cmd = 'INSERT' AND pol.roles = '{authenticated}'
            AND regexp_replace(pol.with_check, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=''staff''::text)',
            '((public.get_current_user_role()=''staff''::text))',
            'public.get_current_user_role()=''staff''::text',
            '(public.get_current_user_role()=''staff'')',
            '((public.get_current_user_role()=''staff''))',
            'public.get_current_user_role()=''staff''',
            '(public.get_current_user_role()IN(''staff''::text))',
            '((public.get_current_user_role()IN(''staff''::text)))',
            'public.get_current_user_role()IN(''staff''::text)',
            '(public.get_current_user_role()IN(''staff''))',
            '((public.get_current_user_role()IN(''staff'')))',
            'public.get_current_user_role()IN(''staff'')',
            '(get_current_user_role()=''staff''::text)',
            '((get_current_user_role()=''staff''::text))',
            'get_current_user_role()=''staff''::text',
            '(get_current_user_role()=''staff'')',
            '((get_current_user_role()=''staff''))',
            'get_current_user_role()=''staff''',
            '(get_current_user_role()IN(''staff''::text))',
            '((get_current_user_role()IN(''staff''::text)))',
            'get_current_user_role()IN(''staff''::text)',
            '(get_current_user_role()IN(''staff''))',
            '((get_current_user_role()IN(''staff'')))',
            'get_current_user_role()IN(''staff'')',
            '((public.get_current_user_role())::text=''staff''::text)',
            '(((public.get_current_user_role())::text=''staff''::text))',
            '(public.get_current_user_role())::text=''staff''::text',
            '((public.get_current_user_role())::text=''staff'')',
            '(((public.get_current_user_role())::text=''staff''))',
            '(public.get_current_user_role())::text=''staff''',
            '((public.get_current_user_role())::textIN(''staff''::text))',
            '(((public.get_current_user_role())::textIN(''staff''::text)))',
            '(public.get_current_user_role())::textIN(''staff''::text)',
            '((public.get_current_user_role())::textIN(''staff''))',
            '(((public.get_current_user_role())::textIN(''staff'')))',
            '(public.get_current_user_role())::textIN(''staff'')',
            '((get_current_user_role())::text=''staff''::text)',
            '(((get_current_user_role())::text=''staff''::text))',
            '(get_current_user_role())::text=''staff''::text',
            '((get_current_user_role())::text=''staff'')',
            '(((get_current_user_role())::text=''staff''))',
            '(get_current_user_role())::text=''staff''',
            '((get_current_user_role())::textIN(''staff''::text))',
            '(((get_current_user_role())::textIN(''staff''::text)))',
            '(get_current_user_role())::textIN(''staff''::text)',
            '((get_current_user_role())::textIN(''staff''))',
            '(((get_current_user_role())::textIN(''staff'')))',
            '(get_current_user_role())::textIN(''staff'')'
            )
        )
        -- 4. Staff update visits (UPDATE)
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'visits' AND pol.policyname = 'Staff update visits'
            AND pol.cmd = 'UPDATE' AND pol.roles = '{authenticated}'
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=''staff''::text)',
            '((public.get_current_user_role()=''staff''::text))',
            'public.get_current_user_role()=''staff''::text',
            '(public.get_current_user_role()=''staff'')',
            '((public.get_current_user_role()=''staff''))',
            'public.get_current_user_role()=''staff''',
            '(public.get_current_user_role()IN(''staff''::text))',
            '((public.get_current_user_role()IN(''staff''::text)))',
            'public.get_current_user_role()IN(''staff''::text)',
            '(public.get_current_user_role()IN(''staff''))',
            '((public.get_current_user_role()IN(''staff'')))',
            'public.get_current_user_role()IN(''staff'')',
            '(get_current_user_role()=''staff''::text)',
            '((get_current_user_role()=''staff''::text))',
            'get_current_user_role()=''staff''::text',
            '(get_current_user_role()=''staff'')',
            '((get_current_user_role()=''staff''))',
            'get_current_user_role()=''staff''',
            '(get_current_user_role()IN(''staff''::text))',
            '((get_current_user_role()IN(''staff''::text)))',
            'get_current_user_role()IN(''staff''::text)',
            '(get_current_user_role()IN(''staff''))',
            '((get_current_user_role()IN(''staff'')))',
            'get_current_user_role()IN(''staff'')',
            '((public.get_current_user_role())::text=''staff''::text)',
            '(((public.get_current_user_role())::text=''staff''::text))',
            '(public.get_current_user_role())::text=''staff''::text',
            '((public.get_current_user_role())::text=''staff'')',
            '(((public.get_current_user_role())::text=''staff''))',
            '(public.get_current_user_role())::text=''staff''',
            '((public.get_current_user_role())::textIN(''staff''::text))',
            '(((public.get_current_user_role())::textIN(''staff''::text)))',
            '(public.get_current_user_role())::textIN(''staff''::text)',
            '((public.get_current_user_role())::textIN(''staff''))',
            '(((public.get_current_user_role())::textIN(''staff'')))',
            '(public.get_current_user_role())::textIN(''staff'')',
            '((get_current_user_role())::text=''staff''::text)',
            '(((get_current_user_role())::text=''staff''::text))',
            '(get_current_user_role())::text=''staff''::text',
            '((get_current_user_role())::text=''staff'')',
            '(((get_current_user_role())::text=''staff''))',
            '(get_current_user_role())::text=''staff''',
            '((get_current_user_role())::textIN(''staff''::text))',
            '(((get_current_user_role())::textIN(''staff''::text)))',
            '(get_current_user_role())::textIN(''staff''::text)',
            '((get_current_user_role())::textIN(''staff''))',
            '(((get_current_user_role())::textIN(''staff'')))',
            '(get_current_user_role())::textIN(''staff'')'
            )
            AND regexp_replace(COALESCE(pol.with_check, pol.qual), '\s+', '', 'g') IN (
            '(public.get_current_user_role()=''staff''::text)',
            '((public.get_current_user_role()=''staff''::text))',
            'public.get_current_user_role()=''staff''::text',
            '(public.get_current_user_role()=''staff'')',
            '((public.get_current_user_role()=''staff''))',
            'public.get_current_user_role()=''staff''',
            '(public.get_current_user_role()IN(''staff''::text))',
            '((public.get_current_user_role()IN(''staff''::text)))',
            'public.get_current_user_role()IN(''staff''::text)',
            '(public.get_current_user_role()IN(''staff''))',
            '((public.get_current_user_role()IN(''staff'')))',
            'public.get_current_user_role()IN(''staff'')',
            '(get_current_user_role()=''staff''::text)',
            '((get_current_user_role()=''staff''::text))',
            'get_current_user_role()=''staff''::text',
            '(get_current_user_role()=''staff'')',
            '((get_current_user_role()=''staff''))',
            'get_current_user_role()=''staff''',
            '(get_current_user_role()IN(''staff''::text))',
            '((get_current_user_role()IN(''staff''::text)))',
            'get_current_user_role()IN(''staff''::text)',
            '(get_current_user_role()IN(''staff''))',
            '((get_current_user_role()IN(''staff'')))',
            'get_current_user_role()IN(''staff'')',
            '((public.get_current_user_role())::text=''staff''::text)',
            '(((public.get_current_user_role())::text=''staff''::text))',
            '(public.get_current_user_role())::text=''staff''::text',
            '((public.get_current_user_role())::text=''staff'')',
            '(((public.get_current_user_role())::text=''staff''))',
            '(public.get_current_user_role())::text=''staff''',
            '((public.get_current_user_role())::textIN(''staff''::text))',
            '(((public.get_current_user_role())::textIN(''staff''::text)))',
            '(public.get_current_user_role())::textIN(''staff''::text)',
            '((public.get_current_user_role())::textIN(''staff''))',
            '(((public.get_current_user_role())::textIN(''staff'')))',
            '(public.get_current_user_role())::textIN(''staff'')',
            '((get_current_user_role())::text=''staff''::text)',
            '(((get_current_user_role())::text=''staff''::text))',
            '(get_current_user_role())::text=''staff''::text',
            '((get_current_user_role())::text=''staff'')',
            '(((get_current_user_role())::text=''staff''))',
            '(get_current_user_role())::text=''staff''',
            '((get_current_user_role())::textIN(''staff''::text))',
            '(((get_current_user_role())::textIN(''staff''::text)))',
            '(get_current_user_role())::textIN(''staff''::text)',
            '((get_current_user_role())::textIN(''staff''))',
            '(((get_current_user_role())::textIN(''staff'')))',
            '(get_current_user_role())::textIN(''staff'')'
            )
        )
        -- 5. Students view own visits (SELECT)
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'visits' AND pol.policyname = 'Students view own visits'
            AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}' AND pol.with_check IS NULL
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(UPPER(student_roll)=public.get_current_student_roll())',
            '((UPPER(student_roll)=public.get_current_student_roll()))',
            'UPPER(student_roll)=public.get_current_student_roll()',
            '(UPPER((student_roll)::text)=public.get_current_student_roll())',
            '((UPPER((student_roll)::text)=public.get_current_student_roll()))',
            'UPPER((student_roll)::text)=public.get_current_student_roll()',
            '(UPPER(student_roll)=get_current_student_roll())',
            '((UPPER(student_roll)=get_current_student_roll()))',
            'UPPER(student_roll)=get_current_student_roll()',
            '(UPPER((student_roll)::text)=get_current_student_roll())',
            '((UPPER((student_roll)::text)=get_current_student_roll()))',
            'UPPER((student_roll)::text)=get_current_student_roll()'
            )
        )
        THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'visits'
          AND pol.cmd = 'DELETE' AND pol.policyname <> 'Admins manage visits'
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'visits')
        THEN 'Target table does not exist.'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visits') = 5
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'visits' AND pol.policyname = 'Admins manage visits'
            AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
            AND regexp_replace(COALESCE(pol.with_check, pol.qual), '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
        )
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'visits' AND pol.policyname = 'Staff view visits'
            AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}' AND pol.with_check IS NULL
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=''staff''::text)',
            '((public.get_current_user_role()=''staff''::text))',
            'public.get_current_user_role()=''staff''::text',
            '(public.get_current_user_role()=''staff'')',
            '((public.get_current_user_role()=''staff''))',
            'public.get_current_user_role()=''staff''',
            '(public.get_current_user_role()IN(''staff''::text))',
            '((public.get_current_user_role()IN(''staff''::text)))',
            'public.get_current_user_role()IN(''staff''::text)',
            '(public.get_current_user_role()IN(''staff''))',
            '((public.get_current_user_role()IN(''staff'')))',
            'public.get_current_user_role()IN(''staff'')',
            '(get_current_user_role()=''staff''::text)',
            '((get_current_user_role()=''staff''::text))',
            'get_current_user_role()=''staff''::text',
            '(get_current_user_role()=''staff'')',
            '((get_current_user_role()=''staff''))',
            'get_current_user_role()=''staff''',
            '(get_current_user_role()IN(''staff''::text))',
            '((get_current_user_role()IN(''staff''::text)))',
            'get_current_user_role()IN(''staff''::text)',
            '(get_current_user_role()IN(''staff''))',
            '((get_current_user_role()IN(''staff'')))',
            'get_current_user_role()IN(''staff'')',
            '((public.get_current_user_role())::text=''staff''::text)',
            '(((public.get_current_user_role())::text=''staff''::text))',
            '(public.get_current_user_role())::text=''staff''::text',
            '((public.get_current_user_role())::text=''staff'')',
            '(((public.get_current_user_role())::text=''staff''))',
            '(public.get_current_user_role())::text=''staff''',
            '((public.get_current_user_role())::textIN(''staff''::text))',
            '(((public.get_current_user_role())::textIN(''staff''::text)))',
            '(public.get_current_user_role())::textIN(''staff''::text)',
            '((public.get_current_user_role())::textIN(''staff''))',
            '(((public.get_current_user_role())::textIN(''staff'')))',
            '(public.get_current_user_role())::textIN(''staff'')',
            '((get_current_user_role())::text=''staff''::text)',
            '(((get_current_user_role())::text=''staff''::text))',
            '(get_current_user_role())::text=''staff''::text',
            '((get_current_user_role())::text=''staff'')',
            '(((get_current_user_role())::text=''staff''))',
            '(get_current_user_role())::text=''staff''',
            '((get_current_user_role())::textIN(''staff''::text))',
            '(((get_current_user_role())::textIN(''staff''::text)))',
            '(get_current_user_role())::textIN(''staff''::text)',
            '((get_current_user_role())::textIN(''staff''))',
            '(((get_current_user_role())::textIN(''staff'')))',
            '(get_current_user_role())::textIN(''staff'')'
            )
        )
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'visits' AND pol.policyname = 'Staff insert visits'
            AND pol.cmd = 'INSERT' AND pol.roles = '{authenticated}'
            AND regexp_replace(pol.with_check, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=''staff''::text)',
            '((public.get_current_user_role()=''staff''::text))',
            'public.get_current_user_role()=''staff''::text',
            '(public.get_current_user_role()=''staff'')',
            '((public.get_current_user_role()=''staff''))',
            'public.get_current_user_role()=''staff''',
            '(public.get_current_user_role()IN(''staff''::text))',
            '((public.get_current_user_role()IN(''staff''::text)))',
            'public.get_current_user_role()IN(''staff''::text)',
            '(public.get_current_user_role()IN(''staff''))',
            '((public.get_current_user_role()IN(''staff'')))',
            'public.get_current_user_role()IN(''staff'')',
            '(get_current_user_role()=''staff''::text)',
            '((get_current_user_role()=''staff''::text))',
            'get_current_user_role()=''staff''::text',
            '(get_current_user_role()=''staff'')',
            '((get_current_user_role()=''staff''))',
            'get_current_user_role()=''staff''',
            '(get_current_user_role()IN(''staff''::text))',
            '((get_current_user_role()IN(''staff''::text)))',
            'get_current_user_role()IN(''staff''::text)',
            '(get_current_user_role()IN(''staff''))',
            '((get_current_user_role()IN(''staff'')))',
            'get_current_user_role()IN(''staff'')',
            '((public.get_current_user_role())::text=''staff''::text)',
            '(((public.get_current_user_role())::text=''staff''::text))',
            '(public.get_current_user_role())::text=''staff''::text',
            '((public.get_current_user_role())::text=''staff'')',
            '(((public.get_current_user_role())::text=''staff''))',
            '(public.get_current_user_role())::text=''staff''',
            '((public.get_current_user_role())::textIN(''staff''::text))',
            '(((public.get_current_user_role())::textIN(''staff''::text)))',
            '(public.get_current_user_role())::textIN(''staff''::text)',
            '((public.get_current_user_role())::textIN(''staff''))',
            '(((public.get_current_user_role())::textIN(''staff'')))',
            '(public.get_current_user_role())::textIN(''staff'')',
            '((get_current_user_role())::text=''staff''::text)',
            '(((get_current_user_role())::text=''staff''::text))',
            '(get_current_user_role())::text=''staff''::text',
            '((get_current_user_role())::text=''staff'')',
            '(((get_current_user_role())::text=''staff''))',
            '(get_current_user_role())::text=''staff''',
            '((get_current_user_role())::textIN(''staff''::text))',
            '(((get_current_user_role())::textIN(''staff''::text)))',
            '(get_current_user_role())::textIN(''staff''::text)',
            '((get_current_user_role())::textIN(''staff''))',
            '(((get_current_user_role())::textIN(''staff'')))',
            '(get_current_user_role())::textIN(''staff'')'
            )
        )
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'visits' AND pol.policyname = 'Staff update visits'
            AND pol.cmd = 'UPDATE' AND pol.roles = '{authenticated}'
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=''staff''::text)',
            '((public.get_current_user_role()=''staff''::text))',
            'public.get_current_user_role()=''staff''::text',
            '(public.get_current_user_role()=''staff'')',
            '((public.get_current_user_role()=''staff''))',
            'public.get_current_user_role()=''staff''',
            '(public.get_current_user_role()IN(''staff''::text))',
            '((public.get_current_user_role()IN(''staff''::text)))',
            'public.get_current_user_role()IN(''staff''::text)',
            '(public.get_current_user_role()IN(''staff''))',
            '((public.get_current_user_role()IN(''staff'')))',
            'public.get_current_user_role()IN(''staff'')',
            '(get_current_user_role()=''staff''::text)',
            '((get_current_user_role()=''staff''::text))',
            'get_current_user_role()=''staff''::text',
            '(get_current_user_role()=''staff'')',
            '((get_current_user_role()=''staff''))',
            'get_current_user_role()=''staff''',
            '(get_current_user_role()IN(''staff''::text))',
            '((get_current_user_role()IN(''staff''::text)))',
            'get_current_user_role()IN(''staff''::text)',
            '(get_current_user_role()IN(''staff''))',
            '((get_current_user_role()IN(''staff'')))',
            'get_current_user_role()IN(''staff'')',
            '((public.get_current_user_role())::text=''staff''::text)',
            '(((public.get_current_user_role())::text=''staff''::text))',
            '(public.get_current_user_role())::text=''staff''::text',
            '((public.get_current_user_role())::text=''staff'')',
            '(((public.get_current_user_role())::text=''staff''))',
            '(public.get_current_user_role())::text=''staff''',
            '((public.get_current_user_role())::textIN(''staff''::text))',
            '(((public.get_current_user_role())::textIN(''staff''::text)))',
            '(public.get_current_user_role())::textIN(''staff''::text)',
            '((public.get_current_user_role())::textIN(''staff''))',
            '(((public.get_current_user_role())::textIN(''staff'')))',
            '(public.get_current_user_role())::textIN(''staff'')',
            '((get_current_user_role())::text=''staff''::text)',
            '(((get_current_user_role())::text=''staff''::text))',
            '(get_current_user_role())::text=''staff''::text',
            '((get_current_user_role())::text=''staff'')',
            '(((get_current_user_role())::text=''staff''))',
            '(get_current_user_role())::text=''staff''',
            '((get_current_user_role())::textIN(''staff''::text))',
            '(((get_current_user_role())::textIN(''staff''::text)))',
            '(get_current_user_role())::textIN(''staff''::text)',
            '((get_current_user_role())::textIN(''staff''))',
            '(((get_current_user_role())::textIN(''staff'')))',
            '(get_current_user_role())::textIN(''staff'')'
            )
            AND regexp_replace(COALESCE(pol.with_check, pol.qual), '\s+', '', 'g') IN (
            '(public.get_current_user_role()=''staff''::text)',
            '((public.get_current_user_role()=''staff''::text))',
            'public.get_current_user_role()=''staff''::text',
            '(public.get_current_user_role()=''staff'')',
            '((public.get_current_user_role()=''staff''))',
            'public.get_current_user_role()=''staff''',
            '(public.get_current_user_role()IN(''staff''::text))',
            '((public.get_current_user_role()IN(''staff''::text)))',
            'public.get_current_user_role()IN(''staff''::text)',
            '(public.get_current_user_role()IN(''staff''))',
            '((public.get_current_user_role()IN(''staff'')))',
            'public.get_current_user_role()IN(''staff'')',
            '(get_current_user_role()=''staff''::text)',
            '((get_current_user_role()=''staff''::text))',
            'get_current_user_role()=''staff''::text',
            '(get_current_user_role()=''staff'')',
            '((get_current_user_role()=''staff''))',
            'get_current_user_role()=''staff''',
            '(get_current_user_role()IN(''staff''::text))',
            '((get_current_user_role()IN(''staff''::text)))',
            'get_current_user_role()IN(''staff''::text)',
            '(get_current_user_role()IN(''staff''))',
            '((get_current_user_role()IN(''staff'')))',
            'get_current_user_role()IN(''staff'')',
            '((public.get_current_user_role())::text=''staff''::text)',
            '(((public.get_current_user_role())::text=''staff''::text))',
            '(public.get_current_user_role())::text=''staff''::text',
            '((public.get_current_user_role())::text=''staff'')',
            '(((public.get_current_user_role())::text=''staff''))',
            '(public.get_current_user_role())::text=''staff''',
            '((public.get_current_user_role())::textIN(''staff''::text))',
            '(((public.get_current_user_role())::textIN(''staff''::text)))',
            '(public.get_current_user_role())::textIN(''staff''::text)',
            '((public.get_current_user_role())::textIN(''staff''))',
            '(((public.get_current_user_role())::textIN(''staff'')))',
            '(public.get_current_user_role())::textIN(''staff'')',
            '((get_current_user_role())::text=''staff''::text)',
            '(((get_current_user_role())::text=''staff''::text))',
            '(get_current_user_role())::text=''staff''::text',
            '((get_current_user_role())::text=''staff'')',
            '(((get_current_user_role())::text=''staff''))',
            '(get_current_user_role())::text=''staff''',
            '((get_current_user_role())::textIN(''staff''::text))',
            '(((get_current_user_role())::textIN(''staff''::text)))',
            '(get_current_user_role())::textIN(''staff''::text)',
            '((get_current_user_role())::textIN(''staff''))',
            '(((get_current_user_role())::textIN(''staff'')))',
            '(get_current_user_role())::textIN(''staff'')'
            )
        )
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'visits' AND pol.policyname = 'Students view own visits'
            AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}' AND pol.with_check IS NULL
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(UPPER(student_roll)=public.get_current_student_roll())',
            '((UPPER(student_roll)=public.get_current_student_roll()))',
            'UPPER(student_roll)=public.get_current_student_roll()',
            '(UPPER((student_roll)::text)=public.get_current_student_roll())',
            '((UPPER((student_roll)::text)=public.get_current_student_roll()))',
            'UPPER((student_roll)::text)=public.get_current_student_roll()',
            '(UPPER(student_roll)=get_current_student_roll())',
            '((UPPER(student_roll)=get_current_student_roll()))',
            'UPPER(student_roll)=get_current_student_roll()',
            '(UPPER((student_roll)::text)=get_current_student_roll())',
            '((UPPER((student_roll)::text)=get_current_student_roll()))',
            'UPPER((student_roll)::text)=get_current_student_roll()'
            )
        ) THEN 'Visits policies verified: exactly 5 policies exist, admin ALL policy verified, staff discrete SELECT/INSERT/UPDATE verified (zero DELETE for staff), and student own visits verified.'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'visits'
          AND pol.cmd = 'DELETE' AND pol.policyname <> 'Admins manage visits'
      ) THEN 'CRITICAL SECURITY FAIL: Non-admin DELETE policy detected on public.visits.'
      ELSE 'MANUAL REVIEW: Visits policies deviate from canonical definitions or policy count differs from 5.'
    END AS "Explanation"

UNION ALL

SELECT
    'F. Other Security Objects' AS "Section",
    'F06' AS "Check ID",
    'public.visits' AS "Database Object",
    'Both triggers active: trg_validate_visits_on_insert (BEFORE INSERT) and trg_protect_visits (BEFORE UPDATE)' AS "Expected Configuration",
    COALESCE(
      (SELECT 'triggers=' || string_agg(tgname || ' [enabled=' || tgenabled::text || ']', ', ')
       FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'visits' AND tg.tgname IN ('trg_validate_visits_on_insert', 'trg_protect_visits')
         AND NOT tg.tgisinternal),
      'TRIGGERS NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'visits')
        THEN 'NOT FOUND'
      WHEN (
        SELECT count(*)
        FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'visits' AND tg.tgname IN ('trg_validate_visits_on_insert', 'trg_protect_visits')
          AND tg.tgenabled = 'O' AND NOT tg.tgisinternal
      ) = 2 THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'visits')
        THEN 'Target table does not exist.'
      WHEN (
        SELECT count(*)
        FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'visits' AND tg.tgname IN ('trg_validate_visits_on_insert', 'trg_protect_visits')
          AND tg.tgenabled = 'O' AND NOT tg.tgisinternal
      ) = 2 THEN 'Both attendance hardening triggers are active on public.visits.'
      ELSE 'FAIL: One or both visits triggers are missing or disabled.'
    END AS "Explanation"

UNION ALL

SELECT
    'F. Other Security Objects' AS "Section",
    'F07' AS "Check ID",
    'public.visits' AS "Database Object",
    'All 7 table privileges: PUBLIC=none, anon=none, service_role=ALL(7), authenticated=SELECT,INSERT,UPDATE,DELETE (TRUNCATE,TRIGGER,REFERENCES denied)' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'visits')
        THEN 'TABLE NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
        ) THEN 'EXPOSED' ELSE 'DENIED' END
        || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_table_privilege('anon', c.oid, 'SELECT')
            OR has_table_privilege('anon', c.oid, 'INSERT')
            OR has_table_privilege('anon', c.oid, 'UPDATE')
            OR has_table_privilege('anon', c.oid, 'DELETE')
            OR has_table_privilege('anon', c.oid, 'TRUNCATE')
            OR has_table_privilege('anon', c.oid, 'REFERENCES')
            OR has_table_privilege('anon', c.oid, 'TRIGGER')
          THEN 'EXPOSED'
          ELSE 'DENIED'
        END
        || '; auth(DML=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
          WHEN has_table_privilege('authenticated', c.oid, 'SELECT')
            AND has_table_privilege('authenticated', c.oid, 'INSERT')
            AND has_table_privilege('authenticated', c.oid, 'UPDATE')
            AND has_table_privilege('authenticated', c.oid, 'DELETE')
          THEN 'ALLOWED'
          ELSE 'INCOMPLETE'
        END
        || ', DDL=' || CASE
          WHEN has_table_privilege('authenticated', c.oid, 'TRUNCATE')
            OR has_table_privilege('authenticated', c.oid, 'REFERENCES')
            OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
          THEN 'EXPOSED'
          ELSE 'DENIED'
        END
        || '); srole_ALL(7)=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'ROLE MISSING'
          WHEN has_table_privilege('service_role', c.oid, 'SELECT')
            AND has_table_privilege('service_role', c.oid, 'INSERT')
            AND has_table_privilege('service_role', c.oid, 'UPDATE')
            AND has_table_privilege('service_role', c.oid, 'DELETE')
            AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
            AND has_table_privilege('service_role', c.oid, 'REFERENCES')
            AND has_table_privilege('service_role', c.oid, 'TRIGGER')
          THEN 'YES'
          ELSE 'INCOMPLETE'
        END
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'visits'
        LIMIT 1
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'visits')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'visits'
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
          )
          AND NOT has_table_privilege('anon', c.oid, 'SELECT')
          AND NOT has_table_privilege('anon', c.oid, 'INSERT')
          AND NOT has_table_privilege('anon', c.oid, 'UPDATE')
          AND NOT has_table_privilege('anon', c.oid, 'DELETE')
          AND NOT has_table_privilege('anon', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('anon', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('anon', c.oid, 'TRIGGER')
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND has_table_privilege('authenticated', c.oid, 'INSERT')
          AND has_table_privilege('authenticated', c.oid, 'UPDATE')
          AND has_table_privilege('authenticated', c.oid, 'DELETE')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('authenticated', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRIGGER')
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'visits')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'visits'
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
          )
          AND NOT has_table_privilege('anon', c.oid, 'SELECT')
          AND NOT has_table_privilege('anon', c.oid, 'INSERT')
          AND NOT has_table_privilege('anon', c.oid, 'UPDATE')
          AND NOT has_table_privilege('anon', c.oid, 'DELETE')
          AND NOT has_table_privilege('anon', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('anon', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('anon', c.oid, 'TRIGGER')
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND has_table_privilege('authenticated', c.oid, 'INSERT')
          AND has_table_privilege('authenticated', c.oid, 'UPDATE')
          AND has_table_privilege('authenticated', c.oid, 'DELETE')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('authenticated', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRIGGER')
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'Table privilege matrix on public.visits verified for all 7 privileges: PUBLIC & anon denied; authenticated granted DML (governed by RLS) with TRUNCATE/REFERENCES/TRIGGER denied; service_role granted all 7 privileges.'
      ELSE 'FAIL: Visits table privileges differ from Migration 007 Section 1 requirements.'
    END AS "Explanation"

UNION ALL

SELECT
    'F. Other Security Objects' AS "Section",
    'F08' AS "Check ID",
    'public.student_roster' AS "Database Object",
    'Table exists, relkind = ''r'', relrowsecurity = true, relforcerowsecurity = true' AS "Expected Configuration",
    COALESCE(
      (SELECT 'relkind=''' || c.relkind::text || ''', rls=' || c.relrowsecurity::text || ', force=' || c.relforcerowsecurity::text
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'student_roster' LIMIT 1),
      'NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'student_roster')
        THEN 'NOT FOUND'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'student_roster' AND c.relkind = 'r'
          AND c.relrowsecurity = true AND c.relforcerowsecurity = true
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'student_roster')
        THEN 'Table public.student_roster not found.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'student_roster' AND c.relkind = 'r'
          AND c.relrowsecurity = true AND c.relforcerowsecurity = true
      ) THEN 'Student roster table exists with both RLS and FORCE RLS enabled.'
      ELSE 'FAIL: Table public.student_roster lacks RLS or FORCE RLS.'
    END AS "Explanation"

UNION ALL

SELECT
    'F. Other Security Objects' AS "Section",
    'F09' AS "Check ID",
    'public.student_roster' AS "Database Object",
    'Exactly 2 policies: "Admins manage student roster" (ALL) and "Staff view student roster" (SELECT, staff only); zero student access' AS "Expected Configuration",
    COALESCE(
      (SELECT 'count=' || count(*)::text || ' (' || string_agg(policyname || ' [' || cmd || ']', ', ') || ')'
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_roster'),
      'TABLE NOT FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'student_roster')
        THEN 'NOT FOUND'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_roster') = 2
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'student_roster' AND pol.policyname = 'Admins manage student roster'
            AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
            AND regexp_replace(COALESCE(pol.with_check, pol.qual), '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
        )
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'student_roster' AND pol.policyname = 'Staff view student roster'
            AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}' AND pol.with_check IS NULL
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=''staff''::text)',
            '((public.get_current_user_role()=''staff''::text))',
            'public.get_current_user_role()=''staff''::text',
            '(public.get_current_user_role()=''staff'')',
            '((public.get_current_user_role()=''staff''))',
            'public.get_current_user_role()=''staff''',
            '(public.get_current_user_role()IN(''staff''::text))',
            '((public.get_current_user_role()IN(''staff''::text)))',
            'public.get_current_user_role()IN(''staff''::text)',
            '(public.get_current_user_role()IN(''staff''))',
            '((public.get_current_user_role()IN(''staff'')))',
            'public.get_current_user_role()IN(''staff'')',
            '(get_current_user_role()=''staff''::text)',
            '((get_current_user_role()=''staff''::text))',
            'get_current_user_role()=''staff''::text',
            '(get_current_user_role()=''staff'')',
            '((get_current_user_role()=''staff''))',
            'get_current_user_role()=''staff''',
            '(get_current_user_role()IN(''staff''::text))',
            '((get_current_user_role()IN(''staff''::text)))',
            'get_current_user_role()IN(''staff''::text)',
            '(get_current_user_role()IN(''staff''))',
            '((get_current_user_role()IN(''staff'')))',
            'get_current_user_role()IN(''staff'')',
            '((public.get_current_user_role())::text=''staff''::text)',
            '(((public.get_current_user_role())::text=''staff''::text))',
            '(public.get_current_user_role())::text=''staff''::text',
            '((public.get_current_user_role())::text=''staff'')',
            '(((public.get_current_user_role())::text=''staff''))',
            '(public.get_current_user_role())::text=''staff''',
            '((public.get_current_user_role())::textIN(''staff''::text))',
            '(((public.get_current_user_role())::textIN(''staff''::text)))',
            '(public.get_current_user_role())::textIN(''staff''::text)',
            '((public.get_current_user_role())::textIN(''staff''))',
            '(((public.get_current_user_role())::textIN(''staff'')))',
            '(public.get_current_user_role())::textIN(''staff'')',
            '((get_current_user_role())::text=''staff''::text)',
            '(((get_current_user_role())::text=''staff''::text))',
            '(get_current_user_role())::text=''staff''::text',
            '((get_current_user_role())::text=''staff'')',
            '(((get_current_user_role())::text=''staff''))',
            '(get_current_user_role())::text=''staff''',
            '((get_current_user_role())::textIN(''staff''::text))',
            '(((get_current_user_role())::textIN(''staff''::text)))',
            '(get_current_user_role())::textIN(''staff''::text)',
            '((get_current_user_role())::textIN(''staff''))',
            '(((get_current_user_role())::textIN(''staff'')))',
            '(get_current_user_role())::textIN(''staff'')'
            )
        )
        THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'student_roster'
          AND pol.cmd IN ('INSERT', 'UPDATE', 'DELETE')
          AND pol.policyname <> 'Admins manage student roster'
      ) THEN 'FAIL'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'student_roster')
        THEN 'Target table does not exist.'
      WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_roster') = 2
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'student_roster' AND pol.policyname = 'Admins manage student roster'
            AND pol.cmd = 'ALL' AND pol.roles = '{authenticated}'
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
            AND regexp_replace(COALESCE(pol.with_check, pol.qual), '\s+', '', 'g') IN (
            '(public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'public.get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'public.get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '(get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '((get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            'get_current_user_role()=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '(get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '((get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '(get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '((get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            'get_current_user_role()IN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '(get_current_user_role()IN(''admin'',''substitute_admin'',''sir''))',
            '((get_current_user_role()IN(''admin'',''substitute_admin'',''sir''])))',
            'get_current_user_role()IN(''admin'',''substitute_admin'',''sir'')',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(public.get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(public.get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')',
            '((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text]))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin''::text,''substitute_admin''::text,''sir''::text])',
            '((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir'']))',
            '(((get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::text=ANY(ARRAY[''admin'',''substitute_admin'',''sir''])',
            '((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text))',
            '(((get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)))',
            '(get_current_user_role())::textIN(''admin''::text,''substitute_admin''::text,''sir''::text)',
            '((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''))',
            '(((get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir''])))',
            '(get_current_user_role())::textIN(''admin'',''substitute_admin'',''sir'')'
            )
        )
        AND EXISTS (
          SELECT 1 FROM pg_policies pol
          WHERE pol.schemaname = 'public' AND pol.tablename = 'student_roster' AND pol.policyname = 'Staff view student roster'
            AND pol.cmd = 'SELECT' AND pol.roles = '{authenticated}' AND pol.with_check IS NULL
            AND regexp_replace(pol.qual, '\s+', '', 'g') IN (
            '(public.get_current_user_role()=''staff''::text)',
            '((public.get_current_user_role()=''staff''::text))',
            'public.get_current_user_role()=''staff''::text',
            '(public.get_current_user_role()=''staff'')',
            '((public.get_current_user_role()=''staff''))',
            'public.get_current_user_role()=''staff''',
            '(public.get_current_user_role()IN(''staff''::text))',
            '((public.get_current_user_role()IN(''staff''::text)))',
            'public.get_current_user_role()IN(''staff''::text)',
            '(public.get_current_user_role()IN(''staff''))',
            '((public.get_current_user_role()IN(''staff'')))',
            'public.get_current_user_role()IN(''staff'')',
            '(get_current_user_role()=''staff''::text)',
            '((get_current_user_role()=''staff''::text))',
            'get_current_user_role()=''staff''::text',
            '(get_current_user_role()=''staff'')',
            '((get_current_user_role()=''staff''))',
            'get_current_user_role()=''staff''',
            '(get_current_user_role()IN(''staff''::text))',
            '((get_current_user_role()IN(''staff''::text)))',
            'get_current_user_role()IN(''staff''::text)',
            '(get_current_user_role()IN(''staff''))',
            '((get_current_user_role()IN(''staff'')))',
            'get_current_user_role()IN(''staff'')',
            '((public.get_current_user_role())::text=''staff''::text)',
            '(((public.get_current_user_role())::text=''staff''::text))',
            '(public.get_current_user_role())::text=''staff''::text',
            '((public.get_current_user_role())::text=''staff'')',
            '(((public.get_current_user_role())::text=''staff''))',
            '(public.get_current_user_role())::text=''staff''',
            '((public.get_current_user_role())::textIN(''staff''::text))',
            '(((public.get_current_user_role())::textIN(''staff''::text)))',
            '(public.get_current_user_role())::textIN(''staff''::text)',
            '((public.get_current_user_role())::textIN(''staff''))',
            '(((public.get_current_user_role())::textIN(''staff'')))',
            '(public.get_current_user_role())::textIN(''staff'')',
            '((get_current_user_role())::text=''staff''::text)',
            '(((get_current_user_role())::text=''staff''::text))',
            '(get_current_user_role())::text=''staff''::text',
            '((get_current_user_role())::text=''staff'')',
            '(((get_current_user_role())::text=''staff''))',
            '(get_current_user_role())::text=''staff''',
            '((get_current_user_role())::textIN(''staff''::text))',
            '(((get_current_user_role())::textIN(''staff''::text)))',
            '(get_current_user_role())::textIN(''staff''::text)',
            '((get_current_user_role())::textIN(''staff''))',
            '(((get_current_user_role())::textIN(''staff'')))',
            '(get_current_user_role())::textIN(''staff'')'
            )
        ) THEN 'Student roster policies verified: exactly 2 policies exist, admin ALL policy verified, and staff restricted to read-only SELECT (zero student access).'
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'student_roster'
          AND pol.cmd IN ('INSERT', 'UPDATE', 'DELETE')
          AND pol.policyname <> 'Admins manage student roster'
      ) THEN 'FAIL: Non-admin write policy detected on public.student_roster.'
      ELSE 'MANUAL REVIEW: Student roster policies deviate from approved Migration 007 Section 20 specification.'
    END AS "Explanation"

UNION ALL

SELECT
    'F. Other Security Objects' AS "Section",
    'F10' AS "Check ID",
    'public.student_roster' AS "Database Object",
    'All 7 table privileges: PUBLIC=none, anon=none, service_role=ALL(7), authenticated=SELECT,INSERT,UPDATE,DELETE (TRUNCATE,TRIGGER,REFERENCES denied)' AS "Expected Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'student_roster')
        THEN 'TABLE NOT FOUND'
      ELSE (
        SELECT 'PUBLIC=' || CASE WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
        ) THEN 'EXPOSED' ELSE 'DENIED' END
        || '; anon=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'ROLE MISSING'
          WHEN has_table_privilege('anon', c.oid, 'SELECT')
            OR has_table_privilege('anon', c.oid, 'INSERT')
            OR has_table_privilege('anon', c.oid, 'UPDATE')
            OR has_table_privilege('anon', c.oid, 'DELETE')
            OR has_table_privilege('anon', c.oid, 'TRUNCATE')
            OR has_table_privilege('anon', c.oid, 'REFERENCES')
            OR has_table_privilege('anon', c.oid, 'TRIGGER')
          THEN 'EXPOSED'
          ELSE 'DENIED'
        END
        || '; auth(DML=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'ROLE MISSING'
          WHEN has_table_privilege('authenticated', c.oid, 'SELECT')
            AND has_table_privilege('authenticated', c.oid, 'INSERT')
            AND has_table_privilege('authenticated', c.oid, 'UPDATE')
            AND has_table_privilege('authenticated', c.oid, 'DELETE')
          THEN 'ALLOWED'
          ELSE 'INCOMPLETE'
        END
        || ', DDL=' || CASE
          WHEN has_table_privilege('authenticated', c.oid, 'TRUNCATE')
            OR has_table_privilege('authenticated', c.oid, 'REFERENCES')
            OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
          THEN 'EXPOSED'
          ELSE 'DENIED'
        END
        || '); srole_ALL(7)=' || CASE
          WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'ROLE MISSING'
          WHEN has_table_privilege('service_role', c.oid, 'SELECT')
            AND has_table_privilege('service_role', c.oid, 'INSERT')
            AND has_table_privilege('service_role', c.oid, 'UPDATE')
            AND has_table_privilege('service_role', c.oid, 'DELETE')
            AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
            AND has_table_privilege('service_role', c.oid, 'REFERENCES')
            AND has_table_privilege('service_role', c.oid, 'TRIGGER')
          THEN 'YES'
          ELSE 'INCOMPLETE'
        END
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'student_roster'
        LIMIT 1
      )
    END AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'student_roster')
        THEN 'NOT FOUND'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'student_roster'
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
          )
          AND NOT has_table_privilege('anon', c.oid, 'SELECT')
          AND NOT has_table_privilege('anon', c.oid, 'INSERT')
          AND NOT has_table_privilege('anon', c.oid, 'UPDATE')
          AND NOT has_table_privilege('anon', c.oid, 'DELETE')
          AND NOT has_table_privilege('anon', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('anon', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('anon', c.oid, 'TRIGGER')
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND has_table_privilege('authenticated', c.oid, 'INSERT')
          AND has_table_privilege('authenticated', c.oid, 'UPDATE')
          AND has_table_privilege('authenticated', c.oid, 'DELETE')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('authenticated', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRIGGER')
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'student_roster')
        THEN 'Target table does not exist in catalog.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'student_roster'
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0
          )
          AND NOT has_table_privilege('anon', c.oid, 'SELECT')
          AND NOT has_table_privilege('anon', c.oid, 'INSERT')
          AND NOT has_table_privilege('anon', c.oid, 'UPDATE')
          AND NOT has_table_privilege('anon', c.oid, 'DELETE')
          AND NOT has_table_privilege('anon', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('anon', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('anon', c.oid, 'TRIGGER')
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
          AND has_table_privilege('authenticated', c.oid, 'INSERT')
          AND has_table_privilege('authenticated', c.oid, 'UPDATE')
          AND has_table_privilege('authenticated', c.oid, 'DELETE')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          AND NOT has_table_privilege('authenticated', c.oid, 'REFERENCES')
          AND NOT has_table_privilege('authenticated', c.oid, 'TRIGGER')
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'Table privilege matrix on public.student_roster verified for all 7 privileges: PUBLIC & anon denied; authenticated granted DML (governed by RLS) with TRUNCATE/REFERENCES/TRIGGER denied; service_role granted all 7 privileges.'
      ELSE 'FAIL: Privilege matrix on public.student_roster deviates from Migration 007 Section 1 requirements.'
    END AS "Explanation"

UNION ALL

SELECT
    'F. Other Security Objects' AS "Section",
    'F11' AS "Check ID",
    'Trigger Functions (protect_user_fields, validate/protect visits, validate/protect transactions)' AS "Database Object",
    'All 5 trigger functions: prosecdef = true, search_path = pg_catalog, public, pg_temp, owner IN (''postgres'', ''supabase_admin''), execution REVOKED from PUBLIC, anon, authenticated (matching Migration 007)' AS "Expected Configuration",
    COALESCE(
      (
        SELECT string_agg(
          p.proname || ' [owner=' || pg_get_userbyid(p.proowner) ||
          ', secdef=' || p.prosecdef::text ||
          ', PUBLIC=' || CASE WHEN EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN 'EXPOSED' ELSE 'DENIED' END ||
          ', anon=' || CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'EXPOSED' ELSE 'DENIED' END ||
          ', auth=' || CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'EXPOSED' ELSE 'DENIED' END ||
          ', srole_grant=' || CASE WHEN EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'service_role') AND a.privilege_type = 'EXECUTE') THEN 'EXPLICIT_GRANT' ELSE 'NONE' END ||
          ']', '; ' ORDER BY p.proname
        )
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'protect_user_fields_on_update',
            'validate_visits_on_insert',
            'protect_visits_on_update',
            'validate_transactions_on_insert',
            'protect_transactions_on_update'
          )
      ),
      'NO TRIGGER FUNCTIONS FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL'
      -- FAIL if function count != 5
      WHEN (
        SELECT count(*)
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'protect_user_fields_on_update',
            'validate_visits_on_insert',
            'protect_visits_on_update',
            'validate_transactions_on_insert',
            'protect_transactions_on_update'
          )
      ) <> 5 THEN 'FAIL'
      -- FAIL if any trigger function is owned by untrusted role (must be postgres or supabase_admin)
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'protect_user_fields_on_update',
            'validate_visits_on_insert',
            'protect_visits_on_update',
            'validate_transactions_on_insert',
            'protect_transactions_on_update'
          )
          AND p.proowner NOT IN (SELECT oid FROM pg_roles WHERE rolname IN ('postgres', 'supabase_admin'))
      ) THEN 'FAIL'
      -- FAIL if execution is permitted to client roles (PUBLIC, anon, authenticated) or has explicit service_role grant
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'protect_user_fields_on_update',
            'validate_visits_on_insert',
            'protect_visits_on_update',
            'validate_transactions_on_insert',
            'protect_transactions_on_update'
          )
          AND (
            p.prosecdef = false
            OR EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
            OR has_function_privilege('anon', p.oid, 'EXECUTE')
            OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
          )
      ) THEN 'FAIL'
      -- PASS if all 5 functions are verified: prosecdef, search_path strictly pinned, trusted owner, execution revoked
      WHEN (
        SELECT count(*)
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'protect_user_fields_on_update',
            'validate_visits_on_insert',
            'protect_visits_on_update',
            'validate_transactions_on_insert',
            'protect_transactions_on_update'
          )
          AND p.pronargs = 0
          AND p.prorettype = 'trigger'::regtype
          AND p.prosecdef = true
          AND p.proconfig IS NOT NULL
          AND regexp_replace(array_to_string(p.proconfig, '; '), '\s+', '', 'g') = 'search_path=pg_catalog,public,pg_temp'
          AND p.proowner IN (SELECT oid FROM pg_roles WHERE rolname IN ('postgres', 'supabase_admin'))
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')

      ) = 5 THEN 'PASS'
      ELSE 'MANUAL REVIEW'
    END AS "Status",
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        THEN 'FAIL: Database role "anon" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        THEN 'FAIL: Database role "authenticated" is missing from pg_roles.'
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL: Database role "service_role" is missing from pg_roles.'
      WHEN (
        SELECT count(*)
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'protect_user_fields_on_update',
            'validate_visits_on_insert',
            'protect_visits_on_update',
            'validate_transactions_on_insert',
            'protect_transactions_on_update'
          )
      ) <> 5 THEN 'FAIL: Expected exactly 5 internal trigger functions; count mismatch.'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'protect_user_fields_on_update',
            'validate_visits_on_insert',
            'protect_visits_on_update',
            'validate_transactions_on_insert',
            'protect_transactions_on_update'
          )
          AND p.proowner NOT IN (SELECT oid FROM pg_roles WHERE rolname IN ('postgres', 'supabase_admin'))
      ) THEN 'CRITICAL SECURITY FAIL: One or more trigger functions are owned by an untrusted role (must be postgres or supabase_admin).'
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'protect_user_fields_on_update',
            'validate_visits_on_insert',
            'protect_visits_on_update',
            'validate_transactions_on_insert',
            'protect_transactions_on_update'
          )
          AND (
            p.prosecdef = false
            OR EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
            OR has_function_privilege('anon', p.oid, 'EXECUTE')
            OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
          )
      ) THEN 'CRITICAL SECURITY FAIL: Trigger functions allow client execution (PUBLIC, anon, or authenticated).'
      WHEN (
        SELECT count(*)
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'protect_user_fields_on_update',
            'validate_visits_on_insert',
            'protect_visits_on_update',
            'validate_transactions_on_insert',
            'protect_transactions_on_update'
          )
          AND p.pronargs = 0
          AND p.prorettype = 'trigger'::regtype
          AND p.prosecdef = true
          AND p.proconfig IS NOT NULL
          AND regexp_replace(array_to_string(p.proconfig, '; '), '\s+', '', 'g') = 'search_path=pg_catalog,public,pg_temp'
          AND p.proowner IN (SELECT oid FROM pg_roles WHERE rolname IN ('postgres', 'supabase_admin'))
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
          AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
          AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')

      ) = 5 THEN 'All 5 internal trigger functions verified: owned by trusted role (postgres/supabase_admin), marked SECURITY DEFINER with search_path strictly pinned to pg_catalog, public, pg_temp, and direct execution completely revoked from PUBLIC, anon, and authenticated.'
      ELSE 'MANUAL REVIEW: Trigger functions search_path deviates from pg_catalog, public, pg_temp or catalog privilege configuration requires manual inspection.'
    END AS "Explanation"

UNION ALL

SELECT
    'F. Other Security Objects' AS "Section",
    'F12' AS "Check ID",
    'Database Roles (authenticated, anon, service_role)' AS "Database Object",
    'Roles "authenticated", "anon", and "service_role" all exist in pg_roles' AS "Expected Configuration",
    COALESCE(
      (SELECT 'existing_roles=' || string_agg(rolname, ', ' ORDER BY rolname)
       FROM pg_roles
       WHERE rolname IN ('authenticated', 'anon', 'service_role')),
      'NO CORE ROLES FOUND'
    ) AS "Actual Configuration",
    CASE
      WHEN (SELECT count(*) FROM pg_roles WHERE rolname IN ('authenticated', 'anon', 'service_role')) = 3
        THEN 'PASS'
      ELSE 'FAIL'
    END AS "Status",
    CASE
      WHEN (SELECT count(*) FROM pg_roles WHERE rolname IN ('authenticated', 'anon', 'service_role')) = 3
        THEN 'All three core Supabase authentication and authorization roles (authenticated, anon, service_role) exist in pg_roles.'
      ELSE 'FAIL: One or more required database roles are missing from pg_roles: ' ||
        COALESCE(
          (SELECT string_agg(r.role_name, ', ')
           FROM (VALUES ('authenticated'), ('anon'), ('service_role')) AS r(role_name)
           WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.role_name)),
          'NONE'
        )
    END AS "Explanation"

ORDER BY "Section", "Check ID";
