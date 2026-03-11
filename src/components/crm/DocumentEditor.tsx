// Simple Document Editor with Form-Based Input
// Professional document generation with easy project detail entry

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Edit, Send, Download, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number';
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}

interface DocumentEditorProps {
  templateName: string;
  templateContent: string;
  fields: DocumentField[];
  onSave?: (data: Record<string, string>) => void;
  onSend?: (data: Record<string, string>) => void;
  onClose?: () => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  templateName,
  templateContent,
  fields,
  onSave,
  onSend,
  onClose
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
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

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const generateDocument = () => {
    let content = templateContent;
    
    // Replace all form fields
    Object.entries(formData).forEach(([key, value]) => {
      const displayValue = value || `[${key}]`;
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), displayValue);
    });
    
    // Replace any remaining company/system variables with placeholders
    content = content.replace(/{{([A-Z_]+)}}/g, (match, key) => {
      return formData[key] || `[${key}]`;
    });
    
    return content;
  };

  const handleSave = () => {
    onSave?.(formData);
    toast({
      title: 'Document Saved',
      description: `${templateName} has been saved successfully.`
    });
  };

  const handleSend = () => {
    onSend?.(formData);
    toast({
      title: 'Document Sent',
      description: `${templateName} has been sent to the customer.`
    });
  };

  const handleDownload = () => {
    const content = generateDocument();
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">{templateName}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button size="sm" onClick={handleSend}>
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-4">
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Edit Details
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview Document
            </TabsTrigger>
          </TabsList>

          {/* Edit Tab */}
          <TabsContent value="edit" className="flex-1 overflow-y-auto p-4 m-0">
            <div className="max-w-3xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fields.map(field => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          id={field.key}
                          value={formData[field.key]}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={4}
                          required={field.required}
                        />
                      ) : (
                        <Input
                          id={field.key}
                          type={field.type}
                          value={formData[field.key]}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setActiveTab('preview')}>
                  Preview Document
                </Button>
                <Button onClick={handleSave}>
                  Save Changes
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 m-0">
            <div className="max-w-4xl mx-auto bg-white shadow-lg">
              <iframe
                srcDoc={generateDocument()}
                className="w-full border-0"
                style={{ minHeight: '800px', height: 'calc(90vh - 200px)' }}
                title="Document Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DocumentEditor;
