-- ==============================================================================
-- POST-MIGRATION 007 AUDIT & VERIFICATION SUITE (STRICTLY READ-ONLY)
-- Purpose: Exhaustive verification of functions, views, policies, ACLs, and RLS.
-- Strictly SELECT queries against PostgreSQL system catalogs.
-- ZERO DDL, DML, GRANT, REVOKE, OR DATA-MODIFYING RPC CALLS.
-- Compatible with Supabase SQL Editor / PostgreSQL 14+
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PART 1: MASTER VERIFICATION CHECKLIST (PASS / FAIL / MANUAL REVIEW DASHBOARD)
-- ------------------------------------------------------------------------------
WITH function_catalog AS (
  SELECT
    p.oid,
    p.proname,
    p.pronargs,
    oidvectortypes(p.proargtypes) AS arg_types,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    p.prosecdef,
    p.proconfig,
    -- ACL check for PUBLIC: Strictly grantee = 0 in aclexplode (PostgreSQL PUBLIC pseudo-role)
    EXISTS (
      SELECT 1
      FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    ) AS public_has_execute,
    -- Effective role checks: authenticated, anon, and service_role checked separately
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
      THEN has_function_privilege('authenticated', p.oid, 'EXECUTE')
      ELSE false
    END AS auth_has_execute,
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
      THEN has_function_privilege('anon', p.oid, 'EXECUTE')
      ELSE false
    END AS anon_has_execute,
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
      THEN has_function_privilege('service_role', p.oid, 'EXECUTE')
      ELSE false
    END AS srole_has_execute
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),
view_catalog AS (
  SELECT
    c.oid,
    c.relname,
    c.reloptions,
    ('security_barrier=true' = ANY(c.reloptions)) AS is_security_barrier,
    pg_get_viewdef(c.oid, true) AS view_def
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'v'
),
checklist AS (
  -- 1. get_my_profile exact signature (0 arguments)
  SELECT
    1 AS check_id,
    'RPC Signature' AS category,
    'public.get_my_profile()' AS target_object,
    'Exact 0 arguments: ()' AS expected_rule,
    COALESCE(
      (SELECT 'Signature: (' || identity_args || ')'
       FROM function_catalog
       WHERE proname = 'get_my_profile' AND pronargs = 0 AND identity_args = ''
       LIMIT 1),
      (SELECT 'Non-zero signature: (' || identity_args || ')'
       FROM function_catalog
       WHERE proname = 'get_my_profile'
       LIMIT 1),
      'MISSING'
    ) AS live_state,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'get_my_profile' AND pronargs = 0 AND identity_args = ''
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'get_my_profile'
      ) THEN 'MANUAL REVIEW'
      ELSE 'FAIL'
    END AS status

  UNION ALL

  -- 2. get_my_profile overload check (no overloads with args > 0)
  SELECT
    2,
    'RPC Overload Guard',
    'public.get_my_profile()',
    'No overloaded variants exist (exact 1 zero-arg definition)',
    COALESCE(
      (SELECT 'Overloads: ' || string_agg(proname || '(' || identity_args || ')', '; ')
       FROM function_catalog
       WHERE proname = 'get_my_profile' AND (pronargs > 0 OR identity_args <> '')),
      'Zero unexpected overloads'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'get_my_profile' AND (pronargs > 0 OR identity_args <> '')
      ) THEN 'FAIL (Overload detected)'
      WHEN NOT EXISTS (
        SELECT 1 FROM function_catalog WHERE proname = 'get_my_profile'
      ) THEN 'FAIL (Function missing)'
      ELSE 'PASS'
    END

  UNION ALL

  -- 3. get_my_profile SECURITY DEFINER & pinned search_path
  SELECT
    3,
    'RPC Hardening',
    'public.get_my_profile()',
    'SECURITY DEFINER & search_path = pg_catalog, public, pg_temp',
    COALESCE(
      (SELECT 'secdef=' || prosecdef || ', config=' || COALESCE(array_to_string(proconfig, '; '), 'NONE')
       FROM function_catalog
       WHERE proname = 'get_my_profile' AND pronargs = 0 AND identity_args = ''
       LIMIT 1),
      'MISSING'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'get_my_profile' AND pronargs = 0 AND identity_args = ''
          AND prosecdef = true
          AND 'search_path=pg_catalog, public, pg_temp' = ANY(proconfig)
      ) THEN 'PASS'
      ELSE 'FAIL'
    END

  UNION ALL

  -- 4. get_my_profile permissions: PUBLIC=DENIED, anon=DENIED, service_role=DENIED, authenticated=ALLOWED
  SELECT
    4,
    'RPC Privileges',
    'public.get_my_profile()',
    'PUBLIC=NO; anon=NO; service_role=NO; authenticated=YES',
    COALESCE(
      (SELECT 'PUBLIC=' || (CASE WHEN public_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
              || ', anon=' || (CASE WHEN anon_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
              || ', service_role=' || (CASE WHEN srole_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
              || ', authenticated=' || (CASE WHEN auth_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
       FROM function_catalog
       WHERE proname = 'get_my_profile' AND pronargs = 0 AND identity_args = ''
       LIMIT 1),
      'MISSING'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'get_my_profile' AND pronargs = 0 AND identity_args = ''
          AND public_has_execute = false
          AND anon_has_execute = false
          AND srole_has_execute = false
          AND auth_has_execute = true
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'get_my_profile' AND pronargs = 0 AND identity_args = ''
          AND (public_has_execute = true OR anon_has_execute = true OR srole_has_execute = true)
      ) THEN 'FAIL (Insecure EXECUTE privilege granted to PUBLIC, anon, or service_role)'
      WHEN NOT EXISTS (
        SELECT 1 FROM function_catalog WHERE proname = 'get_my_profile'
      ) THEN 'FAIL (Function missing)'
      ELSE 'FAIL (Missing authenticated EXECUTE privilege)'
    END

  UNION ALL

  -- 5. issue_components_atomic exact signature verification from Migration 007
  SELECT
    5,
    'Atomic Inventory RPC',
    'public.issue_components_atomic(...)',
    'Exact 9 args: text, text, text, text, text, timestamptz, text, jsonb, text',
    COALESCE(
      (SELECT 'Exact types: (' || arg_types || ')'
       FROM function_catalog
       WHERE proname = 'issue_components_atomic'
         AND pronargs = 9
         AND (
           arg_types = 'text, text, text, text, text, timestamp with time zone, text, jsonb, text'
           OR arg_types = 'text, text, text, text, text, timestamptz, text, jsonb, text'
         )
       LIMIT 1),
      (SELECT 'Unexpected types: (' || arg_types || ')'
       FROM function_catalog
       WHERE proname = 'issue_components_atomic'
       LIMIT 1),
      'MISSING'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'issue_components_atomic'
          AND pronargs = 9
          AND (
            arg_types = 'text, text, text, text, text, timestamp with time zone, text, jsonb, text'
            OR arg_types = 'text, text, text, text, text, timestamptz, text, jsonb, text'
          )
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'issue_components_atomic'
      ) THEN 'MANUAL REVIEW'
      ELSE 'FAIL'
    END

  UNION ALL

  -- 6. issue_components_atomic overload guard
  SELECT
    6,
    'RPC Overload Guard',
    'public.issue_components_atomic(...)',
    'No unexpected overloads',
    COALESCE(
      (SELECT 'Overloads: ' || string_agg(proname || '(' || identity_args || ')', '; ')
       FROM function_catalog
       WHERE proname = 'issue_components_atomic'
         AND NOT (
           pronargs = 9
           AND (
             arg_types = 'text, text, text, text, text, timestamp with time zone, text, jsonb, text'
             OR arg_types = 'text, text, text, text, text, timestamptz, text, jsonb, text'
           )
         )),
      'Zero unexpected overloads'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'issue_components_atomic'
          AND NOT (
            pronargs = 9
            AND (
              arg_types = 'text, text, text, text, text, timestamp with time zone, text, jsonb, text'
              OR arg_types = 'text, text, text, text, text, timestamptz, text, jsonb, text'
            )
          )
      ) THEN 'MANUAL REVIEW'
      WHEN NOT EXISTS (
        SELECT 1 FROM function_catalog WHERE proname = 'issue_components_atomic'
      ) THEN 'FAIL (Function missing)'
      ELSE 'PASS'
    END

  UNION ALL

  -- 7. issue_components_atomic hardening & permissions
  SELECT
    7,
    'Atomic Inventory RPC',
    'public.issue_components_atomic(...)',
    'secdef=true, search_path pinned, PUBLIC/anon/srole=DENIED, auth=ALLOWED',
    COALESCE(
      (SELECT 'secdef=' || prosecdef
              || ', PUBLIC=' || (CASE WHEN public_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
              || ', anon=' || (CASE WHEN anon_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
              || ', srole=' || (CASE WHEN srole_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
              || ', auth=' || (CASE WHEN auth_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
       FROM function_catalog
       WHERE proname = 'issue_components_atomic'
         AND pronargs = 9
         AND (
           arg_types = 'text, text, text, text, text, timestamp with time zone, text, jsonb, text'
           OR arg_types = 'text, text, text, text, text, timestamptz, text, jsonb, text'
         )
       LIMIT 1),
      'MISSING'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'issue_components_atomic'
          AND pronargs = 9
          AND (
            arg_types = 'text, text, text, text, text, timestamp with time zone, text, jsonb, text'
            OR arg_types = 'text, text, text, text, text, timestamptz, text, jsonb, text'
          )
          AND prosecdef = true
          AND 'search_path=pg_catalog, public, pg_temp' = ANY(proconfig)
          AND public_has_execute = false
          AND anon_has_execute = false
          AND srole_has_execute = false
          AND auth_has_execute = true
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'issue_components_atomic'
          AND (public_has_execute = true OR anon_has_execute = true OR srole_has_execute = true)
      ) THEN 'FAIL (Insecure EXECUTE privilege granted to PUBLIC, anon, or service_role)'
      WHEN EXISTS (
        SELECT 1 FROM function_catalog WHERE proname = 'issue_components_atomic'
      ) THEN 'MANUAL REVIEW (Hardening or search_path mismatch)'
      ELSE 'FAIL (Function missing)'
    END

  UNION ALL

  -- 8. return_components_atomic exact signature verification from Migration 007
  SELECT
    8,
    'Atomic Inventory RPC',
    'public.return_components_atomic(...)',
    'Exact 3 args: text, jsonb, text',
    COALESCE(
      (SELECT 'Exact types: (' || arg_types || ')'
       FROM function_catalog
       WHERE proname = 'return_components_atomic' AND pronargs = 3 AND arg_types = 'text, jsonb, text'
       LIMIT 1),
      (SELECT 'Unexpected types: (' || arg_types || ')'
       FROM function_catalog
       WHERE proname = 'return_components_atomic'
       LIMIT 1),
      'MISSING'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'return_components_atomic' AND pronargs = 3 AND arg_types = 'text, jsonb, text'
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'return_components_atomic'
      ) THEN 'MANUAL REVIEW'
      ELSE 'FAIL'
    END

  UNION ALL

  -- 9. return_components_atomic overload guard
  SELECT
    9,
    'RPC Overload Guard',
    'public.return_components_atomic(...)',
    'No unexpected overloads',
    COALESCE(
      (SELECT 'Overloads: ' || string_agg(proname || '(' || identity_args || ')', '; ')
       FROM function_catalog
       WHERE proname = 'return_components_atomic' AND NOT (pronargs = 3 AND arg_types = 'text, jsonb, text')),
      'Zero unexpected overloads'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'return_components_atomic' AND NOT (pronargs = 3 AND arg_types = 'text, jsonb, text')
      ) THEN 'MANUAL REVIEW'
      WHEN NOT EXISTS (
        SELECT 1 FROM function_catalog WHERE proname = 'return_components_atomic'
      ) THEN 'FAIL (Function missing)'
      ELSE 'PASS'
    END

  UNION ALL

  -- 10. return_components_atomic hardening & permissions
  SELECT
    10,
    'Atomic Inventory RPC',
    'public.return_components_atomic(...)',
    'secdef=true, search_path pinned, PUBLIC/anon/srole=DENIED, auth=ALLOWED',
    COALESCE(
      (SELECT 'secdef=' || prosecdef
              || ', PUBLIC=' || (CASE WHEN public_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
              || ', anon=' || (CASE WHEN anon_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
              || ', srole=' || (CASE WHEN srole_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
              || ', auth=' || (CASE WHEN auth_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
       FROM function_catalog
       WHERE proname = 'return_components_atomic' AND pronargs = 3 AND arg_types = 'text, jsonb, text'
       LIMIT 1),
      'MISSING'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'return_components_atomic' AND pronargs = 3 AND arg_types = 'text, jsonb, text'
          AND prosecdef = true
          AND 'search_path=pg_catalog, public, pg_temp' = ANY(proconfig)
          AND public_has_execute = false
          AND anon_has_execute = false
          AND srole_has_execute = false
          AND auth_has_execute = true
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'return_components_atomic'
          AND (public_has_execute = true OR anon_has_execute = true OR srole_has_execute = true)
      ) THEN 'FAIL (Insecure EXECUTE privilege granted to PUBLIC, anon, or service_role)'
      WHEN EXISTS (
        SELECT 1 FROM function_catalog WHERE proname = 'return_components_atomic'
      ) THEN 'MANUAL REVIEW (Hardening or search_path mismatch)'
      ELSE 'FAIL (Function missing)'
    END

  UNION ALL

  -- 11. staff_student_directory view definition & security barrier
  SELECT
    11,
    'Restricted View',
    'public.staff_student_directory',
    'security_barrier=true & filters exclusively WHERE u.role = ''student''',
    COALESCE(
      (SELECT 'barrier=' || is_security_barrier || ', student_filtered=' || (view_def ILIKE '%role = ''student''%')
       FROM view_catalog
       WHERE relname = 'staff_student_directory'
       LIMIT 1),
      'MISSING'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM view_catalog
        WHERE relname = 'staff_student_directory'
          AND is_security_barrier = true
          AND view_def ILIKE '%role = ''student''%'
      ) THEN 'PASS'
      ELSE 'FAIL'
    END

  UNION ALL

  -- 12. staff_student_directory column whitelist audit
  SELECT
    12,
    'View Column Projection',
    'public.staff_student_directory',
    'Exact 13 approved columns exist, exactly 13 total columns, ZERO forbidden/unexpected columns',
    COALESCE(
      (SELECT 'Forbidden: ' || string_agg(column_name, ', ')
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'staff_student_directory'
         AND column_name IN (
           'password_hash', 'fingerprint_ids', 'finger_labels', 'membership_status',
           'auth_id', 'incubation_start_date', 'academic_year_at_start',
           'retention_period_years', 'retention_end_date', 'id_card_scanned_at',
           'id_card_validity_year'
         )),
      (SELECT 'Unexpected: ' || string_agg(column_name, ', ')
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'staff_student_directory'
         AND column_name NOT IN (
           'id', 'roll_number', 'name', 'department', 'branch', 'section',
           'academic_year', 'mobile_number', 'face_registered', 'face_photo_url',
           'is_active', 'created_at', 'updated_at'
         )),
      (SELECT 'Columns: ' || count(*) || ' total, approved: ' || count(*) FILTER (WHERE column_name IN (
           'id', 'roll_number', 'name', 'department', 'branch', 'section',
           'academic_year', 'mobile_number', 'face_registered', 'face_photo_url',
           'is_active', 'created_at', 'updated_at'
         ))
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'staff_student_directory'),
      'MISSING'
    ) AS live_state,
    CASE
      -- View does not exist
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = 'staff_student_directory'
      ) THEN 'FAIL (View missing)'

      -- 1. Flag ANY forbidden column
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff_student_directory'
          AND column_name IN (
            'password_hash', 'fingerprint_ids', 'finger_labels', 'membership_status',
            'auth_id', 'incubation_start_date', 'academic_year_at_start',
            'retention_period_years', 'retention_end_date', 'id_card_scanned_at',
            'id_card_validity_year'
          )
      ) THEN 'FAIL (Forbidden sensitive column exposed)'

      -- 2. Flag ANY unexpected column outside the approved 13 whitelist
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff_student_directory'
          AND column_name NOT IN (
            'id', 'roll_number', 'name', 'department', 'branch', 'section',
            'academic_year', 'mobile_number', 'face_registered', 'face_photo_url',
            'is_active', 'created_at', 'updated_at'
          )
      ) THEN 'FAIL (Unexpected column outside approved whitelist)'

      -- 3. PASS ONLY IF all 13 approved columns exist AND total column count is exactly 13
      WHEN (
        SELECT count(*)
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff_student_directory'
          AND column_name IN (
            'id', 'roll_number', 'name', 'department', 'branch', 'section',
            'academic_year', 'mobile_number', 'face_registered', 'face_photo_url',
            'is_active', 'created_at', 'updated_at'
          )
      ) = 13
      AND (
        SELECT count(*)
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff_student_directory'
      ) = 13
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff_student_directory'
          AND column_name NOT IN (
            'id', 'roll_number', 'name', 'department', 'branch', 'section',
            'academic_year', 'mobile_number', 'face_registered', 'face_photo_url',
            'is_active', 'created_at', 'updated_at'
          )
      ) THEN 'PASS'

      -- 4. Incomplete column set or count mismatch
      ELSE 'MANUAL REVIEW (Incomplete column set or count mismatch)'
    END AS status

  UNION ALL

  -- 13. public.users deep SELECT policy isolation
  SELECT
    13,
    'RLS Users Isolation',
    'public.users',
    'Zero policies permit direct staff SELECT (evaluated via cmd, roles, qual, with_check)',
    COALESCE(
      (SELECT 'Insecure policy found: ' || string_agg(policyname || ' [cmd=' || cmd || ', qual=' || COALESCE(qual, 'NULL') || ']', '; ')
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'users'
         AND cmd IN ('SELECT', 'ALL')
         AND (
           qual IS NULL
           OR qual = 'true'
           OR qual ILIKE '%staff%'
           OR with_check ILIKE '%staff%'
           OR roles::text ILIKE '%staff%'
           OR NOT (
             (cmd = 'ALL' AND qual ILIKE '%get_current_user_role()%' AND qual ILIKE '%admin%' AND (with_check IS NULL OR with_check ILIKE '%admin%'))
             OR (cmd = 'SELECT' AND qual ILIKE '%role = ''student''%' AND (qual ILIKE '%auth.uid()%' OR qual ILIKE '%get_current_student_roll()%'))
           )
         )),
      'Zero insecure staff policies'
    ) AS live_state,
    CASE
      -- Explicit staff leak or unconditional true/null
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'users'
          AND cmd IN ('SELECT', 'ALL')
          AND (
            qual IS NULL
            OR qual = 'true'
            OR qual ILIKE '%staff%'
            OR with_check ILIKE '%staff%'
            OR roles::text ILIKE '%staff%'
          )
      ) THEN 'FAIL (Permits direct staff access)'

      -- Unclassified policy that cannot be verified as legitimate admin or student logic
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'users'
          AND cmd IN ('SELECT', 'ALL')
          AND NOT (
            (cmd = 'ALL' AND qual ILIKE '%get_current_user_role()%' AND qual ILIKE '%admin%' AND (with_check IS NULL OR with_check ILIKE '%admin%'))
            OR (cmd = 'SELECT' AND qual ILIKE '%role = ''student''%' AND (qual ILIKE '%auth.uid()%' OR qual ILIKE '%get_current_student_roll()%'))
          )
      ) THEN 'MANUAL REVIEW (Unclassified user policy logic)'

      -- Both verified legitimate policies exist
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'users'
          AND cmd = 'ALL' AND qual ILIKE '%get_current_user_role()%' AND qual ILIKE '%admin%'
      ) AND EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'users'
          AND cmd = 'SELECT' AND qual ILIKE '%role = ''student''%' AND (qual ILIKE '%auth.uid()%' OR qual ILIKE '%get_current_student_roll()%')
      ) THEN 'PASS'

      ELSE 'FAIL (Missing expected security policies)'
    END AS status

  UNION ALL

  -- 14. public.transactions deep write policy isolation
  -- Evaluated strictly according to PostgreSQL command semantics:
  -- INSERT: evaluate WITH CHECK (qual is naturally NULL)
  -- DELETE: evaluate USING (with_check is naturally NULL)
  -- UPDATE & ALL: evaluate USING and COALESCE(with_check, qual) (accounting for PostgreSQL default behavior)
  SELECT
    14,
    'RLS Transactions Write',
    'public.transactions',
    'Zero direct staff write policies; Admin writes strictly enforce admin role (INSERT: WITH CHECK; DELETE: USING; UPDATE/ALL: both)',
    COALESCE(
      (SELECT 'Insecure write policy found: ' || string_agg(policyname || ' [cmd=' || cmd || ', qual=' || COALESCE(qual, 'NULL') || ', with_check=' || COALESCE(with_check, 'NULL') || ']', '; ')
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'transactions'
         AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
         AND (
           roles::text ILIKE '%staff%'
           OR (
             cmd = 'INSERT' AND (
               with_check IS NULL OR with_check = 'true' OR with_check ILIKE '%staff%'
             )
           )
           OR (
             cmd = 'DELETE' AND (
               qual IS NULL OR qual = 'true' OR qual ILIKE '%staff%'
             )
           )
           OR (
             cmd IN ('UPDATE', 'ALL') AND (
               qual IS NULL OR qual = 'true' OR qual ILIKE '%staff%'
               OR COALESCE(with_check, qual) = 'true'
               OR COALESCE(with_check, qual) ILIKE '%staff%'
             )
           )
         )),
      (SELECT 'Unclassified write policy (needs review): ' || string_agg(policyname || ' [cmd=' || cmd || ']', '; ')
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'transactions'
         AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
         AND NOT (
           (cmd = 'INSERT' AND with_check ILIKE '%get_current_user_role()%' AND with_check ILIKE '%admin%')
           OR (cmd = 'DELETE' AND qual ILIKE '%get_current_user_role()%' AND qual ILIKE '%admin%')
           OR (cmd IN ('UPDATE', 'ALL')
               AND qual ILIKE '%get_current_user_role()%' AND qual ILIKE '%admin%'
               AND COALESCE(with_check, qual) ILIKE '%get_current_user_role()%' AND COALESCE(with_check, qual) ILIKE '%admin%')
         )),
      'Zero staff write policies (Admins only)'
    ) AS live_state,
    CASE
      -- 1. Definite FAIL: Staff write permitted or unconditional true/null
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'transactions'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
          AND (
            roles::text ILIKE '%staff%'
            OR (
              cmd = 'INSERT' AND (
                with_check IS NULL OR with_check = 'true' OR with_check ILIKE '%staff%'
              )
            )
            OR (
              cmd = 'DELETE' AND (
                qual IS NULL OR qual = 'true' OR qual ILIKE '%staff%'
              )
            )
            OR (
              cmd IN ('UPDATE', 'ALL') AND (
                qual IS NULL OR qual = 'true' OR qual ILIKE '%staff%'
                OR COALESCE(with_check, qual) = 'true'
                OR COALESCE(with_check, qual) ILIKE '%staff%'
              )
            )
          )
      ) THEN 'FAIL (Direct staff write permitted or unconditional write clause)'

      -- 2. MANUAL REVIEW: Write policy exists but does not match standard verified admin check
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'transactions'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
          AND NOT (
            (cmd = 'INSERT' AND with_check ILIKE '%get_current_user_role()%' AND with_check ILIKE '%admin%')
            OR (cmd = 'DELETE' AND qual ILIKE '%get_current_user_role()%' AND qual ILIKE '%admin%')
            OR (cmd IN ('UPDATE', 'ALL')
                AND qual ILIKE '%get_current_user_role()%' AND qual ILIKE '%admin%'
                AND COALESCE(with_check, qual) ILIKE '%get_current_user_role()%' AND COALESCE(with_check, qual) ILIKE '%admin%')
          )
      ) THEN 'MANUAL REVIEW (Unclassified write policy on transactions)'

      -- 3. PASS: Verified admin write policy exists, no staff writes, no unclassified writes
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'transactions'
          AND (
            (cmd = 'ALL' AND qual ILIKE '%get_current_user_role()%' AND qual ILIKE '%admin%'
                         AND COALESCE(with_check, qual) ILIKE '%get_current_user_role()%' AND COALESCE(with_check, qual) ILIKE '%admin%')
            OR (cmd = 'INSERT' AND with_check ILIKE '%get_current_user_role()%' AND with_check ILIKE '%admin%')
          )
      ) THEN 'PASS'

      ELSE 'FAIL (Missing admin write policy on transactions)'
    END AS status

  UNION ALL

  -- 15. processed_rpc_operations existence, RLS, table privileges & admin-only policy isolation
  -- Evaluated strictly according to PostgreSQL command semantics and catalog privilege inspection:
  -- - Database roles: authenticated, anon, and service_role must all exist in pg_roles
  -- - Table exists, relkind = 'r', relrowsecurity = true, relforcerowsecurity = true
  -- - Table privileges across all 7 PostgreSQL privileges:
  --     PUBLIC: NONE (0 privileges in aclexplode grantee=0)
  --     anon: NONE (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER: false)
  --     authenticated: SELECT ONLY (INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER: false)
  --     service_role: ALL 7 (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER: true)
  -- - RLS policies: exactly 1 client policy on ledger:
  --     policyname = 'Admins view processed rpc operations'
  --     cmd = 'SELECT'
  --     roles = '{authenticated}' (exact single-role array, zero additional roles)
  --     USING = public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir')
  --     Logically safe normalized comparison against Migration 007 definition (rejects OR injections and extra roles)
  --     staff, student, kiosk, and unauthorized roles absent
  SELECT
    15,
    'Idempotency Ledger',
    'public.processed_rpc_operations',
    'Table exists, relkind=r, RLS=true, FORCE=true; Roles: auth/anon/srole exist; Privileges: auth=SELECT only, anon/PUBLIC=NONE, srole=ALL 7; Policies: exact 1 policy (cmd=SELECT, roles={authenticated}, admin role restriction enforced, staff absent)',
    COALESCE(
      -- Case 1: Missing expected PostgreSQL roles
      (
        SELECT 'Missing database roles: ' || array_to_string(ARRAY[
          CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN 'authenticated' END,
          CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'anon' END,
          CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN 'service_role' END
        ], ', ')
        WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
           OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
           OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        LIMIT 1
      ),

      -- Case 2: Table missing
      (
        SELECT 'Table missing (public.processed_rpc_operations does not exist in pg_class)'
        WHERE NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND c.relkind = 'r'
        )
        LIMIT 1
      ),

      -- Case 3: Insecure RLS status (RLS or FORCE RLS disabled)
      (
        SELECT 'Insecure RLS status: rls=' || c.relrowsecurity::text || ', force=' || c.relforcerowsecurity::text
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND c.relkind = 'r'
          AND (c.relrowsecurity = false OR c.relforcerowsecurity = false)
        LIMIT 1
      ),

      -- Case 4: Insecure table privileges found
      (
        SELECT 'Insecure table privileges: ' || array_to_string(ARRAY[
          CASE WHEN EXISTS (
            SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
            WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND a.grantee = 0
          ) THEN 'PUBLIC granted privileges' END,
          CASE WHEN EXISTS (
            SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
              AND (
                has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT')
                OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE')
                OR has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('anon', c.oid, 'REFERENCES')
                OR has_table_privilege('anon', c.oid, 'TRIGGER')
              )
          ) THEN 'anon granted privileges' END,
          CASE WHEN EXISTS (
            SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
              AND (
                has_table_privilege('authenticated', c.oid, 'INSERT')
                OR has_table_privilege('authenticated', c.oid, 'UPDATE')
                OR has_table_privilege('authenticated', c.oid, 'DELETE')
                OR has_table_privilege('authenticated', c.oid, 'TRUNCATE')
                OR has_table_privilege('authenticated', c.oid, 'REFERENCES')
                OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
              )
          ) THEN 'authenticated granted unauthorized DML/admin privileges' END,
          CASE WHEN EXISTS (
            SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
              AND NOT has_table_privilege('authenticated', c.oid, 'SELECT')
          ) THEN 'authenticated lacks SELECT' END,
          CASE WHEN EXISTS (
            SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
              AND NOT (
                has_table_privilege('service_role', c.oid, 'SELECT')
                AND has_table_privilege('service_role', c.oid, 'INSERT')
                AND has_table_privilege('service_role', c.oid, 'UPDATE')
                AND has_table_privilege('service_role', c.oid, 'DELETE')
                AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
                AND has_table_privilege('service_role', c.oid, 'REFERENCES')
                AND has_table_privilege('service_role', c.oid, 'TRIGGER')
              )
          ) THEN 'service_role lacks expected privileges' END
        ], '; ')
        WHERE EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
            AND (
              EXISTS (
                SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
                WHERE a.grantee = 0
              )
              OR has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT')
              OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE')
              OR has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('anon', c.oid, 'REFERENCES')
              OR has_table_privilege('anon', c.oid, 'TRIGGER')
              OR has_table_privilege('authenticated', c.oid, 'INSERT')
              OR has_table_privilege('authenticated', c.oid, 'UPDATE')
              OR has_table_privilege('authenticated', c.oid, 'DELETE')
              OR has_table_privilege('authenticated', c.oid, 'TRUNCATE')
              OR has_table_privilege('authenticated', c.oid, 'REFERENCES')
              OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
              OR NOT has_table_privilege('authenticated', c.oid, 'SELECT')
              OR NOT (
                has_table_privilege('service_role', c.oid, 'SELECT')
                AND has_table_privilege('service_role', c.oid, 'INSERT')
                AND has_table_privilege('service_role', c.oid, 'UPDATE')
                AND has_table_privilege('service_role', c.oid, 'DELETE')
                AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
                AND has_table_privilege('service_role', c.oid, 'REFERENCES')
                AND has_table_privilege('service_role', c.oid, 'TRIGGER')
              )
            )
        )
        LIMIT 1
      ),

      -- Case 5: Insecure policy found (command-aware staff check, unrestricted true/null, or unapproved db roles)
      (
        SELECT 'Insecure policy found: ' || string_agg(
          policyname || ' [cmd=' || cmd || ', roles=' || roles::text || ', qual=' || COALESCE(qual, 'NULL') || ', with_check=' || COALESCE(with_check, 'NULL') || ']',
          '; '
        )
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations'
          AND (
            roles::text <> '{authenticated}'
            OR 'anon' = ANY(roles) OR 'public' = ANY(roles) OR 'staff' = ANY(roles)
            OR (cmd = 'INSERT' AND (with_check ILIKE '%staff%' OR with_check = 'true' OR with_check IS NULL))
            OR (cmd = 'DELETE' AND (qual ILIKE '%staff%' OR qual = 'true' OR qual IS NULL))
            OR (cmd IN ('UPDATE', 'ALL') AND (
                 qual ILIKE '%staff%' OR COALESCE(with_check, qual) ILIKE '%staff%'
                 OR qual = 'true' OR qual IS NULL
                 OR COALESCE(with_check, qual) = 'true' OR COALESCE(with_check, qual) IS NULL
               ))
            OR (cmd = 'SELECT' AND (qual ILIKE '%staff%' OR qual = 'true' OR qual IS NULL))
          )
      ),

      -- Case 6: Direct client DML policy present on ledger (INSERT, UPDATE, DELETE, ALL)
      (
        SELECT 'Direct client DML policy present: ' || string_agg(policyname || ' [cmd=' || cmd || ']', '; ')
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      ),

      -- Case 7: Multiple policies found on ledger (unexpected policy count)
      (
        SELECT 'Multiple policies found on ledger (' || count(*) || ' total): ' || string_agg(policyname || ' [cmd=' || cmd || ']', '; ')
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations'
        HAVING count(*) > 1
      ),

      -- Case 8: Unverified policy logic (not matching expected admin policy name or normalized admin expression)
      (
        SELECT 'Policy logic cannot be proven as exact admin-only restriction: "' || policyname || '" [qual=' || COALESCE(qual, 'NULL') || ']'
        FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'processed_rpc_operations'
          AND NOT (
            pol.policyname = 'Admins view processed rpc operations'
            AND pol.cmd = 'SELECT'
            AND pol.roles = '{authenticated}'
            AND regexp_replace(lower(pol.qual), '\s+', '', 'g') IN (
              '(public.get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text]))',
              '((public.get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])))',
              'public.get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])',
              '(get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text]))',
              '((get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])))',
              'get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])',
              '(public.get_current_user_role()in(''admin'',''substitute_admin'',''sir''))',
              '((public.get_current_user_role()in(''admin'',''substitute_admin'',''sir'')))',
              'public.get_current_user_role()in(''admin'',''substitute_admin'',''sir'')',
              '(get_current_user_role()in(''admin'',''substitute_admin'',''sir''))',
              '((get_current_user_role()in(''admin'',''substitute_admin'',''sir'')))',
              'get_current_user_role()in(''admin'',''substitute_admin'',''sir'')',
              '(public.get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir'']))',
              '((public.get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])))',
              'public.get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])',
              '(get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir'']))',
              '((get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])))',
              'get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])'
            )
          )
        LIMIT 1
      ),

      -- Case 9: Zero policies on ledger (table unprotected)
      (
        SELECT 'Zero policies on ledger (table unprotected)'
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND c.relkind = 'r'
          AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations') = 0
        LIMIT 1
      ),

      -- Case 10: Verified legitimate single-policy state
      (
        SELECT
          'Exists (rls=' || c.relrowsecurity
          || ', force=' || c.relforcerowsecurity
          || '), privs=OK (auth:SELECT only, anon/pub:NONE, srole:ALL 7)'
          || ', policy="' || pol.policyname || '" (cmd=' || pol.cmd || ', roles=' || pol.roles::text || ', verified admin restriction)'
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_policies pol ON pol.schemaname = 'public' AND pol.tablename = 'processed_rpc_operations'
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND c.relkind = 'r'
          AND c.relrowsecurity = true
          AND c.relforcerowsecurity = true
          AND pol.policyname = 'Admins view processed rpc operations'
          AND pol.cmd = 'SELECT'
          AND pol.roles = '{authenticated}'
          AND regexp_replace(lower(pol.qual), '\s+', '', 'g') IN (
              '(public.get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text]))',
              '((public.get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])))',
              'public.get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])',
              '(get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text]))',
              '((get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])))',
              'get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])',
              '(public.get_current_user_role()in(''admin'',''substitute_admin'',''sir''))',
              '((public.get_current_user_role()in(''admin'',''substitute_admin'',''sir'')))',
              'public.get_current_user_role()in(''admin'',''substitute_admin'',''sir'')',
              '(get_current_user_role()in(''admin'',''substitute_admin'',''sir''))',
              '((get_current_user_role()in(''admin'',''substitute_admin'',''sir'')))',
              'get_current_user_role()in(''admin'',''substitute_admin'',''sir'')',
              '(public.get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir'']))',
              '((public.get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])))',
              'public.get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])',
              '(get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir'']))',
              '((get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])))',
              'get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])'
          )
          AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations') = 1
        LIMIT 1
      ),

      -- Case 11: Fallback
      'MISSING'
    ) AS live_state,
    CASE
      -- 1. Expected PostgreSQL database roles missing
      WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        THEN 'FAIL (Expected database role missing from pg_roles: authenticated, anon, or service_role)'

      -- 2. Table missing
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND c.relkind = 'r'
      ) THEN 'FAIL (Table missing)'

      -- 3. RLS or FORCE RLS disabled
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
          AND c.relrowsecurity = true
          AND c.relforcerowsecurity = true
      ) THEN 'FAIL (RLS or FORCE RLS disabled)'

      -- 4. Insecure table privileges: PUBLIC granted privileges
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND a.grantee = 0
      ) THEN 'FAIL (Insecure table privileges granted to PUBLIC)'

      -- 5. Insecure table privileges: anon granted privileges
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
          AND (
            has_table_privilege('anon', c.oid, 'SELECT')
            OR has_table_privilege('anon', c.oid, 'INSERT')
            OR has_table_privilege('anon', c.oid, 'UPDATE')
            OR has_table_privilege('anon', c.oid, 'DELETE')
            OR has_table_privilege('anon', c.oid, 'TRUNCATE')
            OR has_table_privilege('anon', c.oid, 'REFERENCES')
            OR has_table_privilege('anon', c.oid, 'TRIGGER')
          )
      ) THEN 'FAIL (Insecure table privileges granted to anon)'

      -- 6. Insecure table privileges: authenticated granted unauthorized DML/admin privileges
      WHEN EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
          AND (
            has_table_privilege('authenticated', c.oid, 'INSERT')
            OR has_table_privilege('authenticated', c.oid, 'UPDATE')
            OR has_table_privilege('authenticated', c.oid, 'DELETE')
            OR has_table_privilege('authenticated', c.oid, 'TRUNCATE')
            OR has_table_privilege('authenticated', c.oid, 'REFERENCES')
            OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
          )
      ) THEN 'FAIL (Direct DML privileges granted to authenticated on ledger)'

      -- 7. Insecure table privileges: authenticated lacks SELECT
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
          AND has_table_privilege('authenticated', c.oid, 'SELECT')
      ) THEN 'FAIL (authenticated lacks SELECT privilege on ledger)'

      -- 8. Insecure table privileges: service_role lacks expected privileges (all 7 required)
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations'
          AND has_table_privilege('service_role', c.oid, 'SELECT')
          AND has_table_privilege('service_role', c.oid, 'INSERT')
          AND has_table_privilege('service_role', c.oid, 'UPDATE')
          AND has_table_privilege('service_role', c.oid, 'DELETE')
          AND has_table_privilege('service_role', c.oid, 'TRUNCATE')
          AND has_table_privilege('service_role', c.oid, 'REFERENCES')
          AND has_table_privilege('service_role', c.oid, 'TRIGGER')
      ) THEN 'FAIL (service_role missing expected privileges on ledger)'

      -- 9. Insecure policy: Database role assignment not strictly {authenticated}
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations'
          AND (
            roles::text <> '{authenticated}'
            OR 'anon' = ANY(roles) OR 'public' = ANY(roles) OR 'staff' = ANY(roles)
          )
      ) THEN 'FAIL (Policy database roles not strictly {authenticated})'

      -- 10. Insecure policy: Command-aware staff access or unconditional access
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations'
          AND (
            (cmd = 'INSERT' AND (with_check ILIKE '%staff%' OR with_check = 'true' OR with_check IS NULL))
            OR (cmd = 'DELETE' AND (qual ILIKE '%staff%' OR qual = 'true' OR qual IS NULL))
            OR (cmd IN ('UPDATE', 'ALL') AND (
                 qual ILIKE '%staff%' OR COALESCE(with_check, qual) ILIKE '%staff%'
                 OR qual = 'true' OR qual IS NULL
                 OR COALESCE(with_check, qual) = 'true' OR COALESCE(with_check, qual) IS NULL
               ))
            OR (cmd = 'SELECT' AND (qual ILIKE '%staff%' OR qual = 'true' OR qual IS NULL))
          )
      ) THEN 'FAIL (Staff access or unrestricted policy condition on ledger)'

      -- 11. Direct client DML policy present on ledger (INSERT, UPDATE, DELETE, ALL)
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      ) THEN 'MANUAL REVIEW (Direct client DML policy present on ledger)'

      -- 12. Multiple policies on ledger (unexpected policy count)
      WHEN (
        SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations'
      ) > 1 THEN 'MANUAL REVIEW (Multiple policies on ledger - unexpected count)'

      -- 13. Policy logic cannot be proven as exact admin-only restriction
      WHEN EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'processed_rpc_operations'
          AND NOT (
            pol.policyname = 'Admins view processed rpc operations'
            AND pol.cmd = 'SELECT'
            AND pol.roles = '{authenticated}'
            AND regexp_replace(lower(pol.qual), '\s+', '', 'g') IN (
              '(public.get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text]))',
              '((public.get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])))',
              'public.get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])',
              '(get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text]))',
              '((get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])))',
              'get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])',
              '(public.get_current_user_role()in(''admin'',''substitute_admin'',''sir''))',
              '((public.get_current_user_role()in(''admin'',''substitute_admin'',''sir'')))',
              'public.get_current_user_role()in(''admin'',''substitute_admin'',''sir'')',
              '(get_current_user_role()in(''admin'',''substitute_admin'',''sir''))',
              '((get_current_user_role()in(''admin'',''substitute_admin'',''sir'')))',
              'get_current_user_role()in(''admin'',''substitute_admin'',''sir'')',
              '(public.get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir'']))',
              '((public.get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])))',
              'public.get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])',
              '(get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir'']))',
              '((get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])))',
              'get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])'
            )
          )
      ) THEN 'MANUAL REVIEW (Policy logic cannot be proven as exact admin-only restriction)'

      -- 14. Exact PASS condition: exactly 1 verified admin SELECT policy enforcing all 3 admin roles, no staff, no extra policies
      WHEN (
        SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'processed_rpc_operations'
      ) = 1
      AND EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = 'processed_rpc_operations'
          AND pol.policyname = 'Admins view processed rpc operations'
          AND pol.cmd = 'SELECT'
          AND pol.roles = '{authenticated}'
          AND regexp_replace(lower(pol.qual), '\s+', '', 'g') IN (
              '(public.get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text]))',
              '((public.get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])))',
              'public.get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])',
              '(get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text]))',
              '((get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])))',
              'get_current_user_role()=any(array[''admin''::text,''substitute_admin''::text,''sir''::text])',
              '(public.get_current_user_role()in(''admin'',''substitute_admin'',''sir''))',
              '((public.get_current_user_role()in(''admin'',''substitute_admin'',''sir'')))',
              'public.get_current_user_role()in(''admin'',''substitute_admin'',''sir'')',
              '(get_current_user_role()in(''admin'',''substitute_admin'',''sir''))',
              '((get_current_user_role()in(''admin'',''substitute_admin'',''sir'')))',
              'get_current_user_role()in(''admin'',''substitute_admin'',''sir'')',
              '(public.get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir'']))',
              '((public.get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])))',
              'public.get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])',
              '(get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir'']))',
              '((get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])))',
              'get_current_user_role()=any(array[''admin'',''substitute_admin'',''sir''])'
          )
      )
      THEN 'PASS'

      -- 15. Fallback: Missing required policy
      ELSE 'FAIL (Missing required admin SELECT policy on ledger)'
    END AS status

  UNION ALL

  -- 16. get_student_directory RPC hardening & privileges
  SELECT
    16,
    'Directory RPC',
    'public.get_student_directory()',
    'Exact 0 args, secdef=true, search_path pinned, PUBLIC/anon/srole=DENIED, auth=ALLOWED',
    COALESCE(
      (SELECT 'secdef=' || prosecdef
              || ', PUBLIC=' || (CASE WHEN public_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
              || ', anon=' || (CASE WHEN anon_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
              || ', srole=' || (CASE WHEN srole_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
              || ', auth=' || (CASE WHEN auth_has_execute THEN 'ALLOWED' ELSE 'DENIED' END)
       FROM function_catalog
       WHERE proname = 'get_student_directory' AND pronargs = 0 AND identity_args = ''
       LIMIT 1),
      'MISSING'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'get_student_directory' AND pronargs = 0 AND identity_args = ''
          AND prosecdef = true
          AND 'search_path=pg_catalog, public, pg_temp' = ANY(proconfig)
          AND public_has_execute = false
          AND anon_has_execute = false
          AND srole_has_execute = false
          AND auth_has_execute = true
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM function_catalog
        WHERE proname = 'get_student_directory'
          AND (public_has_execute = true OR anon_has_execute = true OR srole_has_execute = true)
      ) THEN 'FAIL (Insecure EXECUTE privilege granted to PUBLIC, anon, or service_role)'
      WHEN EXISTS (
        SELECT 1 FROM function_catalog WHERE proname = 'get_student_directory'
      ) THEN 'MANUAL REVIEW (Hardening or search_path mismatch)'
      ELSE 'FAIL (Function missing)'
    END
)
SELECT
  check_id AS "#",
  category AS "Category",
  target_object AS "Target Object",
  expected_rule AS "Expected Security Rule",
  live_state AS "Live Database State",
  status AS "Status"
FROM checklist
ORDER BY check_id;


-- ------------------------------------------------------------------------------
-- PART 2: DETAILED FUNCTION SIGNATURES, ACL & PRIVILEGES MATRIX
-- Expected rules per Migration 007:
-- PUBLIC: DENIED (PASS)
-- authenticated: ALLOWED (PASS)
-- anon: DENIED (PASS)
-- service_role: DENIED (PASS)
-- ------------------------------------------------------------------------------
SELECT
  p.proname AS "Function Name",
  pg_get_function_identity_arguments(p.oid) AS "Identity Arguments",
  oidvectortypes(p.proargtypes) AS "Canonical Argument Types",
  p.pronargs AS "Arg Count",
  p.prosecdef AS "Security Definer",
  array_to_string(p.proconfig, '; ') AS "Search Path Setting",
  COALESCE(array_to_string(p.proacl, ', '), '(DEFAULT PRIVILEGES - UNRESTRICTED)') AS "Raw ACL",
  CASE
    WHEN EXISTS (
      SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    ) THEN 'EXPOSED (FAIL)'
    ELSE 'DENIED (PASS)'
  END AS "PUBLIC Execute Status",
  CASE
    WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'ALLOWED (PASS)'
    ELSE 'DENIED (FAIL)'
  END AS "Authenticated Privilege",
  CASE
    WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'EXPOSED (FAIL)'
    ELSE 'DENIED (PASS)'
  END AS "Anon Privilege",
  CASE
    WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'EXPOSED (FAIL)'
    ELSE 'DENIED (PASS)'
  END AS "Service Role Privilege"
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_my_profile',
    'get_student_directory',
    'issue_components_atomic',
    'return_components_atomic',
    'update_student_profile'
  )
ORDER BY p.proname, p.pronargs;


-- ------------------------------------------------------------------------------
-- PART 3: DEEP RLS POLICY INSPECTION ON public.users
-- Evaluated strictly via command, roles, qual (USING) and with_check expressions
-- ------------------------------------------------------------------------------
SELECT
  pol.policyname AS "Policy Name",
  pol.cmd AS "Command",
  pol.roles::text AS "Applicable Roles",
  pol.qual AS "USING Expression",
  pol.with_check AS "WITH CHECK Expression",
  CASE
    -- 1. Definite FAIL: Grants staff access or unconditional true/null
    WHEN pol.qual ILIKE '%staff%'
      OR pol.with_check ILIKE '%staff%'
      OR pol.roles::text ILIKE '%staff%'
      OR pol.qual = 'true'
      OR pol.qual IS NULL
      THEN 'FAIL (Permits Direct Staff Access)'

    -- 2. Legitimate Admin Policy: verified USING and WITH CHECK logic
    WHEN pol.cmd = 'ALL'
      AND (pol.qual ILIKE '%get_current_user_role()%admin%' OR pol.qual ILIKE '%public.get_current_user_role() IN (%admin%')
      AND (COALESCE(pol.with_check, pol.qual) ILIKE '%get_current_user_role()%admin%' OR COALESCE(pol.with_check, pol.qual) ILIKE '%public.get_current_user_role() IN (%admin%')
      AND pol.qual NOT ILIKE '%staff%'
      AND COALESCE(pol.with_check, pol.qual) NOT ILIKE '%staff%'
      AND pol.roles::text NOT ILIKE '%staff%'
      THEN 'PASS (Legitimate Admin Policy - Verified USING/WITH CHECK)'

    -- 3. Legitimate Student Self-View Policy: verified USING logic
    WHEN pol.cmd = 'SELECT'
      AND pol.qual ILIKE '%role = ''student''%'
      AND (pol.qual ILIKE '%auth.uid()%' OR pol.qual ILIKE '%get_current_student_roll()%')
      AND pol.qual NOT ILIKE '%staff%'
      AND pol.roles::text NOT ILIKE '%staff%'
      THEN 'PASS (Legitimate Student Self-View Policy - Verified USING)'

    -- 4. Any other policy cannot be classified confidently -> MANUAL REVIEW
    ELSE 'MANUAL REVIEW (Unclassified Policy Logic - Inspect USING/WITH CHECK)'
  END AS "Evaluation"
FROM pg_policies pol
WHERE pol.schemaname = 'public' AND pol.tablename = 'users'
ORDER BY pol.cmd, pol.policyname;


-- ------------------------------------------------------------------------------
-- PART 4: DEEP RLS POLICY INSPECTION ON public.transactions
-- Evaluated strictly according to PostgreSQL command semantics:
-- - INSERT: evaluates WITH CHECK (qual is naturally NULL)
-- - DELETE: evaluates USING (with_check is naturally NULL)
-- - UPDATE & ALL: evaluates USING and COALESCE(with_check, qual) (accounting for default behavior)
-- - SELECT: evaluates USING
-- - Uncertain expressions are classified as MANUAL REVIEW
-- ------------------------------------------------------------------------------
SELECT
  pol.policyname AS "Policy Name",
  pol.cmd AS "Command",
  pol.roles::text AS "Applicable Roles",
  pol.qual AS "USING Expression",
  pol.with_check AS "WITH CHECK Expression",
  CASE
    -- 1. Direct Staff DML (FAIL according to command semantics)
    WHEN pol.cmd = 'INSERT' AND (
      pol.with_check ILIKE '%staff%'
      OR pol.with_check = 'true'
      OR pol.with_check IS NULL
      OR pol.roles::text ILIKE '%staff%'
    ) THEN 'FAIL (Direct Staff INSERT Permitted or Insecure WITH CHECK)'

    WHEN pol.cmd = 'DELETE' AND (
      pol.qual ILIKE '%staff%'
      OR pol.qual = 'true'
      OR pol.qual IS NULL
      OR pol.roles::text ILIKE '%staff%'
    ) THEN 'FAIL (Direct Staff DELETE Permitted or Insecure USING)'

    WHEN pol.cmd IN ('UPDATE', 'ALL') AND (
      pol.qual ILIKE '%staff%'
      OR COALESCE(pol.with_check, pol.qual) ILIKE '%staff%'
      OR pol.qual = 'true'
      OR pol.qual IS NULL
      OR COALESCE(pol.with_check, pol.qual) = 'true'
      OR pol.roles::text ILIKE '%staff%'
    ) THEN 'FAIL (Direct Staff DML Permitted or Insecure Clause)'

    -- 2. Legitimate Admin Policies (Verified according to command semantics)
    WHEN pol.cmd = 'ALL'
      AND pol.qual ILIKE '%get_current_user_role()%admin%'
      AND COALESCE(pol.with_check, pol.qual) ILIKE '%get_current_user_role()%admin%'
      AND pol.qual NOT ILIKE '%staff%'
      AND COALESCE(pol.with_check, pol.qual) NOT ILIKE '%staff%'
      AND pol.roles::text NOT ILIKE '%staff%'
      THEN 'PASS (Legitimate Admin Full Management - Verified USING/WITH CHECK)'

    WHEN pol.cmd = 'INSERT'
      AND pol.with_check ILIKE '%get_current_user_role()%admin%'
      AND pol.with_check NOT ILIKE '%staff%'
      AND pol.roles::text NOT ILIKE '%staff%'
      THEN 'PASS (Legitimate Admin INSERT - Verified WITH CHECK)'

    WHEN pol.cmd = 'DELETE'
      AND pol.qual ILIKE '%get_current_user_role()%admin%'
      AND pol.qual NOT ILIKE '%staff%'
      AND pol.roles::text NOT ILIKE '%staff%'
      THEN 'PASS (Legitimate Admin DELETE - Verified USING)'

    WHEN pol.cmd = 'UPDATE'
      AND pol.qual ILIKE '%get_current_user_role()%admin%'
      AND COALESCE(pol.with_check, pol.qual) ILIKE '%get_current_user_role()%admin%'
      AND pol.qual NOT ILIKE '%staff%'
      AND COALESCE(pol.with_check, pol.qual) NOT ILIKE '%staff%'
      AND pol.roles::text NOT ILIKE '%staff%'
      THEN 'PASS (Legitimate Admin UPDATE - Verified USING/WITH CHECK)'

    -- 3. Legitimate Read-Only Policies (SELECT only evaluates USING)
    WHEN pol.cmd = 'SELECT'
      AND (pol.qual ILIKE '%get_current_user_role()%staff%' OR pol.qual ILIKE '%public.get_current_user_role() = ''staff''%')
      AND pol.qual NOT ILIKE '%admin%'
      AND pol.qual <> 'true'
      AND pol.roles::text NOT ILIKE '%admin%'
      THEN 'PASS (Legitimate Staff Read-Only Policy - Verified USING)'

    WHEN pol.cmd = 'SELECT'
      AND pol.qual ILIKE '%student_roll%'
      AND (pol.qual ILIKE '%get_current_student_roll()%' OR pol.qual ILIKE '%auth.uid()%')
      AND pol.qual NOT ILIKE '%staff%'
      AND pol.qual <> 'true'
      THEN 'PASS (Legitimate Student Self-View Policy - Verified USING)'

    WHEN pol.cmd = 'SELECT'
      AND pol.qual ILIKE '%get_current_user_role()%admin%'
      AND pol.qual NOT ILIKE '%staff%'
      AND pol.qual <> 'true'
      THEN 'PASS (Legitimate Admin Read-Only Policy - Verified USING)'

    -- 4. Uncertain or unclassified expressions evaluate to MANUAL REVIEW
    ELSE 'MANUAL REVIEW (Unclassified Policy Logic - Inspect Command Semantics)'
  END AS "Evaluation"
FROM pg_policies pol
WHERE pol.schemaname = 'public' AND pol.tablename = 'transactions'
ORDER BY pol.cmd, pol.policyname;


-- ------------------------------------------------------------------------------
-- PART 5: VIEW COLUMN PROJECTION & FORBIDDEN SENSITIVE FIELD AUDIT
-- ------------------------------------------------------------------------------
SELECT
  column_name AS "Column Name",
  data_type AS "Data Type",
  ordinal_position AS "Position",
  CASE
    WHEN column_name IN (
      'id', 'roll_number', 'name', 'department', 'branch', 'section',
      'academic_year', 'mobile_number', 'face_registered', 'face_photo_url',
      'is_active', 'created_at', 'updated_at'
    ) THEN 'APPROVED (Non-Secret Directory Field)'
    WHEN column_name IN (
      'password_hash', 'fingerprint_ids', 'finger_labels', 'membership_status',
      'auth_id', 'incubation_start_date', 'academic_year_at_start',
      'retention_period_years', 'retention_end_date', 'id_card_scanned_at',
      'id_card_validity_year'
    ) THEN 'FORBIDDEN (FAIL: Sensitive Field Exposed)'
    ELSE 'UNEXPECTED (FAIL: Outside Approved Whitelist)'
  END AS "Compliance Status"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'staff_student_directory'
ORDER BY ordinal_position;


-- ------------------------------------------------------------------------------
-- PART 6: VIEW DEFINITION & SECURITY BARRIER INSPECTION
-- ------------------------------------------------------------------------------
SELECT
  c.relname AS "View Name",
  array_to_string(c.reloptions, ', ') AS "View Options",
  CASE
    WHEN 'security_barrier=true' = ANY(c.reloptions) THEN 'ACTIVE (PASS)'
    ELSE 'INACTIVE (FAIL)'
  END AS "Security Barrier Status",
  CASE
    WHEN pg_get_viewdef(c.oid, true) ILIKE '%u.role = ''student''%'
      OR pg_get_viewdef(c.oid, true) ILIKE '%role = ''student''%' THEN 'ACTIVE (PASS)'
    ELSE 'MISSING (FAIL)'
  END AS "Student-Only Filter Status",
  pg_get_viewdef(c.oid, true) AS "Full View SQL Definition"
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'staff_student_directory'
  AND c.relkind = 'v';


-- ------------------------------------------------------------------------------
-- PART 7: TABLE-LEVEL RLS AND FORCE ROW LEVEL SECURITY STATUS
-- ------------------------------------------------------------------------------
SELECT
  c.relname AS "Table Name",
  CASE
    WHEN c.relrowsecurity THEN 'ENABLED (PASS)'
    ELSE 'DISABLED (FAIL)'
  END AS "RLS Status",
  CASE
    WHEN c.relforcerowsecurity THEN 'FORCED (PASS)'
    ELSE 'NOT FORCED (FAIL)'
  END AS "FORCE RLS Status",
  (
    SELECT count(*)
    FROM pg_policies pol
    WHERE pol.schemaname = 'public' AND pol.tablename = c.relname
  ) AS "Active Policy Count"
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('users', 'transactions', 'visits', 'components', 'student_roster', 'processed_rpc_operations')
  AND c.relkind = 'r'
ORDER BY c.relname;


-- ------------------------------------------------------------------------------
-- PART 8: IDEMPOTENCY LEDGER RLS & ACCESS POLICY INSPECTION
-- Evaluated strictly according to PostgreSQL command semantics:
-- - INSERT: evaluates WITH CHECK (qual is naturally NULL; do not flag qual IS NULL)
-- - DELETE: evaluates USING (with_check is naturally NULL; do not flag with_check IS NULL)
-- - UPDATE & ALL: evaluates USING and COALESCE(with_check, qual) (accounting for default behavior)
-- - SELECT: evaluates USING only (with_check is naturally NULL)
-- - Database roles (pol.roles) isolated strictly from application roles (get_current_user_role())
-- ------------------------------------------------------------------------------
SELECT
  pol.policyname AS "Policy Name",
  pol.cmd AS "Command",
  pol.roles::text AS "Applicable Roles",
  pol.qual AS "USING Expression",
  pol.with_check AS "WITH CHECK Expression",
  CASE
    -- 1. Database Role Isolation: pol.roles must not grant access to anon, public, or staff
    WHEN 'anon' = ANY(pol.roles)
      OR 'public' = ANY(pol.roles)
      OR 'staff' = ANY(pol.roles)
      OR pol.roles::text ILIKE '%anon%'
      OR pol.roles::text ILIKE '%public%'
      OR pol.roles::text ILIKE '%staff%'
      THEN 'FAIL (Insecure Database Role Assignment in pol.roles)'

    -- 2. Command-Aware Staff or Unrestricted Access Detection:
    -- INSERT: evaluate WITH CHECK (qual is naturally NULL in PostgreSQL; do not flag qual IS NULL)
    WHEN pol.cmd = 'INSERT' AND (
      pol.with_check ILIKE '%staff%'
      OR pol.with_check = 'true'
      OR pol.with_check IS NULL
    ) THEN 'FAIL (Permits Staff INSERT or Insecure WITH CHECK Expression)'

    -- DELETE: evaluate USING (with_check is naturally NULL in PostgreSQL; do not flag with_check IS NULL)
    WHEN pol.cmd = 'DELETE' AND (
      pol.qual ILIKE '%staff%'
      OR pol.qual = 'true'
      OR pol.qual IS NULL
    ) THEN 'FAIL (Permits Staff DELETE or Insecure USING Expression)'

    -- UPDATE: evaluate both USING and WITH CHECK (accounting for PostgreSQL default when WITH CHECK is omitted)
    WHEN pol.cmd = 'UPDATE' AND (
      pol.qual ILIKE '%staff%'
      OR COALESCE(pol.with_check, pol.qual) ILIKE '%staff%'
      OR pol.qual = 'true'
      OR pol.qual IS NULL
      OR COALESCE(pol.with_check, pol.qual) = 'true'
      OR COALESCE(pol.with_check, pol.qual) IS NULL
    ) THEN 'FAIL (Permits Staff UPDATE or Insecure USING/WITH CHECK Expression)'

    -- ALL: evaluate both USING and WITH CHECK (accounting for PostgreSQL default when WITH CHECK is omitted)
    WHEN pol.cmd = 'ALL' AND (
      pol.qual ILIKE '%staff%'
      OR COALESCE(pol.with_check, pol.qual) ILIKE '%staff%'
      OR pol.qual = 'true'
      OR pol.qual IS NULL
      OR COALESCE(pol.with_check, pol.qual) = 'true'
      OR COALESCE(pol.with_check, pol.qual) IS NULL
    ) THEN 'FAIL (Permits Staff Full Access or Insecure USING/WITH CHECK Expression)'

    -- SELECT: evaluate USING only (with_check is naturally NULL in PostgreSQL)
    WHEN pol.cmd = 'SELECT' AND (
      pol.qual ILIKE '%staff%'
      OR pol.qual = 'true'
      OR pol.qual IS NULL
    ) THEN 'FAIL (Permits Staff SELECT or Insecure USING Expression)'

    -- 3. Legitimate Admin Policies (Evaluated strictly by command semantics and application role verification):
    -- SELECT: Admin audit view on idempotency ledger (evaluates USING)
    WHEN pol.cmd = 'SELECT'
      AND (
        pol.qual ILIKE '%get_current_user_role()%admin%'
        OR pol.qual ILIKE '%public.get_current_user_role() IN (%admin%'
      )
      AND pol.qual NOT ILIKE '%staff%'
      AND pol.qual <> 'true'
      THEN 'PASS (Legitimate Admin Audit Access - Verified USING)'

    -- ALL: Admin full management on idempotency ledger (evaluates both USING and WITH CHECK)
    WHEN pol.cmd = 'ALL'
      AND (
        pol.qual ILIKE '%get_current_user_role()%admin%'
        OR pol.qual ILIKE '%public.get_current_user_role() IN (%admin%'
      )
      AND (
        COALESCE(pol.with_check, pol.qual) ILIKE '%get_current_user_role()%admin%'
        OR COALESCE(pol.with_check, pol.qual) ILIKE '%public.get_current_user_role() IN (%admin%'
      )
      AND pol.qual NOT ILIKE '%staff%'
      AND COALESCE(pol.with_check, pol.qual) NOT ILIKE '%staff%'
      AND pol.qual <> 'true'
      AND COALESCE(pol.with_check, pol.qual) <> 'true'
      THEN 'PASS (Legitimate Admin Full Management - Verified USING/WITH CHECK)'

    -- INSERT: Admin insert policy (evaluates WITH CHECK)
    WHEN pol.cmd = 'INSERT'
      AND (
        pol.with_check ILIKE '%get_current_user_role()%admin%'
        OR pol.with_check ILIKE '%public.get_current_user_role() IN (%admin%'
      )
      AND pol.with_check NOT ILIKE '%staff%'
      AND pol.with_check <> 'true'
      THEN 'PASS (Legitimate Admin INSERT - Verified WITH CHECK)'

    -- UPDATE: Admin update policy (evaluates both USING and WITH CHECK)
    WHEN pol.cmd = 'UPDATE'
      AND (
        pol.qual ILIKE '%get_current_user_role()%admin%'
        OR pol.qual ILIKE '%public.get_current_user_role() IN (%admin%'
      )
      AND (
        COALESCE(pol.with_check, pol.qual) ILIKE '%get_current_user_role()%admin%'
        OR COALESCE(pol.with_check, pol.qual) ILIKE '%public.get_current_user_role() IN (%admin%'
      )
      AND pol.qual NOT ILIKE '%staff%'
      AND COALESCE(pol.with_check, pol.qual) NOT ILIKE '%staff%'
      AND pol.qual <> 'true'
      AND COALESCE(pol.with_check, pol.qual) <> 'true'
      THEN 'PASS (Legitimate Admin UPDATE - Verified USING/WITH CHECK)'

    -- DELETE: Admin delete policy (evaluates USING)
    WHEN pol.cmd = 'DELETE'
      AND (
        pol.qual ILIKE '%get_current_user_role()%admin%'
        OR pol.qual ILIKE '%public.get_current_user_role() IN (%admin%'
      )
      AND pol.qual NOT ILIKE '%staff%'
      AND pol.qual <> 'true'
      THEN 'PASS (Legitimate Admin DELETE - Verified USING)'

    -- 4. Uncertain or unclassified expressions evaluate strictly to MANUAL REVIEW
    ELSE 'MANUAL REVIEW (Unclassified Policy Logic - Inspect Command Semantics)'
  END AS "Evaluation"
FROM pg_policies pol
WHERE pol.schemaname = 'public' AND pol.tablename = 'processed_rpc_operations'
ORDER BY pol.cmd, pol.policyname;

-- ------------------------------------------------------------------------------
-- PART 9: IDEMPOTENCY LEDGER TABLE PRIVILEGES & ROLE ACCESS MATRIX
-- Evaluates table privileges via PostgreSQL system catalog (pg_class, aclexplode)
-- and has_table_privilege() across all 7 privileges and standard database roles.
-- Driven by expected_roles LEFT JOIN target_table so that if table is missing,
-- exactly 4 rows are returned reporting explicit 'TABLE MISSING' and FAIL status.
-- Expected rules per Migration 007:
-- - PUBLIC: NO PRIVILEGES (DENIED across all 7)
-- - anon: NO PRIVILEGES (DENIED across all 7)
-- - authenticated: SELECT ONLY (INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER: DENIED)
-- - service_role: ALL 7 PRIVILEGES (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER: ALLOWED)
-- ------------------------------------------------------------------------------
WITH expected_roles AS (
  SELECT 'PUBLIC' AS rolname, 1 AS sort_order
  UNION ALL SELECT 'anon' AS rolname, 2 AS sort_order
  UNION ALL SELECT 'authenticated' AS rolname, 3 AS sort_order
  UNION ALL SELECT 'service_role' AS rolname, 4 AS sort_order
),
target_table AS (
  SELECT c.oid, c.relacl, c.relowner
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'processed_rpc_operations' AND c.relkind = 'r'
)
SELECT
  er.rolname AS "Role Name",
  CASE
    WHEN er.rolname = 'PUBLIC' THEN 'PSEUDO-ROLE'
    WHEN EXISTS (SELECT 1 FROM pg_roles pr WHERE pr.rolname = er.rolname) THEN 'ACTIVE'
    ELSE 'MISSING'
  END AS "Role Catalog Status",
  CASE
    WHEN c.oid IS NULL THEN 'TABLE MISSING'
    WHEN er.rolname <> 'PUBLIC' AND NOT EXISTS (SELECT 1 FROM pg_roles pr WHERE pr.rolname = er.rolname)
      THEN 'ROLE MISSING'
    WHEN er.rolname = 'PUBLIC' THEN
      CASE
        WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
          WHERE a.grantee = 0 AND a.privilege_type = 'SELECT'
        ) THEN 'EXPOSED (FAIL)'
        ELSE 'DENIED (PASS)'
      END
    ELSE
      CASE
        WHEN has_table_privilege(er.rolname, c.oid, 'SELECT') THEN 'ALLOWED'
        ELSE 'DENIED'
      END
  END AS "SELECT Privilege",
  CASE
    WHEN c.oid IS NULL THEN 'TABLE MISSING'
    WHEN er.rolname <> 'PUBLIC' AND NOT EXISTS (SELECT 1 FROM pg_roles pr WHERE pr.rolname = er.rolname)
      THEN 'ROLE MISSING'
    WHEN er.rolname = 'PUBLIC' THEN
      CASE
        WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
          WHERE a.grantee = 0 AND a.privilege_type = 'INSERT'
        ) THEN 'EXPOSED (FAIL)'
        ELSE 'DENIED (PASS)'
      END
    ELSE
      CASE
        WHEN has_table_privilege(er.rolname, c.oid, 'INSERT') THEN 'ALLOWED'
        ELSE 'DENIED'
      END
  END AS "INSERT Privilege",
  CASE
    WHEN c.oid IS NULL THEN 'TABLE MISSING'
    WHEN er.rolname <> 'PUBLIC' AND NOT EXISTS (SELECT 1 FROM pg_roles pr WHERE pr.rolname = er.rolname)
      THEN 'ROLE MISSING'
    WHEN er.rolname = 'PUBLIC' THEN
      CASE
        WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
          WHERE a.grantee = 0 AND a.privilege_type = 'UPDATE'
        ) THEN 'EXPOSED (FAIL)'
        ELSE 'DENIED (PASS)'
      END
    ELSE
      CASE
        WHEN has_table_privilege(er.rolname, c.oid, 'UPDATE') THEN 'ALLOWED'
        ELSE 'DENIED'
      END
  END AS "UPDATE Privilege",
  CASE
    WHEN c.oid IS NULL THEN 'TABLE MISSING'
    WHEN er.rolname <> 'PUBLIC' AND NOT EXISTS (SELECT 1 FROM pg_roles pr WHERE pr.rolname = er.rolname)
      THEN 'ROLE MISSING'
    WHEN er.rolname = 'PUBLIC' THEN
      CASE
        WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
          WHERE a.grantee = 0 AND a.privilege_type = 'DELETE'
        ) THEN 'EXPOSED (FAIL)'
        ELSE 'DENIED (PASS)'
      END
    ELSE
      CASE
        WHEN has_table_privilege(er.rolname, c.oid, 'DELETE') THEN 'ALLOWED'
        ELSE 'DENIED'
      END
  END AS "DELETE Privilege",
  CASE
    WHEN c.oid IS NULL THEN 'TABLE MISSING'
    WHEN er.rolname <> 'PUBLIC' AND NOT EXISTS (SELECT 1 FROM pg_roles pr WHERE pr.rolname = er.rolname)
      THEN 'ROLE MISSING'
    WHEN er.rolname = 'PUBLIC' THEN
      CASE
        WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
          WHERE a.grantee = 0 AND a.privilege_type = 'TRUNCATE'
        ) THEN 'EXPOSED (FAIL)'
        ELSE 'DENIED (PASS)'
      END
    ELSE
      CASE
        WHEN has_table_privilege(er.rolname, c.oid, 'TRUNCATE') THEN 'ALLOWED'
        ELSE 'DENIED'
      END
  END AS "TRUNCATE Privilege",
  CASE
    WHEN c.oid IS NULL THEN 'TABLE MISSING'
    WHEN er.rolname <> 'PUBLIC' AND NOT EXISTS (SELECT 1 FROM pg_roles pr WHERE pr.rolname = er.rolname)
      THEN 'ROLE MISSING'
    WHEN er.rolname = 'PUBLIC' THEN
      CASE
        WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
          WHERE a.grantee = 0 AND a.privilege_type = 'REFERENCES'
        ) THEN 'EXPOSED (FAIL)'
        ELSE 'DENIED (PASS)'
      END
    ELSE
      CASE
        WHEN has_table_privilege(er.rolname, c.oid, 'REFERENCES') THEN 'ALLOWED'
        ELSE 'DENIED'
      END
  END AS "REFERENCES Privilege",
  CASE
    WHEN c.oid IS NULL THEN 'TABLE MISSING'
    WHEN er.rolname <> 'PUBLIC' AND NOT EXISTS (SELECT 1 FROM pg_roles pr WHERE pr.rolname = er.rolname)
      THEN 'ROLE MISSING'
    WHEN er.rolname = 'PUBLIC' THEN
      CASE
        WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
          WHERE a.grantee = 0 AND a.privilege_type = 'TRIGGER'
        ) THEN 'EXPOSED (FAIL)'
        ELSE 'DENIED (PASS)'
      END
    ELSE
      CASE
        WHEN has_table_privilege(er.rolname, c.oid, 'TRIGGER') THEN 'ALLOWED'
        ELSE 'DENIED'
      END
  END AS "TRIGGER Privilege",
  CASE
    -- Table missing check (table public.processed_rpc_operations does not exist)
    WHEN c.oid IS NULL THEN 'FAIL (Table missing - public.processed_rpc_operations does not exist)'

    -- Missing role check
    WHEN er.rolname <> 'PUBLIC' AND NOT EXISTS (SELECT 1 FROM pg_roles pr WHERE pr.rolname = er.rolname)
      THEN 'FAIL (Database role missing from pg_roles)'

    -- PUBLIC check: all privileges must be denied (0 rows in aclexplode for grantee=0)
    WHEN er.rolname = 'PUBLIC' THEN
      CASE
        WHEN EXISTS (
          SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
          WHERE a.grantee = 0
        ) THEN 'FAIL (PUBLIC has table privileges)'
        ELSE 'PASS (Zero table privileges granted to PUBLIC)'
      END

    -- anon check: all 7 privileges must be denied
    WHEN er.rolname = 'anon' THEN
      CASE
        WHEN has_table_privilege(er.rolname, c.oid, 'SELECT')
          OR has_table_privilege(er.rolname, c.oid, 'INSERT')
          OR has_table_privilege(er.rolname, c.oid, 'UPDATE')
          OR has_table_privilege(er.rolname, c.oid, 'DELETE')
          OR has_table_privilege(er.rolname, c.oid, 'TRUNCATE')
          OR has_table_privilege(er.rolname, c.oid, 'REFERENCES')
          OR has_table_privilege(er.rolname, c.oid, 'TRIGGER')
        THEN 'FAIL (anon has table privileges)'
        ELSE 'PASS (Zero table privileges granted to anon)'
      END

    -- authenticated check: SELECT allowed, remaining 6 privileges denied
    WHEN er.rolname = 'authenticated' THEN
      CASE
        WHEN has_table_privilege(er.rolname, c.oid, 'SELECT')
          AND NOT (
            has_table_privilege(er.rolname, c.oid, 'INSERT')
            OR has_table_privilege(er.rolname, c.oid, 'UPDATE')
            OR has_table_privilege(er.rolname, c.oid, 'DELETE')
            OR has_table_privilege(er.rolname, c.oid, 'TRUNCATE')
            OR has_table_privilege(er.rolname, c.oid, 'REFERENCES')
            OR has_table_privilege(er.rolname, c.oid, 'TRIGGER')
          )
        THEN 'PASS (SELECT only - DML & admin privileges denied)'
        ELSE 'FAIL (authenticated has unauthorized DML or lacks SELECT)'
      END

    -- service_role check: all 7 privileges required
    WHEN er.rolname = 'service_role' THEN
      CASE
        WHEN has_table_privilege(er.rolname, c.oid, 'SELECT')
          AND has_table_privilege(er.rolname, c.oid, 'INSERT')
          AND has_table_privilege(er.rolname, c.oid, 'UPDATE')
          AND has_table_privilege(er.rolname, c.oid, 'DELETE')
          AND has_table_privilege(er.rolname, c.oid, 'TRUNCATE')
          AND has_table_privilege(er.rolname, c.oid, 'REFERENCES')
          AND has_table_privilege(er.rolname, c.oid, 'TRIGGER')
        THEN 'PASS (service_role has all 7 expected privileges)'
        ELSE 'FAIL (service_role lacks expected privileges)'
      END

    ELSE 'MANUAL REVIEW'
  END AS "Privilege Compliance"
FROM expected_roles er
LEFT JOIN target_table c ON true
ORDER BY er.sort_order;
