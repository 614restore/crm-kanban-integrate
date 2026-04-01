export type PhotoQualityPresetId = 'standard_3mp' | 'high_8mp';

export interface PhotoQualityPreset {
  id: PhotoQualityPresetId;
  label: string;
  width: number;
  height: number;
  maxMegapixels: number;
  jpegQuality: number;
}

export const PHOTO_QUALITY_PRESETS: Record<PhotoQualityPresetId, PhotoQualityPreset> = {
  standard_3mp: {
    id: 'standard_3mp',
    label: 'Standard (3MP)',
    width: 2048,
    height: 1536,
    maxMegapixels: 3.2,
    jpegQuality: 0.84,
  },
  high_8mp: {
    id: 'high_8mp',
    label: 'High (8MP)',
    width: 3264,
    height: 2448,
    maxMegapixels: 8.1,
    jpegQuality: 0.88,
  },
};

export const DEFAULT_PHOTO_QUALITY_PRESET: PhotoQualityPresetId = 'standard_3mp';

export const CLOUD_VIDEO_POLICY = {
  maxBytes: 200 * 1024 * 1024,
  maxWidth: 1920,
  maxHeight: 1080,
  preferredFrameRate: 30,
};

interface ScaleResult {
  width: number;
  height: number;
}

function computeScaledDimensions(
  inputWidth: number,
  inputHeight: number,
  maxWidth: number,
  maxHeight: number,
  maxMegapixels: number
): ScaleResult {
  if (inputWidth <= 0 || inputHeight <= 0) {
    return { width: maxWidth, height: maxHeight };
  }

  const ratioByBounds = Math.min(maxWidth / inputWidth, maxHeight / inputHeight, 1);
  let width = Math.max(1, Math.round(inputWidth * ratioByBounds));
  let height = Math.max(1, Math.round(inputHeight * ratioByBounds));

  const currentMegapixels = (width * height) / 1_000_000;
  if (currentMegapixels > maxMegapixels) {
    const pixelRatio = Math.sqrt((maxMegapixels * 1_000_000) / (width * height));
    width = Math.max(1, Math.floor(width * pixelRatio));
    height = Math.max(1, Math.floor(height * pixelRatio));
  }

  return { width, height };
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function compressImageToPhotoPreset(
  input: File | Blob,
  presetId: PhotoQualityPresetId = DEFAULT_PHOTO_QUALITY_PRESET,
  outputFileName = 'photo.jpg'
): Promise<File> {
  const preset = PHOTO_QUALITY_PRESETS[presetId];
  const image = await loadImageFromBlob(input);
  const scaled = computeScaledDimensions(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    preset.width,
    preset.height,
    preset.maxMegapixels
  );

  const canvas = document.createElement('canvas');
  canvas.width = scaled.width;
  canvas.height = scaled.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Image compression failed to initialize canvas');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, scaled.width, scaled.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Image compression failed'));
      },
      'image/jpeg',
      preset.jpegQuality
    );
  });

  return new File([blob], outputFileName, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export async function probeVideoMetadata(file: File): Promise<{ width: number; height: number; duration: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const meta = await new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
        });
      };
      video.onerror = () => reject(new Error('Could not read video metadata'));
      video.src = objectUrl;
    });
    return meta;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function validateVideoForCloudUpload(file: File): Promise<string | null> {
  if (!file.type.startsWith('video/')) return null;

  if (file.size > CLOUD_VIDEO_POLICY.maxBytes) {
    return 'Video must be 200MB or smaller for cloud upload.';
  }

  try {
    const meta = await probeVideoMetadata(file);
    if (meta.width > CLOUD_VIDEO_POLICY.maxWidth || meta.height > CLOUD_VIDEO_POLICY.maxHeight) {
      return 'Cloud video upload is limited to 1080p. 4K is local-storage only.';
    }
  } catch {
    // If metadata cannot be read, keep size guardrail and allow upload attempt.
    return null;
  }

  return null;
}
