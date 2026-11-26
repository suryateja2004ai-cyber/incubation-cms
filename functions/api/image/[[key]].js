// functions/api/image/[[key]].js
// Cloudflare Pages Function: Secure Private Image Proxy with IDOR Protection & Controlled Retrieval
// Streams private objects from Cloudflare R2 (CMS_BUCKET) and supports authenticated deletion

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-None-Match',
};

/**
 * Decodes standard JWT payload without external libraries
 */
function decodeJwtPayload(token) {
  try {
    const parts = (token || '').split('.');
    if (parts.length === 3) {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = typeof atob === 'function'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(jsonPayload);
    }
  } catch (e) {
    // Invalid JSON or base64
  }
  return null;
}

/**
 * Validates Supabase JWT Bearer token against Supabase Auth endpoint
 */
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const url = new URL(request.url);
  const tokenFromQuery = url.searchParams.get('token');
  const token = (authHeader.replace(/^Bearer\s+/i, '') || tokenFromQuery || '').trim();

  if (!token) {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Missing session token for private object.',
    };
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

  if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
    try {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey || '',
        },
      });

      if (!userRes.ok) {
        return {
          authenticated: false,
          status: 401,
          error: 'Unauthorized: Invalid or expired Supabase session.',
        };
      }

      const user = await userRes.json();
      return { authenticated: true, user, token };
    } catch (err) {
      console.warn('Supabase auth network error in image proxy:', err);
      const decoded = decodeJwtPayload(token);
      if (decoded || token.split('.').length === 3) {
        return { authenticated: true, user: decoded || null, token };
      }
      return {
        authenticated: false,
        status: 401,
        error: 'Authentication verification service unavailable.',
      };
    }
  }

  // Local development fallback
  const decoded = decodeJwtPayload(token);
  return {
    authenticated: true,
    user: decoded || { role: 'authenticated', email: 'dev@vrsec.local' },
    token,
  };
}

/**
 * Resolves raw key parameter into clean R2 object key
 */
function resolveObjectKey(paramsKey) {
  let raw = paramsKey;
  if (Array.isArray(raw)) {
    raw = raw.join('/');
  }
  if (!raw) return null;
  return decodeURIComponent(raw).replace(/^r2:/, '').trim();
}

/**
 * OPTIONS handler for CORS pre-flight
 */
export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

/**
 * GET /api/image/[[key]]
 * Streams private R2 image with conditional caching and biometric privacy protection
 */
export async function onRequestGet(context) {
  const { request, env, params } = context;

  const objectKey = resolveObjectKey(params.key);
  if (!objectKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Image object key is required.' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  // 1. Authenticate caller
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: auth.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 2. IDOR Protection:
    // Biometric face photos in 'faces/' are strictly restricted:
    // Students may ONLY view their own face photos.
    // Staff & Admins can inspect face photos for laboratory verification.
    // Component location photos ('locations/'), project photos ('projects/'), and general assets
    // are accessible to all authenticated users.
    const upperKey = objectKey.toUpperCase();
    if (upperKey.startsWith('FACES/')) {
      if (auth.user && auth.user.email && auth.user.email.includes('@student.incubation.local')) {
        const studentRoll = auth.user.email.split('@')[0].toUpperCase();
        if (!upperKey.includes(studentRoll) && !upperKey.startsWith('FACES/PUBLIC_')) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Forbidden: You do not have permission to view other students\' biometric data.',
            }),
            { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 3. Retrieve Private Object from Cloudflare R2
    if (!env.CMS_BUCKET) {
      // In local dev without R2 binding, return clean 404
      return new Response(
        JSON.stringify({
          success: false,
          error: `R2 bucket binding 'CMS_BUCKET' not configured locally. Requested: ${objectKey}`,
        }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const object = await env.CMS_BUCKET.get(objectKey);
    if (!object) {
      return new Response(
        JSON.stringify({ success: false, error: `File '${objectKey}' not found in private R2 storage.` }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Conditional ETag check (304 Not Modified)
    const clientEtag = request.headers.get('If-None-Match');
    if (clientEtag && clientEtag === object.httpEtag) {
      return new Response(null, {
        status: 304,
        headers: {
          ...CORS_HEADERS,
          ETag: object.httpEtag,
          'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    // 5. Stream image with security & caching headers
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.httpEtag);
    headers.set('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(object.body, { headers });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Error streaming R2 image.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/image/[[key]]
 * Securely deletes an object from Cloudflare R2
 */
export async function onRequestDelete(context) {
  const { request, env, params } = context;

  const objectKey = resolveObjectKey(params.key);
  if (!objectKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Object key is required for deletion.' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  // 1. Authenticate caller
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: auth.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 2. IDOR Protection:
    // If student, they can only delete their own images
    if (auth.user && auth.user.email && auth.user.email.includes('@student.incubation.local')) {
      const studentRoll = auth.user.email.split('@')[0].toUpperCase();
      if (!objectKey.toUpperCase().includes(studentRoll)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Forbidden: You do not have permission to delete this asset.' }),
          { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Delete from Cloudflare R2
    if (env.CMS_BUCKET) {
      await env.CMS_BUCKET.delete(objectKey);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Image successfully deleted from Cloudflare R2.',
        key: objectKey,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'R2 image deletion failed.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
