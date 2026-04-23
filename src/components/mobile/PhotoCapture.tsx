// Photo capture component with GPS and offline support
// Core photo workflow for field crews

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, MapPin, Wifi, WifiOff, Check, X } from 'lucide-react';
import { compressImage } from '@/lib/imageUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { offlineDB } from '@/lib/offlineDB';
import { supabase } from '@/lib/supabase';
import { secureUpload } from '@/lib/storageUtils';

interface PhotoMetadata {
  id?: string;
  fileName: string;
  description?: string;
  tags: string[];
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  timestamp: Date;
  contactId?: string;
  jobId?: string;
  size: number;
  mimeType: string;
}

interface PhotoCaptureProps {
  contactId?: string;
  jobId?: string;
  onPhotoSaved?: (photo: PhotoMetadata) => void;
  className?: string;
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  contactId,
  jobId,
  onPhotoSaved,
  className
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'success' | 'error' | 'disabled'>('disabled');
  const [uploading, setUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { toast } = useToast();

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Get GPS location
  const getLocation = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('error');
      return;
    }

    setGpsStatus('loading');

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5 * 60 * 1000 // 5 minutes
    };

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

      const { latitude, longitude, accuracy } = position.coords;
      setLocation({ latitude, longitude, accuracy: accuracy || 0 });
      setGpsStatus('success');
      
    } catch (error) {
      console.error('❌ GPS error:', error);
      setGpsStatus('error');
      toast({
        title: "GPS not available",
        description: "Photo will be saved without location data.",
        variant: "default"
      });
    }
  }, [toast]);

  // Start camera
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Camera not available",
        description: "Please use the file upload option instead.",
        variant: "destructive"
      });
      return;
    }

    setIsCapturing(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera preferred
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }

      // Auto-start GPS when camera opens
      getLocation();
    } catch (error) {
      console.error('❌ Camera error:', error);
      setIsCapturing(false);
      toast({
        title: "Camera access denied",
        description: "Please enable camera permissions or use file upload.",
        variant: "destructive"
      });
    }
  }, [toast, getLocation]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
    setPreviewUrl(null);
  }, []);

  // Capture photo from camera
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;

    // Resize to max 1280px on the longest side before encoding
    const MAX_PX = 1280;
    const scale = Math.min(1, MAX_PX / Math.max(video.videoWidth, video.videoHeight));
    canvas.width  = Math.round(video.videoWidth  * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Encode at 0.78 quality — targets < 200 KB for typical roof photos
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        stopCamera();
      }
    }, 'image/jpeg', 0.78);
  }, [stopCamera]);

  // Handle file selection — compress gallery picks before preview/upload
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive"
      });
      return;
    }

    // Compress before storing — full-size original stays in the device gallery
    const compressed = await compressImage(file, { maxPx: 1280, quality: 0.78, targetBytes: 1_000_000 });
    const url = URL.createObjectURL(compressed);
    setPreviewUrl(url);

    // Get GPS when photo is selected
    getLocation();
  }, [toast, getLocation]);

  // Save photo with metadata
  const savePhoto = useCallback(async () => {
    if (!previewUrl) return;

    setUploading(true);

    try {
      // Get blob from preview URL
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      
      // Convert to base64 for offline storage
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      
      const base64Data = await base64Promise;
      
      const photoMetadata: PhotoMetadata = {
        id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fileName: `photo_${new Date().toISOString().slice(0, 10)}_${Date.now()}.jpg`,
        description: description.trim() || undefined,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        latitude: location?.latitude,
        longitude: location?.longitude,
        accuracy: location?.accuracy,
        timestamp: new Date(),
        contactId,
        jobId,
        size: blob.size,
        mimeType: blob.type
      };

      // Save to offline database
      let photoData = base64Data;
      let uploaded = false;

      if (isOnline) {
        try {
          if (contactId) {
            const uploadResult = await secureUpload(
              'projectceo-photos', 
              contactId, 
              blob, 
              photoMetadata.fileName,
              blob.type
            );
            photoData = uploadResult.publicUrl;
            uploaded = true;
          } else {
            console.warn('⚠️ No contactId available, cannot upload securely');
          }
        } catch (uploadErr) {
          console.warn('⚠️ Supabase upload failed, saving offline:', uploadErr);
        }
      }

      await offlineDB.addPhoto({
        ...photoMetadata,
        data: photoData,
        uploaded,
        queuedAt: new Date()
      });


      toast({
        title: isOnline ? "Photo uploaded!" : "Photo saved offline",
        description: isOnline ? 
          "Photo has been uploaded and synced." : 
          "Photo will sync when connection is restored.",
        variant: "default"
      });

      // Notify parent component
      if (onPhotoSaved) {
        onPhotoSaved(photoMetadata);
      }

      // Reset form
      setPreviewUrl(null);
      setDescription('');
      setTags('');
      setLocation(null);
      setGpsStatus('disabled');
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('❌ Error saving photo:', error);
      toast({
        title: "Save failed",
        description: "Could not save photo. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  }, [previewUrl, description, tags, location, contactId, jobId, isOnline, onPhotoSaved, toast]);

  // Cancel photo
  const cancelPhoto = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setDescription('');
    setTags('');
    setLocation(null);
    setGpsStatus('disabled');
    stopCamera();
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [previewUrl, stopCamera]);

  // GPS status indicator
  const renderGpsStatus = () => {
    switch (gpsStatus) {
      case 'loading':
        return (
          <div className="flex items-center gap-1 text-blue-600 text-sm">
            <MapPin className="w-4 h-4 animate-pulse" />
            <span>Getting location...</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center gap-1 text-green-600 text-sm">
            <Check className="w-4 h-4" />
            <span>Location acquired (±{location?.accuracy.toFixed(0)}m)</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1 text-red-600 text-sm">
            <X className="w-4 h-4" />
            <span>Location unavailable</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Photo Capture
          </span>
          <div className="flex items-center gap-1 text-sm">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-orange-600" />
            )}
            <span className={isOnline ? 'text-green-600' : 'text-orange-600'}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Camera controls */}
        {!previewUrl && (
          <div className="flex gap-2">
            <Button
              onClick={startCamera}
              disabled={isCapturing}
              className="flex-1"
            >
              <Camera className="w-4 h-4 mr-2" />
              {isCapturing ? 'Starting Camera...' : 'Take Photo'}
            </Button>
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* Camera view */}
        {isCapturing && (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-64 bg-black rounded-lg object-cover"
            />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              <Button onClick={capturePhoto} size="lg" className="rounded-full">
                <Camera className="w-6 h-6" />
              </Button>
              <Button onClick={stopCamera} variant="outline" size="lg" className="rounded-full">
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>
        )}

        {/* Preview and metadata */}
        {previewUrl && (
          <div className="space-y-4">
            <img
              src={previewUrl}
              alt="Photo preview"
              className="w-full h-64 object-cover rounded-lg"
            />
            
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what's in this photo..."
                  rows={2}
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="before, progress, completion, damage (comma separated)"
                />
              </div>
              
              <div className="flex items-center justify-between">
                {renderGpsStatus()}
                <Button
                  onClick={getLocation}
                  variant="outline"
                  size="sm"
                  disabled={gpsStatus === 'loading'}
                >
                  <MapPin className="w-4 h-4 mr-1" />
                  Refresh GPS
                </Button>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={savePhoto}
                disabled={uploading}
                className="flex-1"
              >
                {uploading ? 'Saving...' : isOnline ? 'Upload Photo' : 'Save Offline'}
              </Button>
              <Button
                onClick={cancelPhoto}
                variant="outline"
                disabled={uploading}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="hidden" />
      </CardContent>
    </Card>
  );
};

export default PhotoCapture;