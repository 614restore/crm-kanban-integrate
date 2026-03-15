import html2pdf from 'html2pdf.js';
import { Invoice, InvoiceItem } from './crmData';

interface Company {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  license?: string;
}

interface Customer {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
}

export async function generateInvoicePDF(
  invoice: Invoice,
  company: Company,
  customer: Customer,
  payments?: Array<{ amount: number; paymentDate: string; paymentMethod: string }>
): Promise<void> {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const balanceDue = invoice.amount - totalPaid;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #333; line-height: 1.6; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 40px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
        .company-info { flex: 1; }
        .company-name { font-size: 24px; font-weight: bold; color: #1e40af; margin-bottom: 8px; }
        .company-details { font-size: 11px; color: #666; line-height: 1.8; }
        .logo { width: 120px; height: 120px; object-fit: contain; }
        .invoice-title { text-align: center; font-size: 32px; font-weight: bold; color: #1e40af; margin: 30px 0; text-transform: uppercase; letter-spacing: 2px; }
        .invoice-meta { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .meta-section { flex: 1; }
        .meta-label { font-weight: bold; color: #1e40af; margin-bottom: 5px; }
        .meta-value { color: #666; }
        .section-title { font-size: 14px; font-weight: bold; color: #1e40af; margin: 30px 0 15px; padding-bottom: 5px; border-bottom: 2px solid #e5e7eb; }
        .customer-box { background: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: bold; }
        td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
        tr:last-child td { border-bottom: none; }
        .text-right { text-align: right; }
        .totals-table { margin-left: auto; width: 300px; margin-top: 20px; }
        .totals-table td { padding: 8px 12px; }
        .totals-table .total-row { font-size: 16px; font-weight: bold; background: #f3f4f6; }
        .totals-table .total-row td { padding: 12px; }
        .balance-due { background: #fef3c7; color: #92400e; }
        .paid-full { background: #d1fae5; color: #065f46; }
        .payment-history { margin-top: 30px; }
        .payment-item { display: flex; justify-content: space-between; padding: 8px 12px; background: #f9fafb; margin-bottom: 5px; border-radius: 4px; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; font-size: 10px; color: #666; }
        .terms { margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 8px; font-size: 10px; color: #666; }
        .terms-title { font-weight: bold; color: #333; margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="company-info">
            <div class="company-name">${company.name}</div>
            <div class="company-details">
              ${company.address ? `${company.address}<br>` : ''}
              ${company.city && company.state ? `${company.city}, ${company.state} ${company.zip || ''}<br>` : ''}
              ${company.phone ? `Phone: ${company.phone}<br>` : ''}
              ${company.email ? `Email: ${company.email}<br>` : ''}
              ${company.license ? `License: ${company.license}` : ''}
            </div>
          </div>
          ${company.logo ? `<img src="${company.logo}" alt="Logo" class="logo">` : ''}
        </div>
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-meta">
          <div class="meta-section">
            <div class="meta-label">Invoice #</div>
            <div class="meta-value">${invoice.id}</div>
          </div>
          <div class="meta-section">
            <div class="meta-label">Date</div>
            <div class="meta-value">${formatDate(invoice.createdAt)}</div>
          </div>
          <div class="meta-section">
            <div class="meta-label">Due Date</div>
            <div class="meta-value">${formatDate(invoice.dueDate)}</div>
          </div>
        </div>
        <div class="section-title">BILL TO</div>
        <div class="customer-box">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">${customer.name}</div>
          ${customer.address ? `${customer.address}<br>` : ''}
          ${customer.city && customer.state ? `${customer.city}, ${customer.state} ${customer.zip || ''}<br>` : ''}
          ${customer.phone ? `Phone: ${customer.phone}` : ''}
        </div>
        <div class="section-title">ITEMS</div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map((item: InvoiceItem) => `
              <tr>
                <td>${item.description}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${formatCurrency(item.unitPrice)}</td>
                <td class="text-right">${formatCurrency(item.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <table class="totals-table">
          <tr>
            <td>Subtotal</td>
            <td class="text-right">${formatCurrency(invoice.amount)}</td>
          </tr>
          ${payments && payments.length > 0 ? `
          <tr>
            <td>Total Paid</td>
            <td class="text-right" style="color: #059669;">${formatCurrency(totalPaid)}</td>
          </tr>
          ` : ''}
          <tr class="total-row ${balanceDue <= 0 ? 'paid-full' : 'balance-due'}">
            <td>${balanceDue <= 0 ? 'PAID IN FULL' : 'BALANCE DUE'}</td>
            <td class="text-right">${formatCurrency(balanceDue)}</td>
          </tr>
        </table>
        ${payments && payments.length > 0 ? `
        <div class="payment-history">
          <div class="section-title">PAYMENT HISTORY</div>
          ${payments.map(p => `
            <div class="payment-item">
              <span>${formatDate(p.paymentDate)} - ${p.paymentMethod}</span>
              <span style="font-weight: bold;">${formatCurrency(p.amount)}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}
        <div class="terms">
          <div class="terms-title">PAYMENT TERMS</div>
          Payment is due within 30 days. Thank you for your business!
        </div>
        <div class="footer">
          ${company.name} | ${company.phone || ''} | ${company.email || ''}
        </div>
      </div>
    </body>
    </html>
  `;

  const opt = {
    margin: 0.5,
    filename: `Invoice-${invoice.id}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
  };

  await html2pdf().set(opt).from(html).save();
}
