# Document Template Structure

## Overview
The template system has been restructured into a two-tier system:

1. **Legal Documents** - Standalone forms with no line items
2. **Customer Service Agreements** - Contracts with project-specific preloaded line items

---

## Legal Documents (6 templates)

These are standalone legal forms that don't require line-item pricing:

| ID | Name | Description |
|---|---|---|
| `legal-001` | **Contingency Agreement** | Insurance restoration contingency agreement |
| `legal-002` | **3-Day Right to Cancel** | Federal 3-day cancellation notice |
| `legal-003` | **Certificate of Completion** | Project completion certificate |
| `legal-004` | **Change Order** | Contract modification form |
| `legal-005` | **Work Order** | Field work order for crew assignments |
| `legal-006` | **Warranty Certificate** | Workmanship warranty document |

---

## Customer Service Agreements (11 templates)

These are full contracts with preloaded line items specific to each project type:

### Roofing (3 templates)
| ID | Name | Preloaded Line Items |
|---|---|---|
| `ct-001` | **Asphalt Shingle Roof** | Tear-off, decking, ice & water shield, underlayment, drip edge, shingles, ridge cap, flashings, vents, cleanup |
| `ct-002` | **Corrugated Metal Roof** | Tear-off, decking, underlayment, metal panels, ridge cap, trim, fasteners, cleanup |
| `ct-003` | **Standing Seam Metal Roof** | Tear-off, decking, high-temp underlayment, standing seam panels, concealed clips, trim, eave cleat, flashings, snow guards, cleanup |

### Siding (2 templates)
| ID | Name | Preloaded Line Items |
|---|---|---|
| `ct-004` | **Vinyl Siding** | Removal, house wrap, vinyl siding, J-channel/corner posts, soffit, fascia, window trim, sheathing repair, cleanup |
| `ct-005` | **Aluminum Siding** | Removal, house wrap, aluminum siding, corner posts/trim, soffit, fascia, coil stock wraps, sheathing repair, cleanup |

### Exterior (2 templates)
| ID | Name | Preloaded Line Items |
|---|---|---|
| `ct-006` | **Gutters & Downspouts** | Removal, fascia repair, seamless gutters, downspouts, hardware, gutter guards, extensions, cleanup |
| `ct-010` | **Window Replacement** | Removal, framing repairs, windows (by type/size), exterior trim, interior trim, cleanup |

### Interior (2 templates)
| ID | Name | Preloaded Line Items |
|---|---|---|
| `ct-007` | **Interior Drywall** | Demo, framing repairs, drywall hang, tape/finish, corner bead, texture, prime, materials, cleanup |
| `ct-008` | **Interior Paint** | Prep work, walls, ceilings, baseboards/casings, doors, paint/materials, cleanup |

### Restoration (2 templates)
| ID | Name | Preloaded Line Items |
|---|---|---|
| `ct-011` | **Siding Replacement** | Removal, sheathing repair, house wrap, siding, trim materials, soffit, fascia, window wraps, hardware, cleanup |
| `ct-013` | **Interior Restoration** | Demo, drywall, insulation, texture, paint, flooring, trim/millwork, cabinetry, contents, environmental controls, cleanup |

### Insurance (1 template)
| ID | Name | Special Features |
|---|---|---|
| `ct-012` | **Insurance Restoration Contract** | RCV/ACV breakdown, supplement authorization, insurance assignment, dual-party payment schedule |

### Safety/Compliance (1 template)
| ID | Name | Description |
|---|---|---|
| `ct-009` | **EPA Lead Safe Disclosure** | Pre-1978 homes - EPA RRP Rule compliance form |

---

## How It Works

### For Legal Documents:
1. User selects document type (Contingency, 3-Day Cancel, etc.)
2. System auto-fills customer/company info
3. User fills in document-specific fields
4. Generate and sign

### For Customer Service Agreements:
1. User selects project type (Asphalt Roof, Vinyl Siding, etc.)
2. System loads contract template with preloaded line items for that project type
3. All line items are pre-populated with:
   - Description
   - Typical quantities
   - Sample unit prices
   - Calculated totals
4. User adjusts quantities and pricing to match actual project
5. System recalculates totals
6. Generate contract for signature

---

## Benefits

✅ **Faster contract creation** - Line items are preloaded, just adjust quantities/prices
✅ **Consistency** - Every asphalt roof contract has the same line items
✅ **Nothing forgotten** - All typical items are included by default
✅ **Professional** - Standardized formatting across all contracts
✅ **Flexible** - Users can still add/remove line items as needed

---

## Template Type Field

Each template now has a `templateType` field:
- `'legal-document'` - Standalone legal forms
- `'customer-service-agreement'` - Contracts with line items

This allows the UI to handle them differently (e.g., show line item editor for CSAs, simple form for legal docs).

---

## Next Steps

To use this system in the UI:
1. Filter templates by `templateType`
2. For legal documents: Show simple form with text fields
3. For CSAs: Show line item table with editable quantities/prices
4. Auto-calculate totals as user edits
5. Generate final PDF/HTML with all values filled in
