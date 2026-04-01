// Simple Side-by-Side Document Editor
// Clean form on left, live preview on right

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Send, Download, Save, X, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number';
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}

interface SimpleDocumentEditorProps {
  templateName: string;
  templateContent: string;
  fields: DocumentField[];
  onSave?: (data: Record<string, string>) => void;
  onSend?: (data: Record<string, string>) => void;
  onClose?: () => void;
}

export const SimpleDocumentEditor: React.FC<SimpleDocumentEditorProps> = ({
  templateName,
  templateContent,
  fields,
  onSave,
  onSend,
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
    if (!allRequiredFilled) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }
    onSave?.(formData);
    toast({
      title: 'Document Saved',
      description: `${templateName} has been saved.`
    });
  };

  const handleSend = () => {
    if (!allRequiredFilled) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }
    onSend?.(formData);
    toast({
      title: 'Document Sent',
      description: `${templateName} has been sent.`
    });
  };

  const handleDownload = () => {
    if (!allRequiredFilled) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }
    
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
      description: 'Open the file and print to PDF.'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">{templateName}</h2>
            {allRequiredFilled && (
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ready to send</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={!allRequiredFilled}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!allRequiredFilled}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button size="sm" onClick={handleSend} disabled={!allRequiredFilled}>
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Main Content - Side by Side */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Side - Simple Form */}
          <div className="w-96 border-r bg-gray-50 p-6 overflow-y-auto">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Fill in the details</h3>
                <p className="text-sm text-gray-600">
                  Enter the information below. The document updates automatically.
                </p>
              </div>

              {fields.map(field => {
                const isFilled = formData[field.key] && formData[field.key].trim() !== '';
                return (
                  <div key={field.key} className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {isFilled && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      type={field.type}
                      value={formData[field.key]}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      className="w-full"
                    />
                  </div>
                );
              })}

              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500">
                  Auto-generated: Document ID, Certificate Number, Verification Hash
                </p>
              </div>
            </div>
          </div>

          {/* Right Side - Live Preview */}
          <div className="flex-1 bg-gray-100 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="mb-3 text-sm text-gray-600 bg-white px-4 py-2 rounded-lg border">
                <strong>Live Preview:</strong> Changes appear instantly as you type
              </div>
              <Card className="bg-white shadow-lg">
                <iframe
                  srcDoc={generateCleanDocument()}
                  className="w-full border-0"
                  style={{ minHeight: '1000px', height: 'calc(90vh - 180px)' }}
                  title="Document Preview"
                  sandbox="allow-same-origin"
                />
              </Card>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SimpleDocumentEditor;
