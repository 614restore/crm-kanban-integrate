import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Save, FileText } from 'lucide-react';

interface DocTemplate {
  id: string;
  name: string;
  type: string;
  body: string;
  created_at: string;
  company_id: string;
}

export default function DocumentTemplatesSettings({ companyId }: { companyId: string }) {
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Partial<DocTemplate> | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('document_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setTemplates((data as DocTemplate[]) || []);
    setLoaded(true);
  }

  if (!loaded) { load(); return <div className="p-6 text-gray-400">Loading templates...</div>; }

  async function handleSave() {
    if (!editing?.name || !editing?.body) return;
    setSaving(true);
    if (editing.id) {
      await supabase.from('document_templates').update({ name: editing.name, type: editing.type, body: editing.body }).eq('id', editing.id);
    } else {
      await supabase.from('document_templates').insert({ company_id: companyId, name: editing.name, type: editing.type || 'contract', body: editing.body });
    }
    setSaving(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;
    await supabase.from('document_templates').delete().eq('id', id);
    load();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><FileText size={18} /> Document Templates</h2>
        <button onClick={() => setEditing({ type: 'contract' })} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus size={14} /> New Template
        </button>
      </div>

      {editing && (
        <div className="mb-6 p-4 border border-blue-200 rounded-xl bg-blue-50 flex flex-col gap-3">
          <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Template name" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} />
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={editing.type || 'contract'} onChange={e => setEditing({ ...editing, type: e.target.value })}>
            <option value="contract">Contract</option>
            <option value="estimate">Estimate</option>
            <option value="invoice">Invoice</option>
            <option value="change_order">Change Order</option>
            <option value="scope">Scope of Work</option>
          </select>
          <textarea rows={8} className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" placeholder="Template body — use {{first_name}}, {{address}}, {{project_value}} etc." value={editing.body || ''} onChange={e => setEditing({ ...editing, body: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {templates.length === 0 && <p className="text-gray-400 text-sm">No templates yet. Create one to get started.</p>}
        {templates.map(t => (
          <div key={t.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
            <div>
              <p className="font-medium text-gray-800">{t.name}</p>
              <p className="text-xs text-gray-400 capitalize">{t.type.replace('_', ' ')}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(t)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-100">Edit</button>
              <button onClick={() => handleDelete(t.id)} className="text-xs px-3 py-1.5 text-red-600 border border-red-100 rounded-lg hover:bg-red-50"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
