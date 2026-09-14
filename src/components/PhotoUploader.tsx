// Copied from QuoteMGR src/components/PhotoUploader.tsx (read-only reference).
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, AlertCircle, Pen, Sparkles, Tag, CheckSquare, Square, MapPin, Crop, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { damageTypes, photoLocations } from '@/data/quoteData';
import type { EstimatePhoto } from '@/data/quoteData';
import PhotoMarkupEditor from './PhotoMarkupEditor';
import Lightbox from './Lightbox';
import { compressImage, COMPRESS_PRESETS, STORAGE_CACHE_CONTROL } from '@/lib/imageUtils';

// ─── Photo Crop Modal ─────────────────────────────────────────────────────────

const PREVIEW_W = 480;
const PREVIEW_H = 320;
const OUTPUT_W = 1200;
const OUTPUT_H = 800;

interface PhotoCropModalProps {
  objectUrl: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

const PhotoCropModal: React.FC<PhotoCropModalProps> = ({ objectUrl, onConfirm, onCancel }) => {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(50);
  const [offsetY, setOffsetY] = useState(50);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setNaturalW(w);
      setNaturalH(h);
      const fitZoom = Math.max(PREVIEW_W / w, PREVIEW_H / h);
      setZoom(fitZoom);
    };
    img.src = objectUrl;
  }, [objectUrl]);

  const clampOffset = useCallback((ox: number, oy: number, z: number) => {
    if (!naturalW || !naturalH) return { ox, oy };
    const rw = naturalW * z;
    const rh = naturalH * z;
    const halfW = PREVIEW_W / 2;
    const halfH = PREVIEW_H / 2;
    const cxPx = Math.min(Math.max((ox / 100) * rw, halfW), rw - halfW);
    const cyPx = Math.min(Math.max((oy / 100) * rh, halfH), rh - halfH);
    return { ox: (cxPx / rw) * 100, oy: (cyPx / rh) * 100 };
  }, [naturalW, naturalH]);

  const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const z = Number(e.target.value);
    const c = clampOffset(offsetX, offsetY, z);
    setZoom(z); setOffsetX(c.ox); setOffsetY(c.oy);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offsetX, oy: offsetY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current || !naturalW || !naturalH) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    const rw = naturalW * zoom;
    const rh = naturalH * zoom;
    const c = clampOffset(
      dragStart.current.ox - (dx / rw) * 100,
      dragStart.current.oy - (dy / rh) * 100,
      zoom,
    );
    setOffsetX(c.ox); setOffsetY(c.oy);
  };

  const handlePointerUp = () => { dragStart.current = null; };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !naturalW || !naturalH) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setSaving(true);
    canvas.width = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const rw = naturalW * zoom;
    const rh = naturalH * zoom;
    // Center of the visible crop in scaled-image pixels
    const cxPx = (offsetX / 100) * rw;
    const cyPx = (offsetY / 100) * rh;
    // Scale from rendered size back to natural image coords
    const scale = naturalW / rw;
    const srcX = (cxPx - PREVIEW_W / 2) * scale;
    const srcY = (cyPx - PREVIEW_H / 2) * scale;
    const srcW = PREVIEW_W * scale;
    const srcH = PREVIEW_H * scale;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUTPUT_W, OUTPUT_H);
    canvas.toBlob((blob) => {
      setSaving(false);
      if (blob) onConfirm(blob);
    }, 'image/jpeg', 0.92);
  };

  const rw = naturalW * zoom;
  const rh = naturalH * zoom;
  const imgLeft = (offsetX / 100) * rw - PREVIEW_W / 2;
  const imgTop  = (offsetY / 100) * rh - PREVIEW_H / 2;
  const minZoom = naturalW && naturalH
    ? Math.max(PREVIEW_W / naturalW, PREVIEW_H / naturalH)
    : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Crop Photo</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Landscape preview — drag to pan */}
        <div
          className="relative mx-auto overflow-hidden rounded-xl border-2 border-[#1e3a5f] cursor-grab active:cursor-grabbing select-none"
          style={{ width: PREVIEW_W, height: PREVIEW_H }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {naturalW > 0 && (
            <img
              ref={imgRef}
              src={objectUrl}
              alt="crop preview"
              draggable={false}
              style={{
                position: 'absolute',
                width: rw,
                height: rh,
                left: -imgLeft,
                top: -imgTop,
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
        <p className="text-xs text-gray-500 text-center">Drag to reposition · use slider to zoom</p>

        {/* Zoom slider */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Zoom: {zoom.toFixed(2)}×</label>
          <input
            type="range"
            min={minZoom}
            max={4}
            step={0.01}
            value={zoom}
            onChange={handleZoom}
            className="w-full accent-[#1e3a5f]"
          />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={saving || naturalW === 0}
            className="flex-1 px-4 py-2.5 bg-[#1e3a5f] hover:bg-[#2d5a8e] disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </>
            ) : 'Save Crop'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface PhotoUploaderProps {
  photos: EstimatePhoto[];
  onChange: (photos: EstimatePhoto[]) => void;
  estimateId?: string;
  quoteId?: string;
  onAnalyzePhoto?: (index: number) => void;
  analyzingPhotoIndex?: number | null;
}

const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  photos,
  onChange,
  estimateId,
  quoteId,
  onAnalyzePhoto,
  analyzingPhotoIndex = null,
}) => {
  const resolvedId = estimateId || quoteId || '';

  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [markupPhoto, setMarkupPhoto] = useState<{ url: string; id: string; index: number } | null>(null);
  const [cropPhoto, setCropPhoto] = useState<{ url: string; index: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-select state
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [batchLocation, setBatchLocation] = useState('');
  const [batchDamageType, setBatchDamageType] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [showBatchPanel, setShowBatchPanel] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    const newPhotos: EstimatePhoto[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const lowerName = file.name.toLowerCase();
        const isImage = file.type.startsWith('image/') || lowerName.endsWith('.heic') || lowerName.endsWith('.heif');
        if (!isImage) continue;

        try {
          const compressed = await compressImage(file, COMPRESS_PRESETS.quotePhoto);

          const fileName = `photo-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
          const { error } = await supabase.storage.from('quote-photos').upload(fileName, compressed, {
            contentType: 'image/jpeg',
            cacheControl: STORAGE_CACHE_CONTROL,
          });
          if (error) throw error;

          const { data: urlData } = supabase.storage.from('quote-photos').getPublicUrl(fileName);

          newPhotos.push({
            id: `temp-${Date.now()}-${i}`,
            estimate_id: resolvedId,
            photo_url: urlData.publicUrl,
            caption: '',
            damage_type: '',
            location: '',
            notes: '',
            sort_order: photos.length + i,
          });
        } catch (err) {
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      if (newPhotos.length > 0) {
        onChange([...photos, ...newPhotos]);
        toast.success(`${newPhotos.length} photo(s) uploaded`);
      }
    } finally {
      setUploading(false);
      // Reset the file input so the same file(s) can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updatePhoto = (index: number, field: keyof EstimatePhoto, value: string) => {
    // Immutable update — create a new object for the changed photo so React
    // always sees a fresh reference and stale-closure reads of photos[index]
    // still get the old value (we re-read inside onClick handlers instead).
    onChange(photos.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
    setSelectedIndices(prev => {
      const next = new Set<number>();
      prev.forEach(i => { if (i !== index) next.add(i > index ? i - 1 : i); });
      return next;
    });
  };

  const handleMarkupSave = (annotatedUrl: string) => {
    if (!markupPhoto) return;
    updatePhoto(markupPhoto.index, 'photo_url', annotatedUrl);
    setMarkupPhoto(null);
  };

  const handleCropSave = async (blob: Blob) => {
    if (!cropPhoto) return;
    try {
      const fileName = `cropped-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error } = await supabase.storage.from('quote-photos').upload(fileName, blob, {
        contentType: 'image/jpeg',
        cacheControl: STORAGE_CACHE_CONTROL,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('quote-photos').getPublicUrl(fileName);
      updatePhoto(cropPhoto.index, 'photo_url', data.publicUrl);
      toast.success('Photo cropped and saved');
    } catch {
      toast.error('Failed to save cropped photo');
    } finally {
      setCropPhoto(null);
    }
  };

  const toggleSelect = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const selectAll = () => setSelectedIndices(new Set(photos.map((_, i) => i)));
  const clearSelection = () => { setSelectedIndices(new Set()); setSelectMode(false); setShowBatchPanel(false); };

  const deleteSelected = () => {
    if (selectedIndices.size === 0) return;
    if (!window.confirm(`Delete ${selectedIndices.size} photo${selectedIndices.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    // Remove in descending index order so indices don't shift mid-delete
    const sorted = [...selectedIndices].sort((a, b) => b - a);
    let updated = [...photos];
    for (const idx of sorted) updated.splice(idx, 1);
    onChange(updated);
    clearSelection();
  };

  const applyBatchLabels = () => {
    if (!batchLocation && !batchDamageType && !batchNotes.trim()) {
      toast.error('Add a location, damage type, or note to apply.');
      return;
    }
    const updated = [...photos];
    selectedIndices.forEach(i => {
      if (batchLocation) (updated[i] as any).location = batchLocation;
      if (batchDamageType) (updated[i] as any).damage_type = batchDamageType;
      if (batchNotes.trim()) {
        // Append to existing notes rather than overwriting
        const existing = ((updated[i] as any).notes || '').trim();
        (updated[i] as any).notes = existing ? `${existing}\n${batchNotes.trim()}` : batchNotes.trim();
      }
    });
    onChange(updated);
    toast.success(`Labels applied to ${selectedIndices.size} photo${selectedIndices.size > 1 ? 's' : ''}`);
    clearSelection();
    setBatchLocation('');
    setBatchDamageType('');
    setBatchNotes('');
    setShowBatchPanel(false);
  };

  return (
    <div className="space-y-4">
      {/* Browser compatibility notice */}
      <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
        <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <p className="text-xs leading-relaxed text-amber-800">
          <span className="font-semibold">HEIC photos (iPhone default format)</span> are automatically converted to JPEG on upload, but thumbnails may appear broken in Chrome until the page is refreshed. For the best experience uploading iPhone photos, use <span className="font-semibold">Safari</span> — HEIC files display natively with no conversion delay.
        </p>
      </div>

      {/* Upload Area */}
      <div
        onClick={() => !selectMode && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (!selectMode) handleUpload(e.dataTransfer.files); }}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${selectMode ? 'border-gray-200 bg-gray-50 cursor-default' : 'border-gray-300 cursor-pointer hover:border-[#1e3a5f] hover:bg-blue-50/50'}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Uploading photos...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center">
              <Camera className="w-7 h-7 text-[#1e3a5f]" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {selectMode ? 'Exit select mode to upload new photos' : 'Drop inspection photos here or click to upload'}
              </p>
              {!selectMode && <p className="text-xs text-gray-500 mt-1">JPG, PNG, HEIC up to 10MB each</p>}
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Multi-select toolbar */}
      {photos.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {!selectMode ? (
            <button
              onClick={() => setSelectMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] bg-blue-50 border border-[#1e3a5f]/30 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Select Multiple
            </button>
          ) : (
            <>
              <button
                onClick={selectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1e3a5f] bg-blue-50 border border-[#1e3a5f]/30 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Select All
              </button>
              <button
                onClick={() => { setShowBatchPanel(p => !p); }}
                disabled={selectedIndices.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#ff6b35] rounded-lg hover:bg-[#e55a25] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Tag className="w-3.5 h-3.5" />
                Label Selected {selectedIndices.size > 0 ? `(${selectedIndices.size})` : ''}
              </button>
              <button
                onClick={deleteSelected}
                disabled={selectedIndices.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete {selectedIndices.size > 0 ? `(${selectedIndices.size})` : ''}
              </button>
              <button
                onClick={clearSelection}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {/* Batch label panel */}
      {showBatchPanel && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-xs text-blue-700 font-medium">
            Apply to {selectedIndices.size} selected photo{selectedIndices.size > 1 ? 's' : ''}. Blank fields are left unchanged.
          </p>

          {/* Location */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
              <MapPin className="w-3.5 h-3.5" /> Location
            </label>
            <div className="flex flex-wrap gap-1.5">
              {photoLocations.map(loc => {
                const vals = batchLocation.split(',').map(s => s.trim()).filter(Boolean);
                const active = vals.includes(loc);
                return (
                  <button
                    key={loc}
                    onClick={() => {
                      const next = active ? vals.filter(v => v !== loc) : [...vals, loc];
                      setBatchLocation(next.join(','));
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#1e3a5f]'}`}
                  >
                    {loc}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Damage Type */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Damage Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {damageTypes.map(type => {
                const vals = batchDamageType.split(',').map(s => s.trim()).filter(Boolean);
                const active = vals.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => {
                      const next = active ? vals.filter(v => v !== type) : [...vals, type];
                      setBatchDamageType(next.join(','));
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-[#ff6b35] text-white border-[#ff6b35]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#ff6b35]'}`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
              <AlertCircle className="w-3.5 h-3.5 opacity-0" />{/* spacer to align with other labels */}
              Notes
            </label>
            <textarea
              value={batchNotes}
              onChange={e => setBatchNotes(e.target.value)}
              placeholder="Add a note to all selected photos… (appends to existing notes)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none resize-none bg-white"
            />
          </div>

          <button
            onClick={applyBatchLabels}
            className="w-full py-2 bg-[#ff6b35] text-white text-sm font-semibold rounded-lg hover:bg-[#e55a25] transition-colors"
          >
            Apply to All Selected
          </button>
        </div>
      )}

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {photos.map((photo, index) => {
            const isSelected = selectedIndices.has(index);
            return (
              <div
                key={photo.id}
                className={`bg-white rounded-xl border overflow-hidden group transition-all ${isSelected ? 'border-[#ff6b35] border-2 shadow-md' : 'border-gray-200'}`}
              >
                {/* Photo */}
                <div
                  className="relative aspect-video bg-gray-100 cursor-pointer"
                  onClick={() => selectMode ? toggleSelect(index) : setLightboxIndex(index)}
                >
                  <img
                    src={photo.photo_url}
                    alt={photo.caption || `Photo ${index + 1}`}
                    className="w-full h-full object-contain bg-gray-900"
                  />

                  {/* Select overlay */}
                  {selectMode && (
                    <div className={`absolute inset-0 transition-colors ${isSelected ? 'bg-[#ff6b35]/10' : 'hover:bg-black/5'}`}>
                      <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-[#ff6b35] border-[#ff6b35]' : 'bg-white/80 border-gray-400'}`}>
                        {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                      </div>
                    </div>
                  )}

                  {/* Action buttons (non-select mode) */}
                  {!selectMode && (
                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onAnalyzePhoto && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onAnalyzePhoto(index); }}
                          className="min-w-8 h-8 px-2 bg-white/95 text-[#1e3a5f] rounded-full flex items-center justify-center hover:bg-white shadow-lg"
                          title="Analyze with AI"
                        >
                          {analyzingPhotoIndex === index ? (
                            <div className="w-3.5 h-3.5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setMarkupPhoto({ url: photo.photo_url, id: photo.id, index }); }}
                        className="w-8 h-8 bg-[#1e3a5f] text-white rounded-full flex items-center justify-center hover:bg-[#152d4a] shadow-lg"
                        title="Annotate photo"
                      >
                        <Pen className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCropPhoto({ url: photo.photo_url, index }); }}
                        className="w-8 h-8 bg-white/95 text-[#1e3a5f] rounded-full flex items-center justify-center hover:bg-white shadow-lg"
                        title="Crop photo"
                      >
                        <Crop className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removePhoto(index); }}
                        className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-lg"
                        title="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute bottom-2 left-2 flex flex-col gap-1">
                    {photo.location && photo.location.split(',').filter(Boolean).map((loc, i) => (
                      <span key={i} className="bg-[#1e3a5f] text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {loc.trim()}
                      </span>
                    ))}
                    {photo.damage_type && photo.damage_type.split(',').filter(Boolean).map((dmg, i) => (
                      <span key={i} className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {dmg.trim()}
                      </span>
                    ))}
                  </div>

                  {/* Annotated badge */}
                  {photo.photo_url.includes('annotated-') && (
                    <span className="absolute bottom-2 right-2 bg-[#1e3a5f] text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <Pen className="w-3 h-3" />
                      Annotated
                    </span>
                  )}
                </div>

                {/* Photo Details */}
                {!selectMode && (
                  <div className="p-3 space-y-2">
                    <input
                      type="text"
                      value={photo.caption}
                      onChange={(e) => updatePhoto(index, 'caption', e.target.value)}
                      placeholder="Photo caption..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                    />
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</p>
                      <div className="flex flex-wrap gap-1">
                        {photoLocations.map(loc => {
                          // Read from current photos array (not stale render closure) for accurate active state
                          const currentVals = (photos[index]?.location || '').split(',').map(s => s.trim()).filter(Boolean);
                          const active = currentVals.includes(loc);
                          return (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => {
                                // Re-read inside handler to always use latest value
                                const latest = (photos[index]?.location || '').split(',').map(s => s.trim()).filter(Boolean);
                                const isActive = latest.includes(loc);
                                const next = isActive ? latest.filter(v => v !== loc) : [...latest, loc];
                                updatePhoto(index, 'location', next.join(','));
                              }}
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-500 border-gray-300 hover:border-[#1e3a5f]'}`}
                            >
                              {loc}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Damage Type</p>
                      <div className="flex flex-wrap gap-1">
                        {damageTypes.map(type => {
                          const currentVals = (photos[index]?.damage_type || '').split(',').map(s => s.trim()).filter(Boolean);
                          const active = currentVals.includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                const latest = (photos[index]?.damage_type || '').split(',').map(s => s.trim()).filter(Boolean);
                                const isActive = latest.includes(type);
                                const next = isActive ? latest.filter(v => v !== type) : [...latest, type];
                                updatePhoto(index, 'damage_type', next.join(','));
                              }}
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-[#ff6b35] text-white border-[#ff6b35]' : 'bg-white text-gray-500 border-gray-300 hover:border-[#ff6b35]'}`}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <textarea
                      value={photo.notes}
                      onChange={(e) => updatePhoto(index, 'notes', e.target.value)}
                      placeholder="Notes about the damage and why it needs attention..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none resize-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos.map(p => ({ url: p.photo_url, caption: p.caption, notes: p.notes }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
        />
      )}

      {/* Markup Editor */}
      {markupPhoto && (
        <PhotoMarkupEditor
          photoUrl={markupPhoto.url}
          photoId={markupPhoto.id}
          onSave={handleMarkupSave}
          onClose={() => setMarkupPhoto(null)}
          onCrop={() => setCropPhoto({ url: markupPhoto.url, index: markupPhoto.index })}
        />
      )}

      {/* Crop Modal */}
      {cropPhoto && (
        <PhotoCropModal
          objectUrl={cropPhoto.url}
          onConfirm={handleCropSave}
          onCancel={() => setCropPhoto(null)}
        />
      )}
    </div>
  );
};

export default PhotoUploader;
