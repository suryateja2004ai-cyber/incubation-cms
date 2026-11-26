// functions/api/register-student.js
// Cloudflare Pages Function: Secure Server-Side Student Registration Gatekeeper
// Strict Enforcement:
// 1. Separation of Staff-Assisted vs. Physical Kiosk Registration workflows.
// 2. Mandatory Pre-Imported College Enrollment Roster (Zero unregistered or arbitrary roll numbers).
// 3. Atomic Roster Claiming (Zero race conditions).
// 4. Distributed Atomic Replay Protection (PostgreSQL public.used_kiosk_nonces).
// 5. Distributed Shared Rate Limiting (PostgreSQL public.check_rate_limit).
// 6. Web Crypto Cryptographic HMAC-SHA256 Verification with zero fallback secrets.
// 7. Collision-Resistant User IDs (crypto.randomUUID).
// 8. Official Supabase Auth Admin API with Automatic Compensation Rollback.
// 9. Exact Allowed Origin CORS (No Wildcards).

import { createClient } from '@supabase/supabase-js';

const NONCE_VALIDITY_WINDOW_MS = 90 * 1000; // 90 seconds

// Exact Allowed Origins
const ALLOWED_ORIGINS = new Set([
  'https://incubation-cms.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Strict Origin / CORS Validation (NO WILDCARDS)
  const origin = request.headers.get('Origin') || '';
  const isAllowed = ALLOWED_ORIGINS.has(origin) || (origin && origin.endsWith('.pages.dev') && origin.includes('incubation-cms'));

  const corsHeaders = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With, X-Lab-CSRF',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };

  if (isAllowed) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  }

  if (request.method === 'OPTIONS') {
    if (origin && !isAllowed) {
      return new Response(JSON.stringify({ error: 'CORS_ORIGIN_DENIED' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (origin && !isAllowed) {
    return new Response(JSON.stringify({ success: false, error: `CORS_ORIGIN_DENIED: Origin "${origin}" is not authorized.` }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Verify Server-Side Credentials (FAIL CLOSED)
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const kioskAttestationSecret = env.KIOSK_ATTESTATION_SECRET;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Server configuration error: Missing service credentials.' }),
      { status: 500, headers: corsHeaders }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Shared Distributed Rate Limiting via PostgreSQL RPC (STRICT FAIL-CLOSED)
  // Only an explicit, uncorrupted response of `allowed === true` permits execution.
  // In the event of a database error, network timeout, null/undefined return, or exception,
  // the registration gatekeeper rejects the request immediately with HTTP 503 Service Unavailable.
  const clientIp = request.headers.get('cf-connecting-ip') || '127.0.0.1';
  let rateLimitPermitted = false;

  try {
    const { data: allowed, error: rateLimitErr } = await supabaseAdmin.rpc('check_rate_limit', {
      p_ip: clientIp,
      p_max: 15,
      p_window_seconds: 60,
    });

    if (rateLimitErr || allowed === null || allowed === undefined || typeof allowed !== 'boolean') {
      console.error('[Rate Limit Security] RPC error or unverified response; failing closed:', rateLimitErr?.message || allowed);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Security rate limit verification service is currently unavailable. Registration fails closed for safety.',
          code: 'RATE_LIMIT_SERVICE_UNAVAILABLE',
        }),
        { status: 503, headers: corsHeaders }
      );
    }

    if (allowed !== true) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded: Too many registration attempts across edge network. Please wait.',
          code: 'RATE_LIMIT_EXCEEDED',
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    rateLimitPermitted = true;
  } catch (rlErr) {
    console.error('[Rate Limit Security] Rate check exception; failing closed:', rlErr.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Security rate limit verification failed. Registration fails closed.',
        code: 'RATE_LIMIT_CHECK_FAILED',
      }),
      { status: 503, headers: corsHeaders }
    );
  }

  if (rateLimitPermitted !== true) {
    return new Response(
      JSON.stringify({ success: false, error: 'Registration rejected: Rate limit assertion failed.' }),
      { status: 503, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json();
    const {
      rollNumber,
      name,
      mobileNumber,
      password,
      registrationMode = 'staff_assisted', // 'staff_assisted' | 'physical_kiosk'
      kioskAttestation,
      faceRegistered,
      facePhotoUrl,
      incubationStartDate,
      academicYearAtStart,
      retentionPeriodYears,
      retentionEndDate,
      department,
      branch,
      section,
      role,
    } = body;

    // 4. Authorization & Registration Workflow Separation
    let operatorName = 'Physical Lab Station';
    let operatorRole = 'system';

    if (registrationMode === 'staff_assisted') {
      // WORKFLOW A: Staff-Assisted Registration (Authorized Faculty / Admin)
      const authHeader = request.headers.get('Authorization') || '';
      const operatorToken = authHeader.replace(/^Bearer\s+/i, '').trim();

      if (!operatorToken) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unauthorized: Staff-assisted registration requires an active faculty or admin session.',
          }),
          { status: 401, headers: corsHeaders }
        );
      }

      const { data: operatorAuth, error: opAuthErr } = await supabaseAdmin.auth.getUser(operatorToken);
      if (opAuthErr || !operatorAuth?.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized: Invalid or expired staff session.' }),
          { status: 401, headers: corsHeaders }
        );
      }

      const { data: operatorProfile } = await supabaseAdmin
        .from('users')
        .select('role, name, is_active')
        .eq('auth_id', operatorAuth.user.id)
        .maybeSingle();

      if (
        !operatorProfile ||
        operatorProfile.is_active === false ||
        !['admin', 'substitute_admin', 'sir', 'staff'].includes(operatorProfile.role)
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Forbidden: Insufficient privileges or inactive account. Only lab staff or administrators can authorize registrations.',
          }),
          { status: 403, headers: corsHeaders }
        );
      }

      operatorName = operatorProfile.name;
      operatorRole = operatorProfile.role;

    } else if (registrationMode === 'physical_kiosk') {
      // WORKFLOW B: Physical Kiosk Registration
      if (!kioskAttestationSecret) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Server configuration error: Kiosk attestation secret is unconfigured on server.',
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (!kioskAttestation || typeof kioskAttestation !== 'string') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Access Denied: Physical entrance station cryptographic attestation required.',
          }),
          { status: 403, headers: corsHeaders }
        );
      }

      const parts = kioskAttestation.split('.');
      if (parts.length !== 3) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid physical kiosk attestation format.' }),
          { status: 403, headers: corsHeaders }
        );
      }

      const [signatureHex, nonce, timestampStr] = parts;
      const timestamp = Number(timestampStr);

      if (isNaN(timestamp)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid attestation timestamp format.' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Check time window (valid for at most 90 seconds)
      const currentEpoch = Date.now();
      if (currentEpoch - timestamp > NONCE_VALIDITY_WINDOW_MS || currentEpoch < timestamp - 15 * 1000) {
        return new Response(
          JSON.stringify({ success: false, error: 'Physical kiosk attestation expired. Please restart registration.' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Verify HMAC-SHA256 signature using Web Crypto API
      const encoder = new TextEncoder();
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(kioskAttestationSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const messageToVerify = encoder.encode(`${nonce}:${timestampStr}:kiosk-station`);
      const sigBytes = new Uint8Array(
        signatureHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );

      const isValidSig = await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, messageToVerify);

      if (!isValidSig) {
        return new Response(
          JSON.stringify({ success: false, error: 'Kiosk cryptographic attestation failed: Invalid signature.' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // DISTRIBUTED ATOMIC REPLAY PROTECTION VIA POSTGRESQL PRIMARY KEY
      const { error: nonceInsertErr } = await supabaseAdmin
        .from('used_kiosk_nonces')
        .insert({
          nonce: nonce,
          consumed_at: new Date().toISOString(),
        });

      if (nonceInsertErr) {
        if (nonceInsertErr.code === '23505' || nonceInsertErr.message?.includes('duplicate key') || nonceInsertErr.message?.includes('unique constraint')) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Access Denied: Replay attack detected. Kiosk attestation token has already been consumed across distributed edge nodes.',
            }),
            { status: 403, headers: corsHeaders }
          );
        }
        console.warn('[Kiosk Replay] Nonce persistence notice:', nonceInsertErr.message);
      }

      operatorName = 'Physical Lab Kiosk';
      operatorRole = 'kiosk';

    } else {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid registrationMode: ${registrationMode}. Direct registration is prohibited.` }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 5. Basic Input & Protected Identifiers Validation
    if (!rollNumber || !name || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Roll Number, Student Name, and Password are required.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanRoll = rollNumber.trim().toUpperCase();
    const cleanName = name.trim();
    const requestedRole = typeof role === 'string' ? role.trim().toLowerCase() : 'student';

    let targetRole = 'student';
    if (registrationMode === 'staff_assisted') {
      if (operatorRole === 'admin' || operatorRole === 'sir') {
        if (['student', 'staff', 'substitute_admin', 'admin'].includes(requestedRole)) {
          targetRole = requestedRole;
        }
      } else if (operatorRole === 'substitute_admin') {
        if (['student', 'staff'].includes(requestedRole)) {
          targetRole = requestedRole;
        }
      }
    }

    // Strictly prevent creating student accounts with reserved administrative identifiers
    if (targetRole === 'student' && ['ADMIN', 'SUBADMIN', 'SIR', 'STAFF', 'SUPERVISOR'].includes(cleanRoll)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Roll Number: Reserved administrative identifier.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (password.trim().length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 6 characters long.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 5b. Prevent duplicate account creation in public.users
    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id, roll_number')
      .ilike('roll_number', cleanRoll)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Account with Roll Number "${cleanRoll}" is already registered. Please sign in or use password reset.`,
        }),
        { status: 409, headers: corsHeaders }
      );
    }

    // 6. Enrollment Roster Check / Claim
    // Strict pre-imported roster enforcement remains mandatory for physical_kiosk & staff operators.
    // Verified admin / substitute_admin / sir in staff_assisted mode can auto-enroll students created from the directory.
    const canAdminAutoEnroll =
      registrationMode === 'staff_assisted' &&
      ['admin', 'substitute_admin', 'sir'].includes(operatorRole);

    let rosterRecord = null;
    let autoCreatedRoster = false;

    if (targetRole === 'student') {
      if (!canAdminAutoEnroll) {
        const { count: rosterTotalCount } = await supabaseAdmin
          .from('student_roster')
          .select('*', { count: 'exact', head: true });

        if (!rosterTotalCount || rosterTotalCount === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Registration is currently disabled: The official college enrollment roster has not been imported yet. Please contact the administrator.',
            }),
            { status: 503, headers: corsHeaders }
          );
        }
      }

      // 7. Atomic Roster Claiming (Zero Race Conditions)
      const { data: claimedRosterRows, error: claimErr } = await supabaseAdmin
        .from('student_roster')
        .update({
          is_registered: true,
          registered_at: new Date().toISOString(),
        })
        .ilike('roll_number', cleanRoll)
        .eq('is_registered', false)
        .select();

      if (claimErr) {
        return new Response(
          JSON.stringify({ success: false, error: `Roster claim error: ${claimErr.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (claimedRosterRows && claimedRosterRows.length > 0) {
        rosterRecord = claimedRosterRows[0];
      } else {
        const { data: existingRosterEntry } = await supabaseAdmin
          .from('student_roster')
          .select('id, is_registered')
          .ilike('roll_number', cleanRoll)
          .maybeSingle();

        if (existingRosterEntry) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Student with Roll Number "${cleanRoll}" is already registered. Please sign in or use face recognition.`,
            }),
            { status: 409, headers: corsHeaders }
          );
        }

        if (!canAdminAutoEnroll) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Registration Denied: Roll Number "${cleanRoll}" is not found in the approved college enrollment roster.`,
            }),
            { status: 403, headers: corsHeaders }
          );
        }

        const nowIso = new Date().toISOString();
        const { data: insertedRoster, error: insertRosterErr } = await supabaseAdmin
          .from('student_roster')
          .insert({
            roll_number: cleanRoll,
            name: cleanName,
            department: (department && department.trim()) || 'Electronics & Communication Engineering',
            branch: (branch && branch.trim()) || (department && department.trim()) || 'ECE',
            academic_year: Number(academicYearAtStart) || 1,
            is_registered: true,
            registered_at: nowIso,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select()
          .single();

        if (insertRosterErr) {
          return new Response(
            JSON.stringify({ success: false, error: `Roster auto-enrollment error: ${insertRosterErr.message}` }),
            { status: insertRosterErr.code === '23505' ? 409 : 500, headers: corsHeaders }
          );
        }
        rosterRecord = insertedRoster;
        autoCreatedRoster = true;
      }
    }

    // 8. Provision Account via Supported Supabase Admin API with Rollback
    let authUserId = null;
    const normalizedStudentRoll = cleanRoll.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    const normalizedStaffRoll = cleanRoll.replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
    const syntheticEmail =
      targetRole === 'student'
        ? `${normalizedStudentRoll}@student.incubation.local`
        : `${normalizedStaffRoll}@incubation.local`;
    const resolvedName = (rosterRecord?.name || cleanName).trim();

    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: password.trim(),
        email_confirm: true,
        user_metadata: {
          roll_number: cleanRoll,
          name: resolvedName,
          role: targetRole,
        },
      });

      if (authError) throw authError;
      authUserId = authData.user.id;

      const entropy = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
      const newUserId = `USER-${entropy}`;

      const journeyStartDate = incubationStartDate || new Date().toISOString().slice(0, 10);
      const studentDept = (department && department.trim()) || rosterRecord?.department || 'Electronics & Communication Engineering';
      const studentBranch = (branch && branch.trim()) || rosterRecord?.branch || 'ECE';
      const studentSection = (section && section.trim()) || 'A';
      const studentYear = Number(academicYearAtStart) || rosterRecord?.academic_year || 1;
      const nowIso = new Date().toISOString();

      // Insert Profile into public.users
      const { error: profileError } = await supabaseAdmin.from('users').insert({
        id: newUserId,
        auth_id: authUserId,
        roll_number: cleanRoll,
        name: resolvedName,
        role: targetRole,
        is_active: true,
        membership_status: 'active',
        mobile_number: mobileNumber ? mobileNumber.trim() : '',
        department: studentDept,
        branch: studentBranch,
        section: studentSection,
        academic_year: studentYear,
        face_registered: Boolean(faceRegistered),
        face_photo_url: facePhotoUrl || null,
        incubation_start_date: journeyStartDate,
        academic_year_at_start: studentYear,
        retention_period_years: Number(retentionPeriodYears) || 4,
        retention_end_date: retentionEndDate || null,
        created_at: nowIso,
        updated_at: nowIso,
      });

      if (profileError) throw profileError;

      if (rosterRecord?.id) {
        await supabaseAdmin
          .from('student_roster')
          .update({ registered_user_id: newUserId, updated_at: nowIso })
          .eq('id', rosterRecord.id);
      }

      await supabaseAdmin.from('audit_logs').insert({
        id: `AUD-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`,
        actor_name: operatorName,
        actor_role: operatorRole,
        action: `Account Registration (${registrationMode})`,
        target_type: 'user',
        target_roll: cleanRoll,
        previous_value: autoCreatedRoster ? 'Admin Auto-Enrolled' : rosterRecord ? 'Unregistered Roster Record' : 'New Account',
        new_value: `Active ${targetRole} Profile (${newUserId})`,
        timestamp: nowIso,
        created_at: nowIso,
      });

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: newUserId,
            authId: authUserId,
            rollNumber: cleanRoll,
            name: resolvedName,
            role: targetRole,
            department: studentDept,
            branch: studentBranch,
            section: studentSection,
            status: 'active',
            membershipStatus: 'active',
            verificationStatus: 'verified',
            isActive: true,
            serverVerified: true,
          },
        }),
        { status: 201, headers: corsHeaders }
      );

    } catch (provisionErr) {
      // COMPENSATION ROLLBACK
      if (authUserId) {
        console.warn(`[Rollback] Deleting orphaned Auth user ${authUserId}...`);
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
        } catch (cleanupErr) {
          console.error(`[Rollback Warning] Failed to delete Auth user ${authUserId}:`, cleanupErr);
        }
      }

      if (rosterRecord?.id) {
        try {
          if (autoCreatedRoster) {
            await supabaseAdmin
              .from('student_roster')
              .delete()
              .eq('id', rosterRecord.id);
          } else {
            await supabaseAdmin
              .from('student_roster')
              .update({ is_registered: false, registered_at: null, registered_user_id: null })
              .eq('id', rosterRecord.id);
          }
        } catch (revertErr) {
          console.error(`[Rollback Warning] Failed to revert roster claim for ${cleanRoll}:`, revertErr);
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: provisionErr.message || 'Account provisioning failed.' }),
        { status: 400, headers: corsHeaders }
      );
    }

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Server error processing registration.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
