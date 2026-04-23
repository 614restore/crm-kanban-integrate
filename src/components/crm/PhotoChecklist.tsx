import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Eye, Trash2, CheckCircle } from 'lucide-react';
import { uploadDocument, getDocumentSignedUrl } from '@/lib/storage';
import { compressImage } from '@/lib/imageUtils';
import { toast } from 'sonner';

interface PhotoChecklistItem {
  id: string;
  label: string;
  category: 'before' | 'during' | 'after' | 'supplement';
  required: boolean;
  completed: boolean;
  photoUrl?: string;
  uploadedAt?: string;
  uploadedBy?: string;
}

interface PhotoChecklistProps {
  items: PhotoChecklistItem[];
  onChange: (items: PhotoChecklistItem[]) => void;
  companyId: string;
  contactId?: string;
}

const DEFAULT_CHECKLIST: Omit<PhotoChecklistItem, 'id'>[] = [
  { label: 'Front of property', category: 'before', required: true, completed: false },
  { label: 'Back of property', category: 'before', required: true, completed: false },
  { label: 'Left side', category: 'before', required: true, completed: false },
  { label: 'Right side', category: 'before', required: true, completed: false },
  { label: 'Damage close-up', category: 'before', required: true, completed: false },
  { label: 'Work in progress', category: 'during', required: false, completed: false },
  { label: 'Materials on site', category: 'during', required: false, completed: false },
  { label: 'Completed work - front', category: 'after', required: true, completed: false },
  { label: 'Completed work - back', category: 'after', required: true, completed: false },
  { label: 'Cleanup complete', category: 'after', required: true, completed: false },
  { label: 'Supplement photo 1', category: 'supplement', required: false, completed: false },
  { label: 'Supplement photo 2', category: 'supplement', required: false, completed: false },
];

export default function PhotoChecklist({ items, onChange, companyId, contactId }: PhotoChecklistProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Initialize with default checklist if empty
  React.useEffect(() => {
    if (items.length === 0) {
      onChange(DEFAULT_CHECKLIST.map((item, idx) => ({ ...item, id: `photo-${idx}` })));
    }
  }, []);

  const handleFileSelect = async (itemId: string, file: File) => {
    setUploading(itemId);
    try {
      // Compress before upload — full-size original stays on the device
      const compressed = await compressImage(file, { maxPx: 1400, quality: 0.82, targetBytes: 1_000_000 });
      const result = await uploadDocument(compressed, companyId, contactId);
      if (result.error) {
        toast.error(`Upload failed: ${result.error}`);
        return;
      }

      const updatedItems = items.map(item =>
        item.id === itemId
          ? {
              ...item,
              completed: true,
              photoUrl: result.path || result.url,
              uploadedAt: new Date().toISOString(),
            }
          : item
      );
      onChange(updatedItems);
      toast.success('Photo uploaded');
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = (itemId: string) => {
    const updatedItems = items.map(item =>
      item.id === itemId
        ? { ...item, completed: false, photoUrl: undefined, uploadedAt: undefined }
        : item
    );
    onChange(updatedItems);
    toast.success('Photo removed');
  };

  const handleView = async (photoUrl: string) => {
    const url = await getDocumentSignedUrl(photoUrl);
    if (url) {
      setViewingPhoto(url);
    } else {
      toast.error('Could not load photo');
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'before': return 'bg-blue-100 text-blue-700';
      case 'during': return 'bg-yellow-100 text-yellow-700';
      case 'after': return 'bg-green-100 text-green-700';
      case 'supplement': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PhotoChecklistItem[]>);

  const categories = [
    { key: 'before', label: 'Before Photos' },
    { key: 'during', label: 'During Work' },
    { key: 'after', label: 'After Completion' },
    { key: 'supplement', label: 'Supplement Photos' },
  ];

  const completedCount = items.filter(i => i.completed).length;
  const requiredCount = items.filter(i => i.required).length;
  const requiredCompleted = items.filter(i => i.required && i.completed).length;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Photo Checklist Progress</span>
          <span className="text-sm text-gray-600">
            {completedCount} of {items.length} photos ({requiredCompleted}/{requiredCount} required)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all"
            style={{ width: `${(completedCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Photo Categories */}
      {categories.map(({ key, label }) => {
        const categoryItems = groupedItems[key] || [];
        if (categoryItems.length === 0) return null;

        return (
          <div key={key} className="space-y-2">
            <h4 className={`text-sm font-semibold px-2 py-1 rounded inline-block ${getCategoryColor(key)}`}>
              {label}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {categoryItems.map((item) => (
                <div
                  key={item.id}
                  className={`border rounded-lg p-3 ${
                    item.completed ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{item.label}</span>
                        {item.required && (
                          <span className="text-xs text-red-600">*</span>
                        )}
                      </div>
                      {item.completed && item.uploadedAt && (
                        <span className="text-xs text-gray-500">
                          {new Date(item.uploadedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {item.completed && (
                      <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                    )}
                  </div>

                  {item.completed && item.photoUrl ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleView(item.photoUrl!)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        <Eye size={14} />
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        ref={(el) => (fileInputRefs.current[item.id] = el)}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(item.id, file);
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => fileInputRefs.current[item.id]?.click()}
                          disabled={uploading === item.id}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                          {uploading === item.id ? (
                            <>Uploading...</>
                          ) : (
                            <>
                              <Camera size={14} />
                              Take Photo
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Photo Viewer Modal */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <button
            onClick={() => setViewingPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100"
          >
            <X size={24} />
          </button>
          <img
            src={viewingPhoto}
            alt="Work order photo"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
