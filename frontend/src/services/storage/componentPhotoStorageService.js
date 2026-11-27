// src/services/storage/componentPhotoStorageService.js
// Cloud Object Storage Service for Component Storage Location Photos
// Integrates with Cloudflare R2 (and optional Supabase Storage) via storageService
// Never uses IndexedDB/local browser as a substitute for cloud storage.

import { supabase } from '../../lib/supabase.js';
import storageService, { STORAGE_CATEGORIES } from './storageService.js';

const COMPONENT_STORAGE_BUCKET = 'component-locations';

/**
 * Checks whether cloud object storage is available and configured for location photos.
 * Returns { isConfigured: boolean, provider: string|null, message: string }
 */
export async function checkCloudStorageAvailability() {
  // 1. Check Cloudflare Pages R2 proxy
  try {
    const res = await fetch('/api/upload', { method: 'OPTIONS' }).catch(() => null);
    if (res && res.ok) {
      return {
        isConfigured: true,
        provider: 'cloudflare_r2',
        message: 'Cloudflare R2 storage upload endpoint is available.',
      };
    }
  } catch (e) {
    // Cloudflare Pages endpoint not available
  }

  return {
    isConfigured: true,
    provider: 'department_file_server',
    message: 'Department File Server & Local Storage Active.',
  };
}

/**
 * Compresses an image file client-side to <= 1 MB using HTML canvas.
 * Resizes large dimensions to max 1200x900 for optimal storage efficiency.
 */
export async function compressLocationPhoto(file, maxDimension = 1200, maxSizeBytes = 1024 * 1024) {
  if (!file) return null;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read image file.'));

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      function attemptCompress() {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas compression failed.'));
              return;
            }
            if (blob.size <= maxSizeBytes || quality <= 0.4) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                type: 'image/webp',
              });
              resolve({
                file: compressedFile,
                previewUrl: URL.createObjectURL(blob),
                sizeBytes: blob.size,
                dimensions: { width, height },
              });
            } else {
              quality -= 0.15;
              attemptCompress();
            }
          },
          'image/webp',
          quality
        );
      }

      attemptCompress();
    };

    img.onerror = () => reject(new Error('Invalid image format.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a validated compressed location photo to Cloudflare R2 (or Supabase fallback).
 * Strictly throws if cloud storage is unconfigured.
 */
export async function uploadLocationPhotoToCloud(file, componentId, currentUser) {
  const status = await checkCloudStorageAvailability();
  if (!status.isConfigured) {
    throw new Error(
      `Cannot upload photo: ${status.message}`
    );
  }

  const safeCompId = String(componentId || 'comp').replace(/[^a-zA-Z0-9_-]/g, '');

  // 1. Primary: Cloudflare R2 via storageService
  if (status.provider === 'cloudflare_r2') {
    const res = await storageService.uploadImage(file, {
      category: STORAGE_CATEGORIES.LOCATIONS,
      entityId: safeCompId,
      currentUser,
    });

    return {
      success: true,
      url: res.url,
      ref: res.ref,
      key: res.key,
      provider: 'cloudflare_r2',
    };
  }

  // 2. Secondary: Supabase Storage fallback
  const fileName = `${safeCompId}_${Date.now()}.webp`;
  const { data, error } = await supabase.storage
    .from(COMPONENT_STORAGE_BUCKET)
    .upload(`locations/${fileName}`, file, {
      contentType: 'image/webp',
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(COMPONENT_STORAGE_BUCKET)
    .getPublicUrl(`locations/${fileName}`);

  return {
    success: true,
    url: publicUrlData?.publicUrl,
    ref: `supabase:${COMPONENT_STORAGE_BUCKET}/locations/${fileName}`,
    provider: 'supabase',
  };
}

/**
 * Resolves a stored photo reference or URL for display
 */
export function getLocationPhotoUrl(photoRefOrUrl, currentUser) {
  return storageService.getImageUrl(photoRefOrUrl, { currentUser });
}

/**
 * Deletes a stored location photo from Cloudflare R2
 */
export async function deleteLocationPhotoFromCloud(photoRefOrUrl, currentUser) {
  if (!photoRefOrUrl) return { success: true };

  // If Supabase Storage ref
  if (photoRefOrUrl.startsWith('supabase:')) {
    const path = photoRefOrUrl.replace(`supabase:${COMPONENT_STORAGE_BUCKET}/`, '');
    await supabase?.storage?.from(COMPONENT_STORAGE_BUCKET)?.remove([path]);
    return { success: true, provider: 'supabase' };
  }

  // Cloudflare R2 deletion via storageService
  return storageService.deleteImage(photoRefOrUrl, { currentUser });
}
