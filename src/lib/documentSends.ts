// documentSends.ts
// Handles creating, fetching, and updating document send records in Supabase.

import { supabase } from './supabase';

export interface DocumentSend {
  id: string;
  company_id: string;
  contact_id?: string;
  template_id: string;
  template_name: string;
  sent_to_email: string;
  sent_to_name?: string;
  sent_by?: string;
  document_html: string;
  token: string;
  status: 'sent' | 'viewed' | 'signed' | 'declined';
  signed_at?: string;
  signature_data?: string;
  signed_name?: string;
  signer_ip?: string;
  created_at: string;
  updated_at: string;
}

// Generate a cryptographically secure token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createDocumentSend(payload: {
  company_id: string;
  contact_id?: string;
  template_id: string;
  template_name: string;
  sent_to_email: string;
  sent_to_name?: string;
  sent_by?: string;
  document_html: string;
}): Promise<DocumentSend> {
  const token = generateToken();
  const { data, error } = await supabase
    .from('document_sends')
    .insert({ ...payload, token, status: 'sent' })
    .select()
    .single();
  if (error) throw error;
  return data as DocumentSend;
}

export async function getDocumentSendByToken(token: string): Promise<DocumentSend | null> {
  const { data, error } = await supabase
    .from('document_sends')
    .select('*')
    .eq('token', token)
    .single();
  if (error) return null;
  return data as DocumentSend;
}

export async function markDocumentViewed(token: string): Promise<void> {
  await supabase
    .from('document_sends')
    .update({ status: 'viewed', updated_at: new Date().toISOString() })
    .eq('token', token)
    .eq('status', 'sent'); // only update if still 'sent'
}

export async function submitDocumentSignature(payload: {
  token: string;
  signature_data: string;
  signed_name: string;
  signer_ip?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('document_sends')
    .update({
      status: 'signed',
      signature_data: payload.signature_data,
      signed_name: payload.signed_name,
      signer_ip: payload.signer_ip ?? '',
      signed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('token', payload.token);
  if (error) throw error;
}

export async function listDocumentSends(company_id: string): Promise<DocumentSend[]> {
  const { data, error } = await supabase
    .from('document_sends')
    .select('*')
    .eq('company_id', company_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DocumentSend[];
}
