# Master Implementation Guide
## Making All Document Templates Fully Editable

**Status:** ✅ Safe, incremental approach with rollback capability

---

## Overview

You have **24 document templates** total:
- ✅ **ct-001** (Asphalt Shingle) - ALREADY DONE with 70+ editable fields
- ⏳ **ct-002 through ct-013** - Need comprehensive fields arrays (12 templates)
- ⏳ **10 professional templates** in DocumentTemplates.tsx - Need fields arrays

---

## Phase 1: Commit Current Work ✅

```bash
cd /Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate
git add .
git commit -m "Add template fields reference documents for systematic updates"
git push origin main
```

---

## Phase 2: Update Contractor Templates (ct-002 through ct-013)

### Step-by-Step Process

**For each template:**

1. Open `src/lib/contractorTemplates.ts`
2. Find the template by ID (e.g., `id: 'ct-002'`)
3. Copy the `fields` array from the reference docs
4. Paste it right after the `category` line, before `content`
5. Save and test

### Batch 1: Metal Roofs (ct-002, ct-003)

```bash
# After updating ct-002 and ct-003:
git add src/lib/contractorTemplates.ts
git commit -m "Add comprehensive editable fields to Metal Roof templates (ct-002, ct-003)"
git push origin main
npm run dev  # Test in browser
```

**Reference:** `TEMPLATE_FIELDS_GENERATOR.md` (Part 1)

### Batch 2: Siding (ct-004, ct-005)

```bash
# After updating ct-004 and ct-005:
git add src/lib/contractorTemplates.ts
git commit -m "Add comprehensive editable fields to Siding templates (ct-004, ct-005)"
git push origin main
npm run dev  # Test
```

**Reference:** `TEMPLATE_FIELDS_GENERATOR_PART2.md`

### Batch 3: Gutters & Interior (ct-006, ct-007, ct-008)

```bash
# After updating ct-006, ct-007, ct-008:
git add src/lib/contractorTemplates.ts
git commit -m "Add comprehensive editable fields to Gutters, Drywall, Paint templates (ct-006-008)"
git push origin main
npm run dev  # Test
```

**Reference:** `TEMPLATE_FIELDS_GENERATOR_PART2.md` and `PART3.md`

### Batch 4: Compliance & Contracts (ct-009, ct-010, ct-011, ct-012, ct-013)

```bash
# After updating ct-009 through ct-013:
git add src/lib/contractorTemplates.ts
git commit -m "Add comprehensive editable fields to EPA, Window, Siding, Insurance, Interior contracts (ct-009-013)"
git push origin main
npm run dev  # Test
```

**Reference:** `TEMPLATE_FIELDS_GENERATOR_PART3.md`

---

## Phase 3: Fix Template Card UI

### Problem
Action buttons are always visible and cluttered (see screenshot).

### Solution: Dropdown Menu (Recommended)

**File:** `src/components/crm/DocumentTemplates.tsx`

**Find this section** (around line 800-850):

```tsx
<div className="flex gap-2">
  <Button size="sm" variant="outline" onClick={...}>
    <Eye className="w-4 h-4 mr-1" />
    Preview
  </Button>
  <Button size="sm" onClick={...}>
    <User className="w-4 h-4 mr-1" />
    Create
  </Button>
  <Button size="sm" variant="outline" onClick={...}>
    <Copy className="w-4 h-4" />
  </Button>
  {/* ... more buttons ... */}
</div>
```

**Replace with:**

```tsx
import { MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// In the card:
<div className="flex items-center justify-between gap-2">
  {/* Primary action - always visible */}
  {template.fields && template.fields.length > 0 ? (
    <Button 
      size="sm" 
      className="flex-1"
      onClick={() => {
        setEditorTemplate(template);
        setShowSimpleEditor(true);
      }}
    >
      <Edit className="w-4 h-4 mr-1" />
      Fill & Use
    </Button>
  ) : (
    <>
      <Button 
        size="sm" 
        variant="outline"
        className="flex-1"
        onClick={() => {
          setSelectedTemplate(template);
          setPreviewMode(true);
        }}
      >
        <Eye className="w-4 h-4 mr-1" />
        Preview
      </Button>
      <Button 
        size="sm"
        className="flex-1"
        onClick={() => openCustomerEdit(template)}
      >
        <User className="w-4 h-4 mr-1" />
        Create
      </Button>
    </>
  )}
  
  {/* Secondary actions in dropdown */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
        <MoreVertical className="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuItem onClick={() => {
        setSelectedTemplate(template);
        setPreviewMode(true);
      }}>
        <Eye className="w-4 h-4 mr-2" />
        Preview
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => duplicateTemplate(template)}>
        <Copy className="w-4 h-4 mr-2" />
        Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setMovingTemplateId(movingTemplateId === template.id ? null : template.id)}>
        <FolderPlus className="w-4 h-4 mr-2" />
        Move to Folder
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => {/* download logic */}}>
        <Download className="w-4 h-4 mr-2" />
        Download PDF
      </DropdownMenuItem>
      {!template.isDefault && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => deleteTemplate(template)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

**Commit:**

```bash
git add src/components/crm/DocumentTemplates.tsx
git commit -m "Improve template card UI with dropdown menu for secondary actions"
git push origin main
```

---

## Phase 4: Add Checkbox Support (Future Enhancement)

**For documents like "Professional Work Order" with checkboxes:**

1. Add new field type to `DocumentField` interface:
   ```typescript
   type: 'text' | 'textarea' | 'date' | 'number' | 'checkbox'
   ```

2. Update `UnifiedDocumentBuilder` to render checkboxes

3. In template HTML, use special syntax:
   ```html
   <input type="checkbox" {{CHECKBOX_SAFETY_HARNESS}} /> Safety harness worn
   ```

**This can be done in a future update after core fields are complete.**

---

## Phase 5: Make Payment Terms Editable Everywhere

**Already included!** All templates now have:

```typescript
{ 
  key: 'PAYMENT_TERMS', 
  label: 'Payment Terms', 
  type: 'textarea', 
  defaultValue: 'Payment is due within 30 days of invoice date.\nLate payments subject to 1.5% monthly finance charge.\nQuestions? Contact us at (614) 808-8899.', 
  required: true 
},
```

Users can edit this in the document builder before generating the final document.

---

## Testing Checklist

After each batch of updates:

- [ ] Open Templates page in browser
- [ ] Find updated template
- [ ] Click "Fill & Use" button
- [ ] Verify all fields appear in left sidebar
- [ ] Edit a few fields
- [ ] Check live preview updates on right side
- [ ] Save document
- [ ] Verify saved document has correct values

---

## Rollback Plan

If something breaks:

```bash
# See recent commits
git log --oneline -5

# Rollback to previous commit
git reset --hard HEAD~1

# Or rollback to specific commit
git reset --hard <commit-hash>

# Force push (only if you're the only one working on this branch)
git push origin main --force
```

---

## Summary

**Safe Approach:**
1. ✅ Reference docs created (no code changes yet)
2. ⏳ Update templates in small batches (2-3 at a time)
3. ⏳ Test after each batch
4. ⏳ Commit after each successful batch
5. ⏳ Fix UI separately
6. ✅ Full rollback capability at every step

**Timeline:**
- Batch 1-4: ~30-45 minutes (copy/paste + test)
- UI Fix: ~15 minutes
- Total: ~1 hour of focused work

**Result:**
- All 24 templates fully editable
- Clean, professional UI
- Payment terms customizable
- Grade-school simple for users

---

## Questions?

- **Q: What if I make a mistake?**
  - A: Just rollback with `git reset --hard HEAD~1`

- **Q: Can I do all templates at once?**
  - A: Not recommended. Batches are safer and easier to debug.

- **Q: What about the 10 professional templates in DocumentTemplates.tsx?**
  - A: Those need fields arrays too, but they're more complex. Do contractor templates first, then tackle those separately.

- **Q: Do I need to update the HTML content?**
  - A: No! The HTML already has `{{VARIABLE}}` placeholders. You're just adding the `fields` array so users can edit those variables.

---

**Ready to start? Begin with Phase 1 (commit current work), then tackle Phase 2 Batch 1!**
