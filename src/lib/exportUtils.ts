import * as XLSX from 'xlsx';
import {
  Invoice,
  Contact,
  Project,
  WorkOrder,
  MaterialOrder,
  Estimate,
  Supplier,
  Appointment,
  formatCurrency,
  formatDate
} from './crmData';

/**
 * Converts a string to a CSV-safe format by escaping quotes.
 */
function escapeCsv(value: string | number | undefined | null): string {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

/**
 * Triggers a browser download for a generated CSV string.
 */
function downloadCsv(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Exports invoices to a standard Excel-friendly CSV format.
 */
export function exportToExcel(invoices: Invoice[]) {
    const headers = [
        'Invoice ID',
        'Customer Name',
        'Amount',
        'Tax',
        'Total',
        'Status',
        'Due Date',
        'Paid Date',
        'Created At',
    ];

    const rows = invoices.map((inv) => {
        // Basic calculation recalculation from items
        const subtotal = inv.items.reduce((sum, item) => sum + item.total, 0);
        // Assuming 8.25% standard if not explicitly saved on the invoice in the old data model
        const total = inv.amount;
        const tax = total - subtotal;

        return [
            inv.id,
            inv.contactName,
            subtotal.toFixed(2),
            tax.toFixed(2),
            total.toFixed(2),
            inv.status,
            formatDate(inv.dueDate),
            inv.paidAt ? formatDate(inv.paidAt) : '',
            formatDate(inv.createdAt),
        ].map(escapeCsv);
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    downloadCsv(csvContent, `StormCraft_Invoices_${new Date().toISOString().split('T')[0]}.csv`);
}

/**
 * Exports invoices to a strict QuickBooks Online (QBO) compatible format.
 */
export function exportToQuickBooks(invoices: Invoice[]) {
    // Common QuickBooks import headers
    const headers = [
        'InvoiceNo',
        'Customer',
        'InvoiceDate',
        'DueDate',
        'ItemAmount',
        'ItemTaxCode',
        'ItemDescription',
        'ItemQuantity',
        'ItemRate'
    ];

    const rows: string[][] = [];

    invoices.forEach((inv) => {
        if (!inv.items || inv.items.length === 0) {
            // Fallback if no items exist on old mock data
            rows.push([
                inv.id,
                inv.contactName,
                formatDate(inv.createdAt),
                formatDate(inv.dueDate),
                inv.amount.toFixed(2),
                'NON', // Non-taxable dummy
                'Invoice Total',
                '1',
                inv.amount.toFixed(2)
            ].map(escapeCsv));
            return;
        }

        // Map each line item to a QBO row connected by the same InvoiceNo
        inv.items.forEach((item) => {
            rows.push([
                inv.id,
                inv.contactName,
                formatDate(inv.createdAt),
                formatDate(inv.dueDate),
                item.total.toFixed(2),
                item.isTaxable ? 'TAX' : 'NON',
                item.description || 'Service',
                String(item.quantity) || '1',
                item.unitPrice.toFixed(2)
            ].map(escapeCsv));
        });
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    downloadCsv(csvContent, `QBO_Import_${new Date().toISOString().split('T')[0]}.csv`);
}

function writeAndDownload(workbook: XLSX.WorkBook, filename: string) {
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function addSheet(workbook: XLSX.WorkBook, sheetName: string, data: Record<string, string | number>[]) {
  if (data.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, ws, sheetName);
}

// Export contacts to Excel
export function exportContactsToExcel(contacts: Contact[], filename = 'contacts.xlsx') {
  const data = contacts.map(contact => ({
    'First Name': contact.firstName,
    'Last Name': contact.lastName,
    'Email': contact.email,
    'Phone 1': contact.phone1,
    'Phone 2': contact.phone2 || '',
    'Address': contact.address,
    'City': contact.city,
    'State': contact.state,
    'ZIP': contact.zip,
    'Status': contact.status,
    'Lead Source': contact.leadSource,
    'Assigned To': contact.assignedTo,
    'Tags': contact.tags?.join(', ') || '',
    'Insurance Company': contact.insuranceCompany || '',
    'Policy Number': contact.policyNumber || '',
    'Claim Number': contact.claimNumber || '',
    'Project Type': contact.projectType || '',
    'Project Value': contact.projectValue || '',
    'Created At': new Date(contact.createdAt).toLocaleDateString(),
  }));
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, 'Contacts', data);
  writeAndDownload(workbook, filename);
}

// Export projects to Excel
export function exportProjectsToExcel(projects: Project[], filename = 'projects.xlsx') {
  const data = projects.map(project => ({
    'Project Number': project.projectNumber,
    'Name': project.name,
    'Customer': project.contactName,
    'Status': project.status,
    'Priority': project.priority,
    'Start Date': project.startDate || '',
    'End Date': project.endDate || '',
    'Estimated Budget': project.estimatedBudget || '',
    'Actual Cost': project.actualCost || '',
    'Budget Variance': project.estimatedBudget && project.actualCost
      ? (project.estimatedBudget - project.actualCost).toFixed(2)
      : '',
    'Address': project.address || '',
    'City': project.city || '',
    'State': project.state || '',
    'Project Manager': project.projectManagerName || '',
    'Created At': new Date(project.createdAt).toLocaleDateString(),
  }));
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, 'Projects', data);
  writeAndDownload(workbook, filename);
}

// Export work orders to Excel
export function exportWorkOrdersToExcel(workOrders: WorkOrder[], filename = 'work-orders.xlsx') {
  const data = workOrders.map(wo => ({
    'Work Order #': wo.workOrderNumber,
    'Title': wo.title,
    'Customer': wo.contactName,
    'Project': wo.projectName || '',
    'Status': wo.status,
    'Priority': wo.priority,
    'Job Type': wo.jobType || '',
    'Insurance Job': wo.isInsuranceJob ? 'Yes' : 'No',
    'Scheduled Date': wo.scheduledDate || '',
    'Crew Type': wo.isSubcontractor ? 'Subcontractor' : 'In-House',
    'Assigned To': wo.isSubcontractor ? wo.subcontractorCompany || '' : wo.assignedToNames?.join(', ') || '',
    'Sub Foreman': wo.subcontractorForeman || '',
    'Sub Pay Type': wo.subcontractorPayType || '',
    'Sub Rate': wo.subcontractorRate || '',
    'Estimated Hours': wo.estimatedHours || '',
    'Actual Hours': wo.actualHours || '',
    'Labor Cost': wo.isSubcontractor ? 0 : wo.laborCost,
    'Subcontractor Cost': wo.subcontractorCost || 0,
    'Material Cost': wo.materialCost,
    'Total Cost': wo.totalCost,
    'Squares/Units': wo.squares || '',
    'Pitch': wo.pitch || '',
    'Layers': wo.layers || '',
    'Decking': wo.deckingType || '',
    'Product Brand': wo.shingleBrand || '',
    'Product Line': wo.shingleLine || '',
    'Product Color': wo.shingleColor || '',
    'Change Orders': wo.changeOrders?.length || 0,
    'AWO Total': wo.changeOrders?.reduce((sum, co) => sum + co.amount, 0) || 0,
    'City': wo.city || '',
    'State': wo.state || '',
    'Signed By': wo.signedBy || '',
  }));
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, 'Work Orders', data);
  writeAndDownload(workbook, filename);
}

// Export material orders to Excel
export function exportMaterialOrdersToExcel(orders: MaterialOrder[], filename = 'material-orders.xlsx') {
  const data = orders.map(order => ({
    'Order Number': order.orderNumber,
    'Supplier': order.supplierName,
    'Project': order.projectName || '',
    'Status': order.status,
    'Order Date': order.orderDate || '',
    'Expected Delivery': order.expectedDeliveryDate || '',
    'Actual Delivery': order.actualDeliveryDate || '',
    'Total Amount': order.totalAmount,
  }));
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, 'Material Orders', data);
  writeAndDownload(workbook, filename);
}

// Export estimates to Excel
export function exportEstimatesToExcel(estimates: Estimate[], filename = 'estimates.xlsx') {
  const data = estimates.map(estimate => ({
    'Estimate Number': estimate.estimateNumber,
    'Customer': estimate.customerName,
    'Status': estimate.status,
    'Subtotal': estimate.subtotal,
    'Tax': estimate.tax,
    'Total': estimate.total,
    'Valid Until': estimate.validUntil || '',
    'Created Date': new Date(estimate.createdDate).toLocaleDateString(),
    'Sent At': estimate.sentAt ? new Date(estimate.sentAt).toLocaleDateString() : '',
  }));
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, 'Estimates', data);
  writeAndDownload(workbook, filename);
}

// Export suppliers to Excel
export function exportSuppliersToExcel(suppliers: Supplier[], filename = 'suppliers.xlsx') {
  const data = suppliers.map(supplier => ({
    'Supplier Name': supplier.name,
    'Contact Name': supplier.contactName || '',
    'Email': supplier.email || '',
    'Phone': supplier.phone || '',
    'City': supplier.city || '',
    'State': supplier.state || '',
    'Category': supplier.category || '',
  }));
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, 'Suppliers', data);
  writeAndDownload(workbook, filename);
}

// Export ALL data to Excel (multiple sheets)
export function exportAllData(
  contacts: Contact[],
  projects: Project[],
  workOrders: WorkOrder[],
  materialOrders: MaterialOrder[],
  estimates: Estimate[],
  suppliers: Supplier[],
  invoices: Invoice[],
  appointments: Appointment[],
  filename = 'crm-all-data.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  addSheet(workbook, 'Contacts', contacts.map(c => ({
    'First Name': c.firstName, 'Last Name': c.lastName, 'Email': c.email,
    'Phone': c.phone1, 'City': c.city, 'State': c.state, 'Status': c.status,
    'Project Type': c.projectType || '', 'Project Value': c.projectValue || '',
    'Created': new Date(c.createdAt).toLocaleDateString(),
  })));

  addSheet(workbook, 'Projects', projects.map(p => ({
    'Project #': p.projectNumber, 'Name': p.name, 'Customer': p.contactName,
    'Status': p.status, 'Budget': p.estimatedBudget || '', 'Actual Cost': p.actualCost || '',
  })));

  addSheet(workbook, 'Work Orders', workOrders.map(wo => ({
    'WO #': wo.workOrderNumber, 'Title': wo.title, 'Customer': wo.contactName,
    'Job Type': wo.jobType || '', 'Insurance': wo.isInsuranceJob ? 'Yes' : 'No',
    'Status': wo.status, 'Crew': wo.isSubcontractor ? 'Sub' : 'In-House',
    'Labor/Sub Cost': wo.isSubcontractor ? (wo.subcontractorCost || 0) : wo.laborCost,
    'Material Cost': wo.materialCost, 'Total': wo.totalCost,
    'AWOs': wo.changeOrders?.length || 0,
  })));

  addSheet(workbook, 'Material Orders', materialOrders.map(mo => ({
    'Order #': mo.orderNumber, 'Supplier': mo.supplierName,
    'Status': mo.status, 'Amount': mo.totalAmount,
  })));

  addSheet(workbook, 'Estimates', estimates.map(e => ({
    'Estimate #': e.estimateNumber, 'Customer': e.customerName,
    'Status': e.status, 'Total': e.total,
  })));

  addSheet(workbook, 'Suppliers', suppliers.map(s => ({
    'Name': s.name, 'Contact': s.contactName || '', 'Phone': s.phone || '',
  })));

  addSheet(workbook, 'Invoices', invoices.map(i => ({
    'Customer': i.contactName, 'Amount': i.amount, 'Status': i.status, 'Due Date': i.dueDate || '',
  })));

  addSheet(workbook, 'Appointments', appointments.map(a => ({
    'Customer': a.contactName, 'Title': a.title, 'Date': a.date, 'Status': a.status,
  })));

  writeAndDownload(workbook, filename);
}

/**
 * Prints a DOM element as a PDF using the browser's native print dialog.
 * Opens a new window with the element's HTML and a clean print stylesheet.
 */
export function printElementAsPDF(elementId: string, title: string) {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error(`Element with id "${elementId}" not found`);
    return;
  }
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #111; padding: 24px; }
        h1, h2, h3 { font-weight: 700; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #f3f4f6; text-align: left; padding: 6px 10px; border: 1px solid #e5e7eb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
        td { padding: 6px 10px; border: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #f9fafb; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
        .print-header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
        .print-header h1 { font-size: 22px; color: #1e3a5f; }
        .print-header p { color: #6b7280; font-size: 11px; margin-top: 4px; }
        .no-print { display: none !important; }
        @media print {
          body { padding: 0; }
          button, .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="print-header">
        <h1>${title}</h1>
        <p>Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      ${el.innerHTML}
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 500);
}

/**
 * Generates a printable HTML report from structured data and opens print dialog.
 */
export function printDataAsPDF(
  title: string,
  sections: Array<{
    heading: string;
    rows: Record<string, string | number>[];
  }>
) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;

  const tableHtml = sections.map(section => {
    if (!section.rows.length) return '';
    const headers = Object.keys(section.rows[0]);
    return `
      <h2 style="font-size:15px;font-weight:700;margin:20px 0 8px;color:#1e3a5f;">${section.heading}</h2>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${section.rows.map(row =>
          `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`
        ).join('')}</tbody>
      </table>
    `;
  }).join('');

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #111; padding: 24px; }
        h1 { font-size: 22px; font-weight: 800; color: #1e3a5f; }
        h2 { font-size: 15px; font-weight: 700; color: #1e3a5f; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #eff6ff; text-align: left; padding: 7px 10px; border: 1px solid #bfdbfe; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #1d4ed8; }
        td { padding: 6px 10px; border: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #f9fafb; }
        .print-header { border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
        .print-header p { color: #6b7280; font-size: 11px; margin-top: 4px; }
        .brand { font-size: 11px; color: #9ca3af; text-align: right; }
        @media print { button { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="print-header">
        <div>
          <h1>${title}</h1>
          <p>Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div class="brand">TrussCTR by 614 Restore LLC</div>
      </div>
      ${tableHtml}
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// Export financial data only
export function exportFinancialData(
  invoices: Invoice[],
  estimates: Estimate[],
  projects: Project[],
  filename = 'crm-financial-data.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  addSheet(workbook, 'Invoices', invoices.map(i => ({
    'Customer': i.contactName, 'Amount': i.amount, 'Status': i.status,
    'Due Date': i.dueDate || '', 'Created': new Date(i.createdAt).toLocaleDateString(),
    'Paid': i.paidAt ? new Date(i.paidAt).toLocaleDateString() : '',
  })));

  addSheet(workbook, 'Estimates', estimates.map(e => ({
    'Estimate #': e.estimateNumber, 'Customer': e.customerName,
    'Status': e.status, 'Total': e.total,
    'Created': new Date(e.createdDate).toLocaleDateString(),
  })));

  addSheet(workbook, 'Project Budgets', projects.map(p => ({
    'Project #': p.projectNumber, 'Name': p.name,
    'Estimated Budget': p.estimatedBudget || 0, 'Actual Cost': p.actualCost || 0,
    'Variance': (p.estimatedBudget || 0) - (p.actualCost || 0), 'Status': p.status,
  })));

  writeAndDownload(workbook, filename);
}
