// functions/api/face/[[path]].js
// Cloudflare Pages Function: Proxy & Graceful Fallback for Face Recognition Service

export async function onRequest(context) {
  const { request, env, params } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rawBackend = (env.FACE_API_URL || env.VITE_FACE_API_URL || '').trim();
  const backendBase = rawBackend.replace(/\/+$/, '');

  if (!backendBase) {
    return new Response(
      JSON.stringify({
        status: 'offline',
        engine_ready: false,
        is_cloud_deployment: true,
        message: 'Local Face Recognition service runs on the local Windows machine. Start the local server (npm run face:start) on localhost to enable live webcam attendance.',
      }),
      { status: 503, headers: corsHeaders }
    );
  }

  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  const targetUrl = `${backendBase}/api/face/${path}`;

  try {
    const backendRes = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
      },
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
    });

    const data = await backendRes.text();
    return new Response(data, {
      status: backendRes.status,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: 'offline',
        engine_ready: false,
        error: `Could not reach local face recognition service: ${err.message}`,
      }),
      { status: 502, headers: corsHeaders }
    );
  }
}
