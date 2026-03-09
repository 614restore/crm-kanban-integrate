// POST /api/quickbooks-sync
// Body: { company_id, sync_type: 'invoices' | 'customers' | 'all' }
// Pushes data from Supabase → QuickBooks
import OAuthClient from 'intuit-oauth';
import QuickBooks from 'node-quickbooks';
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt, setNoCacheHeaders } from './_crypto-utils.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://qgvuzrvpyyrrulhwlzma.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function getAccessToken(company) {
  // Access tokens are never stored in DB (volatile memory only per Intuit requirement).
  // Always generate a fresh access token from the encrypted refresh token.
  const refreshToken = decrypt(company.qb_refresh_token);
  if (!refreshToken) throw new Error('No refresh token — please reconnect QuickBooks.');

  const environment = company.qb_environment || 'sandbox';
  const oauthClient = new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID,
    clientSecret: process.env.QBO_CLIENT_SECRET,
    environment,
    redirectUri: 'https://crm-kanban-integrate.vercel.app/api/quickbooks-callback',
  });

  oauthClient.setToken({
    token_type: 'bearer',
    access_token: '',
    refresh_token: refreshToken,
    expires_in: 0,
  });

  const refreshed = await oauthClient.refresh();
  const token = refreshed.getJson();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  // Save the new encrypted refresh token back to DB; access token stays in memory only
  await supabase.from('companies').update({
    qb_access_token: null,
    qb_refresh_token: encrypt(token.refresh_token || refreshToken),
    qb_token_expires_at: expiresAt,
  }).eq('id', company.id);

  return token.access_token; // returned in memory, never persisted
}

function getQBClient(accessToken, realmId, environment) {
  const useSandbox = environment === 'sandbox';
  return new QuickBooks(
    process.env.QBO_CLIENT_ID,
    process.env.QBO_CLIENT_SECRET,
    accessToken,
    false, // no token secret for OAuth2
    realmId,
    useSandbox,
    false, // debug
    null,  // minor version
    '2.0', // oauth version
    null   // refresh token (handled separately)
  );
}

export default async function handler(req, res) {
  setCors(res);
  setNoCacheHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' });
  }

  const { company_id, sync_type = 'all' } = req.body || {};
  if (!company_id) return res.status(400).json({ error: 'Missing company_id' });

  // Load company QB tokens
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name, qb_access_token, qb_refresh_token, qb_realm_id, qb_token_expires_at, qb_environment')
    .eq('id', company_id)
    .single();

  if (companyError || !company?.qb_refresh_token) {
    return res.status(400).json({ error: 'QuickBooks not connected. Please connect first.' });
  }

  const results = { customers: 0, invoices: 0, errors: [] };

  try {
    const accessToken = await getAccessToken(company);
    const qb = getQBClient(accessToken, company.qb_realm_id, company.qb_environment);

    // Load contacts (customers)
    if (sync_type === 'customers' || sync_type === 'all') {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone1, address, city, state, zip')
        .eq('company_id', company_id)
        .is('qb_customer_id', null) // only unsynced
        .limit(50);

      for (const contact of contacts || []) {
        try {
          await new Promise((resolve, reject) => {
            qb.createCustomer({
              DisplayName: `${contact.first_name} ${contact.last_name}`.trim(),
              PrimaryEmailAddr: contact.email ? { Address: contact.email } : undefined,
              PrimaryPhone: contact.phone1 ? { FreeFormNumber: contact.phone1 } : undefined,
              BillAddr: contact.address ? {
                Line1: contact.address,
                City: contact.city,
                CountrySubDivisionCode: contact.state,
                PostalCode: contact.zip,
                Country: 'US',
              } : undefined,
            }, async (err, customer) => {
              if (err) { reject(err); return; }
              // Save QB customer ID back to contact
              await supabase.from('contacts').update({ qb_customer_id: customer.Id }).eq('id', contact.id);
              results.customers++;
              resolve(customer);
            });
          });
        } catch (err) {
          results.errors.push(`Customer ${contact.first_name} ${contact.last_name}: ${err.message}`);
        }
      }
    }

    // Sync invoices
    if (sync_type === 'invoices' || sync_type === 'all') {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, contact_id, amount, due_date, status, items, notes, contacts(first_name, last_name, qb_customer_id)')
        .eq('company_id', company_id)
        .is('qb_invoice_id', null) // only unsynced
        .in('status', ['sent', 'paid', 'overdue'])
        .limit(50);

      for (const invoice of invoices || []) {
        try {
          const contact = invoice.contacts;
          let customerId = contact?.qb_customer_id;

          // If no QB customer yet, create one
          if (!customerId && contact) {
            customerId = await new Promise((resolve, reject) => {
              qb.createCustomer({
                DisplayName: `${contact.first_name} ${contact.last_name}`.trim(),
              }, async (err, customer) => {
                if (err) { reject(err); return; }
                await supabase.from('contacts').update({ qb_customer_id: customer.Id }).eq('id', invoice.contact_id);
                resolve(customer.Id);
              });
            });
          }

          if (!customerId) {
            results.errors.push(`Invoice ${invoice.invoice_number}: no customer found`);
            continue;
          }

          const lineItems = (invoice.items || []).map((item, i) => ({
            Id: String(i + 1),
            LineNum: i + 1,
            Description: item.description || 'Service',
            Amount: Number(item.total || item.unit_price || 0),
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: {
              UnitPrice: Number(item.unit_price || item.unitPrice || 0),
              Qty: Number(item.quantity || 1),
            },
          }));

          if (lineItems.length === 0) {
            lineItems.push({
              Id: '1', LineNum: 1,
              Description: 'Services',
              Amount: Number(invoice.amount || 0),
              DetailType: 'SalesItemLineDetail',
              SalesItemLineDetail: { UnitPrice: Number(invoice.amount || 0), Qty: 1 },
            });
          }

          await new Promise((resolve, reject) => {
            qb.createInvoice({
              DocNumber: invoice.invoice_number,
              CustomerRef: { value: customerId },
              DueDate: invoice.due_date,
              Line: lineItems,
              PrivateNote: invoice.notes || '',
            }, async (err, qbInvoice) => {
              if (err) { reject(err); return; }
              await supabase.from('invoices').update({ qb_invoice_id: qbInvoice.Id }).eq('id', invoice.id);
              results.invoices++;
              resolve(qbInvoice);
            });
          });
        } catch (err) {
          results.errors.push(`Invoice ${invoice.invoice_number}: ${err.message}`);
        }
      }
    }

    return res.status(200).json({
      success: true,
      synced: results,
      message: `Synced ${results.customers} customers + ${results.invoices} invoices to QuickBooks`,
    });
  } catch (err) {
    console.error('QB sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
