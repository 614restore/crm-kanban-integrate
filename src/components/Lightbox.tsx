// Copied from QuoteMGR src/components/Lightbox.tsx (read-only reference).
import React, { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

export interface LightboxPhoto {
  url: string;
  caption?: string;
  notes?: string;
  location?: string;
}

interface LightboxProps {
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
}

const Lightbox: React.FC<LightboxProps> = ({ photos, index, onClose, onChange }) => {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && hasPrev) onChange(index - 1);
    if (e.key === 'ArrowRight' && hasNext) onChange(index + 1);
  }, [index, hasPrev, hasNext, onClose, onChange]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/92 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Counter */}
      {photos.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium">
          {index + 1} / {photos.length}
        </div>
      )}

      {/* Prev */}
      {hasPrev && (
        <button
          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          onClick={(e) => { e.stopPropagation(); onChange(index - 1); }}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* Image */}
      <img
        src={photo.url}
        alt={photo.caption || 'Photo'}
        className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next */}
      {hasNext && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          onClick={(e) => { e.stopPropagation(); onChange(index + 1); }}
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Caption / location / notes */}
      {(photo.caption || photo.notes || photo.location) && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-6 pt-10 pb-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Location chips — subtle, top of the info bar */}
          {photo.location && (
            <div className="flex flex-wrap gap-1.5 mb-2 justify-center">
              {photo.location.split(',').filter(Boolean).map((loc, i) => (
                <span key={i} className="flex items-center gap-1 bg-white/15 text-white/80 text-xs px-2.5 py-0.5 rounded-full">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {loc.trim()}
                </span>
              ))}
            </div>
          )}
          {photo.caption && <p className="text-white font-semibold text-base text-center">{photo.caption}</p>}
          {photo.notes && <p className="text-white/65 text-sm mt-1.5 text-center leading-relaxed">{photo.notes}</p>}
        </div>
      )}
    </div>
  );
};

export default Lightbox;
