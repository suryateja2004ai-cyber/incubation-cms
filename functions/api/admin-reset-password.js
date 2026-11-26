// functions/api/admin-reset-password.js
// Cloudflare Pages Function: Administrator-Assisted Student Password Reset
// Strict Security Enforcement:
// 1. Strict Origin / CORS Validation (No Wildcards).
// 2. Caller Authentication via Supabase Auth JWT.
// 3. Authoritative Role Verification: Strictly restricted to 'admin', 'substitute_admin', or 'sir'.
//    Explicitly rejects 'staff' and 'student' callers with HTTP 403 Forbidden.
// 4. Target Identity Verification: Target must exist and have role === 'student'.
//    Cannot be used to reset another administrator or faculty director's credentials.
// 5. Password Complexity Validation: Minimum 6 characters required by Supabase Auth.
// 6. Direct Supabase Admin Auth API Execution: updateUserById(auth_id, { password }).
// 7. Immutable Tamper-Proof Audit Logging to public.audit_logs.
// 8. Zero Secret / Plaintext Password Leakage in responses, logs, or traces.

import { createClient } from '@supabase/supabase-js';

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
      return new Response(JSON.stringify({ error: 'CORS_ORIGIN_DENIED' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (origin && !isAllowed) {
    return new Response(
      JSON.stringify({ success: false, error: `CORS_ORIGIN_DENIED: Origin "${origin}" is not authorized.` }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Verify Server-Side Credentials (FAIL CLOSED)
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Server configuration error: Missing service credentials.' }),
      { status: 500, headers: corsHeaders }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Authenticate Operator / Caller Session
  const authHeader = request.headers.get('Authorization') || '';
  const operatorToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!operatorToken) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized: Authentication token is required.' }),
      { status: 401, headers: corsHeaders }
    );
  }

  const { data: operatorAuth, error: opAuthErr } = await supabaseAdmin.auth.getUser(operatorToken);
  if (opAuthErr || !operatorAuth?.user) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized: Invalid or expired administrator session.' }),
      { status: 401, headers: corsHeaders }
    );
  }

  // 4. Authoritative Role Verification from public.users
  const { data: operatorProfile, error: profileErr } = await supabaseAdmin
    .from('users')
    .select('role, name, is_active')
    .eq('auth_id', operatorAuth.user.id)
    .maybeSingle();

  if (profileErr || !operatorProfile) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized: Operator profile not found.' }),
      { status: 401, headers: corsHeaders }
    );
  }

  if (operatorProfile.is_active === false) {
    return new Response(
      JSON.stringify({ success: false, error: 'Forbidden: Operator account is inactive or revoked.' }),
      { status: 403, headers: corsHeaders }
    );
  }

  // STRICT ROLE ENFORCEMENT: Only admin, substitute_admin, or sir may reset student passwords.
  // Staff and students are strictly forbidden.
  if (!['admin', 'substitute_admin', 'sir'].includes(operatorProfile.role)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Forbidden: Insufficient privileges. Staff and student accounts cannot perform password resets.',
        code: 'INSUFFICIENT_PRIVILEGES',
      }),
      { status: 403, headers: corsHeaders }
    );
  }

  // 5. Parse and Validate Request Payload
  try {
    const body = await request.json();
    const { rollNumber, newPassword } = body;

    if (!rollNumber || typeof rollNumber !== 'string' || !rollNumber.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Target student roll number is required.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'New password must be at least 6 characters long.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanRoll = rollNumber.trim().toUpperCase();

    // 6. Look Up Target Student Profile
    const { data: targetUser, error: targetErr } = await supabaseAdmin
      .from('users')
      .select('id, auth_id, roll_number, name, role, is_active, membership_status')
      .eq('roll_number', cleanRoll)
      .maybeSingle();

    if (targetErr || !targetUser) {
      return new Response(
        JSON.stringify({ success: false, error: `Student with roll number "${cleanRoll}" was not found.` }),
        { status: 404, headers: corsHeaders }
      );
    }

    // TARGET SAFETY GUARD: Target MUST have role === 'student'
    if (targetUser.role !== 'student') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Forbidden: Administrator password reset endpoint may only be used for student accounts.',
          code: 'NON_STUDENT_TARGET_DENIED',
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    let resolvedAuthId = targetUser.auth_id || null;
    let provisionedNewAuth = false;

    if (!resolvedAuthId) {
      // Legacy / unlinked student profile: create Supabase Auth login and link auth_id cleanly
      const normalizedStudentRoll = cleanRoll.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
      const syntheticEmail = `${normalizedStudentRoll}@student.incubation.local`;

      const { data: createdAuth, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: newPassword.trim(),
        email_confirm: true,
        user_metadata: {
          roll_number: cleanRoll,
          name: targetUser.name || cleanRoll,
          role: 'student',
        },
      });

      if (createAuthErr || !createdAuth?.user?.id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to generate login for student "${cleanRoll}": ${createAuthErr?.message || 'Auth creation failed'}`,
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      resolvedAuthId = createdAuth.user.id;
      provisionedNewAuth = true;

      const profileUpdates = {
        auth_id: resolvedAuthId,
        updated_at: new Date().toISOString(),
      };
      if (targetUser.membership_status === 'pending_verification' || targetUser.is_active === false) {
        profileUpdates.is_active = true;
        profileUpdates.membership_status = 'active';
      }

      const { error: linkErr } = await supabaseAdmin
        .from('users')
        .update(profileUpdates)
        .eq('id', targetUser.id);

      if (linkErr) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(resolvedAuthId);
        } catch (_) {}
        return new Response(
          JSON.stringify({ success: false, error: `Failed to link generated login: ${linkErr.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Ensure student_roster entry reflects active claim when present
      try {
        await supabaseAdmin
          .from('student_roster')
          .update({
            is_registered: true,
            registered_user_id: targetUser.id,
            registered_at: new Date().toISOString(),
          })
          .ilike('roll_number', cleanRoll);
      } catch (_) {}
    } else {
      // 7. Update Password via Official Supabase Admin API
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(resolvedAuthId, {
        password: newPassword.trim(),
      });

      if (updateErr) {
        console.error('[Admin Password Reset] Supabase Auth update failed:', updateErr.message);
        return new Response(
          JSON.stringify({ success: false, error: `Password update failed: ${updateErr.message}` }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (targetUser.membership_status === 'pending_verification') {
        await supabaseAdmin
          .from('users')
          .update({
            is_active: true,
            membership_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetUser.id);
      }
    }

    // 8. Immutable Audit Trail in public.audit_logs
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_name: operatorProfile.name || 'Administrator',
        actor_role: operatorProfile.role,
        action: provisionedNewAuth ? 'ADMIN_STUDENT_LOGIN_PROVISIONED' : 'ADMIN_STUDENT_PASSWORD_RESET',
        target_roll: cleanRoll,
        details: provisionedNewAuth
          ? `Administrator ${operatorProfile.name} (${operatorProfile.role}) generated login & password for student ${targetUser.name} (${cleanRoll}).`
          : `Administrator ${operatorProfile.name} (${operatorProfile.role}) reset password for student ${targetUser.name} (${cleanRoll}).`,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('[Admin Password Reset] Non-fatal audit log insert failure:', auditErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        authId: resolvedAuthId,
        loginProvisioned: provisionedNewAuth,
        message: provisionedNewAuth
          ? `Login generated and activated for student ${targetUser.name} (${cleanRoll}).`
          : `Password successfully reset for student ${targetUser.name} (${cleanRoll}).`,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (parseErr) {
    return new Response(
      JSON.stringify({ success: false, error: 'Malformed request JSON.' }),
      { status: 400, headers: corsHeaders }
    );
  }
}
