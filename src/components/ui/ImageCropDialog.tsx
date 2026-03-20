import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';

interface ImageCropDialogProps {
  open: boolean;
  imageUrl: string;
  onClose: () => void;
  onCropComplete: (croppedImage: Blob) => Promise<void>;
  aspectRatio?: number;
  title?: string;
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CroppedAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Returns the bounding box dimensions of an image rotated by `rotation` degrees.
function rotateSize(width: number, height: number, rotation: number) {
  const rad = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rad) * width) + Math.abs(Math.sin(rad) * height),
    height: Math.abs(Math.sin(rad) * width) + Math.abs(Math.cos(rad) * height),
  };
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = url;
  });
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CroppedAreaPixels,
  rotation = 0
): Promise<Blob | null> {
  const image = await createImage(imageSrc);

  // ── Step 1: draw the full image (rotated) onto a bounding-box-sized canvas ──
  const { width: bBoxW, height: bBoxH } = rotateSize(image.width, image.height, rotation);
  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = bBoxW;
  rotCanvas.height = bBoxH;
  const rotCtx = rotCanvas.getContext('2d');
  if (!rotCtx) return null;

  rotCtx.translate(bBoxW / 2, bBoxH / 2);
  rotCtx.rotate((rotation * Math.PI) / 180);
  rotCtx.translate(-image.width / 2, -image.height / 2);
  rotCtx.drawImage(image, 0, 0);

  // ── Step 2: cut out the crop region into a second canvas ──
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = pixelCrop.width;
  cropCanvas.height = pixelCrop.height;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) return null;

  cropCtx.drawImage(
    rotCanvas,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height
  );

  return new Promise((resolve) => {
    cropCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
}

export default function ImageCropDialog({
  open,
  imageUrl,
  onClose,
  onCropComplete,
  aspectRatio,
  title = 'Crop Image',
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedAreaPixels | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset all crop state whenever a new image is loaded.
  // Without this, stale pan/zoom from the previous session pushes the new
  // image off-screen and makes the preview appear completely black.
  useEffect(() => {
    if (open && imageUrl) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setCroppedAreaPixels(null);
    }
  }, [open, imageUrl]);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((z: number) => {
    setZoom(z);
  }, []);

  const onCropCompleteInternal = useCallback(
    (_croppedArea: Area, pixels: CroppedAreaPixels) => {
      setCroppedAreaPixels(pixels);
    },
    []
  );

  const handleSave = async () => {
    if (!imageUrl) return;

    // If the user hasn't dragged yet, croppedAreaPixels is null.
    // Fall back to loading the image and using its full dimensions as the crop.
    let pixels = croppedAreaPixels;
    if (!pixels) {
      try {
        const img = await createImage(imageUrl);
        pixels = { x: 0, y: 0, width: img.width, height: img.height };
      } catch {
        return;
      }
    }

    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImg(imageUrl, pixels, rotation);
      if (croppedImage) {
        await onCropComplete(croppedImage);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {aspectRatio
              ? 'Adjust the zoom, rotation, and position to crop your image perfectly'
              : 'Drag to reposition · use sliders to zoom and rotate · then click Save & Upload'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Crop preview */}
          <div className="relative w-full h-[400px] rounded-lg overflow-hidden bg-gray-900">
            {imageUrl && (
              // key={imageUrl} forces react-easy-crop to fully remount when a new
              // image is selected, preventing stale internal state.
              <Cropper
                key={imageUrl}
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                {...(aspectRatio !== undefined ? { aspect: aspectRatio } : {})}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropCompleteInternal}
                style={{
                  containerStyle: {
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#111827',
                  },
                }}
              />
            )}
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Zoom</label>
                <span className="text-sm text-muted-foreground">{zoom.toFixed(1)}x</span>
              </div>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(value) => setZoom(value[0])}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Rotation</label>
                <span className="text-sm text-muted-foreground">{rotation}°</span>
              </div>
              <Slider
                value={[rotation]}
                min={0}
                max={360}
                step={1}
                onValueChange={(value) => setRotation(value[0])}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isProcessing || !imageUrl}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProcessing ? 'Processing...' : 'Save & Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
