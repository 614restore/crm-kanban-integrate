import React, { useState } from 'react';
import { compressImage, formatFileSize } from '@/lib/imageUtils';

type Props = {
  label?: string;
  currentUrl?: string | null;
  uploadFn: (file: File) => Promise<string | null>;
  onUploaded?: (url: string) => void;
  accept?: string;
};

export default function ImageUpload({ label, currentUrl, uploadFn, onUploaded, accept = 'image/*' }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sizeNote, setSizeNote] = useState<string | null>(null);

  const handleFile = async (f?: File) => {
    if (!f) return;
    const compressed = await compressImage(f);
    setFile(compressed);
    setSizeNote(
      f.size !== compressed.size
        ? `Compressed ${formatFileSize(f.size)} → ${formatFileSize(compressed.size)}`
        : null,
    );
    const url = URL.createObjectURL(compressed);
    setPreview(url);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFn(file);
      if (url && onUploaded) onUploaded(url);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
        {preview ? (
          <img src={preview} alt={label || 'preview'} className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-400 text-sm">No image</div>
        )}
      </div>
      <div className="flex flex-col">
        <label className="text-sm text-gray-700 mb-1">{label || 'Upload image'}</label>
        <div className="flex items-center gap-2">
          <input type="file" accept={accept} onChange={onChange} />
          <button onClick={handleUpload} disabled={!file || uploading} className="px-3 py-1 bg-blue-600 text-white rounded">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        {sizeNote && (
          <p className="text-xs text-gray-400 mt-1">{sizeNote} — full size stays on your device</p>
        )}
      </div>
    </div>
  );
}
