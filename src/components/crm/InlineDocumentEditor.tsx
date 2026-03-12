// Inline Document Editor - Click fields directly in the document
// Visual, intuitive editing experience

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send, Download, Save, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number';
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}

interface InlineDocumentEditorProps {
  templateName: string;
  templateContent: string;
  fields: DocumentField[];
  onSave?: (data: Record<string, string>) => void;
  onSend?: (data: Record<string, string>) => void;
  onClose?: () => void;
}

export const InlineDocumentEditor: React.FC<InlineDocumentEditorProps> = ({
  templateName,
  templateContent,
  fields,
  onSave,
  onSend,
  onClose
}) => {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    
    // Auto-populate with defaults and current date
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
    
    // Auto-generate document metadata
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

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [filledFields, setFilledFields] = useState<Set<string>>(new Set());

  const requiredFields = fields.filter(f => f.required).map(f => f.key);
  const allRequiredFilled = requiredFields.every(key => formData[key] && formData[key].trim() !== '');

  const generateDocument = () => {
    let content = templateContent;
    
    // Replace all form fields with clickable spans
    fields.forEach(field => {
      const value = formData[field.key];
      const isFilled = value && value.trim() !== '';
      const isRequired = field.required;
      
      // Create a styled span that's clickable
      const replacement = isFilled
        ? `<span 
            class="editable-field filled" 
            data-field="${field.key}"
            title="Click to edit ${field.label}"
          >${value}</span>`
        : `<span 
            class="editable-field empty ${isRequired ? 'required' : ''}" 
            data-field="${field.key}"
            title="Click to fill in ${field.label}${isRequired ? ' (Required)' : ''}"
          >[Click to fill: ${field.label}]</span>`;
      
      content = content.replace(new RegExp(`{{${field.key}}}`, 'g'), replacement);
    });
    
    // Replace any remaining system variables
    Object.entries(formData).forEach(([key, value]) => {
      if (!fields.find(f => f.key === key)) {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value || `[${key}]`);
      }
    });
    
    // Add styles for editable fields
    const styles = `
      <style>
        .editable-field {
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 3px;
          transition: all 0.2s;
          display: inline-block;
          position: relative;
        }
        .editable-field.empty {
          background: #fef3c7;
          border: 2px dashed #f59e0b;
          color: #92400e;
          font-weight: 600;
          animation: pulse 2s infinite;
        }
        .editable-field.empty.required {
          background: #fee2e2;
          border-color: #ef4444;
          color: #991b1b;
        }
        .editable-field.filled {
          background: #d1fae5;
          border: 1px solid #10b981;
          color: #065f46;
        }
        .editable-field:hover {
          transform: scale(1.02);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .editable-field.empty:hover {
          background: #fde68a;
          border-color: #d97706;
        }
        .editable-field.filled:hover {
          background: #a7f3d0;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      </style>
    `;
    
    return content.replace('</head>', `${styles}</head>`);
  };

  const handleFieldClick = (fieldKey: string) => {
    const field = fields.find(f => f.key === fieldKey);
    if (!field) return;
    
    setEditingField(fieldKey);
    setEditValue(formData[fieldKey] || '');
  };

  const handleFieldSave = () => {
    if (editingField) {
      setFormData(prev => ({ ...prev, [editingField]: editValue }));
      setFilledFields(prev => new Set([...prev, editingField]));
      setEditingField(null);
      setEditValue('');
    }
  };

  const handleFieldCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Set up click listener on iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleIframeClick = (e: MessageEvent) => {
      if (e.data.type === 'field-click') {
        handleFieldClick(e.data.fieldKey);
      }
    };

    window.addEventListener('message', handleIframeClick);

    // Inject click handlers into iframe after it loads
    const injectClickHandlers = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) return;

        const editableFields = iframeDoc.querySelectorAll('.editable-field');
        editableFields.forEach(field => {
          field.addEventListener('click', (e) => {
            e.preventDefault();
            const fieldKey = (field as HTMLElement).getAttribute('data-field');
            if (fieldKey) {
              window.postMessage({ type: 'field-click', fieldKey }, '*');
            }
          });
        });
      } catch (err) {
        console.warn('Could not inject click handlers:', err);
      }
    };

    iframe.addEventListener('load', injectClickHandlers);

    return () => {
      window.removeEventListener('message', handleIframeClick);
      iframe.removeEventListener('load', injectClickHandlers);
    };
  }, [formData]);

  const handleSave = () => {
    if (!allRequiredFilled) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in all required fields before saving.',
        variant: 'destructive'
      });
      return;
    }
    onSave?.(formData);
    toast({
      title: 'Document Saved',
      description: `${templateName} has been saved successfully.`
    });
  };

  const handleSend = () => {
    if (!allRequiredFilled) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in all required fields before sending.',
        variant: 'destructive'
      });
      return;
    }
    onSend?.(formData);
    toast({
      title: 'Document Sent',
      description: `${templateName} has been sent to the customer.`
    });
  };

  const handleDownload = () => {
    if (!allRequiredFilled) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in all required fields before downloading.',
        variant: 'destructive'
      });
      return;
    }
    
    // Generate clean document without edit indicators
    let content = templateContent;
    Object.entries(formData).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value || `[${key}]`);
    });
    
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
      description: 'Document has been saved to your downloads folder.'
    });
  };

  const currentField = fields.find(f => f.key === editingField);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">{templateName}</h2>
            {allRequiredFilled ? (
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>All required fields filled</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{requiredFields.length - requiredFields.filter(k => formData[k]?.trim()).length} required fields remaining</span>
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

        {/* Instructions */}
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 text-sm text-blue-800">
          <strong>💡 How to use:</strong> Click on any highlighted field in the document below to fill it in. 
          Required fields are shown in red, optional fields in yellow.
        </div>

        {/* Document Preview */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto bg-white shadow-lg">
            <iframe
              ref={iframeRef}
              srcDoc={generateDocument()}
              className="w-full border-0"
              style={{ minHeight: '800px', height: 'calc(90vh - 250px)' }}
              title="Document Preview"
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        </div>

        {/* Edit Modal */}
        {editingField && currentField && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-10">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">
                {currentField.label}
                {currentField.required && <span className="text-red-500 ml-1">*</span>}
              </h3>
              
              {currentField.type === 'textarea' ? (
                <Textarea
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={currentField.placeholder}
                  rows={4}
                  className="mb-4"
                />
              ) : (
                <Input
                  autoFocus
                  type={currentField.type}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={currentField.placeholder}
                  className="mb-4"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFieldSave();
                    if (e.key === 'Escape') handleFieldCancel();
                  }}
                />
              )}
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleFieldCancel}>
                  Cancel
                </Button>
                <Button onClick={handleFieldSave}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InlineDocumentEditor;
