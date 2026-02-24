import { Invoice, formatCurrency, formatDate } from './crmData';

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
    const link = document.createElement('url');
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
