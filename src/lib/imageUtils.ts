/**
 * Image compression utility.
 *
 * Resizes and compresses images before upload so Supabase storage never
 * holds 30 MP originals. The original photo stays on the device at full
 * resolution; the app uploads a web-optimised copy.
 *
 * Targets (per user spec):
 *   - Max dimension: 1 280 px on the longest side  (≈ 1280 × 720 landscape)
 *   - Target size:   < 200 KB, ideally < 100 KB
 *   - Format:        JPEG (universal, smaller than PNG for photos)
 *
 * Approach:
 *   1. Resize to maxPx on the longest side.
 *   2. Encode at initial quality (0.80).
 *   3. If still over targetBytes, reduce quality in steps until under
 *      targetBytes or quality floor (0.40) is reached.
 */

export interface CompressOptions {
  /** Max px on the longest side. Default: 1280 */
  maxPx?: number;
  /** Starting JPEG quality 0–1. Default: 0.80 */
  quality?: number;
  /** Target file size in bytes. Iterates quality downward if exceeded. Default: 150_000 (150 KB) */
  targetBytes?: number;
  /** Minimum quality floor. Default: 0.40 */
  minQuality?: number;
}

/**
 * Compress an image File to a web-optimised JPEG.
 * Falls back to the original if anything fails.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const {
    maxPx      = 1280,
    quality    = 0.80,
    targetBytes = 150_000,   // 150 KB
    minQuality  = 0.40,
  } = options;

  // Only process image files
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // ── Step 1: resize ───────────────────────────────────────────────────
      const longestSide = Math.max(img.width, img.height);
      const scale = longestSide > maxPx ? maxPx / longestSide : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);

      // ── Step 2: encode, then reduce quality until under targetBytes ──────
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';

      const tryEncode = (q: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }

            // Still over limit and we have room to reduce quality
            if (blob.size > targetBytes && q - 0.08 >= minQuality) {
              tryEncode(q - 0.08);
              return;
            }

            resolve(new File([blob], name, {
              type: 'image/jpeg',
              lastModified: file.lastModified,
            }));
          },
          'image/jpeg',
          q,
        );
      };

      tryEncode(quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/** Human-readable file size, e.g. "94 KB" */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
