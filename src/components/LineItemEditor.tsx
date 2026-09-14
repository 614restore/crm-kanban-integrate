// Copied from QuoteMGR src/components/LineItemEditor.tsx (read-only reference).
import React, { useState, useRef } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Package, GripVertical, Sparkles, RotateCcw, Star, Info, Eye, EyeOff } from 'lucide-react';
import { lineItemCategories, defaultLineItems, tierLabels } from '@/data/quoteData';
import type { LineItem, Company, CompanyPricing } from '@/data/quoteData';
import { toast } from 'sonner';
import { suggestPricing, generateLineItemDescription } from '@/lib/aiHelper';
import type { PriceSuggestion } from '@/lib/aiHelper';
import { supabase } from '@/lib/supabase';

// ─── Brand product catalog ────────────────────────────────────────────────────
// Each brand defines what its Good / Better / Best products are for each
// common roofing (and other) line-item type. All three tiers stay within the
// same manufacturer so the quote is consistent.

type BrandProducts = Record<string, { good: string; better: string; best: string }>;

export const SIDING_BRANDS: { id: string; label: string }[] = [
  { id: 'hardie', label: 'James Hardie' },
  { id: 'lp-smartside', label: 'LP SmartSide' },
  { id: 'certainteed-siding', label: 'CertainTeed' },
  { id: 'allura', label: 'Allura' },
  { id: 'kaycan', label: 'KayCAN' },
  { id: 'royal', label: 'Royal Building Products' },
  { id: 'provia', label: 'ProVia' },
];

export const SHINGLE_BRANDS: { id: string; label: string }[] = [
  { id: 'atlas',            label: 'Atlas Roofing' },
  { id: 'gaf',             label: 'GAF' },
  { id: 'owens_corning',    label: 'Owens Corning' },
  { id: 'certainteed',     label: 'CertainTeed' },
  { id: 'iko',             label: 'IKO' },
  { id: 'tamko',           label: 'TAMKO' },
  { id: 'standing_seam',   label: 'Metal — Standing Seam' },
  { id: 'corrugated_metal', label: 'Metal — Corrugated' },
];

export const BRAND_CATALOG: Record<string, BrandProducts> = {
  atlas: {
    shingle:      { good: 'Atlas ProLam AR',                   better: 'Atlas Pinnacle Pristine',           best: 'Atlas StormMaster Shake' },
    underlayment: { good: 'Atlas Summit® 60',                  better: 'Atlas Summit® 60',                  best: 'Atlas Summit® 180' },
    ice_water:    { good: 'Atlas GlasBase Plus',               better: 'Atlas Ice & Water Shield',          best: 'Atlas StormSeal' },
    ridge_cap:    { good: 'Atlas Pro-Cut® Hip & Ridge',        better: 'Atlas Pro-Cut® Hip & Ridge',        best: 'Atlas StormMaster® Hip & Ridge' },
    starter:      { good: 'Atlas Pro-Cut® Starter Strip',      better: 'Atlas Pro-Cut® Starter Strip',      best: 'Atlas Pro-Cut® Starter Strip' },
    ridge_vent:   { good: 'Atlas TruRidge® Standard',          better: 'Atlas TruRidge® Pro',               best: 'Atlas HighPoint® Stealth Ridge Vent' },
    drip_edge:    { good: 'Standard Aluminum',                 better: 'Galvalume Steel',                   best: 'Color-Matched Steel' },
  },
  gaf: {
    shingle:      { good: 'GAF Timberline HDZ',         better: 'GAF Timberline UHDZ',          best: 'GAF Camelot II' },
    underlayment: { good: 'GAF FeltBuster #30',         better: 'GAF Tiger Paw',                best: 'GAF Deck-Armor Premium' },
    ice_water:    { good: 'GAF WeatherWatch',            better: 'GAF StormGuard',               best: 'GAF StormGuard Film' },
    ridge_cap:    { good: 'GAF Seal-A-Ridge',           better: 'GAF TimberTex',                best: 'GAF Z Ridge' },
    starter:      { good: 'GAF ProStart',               better: 'GAF ProStart',                 best: 'GAF EasySeal Starter' },
    ridge_vent:   { good: 'GAF Cobra Exhaust Vent',     better: 'GAF Cobra 3',                  best: 'GAF Cobra IntroAir' },
    drip_edge:    { good: 'Standard Aluminum',          better: 'Galvalume Steel',              best: 'Color-Matched Steel' },
  },
  owens_corning: {
    shingle:      { good: 'OC TruDefinition Duration',  better: 'OC Duration Premium',          best: 'OC Woodcrest' },
    underlayment: { good: 'OC RhinoRoof U20',           better: 'OC RhinoRoof U34',             best: 'OC FibreGlas Ply 4' },
    ice_water:    { good: 'OC WeatherLock',             better: 'OC WeatherLock G',             best: 'OC WeatherLock Flex' },
    ridge_cap:    { good: 'OC Hip & Ridge #1',          better: 'OC Berkshire',                 best: 'OC ProEdge' },
    starter:      { good: 'OC Starter Strip Plus',      better: 'OC Starter Strip Plus',        best: 'OC Starter Strip Plus' },
    ridge_vent:   { good: 'OC VentSure 4"',             better: 'OC VentSure Strip',            best: 'OC VentSure FreeFlow' },
    drip_edge:    { good: 'Standard Aluminum',          better: 'Galvalume Steel',              best: 'Color-Matched Steel' },
  },
  certainteed: {
    shingle:      { good: 'CT Landmark',                better: 'CT Landmark Pro',              best: 'CT Presidential Shake' },
    underlayment: { good: 'CT RoofRunner',              better: 'CT DiamondDeck',               best: 'CT MemBrain Smart Vapor' },
    ice_water:    { good: 'CT WinterGuard',             better: 'CT WinterGuard Sand',          best: 'CT WinterGuard HT' },
    ridge_cap:    { good: 'CT Ridge Cap Shingles',      better: 'CT Cedar Crest',               best: 'CT Shadow Ridge' },
    starter:      { good: 'CT SwiftStart Starter',      better: 'CT SwiftStart Starter',        best: 'CT SwiftStart Starter' },
    ridge_vent:   { good: 'CT Ridge Vent',              better: 'CT Shangle Ridge Vent',        best: 'CT FilterVent III' },
    drip_edge:    { good: 'Standard Aluminum',          better: 'Galvalume Steel',              best: 'Color-Matched Steel' },
  },
  iko: {
    shingle:      { good: 'IKO Cambridge',              better: 'IKO Dynasty',                  best: 'IKO Nordic' },
    underlayment: { good: 'IKO StormShield Felt',       better: 'IKO ArmourGard',               best: 'IKO ArmourGard Plus' },
    ice_water:    { good: 'IKO Ice & Water Shield',     better: 'IKO Ice & Water Shield Plus',  best: 'IKO ArmourGard HT' },
    ridge_cap:    { good: 'IKO Hip & Ridge Cap',        better: 'IKO Marathon Plus Ridge',      best: 'IKO Ultra HP Ridge' },
    starter:      { good: 'IKO Starter',                better: 'IKO Starter',                  best: 'IKO Starter' },
    ridge_vent:   { good: 'IKO Ridge Vent',             better: 'IKO Ridge Vent',               best: 'IKO Ridge Vent' },
    drip_edge:    { good: 'Standard Aluminum',          better: 'Galvalume Steel',              best: 'Color-Matched Steel' },
  },
  tamko: {
    shingle:      { good: 'TAMKO Heritage',             better: 'TAMKO Heritage Vintage',       best: 'TAMKO MetalWorks Steel' },
    underlayment: { good: 'TAMKO TechShield',           better: 'TAMKO Moisture Guard Plus',    best: 'TAMKO Moisture Guard Select' },
    ice_water:    { good: 'TAMKO Ice & Water Shield',   better: 'TAMKO Ice & Water Shield',     best: 'TAMKO Ice & Water HT' },
    ridge_cap:    { good: 'TAMKO Hip & Ridge Cap',      better: 'TAMKO 3D Hip & Ridge',         best: 'TAMKO 3D Hip & Ridge Select' },
    starter:      { good: 'TAMKO Starter Strip',        better: 'TAMKO Starter Strip',          best: 'TAMKO Starter Strip' },
    ridge_vent:   { good: 'TAMKO Ridge Vent',           better: 'TAMKO Ridge Vent',             best: 'TAMKO Ridge Vent' },
    drip_edge:    { good: 'Standard Aluminum',          better: 'Galvalume Steel',              best: 'Color-Matched Steel' },
  },
  // ── Metal roofing systems — ventilation is proprietary to the system, not a shingle manufacturer product ──
  standing_seam: {
    shingle:      { good: '28ga Galvalume Steel Panel',         better: '24ga Galvalume Steel Panel',         best: '24ga Kynar-Coated Steel Panel' },
    underlayment: { good: 'Felt 30lb',                          better: 'Titanium UDL 30 Synthetic',          best: 'VaproShield Breathable Membrane' },
    ice_water:    { good: 'Ice & Water Shield — Eaves Only',    better: 'Ice & Water Shield — Full Deck',     best: 'Ice & Water Shield + Vapor Barrier' },
    ridge_cap:    { good: 'Standing Seam Ridge Cap',            better: 'Snap-Lock Ridge Cap',                best: 'Custom Fabricated Ridge Cap' },
    starter:      { good: 'Metal Starter Strip',                better: 'Metal Eave Starter Trim',            best: 'Custom Fabricated Eave/Starter Trim' },
    ridge_vent:   { good: 'Continuous Ridge Closure + Box Vents', better: 'Standing Seam Ridge Cap Vent System', best: 'Concealed Continuous Ridge Vent System' },
    drip_edge:    { good: 'Standard Metal Drip Edge',           better: 'Galvalume Metal Drip Edge',          best: 'Color-Matched Steel Drip Edge' },
  },
  corrugated_metal: {
    shingle:      { good: '28ga Corrugated Steel',              better: '26ga Corrugated Steel',              best: '24ga Corrugated Steel' },
    underlayment: { good: 'Felt 30lb',                          better: 'Titanium UDL 30 Synthetic',          best: 'VaproShield Breathable Membrane' },
    ice_water:    { good: 'Ice & Water Shield — Eaves Only',    better: 'Ice & Water Shield — Full Deck',     best: 'Ice & Water Shield + Vapor Barrier' },
    ridge_cap:    { good: 'Corrugated Ridge Cap',               better: 'Corrugated Foam Closure Ridge Cap',  best: 'Custom Corrugated Ridge Cap' },
    starter:      { good: 'Corrugated Starter Strip',           better: 'Corrugated Eave Closure Strip',      best: 'Custom Corrugated Eave Trim' },
    ridge_vent:   { good: 'Foam Closure Strips + Static Box Vents', better: 'Corrugated Ridge Vent Cap + Foam Closure', best: 'Full Closure Strip System + Continuous Ridge Ventilation' },
    drip_edge:    { good: 'Standard Metal Drip Edge',           better: 'Galvalume Metal Drip Edge',          best: 'Color-Matched Steel Drip Edge' },
  },
};

// Non-brand-specific products (gutters, siding, windows, flooring, etc.)
const GENERIC_SUGGESTIONS: Array<{ keywords: string[]; good: string; better: string; best: string }> = [
  { keywords: ['gutter', 'k-style'],       good: '.027" Aluminum',       better: '.032" Aluminum',         best: '.032" Copper / Steel' },
  { keywords: ['downspout'],               good: '2×3 Aluminum',         better: '3×4 Aluminum',           best: '3×4 Copper' },
  { keywords: ['gutter guard'],            good: 'Amerimax Snap-In',     better: 'LeafGuard Micro-Mesh',   best: 'MasterShield Micro-Mesh' },
  { keywords: ['vinyl siding'],            good: 'Alside Preserve',      better: 'CertainTeed Monogram',   best: 'Alside Ascend Composite' },
  { keywords: ['fiber cement', 'hardie'],  good: 'HardiePlank Lap',      better: 'HardieShingle',          best: 'HardiePanel V-Groove' },
  { keywords: ['soffit'],                  good: 'Vinyl Vented Soffit',  better: 'Alum. Vented Soffit',    best: 'Beaded Vinyl Soffit' },
  { keywords: ['fascia'],                  good: 'Alum.-Wrapped Fascia', better: 'PVC Fascia Board',       best: 'Composite Fascia' },
  { keywords: ['house wrap', 'tyvek'],     good: 'Tyvek HomeWrap',       better: 'Tyvek DrainWrap',        best: 'Tyvek CommercialWrap D' },
  { keywords: ['window'],                  good: 'Simonton Reflections', better: 'Andersen 400 Series',    best: 'Andersen E-Series' },
  { keywords: ['standing seam'],           good: '28ga Galvalume Steel', better: '24ga Galvalume Steel',   best: '24ga Kynar-Coated Steel' },
  { keywords: ['corrugated'],              good: '28ga Corrugated Steel',better: '26ga Corrugated Steel',  best: '24ga Corrugated Steel' },
  { keywords: ['decking', 'osb', 'cdx'],  good: '7/16" OSB',            better: '1/2" CDX Plywood',       best: '5/8" CDX Plywood' },
  { keywords: ['flashing'],               good: 'Alum. Valley Flash.',  better: 'Galvalume Step Flash.',  best: 'Copper Flashing' },
  { keywords: ['pipe boot', 'boot'],       good: 'Perma-Boot Standard',  better: 'E-Z Storm EPDM Boot',    best: 'DeckSeal Lifetime Boot' },
  { keywords: ['laminate'],               good: 'LifeProof Rigid Core', better: 'Shaw Floorté Pro',       best: 'Pergo TimberCraft' },
  { keywords: ['hardwood'],              good: 'Bruce Engineered Oak', better: 'Shaw Solid Hardwood',    best: 'Mullican Solid Hardwood' },
  { keywords: ['tile floor', 'tile'],     good: 'Marazzi Ceramic',      better: 'Daltile Porcelain',      best: 'Emser Tile Premium' },
  { keywords: ['carpet'],                good: 'Shaw Essentials Nylon', better: 'Mohawk SmartStrand',    best: 'Stainmaster PetProtect' },
  { keywords: ['paint'],                 good: 'SW SuperPaint',        better: 'SW Duration',            best: 'SW Emerald' },
];

// ── Siding brand catalog — keep in sync with mobile StrikeModeScreen.tsx SIDING_BRAND_CATALOG ──
const SIDING_BRAND_CATALOG: Record<string, Record<string, { good: string; better: string; best: string }>> = {
  'hardie': {
    vinyl_siding:   { good: 'HardiePlank® Lap Siding',           better: 'HardieShingle® Staggered',        best: 'HardiePanel® V-Groove' },
    fiber_cement:   { good: 'HardiePlank® Lap Siding',           better: 'HardieShingle® Staggered',        best: 'HardiePanel® V-Groove' },
    trim:           { good: 'HardieTrim® Boards',                better: 'HardieTrim® Corner Boards',       best: 'HardieTrim® Fascia & Trim' },
    house_wrap:     { good: 'Tyvek HomeWrap',                    better: 'Tyvek DrainWrap',                 best: 'Tyvek CommercialWrap D' },
    starter:        { good: 'Standard Starter Strip',            better: 'HardieBacker® Starter',           best: 'HardieBacker® Starter Pro' },
    inside_corner:  { good: 'HardieTrim® Inside Corner',         better: 'HardieTrim® Inside Corner',       best: 'HardieTrim® Inside Corner' },
    outside_corner: { good: 'HardieTrim® Outside Corner',        better: 'HardieTrim® Outside Corner',      best: 'HardieTrim® Outside Corner' },
  },
  'lp-smartside': {
    vinyl_siding:   { good: 'LP SmartSide® Lap Siding',          better: 'LP SmartSide® ExpertFinish Lap',  best: 'LP SmartSide® ExpertFinish Premium' },
    fiber_cement:   { good: 'LP SmartSide® Lap Siding',          better: 'LP SmartSide® ExpertFinish Lap',  best: 'LP SmartSide® ExpertFinish Premium' },
    trim:           { good: 'LP SmartSide® Trim Boards',         better: 'LP SmartSide® Trim (ExpertFinish)', best: 'LP SmartSide® Fascia & Trim' },
    house_wrap:     { good: 'Tyvek HomeWrap',                    better: 'Tyvek DrainWrap',                 best: 'Tyvek CommercialWrap D' },
    starter:        { good: 'Standard Starter Strip',            better: 'LP SmartSide® Starter Strip',     best: 'LP SmartSide® Starter Strip Pro' },
    inside_corner:  { good: 'LP SmartSide® Inside Corner',       better: 'LP SmartSide® Inside Corner',     best: 'LP SmartSide® Inside Corner' },
    outside_corner: { good: 'LP SmartSide® Outside Corner',      better: 'LP SmartSide® Outside Corner',    best: 'LP SmartSide® Outside Corner' },
  },
  'certainteed-siding': {
    vinyl_siding:   { good: 'CertainTeed Monogram 46®',          better: 'CertainTeed Monogram DuraClad',   best: 'CertainTeed Elkwood Perfections' },
    fiber_cement:   { good: 'CertainTeed Fiber Cement Lap',      better: 'CertainTeed FiberCement Plus',    best: 'CertainTeed Cemplank' },
    trim:           { good: 'CertainTeed Restoration® Trim',     better: 'CertainTeed Cornerstone® Trim',   best: 'CertainTeed Cornice & Trim' },
    house_wrap:     { good: 'Tyvek HomeWrap',                    better: 'Tyvek DrainWrap',                 best: 'Tyvek CommercialWrap D' },
    starter:        { good: 'Standard Starter Strip',            better: 'CertainTeed Starter Strip',       best: 'CertainTeed Starter Strip Pro' },
    inside_corner:  { good: 'CertainTeed Inside Corner Post',    better: 'CertainTeed Inside Corner Post',  best: 'CertainTeed Inside Corner Post' },
    outside_corner: { good: 'CertainTeed Outside Corner Post',   better: 'CertainTeed Outside Corner Post', best: 'CertainTeed Outside Corner Post' },
  },
  'allura': {
    vinyl_siding:   { good: 'Allura Lap Siding',                 better: 'Allura Smooth Lap Siding',        best: 'Allura Shingle Panel' },
    fiber_cement:   { good: 'Allura Lap Siding',                 better: 'Allura Smooth Lap Siding',        best: 'Allura Shingle Panel' },
    trim:           { good: 'Allura Trim Board',                 better: 'Allura Fascia & Trim',            best: 'Allura Trim & Molding' },
    house_wrap:     { good: 'Tyvek HomeWrap',                    better: 'Tyvek DrainWrap',                 best: 'Tyvek CommercialWrap D' },
    starter:        { good: 'Standard Starter Strip',            better: 'Allura Starter Strip',            best: 'Allura Starter Strip Pro' },
    inside_corner:  { good: 'Allura Inside Corner',              better: 'Allura Inside Corner',            best: 'Allura Inside Corner' },
    outside_corner: { good: 'Allura Outside Corner',             better: 'Allura Outside Corner',           best: 'Allura Outside Corner' },
  },
  'kaycan': {
    vinyl_siding:   { good: 'KayCAN Vinyl Lap',                  better: 'KayCAN Prestige Insulated',       best: 'KayCAN Premier Insulated' },
    fiber_cement:   { good: 'KayCAN Fiber Cement Lap',           better: 'KayCAN Fiber Cement Plus',        best: 'KayCAN Premium Fiber Cement' },
    trim:           { good: 'KayCAN Trim',                       better: 'KayCAN Trim & Soffit',            best: 'KayCAN Designer Trim' },
    house_wrap:     { good: 'Tyvek HomeWrap',                    better: 'Tyvek DrainWrap',                 best: 'Tyvek CommercialWrap D' },
    starter:        { good: 'Standard Starter Strip',            better: 'KayCAN Starter Strip',            best: 'KayCAN Starter Strip Pro' },
    inside_corner:  { good: 'KayCAN Inside Corner Post',         better: 'KayCAN Inside Corner Post',       best: 'KayCAN Inside Corner Post' },
    outside_corner: { good: 'KayCAN Outside Corner Post',        better: 'KayCAN Outside Corner Post',      best: 'KayCAN Outside Corner Post' },
  },
  'royal': {
    vinyl_siding:   { good: 'Royal Estate Vinyl Siding',         better: 'Royal Woodland 16',               best: 'Royal DuraPlank' },
    fiber_cement:   { good: 'Royal Estate Vinyl Siding',         better: 'Royal Woodland 16',               best: 'Royal DuraPlank' },
    trim:           { good: 'Royal Trim',                        better: 'Royal Trim',                      best: 'Royal Trim' },
    house_wrap:     { good: 'Tyvek HomeWrap',                    better: 'Tyvek DrainWrap',                 best: 'Tyvek CommercialWrap D' },
    starter:        { good: 'Standard Starter Strip',            better: 'Standard Starter Strip',          best: 'Standard Starter Strip' },
    inside_corner:  { good: 'Royal Inside Corner Post',          better: 'Royal Inside Corner Post',        best: 'Royal Inside Corner Post' },
    outside_corner: { good: 'Royal Outside Corner Post',         better: 'Royal Outside Corner Post',       best: 'Royal Outside Corner Post' },
  },
  'provia': {
    vinyl_siding:   { good: 'ProVia Willowbrook Lifestyle',      better: 'ProVia Hearttech Signature',      best: 'ProVia CedarMax D6 Lifestyle' },
    fiber_cement:   { good: 'ProVia Willowbrook Lifestyle',      better: 'ProVia Hearttech Signature',      best: 'ProVia CedarMax D6 Lifestyle' },
    trim:           { good: 'ProVia Transition Trim Lifestyle',  better: 'ProVia Transition Trim Signature', best: 'ProVia Transition Trim Signature' },
    house_wrap:     { good: 'Tyvek HomeWrap',                    better: 'Tyvek DrainWrap',                 best: 'Tyvek CommercialWrap D' },
    starter:        { good: 'ProVia J-Channel Lifestyle',        better: 'ProVia J-Channel Signature',      best: 'ProVia J-Channel Signature' },
    inside_corner:  { good: 'ProVia Inside Corner Post Lifestyle', better: 'ProVia Inside Corner Post Signature', best: 'ProVia Inside Corner Post Signature' },
    outside_corner: { good: 'ProVia Outside Corner Post Lifestyle', better: 'ProVia Outside Corner Post Signature', best: 'ProVia Outside Corner Post Signature' },
  },
};

const NO_SIDING_PRODUCT_KEYWORDS = [
  'tear off', 'remove', 'disposal', 'cleanup', 'clean up', 'permit', 'inspection',
  'dumpster', 'labor', 'protection', 'site', 'nails', 'fastener', 'caulk', 'sealant',
  'spray paint', 'power wash', 'building permit', 'code inspection',
];

export const getSidingProductSuggestions = (
  itemName: string,
  sidingBrand: string | null | undefined,
): { good: string; better: string; best: string } | null => {
  if (!sidingBrand) return null;
  const catalog = SIDING_BRAND_CATALOG[sidingBrand];
  if (!catalog) return null;
  const n = itemName.toLowerCase();
  if (NO_SIDING_PRODUCT_KEYWORDS.some(k => n.includes(k))) return null;

  if (/house.*wrap|weather.*barrier|tyvek/.test(n))               return catalog.house_wrap ?? null;
  if (/fiber.*cement|hardie/.test(n))                             return catalog.fiber_cement ?? null;
  if (/vinyl.*lap|vinyl.*siding|lap.*siding/.test(n))             return catalog.vinyl_siding ?? null;
  if (/inside.*corner/.test(n))                                   return catalog.inside_corner ?? null;
  if (/outside.*corner/.test(n))                                  return catalog.outside_corner ?? null;
  if (/trim.*package|trim/.test(n))                               return catalog.trim ?? null;
  if (/starter.*strip|j.?channel/.test(n))                        return catalog.starter ?? null;
  return null;
};

// Items that don't have meaningful Good/Better/Best product differentiation
const NO_PRODUCT_KEYWORDS = [
  'tear off', 'remove', 'disposal', 'cleanup', 'clean up', 'permit', 'inspection',
  'dumpster', 'labor', 'protection', 'site', 'nails', 'fastener', 'caulk', 'sealant',
  'spray paint', 'power wash', 'building permit', 'code inspection', 'aluminum coil',
];

export const getProductSuggestions = (
  itemName: string,
  brand: string | null | undefined
): { good: string; better: string; best: string } | null => {
  const lower = itemName.toLowerCase();
  if (NO_PRODUCT_KEYWORDS.some(k => lower.includes(k))) return null;

  const brandData = brand ? BRAND_CATALOG[brand] : null;

  // Roofing items — use brand catalog when a brand is selected.
  // Order matters: most specific first to avoid false matches.
  // Keep in sync with mobile StrikeModeScreen.tsx applyBrandToItems.
  if (brandData) {
    if (/starter/.test(lower))                                                return brandData.starter;
    if (/ice.*water|water.*shield|i&w|iws/.test(lower))                       return brandData.ice_water;
    if (/hip.*ridge|ridge.*cap|hip.*&.*ridge|hip.*and.*ridge/.test(lower))    return brandData.ridge_cap;
    if (/ridge.*vent|ventilation|attic.*vent|vent.*balance/.test(lower))      return brandData.ridge_vent;
    if (/drip.*edge/.test(lower))                                             return brandData.drip_edge;
    if (/underlayment|felt|leak barrier|synthetic/.test(lower))               return brandData.underlayment;
    if (/shingle|field shingle|architectural/.test(lower))                    return brandData.shingle;
  }

  // Non-brand-specific fallback
  const generic = GENERIC_SUGGESTIONS.find(s => s.keywords.some(k => lower.includes(k)));
  if (generic) return { good: generic.good, better: generic.better, best: generic.best };

  // For unrecognised roofing items with a brand selected, still show branded suggestions
  if (brandData && /roof|shingle|ridge|eave|rake|valley|flashing|vent|deck|underlayment/.test(lower)) {
    return brandData.shingle; // best guess
  }

  return null; // no suggestion — just show empty inputs
};

interface LineItemEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  goodTierName?: string;
  betterTierName?: string;
  bestTierName?: string;
  showLineItemPrices?: boolean;
  showSectionTotals?: boolean;
  showItemDescriptions?: boolean;
  companyId?: string;
  aiEnabled?: boolean;
  company?: Company | null;
  onCompanyChange?: (updated: Company) => void;
  companyPricing?: CompanyPricing[];
  /** When set (per-tier mode), dim the price columns/totals for the inactive tiers */
  activeTier?: 'good' | 'better' | 'best';
  /** Called whenever the user sets a price — parent saves it to company_pricing for future quotes */
  onPriceSave?: (item: LineItem) => void;
  /** Project Details' Include Better/Best toggles. When off, that tier's price is hidden here too —
   *  it never reaches the customer, so showing a number for it just invites confusion. */
  includeBetter?: boolean;
  includeBest?: boolean;
}

const LineItemEditor: React.FC<LineItemEditorProps> = ({
  items,
  onChange,
  goodTierName = 'Good',
  betterTierName = 'Better',
  bestTierName = 'Best',
  showLineItemPrices = true,
  showSectionTotals = true,
  showItemDescriptions = true,
  companyId = '',
  aiEnabled = false,
  company = null,
  onCompanyChange,
  companyPricing = [],
  activeTier,
  onPriceSave,
  includeBetter = true,
  includeBest = true,
}) => {
  // Whether each tier is actually offered on this quote (Project Details toggle).
  // Only meaningful outside per-tier mode -- per-tier quotes always show one tier
  // at a time via activeTier, unrelated to this quote-wide setting.
  const betterEnabled = includeBetter !== false;
  const bestEnabled = includeBest !== false;
  // Per-tier dimming helpers
  const dimGood   = activeTier !== undefined && activeTier !== 'good';
  const dimBetter = activeTier !== undefined && activeTier !== 'better';
  const dimBest   = activeTier !== undefined && activeTier !== 'best';
  // Single-tier mode: collapse to one price column instead of Good/Better/Best
  const singleTier = activeTier !== undefined;
  // Active item: track which row is currently focused/selected for visual highlight
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  // Autocomplete: track which item's dropdown is open (by item id)
  const [pricingDropdownFor, setPricingDropdownFor] = useState<string | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savingBrand, setSavingBrand] = useState(false);
  // LF helper: ephemeral input for stick-unit items (lf ÷ stickLen → qty)
  const [lfHelperValues, setLfHelperValues] = useState<Record<string, string>>({});
  // Per-tier brand mixing: lets each tier pick its own brand AND which of that
  // brand's three product lines to use (e.g. Good tier can use Atlas's "Better"
  // -labeled Pinnacle Pristine product, not just whatever Atlas calls "Good").
  const [showPerTierBrands, setShowPerTierBrands] = useState(false);
  const [tierBrandSel, setTierBrandSel] = useState<Record<'good' | 'better' | 'best', string | null>>({ good: null, better: null, best: null });
  const [tierSlotSel, setTierSlotSel] = useState<Record<'good' | 'better' | 'best', 'good' | 'better' | 'best'>>({ good: 'good', better: 'better', best: 'best' });

  // ── Unit conversion helpers ────────────────────────────────────────────────
  /**
   * Returns the length in feet of one "stick" for a given item.
   * Outside/inside corner posts: 12.5 ft  |  J-channel, trim, drip edge: 10 ft
   */
  const getStickLengthFt = (itemName: string): number => {
    const n = itemName.toLowerCase();
    if (n.includes('corner')) return 12.5;
    return 10; // default: J-channel, window trim, drip cap, fascia, etc.
  };

  /**
   * Returns the multiplier to apply to PRICES when switching from oldUnit to newUnit.
   * e.g. lf→stick (12.5 ft corner) = 12.5  |  sq→sq ft = 0.01
   * Returns null when no automatic conversion is defined.
   */
  const getUnitPriceScale = (oldUnit: string, newUnit: string, itemName: string): number | null => {
    const key = `${oldUnit}→${newUnit}`;
    switch (key) {
      case 'lf→stick':    return getStickLengthFt(itemName);
      case 'stick→lf':    return 1 / getStickLengthFt(itemName);
      case 'lf→pc':       return 10;          // 10-ft piece (drip edge, trim)
      case 'pc→lf':       return 0.1;
      case 'lf→bdl':      return 25;          // generic bundle ≈ 25 lf (ridge cap)
      case 'bdl→lf':      return 1 / 25;
      case 'sq→sq ft':    return 0.01;        // 1 sq = 100 sq ft
      case 'sq ft→sq':    return 100;
      case 'sq→sheet':    return 1 / 3.125;   // 1 sq = 3.125 sheets (4×8 = 32 sq ft)
      case 'sheet→sq':    return 3.125;
      default:            return null;
    }
  };

  /** Handle unit dropdown change — rescales prices if a known conversion exists. */
  const handleUnitChange = (item: LineItem & { _index: number }, newUnit: string) => {
    const oldUnit = item.unit;
    const factor = getUnitPriceScale(oldUnit, newUnit, item.item_name);
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const updated = [...items];
    updated[item._index] = {
      ...updated[item._index],
      unit: newUnit,
      ...(factor !== null && factor !== 1 ? {
        good_price:   round2(item.good_price   * factor),
        better_price: round2(item.better_price * factor),
        best_price:   round2(item.best_price   * factor),
      } : {}),
    };
    onChange(updated);

    if (factor !== null && factor !== 1) {
      const fmtFactor = factor >= 1
        ? `×${factor % 1 === 0 ? factor : factor.toFixed(1)}`
        : `÷${(1 / factor) % 1 === 0 ? (1 / factor) : (1 / factor).toFixed(1)}`;
      toast.success(`Prices scaled ${fmtFactor} for ${newUnit} unit`, { duration: 3000 });
    }
  };

  const handleBrandChange = async (brandId: string | null) => {
    if (!company) return;
    setSavingBrand(true);
    try {
      await supabase.from('companies').update({ preferred_shingle_brand: brandId }).eq('id', company.id);
      if (onCompanyChange) onCompanyChange({ ...company, preferred_shingle_brand: brandId });
    } catch {
      toast.error('Could not save brand preference');
    } finally {
      setSavingBrand(false);
    }
  };

  // Apply the selected brand's product names to all matching line items
  const METAL_PANEL_NAMES: Record<string, string> = {
    corrugated_metal: 'Corrugated Metal Panels',
    standing_seam:   'Standing Seam Metal Panels',
  };
  // Standard waste factors for each metal type (corrugated overlaps more than standing seam)
  const METAL_WASTE_PCT: Record<string, number> = {
    corrugated_metal: 15,
    standing_seam:   12,
  };
  const SHINGLE_ITEM_NAMES = ['architectural shingles', 'field shingles', 'shingles'];

  const handleApplyBrand = (brandId: string) => {
    let filled = 0;
    const metalPanelName = METAL_PANEL_NAMES[brandId] ?? null;
    const updated = items.map(item => {
      const suggestions = getProductSuggestions(item.item_name, brandId);
      // For metal brands: rename the primary material item from "Architectural Shingles" → panel name.
      // Also treat already-renamed items (e.g. "Corrugated Metal Panels") whose description still
      // references shingles — so re-applying the brand fixes stale descriptions too.
      const isShingleItem = SHINGLE_ITEM_NAMES.includes(item.item_name.toLowerCase().trim());
      const descHasShingles = /architectural shingles|field shingles|\bshingles\b/i.test(item.description ?? '');
      const isPanelItem = metalPanelName ? Object.values(METAL_PANEL_NAMES).includes(item.item_name) : false;
      const needsMetalFix = metalPanelName && (isShingleItem || (isPanelItem && descHasShingles));
      const renamedName = needsMetalFix ? metalPanelName : item.item_name;
      // Recalculate quantity and description for metal waste factor
      let updatedQty = item.quantity;
      let updatedDescription = item.description;
      if (needsMetalFix && item.description) {
        const metalWaste = METAL_WASTE_PCT[brandId] ?? 15;
        // Extract current waste % from description (e.g. "at 10% waste")
        const wasteMatch = item.description.match(/at\s+(\d+(?:\.\d+)?)%\s+waste/i);
        if (wasteMatch) {
          const currentWaste = parseFloat(wasteMatch[1]);
          // Reverse out the current waste to get base area, then apply metal waste
          const baseSq = item.quantity / (1 + currentWaste / 100);
          updatedQty = Math.round(baseSq * (1 + metalWaste / 100) * 100) / 100;
        }
        // Rewrite description: replace shingle references and update waste %
        updatedDescription = item.description
          .replace(/architectural shingles/gi, metalPanelName)
          .replace(/\bshingles\b/gi, metalPanelName)
          .replace(/at\s+\d+(?:\.\d+)?%\s+waste/gi, `at ${METAL_WASTE_PCT[brandId] ?? 15}% waste`)
          .replace(/[\d.]+\s*squares/gi, `${updatedQty} squares`);
      }
      if (!suggestions && renamedName === item.item_name) return item;
      filled++;
      return {
        ...item,
        item_name: renamedName,
        quantity: updatedQty,
        description: updatedDescription,
        ...(suggestions ? { good_product: suggestions.good, better_product: suggestions.better, best_product: suggestions.best } : {}),
      };
    });
    if (filled > 0) {
      onChange(updated);
      toast.success(`${SHINGLE_BRANDS.find(b => b.id === brandId)?.label} applied to ${filled} item${filled !== 1 ? 's' : ''}.`);
    } else {
      toast('No matching items found for this brand.');
    }
  };

  // Apply each tier's independently-chosen brand + product line to only that
  // tier's product field, so Good/Better/Best can each use a different
  // manufacturer and product — the supporting materials (underlayment, ice &
  // water, ridge cap, starter, ridge vent, drip edge) for a tier always come
  // from that same tier's chosen brand, so nothing gets mismatched.
  const handleApplyPerTierBrands = () => {
    const activeTiers = (['good', 'better', 'best'] as const).filter(t => tierBrandSel[t]);
    if (activeTiers.length === 0) {
      toast('Pick a brand for at least one tier first.');
      return;
    }
    let filled = 0;
    const updated = items.map(item => {
      const patch: Partial<LineItem> = {};
      for (const tier of activeTiers) {
        const brandId = tierBrandSel[tier]!;
        const slot = tierSlotSel[tier];
        const suggestion = getProductSuggestions(item.item_name, brandId);
        if (!suggestion) continue;
        (patch as any)[`${tier}_product`] = suggestion[slot];
      }
      if (Object.keys(patch).length === 0) return item;
      filled++;
      return { ...item, ...patch };
    });
    if (filled > 0) {
      onChange(updated);
      toast.success(`Per-tier brands applied to ${filled} item${filled !== 1 ? 's' : ''}.`);
    } else {
      toast('No matching items found for the selected brands.');
    }
  };

  const handleApplySidingBrand = (brandId: string) => {
    let filled = 0;
    const updated = items.map(item => {
      const suggestions = getSidingProductSuggestions(item.item_name, brandId);
      if (!suggestions) return item;
      filled++;
      return { ...item, good_product: suggestions.good, better_product: suggestions.better, best_product: suggestions.best };
    });
    if (filled > 0) {
      onChange(updated);
      toast.success(`${SIDING_BRANDS.find(b => b.id === brandId)?.label} applied to ${filled} item${filled !== 1 ? 's' : ''}.`);
    } else {
      toast('No matching siding items found for this brand.');
    }
  };
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [priceSuggesting, setPriceSuggesting] = useState<string | null>(null);
  const [priceSuggestion, setPriceSuggestion] = useState<(PriceSuggestion & { id: string }) | null>(null);
  const [appliedTiers, setAppliedTiers] = useState<Set<string>>(new Set());
  // Track which items have their product/grade row expanded
  const [expandedProductRows, setExpandedProductRows] = useState<Set<string>>(new Set());
  // Track which items are currently having their description AI-generated
  const [descGenerating, setDescGenerating] = useState<Set<string>>(new Set());
  // Stores the pre-AI description so the user can undo: itemId → previous text
  const [descUndoSnapshot, setDescUndoSnapshot] = useState<Map<string, string>>(new Map());

  const toggleProductRow = (itemId: string) => {
    setExpandedProductRows(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, globalIndex: number) => {
    setDragIndex(globalIndex);
    e.dataTransfer.effectAllowed = 'move';
    // ghost image stays default — browser handles it
  };

  const handleDragOver = (e: React.DragEvent, globalIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== globalIndex) setDragOverIndex(globalIndex);
  };

  const handleDrop = (e: React.DragEvent, globalIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === globalIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...items];
    const [removed] = updated.splice(dragIndex, 1);
    updated.splice(globalIndex, 0, removed);
    onChange(normalizeSortOrder(updated));
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const normalizeSortOrder = (nextItems: LineItem[]) =>
    nextItems.map((item, index) => ({ ...item, sort_order: index }));

  // When a price-list item has a blank unit, infer the correct unit from
  // its category and name so shingles don't silently land on 'each'.
  const resolveItemUnit = (itemName: string, category: string, unit: string): string => {
    if (unit) return unit;
    const cat  = (category ?? '').toLowerCase();
    const name = (itemName  ?? '').toLowerCase();
    if (cat === 'gutters') return 'lf';
    if (cat === 'roofing') {
      if (/underlayment|ice.?water|leak.?barrier/.test(name)) return 'roll';
      if (/step.?flash|valley|drip.?edge|rake.?edge|ridge.?vent|cobra/.test(name)) return 'lf';
      if (/starter|ridge.?cap|hip.*cap|capping/.test(name)) return 'bdl';
      return 'sq'; // shingles, metal panels, decking, etc.
    }
    return 'each';
  };

  const addItem = (category: string = 'Roofing') => {
    const newItem: LineItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      quote_id: '',
      category,
      item_name: '',
      description: '',
      unit: 'each',
      quantity: 1,
      good_price: 0,
      better_price: 0,
      best_price: 0,
      sort_order: items.length,
      // When editing a specific tier (per-tier mode), tag the new item so it only
      // appears on that tier — same logic addFromTemplate uses.
      ...(activeTier ? { tiers_applicable: [activeTier] } : {}),
    };
    onChange(normalizeSortOrder([...items, newItem]));
  };

  const addFromTemplate = (category: string, template: typeof defaultLineItems[string][number]) => {
    const newItem: LineItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      quote_id: '',
      category,
      item_name: template.item_name,
      description: template.description,
      unit: template.unit,
      quantity: 1,
      // When editing a specific tier, pin prices to that tier's column and tag accordingly
      good_price:   activeTier === 'better' || activeTier === 'best' ? 0 : template.good_price,
      better_price: activeTier === 'good'   || activeTier === 'best' ? 0 : template.better_price,
      best_price:   activeTier === 'good'   || activeTier === 'better' ? 0 : template.best_price,
      sort_order: items.length,
      ...(activeTier ? { tiers_applicable: [activeTier] } : {}),
    };
    // Restore the correct tier's price in the right column
    if (activeTier === 'good')   newItem.good_price   = template.good_price;
    if (activeTier === 'better') newItem.better_price = template.better_price ?? template.good_price;
    if (activeTier === 'best')   newItem.best_price   = template.best_price   ?? template.good_price;
    onChange(normalizeSortOrder([...items, newItem]));
  };

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    // OSB/plywood is commodity material — sync all price tiers to the same value
    if (field === 'good_price' || field === 'better_price' || field === 'best_price') {
      const name = updated[index].item_name.toLowerCase();
      if (name.includes('osb') || name.includes('plywood') || name.includes('sheathing')) {
        updated[index] = { ...updated[index], good_price: value, better_price: value, best_price: value };
      }
    }
    onChange(updated);
    // A price typed here belongs to this quote only. It used to be written
    // straight back to company_pricing, so adjusting one quote silently became
    // the company's default for every future quote. The price list is changed
    // in the price list, deliberately, by someone who means to change it.
  };

  const removeItem = (index: number) => {
    onChange(normalizeSortOrder(items.filter((_, i) => i !== index)));
  };

  const resetQuantities = () => {
    const updated = items.map(item => ({ ...item, quantity: 0 }));
    onChange(updated);
    toast.success('All quantities reset to 0.');
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const updated = [...items];
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    onChange(normalizeSortOrder(updated));
  };

  const handleGenerateDescription = async (item: LineItem & { _index: number }) => {
    if (!companyId) return;
    if (!aiEnabled) {
      toast('Enable AI in Settings → AI Configuration to use description generation.');
      return;
    }
    // Snapshot current description so it can be restored with undo
    const previousDesc = item.description || '';
    setDescGenerating(prev => new Set(prev).add(item.id));
    try {
      const description = await generateLineItemDescription(companyId, {
        item_name: item.item_name,
        category: item.category,
        good_product: item.good_product || null,
        better_product: item.better_product || null,
        best_product: item.best_product || null,
        existing_description: item.description || null,
      });
      // Save snapshot then apply the AI text
      setDescUndoSnapshot(prev => new Map(prev).set(item.id, previousDesc));
      updateItem(item._index, 'description', description);
    } catch (err: any) {
      toast.error('AI description failed: ' + (err.message || 'Check AI settings'));
    } finally {
      setDescGenerating(prev => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  };

  const handleSuggestPrice = async (item: LineItem & { _index: number }) => {
    if (!companyId || priceSuggesting) return;
    if (!aiEnabled) {
      toast('Enable AI in Settings → AI Configuration to use price suggestions.');
      return;
    }
    setPriceSuggesting(item.id);
    try {
      const suggestion = await suggestPricing(companyId, `${item.item_name}${item.description ? ': ' + item.description : ''}`, item.quantity, item.unit);
      setPriceSuggestion({ id: item.id, ...suggestion });
      setAppliedTiers(new Set());
    } catch (err: any) {
      toast.error('AI price suggestion failed: ' + (err.message || 'Check AI settings'));
    } finally {
      setPriceSuggesting(null);
    }
  };

  // Group items by category
  const groupedItems = items.reduce((acc, item, index) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push({ ...item, _index: index });
    return acc;
  }, {} as Record<string, (LineItem & { _index: number })[]>);

  const categories = Object.keys(groupedItems);

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
  const tierDisplayNames = {
    good: goodTierName,
    better: betterTierName,
    best: bestTierName,
  };

  const activeBrand = company?.preferred_shingle_brand ?? null;

  // Only show the shingle brand picker when the quote actually has roofing items
  const hasRoofingItems = items.some(
    item => item.category?.toLowerCase() === 'roofing',
  );
  const hasSidingItems = items.some(item => item.category?.toLowerCase() === 'siding');

  return (
    <div className="space-y-4">

      {/* Brand preference picker — only relevant for roofing quotes */}
      {company && hasRoofingItems && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 shrink-0">
              <Package className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-800">Material Brand:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {SHINGLE_BRANDS.map(b => (
                <button
                  key={b.id}
                  onClick={() => handleBrandChange(activeBrand === b.id ? null : b.id)}
                  disabled={savingBrand}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    activeBrand === b.id
                      ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#1e3a5f] hover:text-[#1e3a5f]'
                  }`}
                >
                  {b.label}
                </button>
              ))}
              {activeBrand && (
                <button
                  onClick={() => handleBrandChange(null)}
                  disabled={savingBrand}
                  className="px-2 py-1 rounded-full text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  ✕ clear
                </button>
              )}
            </div>
          </div>
          {activeBrand && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-blue-500 italic">
                Selected: <strong className="not-italic text-blue-700">{SHINGLE_BRANDS.find(b => b.id === activeBrand)?.label}</strong> — click Apply to update all product names in this quote.
              </span>
              <button
                onClick={() => handleApplyBrand(activeBrand)}
                className="shrink-0 px-3 py-1.5 bg-[#1e3a5f] hover:bg-[#152d4a] text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Apply to Quote
              </button>
            </div>
          )}
        </div>
      )}

      {/* Per-tier brand mixing — pick a different brand AND product line per tier
          (e.g. Good = Atlas Pinnacle Pristine, Better = GAF Timberline UHDZ,
          Best = Atlas StormMaster Shake). Supporting materials for a tier always
          come from that tier's own chosen brand so nothing gets mismatched. */}
      {company && hasRoofingItems && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 space-y-2">
          <button
            type="button"
            onClick={() => setShowPerTierBrands(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800"
          >
            <Package className="w-4 h-4 text-indigo-600" />
            Mix Brands Per Tier
            <span className="font-normal text-indigo-400">— different manufacturer/product for each of Good, Better, Best</span>
            <span className="ml-auto text-indigo-400">{showPerTierBrands ? '▲' : '▼'}</span>
          </button>
          {showPerTierBrands && (
            <div className="space-y-3 pt-1">
              {(['good', 'better', 'best'] as const).map(tier => {
                const tierColor = tier === 'good' ? 'emerald' : tier === 'better' ? 'blue' : 'amber';
                const brandId = tierBrandSel[tier];
                const brandData = brandId ? (BRAND_CATALOG as any)[brandId] : null;
                return (
                  <div key={tier} className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-bold w-16 shrink-0 text-${tierColor}-700`}>{tierDisplayNames[tier]}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {SHINGLE_BRANDS.map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setTierBrandSel(prev => ({ ...prev, [tier]: brandId === b.id ? null : b.id }))}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                              brandId === b.id
                                ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-[#1e3a5f] hover:text-[#1e3a5f]'
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {brandData && (
                      <div className="flex flex-wrap items-center gap-1.5 pl-[4.5rem]">
                        <span className="text-[10px] text-gray-400 shrink-0">Product line:</span>
                        {(['good', 'better', 'best'] as const).map(slot => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setTierSlotSel(prev => ({ ...prev, [tier]: slot }))}
                            className={`px-2 py-0.5 rounded-full text-[11px] border transition-all ${
                              tierSlotSel[tier] === slot
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-400'
                            }`}
                          >
                            {brandData.shingle[slot]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleApplyPerTierBrands}
                  className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Apply to Quote
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Siding brand picker */}
      {company && hasSidingItems && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 shrink-0">
              <Package className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold text-purple-800">Siding Brand:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {SIDING_BRANDS.map(b => {
                const activeSidingBrand = company?.preferred_siding_brand ?? null;
                return (
                  <button
                    key={b.id}
                    onClick={async () => {
                      const next = activeSidingBrand === b.id ? null : b.id;
                      onCompanyChange?.({ ...company, preferred_siding_brand: next } as Company);
                      if (companyId) {
                        await supabase.from('companies').update({ preferred_siding_brand: next }).eq('id', companyId);
                      }
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      (company?.preferred_siding_brand ?? null) === b.id
                        ? 'bg-purple-700 text-white border-purple-700'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-purple-500 hover:text-purple-700'
                    }`}
                  >
                    {b.label}
                  </button>
                );
              })}
              {(company?.preferred_siding_brand ?? null) && (
                <button
                  onClick={async () => {
                    onCompanyChange?.({ ...company, preferred_siding_brand: null } as Company);
                    if (companyId) {
                      await supabase.from('companies').update({ preferred_siding_brand: null }).eq('id', companyId);
                    }
                  }}
                  className="px-2 py-1 rounded-full text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  ✕ clear
                </button>
              )}
            </div>
          </div>
          {(company?.preferred_siding_brand ?? null) && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-purple-500 italic">
                Selected: <strong className="not-italic text-purple-700">{SIDING_BRANDS.find(b => b.id === company?.preferred_siding_brand)?.label}</strong> — click Apply to update all product names in this quote.
              </span>
              <button
                onClick={() => handleApplySidingBrand(company.preferred_siding_brand!)}
                className="shrink-0 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Apply to Quote
              </button>
            </div>
          )}
        </div>
      )}

      {/* Category Groups */}
      {categories.map((category) => {
        const categoryItems = groupedItems[category];
        const isExpanded = expandedCategory !== category; // default expanded
        const categoryGoodTotal = categoryItems.reduce((sum, item) => sum + item.quantity * item.good_price, 0);
        const categoryBetterTotal = categoryItems.reduce((sum, item) => sum + item.quantity * item.better_price, 0);
        const categoryBestTotal = categoryItems.reduce((sum, item) => sum + item.quantity * item.best_price, 0);

        return (
          <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-[#1e3a5f]" />
                <span className="font-semibold text-gray-900">{category}</span>
                <span className="text-xs bg-[#1e3a5f] text-white px-2 py-0.5 rounded-full">{categoryItems.length} items</span>
              </div>
              <div className="flex items-center gap-4">
                <div className={`hidden sm:flex items-center gap-3 text-xs transition-opacity ${showSectionTotals ? 'opacity-100' : 'opacity-30'}`}>
                  {!showSectionTotals && <span className="text-gray-400 italic mr-1">hidden from customer</span>}
                  {singleTier ? (
                    <span className={`font-medium ${activeTier === 'good' ? 'text-emerald-600' : activeTier === 'better' ? 'text-blue-600' : 'text-amber-600'}`}>
                      {tierDisplayNames[activeTier!]}: {formatCurrency(
                        activeTier === 'good' ? categoryGoodTotal : activeTier === 'better' ? categoryBetterTotal : categoryBestTotal
                      )}
                    </span>
                  ) : (
                    <>
                      <span className={`font-medium transition-opacity ${dimGood ? 'opacity-30 text-gray-400' : 'text-emerald-600'}`}>{tierDisplayNames.good}: {formatCurrency(categoryGoodTotal)}</span>
                      {betterEnabled && (
                        <span className={`font-medium transition-opacity ${dimBetter ? 'opacity-30 text-gray-400' : 'text-blue-600'}`}>{tierDisplayNames.better}: {formatCurrency(categoryBetterTotal)}</span>
                      )}
                      {bestEnabled && (
                        <span className={`font-medium transition-opacity ${dimBest ? 'opacity-30 text-gray-400' : 'text-amber-600'}`}>{tierDisplayNames.best}: {formatCurrency(categoryBestTotal)}</span>
                      )}
                    </>
                  )}
                </div>
                {expandedCategory === category ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>
            </button>

            {expandedCategory !== category && (
              <div className="p-4">
                {/* Header Row */}
                <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                  {/* drag handle placeholder */}
                  <div className="w-5 shrink-0" />
                  <div className="grid grid-cols-12 gap-2 flex-1">
                    {singleTier ? (
                      <>
                        <div className="col-span-6">Item</div>
                        <div className="col-span-1">Unit</div>
                        <div className="col-span-1">Qty</div>
                        <div className={`col-span-3 ${activeTier === 'good' ? 'text-emerald-600' : activeTier === 'better' ? 'text-blue-600' : 'text-amber-600'}`}>
                          Price ({tierDisplayNames[activeTier!]})
                        </div>
                        <div className="col-span-1"></div>
                      </>
                    ) : (
                      <>
                        <div className="col-span-6">Item</div>
                        <div className="col-span-1">Unit</div>
                        <div className="col-span-1">Qty</div>
                        <div className={`col-span-1 transition-opacity ${dimGood ? 'opacity-30 text-gray-400' : 'text-emerald-600'}`}>{tierDisplayNames.good}</div>
                        <div className={`col-span-1 transition-opacity ${!betterEnabled ? 'text-gray-300' : dimBetter ? 'opacity-30 text-gray-400' : 'text-blue-600'}`}>{tierDisplayNames.better}{!betterEnabled && <span className="normal-case"> (off)</span>}</div>
                        <div className={`col-span-1 transition-opacity ${!bestEnabled ? 'text-gray-300' : dimBest ? 'opacity-30 text-gray-400' : 'text-amber-600'}`}>{tierDisplayNames.best}{!bestEnabled && <span className="normal-case"> (off)</span>}</div>
                        <div className="col-span-1"></div>
                      </>
                    )}
                  </div>
                </div>

                {/* Items */}
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    onDragOver={(e) => handleDragOver(e, item._index)}
                    onDrop={(e) => handleDrop(e, item._index)}
                    onClick={() => setActiveItemId(item.id)}
                    className={`rounded-xl p-3 mb-2 transition-all cursor-pointer ${
                      dragIndex === item._index
                        ? 'opacity-40 scale-[0.99] border-2 border-dashed border-[#1e3a5f]/40 bg-blue-50/30'
                        : dragOverIndex === item._index && dragIndex !== null
                        ? 'border-2 border-[#1e3a5f] bg-blue-50/40 shadow-md'
                        : activeItemId === item.id
                        ? 'border-2 border-[#1e3a5f] bg-blue-50/50 shadow-md ring-2 ring-[#1e3a5f]/25 ring-offset-1'
                        : item.highlighted
                        ? 'border-2 border-amber-400 bg-amber-50/60 hover:bg-amber-50'
                        : item.hidden_from_customer
                        ? 'border border-dashed border-slate-300 bg-slate-50/70 hover:bg-slate-50'
                        : 'border border-gray-200 hover:border-gray-300 hover:bg-gray-50/40'
                    }`}
                  >
                    {/* Top row: drag handle + main grid */}
                    <div className="flex items-start gap-2">
                    {/* Drag handle */}
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, item._index)}
                      onDragEnd={handleDragEnd}
                      className="mt-2 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors shrink-0 touch-none"
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Main grid */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">
                      <div className="lg:col-span-6 relative">
                        <label className="lg:hidden text-xs text-gray-500 mb-1 block">Item Name</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={(e) => {
                              updateItem(item._index, 'item_name', e.target.value);
                              // Show dropdown whenever there's text and matches exist
                              if (e.target.value.trim()) {
                                setPricingDropdownFor(item.id);
                              } else {
                                setPricingDropdownFor(null);
                              }
                            }}
                            onFocus={() => {
                              if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                              if (item.item_name.trim()) setPricingDropdownFor(item.id);
                            }}
                            onBlur={() => {
                              // Delay close so clicks on dropdown items register first
                              blurTimerRef.current = setTimeout(() => setPricingDropdownFor(null), 180);
                            }}
                            placeholder="Item name"
                            className={`w-full px-3 py-2 ${item.description ? 'pr-8' : ''} border rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none ${activeItemId === item.id ? 'border-[#1e3a5f]/30 bg-white/80' : 'border-gray-200'}`}
                          />
                          {/* Info tooltip — only when item has a description */}
                          {item.description && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 group/info z-10">
                              <Info className="w-3.5 h-3.5 text-sky-400/60 hover:text-sky-500 cursor-help transition-colors" />
                              <div className="hidden group-hover/info:block pointer-events-none absolute right-0 top-5 w-72 bg-white border border-sky-100 rounded-xl shadow-xl p-3 text-xs leading-relaxed text-gray-600 z-50">
                                <p className="font-semibold text-gray-800 mb-1 text-[11px]">{item.item_name}</p>
                                <p>{item.description}</p>
                                {item.internal_note && (
                                  <p className="mt-2 pt-2 border-t border-amber-100 text-amber-700">
                                    <span className="font-semibold">For you, not the customer:</span> {item.internal_note}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Price-list autocomplete dropdown */}
                        {pricingDropdownFor === item.id && (() => {
                          const q = item.item_name.trim().toLowerCase();
                          if (!q || q.length < 2) return null;

                          // Build combined candidate pool:
                          // 1. Company's own saved pricing (may have custom overrides)
                          // 2. defaultLineItems library — fills in branded items (Atlas, GAF, etc.)
                          //    that aren't yet in company_pricing
                          const companyMatches = companyPricing.filter(p =>
                            p.item_name.toLowerCase().includes(q),
                          );
                          const companyNames = new Set(companyMatches.map(p => p.item_name.toLowerCase()));
                          const allDefaults = Object.values(defaultLineItems).flat();
                          const defaultMatches = allDefaults
                            .filter(d => d.item_name.toLowerCase().includes(q) && !companyNames.has(d.item_name.toLowerCase()))
                            .map(d => ({
                              id: `default-${d.item_name}`,
                              item_name: d.item_name,
                              description: d.description ?? '',
                              unit: d.unit ?? 'each',
                              good_price: d.good_price,
                              better_price: d.better_price,
                              best_price: d.best_price,
                            }));

                          const matches = [...companyMatches, ...defaultMatches].slice(0, 30);
                          if (matches.length === 0) return null;

                          return (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-y-auto max-h-64">
                              {matches.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    // Prevent blur from firing before click
                                    e.preventDefault();
                                    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                                    // Fill all fields from the price-list entry
                                    const updated = [...items];
                                    updated[item._index] = {
                                      ...updated[item._index],
                                      item_name: p.item_name,
                                      description: p.description || updated[item._index].description,
                                      unit: resolveItemUnit(p.item_name, p.category, p.unit) || updated[item._index].unit,
                                      good_price: p.good_price ?? updated[item._index].good_price,
                                      better_price: p.better_price ?? updated[item._index].better_price,
                                      best_price: p.best_price ?? updated[item._index].best_price,
                                    };
                                    onChange(updated);
                                    setPricingDropdownFor(null);
                                  }}
                                  className="w-full flex items-start justify-between px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                                >
                                  <div className="min-w-0 flex-1 mr-2">
                                    <p className="text-sm font-medium text-gray-800 truncate">{p.item_name}</p>
                                    {p.description && (
                                      <p className="text-xs text-gray-400 truncate">{p.description}</p>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-xs text-emerald-600 font-medium">${(p.good_price ?? 0).toFixed(2)}</p>
                                    {(p.better_price !== p.good_price || p.best_price !== p.good_price) && (
                                      <p className="text-[10px] text-gray-400">
                                        {p.better_price > 0 && `$${p.better_price.toFixed(2)}`}
                                        {p.best_price > 0 && ` / $${p.best_price.toFixed(2)}`}
                                      </p>
                                    )}
                                    <p className="text-[10px] text-gray-400">{p.unit}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="lg:col-span-1">
                        <label className="lg:hidden text-xs text-gray-500 mb-1 block">Unit</label>
                        <select
                          value={item.unit}
                          onChange={(e) => handleUnitChange(item, e.target.value)}
                          className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none bg-white"
                        >
                          <optgroup label="Length">
                            <option value="lf">lf (per foot)</option>
                            <option value="stick">stick (per stick)</option>
                            <option value="pc">pc (10 ft piece)</option>
                            <option value="bdl">bdl (bundle)</option>
                          </optgroup>
                          <optgroup label="Area">
                            <option value="sq">sq (100 sq ft)</option>
                            <option value="sq ft">sq ft</option>
                            <option value="sheet">sheet (4×8)</option>
                          </optgroup>
                          <optgroup label="Volume / Quantity">
                            <option value="each">each</option>
                            <option value="roll">roll</option>
                            <option value="box">box</option>
                            <option value="tube">tube</option>
                            <option value="bag">bag</option>
                            <option value="gal">gal</option>
                            <option value="ctn">ctn (carton)</option>
                          </optgroup>
                          <optgroup label="Other">
                            <option value="hr">hr</option>
                            <option value="lot">lot</option>
                            <option value="panel">panel</option>
                          </optgroup>
                        </select>
                      </div>
                      <div className="lg:col-span-1">
                        <label className="lg:hidden text-xs text-gray-500 mb-1 block">Quantity</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item._index, 'quantity', parseFloat(e.target.value) || 0)}
                          className={`w-full px-2 py-2 border rounded-lg text-sm text-center focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none ${item.quantity === 0 ? 'border-orange-200 bg-orange-50/60 text-orange-500' : 'border-gray-200'}`}
                          min="0"
                          step="0.5"
                        />
                        {item.quantity === 0 && (
                          <div className="mt-0.5 text-center">
                            <span className="inline-block text-[9px] font-semibold uppercase tracking-wide text-orange-400 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">Optional</span>
                          </div>
                        )}
                        {item.unit === 'stick' && (
                          <div className="mt-1 flex items-center gap-1">
                            <input
                              type="number"
                              value={lfHelperValues[item.id] ?? ''}
                              onChange={(e) => {
                                const lf = e.target.value;
                                setLfHelperValues(prev => ({ ...prev, [item.id]: lf }));
                                const lfNum = parseFloat(lf);
                                const stickLen = getStickLengthFt(item.item_name);
                                if (!isNaN(lfNum) && lfNum > 0) {
                                  updateItem(item._index, 'quantity', Math.ceil(lfNum / stickLen));
                                }
                              }}
                              placeholder="enter LF"
                              className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-center focus:ring-1 focus:ring-[#1e3a5f] outline-none bg-gray-50"
                              min="0"
                              step="1"
                            />
                            <span className="text-[10px] text-gray-400 shrink-0">÷{getStickLengthFt(item.item_name)}</span>
                          </div>
                        )}
                        {item.unit === 'pc' && (
                          <div className="mt-1 flex items-center gap-1">
                            <input
                              type="number"
                              value={lfHelperValues[`pc_${item.id}`] ?? ''}
                              onChange={(e) => {
                                const lf = e.target.value;
                                setLfHelperValues(prev => ({ ...prev, [`pc_${item.id}`]: lf }));
                                const lfNum = parseFloat(lf);
                                if (!isNaN(lfNum) && lfNum > 0) {
                                  updateItem(item._index, 'quantity', Math.ceil(lfNum / 10));
                                }
                              }}
                              placeholder="enter LF"
                              className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-center focus:ring-1 focus:ring-[#1e3a5f] outline-none bg-gray-50"
                              min="0"
                              step="1"
                            />
                            <span className="text-[10px] text-gray-400 shrink-0">÷10</span>
                          </div>
                        )}
                      </div>
                      {/* Price inputs — fixed / single-tier / three-tier */}
                      {item.fixed_price ? (
                        <div className={`lg:col-span-3 flex items-center gap-2 transition-opacity ${showLineItemPrices ? 'opacity-100' : 'opacity-30'}`}>
                          <label className="lg:hidden text-xs text-gray-500 mb-1 block">Fixed Price</label>
                          <span className="text-xs text-blue-600 font-medium shrink-0">🔒 Fixed</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            enterKeyHint="done"
                            value={item.good_price}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              const updated = [...items];
                              updated[item._index] = { ...updated[item._index], good_price: v, better_price: v, best_price: v };
                              onChange(updated);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            className="w-full px-2 py-2 border border-blue-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-blue-50"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      ) : singleTier ? (
                        <div className={`lg:col-span-3 transition-opacity ${!showLineItemPrices ? 'opacity-30' : ''}`}>
                          <label className={`lg:hidden text-xs mb-1 block ${activeTier === 'good' ? 'text-emerald-600' : activeTier === 'better' ? 'text-blue-600' : 'text-amber-600'}`}>
                            {tierDisplayNames[activeTier!]} Price
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            enterKeyHint="done"
                            value={activeTier === 'good' ? item.good_price : activeTier === 'better' ? item.better_price : item.best_price}
                            onChange={(e) => {
                              const field = activeTier === 'good' ? 'good_price' : activeTier === 'better' ? 'better_price' : 'best_price';
                              updateItem(item._index, field as keyof LineItem, parseFloat(e.target.value) || 0);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            className={`w-full pl-1 pr-2 py-2 border rounded-lg text-sm text-right focus:ring-2 focus:border-transparent outline-none ${
                              activeTier === 'good'
                                ? 'border-emerald-200 focus:ring-emerald-400 bg-emerald-50/50'
                                : activeTier === 'better'
                                ? 'border-blue-200 focus:ring-blue-400 bg-blue-50/50'
                                : 'border-amber-200 focus:ring-amber-400 bg-amber-50/50'
                            }`}
                            min="0"
                            step="0.01"
                          />
                        </div>
                      ) : (
                        <>
                          <div className={`lg:col-span-1 transition-opacity ${!showLineItemPrices ? 'opacity-30' : ''} ${dimGood ? 'opacity-30' : ''}`}>
                            <label className="lg:hidden text-xs text-emerald-600 mb-1 block">{tierDisplayNames.good} Price</label>
                            <input
                              type="number"
                              inputMode="decimal"
                              enterKeyHint="done"
                              value={item.good_price}
                              onChange={(e) => updateItem(item._index, 'good_price', parseFloat(e.target.value) || 0)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                              className="w-full pl-1 pr-2 py-2 border border-emerald-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none bg-emerald-50/50"
                              min="0"
                              step="0.01"
                            />
                          </div>
                          <div className={`lg:col-span-1 transition-opacity ${!showLineItemPrices ? 'opacity-30' : ''} ${dimBetter ? 'opacity-30' : ''}`}>
                            <label className="lg:hidden text-xs text-blue-600 mb-1 block">{tierDisplayNames.better} Price</label>
                            {betterEnabled ? (
                              <input
                                type="number"
                                inputMode="decimal"
                                enterKeyHint="done"
                                value={item.better_price}
                                onChange={(e) => updateItem(item._index, 'better_price', parseFloat(e.target.value) || 0)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                className="w-full pl-1 pr-2 py-2 border border-blue-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-blue-50/50"
                                min="0"
                                step="0.01"
                              />
                            ) : (
                              <div
                                title="Better is turned off in Project Details -- this price is never shown to the customer"
                                className="w-full pl-1 pr-2 py-2 border border-dashed border-gray-200 rounded-lg text-sm text-center text-gray-300 bg-gray-50"
                              >—</div>
                            )}
                          </div>
                          <div className={`lg:col-span-1 transition-opacity ${!showLineItemPrices ? 'opacity-30' : ''} ${dimBest ? 'opacity-30' : ''}`}>
                            <label className="lg:hidden text-xs text-amber-600 mb-1 block">{tierDisplayNames.best} Price</label>
                            {bestEnabled ? (
                              <input
                                type="number"
                                inputMode="decimal"
                                enterKeyHint="done"
                                value={item.best_price}
                                onChange={(e) => updateItem(item._index, 'best_price', parseFloat(e.target.value) || 0)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                className="w-full pl-1 pr-2 py-2 border border-amber-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none bg-amber-50/50"
                                min="0"
                                step="0.01"
                              />
                            ) : (
                              <div
                                title="Best is turned off in Project Details -- this price is never shown to the customer"
                                className="w-full pl-1 pr-2 py-2 border border-dashed border-gray-200 rounded-lg text-sm text-center text-gray-300 bg-gray-50"
                              >—</div>
                            )}
                          </div>
                        </>
                      )}
                      {/* Controls — stacked vertically, always visible */}
                      <div className="lg:col-span-1 flex items-center justify-end">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => moveItem(item._index, -1)}
                            disabled={item._index === 0}
                            className="p-1 text-gray-400 hover:text-[#1e3a5f] hover:bg-blue-50 rounded transition-colors disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                            title="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveItem(item._index, 1)}
                            disabled={item._index === items.length - 1}
                            className="p-1 text-gray-400 hover:text-[#1e3a5f] hover:bg-blue-50 rounded transition-colors disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                            title="Move down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeItem(item._index)}
                            className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors mt-0.5"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSuggestPrice(item)}
                            disabled={!!priceSuggesting}
                            className={`p-1 rounded transition-colors mt-0.5 ${aiEnabled ? 'text-gray-300 hover:text-purple-500 hover:bg-purple-50' : 'text-gray-200 hover:text-gray-400'}`}
                            title={aiEnabled ? 'AI price suggestion' : 'AI price suggestion (configure AI in Settings to enable)'}
                          >
                            {priceSuggesting === item.id ? <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          </button>
                          {/* Product/grade toggle — tag icon */}
                          {!item.fixed_price && (
                            <button
                              onClick={() => toggleProductRow(item.id)}
                              className={`p-1 rounded transition-colors mt-0.5 ${
                                (item.good_product || item.better_product || item.best_product)
                                  ? 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50'
                                  : 'text-gray-300 hover:text-indigo-400 hover:bg-indigo-50'
                              }`}
                              title="Product / material grade"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M2 2a1 1 0 0 1 1-1h4.586a1 1 0 0 1 .707.293l6 6a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0l-6-6A1 1 0 0 1 2 6.586V2zm3.5 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                              </svg>
                            </button>
                          )}
                          {/* Highlight toggle — star icon */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = [...items];
                              updated[item._index] = { ...updated[item._index], highlighted: !item.highlighted };
                              onChange(updated);
                              toast.success(item.highlighted ? 'Highlight removed' : 'Item highlighted — will stand out in the customer quote', { duration: 2500 });
                            }}
                            className={`p-1 rounded transition-colors mt-0.5 ${
                              item.highlighted
                                ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'
                            }`}
                            title={item.highlighted ? 'Remove highlight' : 'Highlight this item (draws customer attention)'}
                          >
                            <Star className={`w-3.5 h-3.5 ${item.highlighted ? 'fill-amber-400' : ''}`} />
                          </button>
                          {/* Hide-from-customer toggle — internal-only lines like labor */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = [...items];
                              const nowHidden = !item.hidden_from_customer;
                              updated[item._index] = { ...updated[item._index], hidden_from_customer: nowHidden };
                              onChange(updated);
                              toast.success(
                                nowHidden
                                  ? 'Hidden from the customer copy — still counted in the total'
                                  : 'Now visible on the customer copy',
                                { duration: 2500 },
                              );
                            }}
                            className={`p-1 rounded transition-colors mt-0.5 ${
                              item.hidden_from_customer
                                ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                : 'text-gray-300 hover:text-slate-500 hover:bg-slate-100'
                            }`}
                            title={item.hidden_from_customer
                              ? 'Internal only — hidden on the customer copy, still in the total. Click to show.'
                              : 'Hide from the customer copy (stays in the total)'}
                          >
                            {item.hidden_from_customer
                              ? <EyeOff className="w-3.5 h-3.5" />
                              : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      {/* Tier totals + product names — full-width row */}
                      <div className={`col-span-full flex flex-wrap items-center gap-x-5 gap-y-1 transition-opacity ${showLineItemPrices ? 'opacity-100' : 'opacity-30'}`}>
                        {item.fixed_price ? (
                          <span className="text-xs font-semibold text-gray-900 tabular-nums">{formatCurrency(item.quantity * item.good_price)}</span>
                        ) : singleTier ? (
                          (() => {
                            const tierPrice = activeTier === 'good' ? item.good_price : activeTier === 'better' ? item.better_price : item.best_price;
                            const tierProduct = activeTier === 'good' ? item.good_product : activeTier === 'better' ? item.better_product : item.best_product;
                            const tierColor = activeTier === 'good' ? 'text-emerald-600' : activeTier === 'better' ? 'text-blue-600' : 'text-amber-600';
                            return tierPrice > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-semibold ${tierColor}`}>{tierDisplayNames[activeTier!]}</span>
                                <span className="text-xs font-semibold text-gray-900 tabular-nums">{formatCurrency(item.quantity * tierPrice)}</span>
                                {tierProduct && <span className="text-[10px] text-gray-400 italic">— {tierProduct}</span>}
                              </div>
                            ) : <span className="text-xs text-gray-400">—</span>;
                          })()
                        ) : (
                          <>
                            {item.good_price > 0 && (
                              <div className={`flex items-center gap-1.5 transition-opacity ${dimGood ? 'opacity-30' : ''}`}>
                                <span className="text-[10px] font-semibold text-emerald-600">{tierDisplayNames.good}</span>
                                <span className="text-xs font-semibold text-gray-900 tabular-nums">{formatCurrency(item.quantity * item.good_price)}</span>
                                {item.good_product && <span className="text-[10px] text-gray-400 italic">— {item.good_product}</span>}
                              </div>
                            )}
                            {betterEnabled && item.better_price > 0 && (
                              <div className={`flex items-center gap-1.5 transition-opacity ${dimBetter ? 'opacity-30' : ''}`}>
                                <span className="text-[10px] font-semibold text-blue-600">{tierDisplayNames.better}</span>
                                <span className="text-xs font-semibold text-gray-900 tabular-nums">{formatCurrency(item.quantity * item.better_price)}</span>
                                {item.better_product && <span className="text-[10px] text-gray-400 italic">— {item.better_product}</span>}
                              </div>
                            )}
                            {bestEnabled && item.best_price > 0 && (
                              <div className={`flex items-center gap-1.5 transition-opacity ${dimBest ? 'opacity-30' : ''}`}>
                                <span className="text-[10px] font-semibold text-amber-600">{tierDisplayNames.best}</span>
                                <span className="text-xs font-semibold text-gray-900 tabular-nums">{formatCurrency(item.quantity * item.best_price)}</span>
                                {item.best_product && <span className="text-[10px] text-gray-400 italic">— {item.best_product}</span>}
                              </div>
                            )}
                            {item.good_price === 0 && (!betterEnabled || item.better_price === 0) && (!bestEnabled || item.best_price === 0) && (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Description — below line totals so numbers group together visually */}
                      <div className={`col-span-full transition-opacity ${showItemDescriptions ? 'opacity-100' : 'opacity-30'}`}>
                        <div className="relative">
                          <textarea
                            rows={3}
                            value={item.description}
                            onChange={(e) => {
                              // Manual edit clears the undo snapshot for this item
                              if (descUndoSnapshot.has(item.id)) {
                                setDescUndoSnapshot(prev => { const m = new Map(prev); m.delete(item.id); return m; });
                              }
                              updateItem(item._index, 'description', e.target.value);
                            }}
                            placeholder="Description (optional) — or click ✨ to generate with AI"
                            className={`w-full px-3 py-2 pr-24 border rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none resize-none ${activeItemId === item.id ? 'border-[#1e3a5f]/30 bg-white/80' : 'border-gray-200'}`}
                          />
                          <div className="absolute bottom-2 right-2 flex items-center gap-1">
                            {/* Undo button — only shown right after an AI generation */}
                            {descUndoSnapshot.has(item.id) && (
                              <button
                                type="button"
                                onClick={() => {
                                  updateItem(item._index, 'description', descUndoSnapshot.get(item.id) ?? '');
                                  setDescUndoSnapshot(prev => { const m = new Map(prev); m.delete(item.id); return m; });
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                                title="Undo AI — restore previous description"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Undo
                              </button>
                            )}
                            {/* AI generate / rewrite button */}
                            <button
                              type="button"
                              onClick={() => handleGenerateDescription(item)}
                              disabled={descGenerating.has(item.id)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors
                                ${aiEnabled
                                  ? 'text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200'
                                  : 'text-gray-400 bg-gray-50 border border-gray-200 cursor-not-allowed'}`}
                              title={aiEnabled ? (item.description ? 'Rewrite description with AI' : 'Generate description with AI') : 'Enable AI in Settings → AI Configuration'}
                            >
                              {descGenerating.has(item.id)
                                ? <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                : <Sparkles className="w-3 h-3" />}
                              {descGenerating.has(item.id) ? 'Writing…' : '✨ AI'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Per-tier product / material grade row — col-span-full forces its own grid row */}
                      {!item.fixed_price && (() => {
                        // For siding-category items, use siding brand suggestions — not roofing brand.
                        const isSidingItem = /siding|j.?channel/i.test(item.category || '');
                        const activeSidingBrand = company?.preferred_siding_brand ?? null;
                        const suggestions = isSidingItem
                          ? getSidingProductSuggestions(item.item_name, activeSidingBrand)
                          : getProductSuggestions(item.item_name, activeBrand);
                        const effectiveBrand = isSidingItem ? activeSidingBrand : activeBrand;
                        // Auto-show when: user toggled the tag icon, item already has product data saved,
                        // OR the active brand has catalog suggestions for this item (so the boxes are
                        // always visible for brand-matched items without requiring Apply first).
                        const shouldShow = expandedProductRows.has(item.id)
                          || !!item.good_product || !!item.better_product || !!item.best_product
                          || (!!effectiveBrand && !!suggestions);
                        if (!shouldShow) return null;
                        // No tier distinction — show a single neutral field spanning full width
                        if (!suggestions) return (
                          <div className="col-span-full pt-2 mt-1 border-t border-indigo-100">
                            <input
                              type="text"
                              value={item.good_product || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                const updated = [...items];
                                updated[item._index] = { ...updated[item._index], good_product: v, better_product: v, best_product: v };
                                onChange(updated);
                              }}
                              placeholder="Product / brand (applied to all tiers)"
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-300 focus:border-transparent outline-none bg-gray-50 placeholder-gray-300"
                            />
                          </div>
                        );
                        return (
                          <div className="col-span-full pt-2 mt-1 border-t border-indigo-100">
                            <div className="flex gap-2">
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={item.good_product || ''}
                                  onChange={(e) => updateItem(item._index, 'good_product', e.target.value)}
                                  placeholder={suggestions.good}
                                  className="w-full px-2 py-1.5 border border-emerald-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none bg-emerald-50/40 placeholder-emerald-300"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={item.better_product || ''}
                                  onChange={(e) => updateItem(item._index, 'better_product', e.target.value)}
                                  placeholder={suggestions.better}
                                  className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-blue-50/40 placeholder-blue-300"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={item.best_product || ''}
                                  onChange={(e) => updateItem(item._index, 'best_product', e.target.value)}
                                  placeholder={suggestions.best}
                                  className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none bg-amber-50/40 placeholder-amber-300"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    </div>{/* end top row */}
                  </div>
                ))}

                <button
                  onClick={() => addItem(category)}
                  className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Item to {category}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Category / Template */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#1e3a5f] text-white rounded-xl font-medium hover:bg-[#2d5a8e] transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Items from Template
          </button>
          {showTemplates && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => { setShowTemplates(false); setTemplateSearch(''); }} />
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-20 flex flex-col" style={{ maxHeight: '22rem' }}>
                {/* Search input */}
                <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
                  <input
                    autoFocus
                    type="text"
                    value={templateSearch}
                    onChange={e => setTemplateSearch(e.target.value)}
                    placeholder="Search materials…"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <div className="overflow-y-auto flex-1">
                  {(() => {
                    const q = templateSearch.trim().toLowerCase();

                    // Pricing library items first (company-specific)
                    const libraryMatches: Array<{ category: string; item_name: string; unit: string; good_price: number; better_price: number; best_price: number; source: 'library' }> = [];
                    if (q && companyPricing.length > 0) {
                      companyPricing.forEach(it => {
                        if (it.item_name?.toLowerCase().includes(q) || it.category?.toLowerCase().includes(q)) {
                          libraryMatches.push({
                            category: it.category || 'Other',
                            item_name: it.item_name,
                            unit: resolveItemUnit(it.item_name, it.category, it.unit),
                            good_price: it.good_price ?? 0,
                            better_price: it.better_price ?? 0,
                            best_price: it.best_price ?? 0,
                            source: 'library',
                          });
                        }
                      });
                    }

                    // Built-in template items
                    const templateMatches: Array<{ category: string; template: typeof defaultLineItems[string][number] }> = [];
                    Object.entries(defaultLineItems).forEach(([category, templates]) => {
                      templates.forEach(t => {
                        if (!q || t.item_name.toLowerCase().includes(q) || category.toLowerCase().includes(q)) {
                          templateMatches.push({ category, template: t });
                        }
                      });
                    });

                    const totalResults = libraryMatches.length + templateMatches.length;

                    if (totalResults === 0) {
                      return (
                        <p className="px-4 py-6 text-sm text-gray-400 text-center">No items match "{templateSearch}"</p>
                      );
                    }

                    return (
                      <>
                        {/* Pricing library results */}
                        {libraryMatches.length > 0 && (
                          <div>
                            <p className="px-4 py-2 text-xs font-semibold text-[#1e3a5f] uppercase bg-blue-50 sticky top-0">Your Pricing Library</p>
                            {libraryMatches.map((it, i) => (
                              <button
                                key={`lib-${i}`}
                                onClick={() => {
                                  addFromTemplate(it.category, { item_name: it.item_name, description: '', unit: it.unit, good_price: it.good_price, better_price: it.better_price, best_price: it.best_price });
                                  setShowTemplates(false);
                                  setTemplateSearch('');
                                }}
                                className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                              >
                                <span className="text-left">{it.item_name}</span>
                                <span className="text-xs text-gray-400 ml-2 shrink-0">{formatCurrency(it.better_price)}/{it.unit}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Built-in templates — grouped by category when not searching, flat when searching */}
                        {q ? (
                          templateMatches.length > 0 && (
                            <div>
                              <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50 sticky top-0">Built-in Templates</p>
                              {templateMatches.map(({ category, template }, i) => (
                                <button
                                  key={`tpl-${i}`}
                                  onClick={() => { addFromTemplate(category, template); setShowTemplates(false); setTemplateSearch(''); }}
                                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                                >
                                  <span className="text-left">{template.item_name} <span className="text-gray-400 text-xs">· {category}</span></span>
                                  <span className="text-xs text-gray-400 ml-2 shrink-0">{formatCurrency(template.better_price)}/{template.unit}</span>
                                </button>
                              ))}
                            </div>
                          )
                        ) : (
                          Object.entries(defaultLineItems).map(([category, templates]) => (
                            <div key={category}>
                              <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50 sticky top-0">{category}</p>
                              {templates.map((template, i) => (
                                <button
                                  key={i}
                                  onClick={() => { addFromTemplate(category, template); setShowTemplates(false); setTemplateSearch(''); }}
                                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                                >
                                  <span>{template.item_name}</span>
                                  <span className="text-xs text-gray-400">{formatCurrency(template.better_price)}/{template.unit}</span>
                                </button>
                              ))}
                            </div>
                          ))
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
        <select
          onChange={(e) => { if (e.target.value) { addItem(e.target.value); e.target.value = ''; } }}
          className="px-4 py-3 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
          defaultValue=""
        >
          <option value="" disabled>Add Empty Row by Category...</option>
          {lineItemCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {items.length > 0 && (
          <button
            onClick={resetQuantities}
            className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-xl bg-white text-sm text-gray-500 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            title="Reset all quantities to 0"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Qty
          </button>
        )}
      </div>

      {priceSuggestion && (() => {
        const suggItem = items.find(i => i.id === priceSuggestion.id);
        const isHistorical = priceSuggestion.source === 'historical';
        const isWebSearch  = priceSuggestion.source === 'web_search';
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  <h3 className="text-base font-semibold text-gray-900">Material Cost</h3>
                </div>
                {/* Source badge */}
                {isHistorical ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                    Your Data
                  </span>
                ) : isWebSearch ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16A8 8 0 0010 2zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.030 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd"/></svg>
                    Live Web Prices
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                    AI Estimate
                  </span>
                )}
              </div>

              {suggItem && (
                <p className="text-xs font-medium text-gray-700 mb-1">{suggItem.item_name}</p>
              )}
              <p className="text-xs text-gray-400 mb-1">
                Material cost only (no labor) — use the markup slider to add labor &amp; profit
              </p>
              <p className="text-xs text-gray-500 mb-3 italic">{priceSuggestion.reasoning}</p>

              {/* Source context line */}
              {isHistorical ? (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3">
                  ✓ Pulled from <strong>{priceSuggestion.sampleCount} sent quotes</strong> in your account
                  {priceSuggestion.oldestDate ? ` (since ${priceSuggestion.oldestDate})` : ''}.
                  These reflect the prices you&apos;ve previously used for this item on real jobs.
                </p>
              ) : isWebSearch ? (
                <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 space-y-1">
                  <p className="font-semibold">🌐 Live distributor / supply-house pricing</p>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                    <li>Material cost only — no labor or markup included</li>
                    <li>Pulled from current supplier sites &amp; trade publications</li>
                    <li>Use the <strong>Labor &amp; Profit Markup</strong> slider to add your margin</li>
                  </ul>
                </div>
              ) : (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 space-y-1">
                  <p className="font-semibold">⚠️ AI Estimate — verify against your supplier</p>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                    <li>Material cost only — no labor or markup included</li>
                    <li>Based on typical US distributor pricing, not your local costs</li>
                    <li>Use the <strong>Labor &amp; Profit Markup</strong> slider to add your margin</li>
                  </ul>
                </div>
              )}

              <p className="text-xs text-gray-400 mb-2">Tap a tier to apply it — or apply all at once.</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {([
                  ['Good', priceSuggestion.low, 'emerald', 'good_price'],
                  ['Better', priceSuggestion.mid, 'blue', 'better_price'],
                  ['Best', priceSuggestion.high, 'amber', 'best_price'],
                ] as const).map(([label, val, color, field]) => {
                  const applied = appliedTiers.has(field);
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        const itemIndex = items.findIndex(i => i.id === priceSuggestion.id);
                        if (itemIndex >= 0) {
                          const updated = [...items];
                          const newItem = { ...updated[itemIndex], [field]: val };
                          updated[itemIndex] = newItem;
                          onChange(updated);
                          // Applies to this quote only — see the note in updateItem.
                        }
                        setAppliedTiers(prev => new Set([...prev, field]));
                      }}
                      className={`py-3 rounded-xl text-center border-2 transition-all relative ${
                        applied
                          ? `border-${color}-400 bg-${color}-50`
                          : `border-gray-100 hover:border-${color}-300`
                      }`}
                    >
                      {applied && (
                        <span className={`absolute top-1.5 right-1.5 text-${color}-500 text-xs`}>✓</span>
                      )}
                      <p className={`text-lg font-bold text-${color}-600`}>${val.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  const itemIndex = items.findIndex(i => i.id === priceSuggestion.id);
                  if (itemIndex >= 0) {
                    const updated = [...items];
                    const newItem = {
                      ...updated[itemIndex],
                      good_price: priceSuggestion.low,
                      better_price: priceSuggestion.mid,
                      best_price: priceSuggestion.high,
                    };
                    updated[itemIndex] = newItem;
                    onChange(updated);
                    // Applies to this quote only — an AI suggestion is a
                    // starting point, not a decision about company pricing.
                  }
                  setAppliedTiers(new Set(['good_price', 'better_price', 'best_price']));
                }}
                className="w-full py-2 mb-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                Apply All Tiers
              </button>
              <button
                onClick={() => { setPriceSuggestion(null); setAppliedTiers(new Set()); }}
                className="w-full py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
              >
                {appliedTiers.size > 0 ? 'Done' : 'Cancel'}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default LineItemEditor;
