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

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
  
  worksheet['!cols'] = Array(Object.keys(data[0] || {}).length).fill({ wch: 15 });
  
  XLSX.writeFile(workbook, filename);
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

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
  
  worksheet['!cols'] = Array(Object.keys(data[0] || {}).length).fill({ wch: 15 });
  
  XLSX.writeFile(workbook, filename);
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
    'Scheduled Date': wo.scheduledDate || '',
    'Assigned To': wo.assignedToNames?.join(', ') || '',
    'Estimated Hours': wo.estimatedHours || '',
    'Actual Hours': wo.actualHours || '',
    'Labor Cost': wo.laborCost,
    'Material Cost': wo.materialCost,
    'Total Cost': wo.totalCost,
    'City': wo.city || '',
    'State': wo.state || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Work Orders');
  
  worksheet['!cols'] = Array(Object.keys(data[0] || {}).length).fill({ wch: 15 });
  
  XLSX.writeFile(workbook, filename);
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

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Material Orders');
  
  worksheet['!cols'] = Array(Object.keys(data[0] || {}).length).fill({ wch: 15 });
  
  XLSX.writeFile(workbook, filename);
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

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Estimates');
  
  worksheet['!cols'] = Array(Object.keys(data[0] || {}).length).fill({ wch: 15 });
  
  XLSX.writeFile(workbook, filename);
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

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');
  
  worksheet['!cols'] = Array(Object.keys(data[0] || {}).length).fill({ wch: 15 });
  
  XLSX.writeFile(workbook, filename);
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

  // Contacts sheet
  if (contacts.length > 0) {
    const contactData = contacts.map(c => ({
      'First Name': c.firstName,
      'Last Name': c.lastName,
      'Email': c.email,
      'Phone': c.phone1,
      'City': c.city,
      'State': c.state,
      'Status': c.status,
      'Project Type': c.projectType || '',
      'Project Value': c.projectValue || '',
      'Created': new Date(c.createdAt).toLocaleDateString(),
    }));
    const ws1 = XLSX.utils.json_to_sheet(contactData);
    XLSX.utils.book_append_sheet(workbook, ws1, 'Contacts');
  }

  // Projects sheet
  if (projects.length > 0) {
    const projectData = projects.map(p => ({
      'Project #': p.projectNumber,
      'Name': p.name,
      'Customer': p.contactName,
      'Status': p.status,
      'Budget': p.estimatedBudget || '',
      'Actual Cost': p.actualCost || '',
    }));
    const ws2 = XLSX.utils.json_to_sheet(projectData);
    XLSX.utils.book_append_sheet(workbook, ws2, 'Projects');
  }

  // Work Orders sheet
  if (workOrders.length > 0) {
    const woData = workOrders.map(wo => ({
      'WO #': wo.workOrderNumber,
      'Title': wo.title,
      'Customer': wo.contactName,
      'Status': wo.status,
      'Total': wo.totalCost,
    }));
    const ws3 = XLSX.utils.json_to_sheet(woData);
    XLSX.utils.book_append_sheet(workbook, ws3, 'Work Orders');
  }

  // Material Orders
  if (materialOrders.length > 0) {
    const moData = materialOrders.map(mo => ({
      'Order #': mo.orderNumber,
      'Supplier': mo.supplierName,
      'Status': mo.status,
      'Amount': mo.totalAmount,
    }));
    const ws4 = XLSX.utils.json_to_sheet(moData);
    XLSX.utils.book_append_sheet(workbook, ws4, 'Material Orders');
  }

  // Estimates
  if (estimates.length > 0) {
    const estData = estimates.map(e => ({
      'Estimate #': e.estimateNumber,
      'Customer': e.customerName,
      'Status': e.status,
      'Total': e.total,
    }));
    const ws5 = XLSX.utils.json_to_sheet(estData);
    XLSX.utils.book_append_sheet(workbook, ws5, 'Estimates');
  }

  // Suppliers
  if (suppliers.length > 0) {
    const suppData = suppliers.map(s => ({
      'Name': s.name,
      'Contact': s.contactName || '',
      'Phone': s.phone || '',
    }));
    const ws6 = XLSX.utils.json_to_sheet(suppData);
    XLSX.utils.book_append_sheet(workbook, ws6, 'Suppliers');
  }

  // Invoices
  if (invoices.length > 0) {
    const invData = invoices.map(i => ({
      'Customer': i.contactName,
      'Amount': i.amount,
      'Status': i.status,
      'Due Date': i.dueDate || '',
    }));
    const ws7 = XLSX.utils.json_to_sheet(invData);
    XLSX.utils.book_append_sheet(workbook, ws7, 'Invoices');
  }

  // Appointments
  if (appointments.length > 0) {
    const apptData = appointments.map(a => ({
      'Customer': a.contactName,
      'Title': a.title,
      'Date': a.date,
      'Status': a.status,
    }));
    const ws8 = XLSX.utils.json_to_sheet(apptData);
    XLSX.utils.book_append_sheet(workbook, ws8, 'Appointments');
  }

  XLSX.writeFile(workbook, filename);
}

// Export financial data only
export function exportFinancialData(
  invoices: Invoice[],
  estimates: Estimate[],
  projects: Project[],
  filename = 'crm-financial-data.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  // Invoices
  if (invoices.length > 0) {
    const invData = invoices.map(i => ({
      'Customer': i.contactName,
      'Amount': i.amount,
      'Status': i.status,
      'Due Date': i.dueDate || '',
      'Created': new Date(i.createdAt).toLocaleDateString(),
      'Paid': i.paidAt ? new Date(i.paidAt).toLocaleDateString() : '',
    }));
    const ws1 = XLSX.utils.json_to_sheet(invData);
    XLSX.utils.book_append_sheet(workbook, ws1, 'Invoices');
  }

  // Estimates
  if (estimates.length > 0) {
    const estData = estimates.map(e => ({
      'Estimate #': e.estimateNumber,
      'Customer': e.customerName,
      'Status': e.status,
      'Total': e.total,
      'Created': new Date(e.createdDate).toLocaleDateString(),
    }));
    const ws2 = XLSX.utils.json_to_sheet(estData);
    XLSX.utils.book_append_sheet(workbook, ws2, 'Estimates');
  }

  // Project Budgets
  if (projects.length > 0) {
    const projData = projects.map(p => ({
      'Project #': p.projectNumber,
      'Name': p.name,
      'Estimated Budget': p.estimatedBudget || 0,
      'Actual Cost': p.actualCost || 0,
      'Variance': (p.estimatedBudget || 0) - (p.actualCost || 0),
      'Status': p.status,
    }));
    const ws3 = XLSX.utils.json_to_sheet(projData);
    XLSX.utils.book_append_sheet(workbook, ws3, 'Project Budgets');
  }

  XLSX.writeFile(workbook, filename);
}
