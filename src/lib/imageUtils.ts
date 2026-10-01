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

/**
 * Convert a HEIC/HEIF file to JPEG.
 *
 * heic-to (libheif 1.22) is tried first: heic2any is built on a libheif from 2021 and cannot
 * read some newer iPhone HEIC photos, which is how an unconvertible original used to reach
 * storage and show as a black box in Chrome. heic2any stays as the fallback.
 */
const heicToJpeg = async (file: File): Promise<File> => {
  const asJpegFile = (blob: Blob) =>
    new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

  try {
    const { heicTo } = await import('heic-to');
    const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
    return asJpegFile(blob);
  } catch {
    // fall through to the older converter
  }

  try {
    const heic2any = (await import('heic2any')).default;
    const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    return asJpegFile(Array.isArray(result) ? result[0] : result);
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

/** True when this browser can actually draw the file as an image. */
export const canBrowserDecode = (file: Blob): Promise<boolean> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    img.onload = () => done(img.naturalWidth > 0);
    img.onerror = () => done(false);
    setTimeout(() => done(false), 10_000);
    img.src = url;
  });

/**
 * True when the image is solid black. Some iPhone HEIC photos "convert" without error but
 * come out entirely black; they decode fine, so a decode check alone passes them.
 * Samples a 48x48 downscale and treats it as blank only if every sampled pixel is near-black,
 * so a dark but real photo (night shot, shadowed roof) is not mistaken for one.
 */
export const isSolidBlack = (file: Blob): Promise<boolean> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const finish = (blank: boolean) => {
      URL.revokeObjectURL(url);
      resolve(blank);
    };
    img.onerror = () => finish(false);
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(false);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let brightest = 0;
        for (let i = 0; i < data.length; i += 4) {
          brightest = Math.max(brightest, data[i], data[i + 1], data[i + 2]);
          if (brightest > 12) return finish(false);
        }
        finish(true);
      } catch {
        finish(false);
      }
    };
    img.src = url;
  });

/**
 * compressImage, but never hands back a file the browser cannot show.
 *
 * compressImage falls back to the ORIGINAL file whenever HEIC conversion or canvas decoding
 * fails. Uploading that (as callers did, labelled image/jpeg) stores bytes that Chrome cannot
 * draw: the photo appears as a black box with a broken-image icon, forever. Better to say so
 * at upload time.
 */
export const compressForUpload = async (file: File, options?: CompressOptions): Promise<File> => {
  const out = await compressImage(file, options);
  if ((await canBrowserDecode(out)) && (await isSolidBlack(out))) {
    throw new Error(
      `${file.name} came out completely black when it was converted. ` +
        'This happens with some iPhone HEIC photos -- try Safari, or send the photo as a JPEG.',
    );
  }
  if (!(await canBrowserDecode(out))) {
    throw new Error(
      `${file.name} could not be converted to a photo this browser can show. ` +
        'iPhone HEIC photos can fail outside Safari -- try Safari, or send the photo as a JPEG.',
    );
  }
  return out;
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
} as const;

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
