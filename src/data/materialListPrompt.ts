/**
 * Material List Maintenance & Expansion Prompt.
 *
 * Users download their price list as CSV, paste this prompt plus the CSV into
 * an AI assistant (Perplexity, ChatGPT, Claude), and re-import the CSV that
 * comes back. The prompt encodes the pricing rules the master list follows so
 * bulk edits stay consistent instead of drifting tier by tier.
 *
 * Keep this in sync with the rules documented at the top of ./defaultPricing.ts.
 */

/** Column headers the importer expects, in order. */
export const PRICE_LIST_CSV_HEADER =
  'item_name,category,description,unit,good_price,better_price,best_price';

/**
 * Units the importer and quote builder understand. Every one of these is a
 * per-unit quantity: line totals are always quantity × price. There is no
 * percentage unit — a "pct" row would print as a dollar amount on the quote.
 */
export const PRICE_LIST_UNITS = [
  'ea', 'lf', 'sq', 'sqft', 'bdl', 'bdft', 'roll', 'pair', 'pc', 'sheet',
  'box', 'bag', 'bucket', 'tube', 'pack', 'kit',
] as const;

/** Short rule summary rendered in the UI next to the copy button. */
export const MATERIAL_LIST_RULES: { title: string; detail: string }[] = [
  {
    title: 'One product, one price',
    detail:
      'A row names a specific product, so it carries the same price in Good, Better, and Best. An Atlas StormMaster costs what it costs in any tier. Same for OSB, drywall, and every commodity item.',
  },
  {
    title: 'Tiers come from the product picked',
    detail:
      'Good/Better/Best differ because the quote uses a different primary material — 3-tab vs. architectural vs. designer — not because a row is priced three ways.',
  },
  {
    title: 'Different material, its own row',
    detail:
      'Aluminum vs. steel vs. copper flashing, pine vs. cedar vs. composite pickets: genuinely different products, so give each its own flat-priced row rather than three columns on one.',
  },
  {
    title: 'Schema stays fixed',
    detail:
      'Same seven columns, existing category names, standard units, numbers only — no dollar signs, no commas in prices.',
  },
  {
    title: 'No percentage rows',
    detail:
      'Every price is per unit and gets multiplied by quantity. O&P, markups, and waste factors belong in Supplement Rates and the waste setting — a percentage row would print as a dollar amount on the quote.',
  },
];

/**
 * The full prompt, copied to the clipboard verbatim. Written as instructions to
 * the AI, so it reads as a standalone brief once pasted alongside a CSV.
 */
export const MATERIAL_LIST_MAINTENANCE_PROMPT = `# Material List Maintenance & Expansion Prompt

You are updating a Contractor Material Price List used for professional storm restoration estimating. Follow these rules exactly when adding new items or editing existing entries. They exist to keep pricing consistent and the data clean enough for an adjuster to review.

## 1. The Core Pricing Rule: "One Product, One Price"

A row names a specific product, so that row carries the same price in all three columns: good_price == better_price == best_price. An Atlas StormMaster shake costs what it costs whether it is sold as good, better, or best — it is the same shingle off the same truck. The same is true of OSB 7/16, drywall, fasteners, sealants, house wrap, drip edge, permits, dumpsters, detach & reset, steep and story charges, and every other commodity or service line.

**Tiering does not live in this file.** Good/Better/Best differ because the estimate uses a different primary material — a 3-tab roof versus an architectural roof versus a designer roof — not because a row is priced three ways. Set all three columns equal and let the tier be decided by which product the estimate selects.

### The one exception: genuinely different materials

Some line items name a category rather than a product, and the category spans real material differences — chimney or step flashing in aluminum versus steel versus copper, fence pickets in pine versus cedar versus composite, caulk grades meant for different conditions. Those are different products at different costs.

When you hit one of these, **split it into separate rows, one per material, each flat-priced**:

    Chimney Cap – Galvanized,Soft Metals,...,ea,85,85,85
    Chimney Cap – Stainless Steel,Soft Metals,...,ea,165,165,165
    Chimney Cap – Copper,Soft Metals,...,ea,450,450,450

That is always preferred over one row with three different prices, because the estimator then picks the metal they are actually installing instead of picking a tier. Only leave a row tiered when you cannot identify what the distinct products are — and say so in your summary so it can be resolved.

### Dimensions are separate rows too

A 5" gutter and a 6" gutter are different products, so they are different rows, each flat-priced. Do not express a size difference as a tier.

## 2. Data Structure & Formatting

Return the list in the same CSV schema, with this exact header row and column order:

${PRICE_LIST_CSV_HEADER}

| Column | Requirement |
| --- | --- |
| item_name | Clear, concise name (e.g. "Pipe Boot – 3-in-1 Base"). |
| category | Must match the existing trade groups in the file (e.g. "Roofing – Supplements"). Do not invent new categories when an existing one fits. |
| description | Brief technical detail or usage note. |
| unit | Standard industry units: ${PRICE_LIST_UNITS.join(', ')}. |
| good_price / better_price / best_price | Numeric values only. No currency symbols, no thousands separators, no ranges. |

Preserve every existing row unless I ask you to remove it. Quote any field containing a comma. Do not reorder or rename the columns.

### Never add percentage-based rows

Every price in this file is a per-unit price that gets multiplied by a quantity on the estimate. A row priced as a percentage would be charged as that many dollars instead. So do not add rows for Overhead & Profit, general markups, waste factors, or anything else expressed as a percent — those are handled elsewhere in the app. If an item only makes sense as a percentage, leave it out and tell me about it in your summary instead.

### Never add duplicates

One item, one row. Before adding anything, check whether a row already covers it under a different name (for example "Rooftop Material Delivery Charge" and "Rooftop Material Delivery / Crane Charge" are the same line item). Merge rather than duplicate, and keep the clearer name.

## 3. Audit Workflow

Before returning the file, run a consistency check on every row:

1. Read the item_name. Does it name one specific product (a brand, a model, a spec like "OSB 7/16")?
2. If yes — and that is the overwhelming majority of rows — verify good_price == better_price == best_price. If the three differ, that is a defect: collapse them to the true material cost, which is normally the lowest of the three.
3. If it names a category spanning real material variants, split it into one flat-priced row per material instead of leaving it tiered.
4. Flag any duplicate item_name values and any price that changed by more than 25%.
5. Report any row you had to leave tiered because you could not identify its variants.

## 4. Output

Return the complete updated CSV in a single code block, with no commentary inside the block. After the block, list in plain text:

- Items added, with the reason.
- Items repriced, showing old -> new for each tier.
- Any rule violations you found and how you resolved them.
`;
