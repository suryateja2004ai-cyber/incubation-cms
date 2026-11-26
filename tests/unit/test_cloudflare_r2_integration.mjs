// tests/unit/test_cloudflare_r2_integration.mjs
// Comprehensive Cloudflare R2 Integration & Storage Service Test Suite

import assert from 'assert';
import fs from 'fs';

// Mock localStorage for node environment
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
global.window = { localStorage: localStorageMock };
global.localStorage = localStorageMock;

// Import functions and services
import { onRequestPost, onRequestDelete as onUploadDelete } from '../../functions/api/upload.js';
import { onRequestGet, onRequestDelete as onImageDelete } from '../../functions/api/image/[[key]].js';
import storageService, {
  STORAGE_CATEGORIES,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from '../../frontend/src/services/storage/storageService.js';
import {
  getLocationPhotoUrl,
  checkCloudStorageAvailability,
} from '../../frontend/src/services/storage/componentPhotoStorageService.js';

console.log('🧪 Starting Cloudflare R2 Integration Test Suite...\n');

let passedTests = 0;

function runTest(name, fn) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        console.log(`  ✓ ${name}`);
        passedTests++;
      }).catch((err) => {
        console.error(`  ✗ FAIL: ${name}`);
        console.error(err);
        process.exit(1);
      });
    } else {
      console.log(`  ✓ ${name}`);
      passedTests++;
    }
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// In-Memory Mock Cloudflare R2 Bucket
class MockR2Bucket {
  constructor() {
    this.objects = new Map();
  }

  async put(key, body, options = {}) {
    const buffer = body instanceof ArrayBuffer ? Buffer.from(body) : Buffer.from(body);
    this.objects.set(key, {
      body: buffer,
      httpMetadata: options.httpMetadata || {},
      customMetadata: options.customMetadata || {},
      httpEtag: `W/"mock-etag-${key}-${Date.now()}"`,
      writeHttpMetadata(headers) {
        if (options.httpMetadata?.contentType) {
          headers.set('Content-Type', options.httpMetadata.contentType);
        }
        if (options.httpMetadata?.cacheControl) {
          headers.set('Cache-Control', options.httpMetadata.cacheControl);
        }
      },
    });
    return this.objects.get(key);
  }

  async get(key) {
    return this.objects.get(key) || null;
  }

  async delete(key) {
    this.objects.delete(key);
    return true;
  }
}

async function runAllTests() {
  const mockBucket = new MockR2Bucket();
  const mockEnv = {
    CMS_BUCKET: mockBucket,
    SUPABASE_URL: 'https://placeholder.supabase.co',
    SUPABASE_ANON_KEY: 'placeholder-anon-key',
  };

  const validJwt = 'header.payload.signature';

  // --- 1. INVARIANT CHECKS ---
  runTest('Invariant Check: sampleData.js is exactly 22,676 bytes', () => {
    const size = fs.statSync('frontend/src/db/sampleData.js').size;
    assert.strictEqual(size, 22676);
  });

  runTest('Invariant Check: data_base_backup.js is exactly 61,794 bytes', () => {
    const size = fs.statSync('frontend/src/db/data_base_backup.js').size;
    assert.strictEqual(size, 61794);
  });

  // --- 2. UPLOAD FUNCTION: AUTHENTICATION & VALIDATION ---
  await runTest('R2 Upload: Rejects request missing Supabase token with 401', async () => {
    const req = new Request('https://incubation.vrsec.ac.in/api/upload', {
      method: 'POST',
      body: Buffer.from('test-image'),
    });
    const res = await onRequestPost({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('Missing Supabase authentication token'));
  });

  await runTest('R2 Upload: Rejects invalid MIME type (e.g. application/pdf) with 400', async () => {
    const req = new Request('https://incubation.vrsec.ac.in/api/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validJwt}`,
        'Content-Type': 'application/pdf',
      },
      body: Buffer.from('%PDF-1.4...'),
    });
    const res = await onRequestPost({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('Invalid file type'));
  });

  await runTest('R2 Upload: Rejects oversized file (> 5 MB) with 413', async () => {
    // 5.5 MB payload
    const largeBuffer = new Uint8Array(5.5 * 1024 * 1024);
    const req = new Request('https://incubation.vrsec.ac.in/api/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validJwt}`,
        'Content-Type': 'image/jpeg',
      },
      body: largeBuffer,
    });
    const res = await onRequestPost({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 413);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('exceeds maximum allowed limit'));
  });

  await runTest('R2 Upload: Rejects empty file (0 bytes) with 400', async () => {
    const req = new Request('https://incubation.vrsec.ac.in/api/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validJwt}`,
        'Content-Type': 'image/jpeg',
      },
      body: new Uint8Array(0),
    });
    const res = await onRequestPost({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // --- 3. UPLOAD FUNCTION: SUCCESSFUL STORAGE & UNIQUE KEY GENERATION ---
  let uploadedComponentKey = '';
  await runTest('R2 Upload: Successful upload generates unique key, stores in R2, and returns r2: reference', async () => {
    const imageBytes = Buffer.from('FAKE-WEBP-BINARY-DATA-BYTES');
    const req = new Request('https://incubation.vrsec.ac.in/api/upload?category=locations&entityId=ESP32_001', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validJwt}`,
        'Content-Type': 'image/webp',
      },
      body: imageBytes,
    });
    const res = await onRequestPost({ request: req, env: mockEnv });
    assert.strictEqual(res.status, 201);
    const data = await res.json();

    assert.strictEqual(data.success, true);
    assert.ok(data.key.startsWith('locations/ESP32_001_'));
    assert.ok(data.key.endsWith('.webp'));
    assert.strictEqual(data.ref, `r2:${data.key}`);
    assert.strictEqual(data.url, `/api/image/${encodeURIComponent(data.key)}`);
    assert.strictEqual(data.sizeBytes, imageBytes.length);

    uploadedComponentKey = data.key;

    // Verify object was actually written to R2 mock bucket
    const r2Obj = await mockBucket.get(data.key);
    assert.ok(r2Obj, 'Object must exist in R2 bucket');
    assert.strictEqual(r2Obj.httpMetadata.contentType, 'image/webp');
  });

  // --- 4. IMAGE RETRIEVAL & STREAMING ---
  await runTest('R2 Retrieval: GET /api/image/[[key]] streams image with caching & security headers', async () => {
    const req = new Request(`https://incubation.vrsec.ac.in/api/image/${encodeURIComponent(uploadedComponentKey)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validJwt}`,
      },
    });
    const res = await onRequestGet({
      request: req,
      env: mockEnv,
      params: { key: uploadedComponentKey },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('Content-Type'), 'image/webp');
    assert.strictEqual(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.ok(res.headers.get('Cache-Control').includes('max-age'));
    assert.ok(res.headers.get('ETag'));

    const bodyBuffer = await res.arrayBuffer();
    assert.strictEqual(bodyBuffer.byteLength, Buffer.from('FAKE-WEBP-BINARY-DATA-BYTES').length);
  });

  await runTest('R2 Retrieval: Returns 304 Not Modified when client ETag matches', async () => {
    const r2Obj = await mockBucket.get(uploadedComponentKey);
    const req = new Request(`https://incubation.vrsec.ac.in/api/image/${encodeURIComponent(uploadedComponentKey)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validJwt}`,
        'If-None-Match': r2Obj.httpEtag,
      },
    });
    const res = await onRequestGet({
      request: req,
      env: mockEnv,
      params: { key: uploadedComponentKey },
    });
    assert.strictEqual(res.status, 304);
  });

  await runTest('R2 Retrieval: Missing image key returns 404', async () => {
    const req = new Request('https://incubation.vrsec.ac.in/api/image/non_existent_image.webp', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validJwt}`,
      },
    });
    const res = await onRequestGet({
      request: req,
      env: mockEnv,
      params: { key: 'non_existent_image.webp' },
    });
    assert.strictEqual(res.status, 404);
  });

  // --- 5. IDOR & BIOMETRIC PRIVACY PROTECTION ---
  await runTest('R2 IDOR Protection: Students are forbidden from viewing other students face photos', async () => {
    // Put another student's face photo in R2
    const otherStudentKey = 'faces/238W1A0499_123456_abc.jpg';
    await mockBucket.put(otherStudentKey, Buffer.from('FACE-DATA'), {
      httpMetadata: { contentType: 'image/jpeg' },
    });

    // Student 238W1A0477 JWT
    const studentPayload = Buffer.from(JSON.stringify({
      id: 'stud-1',
      email: '238W1A0477@student.incubation.local',
      role: 'authenticated',
    })).toString('base64');
    const studentJwt = `header.${studentPayload}.signature`;

    const req = new Request(`https://incubation.vrsec.ac.in/api/image/${encodeURIComponent(otherStudentKey)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${studentJwt}`,
      },
    });

    // Use a context where caller is student 238W1A0477
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({
          id: 'stud-1',
          email: '238W1A0477@student.incubation.local',
          role: 'authenticated',
        }), { status: 200 });
      }
      return originalFetch(url);
    };

    try {
      const res = await onRequestGet({
        request: req,
        env: { ...mockEnv, SUPABASE_URL: 'https://incubation.supabase.co' },
        params: { key: otherStudentKey },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.includes('Forbidden'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  // --- 6. SECURE IMAGE DELETION ---
  await runTest('R2 Deletion: DELETE /api/image/[[key]] removes object from R2 bucket', async () => {
    assert.ok(await mockBucket.get(uploadedComponentKey), 'Object exists before deletion');

    const req = new Request(`https://incubation.vrsec.ac.in/api/image/${encodeURIComponent(uploadedComponentKey)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${validJwt}`,
      },
    });
    const res = await onImageDelete({
      request: req,
      env: mockEnv,
      params: { key: uploadedComponentKey },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.key, uploadedComponentKey);

    assert.strictEqual(await mockBucket.get(uploadedComponentKey), null, 'Object was deleted from R2');
  });

  await runTest('R2 Deletion: DELETE /api/upload?key=... also removes object from R2 bucket', async () => {
    const tempKey = 'projects/test_proj_001.png';
    await mockBucket.put(tempKey, Buffer.from('PROJECT-IMAGE'), {
      httpMetadata: { contentType: 'image/png' },
    });
    assert.ok(await mockBucket.get(tempKey));

    const req = new Request(`https://incubation.vrsec.ac.in/api/upload?key=${encodeURIComponent(tempKey)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${validJwt}`,
      },
    });
    const res = await onUploadDelete({
      request: req,
      env: mockEnv,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(await mockBucket.get(tempKey), null);
  });

  // --- 7. FRONTEND STORAGE SERVICE ---
  runTest('Frontend StorageService: validateImageFile accepts valid images and rejects invalid ones', () => {
    // Valid JPEG
    assert.strictEqual(
      storageService.validateImageFile({ size: 1024 * 500, type: 'image/jpeg' }),
      true
    );
    // Valid WebP
    assert.strictEqual(
      storageService.validateImageFile({ size: 1024 * 800, type: 'image/webp' }),
      true
    );

    // Reject non-image
    assert.throws(() => {
      storageService.validateImageFile({ size: 1024 * 50, type: 'application/pdf' });
    }, /Unsupported file type/);

    // Reject oversized file (> 5 MB)
    assert.throws(() => {
      storageService.validateImageFile({ size: 6 * 1024 * 1024, type: 'image/png' });
    }, /exceeds maximum allowed limit/);
  });

  runTest('Frontend StorageService: getImageUrl correctly formats r2: references and passes through URLs', () => {
    // Reference format
    const formatted = storageService.getImageUrl('r2:locations/ESP32_001.webp');
    assert.strictEqual(formatted, '/api/image/locations%2FESP32_001.webp');

    // With auth token
    const withToken = storageService.getImageUrl('r2:faces/238W1A0477.jpg', { token: 'my-jwt-token' });
    assert.strictEqual(withToken, '/api/image/faces%2F238W1A0477.jpg?token=my-jwt-token');

    // External URL passthrough
    const httpUrl = 'https://images.unsplash.com/photo-1234';
    assert.strictEqual(storageService.getImageUrl(httpUrl), httpUrl);

    // Data URL passthrough
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE...';
    assert.strictEqual(storageService.getImageUrl(dataUrl), dataUrl);

    // Null handling
    assert.strictEqual(storageService.getImageUrl(null), null);
    assert.strictEqual(storageService.getImageUrl(''), null);
  });

  runTest('Frontend StorageService: isR2Reference and extractR2Key identify canonical references', () => {
    assert.strictEqual(storageService.isR2Reference('r2:locations/boxA.webp'), true);
    assert.strictEqual(storageService.isR2Reference('https://storage.com/boxA.webp'), false);
    assert.strictEqual(storageService.extractR2Key('r2:locations/boxA.webp'), 'locations/boxA.webp');
  });

  await runTest('Frontend ComponentPhotoStorageService: getLocationPhotoUrl resolves refs for UI', () => {
    const url = getLocationPhotoUrl('r2:locations/cabinet_b.webp');
    assert.strictEqual(url, '/api/image/locations%2Fcabinet_b.webp');
  });

  console.log(`\n🎉 ALL ${passedTests} CLOUDFLARE R2 INTEGRATION TESTS PASSED SUCCESSFULLY!`);
}

runAllTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
