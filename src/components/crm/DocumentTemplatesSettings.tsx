import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Save, FileText } from 'lucide-react';

interface DocumentTemplate {
  id?: string;
  company_id: string;
  template_type: 'estimate_terms' | 'change_order_terms' | 'invoice_terms';
  content: string;
  created_at?: string;
  updated_at?: string;
}

export default function DocumentTemplatesSettings() {
  const { profile } = useAuth();
  const [estimateTerms, setEstimateTerms] = useState('');
  const [changeOrderTerms, setChangeOrderTerms] = useState('');
  const [invoiceTerms, setInvoiceTerms] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.company_id) {
      loadTemplates();
    }
  }, [profile?.company_id]);

  const loadTemplates = async () => {
    if (!profile?.company_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('company_id', profile.company_id);

      if (error) throw error;

      if (data) {
        data.forEach((template: DocumentTemplate) => {
          if (template.template_type === 'estimate_terms') {
            setEstimateTerms(template.content);
          } else if (template.template_type === 'change_order_terms') {
            setChangeOrderTerms(template.content);
          } else if (template.template_type === 'invoice_terms') {
            setInvoiceTerms(template.content);
          }
        });
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async (type: DocumentTemplate['template_type'], content: string) => {
    if (!profile?.company_id) return;

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('document_templates')
        .select('id')
        .eq('company_id', profile.company_id)
        .eq('template_type', type)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('document_templates')
          .update({ content, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('document_templates')
          .insert({
            company_id: profile.company_id,
            template_type: type,
            content,
          });

        if (error) throw error;
      }

      toast.success('Template saved successfully');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-500">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <FileText size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Templates</h1>
          <p className="text-sm text-gray-500">Manage default terms and conditions for your documents</p>
        </div>
      </div>

      {/* Estimate Terms */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Estimate Terms & Conditions</h2>
            <p className="text-sm text-gray-500 mt-1">
              Default terms that will appear on all new estimates (e.g., validity period, payment terms)
            </p>
          </div>
          <button
            onClick={() => saveTemplate('estimate_terms', estimateTerms)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            Save
          </button>
        </div>
        <textarea
          value={estimateTerms}
          onChange={(e) => setEstimateTerms(e.target.value)}
          rows={8}
          placeholder="Example:&#10;• This estimate is valid for 30 days from the date issued&#10;• 50% deposit required to begin work&#10;• Final payment due upon completion&#10;• Prices subject to change if materials costs increase"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
        />
      </div>

      {/* Change Order Terms */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Change Order Terms & Conditions</h2>
            <p className="text-sm text-gray-500 mt-1">
              Default terms for change orders (e.g., approval requirements, payment schedule)
            </p>
          </div>
          <button
            onClick={() => saveTemplate('change_order_terms', changeOrderTerms)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            Save
          </button>
        </div>
        <textarea
          value={changeOrderTerms}
          onChange={(e) => setChangeOrderTerms(e.target.value)}
          rows={8}
          placeholder="Example:&#10;• Client signature required before work begins&#10;• Additional costs will be added to final invoice&#10;• Timeline may be adjusted based on scope changes&#10;• Payment due upon completion of change order work"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
        />
      </div>

      {/* Invoice Terms */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Invoice Terms & Conditions</h2>
            <p className="text-sm text-gray-500 mt-1">
              Default payment terms for invoices (e.g., due date, late fees, payment methods)
            </p>
          </div>
          <button
            onClick={() => saveTemplate('invoice_terms', invoiceTerms)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            Save
          </button>
        </div>
        <textarea
          value={invoiceTerms}
          onChange={(e) => setInvoiceTerms(e.target.value)}
          rows={8}
          placeholder="Example:&#10;• Payment due within 30 days of invoice date&#10;• Late payments subject to 1.5% monthly interest&#10;• Accepted payment methods: Check, ACH, Credit Card&#10;• Please include invoice number with payment"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> These templates will be automatically populated when creating new documents. 
          You can still edit them on a per-document basis before sending.
        </p>
      </div>
    </div>
  );
}
