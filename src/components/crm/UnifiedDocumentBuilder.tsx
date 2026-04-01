// Unified Document Builder - Matches Estimate Builder Design
// Clean sidebar form + live preview for all document types

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number';
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}

interface UnifiedDocumentBuilderProps {
  templateName: string;
  templateContent: string;
  fields: DocumentField[];
  customerName?: string;
  onSave?: (data: Record<string, string>) => void;
  onClose?: () => void;
}

export const UnifiedDocumentBuilder: React.FC<UnifiedDocumentBuilderProps> = ({
  templateName,
  templateContent,
  fields,
  customerName,
  onSave,
  onClose
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    
    // Auto-populate dates and IDs
    const today = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const hash = Math.random().toString(36).substring(2, 15).toUpperCase();
    
    fields.forEach(field => {
      if (field.type === 'date' && !field.defaultValue) {
        initial[field.key] = today;
      } else {
        initial[field.key] = field.defaultValue || '';
      }
    });
    
    // Auto-generate metadata
    initial['CERTIFICATE_NUMBER'] = `COC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(timestamp).slice(-6)}`;
    initial['DOCUMENT_ID'] = `COC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(timestamp).slice(-6)}`;
    initial['VERIFICATION_HASH'] = `${hash}${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    initial['GENERATION_DATE'] = new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return initial;
  });

  const requiredFields = fields.filter(f => f.required).map(f => f.key);
  const allRequiredFilled = requiredFields.every(key => formData[key] && formData[key].trim() !== '');
  const filledCount = fields.filter(f => formData[f.key] && formData[f.key].trim() !== '').length;
  const blankCount = fields.length - filledCount;

  const generateCleanDocument = () => {
    let content = templateContent;
    
    // Replace all variables - empty ones just disappear
    Object.entries(formData).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    });
    
    // Remove any remaining placeholders
    content = content.replace(/{{[A-Z_]+}}/g, '');
    
    return content;
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave?.(formData);
    toast({
      title: 'Document Saved',
      description: `${templateName} saved successfully.`,
      duration: 2000
    });
  };

  const handleDownload = () => {
    const content = generateCleanDocument();
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName.replace(/\s+/g, '_')}_${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Document Downloaded',
      description: 'Open the file and print to PDF.',
      duration: 2000
    });
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{templateName}</h1>
            <p className="text-sm text-gray-500">
              Filling in data for <span className="font-medium">{customerName || 'Customer'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="px-6 bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save to {customerName || 'Customer'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar - Form */}
        <div className="w-80 border-r bg-gray-50 overflow-y-auto">
          <div className="p-6 space-y-6">
            
            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm text-blue-900">FILL IN VALUES</h3>
                  <p className="text-xs text-blue-700 mt-1">
                    Customer and company info is auto-filled. Enter project-specific values below to complete the document.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {fields.map(field => {
                const isFilled = formData[field.key] && formData[field.key].trim() !== '';
                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {field.type === 'textarea' ? (
                      <Textarea
                        value={formData[field.key]}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        className="text-sm"
                      />
                    ) : (
                      <Input
                        type={field.type}
                        value={formData[field.key]}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="text-sm"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Status Footer */}
            <div className="pt-4 border-t text-xs text-gray-500">
              {blankCount > 0 ? (
                <p>
                  {blankCount} field(s) still blank — document will save with placeholders if left empty.
                </p>
              ) : (
                <p className="text-green-600 font-medium">
                  ✓ All fields filled — ready to save!
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Right Side - Document Preview */}
        <div className="flex-1 bg-gray-100 overflow-hidden flex flex-col">
          
          {/* Preview Header */}
          <div className="bg-gray-800 text-white px-6 py-3 flex items-center justify-between">
            <span className="text-sm font-medium">Document Preview</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-white hover:bg-gray-700"
            >
              Download PDF
            </Button>
          </div>

          {/* Preview Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
              <iframe
                srcDoc={generateCleanDocument()}
                className="w-full border-0"
                style={{ minHeight: '1100px', height: 'calc(100vh - 200px)' }}
                title="Document Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default UnifiedDocumentBuilder;
