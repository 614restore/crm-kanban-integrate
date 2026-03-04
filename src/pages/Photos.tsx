// Photos page - Gallery and management for captured photos
// Offline-capable photo viewing and organization

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Camera, 
  Search, 
  Filter, 
  MapPin, 
  Clock, 
  Upload, 
  Wifi, 
  WifiOff,
  Tag,
  Grid3X3,
  List,
  Trash2,
  Share
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { offlineDB } from '@/lib/offlineDB';
import PhotoCapture from '@/components/mobile/PhotoCapture';

interface Photo {
  id: string;
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
  data: string; // base64
  uploaded: boolean;
  queuedAt: Date;
}

const Photos: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCapture, setShowCapture] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
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

  // Load photos from offline database
  const loadPhotos = async () => {
    try {
      setLoading(true);
      const photoData = await offlineDB.getAllPhotos();
      
      // Sort by timestamp (newest first)
      const sortedPhotos = photoData.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setPhotos(sortedPhotos);
      console.log(`📸 Loaded ${sortedPhotos.length} photos`);
    } catch (error) {
      console.error('❌ Error loading photos:', error);
      toast({
        title: "Error loading photos",
        description: "Could not retrieve photos from storage.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    photos.forEach(photo => {
      photo.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [photos]);

  // Filter photos based on search and tags
  const filteredPhotos = useMemo(() => {
    return photos.filter(photo => {
      const matchesSearch = !searchQuery || 
        photo.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        photo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        photo.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesTag = !selectedTag || photo.tags.includes(selectedTag);
      
      return matchesSearch && matchesTag;
    });
  }, [photos, searchQuery, selectedTag]);

  // Handle photo capture completion
  const handlePhotoSaved = (metadata: any) => {
    loadPhotos(); // Reload photos to include the new one
    setShowCapture(false);
    
    toast({
      title: "Photo saved!",
      description: `Saved ${metadata.fileName}`,
      variant: "default"
    });
  };

  // Delete photo
  const deletePhoto = async (photoId: string) => {
    try {
      await offlineDB.deletePhoto(photoId);
      await loadPhotos();
      setSelectedPhoto(null);
      
      toast({
        title: "Photo deleted",
        description: "Photo has been removed.",
        variant: "default"
      });
    } catch (error) {
      console.error('❌ Error deleting photo:', error);
      toast({
        title: "Delete failed",
        description: "Could not delete photo.",
        variant: "destructive"
      });
    }
  };

  // Share photo (using Web Share API if available)
  const sharePhoto = async (photo: Photo) => {
    if (navigator.share && navigator.canShare) {
      try {
        // Convert base64 to blob
        const response = await fetch(photo.data);
        const blob = await response.blob();
        const file = new File([blob], photo.fileName, { type: photo.mimeType });

        await navigator.share({
          title: 'StormCraft Photo',
          text: photo.description || 'Photo from StormCraft CRM',
          files: [file]
        });
      } catch (error) {
        console.error('❌ Share failed:', error);
        // Fallback to download
        downloadPhoto(photo);
      }
    } else {
      // Fallback to download
      downloadPhoto(photo);
    }
  };

  // Download photo
  const downloadPhoto = (photo: Photo) => {
    const link = document.createElement('a');
    link.href = photo.data;
    link.download = photo.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  };

  // Format location
  const formatLocation = (lat?: number, lng?: number, accuracy?: number) => {
    if (!lat || !lng) return 'No location';
    return `${lat.toFixed(6)}, ${lng.toFixed(6)} (±${accuracy?.toFixed(0)}m)`;
  };

  if (showCapture) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <div className="mb-4">
          <Button 
            onClick={() => setShowCapture(false)} 
            variant="outline"
            className="mb-4"
          >
            ← Back to Gallery
          </Button>
        </div>
        <PhotoCapture onPhotoSaved={handlePhotoSaved} />
      </div>
    );
  }

  // Photo detail modal
  if (selectedPhoto) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 bg-black text-white">
          <Button
            onClick={() => setSelectedPhoto(null)}
            variant="ghost"
            className="text-white hover:bg-gray-800"
          >
            ← Back
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={() => sharePhoto(selectedPhoto)}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-gray-800"
            >
              <Share className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => deletePhoto(selectedPhoto.id)}
              variant="ghost"
              size="sm"
              className="text-red-400 hover:bg-red-900"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <img
            src={selectedPhoto.data}
            alt={selectedPhoto.fileName}
            className="max-w-full max-h-full object-contain"
          />
        </div>
        
        <div className="bg-black text-white p-4 space-y-2">
          <h3 className="font-semibold">{selectedPhoto.fileName}</h3>
          {selectedPhoto.description && (
            <p className="text-gray-300">{selectedPhoto.description}</p>
          )}
          <div className="flex flex-wrap gap-1">
            {selectedPhoto.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="text-sm text-gray-400 space-y-1">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(selectedPhoto.timestamp).toLocaleString()}
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {formatLocation(selectedPhoto.latitude, selectedPhoto.longitude, selectedPhoto.accuracy)}
            </div>
            <div className="flex items-center gap-1">
              {selectedPhoto.uploaded ? (
                <Wifi className="w-3 h-3 text-green-400" />
              ) : (
                <WifiOff className="w-3 h-3 text-orange-400" />
              )}
              {selectedPhoto.uploaded ? 'Uploaded' : 'Offline'} • {formatFileSize(selectedPhoto.size)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Photos</h1>
          <Badge variant="outline">
            {filteredPhotos.length} {filteredPhotos.length === 1 ? 'photo' : 'photos'}
          </Badge>
        </div>
        
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
      </div>

      {/* Controls */}
      <div className="space-y-3">
        <Button
          onClick={() => setShowCapture(true)}
          className="w-full"
          size="lg"
        >
          <Camera className="w-5 h-5 mr-2" />
          Take New Photo
        </Button>
        
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search photos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </Button>
        </div>
        
        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex gap-1 overflow-x-auto pb-2">
            <Button
              variant={selectedTag === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTag('')}
            >
              All
            </Button>
            {allTags.map(tag => (
              <Button
                key={tag}
                variant={selectedTag === tag ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTag(tag)}
                className="whitespace-nowrap"
              >
                <Tag className="w-3 h-3 mr-1" />
                {tag}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Loading photos...</p>
          </div>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Camera className="w-16 h-16 text-gray-400 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-gray-600">
                {photos.length === 0 ? 'No photos yet' : 'No photos found'}
              </h3>
              <p className="text-gray-500">
                {photos.length === 0 
                  ? 'Start capturing photos to document your work' 
                  : 'Try adjusting your search or removing filters'
                }
              </p>
            </div>
            {photos.length === 0 && (
              <Button onClick={() => setShowCapture(true)} size="lg">
                <Camera className="w-5 h-5 mr-2" />
                Take Your First Photo
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' 
          : 'space-y-4'
        }>
          {filteredPhotos.map(photo => (
            <Card 
              key={photo.id} 
              className={`cursor-pointer hover:shadow-lg transition-shadow ${
                viewMode === 'list' ? 'flex' : ''
              }`}
              onClick={() => setSelectedPhoto(photo)}
            >
              {viewMode === 'grid' ? (
                <div>
                  <div className="aspect-square relative overflow-hidden rounded-t-lg">
                    <img
                      src={photo.data}
                      alt={photo.fileName}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      {photo.uploaded ? (
                        <Wifi className="w-4 h-4 text-green-500 bg-white bg-opacity-80 rounded p-0.5" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-orange-500 bg-white bg-opacity-80 rounded p-0.5" />
                      )}
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium truncate">{photo.fileName}</h4>
                      {photo.description && (
                        <p className="text-xs text-gray-600 line-clamp-2">{photo.description}</p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {new Date(photo.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 relative overflow-hidden rounded-l-lg">
                    <img
                      src={photo.data}
                      alt={photo.fileName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="flex-1 p-4 min-w-0">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium truncate">{photo.fileName}</h4>
                        {photo.uploaded ? (
                          <Wifi className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        )}
                      </div>
                      {photo.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{photo.description}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(photo.timestamp).toLocaleString()}
                        </div>
                        <span>{formatFileSize(photo.size)}</span>
                      </div>
                      {photo.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {photo.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {photo.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{photo.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Photos;