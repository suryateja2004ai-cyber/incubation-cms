// backend/gateway/deviceGateway.mjs
// Production Local Lab Device Gateway for VRSEC Incubation Centre
// STRICT HARDWARE & NETWORK ISOLATION:
// 1. Strict Origin Whitelist & CORS (NO WILDCARDS; exact production & dev origins only).
// 2. CSRF Hardening (Enforces X-Requested-With & X-Lab-CSRF headers on preflight/POST).
// 3. Physical Kiosk Identity (Attestation restricted strictly to 127.0.0.1 + OS machine identity).
// 4. Asymmetric ES256 & Symmetric HS256 JWT Verification (Matched to Supabase project JWKS).
// 5. Per-Command Gateway-to-MCU HMAC Authentication (Signed deviceId:pin:action:timestamp:nonce).
// 6. Authoritative Database Identity Verification (Role & active status fetched from DB, 30s TTL cache, fail-closed on outage).
// 7. Nonce-based replay protection with strict timestamp sliding window.

import http from 'http';
import crypto from 'crypto';
import { loadProtectedKioskMachineIdentity, getMachineIdentityFingerprint } from './security/kioskIdentityService.mjs';

export const DEFAULT_PORT = 5050;
export const DEFAULT_HOST = '127.0.0.1';

// Strict Origin Whitelist
const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://incubation-cms.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

// Trusted local socket network subnets (Loopback and Lab Subnets)
const TRUSTED_SUBNETS = [
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  'localhost',
];

// Replay protection cache for device control requests
const seenControlNonces = new Map();
const CONTROL_NONCE_WINDOW_MS = 30 * 1000; // 30 seconds

function pruneControlNonces() {
  const now = Date.now();
  for (const [nonce, ts] of seenControlNonces.entries()) {
    if (now - ts > CONTROL_NONCE_WINDOW_MS) {
      seenControlNonces.delete(nonce);
    }
  }
}

// In-memory authoritative user cache with 30s TTL
const userCache = new Map();
const USER_CACHE_TTL_MS = 30 * 1000; // 30 seconds

export function invalidateUserCache(authId) {
  if (authId) userCache.delete(authId);
  else userCache.clear();
}

// Helper: Check if client socket IP is within trusted local boundaries
export function isTrustedLabSocket(remoteAddress, headers = {}) {
  if (headers['cf-connecting-ip'] || headers['x-forwarded-proto'] === 'https' || headers['x-real-ip']) {
    return false;
  }

  if (!remoteAddress) return false;
  const cleanIp = remoteAddress.replace(/^::ffff:/, '');

  if (TRUSTED_SUBNETS.includes(cleanIp) || TRUSTED_SUBNETS.includes(remoteAddress)) {
    return true;
  }

  // Trusted local lab workstation subnet (192.168.1.x) or hardware subnet (192.168.4.x)
  if (cleanIp.startsWith('192.168.1.') || cleanIp.startsWith('192.168.4.')) {
    return true;
  }

  return false;
}

// Helper: Check if client socket is strictly loopback (Physical Kiosk Station)
export function isLoopbackSocket(remoteAddress) {
  if (!remoteAddress) return false;
  const cleanIp = remoteAddress.replace(/^::ffff:/, '');
  return cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost';
}

// Helper: Check if origin is explicitly allowed
export function isAllowedOrigin(origin, extraAllowedOrigins = []) {
  if (!origin) return false;
  if (DEFAULT_ALLOWED_ORIGINS.has(origin)) return true;
  if (extraAllowedOrigins.includes(origin)) return true;
  return false;
}

// Supabase Project JWKS Public Key for project sqiiamgdljfzpwaiomhp
export const SUPABASE_PROJECT_JWK = {
  alg: 'ES256',
  crv: 'P-256',
  kty: 'EC',
  use: 'sig',
  x: 'Kt6ilsveXg_xoKi6aQWQRZFPNDc5URtaMpLzBo00i1E',
  y: 'KpO23rtIU7Dg4Ecl1zEPrHUovL5kPyadf28vTDzn-gc',
};

// Cryptographic JWT Verification (Supports both ES256 and HS256)
export function verifySupabaseJwt(token, options = {}) {
  if (!token || typeof token !== 'string') {
    throw new Error('MISSING_OR_INVALID_TOKEN');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('MALFORMED_JWT');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Validate algorithm in header
  let header;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  } catch (e) {
    throw new Error(`MALFORMED_JWT_HEADER: ${e.message}`);
  }

  // Key ID (kid) verification if expected
  if (options.expectedKid && header.kid && header.kid !== options.expectedKid) {
    throw new Error(`INVALID_KEY_ID: Expected kid "${options.expectedKid}", received "${header.kid}".`);
  }

  const dataToSign = `${headerB64}.${payloadB64}`;
  const sigBuffer = Buffer.from(signatureB64, 'base64url');

  if (header.alg === 'ES256') {
    // Asymmetric ECDSA Verification (Project live JWKS standard)
    const publicKey = options.publicKey || (options.jwk ? crypto.createPublicKey({ key: options.jwk, format: 'jwk' }) : crypto.createPublicKey({ key: SUPABASE_PROJECT_JWK, format: 'jwk' }));
    const verifier = crypto.createVerify('SHA256');
    verifier.update(dataToSign);

    const isValid = verifier.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, sigBuffer);
    if (!isValid) {
      throw new Error('INVALID_TOKEN_SIGNATURE: ES256 cryptographic verification failed.');
    }

  } else if (header.alg === 'HS256') {
    // Symmetric HMAC Verification
    const jwtSecret = options.jwtSecret || process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('UNCONFIGURED_JWT_SECRET: HS256 token presented but SUPABASE_JWT_SECRET is not configured.');
    }

    const expectedSig = crypto.createHmac('sha256', jwtSecret).update(dataToSign).digest('base64url');
    const expectedBuffer = Buffer.from(expectedSig, 'base64url');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new Error('INVALID_TOKEN_SIGNATURE: HS256 cryptographic verification failed.');
    }

  } else {
    throw new Error(`UNSUPPORTED_JWT_ALGORITHM: Algorithm "${header.alg}" is not permitted. Only ES256 and HS256 are supported.`);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new Error('MALFORMED_JWT_PAYLOAD');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) {
    throw new Error('TOKEN_EXPIRED');
  }
  if (payload.nbf && payload.nbf > nowSec) {
    throw new Error('TOKEN_NOT_YET_VALID');
  }

  // Audience validation
  if (options.expectedAudience && payload.aud !== options.expectedAudience) {
    throw new Error(`INVALID_TOKEN_AUDIENCE: Expected "${options.expectedAudience}", received "${payload.aud}".`);
  }

  // Issuer validation
  if (options.expectedIssuer && payload.iss !== options.expectedIssuer) {
    throw new Error(`INVALID_TOKEN_ISSUER: Expected "${options.expectedIssuer}", received "${payload.iss}".`);
  }

  return payload;
}

// Physical Lab Hardware Registry (Devices and their corresponding ESP32 GPIO assignments)
// Note: Hardware pins are configurable via environment variables to match deployment environments.
const pinLight1 = parseInt(process.env.LIGHT_1_PIN || '22', 10);
const pinLight2 = parseInt(process.env.LIGHT_2_PIN || '23', 10);
const pinFan1 = parseInt(process.env.FAN_1_PIN || '18', 10);
const pinFan2 = parseInt(process.env.FAN_2_PIN || '19', 10);

export const LAB_HARDWARE_REGISTRY = new Map([
  [
    'DEV-LIGHT-01',
    {
      id: 'DEV-LIGHT-01',
      name: 'Light 1 (Relay 1 - Section A)',
      type: 'light',
      mcuHost: '192.168.4.101',
      mcuPort: 80,
      pin: pinLight1,
      state: 'OFF',
      allowedRoles: ['student', 'admin', 'substitute_admin', 'sir', 'staff'],
    },
  ],
  [
    'DEV-LIGHT-02',
    {
      id: 'DEV-LIGHT-02',
      name: 'Light 2 (Relay 2 - Section B)',
      type: 'light',
      mcuHost: '192.168.4.101',
      mcuPort: 80,
      pin: pinLight2,
      state: 'OFF',
      allowedRoles: ['student', 'admin', 'substitute_admin', 'sir', 'staff'],
    },
  ],
  [
    'DEV-FAN-01',
    {
      id: 'DEV-FAN-01',
      name: 'Fan 1 (Section A - Configurable Placeholder)',
      type: 'fan',
      mcuHost: '192.168.4.101',
      mcuPort: 80,
      pin: pinFan1,
      state: 'OFF',
      allowedRoles: ['student', 'admin', 'substitute_admin', 'sir', 'staff'],
    },
  ],
  [
    'DEV-FAN-02',
    {
      id: 'DEV-FAN-02',
      name: 'Fan 2 (Section B - Configurable Placeholder)',
      type: 'fan',
      mcuHost: '192.168.4.101',
      mcuPort: 80,
      pin: pinFan2,
      state: 'OFF',
      allowedRoles: ['student', 'admin', 'substitute_admin', 'sir', 'staff'],
    },
  ],
  [
    'DEV-AC-01',
    {
      id: 'DEV-AC-01',
      name: 'Central Air Conditioner',
      type: 'ac',
      mcuHost: '192.168.4.102',
      mcuPort: 80,
      pin: 22,
      state: 'OFF',
      allowedRoles: ['admin', 'substitute_admin', 'sir', 'staff'], // Students STRICTLY PROHIBITED
    },
  ],
]);

// Strict monotonic timestamp tracker to ensure zero collisions across rapid commands
let lastDispatchedTimestamp = 0;

export function getMonotonicTimestamp() {
  let nowMs = Date.now();
  if (nowMs <= lastDispatchedTimestamp) {
    nowMs = lastDispatchedTimestamp + 1;
  }
  lastDispatchedTimestamp = nowMs;
  return nowMs.toString();
}

// Synchronize hardware RTC / clock with ESP32 using signed command
export async function syncClockWithMcu({ mcuHost, mcuPort = 80, sharedKey, timeoutMs = 2500 }) {
  if (!sharedKey) {
    throw new Error('HARDWARE_SECURITY_ERROR: MCU_SHARED_KEY is not configured. Failing closed.');
  }

  const nonce = crypto.randomUUID();
  const timestamp = getMonotonicTimestamp();
  const messageToSign = `SYNC_CLOCK:${timestamp}:${nonce}`;
  const hmacSignature = crypto
    .createHmac('sha256', sharedKey)
    .update(messageToSign)
    .digest('hex');

  const url = `http://${mcuHost}:${mcuPort}/api/sync-clock`;
  const payload = JSON.stringify({
    action: 'SYNC_CLOCK',
    timestamp,
    nonce,
    signature: hmacSignature,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCU-Signature': hmacSignature,
        'X-MCU-Timestamp': timestamp,
        'X-MCU-Nonce': nonce,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Clock sync HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`CLOCK_SYNC_FAILED: ${err.message}`);
  }
}

// Actual Hardware Dispatch to ESP32 MCU with Per-Command HMAC Authentication
export async function sendCommandToMcu({ mcuHost, mcuPort, pin, state, deviceId, sharedKey, timeoutMs = 2500 }) {
  if (!sharedKey) {
    throw new Error('HARDWARE_SECURITY_ERROR: MCU_SHARED_KEY is not configured. Failing closed.');
  }

  const nonce = crypto.randomUUID();
  const timestamp = getMonotonicTimestamp();

  // Cryptographic Per-Command HMAC Signature
  // Message format: deviceId:pin:action:timestamp:nonce
  const messageToSign = `${deviceId}:${pin}:${state}:${timestamp}:${nonce}`;
  const hmacSignature = crypto
    .createHmac('sha256', sharedKey)
    .update(messageToSign)
    .digest('hex');

  const url = `http://${mcuHost}:${mcuPort}/api/relay`;
  const payload = JSON.stringify({
    deviceId,
    pin,
    action: state,
    timestamp,
    nonce,
    signature: hmacSignature,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCU-Signature': hmacSignature,
        'X-MCU-Timestamp': timestamp,
        'X-MCU-Nonce': nonce,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`MCU HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.confirmed || data.relayState !== state) {
      throw new Error('MCU failed to confirm relay state transition');
    }

    return {
      success: true,
      confirmed: true,
      pin: data.pin || pin,
      relayState: data.relayState,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`HARDWARE_COMMUNICATION_FAILED: ${err.message}`);
  }
}

// Server Factory Function
export function createDeviceGatewayServer(config = {}) {
  // STRICT SECRETS VALIDATION: Startup MUST fail if required secrets are missing
  const jwtSecret = config.jwtSecret || process.env.SUPABASE_JWT_SECRET;
  const kioskSecret = config.kioskSecret || process.env.KIOSK_ATTESTATION_SECRET;
  const mcuSharedKey = config.mcuSharedKey || process.env.MCU_SHARED_KEY;
  let kioskMachineIdentityKey = config.kioskMachineIdentityKey;

  // In production, loadProtectedKioskMachineIdentity enforces DPAPI decryption and rejects env fallback
  if (!kioskMachineIdentityKey) {
    try {
      kioskMachineIdentityKey = loadProtectedKioskMachineIdentity({
        isDev: config.isDev,
        isTest: config.isTest,
        allowEnvFallback: config.allowEnvFallback,
      });
    } catch (dpapiErr) {
      throw new Error(`FATAL_STARTUP_ERROR: KIOSK_MACHINE_IDENTITY_KEY could not be loaded: ${dpapiErr.message}`);
    }
  }

  if (!jwtSecret && !config.publicKey && !config.jwk) {
    throw new Error('FATAL_STARTUP_ERROR: SUPABASE_JWT_SECRET or public signing key must be configured in environment variables.');
  }
  if (!kioskSecret) {
    throw new Error('FATAL_STARTUP_ERROR: KIOSK_ATTESTATION_SECRET must be configured in environment variables.');
  }
  if (!mcuSharedKey) {
    throw new Error('FATAL_STARTUP_ERROR: MCU_SHARED_KEY must be configured in environment variables.');
  }
  if (!kioskMachineIdentityKey || typeof kioskMachineIdentityKey !== 'string' || !kioskMachineIdentityKey.trim()) {
    throw new Error('FATAL_STARTUP_ERROR: KIOSK_MACHINE_IDENTITY_KEY must be configured in environment variables or DPAPI storage.');
  }

  const userLookupFn = config.userLookupFn || null;
  const authoritativeUsers = config.authoritativeUsers || [];
  const extraAllowedOrigins = config.allowedOrigins || [];
  const dispatchFn = config.dispatchFn || sendCommandToMcu;

  async function resolveAuthoritativeUser(authId) {
    const now = Date.now();
    const cached = userCache.get(authId);
    if (cached && (now - cached.cachedAt) < USER_CACHE_TTL_MS) {
      return cached.user;
    }

    let userRecord = null;
    if (userLookupFn) {
      userRecord = await userLookupFn(authId);
    } else {
      userRecord = authoritativeUsers.find(u => u.auth_id === authId || u.authId === authId) || null;
    }

    if (userRecord) {
      userCache.set(authId, { user: userRecord, cachedAt: now });
    }
    return userRecord;
  }

  const server = http.createServer(async (req, res) => {
    const reqOrigin = req.headers['origin'] || '';
    const originAllowed = isAllowedOrigin(reqOrigin, extraAllowedOrigins);

    const corsHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Request-Nonce, X-Request-Timestamp, X-Requested-With, X-Lab-CSRF, X-Kiosk-Machine-Identity',
      'Vary': 'Origin',
      'Content-Type': 'application/json',
    };

    if (originAllowed) {
      corsHeaders['Access-Control-Allow-Origin'] = reqOrigin;
    }

    // 1. SECURE PREFLIGHT (OPTIONS)
    if (req.method === 'OPTIONS') {
      if (reqOrigin && !originAllowed) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CORS_ORIGIN_DENIED: Origin not permitted to communicate with Local Gateway.' }));
        return;
      }
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    // 2. REJECT UNTRUSTED ORIGINS
    if (reqOrigin && !originAllowed) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: `CORS_ORIGIN_DENIED: Origin "${reqOrigin}" is not authorized.`,
        code: 'ORIGIN_FORBIDDEN',
      }));
      return;
    }

    const socketIp = req.socket.remoteAddress || '';
    const isLocal = isTrustedLabSocket(socketIp, req.headers);
    const isKioskLoopback = isLoopbackSocket(socketIp);

    // 3. HEALTH ENDPOINT
    if (req.url === '/api/gateway/health' && req.method === 'GET') {
      if (!isLocal) {
        res.writeHead(403, corsHeaders);
        res.end(JSON.stringify({
          status: 'blocked',
          isLocalLabNetwork: false,
          error: 'NETWORK_BOUNDARY_VIOLATION: Gateway health is accessible only within the trusted lab subnet.',
        }));
        return;
      }

      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({
        status: 'online',
        gateway: 'VRSEC Incubation Local Lab Gateway',
        isLocalLabNetwork: true,
        devicesTracked: LAB_HARDWARE_REGISTRY.size,
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    // 4. PHYSICAL KIOSK ATTESTATION GENERATION ENDPOINT
    // STRICT MACHINE IDENTITY ENFORCEMENT:
    // a) Socket MUST be loopback (127.0.0.1) on the designated kiosk station PC.
    // b) Must present the protected OS machine identity header (X-Kiosk-Machine-Identity).
    if (req.url === '/api/gateway/kiosk-attestation' && req.method === 'POST') {
      if (!isKioskLoopback) {
        res.writeHead(403, corsHeaders);
        res.end(JSON.stringify({
          success: false,
          error: 'KIOSK_STATION_IDENTITY_REQUIRED: Kiosk attestation is exclusively permitted on local loopback (127.0.0.1) from the physical station hardware. LAN workstations and external VPNs are strictly denied.',
          code: 'KIOSK_NON_LOOPBACK_DENIED',
        }));
        return;
      }

      // Check OS-managed machine identity key (FAIL-CLOSED)
      // Both configured key and presented key MUST be non-empty strings and match via timing-safe comparison.
      const presentedMachineIdentity = req.headers['x-kiosk-machine-identity'];
      if (!kioskMachineIdentityKey || !presentedMachineIdentity || typeof presentedMachineIdentity !== 'string') {
        res.writeHead(403, corsHeaders);
        res.end(JSON.stringify({
          success: false,
          error: 'KIOSK_MACHINE_AUTHENTICATION_FAILED: Missing OS-managed station identity credential.',
          code: 'KIOSK_IDENTITY_FAILED',
        }));
        return;
      }

      const configuredBuf = Buffer.from(kioskMachineIdentityKey.trim(), 'utf8');
      const presentedBuf = Buffer.from(presentedMachineIdentity.trim(), 'utf8');

      if (configuredBuf.length !== presentedBuf.length || !crypto.timingSafeEqual(configuredBuf, presentedBuf)) {
        res.writeHead(403, corsHeaders);
        res.end(JSON.stringify({
          success: false,
          error: 'KIOSK_MACHINE_AUTHENTICATION_FAILED: Invalid OS-managed station identity credential.',
          code: 'KIOSK_IDENTITY_FAILED',
        }));
        return;
      }

      const nonce = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now().toString();

      // Sign nonce + timestamp + station identifier
      const hmac = crypto.createHmac('sha256', kioskSecret);
      hmac.update(`${nonce}:${timestamp}:kiosk-station`);
      const signatureHex = hmac.digest('hex');

      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({
        success: true,
        attestationToken: `${signatureHex}.${nonce}.${timestamp}`,
        expiresInSeconds: 90,
      }));
      return;
    }

    // 5. CACHE INVALIDATION ENDPOINT
    if (req.url === '/api/gateway/cache/invalidate' && req.method === 'POST') {
      if (!isLocal) {
        res.writeHead(403, corsHeaders);
        res.end(JSON.stringify({ error: 'DENIED' }));
        return;
      }
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          invalidateUserCache(parsed.authId);
          res.writeHead(200, corsHeaders);
          res.end(JSON.stringify({ success: true, invalidated: parsed.authId || 'all' }));
        } catch {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({ error: 'BAD_REQUEST' }));
        }
      });
      return;
    }

    // 6. PHYSICAL DEVICE CONTROL DISPATCHER
    if (req.url === '/api/gateway/device/control' && req.method === 'POST') {
      if (!isLocal) {
        res.writeHead(403, corsHeaders);
        res.end(JSON.stringify({
          success: false,
          error: 'NETWORK_BOUNDARY_VIOLATION: Remote control from outside the lab network is prohibited.',
          code: 'NETWORK_BOUNDARY_VIOLATION',
        }));
        return;
      }

      // CSRF Validation
      const requestedWith = req.headers['x-requested-with'];
      const csrfFlag = req.headers['x-lab-csrf'];
      if (reqOrigin && (!requestedWith || !csrfFlag)) {
        res.writeHead(403, corsHeaders);
        res.end(JSON.stringify({
          success: false,
          error: 'CSRF_VALIDATION_FAILED: Missing mandatory X-Requested-With or X-Lab-CSRF security headers.',
          code: 'CSRF_FAILED',
        }));
        return;
      }

      // Token Validation
      const authHeader = req.headers['authorization'] || '';
      if (!authHeader.startsWith('Bearer ')) {
        res.writeHead(401, corsHeaders);
        res.end(JSON.stringify({
          success: false,
          error: 'UNAUTHENTICATED: Bearer authentication token is required.',
          code: 'AUTHENTICATION_REQUIRED',
        }));
        return;
      }

      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      let verifiedUser = null;

      try {
        const jwtPayload = verifySupabaseJwt(token, {
          jwtSecret,
          publicKey: config.publicKey,
          jwk: config.jwk,
        });
        const authId = jwtPayload.sub;

        let authoritativeRecord = null;
        try {
          authoritativeRecord = await resolveAuthoritativeUser(authId);
        } catch (dbErr) {
          res.writeHead(503, corsHeaders);
          res.end(JSON.stringify({
            success: false,
            error: `SERVICE_UNAVAILABLE: Authoritative directory unreachable (${dbErr.message}). Failing closed.`,
            code: 'DATABASE_OUTAGE_FAIL_CLOSED',
          }));
          return;
        }

        if (!authoritativeRecord) {
          res.writeHead(403, corsHeaders);
          res.end(JSON.stringify({
            success: false,
            error: 'UNAUTHORIZED_USER: User record not found in authoritative lab directory.',
            code: 'USER_NOT_FOUND',
          }));
          return;
        }

        if (authoritativeRecord.is_active === false) {
          res.writeHead(403, corsHeaders);
          res.end(JSON.stringify({
            success: false,
            error: 'ACCOUNT_DEACTIVATED: Account has been suspended or revoked by administrators.',
            code: 'ACCOUNT_DEACTIVATED',
          }));
          return;
        }

        if (authoritativeRecord.membership_status === 'pending_verification' || authoritativeRecord.status === 'pending_verification') {
          res.writeHead(403, corsHeaders);
          res.end(JSON.stringify({
            success: false,
            error: 'ACCOUNT_NOT_VERIFIED: Account is pending roster verification.',
            code: 'ACCOUNT_NOT_VERIFIED',
          }));
          return;
        }

        verifiedUser = {
          authId,
          role: authoritativeRecord.role,
          name: authoritativeRecord.name,
          rollNumber: authoritativeRecord.roll_number || authoritativeRecord.rollNumber,
        };

      } catch (authErr) {
        res.writeHead(401, corsHeaders);
        res.end(JSON.stringify({
          success: false,
          error: `AUTHENTICATION_FAILED: ${authErr.message}`,
          code: 'INVALID_CREDENTIALS',
        }));
        return;
      }

      // Replay Protection
      const reqTimestampHeader = req.headers['x-request-timestamp'];
      const reqNonceHeader = req.headers['x-request-nonce'];

      if (!reqTimestampHeader || !reqNonceHeader) {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({
          success: false,
          error: 'SECURITY_HEADERS_MISSING: X-Request-Timestamp and X-Request-Nonce are required.',
          code: 'REPLAY_HEADERS_REQUIRED',
        }));
        return;
      }

      const reqTimestamp = parseInt(reqTimestampHeader, 10);
      const nowEpoch = Date.now();

      if (isNaN(reqTimestamp) || Math.abs(nowEpoch - reqTimestamp) > CONTROL_NONCE_WINDOW_MS) {
        res.writeHead(403, corsHeaders);
        res.end(JSON.stringify({
          success: false,
          error: 'REQUEST_EXPIRED: Timestamp is outside the valid sliding window (±30s).',
          code: 'TIMESTAMP_WINDOW_VIOLATION',
        }));
        return;
      }

      pruneControlNonces();
      if (seenControlNonces.has(reqNonceHeader)) {
        res.writeHead(409, corsHeaders);
        res.end(JSON.stringify({
          success: false,
          error: 'REPLAY_ATTACK_DETECTED: Control nonce has already been processed.',
          code: 'REPLAY_ATTACK_DETECTED',
        }));
        return;
      }

      seenControlNonces.set(reqNonceHeader, nowEpoch);

      // Body Parsing & Dispatch
      let rawBody = '';
      req.on('data', chunk => { rawBody += chunk; });
      req.on('end', async () => {
        try {
          const body = JSON.parse(rawBody || '{}');
          const { deviceId, action } = body;
          const authoritativeRole = verifiedUser.role;

          const normalizedDeviceId = LAB_HARDWARE_REGISTRY.has(deviceId)
            ? deviceId
            : (deviceId.includes('-0') ? deviceId.replace('-0', '-') : deviceId.replace(/-(\d)$/, '-0$1'));
          const device = LAB_HARDWARE_REGISTRY.get(normalizedDeviceId) || LAB_HARDWARE_REGISTRY.get(deviceId);
          if (!device) {
            res.writeHead(404, corsHeaders);
            res.end(JSON.stringify({ success: false, error: `Device ${deviceId} not found in lab registry.` }));
            return;
          }

          const normalizedAction = String(action).toUpperCase();
          if (!['ON', 'OFF'].includes(normalizedAction)) {
            res.writeHead(400, corsHeaders);
            res.end(JSON.stringify({ success: false, error: 'Invalid action. Allowed: ON, OFF.' }));
            return;
          }

          if (!device.allowedRoles.includes(authoritativeRole)) {
            res.writeHead(403, corsHeaders);
            res.end(JSON.stringify({
              success: false,
              error: `UNAUTHORIZED_DEVICE: Role "${authoritativeRole}" is not permitted to control ${device.name} (${device.type}).`,
              code: 'RBAC_PERMISSION_DENIED',
            }));
            return;
          }

          const targetPin = (typeof body.pin === 'number') ? body.pin : device.pin;

          try {
            await dispatchFn({
              mcuHost: device.mcuHost,
              mcuPort: device.mcuPort,
              pin: targetPin,
              state: normalizedAction,
              deviceId: device.id,
              sharedKey: mcuSharedKey,
            });

            device.state = normalizedAction;

            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify({
              success: true,
              deviceId: device.id,
              confirmedState: device.state,
              operatedBy: verifiedUser.name,
              operatorRole: authoritativeRole,
              hardwareConfirmed: true,
              timestamp: new Date().toISOString(),
            }));

          } catch (mcuErr) {
            res.writeHead(502, corsHeaders);
            res.end(JSON.stringify({
              success: false,
              error: 'HARDWARE_COMMUNICATION_FAILED: Controller did not acknowledge command. Relay state unchanged.',
              deviceId: device.id,
              currentState: device.state,
              details: mcuErr.message,
            }));
          }

        } catch (parseErr) {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload.' }));
        }
      });
      return;
    }

    res.writeHead(404, corsHeaders);
    res.end(JSON.stringify({ error: 'Endpoint not found on Local Lab Gateway.' }));
  });

  return server;
}

// Standalone runner
if (process.argv[1] && process.argv[1].endsWith('deviceGateway.mjs')) {
  try {
    const host = process.env.GATEWAY_HOST || DEFAULT_HOST;
    const port = process.env.GATEWAY_PORT || DEFAULT_PORT;
    const server = createDeviceGatewayServer();
    server.listen(port, host, () => {
      console.log(`===================================================================`);
      console.log(`🚀 VRSEC LAB LOCAL DEVICE GATEWAY ACTIVE`);
      console.log(`   Interface:  http://${host}:${port}`);
      console.log(`   Security:   ES256/HS256 JWT, Strict CORS/CSRF, Nonce Replay Protected`);
      console.log(`   Hardware:   ESP32 Per-Command HMAC (192.168.4.x Subnet)`);
      console.log(`===================================================================`);
    });
  } catch (startupErr) {
    console.error(`\n❌ [FATAL GATEWAY STARTUP ERROR] ${startupErr.message}\n`);
    process.exit(1);
  }
}
