// Copied from QuoteMGR src/lib/imageUtils.ts (read-only reference).
/**
 * Client-side image compression utility.
 *
 * Resizes + re-encodes any image to stay within dimension and byte limits.
 * Uses a canvas to draw the image then iterates quality down until the
 * blob fits the target size. Falls back to the original file on any error.
 *
 * HEIC/HEIF files (iPhone default format) are converted to JPEG via heic2any
 * before canvas processing because most browsers cannot natively decode HEIC.
 */

const isHeicFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    // Chrome/Windows reports type="" for HEIC — fall back to extension
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
};

/** Convert a HEIC/HEIF file to a JPEG blob using heic2any. */
const heicToJpeg = async (file: File): Promise<File> => {
  try {
    const heic2any = (await import('heic2any')).default;
    const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    const blob = Array.isArray(result) ? result[0] : result;
    return new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    // If conversion fails, return the original and let the canvas try
    return file;
  }
};

export interface CompressOptions {
  /** Longest side in pixels (default 1500). */
  maxSide?: number;
  /** Target byte size (default 1 MB). */
  targetBytes?: number;
  /** Starting JPEG quality, 0–1 (default 0.85). */
  quality?: number;
  /** Minimum JPEG quality before giving up (default 0.45). */
  minQuality?: number;
  /** Quality step to reduce per iteration (default 0.08). */
  qualityStep?: number;
}

export const compressImage = async (
  file: File,
  {
    maxSide    = 1500,
    targetBytes = 1_048_576,
    quality     = 0.85,
    minQuality  = 0.45,
    qualityStep = 0.08,
  }: CompressOptions = {}
): Promise<File> => {
  // Convert HEIC/HEIF to JPEG before canvas processing — browsers can't
  // decode HEIC natively (except Safari) and file.type is "" on Chrome.
  if (isHeicFile(file)) {
    file = await heicToJpeg(file);
  }

  return new Promise((resolve) => {
    const safetyTimer = setTimeout(() => resolve(file), 15_000);

    const img   = new Image();
    const objUrl = URL.createObjectURL(file);

    img.onerror = () => { clearTimeout(safetyTimer); URL.revokeObjectURL(objUrl); resolve(file); };

    img.onload = () => {
      clearTimeout(safetyTimer);
      URL.revokeObjectURL(objUrl);

      // Always resize if over maxSide — even if the file is already small,
      // a 4000px image served at 800px wide wastes egress.
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        if (width >= height) {
          height = Math.round((height / width) * maxSide);
          width  = maxSide;
        } else {
          width  = Math.round((width / height) * maxSide);
          height = maxSide;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const tryEncode = (q: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            // Accept if within target OR we've hit minimum quality
            if (blob.size <= targetBytes || q <= minQuality) {
              resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            } else {
              tryEncode(Math.max(q - qualityStep, minQuality));
            }
          },
          'image/jpeg',
          q
        );
      };

      // If already under target AND no resize needed, skip re-encoding
      if (file.size <= targetBytes && img.naturalWidth <= maxSide && img.naturalHeight <= maxSide) {
        resolve(file);
        return;
      }

      tryEncode(quality);
    };

    img.src = objUrl;
  });
};

/**
 * Recommended presets for each upload type.
 *
 * Usage:
 *   import { compressImage, COMPRESS_PRESETS } from '@/lib/imageUtils';
 *   const compressed = await compressImage(file, COMPRESS_PRESETS.quotePhoto);
 */
export const COMPRESS_PRESETS = {
  /** Inspection / proposal photos — shown ~800px wide in UI and PDF.
   * targetBytes kept well under the old 1MB: a quote's PDF embeds every
   * photo at full stored resolution regardless of its ~200px on-page
   * thumbnail size, so with 20-30+ photos on one quote the per-photo byte
   * budget is what actually decides whether the exported PDF stays a few
   * MB or balloons past 30MB. 350KB still holds plenty of detail for
   * inspection/damage documentation photos at this resolution. */
  quotePhoto: { maxSide: 1500, targetBytes: 350_000 } as CompressOptions,

  /** Sales rep headshot — shown ~160px in PDF sidebar */
  salesRepPhoto: { maxSide: 800, targetBytes: 250_000 } as CompressOptions,

  /** Company logo — shown ~120px in header */
  companyLogo: { maxSide: 600, targetBytes: 150_000 } as CompressOptions,

  /** Cover / hero photo — shown full-width in PDF cover page */
  coverPhoto: { maxSide: 1800, targetBytes: 700_000 } as CompressOptions,

  /**
   * Any other photo a person uploads (customer files, inspections, receipts, scans).
   * About 3 megapixels: sharp enough to open full screen and zoom into for damage
   * documentation, without keeping the 12-40 megapixels a phone camera produces.
   */
  fieldPhoto: { maxSide: 2048, targetBytes: 600_000, quality: 0.84 } as CompressOptions,
} as const;

/**
 * Scales an image down before it is stored, so Supabase does not fill up with
 * full-resolution camera files. Anything that is not a photo (PDFs, SVG and animated GIF
 * logos, documents) is returned untouched, and so is a small PNG (a logo or icon, where
 * transparency and sharp edges matter). Never returns a bigger file than it was given.
 */
export async function optimizeImageForUpload(
  file: File | Blob,
  options: CompressOptions = COMPRESS_PRESETS.fieldPhoto,
): Promise<File | Blob> {
  const type = (file.type || '').toLowerCase();
  const name = file instanceof File ? file.name : 'image';
  const looksLikeImage = type.startsWith('image/') || /\.(jpe?g|png|webp|hei[cf])$/i.test(name);
  if (!looksLikeImage) return file;
  if (type === 'image/svg+xml' || type === 'image/gif') return file;
  if ((type === 'image/png' || type === 'image/webp') && file.size <= 800_000) return file;
  try {
    const source = file instanceof File ? file : new File([file], name, { type: type || 'image/jpeg' });
    const optimized = await compressImage(source, options);
    if (!(optimized.size < file.size || isHeicFile(source))) return file;
    // The result is a JPEG, so its name says so too.
    return optimized.type === 'image/jpeg' && !/\.jpe?g$/i.test(optimized.name)
      ? new File([optimized], optimized.name.replace(/\.[^./]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: optimized.lastModified })
      : optimized;
  } catch {
    return file;
  }
}

/**
 * One-year browser cache control string for Supabase storage uploads.
 * Set this on every upload call so customers don't re-download photos on
 * every quote view — the single biggest egress reducer available for free.
 *
 * Usage:
 *   supabase.storage.from('bucket').upload(path, file, {
 *     contentType: 'image/jpeg',
 *     cacheControl: STORAGE_CACHE_CONTROL,
 *     upsert: true,
 *   });
 */
export const STORAGE_CACHE_CONTROL = '31536000'; // 1 year in seconds

// TrussCTR addition, used by ImageUpload.
export function formatFileSize(bytes: number): string {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
