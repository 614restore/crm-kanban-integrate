# Work Order & Invoice Features - Complete Implementation Plan

## 🎯 Goal
Complete all work order features and implement seamless work order → invoice workflow.

---

## ✅ ALREADY WORKING

### Work Orders
- ✅ 17 job types (roofing, gutters, siding, etc.)
- ✅ Subcontractor assignment
- ✅ Insurance job flagging
- ✅ Job specifications (squares, pitch, etc.)
- ✅ Product selections
- ✅ Change orders (AWOs)
- ✅ Basic signatures (customer only)
- ✅ File attachments
- ✅ Status workflow (scheduled → in_progress → completed → ready_to_invoice)

### Invoices
- ✅ Invoice creation
- ✅ Invoice editing
- ✅ Invoice tracking
- ✅ Financial dashboard

---

## 🔧 FEATURES TO IMPLEMENT

### 1. Photo Checklist UI (4-6 hours)
**Status**: Data structure exists, UI needed

**What to Build**:
- Photo upload section in work order modal
- Predefined checklist categories:
  - Before photos (4 angles)
  - During progress photos
  - After completion photos
  - Supplement photos (for insurance)
- Camera/file upload per checklist item
- Thumbnail display
- GPS/timestamp metadata
- View full-size photos

**Database**: Already has `photo_checklist` JSONB field

**Files to Modify**:
- `WorkOrdersView.tsx` - Add photo section to modal
- Create new component: `PhotoChecklist.tsx`

---

### 2. Completion Checklist UI (2-3 hours)
**Status**: Data structure exists, UI needed

**What to Build**:
- Checklist section in work order modal
- Default items:
  - [ ] Magnet sweep completed
  - [ ] Yard cleaned and debris removed
  - [ ] Materials hauled away
  - [ ] Customer walkthrough completed
  - [ ] Final inspection passed
- Custom checklist items
- Track completion by user + timestamp
- Display on work order cards

**Database**: Already has `checklist_items` JSONB field

**Files to Modify**:
- `WorkOrdersView.tsx` - Add checklist section

---

### 3. Dual Signatures (2-3 hours)
**Status**: Database fields exist, need foreman signature UI

**What to Build**:
- Add foreman signature pad to work order modal
- Separate signature sections:
  - Customer signature (already works)
  - Foreman signature (new)
- Display both signatures on work order cards
- Require both before "Ready to Invoice"

**Database**: Already has `foreman_signed_by` and `foreman_signature_data` fields

**Files to Modify**:
- `WorkOrdersView.tsx` - Add foreman signature modal

---

### 4. Auto-Create Invoice from Work Order (3-4 hours)
**Status**: Not started - HIGH PRIORITY

**What to Build**:
- "Create Invoice" button on work orders with status = `ready_to_invoice`
- Pre-fill InvoiceModal with:
  - Customer from work order
  - Line items:
    - Labor cost (or subcontractor cost)
    - Material cost
    - Each change order (AWO) as separate line item
  - Total = sum of all costs + AWOs
  - Link invoice back to work order ID

**Files to Modify**:
- `WorkOrdersView.tsx` - Add "Create Invoice" button
- `InvoiceModal.tsx` - Accept pre-filled data prop
- `database.ts` - Add `work_order_id` field to invoices table (migration needed)

**New Migration**:
```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES work_orders(id);
```

---

### 5. Payment Tracking (2-3 hours)
**Status**: Partial - needs enhancement

**What to Build**:
- Payment method dropdown (Cash, Check, Credit Card, ACH, Insurance Check)
- Partial payment tracking
- Payment history log
- Receipt generation
- Auto-update work order status when invoice paid

**Files to Modify**:
- `InvoiceModal.tsx` - Add payment tracking section
- `FinancialDashboard.tsx` - Show payment history
- `database.ts` - Add payment tracking functions

**New Migration**:
```sql
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(50),
  payment_date TIMESTAMP NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 6. Professional Invoice PDF (2-3 hours)
**Status**: Not started

**What to Build**:
- PDF generation from invoice data
- Professional template with:
  - Company logo and branding
  - Invoice number and date
  - Customer info
  - Itemized line items
  - Subtotal, tax, total
  - Payment terms
  - Payment instructions
- Download PDF button
- Email PDF to customer

**Files to Modify**:
- Create new file: `src/lib/invoicePdfGenerator.ts`
- `InvoiceModal.tsx` - Add "Download PDF" button
- Use `html2pdf.js` (already installed)

---

## 📋 IMPLEMENTATION ORDER

### Phase 1: Complete Work Orders (8-12 hours)
1. ✅ Photo Checklist UI (4-6 hours)
2. ✅ Completion Checklist UI (2-3 hours)
3. ✅ Dual Signatures (2-3 hours)

### Phase 2: Invoice Integration (5-7 hours)
4. ✅ Auto-Create Invoice from Work Order (3-4 hours)
5. ✅ Payment Tracking (2-3 hours)

### Phase 3: Polish (2-3 hours)
6. ✅ Professional Invoice PDF (2-3 hours)

**Total Estimated Time**: 15-22 hours

---

## 🗄️ DATABASE MIGRATIONS NEEDED

### Migration 1: Invoice Work Order Link
```sql
-- Link invoices to work orders
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES work_orders(id);
CREATE INDEX IF NOT EXISTS idx_invoices_work_order ON invoices(work_order_id);
```

### Migration 2: Payment Tracking
```sql
-- Track invoice payments
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(50),
  payment_date TIMESTAMP NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
```

---

## 📁 NEW FILES TO CREATE

1. `src/components/crm/PhotoChecklist.tsx` - Photo upload component
2. `src/components/crm/CompletionChecklist.tsx` - Checklist component
3. `src/lib/invoicePdfGenerator.ts` - PDF generation logic
4. `supabase/migrations/20260314000001_invoice_enhancements.sql` - New migration

---

## 🧪 TESTING CHECKLIST

### Work Orders
- [ ] Upload photos to checklist
- [ ] Complete checklist items
- [ ] Get customer signature
- [ ] Get foreman signature
- [ ] Mark work order "Ready to Invoice"

### Invoices
- [ ] Create invoice from work order
- [ ] Verify line items auto-populate
- [ ] Verify AWOs included
- [ ] Record payment
- [ ] Generate PDF
- [ ] Email PDF to customer

### Integration
- [ ] Work order → Invoice link works
- [ ] Invoice payment updates work order status
- [ ] Financial dashboard shows correct totals
- [ ] Excel export includes all fields

---

## 🚀 DEPLOYMENT STEPS

1. Run new SQL migrations
2. Deploy frontend code
3. Test with sample data
4. Train team on new features
5. Go live!

---

## 💡 QUICK WINS (Do First)

If you want immediate value, implement in this order:

1. **Auto-Create Invoice** (3-4 hours) - Biggest time saver
2. **Payment Tracking** (2-3 hours) - Close the money loop
3. **Completion Checklist** (2-3 hours) - QC process
4. **Photo Checklist** (4-6 hours) - Documentation
5. **Dual Signatures** (2-3 hours) - Legal protection
6. **Invoice PDF** (2-3 hours) - Professional appearance

---

## 📞 READY TO START?

Let me know which feature you want to implement first, and I'll build it for you!

**Recommended**: Start with Auto-Create Invoice → Payment Tracking → Invoice PDF
This completes the money flow and provides immediate ROI.
