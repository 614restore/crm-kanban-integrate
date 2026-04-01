// Work Order & Invoice Helper Functions
import { supabase } from './supabase';
import { db } from './database';

/**
 * Create an invoice from a completed work order
 */
export async function createInvoiceFromWorkOrder(
  workOrderId: string,
  companyId: string,
  userId: string
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    // Get work order details
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', workOrderId)
      .single();

    if (woError || !workOrder) {
      return { success: false, error: 'Work order not found' };
    }

    // Calculate invoice amount
    const subtotal = (workOrder.labor_cost || 0) + 
                     (workOrder.subcontractor_cost || 0) + 
                     (workOrder.material_cost || 0);
    
    // Add change orders
    const changeOrderTotal = (workOrder.change_orders || []).reduce(
      (sum: number, co: any) => sum + (co.amount || 0), 
      0
    );
    
    const total = subtotal + changeOrderTotal;
    const tax = total * 0.0825; // 8.25% tax
    const grandTotal = total + tax;

    // Create invoice
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        company_id: companyId,
        contact_id: workOrder.contact_id,
        work_order_id: workOrderId,
        invoice_number: `INV-${Date.now()}`,
        amount: grandTotal,
        tax_amount: tax,
        status: 'draft',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: `Invoice for Work Order ${workOrder.work_order_number}`,
      })
      .select()
      .single();

    if (invError || !invoice) {
      return { success: false, error: 'Failed to create invoice' };
    }

    // Create invoice items
    const items = [];
    
    if (workOrder.labor_cost > 0) {
      items.push({
        invoice_id: invoice.id,
        description: `Labor - ${workOrder.title}`,
        quantity: workOrder.actual_hours || workOrder.estimated_hours || 1,
        unit_price: workOrder.labor_cost / (workOrder.actual_hours || workOrder.estimated_hours || 1),
        total: workOrder.labor_cost,
      });
    }

    if (workOrder.subcontractor_cost > 0) {
      items.push({
        invoice_id: invoice.id,
        description: `Subcontractor - ${workOrder.subcontractor_company || 'Services'}`,
        quantity: 1,
        unit_price: workOrder.subcontractor_cost,
        total: workOrder.subcontractor_cost,
      });
    }

    if (workOrder.material_cost > 0) {
      items.push({
        invoice_id: invoice.id,
        description: 'Materials',
        quantity: 1,
        unit_price: workOrder.material_cost,
        total: workOrder.material_cost,
      });
    }

    // Add change orders as line items
    (workOrder.change_orders || []).forEach((co: any) => {
      items.push({
        invoice_id: invoice.id,
        description: `Change Order: ${co.description}`,
        quantity: 1,
        unit_price: co.amount,
        total: co.amount,
      });
    });

    if (items.length > 0) {
      await supabase.from('invoice_items').insert(items);
    }

    return { success: true, invoiceId: invoice.id };
  } catch (error) {
    console.error('Error creating invoice from work order:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Add a payment to an invoice
 */
export async function addInvoicePayment(
  invoiceId: string,
  amount: number,
  paymentMethod: string,
  referenceNumber?: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('invoice_payments')
      .insert({
        invoice_id: invoiceId,
        amount,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        notes,
        payment_date: new Date().toISOString(),
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error adding invoice payment:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get all payments for an invoice
 */
export async function getInvoicePayments(invoiceId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching invoice payments:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching invoice payments:', error);
    return [];
  }
}

/**
 * Update work order photo checklist
 */
export async function updatePhotoChecklist(
  workOrderId: string,
  photoChecklist: any[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('work_orders')
      .update({ 
        photo_checklist: photoChecklist,
        updated_at: new Date().toISOString() 
      })
      .eq('id', workOrderId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating photo checklist:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Update work order completion checklist
 */
export async function updateCompletionChecklist(
  workOrderId: string,
  checklistItems: any[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('work_orders')
      .update({ 
        checklist_items: checklistItems,
        updated_at: new Date().toISOString() 
      })
      .eq('id', workOrderId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating completion checklist:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
