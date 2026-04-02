/**
 * Document Scanner Component
 * Allows users to scan and upload printed versions of legal documents
 */

import React, { useState, useRef } from 'react';
import { Camera, Upload, FileText, Check, X, RotateCw, Crop, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';

interface DocumentScannerProps {
  contactId?: string;
  onDocumentUploaded?: (document: any) => void;
  allowedTypes?: string[];
  maxFileSizeMB?: number;
}

export interface ScannedDocument {
  id: string;
  name: string;
  type: 'contract' | 'estimate' | 'invoice' | 'work_order' | 'change_order' | 'other';
  file: File;
  preview?: string;
  scannedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  pages: number;
}

const DOCUMENT_TYPES = [
  { value: 'contract', label: 'Contract/Agreement', icon: FileText },
  { value: 'estimate', label: 'Estimate/Quote', icon: FileText },
  { value: 'invoice', label: 'Invoice', icon: FileText },
  { value: 'work_order', label: 'Work Order', icon: FileText },
  { value: 'change_order', label: 'Change Order', icon: FileText },
  { value: 'other', label: 'Other Document', icon: FileText }
];

const IMAGE_QUALITY_OPTIONS = [
  { value: 'low', label: 'Low (Faster)', maxWidth: 1200 },
  { value: 'medium', label: 'Medium (Balanced)', maxWidth: 1600 },
  { value: 'high', label: 'High (Best Quality)', maxWidth: 2400 }
];

export function DocumentScanner({ 
  contactId, 
  onDocumentUploaded, 
  allowedTypes = ['pdf', 'jpg', 'jpeg', 'png'],
  maxFileSizeMB = 10 
}: DocumentScannerProps) {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [scannedDocs, setScannedDocs] = useState<ScannedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('contract');
  const [quality, setQuality] = useState<string>('medium');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Compress image for better upload performance
  const compressImage = (file: File, quality: string): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const qualityOption = IMAGE_QUALITY_OPTIONS.find(q => q.value === quality);
        const maxWidth = qualityOption?.maxWidth || 1600;
        
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85
        );
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  // Handle file selection (from camera or file picker)
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExt || '')) {
      toast.error(`File type .${fileExt} not allowed. Supported: ${allowedTypes.join(', ')}`);
      return;
    }

    // Validate file size
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      toast.error(`File too large. Maximum size: ${maxFileSizeMB}MB`);
      return;
    }

    try {
      let processedFile = file;
      
      // Compress images for better performance
      if (file.type.startsWith('image/') && quality !== 'high') {
        processedFile = await compressImage(file, quality);
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(processedFile);
      
      const newDoc: ScannedDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        type: selectedType as any,
        file: processedFile,
        preview: previewUrl,
        scannedAt: new Date(),
        status: 'pending',
        pages: 1
      };

      setScannedDocs(prev => [...prev, newDoc]);
      toast.success('Document scanned successfully');
      
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Failed to process document');
    }
  };

  // Upload scanned documents to Supabase
  const uploadDocuments = async () => {
    if (scannedDocs.length === 0) {
      toast.error('No documents to upload');
      return;
    }

    if (!contactId || !profile?.company_id) {
      toast.error('Missing contact or company information');
      return;
    }

    setUploading(true);
    
    try {
      const uploadPromises = scannedDocs.map(async (doc) => {
        // Update status to processing
        setScannedDocs(prev => prev.map(d => 
          d.id === doc.id ? { ...d, status: 'processing' as const } : d
        ));

        // Generate unique filename
        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `${timestamp}_${doc.type}_${doc.file.name}`;
        const filePath = `${profile.company_id}/${contactId}/scanned/${fileName}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, doc.file);

        if (uploadError) {
          throw uploadError;
        }

        // Save document metadata to database
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .insert({
            contact_id: contactId,
            company_id: profile.company_id,
            name: doc.name,
            type: doc.type,
            filepath: uploadData.path,
            file_size: doc.file.size,
            mime_type: doc.file.type,
            is_legal_document: ['contract', 'estimate', 'work_order', 'change_order'].includes(doc.type),
            scanned_document: true,
            scanned_at: doc.scannedAt.toISOString(),
            created_by: user?.id,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (docError) {
          throw docError;
        }

        // Update status to completed
        setScannedDocs(prev => prev.map(d => 
          d.id === doc.id ? { ...d, status: 'completed' as const } : d
        ));

        return docData;
      });

      const uploadedDocs = await Promise.all(uploadPromises);
      
      toast.success(`Successfully uploaded ${uploadedDocs.length} document(s)`);
      
      // Notify parent component
      uploadedDocs.forEach(doc => {
        onDocumentUploaded?.(doc);
      });

      // Clear scanned documents and close dialog
      setScannedDocs([]);
      setIsOpen(false);

    } catch (error) {
      console.error('Error uploading documents:', error);
      toast.error('Failed to upload documents');
      
      // Update failed documents status
      setScannedDocs(prev => prev.map(d => 
        d.status === 'processing' ? { ...d, status: 'failed' as const } : d
      ));
    } finally {
      setUploading(false);
    }
  };

  // Remove document from scan queue
  const removeDocument = (docId: string) => {
    setScannedDocs(prev => {
      const doc = prev.find(d => d.id === docId);
      if (doc?.preview) {
        URL.revokeObjectURL(doc.preview);
      }
      return prev.filter(d => d.id !== docId);
    });
  };

  // Clear all scanned documents
  const clearAll = () => {
    scannedDocs.forEach(doc => {
      if (doc.preview) {
        URL.revokeObjectURL(doc.preview);
      }
    });
    setScannedDocs([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Camera size={16} />
          Scan Documents
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={20} />
            Document Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Scan Controls */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="documentType">Document Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="quality">Image Quality</Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_QUALITY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {/* Camera/Mobile Capture */}
              <Button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full gap-2"
                variant="default"
              >
                <Camera size={16} />
                Take Photo
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />

              {/* File Upload */}
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-2"
                variant="outline"
              >
                <Upload size={16} />
                Upload File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={allowedTypes.map(type => `.${type}`).join(',')}
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>

            <div className="text-sm text-gray-600">
              <p>Supported formats: {allowedTypes.join(', ')}</p>
              <p>Max file size: {maxFileSizeMB}MB</p>
            </div>
          </div>

          {/* Scanned Documents Preview */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Scanned Documents ({scannedDocs.length})</h3>
              {scannedDocs.length > 0 && (
                <Button onClick={clearAll} variant="ghost" size="sm" className="text-red-600">
                  Clear All
                </Button>
              )}
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {scannedDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  {doc.preview && (
                    <img 
                      src={doc.preview} 
                      alt={doc.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{doc.name}</p>
                    <p className="text-xs text-gray-600">
                      {DOCUMENT_TYPES.find(t => t.value === doc.type)?.label}
                    </p>
                    <Badge 
                      variant={doc.status === 'completed' ? 'default' : 
                               doc.status === 'failed' ? 'destructive' : 'secondary'}
                      className="mt-1"
                    >
                      {doc.status === 'processing' && <RotateCw size={12} className="mr-1 animate-spin" />}
                      {doc.status === 'completed' && <Check size={12} className="mr-1" />}
                      {doc.status === 'failed' && <X size={12} className="mr-1" />}
                      {doc.status}
                    </Badge>
                  </div>
                  {doc.status === 'pending' && (
                    <Button
                      onClick={() => removeDocument(doc.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                    >
                      <X size={16} />
                    </Button>
                  )}
                </div>
              ))}

              {scannedDocs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No documents scanned yet</p>
                  <p className="text-sm">Use the camera or upload button to add documents</p>
                </div>
              )}
            </div>

            {/* Upload Actions */}
            {scannedDocs.length > 0 && (
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button onClick={() => setIsOpen(false)} variant="outline">
                  Cancel
                </Button>
                <Button 
                  onClick={uploadDocuments} 
                  disabled={uploading || scannedDocs.length === 0}
                  className="gap-2"
                >
                  {uploading && <RotateCw size={16} className="animate-spin" />}
                  {uploading ? 'Uploading...' : `Upload ${scannedDocs.length} Document(s)`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DocumentScanner;