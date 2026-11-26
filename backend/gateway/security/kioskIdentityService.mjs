// backend/gateway/security/kioskIdentityService.mjs
// Node.js Windows Gateway Service: DPAPI Protected Kiosk Station Identity Loader
//
// STRICT PRODUCTION SECURITY SPECIFICATION:
// 1. Production Mode: Environment variable fallback is DISABLED by default.
// 2. Hardware DPAPI Binding: The station identity key MUST be read and decrypted from the
//    Windows DPAPI-protected file (ProtectedData::LocalMachine).
// 3. Fail-Closed: If DPAPI decryption fails in production, startup halts immediately.
// 4. Zero Secret Leakage: The raw machine identity key is never logged to stdout, stderr,
//    written to unencrypted disk files, or included in error traces.
// 5. Test/Dev Guard: Fallback to KIOSK_MACHINE_IDENTITY_KEY is permitted ONLY when
//    explicitly configured via NODE_ENV='test' or NODE_ENV='development' with allowEnvFallback=true.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

export const DEFAULT_DPAPI_DIR = 'C:\\ProgramData\\VRSEC_LabGateway';
export const DEFAULT_DPAPI_FILE = path.join(DEFAULT_DPAPI_DIR, 'kiosk_machine_identity.dpapi');
export const DEFAULT_ENTROPY_FILE = path.join(DEFAULT_DPAPI_DIR, 'kiosk_machine_entropy.bin');

/**
 * Loads and decrypts the DPAPI-protected physical kiosk identity.
 *
 * @param {Object} [options]
 * @param {string} [options.dpapiFilePath]
 * @param {string} [options.entropyFilePath]
 * @param {boolean} [options.isDev=false] - Explicit flag for development/test mode
 * @param {boolean} [options.isTest=false] - Explicit flag for automated unit tests
 * @param {boolean} [options.allowEnvFallback=false] - Requires isDev or isTest to be true
 * @returns {string} The decrypted station machine identity key
 */
export function loadProtectedKioskMachineIdentity(options = {}) {
  const nodeEnv = (process.env.NODE_ENV || 'production').toLowerCase();
  const isExplicitDevOrTest = options.isDev === true || options.isTest === true || nodeEnv === 'test' || nodeEnv === 'development';
  const allowEnvFallback = isExplicitDevOrTest && options.allowEnvFallback === true;

  const dpapiFile = options.dpapiFilePath || DEFAULT_DPAPI_FILE;
  const entropyFile = options.entropyFilePath || DEFAULT_ENTROPY_FILE;

  // 1. Production Path: Windows DPAPI Hardware-Bound Decryption
  if (process.platform === 'win32' && fs.existsSync(dpapiFile) && fs.existsSync(entropyFile)) {
    try {
      // Execute in-memory DPAPI decryption via PowerShell
      // Secret is decrypted into memory stream only; zero disk output; stderr suppressed
      const script = `
        Add-Type -AssemblyName System.Security
        $enc = [System.IO.File]::ReadAllBytes('${dpapiFile.replace(/\\/g, '\\\\')}')
        $ent = [System.IO.File]::ReadAllBytes('${entropyFile.replace(/\\/g, '\\\\')}')
        $dec = [System.Security.Cryptography.ProtectedData]::Unprotect($enc, $ent, [System.Security.Cryptography.DataProtectionScope]::LocalMachine)
        [System.Text.Encoding]::UTF8.GetString($dec)
      `;

      const decrypted = execSync(`powershell -NoProfile -NonInteractive -Command "${script.trim()}"`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'], // Prevents leakage in stack traces or console output
        windowsHide: true,
      }).trim();

      if (decrypted && decrypted.length >= 32) {
        return decrypted;
      }
    } catch (unprotectErr) {
      console.error('[KIOSK SECURITY] DPAPI hardware decryption failed. Station identity inaccessible.');
    }
  }

  // 2. Strict Production Guard: Environment fallback is PROHIBITED in production
  if (!isExplicitDevOrTest) {
    throw new Error(
      'FATAL_PRODUCTION_DPAPI_REQUIRED: In production mode, DPAPI-protected machine identity is mandatory. ' +
      'Environment variable fallback is strictly disabled. Verify provisionKioskIdentity.ps1 has been run and ' +
      'NT AUTHORITY\\SYSTEM has read permissions to C:\\ProgramData\\VRSEC_LabGateway\\kiosk_machine_identity.dpapi.'
    );
  }

  // 3. Development / Test Isolation Path (Only reachable when isExplicitDevOrTest is true AND allowEnvFallback is true)
  if (allowEnvFallback) {
    const envKey = process.env.KIOSK_MACHINE_IDENTITY_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length >= 16) {
      return envKey.trim();
    }
  }

  // 4. Fail Closed: Terminate execution if identity could not be retrieved
  throw new Error('FATAL_KIOSK_IDENTITY_UNAVAILABLE: DPAPI machine identity is missing or unreadable. Gateway cannot start.');
}

/**
 * Computes a non-reversible SHA-256 fingerprint for audit and startup logging.
 * NEVER logs or exposes the underlying secret key.
 *
 * @param {string} key
 * @returns {string} Truncated hex fingerprint (e.g., 'a3f89c01...')
 */
export function getMachineIdentityFingerprint(key) {
  if (!key || typeof key !== 'string') return 'UNCONFIGURED';
  return crypto.createHash('sha256').update(key.trim()).digest('hex').substring(0, 16) + '...';
}
