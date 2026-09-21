// Copied from QuoteMGR src/components/QuoteBuilder.tsx (read-only reference).
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft, ArrowRight, Save, Send, Eye, User, MapPin, FileText,
  Package, Camera, Settings, Check, ChevronRight, Building2,
  Sparkles, Loader2, X, Plus, FileUp, Upload, Trash2,
  FolderOpen, FileDown, ToggleLeft, ToggleRight, GripVertical, RotateCcw,
  Shield, AlertTriangle, Award
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import StoredMeasurementReports, { saveMeasurementReportToCustomer } from '@/components/StoredMeasurementReports';
import { toast } from 'sonner';
import LineItemEditor, { getProductSuggestions, getSidingProductSuggestions, SHINGLE_BRANDS, SIDING_BRANDS } from '@/components/LineItemEditor';
import PhotoUploader from '@/components/PhotoUploader';
import PhotoPositionEditor, { FramedPhotoPreview } from '@/components/PhotoPositionEditor';
import { generateQuotePDF } from '@/lib/pdfGenerator';
import type { QuotePDFData } from '@/lib/pdfGenerator';
import type { Quote, Customer, LineItem, QuotePhoto, Company, TeamMember, CompanyPricing, QuoteUpgrade, CustomQuotePage, QuoteOption, QuoteStructureType } from '@/data/quoteData';
import { loadCompanyFiles, type CompanyFileRecord } from '@/lib/fileLibrary';
import { quoteUrl, certUrl } from '@/lib/appUrl';
import { quoteProjectTemplates, defaultLineItems } from '@/data/quoteData';
import { DEFAULT_PRICE_LIST } from '@/data/defaultPricing';
import { resolveTierLadder, makeRungLookup } from '@/data/tierLadders';
import { hasPricedLabor, quoteNeedsLabor } from '@/lib/laborGuard';
import PricingPresets, { matchPresetItems, PresetPriceItem } from '@/components/PricingPresets';
import type { QuoteProjectTemplate } from '@/data/quoteData';
import {
  loadAllProjectTemplatesForCompany,
  TEMPLATE_LIBRARY_UPDATED_EVENT,
} from '@/lib/templateLibrary';
import { analyzeQuotePhoto, generateQuoteProjectDescription, generateQuoteEmailDraft, suggestTierDescriptions, generateLineItemDescription } from '@/lib/aiHelper';
import { parseRoofrPdfReport, parseEagleViewWallsReportFromFile, buildEagleViewWallsLineItems, parseEagleViewSolarReportFromFile, buildEagleViewSolarLineItems, buildGutterLineItems } from '@/lib/roofrReport';
import type { RoofrImportMode, RoofrParsedReport, EagleViewWallsReport, EagleViewSolarReport, GutterManualInput } from '@/lib/roofrReport';
import { buildMeasurementLineItems } from '@/lib/measurementImport';
import type { MeasurementProviderId } from '@/lib/measurementProviders';
import type { AIQuotePhotoAnalysis, AIQuotePhotoSuggestedLineItem } from '@/lib/aiHelper';
import { compressImage, COMPRESS_PRESETS, STORAGE_CACHE_CONTROL } from '@/lib/imageUtils';

interface QuoteBuilderProps {
  companyId: string;
  userId: string;
  currentUser: TeamMember;
  company: Company;
  editQuoteId?: string | null;
  initialStep?: number;
  inspectionOnly?: boolean;
  /** When true, creates a single-price Insurance Invoice (no tiers/templates). */
  invoiceMode?: boolean;
  /** Pre-select a customer by ID (used when converting an inspection report to a quote). */
  prefilledCustomerId?: string | null;
  /** Source IC report ID — when set, user is offered to copy photos after first save. */
  prefilledSourceQuoteId?: string | null;
  /** Pre-enable contingency agreement (used for Insurance Quote type). */
  prefilledContingency?: boolean;
  onSave: (quoteId: string) => void;
  onSent?: (quoteId: string) => void;
  onPreview: (quoteId: string, step: number) => void;
  onBack: () => void;
  onOpenSettings?: (tab: string) => void;
}

const steps = [
  { id: 'customer', label: 'Customer Info', short: 'Customer', icon: User },
  { id: 'project', label: 'Project Details', short: 'Project', icon: Settings },
  { id: 'photos', label: 'Photo Documentation', short: 'Photos', icon: Camera },
  { id: 'contingency', label: 'Contingency Agreement', short: 'Contingency', icon: Shield },
  { id: 'invoice', label: 'Invoice Details', short: 'Invoice', icon: FileText },
  { id: 'items', label: 'Line Items', short: 'Items', icon: Package },
  { id: 'files', label: 'Brochures & Files', short: 'Files', icon: FolderOpen },
  { id: 'review', label: 'Review & Options', short: 'Review', icon: FileText },
];

/** Money is stored to the cent — a per-bundle rate of 410/3 must not become 136.66666666666666. */
const toCents = (n: number) => Math.round(n * 100) / 100;

const QuoteBuilder: React.FC<QuoteBuilderProps> = ({
  companyId,
  userId,
  currentUser,
  company,
  editQuoteId,
  initialStep = 0,
  inspectionOnly = false,
  invoiceMode = false,
  prefilledCustomerId,
  prefilledSourceQuoteId,
  prefilledContingency = false,
  onSave,
  onSent,
  onPreview,
  onBack,
  onOpenSettings,
}) => {
  const activeSteps = inspectionOnly
    ? steps.filter(s => ['customer', 'project', 'photos', 'review'].includes(s.id))
    : invoiceMode
    ? steps.filter(s => ['customer', 'project', 'invoice', 'review'].includes(s.id))
    : steps.filter(s => s.id !== 'contingency' && s.id !== 'invoice');
  const [currentStep, setCurrentStep] = useState(initialStep);
  // Maps activeSteps index → original steps index for content rendering
  const renderStep = activeSteps[currentStep]
    ? steps.findIndex(s => s.id === activeSteps[currentStep].id)
    : currentStep;
  const [saving, setSaving] = useState(false);
  const [previewingUnsaved, setPreviewingUnsaved] = useState(false);
  const [loading, setLoading] = useState(!!editQuoteId);
  const [localCompany, setLocalCompany] = useState<Company>(company);

  // Whether THIS quote's prices already include markup — stored per-quote in localStorage
  const quoteMarkupKey = editQuoteId ? `pim_${editQuoteId}` : null;
  const [pricesIncludeMarkup, setPricesIncludeMarkup] = React.useState<boolean>(() => {
    if (!quoteMarkupKey) return !!(localCompany.supplement_rates as any)?.prices_include_markup;
    const stored = localStorage.getItem(quoteMarkupKey);
    if (stored !== null) return stored === 'true';
    return !!(localCompany.supplement_rates as any)?.prices_include_markup;
  });
  const togglePricesIncludeMarkup = () => {
    const next = !pricesIncludeMarkup;
    setPricesIncludeMarkup(next);
    if (quoteMarkupKey) localStorage.setItem(quoteMarkupKey, String(next));

    // Convert all non-labor, non-divider line item prices between cost and sell price.
    // Sell price = cost / (1 − margin%).  Reverse to go back to cost.
    const margin = (localCompany.default_margin_percent ?? 50) / 100;
    const mult = next
      ? (margin < 1 ? 1 / (1 - margin) : 1)  // cost → sell
      : (margin < 1 ? (1 - margin) : 1);      // sell → cost

    if (mult !== 1) {
      const round = (n: number) => Math.round(n * 100) / 100;
      setLineItems(prev => prev.map(item => {
        // Labor and per-job fees (permits, dumpster, disposal, tear-off) are
        // pass-throughs billed at cost — they must not move between modes.
        if (item.is_divider || isPassThroughLine(item)) return item;
        return {
          ...item,
          good_price:   round(item.good_price   * mult),
          better_price: round(item.better_price * mult),
          best_price:   round(item.best_price   * mult),
          price:        round((item.price ?? item.good_price) * mult),
        };
      }));
    }

    // Sell Price mode → slider hidden, no additional markup needed.
    // Cost mode → slider visible at 0 so user can adjust per-quote.
    priceAdjPctRef.current = 0;
    setPriceAdjPct(0);
  };

  // Customer fields
  const [customer, setCustomer] = useState<Partial<Customer>>({
    first_name: '', last_name: '', email: '', phone: '', address: '', city: '', state: '', zip: ''
  });
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  // Project fields
  const [projectType, setProjectType] = useState<'exterior' | 'interior' | 'both' | 'inspection_report'>(inspectionOnly ? 'inspection_report' : 'exterior');
  const [projectDescription, setProjectDescription] = useState('');
  const [coverPageTitle, setCoverPageTitle] = useState(inspectionOnly ? 'Inspection Report' : 'Home Restoration Proposal');
  const [contingencyEnabled, setContingencyEnabled] = useState(inspectionOnly || prefilledContingency);
  const [completionCertificateEnabled, setCompletionCertificateEnabled] = useState(false);
  const [invoiceTotal, setInvoiceTotal] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDueDate, setDepositDueDate] = useState('');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string>('');
  const [coverPhotoZoom, setCoverPhotoZoom] = useState(1);
  const [coverPhotoOffsetX, setCoverPhotoOffsetX] = useState(50);
  const [coverPhotoOffsetY, setCoverPhotoOffsetY] = useState(50);
  const [uploadingCoverPhoto, setUploadingCoverPhoto] = useState(false);
  const [includeAbout, setIncludeAbout] = useState(true);
  const [includeWarranty, setIncludeWarranty] = useState(true);
  const [includeCancel, setIncludeCancel] = useState(true);
  const [includeBetter, setIncludeBetter] = useState(true);
  const [includeBest, setIncludeBest] = useState(true);
  const [showLineItemPrices, setShowLineItemPrices] = useState(true);
  const [showSectionTotals, setShowSectionTotals] = useState(true);
  const [showItemDescriptions, setShowItemDescriptions] = useState(true);
  const [showUpgradePrices, setShowUpgradePrices] = useState(true);
  const [useManualTotals, setUseManualTotals] = useState(false);
  const [manualGoodTotal, setManualGoodTotal] = useState(0);
  const [manualBetterTotal, setManualBetterTotal] = useState(0);
  const [manualBestTotal, setManualBestTotal] = useState(0);
  const [notes, setNotes] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const lineItemsRef = React.useRef<LineItem[]>([]);
  lineItemsRef.current = lineItems;
  const [lineItemsHistory, setLineItemsHistory] = useState<LineItem[][]>([]); // undo stack

  // Only push to history when items are structurally changed (added/removed).
  // Typing in price/description fields does NOT create undo snapshots.
  const setLineItemsWithHistory = useCallback((next: LineItem[]) => {
    const current = lineItemsRef.current;
    if (next.length !== current.length) {
      // Item added or removed — snapshot current state
      setLineItemsHistory(prev => [...prev.slice(-19), current]);
    }
    setLineItems(next);
  }, []);

  const undoLineItems = () => {
    if (lineItemsHistory.length === 0) return;
    const prev = lineItemsHistory[lineItemsHistory.length - 1];
    setLineItemsHistory(h => h.slice(0, -1));
    setLineItems(prev);
  };

  /**
   * Labor is charged at its real rate and never marked up — it has to stay
   * legible so a crew rate can be checked or changed without unpicking a
   * markup. Margin is made on materials.
   */
  const isLaborLine = (item: LineItem): boolean => {
    if ((item as any).is_divider) return false;
    return /labor/i.test(item.item_name) || /labor/i.test(item.category ?? '');
  };

  /**
   * Costs billed at what they cost, never marked up.
   *
   * Labor was always treated this way. Per-job fees (permits, dumpster,
   * disposal, haul-off, cleanup) are the same kind of thing — a pass-through
   * the customer is charged at cost, not a material to make margin on. So is
   * tear-off, whose name carries no "labor" keyword and so slipped past the
   * labor test and was marked up as if it were a material.
   *
   * At the default 50% margin, marking these up doubled them: a $469 permit
   * billed at $938 in sell mode.
   *
   * Mirrors isPassThroughItem in the iOS app so both price the same job the
   * same way.
   */
  const isPassThroughLine = (item: LineItem): boolean => {
    if ((item as any).is_divider) return false;
    if (isLaborLine(item)) return true;
    const n = (item.item_name ?? '').toLowerCase();
    const c = (item.category ?? '').toLowerCase();
    return (
      /cleanup|clean.up|haul.?off|haul.?away|dumpster|debris|disposal/.test(n) ||
      /permit|inspection.*fee|building.*fee/.test(n) ||
      /tear.?off/.test(n) ||
      c === 'permits & fees' || c === 'cleanup'
    );
  };

  /**
   * The markup is bounded to what the slider can express. An unbounded value
   * corrupts prices on the way back out: the undo factor is 1/(1+prev/100), so
   * a stored 6220% divides every price by 63 the next time the markup changes —
   * which is exactly what happened when a target solved an absurd percentage
   * and the line items were then replaced by a fresh import carrying no markup.
   */
  const MAX_MARKUP_PCT = 200;
  const clampMarkup = (pct: number) =>
    Math.min(MAX_MARKUP_PCT, Math.max(0, Number.isFinite(pct) ? pct : 0));

  const handlePriceAdjust = (rawPct: number) => {
    const newPct = clampMarkup(rawPct);
    const prev = clampMarkup(priceAdjPctRef.current);
    if (newPct === prev) return;
    const undoMult = prev !== 0 ? 1 / (1 + prev / 100) : 1;
    const mult = undoMult * (1 + newPct / 100);
    setLineItems(items => items.map(item => item.is_divider || isPassThroughLine(item) ? item : ({
      ...item,
      good_price:   Math.round(item.good_price   * mult * 100) / 100,
      better_price: Math.round(item.better_price * mult * 100) / 100,
      best_price:   Math.round(item.best_price   * mult * 100) / 100,
    })));
    priceAdjPctRef.current = newPct;
    setPriceAdjPct(newPct);
  };

  /**
   * Solve for the material markup that makes a tier land on a target $/sq.
   *
   *   materials × (1 + p) + labor = target × squares
   *
   * Labor is a pass-through, so it comes off the target before the materials
   * are scaled. Returns null when the target can't be reached — labor alone
   * already exceeding it, or nothing to mark up.
   */
  /**
   * Scale one tier's material prices so that tier lands on a $/sq target.
   *
   * The markup slider moves all three tiers together, which is what you want
   * for a blanket margin. Pricing to a target is the opposite: Good, Better and
   * Best are priced individually, so hitting a Good number must leave Better
   * and Best where they are.
   *
   * Pass-throughs come off the target first — labor and disposal are not marked
   * up — then the tier's materials are scaled to cover the rest.
   */
  /**
   * Rows that belong to a tier. calculateTotals has always filtered this way;
   * the target solver did not, so on a per-tier import it summed every tier's
   * rows into one tier — reporting $939.84/sq at cost on a roof that quotes
   * around $350/sq.
   */
  const tierApplies = (tier: 'good' | 'better' | 'best') => (item: LineItem) =>
    !usePerTierItems ||
    !item.tiers_applicable?.length ||
    item.tiers_applicable.includes(tier);

  /**
   * Rows belonging to the scope being edited.
   *
   * With separate scopes every scope's rows live in the same lineItems array,
   * each tagged with its quote_option_id. Pricing to a target summed all of
   * them, so a three-scope quote reported roughly three times its cost per
   * square and refused targets that are easily reachable.
   */
  const scopeApplies = (item: LineItem) =>
    quoteStructureType !== 'multi_scope' ||
    !activeOptionId ||
    item.quote_option_id === activeOptionId;

  const applyTargetToTier = (
    targetPerSq: number,
    squares: number,
    tier: 'good' | 'better' | 'best',
  ): boolean => {
    if (!(targetPerSq > 0) || !(squares > 0)) return false;
    const key = `${tier}_price` as const;

    let materials = 0;
    let passThrough = 0;
    for (const item of lineItems.filter(tierApplies(tier)).filter(scopeApplies)) {
      if ((item as any).is_divider) continue;
      const line = (item.quantity ?? 0) * ((item as any)[key] ?? 0);
      if (isPassThroughLine(item)) passThrough += line;
      else materials += line;
    }
    if (materials <= 0) return false;

    const factor = (targetPerSq * squares - passThrough) / materials;
    // A target the pass-throughs alone already exceed would invert the prices.
    if (!Number.isFinite(factor) || factor <= 0) return false;

    setLineItems(items => items.map(item =>
      ((item as any).is_divider || isPassThroughLine(item) || !tierApplies(tier)(item) || !scopeApplies(item))
        ? item
        : { ...item, [key]: Math.round(((item as any)[key] ?? 0) * factor * 100) / 100 },
    ));
    return true;
  };

  const solveMarkupForTarget = (
    targetPerSq: number,
    squares: number,
    tier: 'good' | 'better' | 'best',
  ): { pct: number; materialsAtCost: number; labor: number } | null => {
    if (!(targetPerSq > 0) || !(squares > 0)) return null;
    const key = `${tier}_price` as const;
    const prevMult = 1 + priceAdjPctRef.current / 100;
    let materialsAtCost = 0;
    let labor = 0;
    for (const item of lineItems.filter(tierApplies(tier)).filter(scopeApplies)) {
      if (item.is_divider) continue;
      const line = (item.quantity ?? 0) * ((item as any)[key] ?? 0);
      // Pass-throughs come off the target before materials are scaled, the
      // same way labor always did.
      if (isPassThroughLine(item)) labor += line;
      // Materials currently carry the previous markup — strip it to get cost.
      else materialsAtCost += line / prevMult;
    }
    if (materialsAtCost <= 0) return null;
    const targetTotal = targetPerSq * squares;
    const pct = ((targetTotal - labor) / materialsAtCost - 1) * 100;
    if (!Number.isFinite(pct)) return null;
    return { pct: Math.round(pct * 10) / 10, materialsAtCost, labor };
  };

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [availableTemplates, setAvailableTemplates] =
    useState<QuoteProjectTemplate[]>(quoteProjectTemplates);
  const [scopeConfigs, setScopeConfigs] = useState<Array<{
    name: string;
    templateId: string | null;
    roofBrand: string | null;
    sidingBrand: string | null;
  }>>([
    { name: 'Scope 1', templateId: null, roofBrand: null, sidingBrand: null },
    { name: 'Scope 2', templateId: null, roofBrand: null, sidingBrand: null },
    { name: 'Scope 3', templateId: null, roofBrand: null, sidingBrand: null },
  ]);

  // Photos
  const [photos, setPhotos] = useState<QuotePhoto[]>([]);

  // AI
  const [aiGeneratingDesc, setAiGeneratingDesc] = useState(false);
  const [aiAnalyzingPhoto, setAiAnalyzingPhoto] = useState<number | null>(null);
  const [aiPhotoModal, setAiPhotoModal] = useState<{
    analysis: AIQuotePhotoAnalysis;
    photoIndex: number;
    selectedItems: boolean[];
  } | null>(null);

  // Per-tier option photos
  const [tierPhotoGood, setTierPhotoGood] = useState<string>('');
  const [tierPhotoBetter, setTierPhotoBetter] = useState<string>('');
  const [tierPhotoBest, setTierPhotoBest] = useState<string>('');
  const [uploadingTierPhoto, setUploadingTierPhoto] = useState<string | null>(null);

  // Per-tier descriptions/blurbs
  const [tierDescGood, setTierDescGood] = useState<string>('');
  const [tierDescBetter, setTierDescBetter] = useState<string>('');
  const [tierDescBest, setTierDescBest] = useState<string>('');
  const [generatingTierDescs, setGeneratingTierDescs] = useState(false);

  // Tier names
  const [goodTierName, setGoodTierName] = useState('Good');
  const [betterTierName, setBetterTierName] = useState('Better');
  const [bestTierName, setBestTierName] = useState('Best');

  // Per-tier template mode — each tier gets its own independent set of line items
  const [usePerTierItems, setUsePerTierItems] = useState(false);
  // Active editor tab when per-tier mode is on
  const [perTierEditorTab, setPerTierEditorTab] = useState<'good' | 'better' | 'best'>('good');
  // Display labels showing which template is loaded per tier (cosmetic only)
  const [perTierLabels, setPerTierLabels] = useState<{ good: string | null; better: string | null; best: string | null }>({ good: null, better: null, best: null });
  // Pending template selection in the per-tier selector dropdowns
  const [perTierPending, setPerTierPending] = useState<{ good: string; better: string; best: string }>({ good: '', better: '', best: '' });

  // Quote style preference
  const [quoteStyle, setQuoteStyle] = useState<'classic' | 'professional'>('professional');

  // Company pricing library
  const [companyPricing, setCompanyPricing] = useState<CompanyPricing[]>([]);
  // Debounce timers for auto-saving price edits to company_pricing
  const priceSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // AI enabled state
  const [aiEnabled, setAiEnabled] = useState(false);

  // Send modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [generatingEmailDraft, setGeneratingEmailDraft] = useState(false);
  const [emailDraftBody, setEmailDraftBody] = useState('');
  const [emailDraftSubject, setEmailDraftSubject] = useState('');
  const [additionalEmails, setAdditionalEmails] = useState('');
  // Set from the quote row on load — a previously saved "Save Draft" (subject/
  // body/CC on the send screen) that handleOpenSendModal should restore
  // instead of silently overwriting with a freshly generated draft.
  const [savedDraftEmail, setSavedDraftEmail] = useState<{ subject: string | null; message: string | null; ccEmails: string | null } | null>(null);

  // Roofr PDF import state
  const [roofrImporting, setRoofrImporting] = useState(false);
  const [roofrPreview, setRoofrPreview] = useState<{ address: string; totalSqft: number; structures: number } | null>(null);
  const [roofrWaste, setRoofrWaste] = useState<0 | 10 | 12 | 15>(10);
  const [roofrParsed, setRoofrParsed] = useState<any>(null);
  const roofrFileRef = useRef<HTMLInputElement>(null);

  // Financing options
  const [availableFinancing, setAvailableFinancing] = useState<Array<{
    id: string; lender_name: string; program_name: string | null;
    apr_low: number | null; apr_high: number | null; term_months: number | null; notes: string | null;
  }>>([]);
  const [selectedFinancingIds, setSelectedFinancingIds] = useState<string[]>([]);
  const [showFinancing, setShowFinancing] = useState(false);

  // Add Section modal
  const [showAddSection, setShowAddSection] = useState(false);
  const [addSectionName, setAddSectionName] = useState('');
  const [addSectionType, setAddSectionType] = useState<'template' | 'custom'>('template');

  // Quote ID (after first save)
  const [quoteId, setQuoteId] = useState<string | null>(editQuoteId || null);
  const [quoteNumber, setQuoteNumber] = useState('');
  const [existingStatus, setExistingStatus] = useState<string | null>(null);

  // Autosave
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);
  // Prevents concurrent silent saves (perTierLoadSaveDone + autosave can both fire
  // within 700ms of each other; without a lock the second save's DELETE runs while
  // the first save's INSERT is still in-flight → duplicate line items in the DB).
  const silentSaveInProgress = useRef(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const pendingEmailContent = useRef<{ subject: string; message: string } | null>(null);

  // Cover / sales rep photos
  const [salesRepPhotoUrl, setSalesRepPhotoUrl] = useState(currentUser?.avatar_url ?? '');
  const [salesRepPhotoZoom, setSalesRepPhotoZoom] = useState(1);
  const [salesRepPhotoOffsetX, setSalesRepPhotoOffsetX] = useState(50);
  const [salesRepPhotoOffsetY, setSalesRepPhotoOffsetY] = useState(50);
  const [uploadingSalesRepPhoto, setUploadingSalesRepPhoto] = useState(false);

  // Custom pages
  const [selectedCustomPages, setSelectedCustomPages] = useState<CustomQuotePage[]>([]);

  // Measurement integration
  const [measurementProvider, setMeasurementProvider] = useState<MeasurementProviderId | null>(null);
  const [measurementSourceName, setMeasurementSourceName] = useState<string | null>(null);
  const [measurementData, setMeasurementData] = useState<Record<string, unknown> | null>(null);

  // Measurement report sharing
  const [measurementReportUrl, setMeasurementReportUrl] = useState<string | null>(null);
  const [includeReportWithQuote, setIncludeReportWithQuote] = useState(false);

  // Roofr report
  const [roofrReport, setRoofrReport] = useState<RoofrParsedReport | null>(null);
  const [roofrFileName, setRoofrFileName] = useState('');
  const [roofrWastePercent, setRoofrWastePercent] = useState<number>(10);
  const [customWasteInput, setCustomWasteInput] = useState('10');
  const [parsingRoofr, setParsingRoofr] = useState(false);
  // 'all' = combined total; number = 0-based index into roofrReport.structures
  const [roofrStructureScope, setRoofrStructureScope] = useState<'all' | number>('all');
  const [roofrImportMode, setRoofrImportMode] = useState<RoofrImportMode>('combined');
  /**
   * standard      — prices come from the price list, itemized.
   * per-sq-items  — you set $/sq and it is spread across the real line items,
   *                 so every line keeps a price and they still sum to the rate.
   * per-sq        — all-in: the rate lands on the shingle line and the other
   *                 materials show quantity only.
   */
  const [roofrPricingMode, setRoofrPricingMode] = useState<'standard' | 'per-sq-items' | 'per-sq'>('standard');
  const [roofrPerSqGoodRate, setRoofrPerSqGoodRate] = useState<string>('485');
  const [roofrPerSqBetterRate, setRoofrPerSqBetterRate] = useState<string>('510');
  const [roofrPerSqBestRate, setRoofrPerSqBestRate] = useState<string>('750');
  // Which tier(s) the Roofr "Sync from Measurements" button targets.
  // 'all' = sync all tiers (default); 'good'/'better'/'best' = sync only that tier.
  const [roofrMeasureTier, setRoofrMeasureTier] = useState<'all' | 'good' | 'better' | 'best'>('all');
  // Manual square measurement entry
  const [manualSqExpanded, setManualSqExpanded] = useState(false);
  const [manualSquares, setManualSquares] = useState('');
  const [manualEaves, setManualEaves] = useState('');
  const [manualRakes, setManualRakes] = useState('');
  const [manualRidge, setManualRidge] = useState('');
  const [manualHips, setManualHips] = useState('');
  const [manualValleys, setManualValleys] = useState('');
  const [manualPipeBoots, setManualPipeBoots] = useState('');
  const [manualWaste, setManualWaste] = useState<number>(10);
  // Conditions the measurement report can't know — drive the labor adders.
  const [jobStories, setJobStories] = useState<number>(1);
  const [jobLayers, setJobLayers] = useState<number>(1);
  /** created_at of the quote being edited — null for a new one. Rule changes
   *  never reach a quote that already existed. */
  const [quoteCreatedAt, setQuoteCreatedAt] = useState<string | null>(null);

  /** Squares the target $/sq is measured against — measured area plus waste. */
  const targetSquares = useMemo(() => {
    const raw = roofrReport
      ? ((roofrReport.reportSummary?.totalRoofAreaSqft || roofrReport.totalRoofAreaSqft) / 100)
      : (parseFloat(manualSquares) || 0);
    return raw > 0 ? raw * (1 + manualWaste / 100) : 0;
  }, [roofrReport, manualSquares, manualWaste]);
  const [manualPricingMode, setManualPricingMode] = useState<'standard' | 'per-sq'>('standard');
  const [manualPerSqGoodRate, setManualPerSqGoodRate] = useState('');
  const [manualPerSqBetterRate, setManualPerSqBetterRate] = useState('');
  const [manualPerSqBestRate, setManualPerSqBestRate] = useState('');
  // Quick per-square quote card (top of step 3, before measurement import)
  const [quickPerSqOpen, setQuickPerSqOpen] = useState(false);
  // Manual measurement entry — which tier to target when syncing (default: all)
  const [manualMeasureTier, setManualMeasureTier] = useState<'all' | 'good' | 'better' | 'best'>('all');
  // Multi-select save targets (per-tier + hasPerTierTemplates mode): which tiers receive the save
  const [manualSaveTierTargets, setManualSaveTierTargets] = useState<Set<'good' | 'better' | 'best'>>(new Set(['good', 'better', 'best']));
  // For multi_scope mode: which quote_option_id to target
  const [manualTargetOptionId, setManualTargetOptionId] = useState<string | null>(null);
  // Track which tiers/scopes have had measurements saved — drives ✓ badges
  const [measuredTiers, setMeasuredTiers] = useState<Set<string>>(new Set());
  // Per-tier/scope isolated measurement pools — keyed by tier ('good'/'better'/'best') or option ID
  const [tierMeasurementPools, setTierMeasurementPools] = useState<Record<string, {
    squares: string; eaves: string; rakes: string; ridge: string;
    hips: string; valleys: string; pipeBoots: string; waste: number;
  }>>({});
  // Insurance supplements (pitch / story height) — opt-in toggle
  const [manualSupplementsEnabled, setManualSupplementsEnabled] = useState(false);
  const [manualStories, setManualStories] = useState<'1' | '2' | '3+'>('1');
  const [manualPitchZones, setManualPitchZones] = useState<Array<{ pitch: string; squares: string }>>([{ pitch: '6', squares: '' }]);
  // Price adjustment slider (scope summary footer)
  const [priceAdjPct, setPriceAdjPct] = useState(0);
  // Price-to-target: solves the material markup needed to hit a $/sq figure
  const [targetPerSq, setTargetPerSq] = useState('');
  const [targetTier, setTargetTier] = useState<'good' | 'better' | 'best'>('good');
  const priceAdjPctRef = useRef(0);
  // Standalone per-square pricing (scope summary footer)
  const [globalPerSqGoodRate, setGlobalPerSqGoodRate] = useState('');
  const [globalPerSqTier, setGlobalPerSqTier] = useState<'good' | 'better' | 'best'>('good');

  // EagleView Walls (siding) import
  const [wallsReport, setWallsReport] = useState<EagleViewWallsReport | null>(null);
  const [wallsFileName, setWallsFileName] = useState('');
  const [wallsWastePercent, setWallsWastePercent] = useState(10);
  const [wallsPricingMode, setWallsPricingMode] = useState<'standard' | 'per-sq'>('standard');
  const [wallsPerSqGoodRate, setWallsPerSqGoodRate] = useState<string>('');
  const [wallsPerSqBetterRate, setWallsPerSqBetterRate] = useState<string>('');
  const [wallsPerSqBestRate, setWallsPerSqBestRate] = useState<string>('');
  const [parsingWalls, setParsingWalls] = useState(false);
  const [wallsAreaSource, setWallsAreaSource] = useState<'siding' | 'wall' | 'masonry'>('siding');

  // ── Additional / extra measurement reports (multi-report uploads) ──────────
  // Supports uploading more than one PDF when the user has separate reports for
  // different structures or trades (e.g. roof report + walls report from
  // different EagleView orders, or two Roofr reports for a house + garage).
  interface AdditionalMeasurementReport {
    id: string;
    fileName: string;
    roofData: RoofrParsedReport | null;
    wallsData: EagleViewWallsReport | null;
  }
  const [additionalReports, setAdditionalReports] = useState<AdditionalMeasurementReport[]>([]);
  const [parsingAdditional, setParsingAdditional] = useState(false);
  const [wallsHintDismissed, setWallsHintDismissed] = useState(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem('wallsHintDismissed') === 'true'
  );
  const [wallsHintOpen, setWallsHintOpen] = useState(false);
  // Manual siding square entry
  const [manualSidingSqExpanded, setManualSidingSqExpanded] = useState(false);
  const [manualSidingSquares, setManualSidingSquares] = useState('');
  const [manualSidingPerimeter, setManualSidingPerimeter] = useState('');
  const [manualSidingEaves, setManualSidingEaves] = useState('');
  const [manualSidingWindows, setManualSidingWindows] = useState('');
  const [manualSidingDoors, setManualSidingDoors] = useState('');
  const [manualSidingInsideCorners, setManualSidingInsideCorners] = useState('');
  const [manualSidingOutsideCorners, setManualSidingOutsideCorners] = useState('');
  const [manualSidingWallHeight, setManualSidingWallHeight] = useState('');
  const [manualSidingWaste, setManualSidingWaste] = useState<number>(10);
  const [manualSidingPricingMode, setManualSidingPricingMode] = useState<'standard' | 'per-sq'>('standard');
  const [manualSidingPerSqGoodRate, setManualSidingPerSqGoodRate] = useState('');
  const [manualSidingPerSqBetterRate, setManualSidingPerSqBetterRate] = useState('');
  const [manualSidingPerSqBestRate, setManualSidingPerSqBestRate] = useState('');
  // EagleView Solar (Inform Advanced for Solar) import
  const [solarReport, setSolarReport] = useState<EagleViewSolarReport | null>(null);
  const [solarFileName, setSolarFileName] = useState('');
  const [parsingSolar, setParsingSolar] = useState(false);

  // Unified import card scope
  const [importScope, setImportScope] = useState<'roof' | 'siding' | 'both' | 'solar' | 'gutters' | 'roof-gutters'>('roof');
  // Manual gutter entry
  const [manualGutterExpanded, setManualGutterExpanded] = useState(false);
  const [manualGutterLf, setManualGutterLf] = useState('');
  const [manualGutterStyle, setManualGutterStyle] = useState<'5-inch' | '6-inch' | '7-inch' | 'box'>('5-inch');
  const [manualGutterDownspoutCount, setManualGutterDownspoutCount] = useState('');
  const [manualGutterDownspoutLf, setManualGutterDownspoutLf] = useState('');
  const [manualGutterStories, setManualGutterStories] = useState<'1' | '2'>('1');
  const [manualGutterGuards, setManualGutterGuards] = useState(false);

  // Upgrades / Add-ons
  const [upgrades, setUpgrades] = useState<QuoteUpgrade[]>([]);

  // Quote options (new architecture)
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);
  const [quoteStructureType, setQuoteStructureType] = useState<QuoteStructureType>(
    inspectionOnly ? 'inspection_report' : invoiceMode ? 'insurance_invoice' : 'tiered'
  );

  // Brochure / file attachments
  const [attachedFiles, setAttachedFiles] = useState<CompanyFileRecord[]>([]);
  const [includeBrochures, setIncludeBrochures] = useState(true);
  const [companyFileLibrary, setCompanyFileLibrary] = useState<CompanyFileRecord[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // AI helpers
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [draftingEmail, setDraftingEmail] = useState(false);
  // AI description generation for upgrades
  const [upgradeDescGenerating, setUpgradeDescGenerating] = useState<Set<string>>(new Set());
  const [upgradeDescUndo, setUpgradeDescUndo] = useState<Map<string, string>>(new Map());
  const [aiEmailDraft, setAiEmailDraft] = useState<{ subject: string; body: string } | null>(null);

  // localStorage key used to persist and restore new-quote drafts
  const draftStorageKey = useMemo(
    () => `quotemgr_quote_draft_${companyId}`,
    [companyId],
  );

  useEffect(() => {
    fetchExistingCustomers();
    fetchCompanyPricing();
    fetchFinancingOptions();
    fetchFileLibrary();
    if (editQuoteId) loadQuote(editQuoteId);
  }, [editQuoteId]);

  useEffect(() => {
    if (!prefilledCustomerId || editQuoteId) return;
    supabase.from('customers').select('*').eq('id', prefilledCustomerId).single().then(({ data }) => {
      if (data) selectExistingCustomer(data as Customer);
    });
  }, [prefilledCustomerId]);

  useEffect(() => {
    if (editQuoteId) return;

    try {
      const rawDraft = window.localStorage.getItem(draftStorageKey);
      if (!rawDraft) return;

      const draft = JSON.parse(rawDraft) as {
        currentStep?: number;
        customer?: Partial<Customer>;
        selectedCustomerId?: string | null;
        projectType?: 'exterior' | 'interior' | 'both' | 'inspection_report';
        projectDescription?: string;
        coverPageTitle?: string;
        includeAbout?: boolean;
        includeWarranty?: boolean;
        includeCancel?: boolean;
        includeBetter?: boolean;
        includeBest?: boolean;
        goodTierName?: string;
        betterTierName?: string;
        bestTierName?: string;
        showLineItemPrices?: boolean;
        showSectionTotals?: boolean;
        showItemDescriptions?: boolean;
        useManualTotals?: boolean;
        manualGoodTotal?: number;
        manualBetterTotal?: number;
        manualBestTotal?: number;
        notes?: string;
        lineItems?: LineItem[];
        photos?: QuotePhoto[];
        tierPhotoGood?: string;
        tierPhotoBetter?: string;
        tierPhotoBest?: string;
        coverPhotoUrl?: string;
        coverPhotoZoom?: number;
        coverPhotoOffsetX?: number;
        coverPhotoOffsetY?: number;
        salesRepPhotoUrl?: string;
        salesRepPhotoZoom?: number;
        salesRepPhotoOffsetX?: number;
        salesRepPhotoOffsetY?: number;
        selectedCustomPages?: CustomQuotePage[];
        attachedFiles?: CompanyFileRecord[];
        includeBrochures?: boolean;
        selectedFinancingIds?: string[];
        showFinancing?: boolean;
        selectedTemplateId?: string | null;
        measurementProvider?: string | null;
        measurementSourceName?: string | null;
        measurementData?: Record<string, unknown> | null;
        roofrReport?: RoofrParsedReport | null;
        roofrFileName?: string;
        roofrWastePercent?: number;
        roofrImportMode?: RoofrImportMode;
        solarReport?: EagleViewSolarReport | null;
        solarFileName?: string;
        additionalReports?: AdditionalMeasurementReport[];
        quoteNumber?: string;
        tierDescGood?: string;
        tierDescBetter?: string;
        tierDescBest?: string;
        quoteStyle?: 'classic' | 'professional';
      };

      // Always start a new quote at step 0 (Customer Info) even if the draft
      // recorded a later step — the user should confirm customer details first.
      setCurrentStep(0);
      setCustomer(draft.customer || {
        first_name: '', last_name: '', email: '', phone: '', address: '', city: '', state: '', zip: ''
      });
      setSelectedCustomerId(draft.selectedCustomerId || null);
      setProjectType(draft.projectType || 'exterior');
      setProjectDescription(draft.projectDescription || '');
      setCoverPageTitle(draft.coverPageTitle || 'Home Restoration Proposal');
      setIncludeAbout(draft.includeAbout ?? true);
      setIncludeWarranty(draft.includeWarranty ?? true);
      setIncludeCancel(draft.includeCancel ?? true);
      setIncludeBetter(draft.includeBetter ?? true);
      setIncludeBest(draft.includeBest ?? true);
      setGoodTierName(draft.goodTierName || 'Good');
      setBetterTierName(draft.betterTierName || 'Better');
      setBestTierName(draft.bestTierName || 'Best');
      setShowLineItemPrices(draft.showLineItemPrices ?? true);
      setShowSectionTotals(draft.showSectionTotals ?? true);
      setShowItemDescriptions(draft.showItemDescriptions ?? true);
      setUseManualTotals(draft.useManualTotals ?? false);
      setManualGoodTotal(draft.manualGoodTotal ?? 0);
      setManualBetterTotal(draft.manualBetterTotal ?? 0);
      setManualBestTotal(draft.manualBestTotal ?? 0);
      setNotes(draft.notes || '');
      setLineItems(draft.lineItems || []);
      setPhotos(draft.photos || []);
      setTierPhotoGood(draft.tierPhotoGood || '');
      setTierPhotoBetter(draft.tierPhotoBetter || '');
      setTierPhotoBest(draft.tierPhotoBest || '');
      setCoverPhotoUrl(draft.coverPhotoUrl || '');
      setCoverPhotoZoom(draft.coverPhotoZoom ?? 1);
      setCoverPhotoOffsetX(draft.coverPhotoOffsetX ?? 50);
      setCoverPhotoOffsetY(draft.coverPhotoOffsetY ?? 50);
      setSalesRepPhotoUrl(draft.salesRepPhotoUrl || '');
      setSalesRepPhotoZoom(draft.salesRepPhotoZoom ?? 1);
      setSalesRepPhotoOffsetX(draft.salesRepPhotoOffsetX ?? 50);
      setSalesRepPhotoOffsetY(draft.salesRepPhotoOffsetY ?? 50);
      setSelectedCustomPages(draft.selectedCustomPages || []);
      setAttachedFiles(draft.attachedFiles || []);
      setIncludeBrochures(draft.includeBrochures ?? true);
      setSelectedFinancingIds(draft.selectedFinancingIds || []);
      setShowFinancing(draft.showFinancing ?? false);
      setSelectedTemplateId(draft.selectedTemplateId || null);
      setMeasurementProvider(draft.measurementProvider || null);
      setMeasurementSourceName(draft.measurementSourceName || null);
      setMeasurementData(draft.measurementData || null);
      setRoofrReport(draft.roofrReport || null);
      setRoofrFileName(draft.roofrFileName || '');
      setRoofrWastePercent(draft.roofrWastePercent ?? 10);
      setSolarReport(draft.solarReport || null);
      setSolarFileName(draft.solarFileName || '');
      setAdditionalReports(draft.additionalReports || []);
      setRoofrImportMode(
        draft.roofrImportMode ||
          draft.roofrReport?.importMode ||
          ((draft.measurementData as { importMode?: RoofrImportMode } | null)?.importMode) ||
          'combined',
      );
      setQuoteNumber(draft.quoteNumber || '');
      setTierDescGood(draft.tierDescGood || '');
      setTierDescBetter(draft.tierDescBetter || '');
      setTierDescBest(draft.tierDescBest || '');
      setQuoteStyle(draft.quoteStyle || 'professional');

      // Ask the user whether to resume or start fresh
      const resume = window.confirm(
        'You have an unsaved quote draft. Resume where you left off?\n\nClick OK to resume, or Cancel to start a fresh quote.',
      );
      if (!resume) {
        window.localStorage.removeItem(draftStorageKey);
        // Reset everything back to defaults
        setCurrentStep(0);
        setCustomer({ first_name: '', last_name: '', email: '', phone: '', address: '', city: '', state: '', zip: '' });
        setSelectedCustomerId(null);
        setProjectType('exterior');
        setProjectDescription('');
        setCoverPageTitle('Home Restoration Proposal');
        setLineItems([]);
        setPhotos([]);
        setRoofrReport(null);
        setRoofrFileName('');
        setMeasurementProvider(null);
        setMeasurementSourceName(null);
        setMeasurementData(null);
        setSolarReport(null);
        setSolarFileName('');
        setAdditionalReports([]);
        setNotes('');
        setSelectedTemplateId(null);
        setQuoteNumber('');
        setTierDescGood('');
        setTierDescBetter('');
        setTierDescBest('');
      }
    } catch (error) {
      console.error('Failed to restore quote draft:', error);
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey, editQuoteId]);



  useEffect(() => {
    let mounted = true;

    const loadTemplates = async () => {
      const templates = await loadAllProjectTemplatesForCompany(companyId);
      if (mounted) {
        setAvailableTemplates(templates);
      }
    };

    const handleTemplateLibraryUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ companyId?: string }>;
      if (customEvent.detail?.companyId && customEvent.detail.companyId !== companyId) {
        return;
      }
      void loadTemplates();
    };

    void loadTemplates();
    window.addEventListener(
      TEMPLATE_LIBRARY_UPDATED_EVENT,
      handleTemplateLibraryUpdate as EventListener
    );

    return () => {
      mounted = false;
      window.removeEventListener(
        TEMPLATE_LIBRARY_UPDATED_EVENT,
        handleTemplateLibraryUpdate as EventListener
      );
    };
  }, [companyId]);

  // Mark initial load complete once loading finishes
  useEffect(() => {
    if (!loading) isInitialLoad.current = false;
  }, [loading]);

  // When per-tier templates are loaded, auto-select the first available tier so
  // the measurement Save button always targets a specific tier — never "all".
  // This runs on mount (after loadQuote populates perTierPending) and whenever
  // the template selections change.
  useEffect(() => {
    const hasPerTier = !!(perTierPending.good || perTierPending.better || perTierPending.best);
    if (hasPerTier && manualMeasureTier === 'all') {
      const first = perTierPending.good ? 'good' : perTierPending.better ? 'better' : 'best';
      setManualMeasureTier(first as 'good' | 'better' | 'best');
    }
  }, [perTierPending.good, perTierPending.better, perTierPending.best]); // eslint-disable-line react-hooks/exhaustive-deps

  // When per-tier-items mode is toggled ON without per-tier templates, default
  // the measurement target to 'good' so the Save button immediately shows
  // "Save Good Measurements" instead of "Apply to All Tiers".
  useEffect(() => {
    if (usePerTierItems && manualMeasureTier === 'all') {
      setManualMeasureTier('good');
    }
  }, [usePerTierItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // For per-tier-items quotes, force a silent save right after the quote loads.
  // This recalculates good_total/better_total/best_total from the current line
  // items and writes fresh values to the DB, fixing any stale totals that were
  // persisted before per-tier mode was enabled (which showed wrong values on the
  // dashboard). The ref gate ensures this fires exactly once per mount.
  const perTierLoadSaveDone = useRef(false);
  useEffect(() => {
    if (!loading && usePerTierItems && quoteId && !perTierLoadSaveDone.current) {
      perTierLoadSaveDone.current = true;
      // Small delay so isInitialLoad.current has flipped to false and lineItems
      // are fully settled in state before we calculate totals.
      setTimeout(() => void handleSave(false, true), 800);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, usePerTierItems, quoteId]);

  // Check AI configuration
  useEffect(() => {
    if (companyId) {
      // TrussCTR change: company AI keys are readable by owners and admins only, so
      // ask get_my_ai_config, which answers for anyone on the team (their personal
      // key, else the company's) without exposing the key.
      supabase.rpc('get_my_ai_config', { p_company_id: companyId })
        .then(({ data }) => {
          const row: any = Array.isArray(data) ? data[0] : data;
          setAiEnabled(!!row?.enabled);
        });
    }
  }, [companyId]);

  // Autosave: debounce 1.5s after any field change (new or existing quotes).
  // isInitialLoad prevents firing while the component is hydrating from DB.
  useEffect(() => {
    if (isInitialLoad.current || loading || saving || existingStatus === 'signed') return;

    const delay = !quoteId ? 800 : 1500; // slightly faster for the very first save
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void handleSave(false, true);
    }, delay);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [
    customer, projectType, projectDescription, coverPageTitle,
    includeAbout, includeWarranty, includeCancel, includeBetter, includeBest,
    showLineItemPrices, showSectionTotals, showItemDescriptions, showUpgradePrices, useManualTotals,
    manualGoodTotal, manualBetterTotal, manualBestTotal,
    tierPhotoGood, tierPhotoBetter, tierPhotoBest,
    notes, lineItems, selectedFinancingIds, showFinancing,
    photos, // ← photos must be included so uploads trigger autosave
    tierDescGood, tierDescBetter, tierDescBest,
    goodTierName, betterTierName, bestTierName,
    quoteStyle, usePerTierItems,
    quoteId, // include so the guard re-evaluates once the first save sets quoteId
    contingencyEnabled, // prevent stale-closure race: toggling this must cancel the old timer
  ]);

  // Warn before leaving the page with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (autoSaveStatus === 'saving' || (photos.length > 0 && !quoteId)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [autoSaveStatus, photos, quoteId]);

  // ── AI handlers ────────────────────────────────────────────────────────────
  const handleGenerateDescription = async () => {
    setAiGeneratingDesc(true);
    try {
      const desc = await generateQuoteProjectDescription(companyId, {
        projectType,
        coverPageTitle,
        notes,
        customerName: customer ? `${customer.first_name} ${customer.last_name}` : undefined,
        propertyAddress: customer?.address || undefined,
        lineItems: lineItems.map((li) => ({
          item_name: li.item_name,
          description: li.description,
          category: li.category,
          good_product: li.good_product || undefined,
          better_product: li.better_product || undefined,
          best_product: li.best_product || undefined,
          tiers_applicable: li.tiers_applicable || undefined,
        })),
        perTierLabels: {
          good: perTierLabels.good ?? undefined,
          better: perTierLabels.better ?? undefined,
          best: perTierLabels.best ?? undefined,
        },
        existingDescription: projectDescription || undefined,
      });
      setProjectDescription(desc);
      toast.success('Description generated!');
    } catch (err: any) {
      toast.error(err.message || 'AI generation failed');
    } finally {
      setAiGeneratingDesc(false);
    }
  };


  const handleAnalyzePhoto = async (index: number) => {
    const photo = photos[index];
    if (!photo?.photo_url) return;
    setAiAnalyzingPhoto(index);
    try {
      const analysis = await analyzeQuotePhoto(companyId, photo.photo_url, {
        projectType,
        existingLineItemNames: lineItems.map((li) => li.item_name),
      });
      // auto-fill caption / damage_type / notes on the photo itself
      const updatedPhotos = [...photos];
      updatedPhotos[index] = {
        ...updatedPhotos[index],
        caption: analysis.caption || updatedPhotos[index].caption,
        damage_type: analysis.damage_type || updatedPhotos[index].damage_type,
        notes: analysis.notes || updatedPhotos[index].notes,
      };
      setPhotos(updatedPhotos);
      if (analysis.suggested_line_items.length > 0) {
        setAiPhotoModal({
          analysis,
          photoIndex: index,
          selectedItems: analysis.suggested_line_items.map(() => true),
        });
      } else {
        toast.success('Photo analyzed — caption and notes updated.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Photo analysis failed');
    } finally {
      setAiAnalyzingPhoto(null);
    }
  };

  const handleAddAiLineItems = () => {
    if (!aiPhotoModal) return;
    const toAdd: LineItem[] = aiPhotoModal.analysis.suggested_line_items
      .filter((_, i) => aiPhotoModal.selectedItems[i])
      .map((item: AIQuotePhotoSuggestedLineItem) => ({
        id: `temp-${Date.now()}-${Math.random()}`,
        estimate_id: '',
        category: item.category,
        item_name: item.item_name,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        good_price: 0,
        better_price: 0,
        best_price: 0,
        sort_order: lineItems.length,
      }));
    if (toAdd.length > 0) {
      setLineItems((prev) => [...prev, ...toAdd]);
      toast.success(`Added ${toAdd.length} line item${toAdd.length > 1 ? 's' : ''} from AI analysis`);
    }
    setAiPhotoModal(null);
  };
  // ───────────────────────────────────────────────────────────────────────────

  // ── Roofr PDF import handlers ───────────────────────────────────────────────
  const handleRoofrImport = async (file: File) => {
    if (!file) return;
    setRoofrImporting(true);
    try {
      const parsed = await parseRoofrPdfReport(file);
      setRoofrParsed(parsed);
      setRoofrPreview({
        address: parsed.address || 'Unknown address',
        totalSqft: parsed.totalRoofAreaSqft || 0,
        structures: parsed.structures?.length || 1,
      });
    } catch (err: any) {
      toast.error('Failed to parse Roofr PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setRoofrImporting(false);
    }
  };

  const applyRoofrImport = () => {
    if (!roofrParsed) return;
    const imported = buildMeasurementLineItems('roofr', roofrParsed, companyPricing, roofrWaste, { stories: jobStories, layers: jobLayers });
    if (imported.length === 0) {
      toast.error('No line items could be generated — check that your Roofr report includes roof area and material calculation data.');
      return;
    }
    setLineItems(prev => [...prev, ...imported]);
    setRoofrPreview(null);
    setRoofrParsed(null);
    toast.success(`Added ${imported.length} line items from Roofr report`);
  };
  // ───────────────────────────────────────────────────────────────────────────

  const handleOpenSendModal = async () => {
    setShowSendModal(true);
    // A previously saved draft (Save Draft on this same screen) is what the
    // user typed and expects to see again — never overwrite it with a fresh
    // auto-generated subject/body just because the screen was reopened.
    if (savedDraftEmail && (savedDraftEmail.subject || savedDraftEmail.message)) {
      setEmailDraftSubject(savedDraftEmail.subject || '');
      setEmailDraftBody(savedDraftEmail.message || '');
      setAdditionalEmails(savedDraftEmail.ccEmails || '');
      return;
    }
    if (completionCertificateEnabled) {
      setEmailDraftSubject(`Completion Certificate – ${quoteNumber || ''} from ${company?.name || ''}`);
      setEmailDraftBody(`Hi ${customer.first_name || 'there'},\n\nThank you for your business — we truly appreciate it!\n\nAttached is your Completion Certificate for project #${quoteNumber || ''}. This is the final document that will be submitted to your insurance company to confirm that all work has been fully completed.\n\nThe certificate also includes your basic warranty information for your records. Please keep a copy for your files.\n\nIf you have any questions, don't hesitate to reach out.\n\nThank you again,\n${company?.name || ''}`);
      return;
    }
    if (projectType === 'inspection_report' || (inspectionOnly && contingencyEnabled)) {
      setEmailDraftSubject(`Inspection Report & Insurance Contingency Agreement – ${quoteNumber || ''} from ${company?.name || ''}`);
      setEmailDraftBody(`Hi ${customer.first_name || 'there'},\n\nThank you for the opportunity to inspect your property. Please find your Inspection Report attached for your review.\n\n${contingencyEnabled ? `This report also includes an Insurance Contingency Agreement for your signature. By signing, you are authorizing ${company?.name || 'us'} to work directly with your insurance company on your behalf to process your claim. You are not committing to any out-of-pocket cost at this time — our work only begins once your insurance claim has been approved.\n\nHere is how the process works:\n1. We submit your inspection report to your insurance company.\n2. Your insurance company reviews the claim and issues an approval.\n3. Once approved, we schedule the work and get started.\n4. Your out-of-pocket cost is limited to your deductible only.\n\nPlease review the report and sign the contingency agreement using the link below.\n\n` : `Please review the report and let us know if you have any questions.\n\n`}If you have any questions about the inspection findings or the claims process, please do not hesitate to reach out — we are here to help every step of the way.\n\nThank you,\n${company?.name || ''}`);
      return;
    }
    if (aiEnabled && customer.email) {
      setGeneratingEmailDraft(true);
      try {
        const draft = await generateQuoteEmailDraft(companyId, {
          customerName: `${customer.first_name} ${customer.last_name}`.trim() || 'Valued Customer',
          quoteNumber: quoteNumber || 'N/A',
          companyName: company?.name || '',
          projectDescription: projectDescription || 'your home improvement project',
          ...emailTierContext(),
          senderName: currentUser?.full_name || undefined,
          senderPhone: currentUser?.phone || company?.phone || undefined,
          senderEmail: currentUser?.email || company?.email || undefined,
        });
        setEmailDraftSubject(draft.subject);
        setEmailDraftBody(draft.body);
      } catch {
        setEmailDraftSubject(`Your Quote from ${company?.name || 'Us'} — Quote #${quoteNumber || ''}`);
        setEmailDraftBody(`Hi ${customer.first_name || 'there'},\n\nYour quote is ready to review. Please click the link to view your proposal.\n\nThank you for considering us for your project!\n\nBest regards,\n${company?.name || ''}`);
      } finally {
        setGeneratingEmailDraft(false);
      }
    } else {
      setEmailDraftSubject(`Your Quote from ${company?.name || 'Us'} — Quote #${quoteNumber || ''}`);
      setEmailDraftBody(`Hi ${customer.first_name || 'there'},\n\nYour quote is ready to review. Please click the link to view your proposal.\n\nThank you!\n\n${company?.name || ''}`);
    }
  };

  const fetchExistingCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').eq('company_id', companyId).order('last_name');
    if (data) setExistingCustomers(data as Customer[]);
  };

  const fetchCompanyPricing = async () => {
    const { data } = await supabase
      .from('company_pricing')
      .select('*')
      .eq('company_id', companyId)
      .eq('list_enabled', true);
    let pricing = data ?? [];

    // Merge personal overrides when the feature is enabled for this user's role
    const isMember = currentUser.role === 'member';
    if (isMember && company.sales_can_edit_pricing) {
      const { data: overrides } = await supabase
        .from('user_pricing_overrides')
        .select('item_name, category, good_price, better_price, best_price')
        .eq('user_id', userId)
        .eq('company_id', companyId);
      if (overrides?.length) {
        const overrideMap = new Map(
          overrides.map(o => [`${o.category}::${o.item_name}`, o])
        );
        pricing = pricing.map(item => {
          const key = `${item.category}::${item.item_name}`;
          const ov = overrideMap.get(key);
          if (!ov) return item;
          return {
            ...item,
            good_price:   ov.good_price   ?? item.good_price,
            better_price: ov.better_price ?? item.better_price,
            best_price:   ov.best_price   ?? item.best_price,
          };
        });
      }
    }

    setCompanyPricing(pricing);
  };

  /**
   * Auto-save a price edit so it becomes the default for future quotes.
   * Members with sales_can_edit_pricing save to user_pricing_overrides (personal only).
   * Owners/admins save to company_pricing (affects the whole team).
   * Debounced 1.5 s per item — rapid keystrokes collapse into one write.
   */
  /**
   * Applies a saved pricing snapshot to this quote and nothing else.
   *
   * Matching is by category + item name, so lines the preset never covered are
   * left exactly as they are. Nothing is written to company_pricing: a preset
   * is a way to re-use numbers, not a way to move the company's price list.
   */
  const handleApplyPricingPreset = useCallback((items: PresetPriceItem[], _presetName: string): number => {
    const byKey = matchPresetItems(items);
    let changed = 0;
    setLineItems(prev => prev.map(li => {
      if ((li as any).is_divider) return li;
      const match = byKey.get(`${(li.category ?? '').trim().toLowerCase()}::${(li.item_name ?? '').trim().toLowerCase()}`);
      if (!match) return li;
      changed += 1;
      return {
        ...li,
        good_price: match.good_price,
        better_price: match.better_price,
        best_price: match.best_price,
      };
    }));
    return changed;
  }, []);

  /**
   * Puts the quote back on the company price list.
   *
   * companyPricing is the effective list for whoever is signed in — the
   * company's rows, with that member's own overrides already merged in — so
   * this is the same pricing a brand new quote would open on.
   */
  const handleRevertToCompanyPricing = useCallback((): number => {
    const byKey = new Map<string, typeof companyPricing[number]>();
    for (const row of companyPricing) {
      byKey.set(`${(row.category ?? '').trim().toLowerCase()}::${(row.item_name ?? '').trim().toLowerCase()}`, row);
    }
    let restored = 0;
    setLineItems(prev => prev.map(li => {
      if ((li as any).is_divider) return li;
      const match = byKey.get(`${(li.category ?? '').trim().toLowerCase()}::${(li.item_name ?? '').trim().toLowerCase()}`);
      if (!match) return li;
      if (li.good_price === match.good_price
        && li.better_price === match.better_price
        && li.best_price === match.best_price) return li;
      restored += 1;
      return {
        ...li,
        good_price: match.good_price,
        better_price: match.better_price,
        best_price: match.best_price,
      };
    }));
    return restored;
  }, [companyPricing]);

  // The total to quote in an email, and what to call it. A single-option quote
  // has no tier to speak of; sending totals.better regardless is what produced
  // an email describing "this better-tier solution" on a Good-only quote.
  const emailTierContext = () => {
    const tiers: Array<{ name: string; total: number }> = [{ name: goodTierName, total: totals.good }];
    if (includeBetter) tiers.push({ name: betterTierName, total: totals.better });
    if (includeBest) tiers.push({ name: bestTierName, total: totals.best });
    return {
      totalAmount: tiers[0].total,
      tierName: tiers.length > 1 ? tiers[0].name : undefined,
      tierCount: tiers.length,
    };
  };

  const handlePriceSave = useCallback((rawItem: LineItem) => {
    // Architectural Shingles displays a per-bundle price (÷3 of the catalog's
    // per-square rate) after a measurement sync. Saving that number straight
    // to the catalog as-is would silently divide the company's real per-sq
    // price by 3 for every future quote — convert back to per-square first so
    // the catalog always stores the same unit it's meant to.
    const item = isShinglePrimaryItem(rawItem) && rawItem.unit === 'bdl'
      ? { ...rawItem, unit: 'sq', good_price: rawItem.good_price * 3, better_price: rawItem.better_price * 3, best_price: rawItem.best_price * 3 }
      : rawItem;
    if (!item.item_name?.trim()) return;
    const isMember = currentUser.role === 'member';
    // Members can only save when the feature is enabled; skip silently otherwise
    if (isMember && !company.sales_can_edit_pricing) return;

    const key = `${item.category}::${item.item_name}`;
    const existing = priceSaveTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      priceSaveTimers.current.delete(key);
      try {
        if (isMember) {
          // Save to personal overrides only — does not affect any other team member
          await supabase.from('user_pricing_overrides').upsert({
            user_id: userId,
            company_id: companyId,
            item_name: item.item_name,
            category: item.category || 'General',
            good_price: item.good_price,
            better_price: item.better_price,
            best_price: item.best_price,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,company_id,category,item_name' });
          // Reflect change in local companyPricing state for the current session
          setCompanyPricing(prev =>
            prev.map(p =>
              p.item_name === item.item_name && p.company_id === companyId
                ? { ...p, good_price: item.good_price, better_price: item.better_price, best_price: item.best_price }
                : p
            )
          );
        } else {
          // Owner/admin path — update the shared company_pricing row
          const row = {
            company_id: companyId,
            category: item.category,
            item_name: item.item_name,
            description: item.description || '',
            unit: item.unit || 'each',
            good_price: item.good_price,
            better_price: item.better_price,
            best_price: item.best_price,
            fixed_price: item.fixed_price ?? false,
            list_enabled: true,
            // Typed by the estimator — this row is now the company's own.
            price_overridden: true,
          };
          const { data: existingRow } = await supabase
            .from('company_pricing')
            .select('id')
            .eq('company_id', companyId)
            .eq('item_name', item.item_name)
            .maybeSingle();
          let saved: CompanyPricing | null = null;
          if (existingRow?.id) {
            const { data } = await supabase
              .from('company_pricing')
              .update(row)
              .eq('id', existingRow.id)
              .select()
              .single();
            saved = data as CompanyPricing;
          } else {
            const { data } = await supabase
              .from('company_pricing')
              .insert(row)
              .select()
              .single();
            saved = data as CompanyPricing;
          }
          if (saved) {
            setCompanyPricing(prev => {
              const idx = prev.findIndex(p => p.item_name === item.item_name && p.company_id === companyId);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = saved!;
                return updated;
              }
              return [...prev, saved!];
            });
          }
        }
      } catch {
        // Silent — don't interrupt quote editing if the save fails
      }
    }, 1500);
    priceSaveTimers.current.set(key, timer);
  }, [companyId, userId, currentUser.role, company.sales_can_edit_pricing]);

  const fetchFileLibrary = async () => {
    setLoadingFiles(true);
    try {
      const files = await loadCompanyFiles(companyId);
      setCompanyFileLibrary(files);
    } catch { /* silent — library may be empty */ } finally {
      setLoadingFiles(false);
    }
  };

  const fetchFinancingOptions = async () => {
    const { data } = await supabase
      .from('financing_options')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sort_order');
    if (data) setAvailableFinancing(data as Array<{
      id: string; lender_name: string; program_name: string | null;
      apr_low: number | null; apr_high: number | null; term_months: number | null; notes: string | null;
    }>);
  };

  // Identifies the primary field/shingle item for per-sq pricing.
  // Matches all major roofing panel types (shingle, architectural, metal, standing seam,
  // corrugated) and excludes accessories that are also measured in squares (hip & ridge
  // cap, starter strip, ice & water, tear-off).  Mirrors the logic in the iOS app.
  const isShinglePrimaryItem = (item: LineItem): boolean => {
    if ((item as any).is_divider) return false;
    // Shingles are usually billed per square, but architectural/field shingles
    // from a measurement import are billed per bundle (3/sq) — accept both.
    if (item.unit !== 'sq' && item.unit !== 'bdl') return false;
    const n = item.item_name.toLowerCase();
    const isPanel =
      n.includes('shingle') ||
      n.includes('architectural') ||
      n.includes('field') ||
      n.includes('metal panel') ||
      n.includes('corrugated') ||
      n.includes('standing seam');
    const isAccessory =
      n.includes('hip') ||
      n.includes('ridge') ||
      n.includes('starter') ||
      n.includes('cap') ||
      n.includes('tear');
    return isPanel && !isAccessory;
  };

  /**
   * Squares behind an import, taken from the shingle line — the same line the
   * all-in per-sq mode targets, so both modes measure the roof the same way.
   * A bundle-billed shingle item is 3 bundles to the square.
   */
  const totalSquaresFromImport = (items: LineItem[]): number => {
    const idx = items.findIndex(i => isShinglePrimaryItem(i));
    const fallback = items.findIndex(i => !(i as any).is_divider && i.unit === 'sq');
    const target = idx >= 0 ? idx : fallback;
    if (target < 0) return 0;
    const qty = items[target].quantity ?? 0;
    return items[target].unit === 'bdl' ? qty / 3 : qty;
  };


  // Apply company pricing overrides to a set of line items.
  // Only overrides a price when the company's value is > 0 — a $0 company
  // entry means "not configured yet" and should fall back to the template price.
  const applyCompanyPricing = (items: LineItem[]): LineItem[] => {
    // Build a flat lookup of default catalog prices (used as last-resort fallback)
    const allDefaults = Object.values(defaultLineItems).flat();

    // Tier ladders: Good/Better/Best pull *different products* from the material
    // list, each at its own preset price. The company's own library wins over the
    // seeded one so a repriced copper flashing is the number that gets used.
    const ownedLookup = makeRungLookup(companyPricing.map(p => ({
      item_name: p.item_name, unit: p.unit,
      good_price: p.good_price, better_price: p.better_price, best_price: p.best_price,
    })));
    const seededLookup = makeRungLookup(DEFAULT_PRICE_LIST);
    const rungLookup = (name: string) => ownedLookup(name) ?? seededLookup(name);

    return items.map(item => {
      // A ladder replaces the whole tier picture for this line: three products,
      // three preset prices. Skipped silently when a rung is missing or the
      // rungs disagree on unit, leaving the line untouched.
      if (!(item as any).is_divider) {
        const ladder = resolveTierLadder(item.item_name, rungLookup);
        // Only when the ladder prices in the same unit the line is billed in.
        // A per-lf rung applied to a line counted in 10ft sticks would be wrong
        // by a factor of ten.
        if (ladder && ladder.unit === item.unit) {
          return {
            ...item,
            unit: ladder.unit,
            good_product: ladder.good_product,
            better_product: ladder.better_product,
            best_product: ladder.best_product,
            good_price: ladder.good_price,
            better_price: ladder.better_price,
            best_price: ladder.best_price,
          };
        }
      }
      return item;
    }).map(item => {
      const override = companyPricing.find(
        p => p.category === item.category && p.item_name === item.item_name
      );
      if (override) {
        // In per-tier mode, items are tagged with which tier they belong to.
        // Only apply a company price override for tiers this item participates in —
        // never overwrite a deliberately-zeroed price for a tier the item doesn't own.
        const ta = item.tiers_applicable;
        const inGood   = !ta?.length || ta.includes('good');
        const inBetter = !ta?.length || ta.includes('better');
        const inBest   = !ta?.length || ta.includes('best');
        return {
          ...item,
          good_price:   inGood   && override.good_price   > 0 ? override.good_price   : item.good_price,
          better_price: inBetter && override.better_price > 0 ? override.better_price : item.better_price,
          best_price:   inBest   && override.best_price   > 0 ? override.best_price   : item.best_price,
          unit: override.unit || item.unit,
          description: override.description || item.description,
          fixed_price: override.fixed_price ?? false,
          // A library item flagged internal-only (labor) stays internal on the
          // quote unless the estimator explicitly reveals it.
          hidden_from_customer: item.hidden_from_customer ?? (override as any).hidden_from_customer ?? false,
        };
      }
      // No company pricing match — if the item still has $0 prices, fall back to
      // the built-in default catalog so templates with unpriced items get reasonable prices.
      if (item.good_price === 0 && item.better_price === 0 && item.best_price === 0) {
        const def = allDefaults.find(
          d => d.item_name.toLowerCase() === item.item_name.toLowerCase()
        );
        if (def && (def.good_price > 0 || def.better_price > 0 || def.best_price > 0)) {
          return {
            ...item,
            good_price:   def.good_price   > 0 ? def.good_price   : item.good_price,
            better_price: def.better_price > 0 ? def.better_price : item.better_price,
            best_price:   def.best_price   > 0 ? def.best_price   : item.best_price,
          };
        }
      }
      return item;
    });
  };

  const loadQuote = async (id: string) => {
    setLoading(true);
    try {
      const { data: quote } = await supabase.from('quotes').select('*, customer:customers(*)').eq('id', id).single();
      if (quote) {
        setQuoteNumber(quote.quote_number || '');
        setExistingStatus(quote.status || null);
        setSavedDraftEmail({
          subject: (quote as any).last_sent_subject ?? null,
          message: (quote as any).last_sent_message ?? null,
          ccEmails: (quote as any).last_sent_cc_emails ?? null,
        });
        if (quote.customer) {
          setCustomer(quote.customer);
          setSelectedCustomerId(quote.customer_id);
        }
        setProjectType(quote.project_type);
        if (quote.quote_structure_type) setQuoteStructureType(quote.quote_structure_type as QuoteStructureType);
        // Inspection reports default contingency ON; treat null (pre-column) as true
        setContingencyEnabled(
          quote.project_type === 'inspection_report'
            ? quote.contingency_enabled !== false
            : quote.contingency_enabled === true
        );
        setCompletionCertificateEnabled((quote as any).completion_certificate_enabled === true);
        if ((quote as any).deposit_amount) setDepositAmount(String((quote as any).deposit_amount));
        if ((quote as any).deposit_due_date) setDepositDueDate((quote as any).deposit_due_date);
        if (quote.manual_good_total && quote.quote_structure_type === 'insurance_invoice') setInvoiceTotal(String(quote.manual_good_total));
        setProjectDescription(quote.project_description || '');
        setCoverPageTitle(quote.cover_page_title || 'Home Restoration Proposal');
        setCoverPhotoUrl(quote.cover_photo_url || '');
        setCoverPhotoZoom((quote as any).cover_photo_zoom ?? 1);
        setCoverPhotoOffsetX((quote as any).cover_photo_offset_x ?? 50);
        setCoverPhotoOffsetY((quote as any).cover_photo_offset_y ?? 50);
        // Default to including all sections unless explicitly disabled by the user.
        setIncludeAbout(quote.include_about_page !== false);
        setIncludeWarranty(quote.include_warranty_page !== false);
        setIncludeCancel(quote.include_cancel_notice !== false);
        setIncludeBetter(quote.include_better !== false);
        setIncludeBest(quote.include_best !== false);
        setShowLineItemPrices(quote.show_line_item_prices !== false);
        setShowSectionTotals(quote.show_section_totals !== false);
        setShowUpgradePrices(quote.show_upgrade_prices !== false);
        setUseManualTotals(quote.use_manual_totals === true);
        setManualGoodTotal(quote.manual_good_total ?? 0);
        setManualBetterTotal(quote.manual_better_total ?? 0);
        setManualBestTotal(quote.manual_best_total ?? 0);
        setTierPhotoGood(quote.tier_photo_good || '');
        setTierPhotoBetter(quote.tier_photo_better || '');
        setTierPhotoBest(quote.tier_photo_best || '');
        setTierDescGood(quote.tier_desc_good || '');
        setTierDescBetter(quote.tier_desc_better || '');
        setTierDescBest(quote.tier_desc_best || '');
        setQuoteStyle(quote.quote_style === 'classic' ? 'classic' : 'professional');
        setGoodTierName(quote.good_tier_name || 'Good');
        setBetterTierName(quote.better_tier_name || 'Better');
        setBestTierName(quote.best_tier_name || 'Best');
        // Restore markup % so the slider shows the correct value and the
        // auto-50% guards don't mis-fire on re-open (prices already have it baked in).
        setQuoteCreatedAt((quote as any).created_at ?? null);
        // Clamp on load too — a stored out-of-range markup would otherwise
        // corrupt prices the first time the markup changed.
        const savedAdj = Math.min(200, Math.max(0, (quote as any).price_adj_pct ?? 0));
        priceAdjPctRef.current = savedAdj;
        setPriceAdjPct(savedAdj);
        setMeasurementProvider(quote.measurement_provider || null);
        setMeasurementSourceName(quote.measurement_source_name || null);
        setMeasurementData(quote.measurement_data || null);
        setMeasurementReportUrl(quote.measurement_report_url || null);
        setIncludeReportWithQuote(quote.include_measurement_report ?? false);
        setUsePerTierItems(quote.use_per_tier_items === true);
        if ((quote.measurement_provider === 'roofr' || quote.measurement_provider === 'eagleview') && quote.measurement_data) {
          const savedRoofrReport = quote.measurement_data as RoofrParsedReport;
          setRoofrReport(savedRoofrReport);
          setRoofrFileName(quote.measurement_source_name || (quote.measurement_provider === 'eagleview' ? 'EagleView Report' : 'Roofr Report'));
          setRoofrImportMode(savedRoofrReport.importMode || 'combined');
          setRoofrStructureScope('all');
        } else if (quote.measurement_provider === 'eagleview-solar' && quote.measurement_data) {
          setSolarReport(quote.measurement_data as EagleViewSolarReport);
          setSolarFileName(quote.measurement_source_name || 'EagleView Solar Report');
          setImportScope('solar');
        } else if (quote.measurement_provider === 'manual' && quote.measurement_data) {
          // Restore manual measurement inputs so the user sees what they previously entered
          const m = quote.measurement_data as Record<string, unknown>;
          if (m.squares)   setManualSquares(String(m.squares));
          if (m.eaves)     setManualEaves(String(m.eaves));
          if (m.rakes)     setManualRakes(String(m.rakes));
          if (m.ridge)     setManualRidge(String(m.ridge));
          if (m.hips)      setManualHips(String(m.hips));
          if (m.valleys)   setManualValleys(String(m.valleys));
          if (m.pipeBoots) setManualPipeBoots(String(m.pipeBoots));
          if (m.waste !== undefined) setManualWaste(m.waste as number);
          if (m.pricingMode) setManualPricingMode(m.pricingMode as 'standard' | 'per-sq');
          if (m.perSqGoodRate)   setManualPerSqGoodRate(String(m.perSqGoodRate));
          if (m.perSqBetterRate) setManualPerSqBetterRate(String(m.perSqBetterRate));
          if (m.perSqBestRate)   setManualPerSqBestRate(String(m.perSqBestRate));
          // Restore per-tier/scope measurement pools
          if (m.tierMeasurementPools && typeof m.tierMeasurementPools === 'object') {
            setTierMeasurementPools(m.tierMeasurementPools as Record<string, any>);
          }
          if (m.manualMeasureTier) {
            const restored = m.manualMeasureTier as 'all' | 'good' | 'better' | 'best';
            // When per-tier-items mode is on each tier is a separate project — don't
            // restore 'all' (it would make the Save button show "Apply to All Tiers").
            setManualMeasureTier(
              restored === 'all' && (m.usePerTierItems ?? usePerTierItems) ? 'good' : restored
            );
          }
          if (m.manualTargetOptionId) setManualTargetOptionId(m.manualTargetOptionId as string);
          setRoofrReport(null);
          setRoofrFileName('');
          setRoofrImportMode('combined');
          setRoofrStructureScope('all');
        } else {
          setRoofrReport(null);
          setRoofrFileName('');
          setRoofrImportMode('combined');
          setRoofrStructureScope('all');
        }
        setNotes(quote.notes || '');
        setSalesRepPhotoUrl((quote as any).sales_rep_photo_url || currentUser?.avatar_url || '');
        setSalesRepPhotoZoom((quote as any).sales_rep_photo_zoom ?? 1);
        setSalesRepPhotoOffsetX((quote as any).sales_rep_photo_offset_x ?? 50);
        setSalesRepPhotoOffsetY((quote as any).sales_rep_photo_offset_y ?? 50);
        const selectedPages =
          Array.isArray(quote.selected_custom_pages) && quote.selected_custom_pages.length > 0
            ? quote.selected_custom_pages
            : quote.include_custom_page && (quote.custom_page_title || quote.custom_page_body || quote.custom_page_file_url)
              ? [
                {
                  id: `legacy-${id}`,
                  title: quote.custom_page_title || 'Custom Information',
                  body: quote.custom_page_body || '',
                  attachments: quote.custom_page_file_url
                    ? [
                      {
                        id: `legacy-attachment-${id}`,
                        url: quote.custom_page_file_url,
                        name: quote.custom_page_file_name || 'Attachment',
                        type: quote.custom_page_file_type || 'application/octet-stream',
                      },
                    ]
                    : [],
                },
              ]
              : [];
        setSelectedCustomPages(selectedPages);
      }

      setAttachedFiles(Array.isArray((quote as any).attached_files) ? (quote as any).attached_files : []);
      setIncludeBrochures((quote as any).include_brochures !== false);
      setUpgrades(Array.isArray((quote as any)?.upgrades) ? (quote as any).upgrades : []);

      const [{ data: items }, { data: optionsData }, { data: photoData }] = await Promise.all([
        supabase.from('quote_line_items').select('*').eq('quote_id', id).order('sort_order'),
        supabase.from('quote_options').select('*').eq('quote_id', id).order('sort_order'),
        supabase.from('quote_photos').select('*').eq('quote_id', id).order('sort_order'),
      ]);

      if (items) {
        // When per-tier mode is on, items without an explicit tiers_applicable tag
        // are treated as "shared" by calculateTotals() and counted in ALL three tier
        // totals — inflating every tier.  Apply the same default-to-'good' logic that
        // the toggle handler uses so that untagged items (saved before per-tier existed,
        // or created outside per-tier flow) don't pollute the better/best totals.
        const loadedItems = (quote.use_per_tier_items === true)
          ? (items as LineItem[]).map(item =>
              item.tiers_applicable?.length
                ? item
                : { ...item, tiers_applicable: ['good'] as string[] }
            )
          : (items as LineItem[]);
        setLineItems(loadedItems);
        // Re-derive per-tier labels from the loaded items
        const tierCounts = { good: 0, better: 0, best: 0 };
        loadedItems.forEach(item => {
          if (item.tiers_applicable?.includes('good')) tierCounts.good++;
          if (item.tiers_applicable?.includes('better')) tierCounts.better++;
          if (item.tiers_applicable?.includes('best')) tierCounts.best++;
        });
        setPerTierLabels({
          good: tierCounts.good > 0 ? `${tierCounts.good} items` : null,
          better: tierCounts.better > 0 ? `${tierCounts.better} items` : null,
          best: tierCounts.best > 0 ? `${tierCounts.best} items` : null,
        });
      }

      if (optionsData && optionsData.length > 0) {
        const opts = optionsData as QuoteOption[];
        setQuoteOptions(opts);
        setActiveOptionId(opts[0].id);
        const structureType = (quote as any).quote_structure_type || 'tiered';
        setQuoteStructureType(structureType);

        // Restore scope configs for multi-scope quotes so Project Details shows correct scope names
        if (structureType === 'multi_scope') {
          const savedScopeTemplateIds: (string | null)[] =
            Array.isArray((quote as any).scope_template_ids)
              ? (quote as any).scope_template_ids
              : [];
          setScopeConfigs(opts.map((opt, i) => ({
            name: opt.name,
            templateId: savedScopeTemplateIds[i] || null,
            roofBrand: null,
            sidingBrand: null,
          })));
        }
      }

      // Restore which template was selected — so Project Details highlights it when user returns
      setSelectedTemplateId((quote as any).selected_template_id || null);

      // Restore per-tier template dropdown selections
      setPerTierPending({
        good:   (quote as any).good_template_id   || '',
        better: (quote as any).better_template_id || '',
        best:   (quote as any).best_template_id   || '',
      });

      // Restore per-tier template labels if saved; fall back to item counts derived above
      if ((quote as any).per_tier_template_labels) {
        const saved = (quote as any).per_tier_template_labels as { good?: string | null; better?: string | null; best?: string | null };
        setPerTierLabels(prev => ({
          good:   saved.good   ?? prev.good,
          better: saved.better ?? prev.better,
          best:   saved.best   ?? prev.best,
        }));
      }

      if (photoData) setPhotos(photoData as QuotePhoto[]);
    } catch (err) {
      toast.error('Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const selectExistingCustomer = (c: Customer) => {
    setCustomer(c);
    setSelectedCustomerId(c.id);
    setShowCustomerSearch(false);
  };

  // Unticking Better or Best while it is the selected target would leave the
  // selection pointing at a tier that is no longer shown or priceable.
  React.useEffect(() => {
    const gone =
      quoteStructureType === 'multi_scope' ||
      (targetTier === 'better' && !includeBetter) ||
      (targetTier === 'best' && !includeBest);
    if (gone && targetTier !== 'good') setTargetTier('good');
  }, [targetTier, includeBetter, includeBest, quoteStructureType]);

  const calculateTotals = () => {
    // When per-tier mode is active, only count items tagged to each tier so that
    // good/better/best totals stay isolated — no cross-tier bleed.
    const tierFilter = (tier: 'good' | 'better' | 'best') => (item: LineItem) =>
      !usePerTierItems ||
      !item.tiers_applicable?.length ||
      item.tiers_applicable.includes(tier);

    const good   = lineItems.filter(tierFilter('good'))  .reduce((sum, item) => sum + item.quantity * item.good_price,   0);
    const better = lineItems.filter(tierFilter('better')).reduce((sum, item) => sum + item.quantity * item.better_price, 0);
    const best   = lineItems.filter(tierFilter('best'))  .reduce((sum, item) => sum + item.quantity * item.best_price,   0);
    return { good, better, best };
  };

  const mapTemplateToLineItems = (template: QuoteProjectTemplate) => {
    const timestampSeed = Date.now();
    return template.lineItems.map((item, index) => ({
      id: `temp-${timestampSeed}-${index}`,
      quote_id: '',
      category: item.category,
      item_name: item.item_name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity ?? 1,
      good_price: item.good_price,
      better_price: item.better_price,
      best_price: item.best_price,
      sort_order: index,
    }));
  };

  const METAL_WASTE_DEFAULTS: Record<string, number> = {
    'corrugated-metal-roof': 15,
    'standing-seam-metal-roof': 12,
  };

  const applyProjectTemplate = (template: QuoteProjectTemplate) => {
    setProjectType(template.projectType);
    setCoverPageTitle(template.coverPageTitle);
    setProjectDescription(template.projectDescription);
    setSelectedTemplateId(template.id);
    // Auto-set metal-appropriate waste % when a metal template is selected
    const metalWaste = METAL_WASTE_DEFAULTS[template.id];
    if (metalWaste !== undefined) {
      setRoofrWastePercent(metalWaste);
      setCustomWasteInput(String(metalWaste));
    }
    // Single-template always clears per-tier mode and resets tier labels
    setUsePerTierItems(false);
    setPerTierLabels({ good: null, better: null, best: null });
    const baseItems = applyCompanyPricing(mapTemplateToLineItems(template));
    // Auto-apply 50% labor & profit markup on first load only when there is no
    // company pricing set up. If the company has pricing configured those prices
    // already include the desired margin (same as Strike Mode), so no markup is added.
    const hasCompanyPricing = companyPricing.length > 0;
    const shouldApplyDefaultMarkup = priceAdjPctRef.current === 0 && !hasCompanyPricing;
    const newItems = shouldApplyDefaultMarkup
      ? baseItems.map(item => ({
          ...item,
          good_price:   Math.round(item.good_price   * 1.5 * 100) / 100,
          better_price: Math.round(item.better_price * 1.5 * 100) / 100,
          best_price:   Math.round(item.best_price   * 1.5 * 100) / 100,
        }))
      : baseItems;
    if (shouldApplyDefaultMarkup) {
      priceAdjPctRef.current = 50;
      setPriceAdjPct(50);
    }
    // Multi-scope: assign items to the active scope option
    if (quoteOptions.length > 0 && activeOptionId && quoteStructureType === 'multi_scope') {
      setLineItemsWithHistory(newItems.map(item => ({
        ...item,
        quote_option_id: activeOptionId,
        price: item.good_price,
      })));
    } else {
      setLineItemsWithHistory(newItems);
    }
    toast.success(`${template.name} loaded — customize below or click Next.`);
  };

  // Append a section from a template without replacing existing items
  const appendTemplateSection = (template: QuoteProjectTemplate) => {
    const newItems = applyCompanyPricing(mapTemplateToLineItems(template));
    if (quoteOptions.length > 0 && activeOptionId && quoteStructureType === 'multi_scope') {
      // Multi-scope: tag items with active scope's option id
      setLineItemsWithHistory(prev => {
        const scopeCount = prev.filter(x => x.quote_option_id === activeOptionId).length;
        return [
          ...prev,
          ...newItems.map((item, i) => ({
            ...item,
            quote_option_id: activeOptionId,
            price: item.good_price,
            sort_order: scopeCount + i,
          })),
        ];
      });
    } else if (usePerTierItems) {
      // Per-tier: tag items with the active tier so they only appear in the right tier
      const tier = perTierEditorTab;
      setLineItemsWithHistory(prev => {
        const tierCount = prev.filter(x => x.tiers_applicable?.includes(tier)).length;
        return [
          ...prev,
          ...newItems.map((item, i) => ({
            ...item,
            tiers_applicable: [tier],
            good_price:   tier === 'good'   ? item.good_price : 0,
            better_price: tier === 'better' ? item.good_price : 0,
            best_price:   tier === 'best'   ? item.good_price : 0,
            sort_order: tierCount + i,
          })),
        ];
      });
    } else {
      setLineItemsWithHistory(prev => [
        ...prev,
        ...newItems.map((item, i) => ({ ...item, sort_order: prev.length + i })),
      ]);
    }
    setShowAddSection(false);
    toast.success(`"${template.name}" section added.`);
  };

  // Load a template into a specific tier, replacing any existing items for that tier.
  // In multi_scope mode, pass scopeOptionId so items get quote_option_id set for the
  // Option-Based Editor which filters by quote_option_id.
  const loadTemplateForTier = (tier: 'good' | 'better' | 'best', template: QuoteProjectTemplate, scopeOptionId?: string) => {
    const timestampSeed = Date.now();
    // Auto-apply 50% default markup on the first template loaded only when there is
    // no company pricing — if company pricing is configured those rates already include margin.
    if (priceAdjPctRef.current === 0 && companyPricing.length === 0) {
      priceAdjPctRef.current = 50;
      setPriceAdjPct(50);
    }
    // Apply the baked-in markup so all scopes are priced consistently.
    // Order matters: company pricing must run BEFORE markup so the markup
    // stacks on top of company rates.  Also, tiers_applicable must NOT be set
    // before applyCompanyPricing — setting it to ['better'] would cause
    // inGood=false inside applyCompanyPricing, skipping good_price updates
    // (the only active column in multi_scope mode).
    const markup = priceAdjPctRef.current;
    const applyMarkup = (p: number) => markup > 0 ? Math.round(p * (1 + markup / 100) * 100) / 100 : p;

    // Step 1: map raw template prices, no tier tags yet
    const rawItems: LineItem[] = template.lineItems.map((item, index) => ({
      id: `temp-${timestampSeed}-${index}`,
      quote_id: '',
      category: item.category,
      item_name: item.item_name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity ?? 1,
      // Multi-scope: all items use good_price (editor fixed to activeTier="good").
      // Per-tier: place price in the appropriate column only.
      good_price:   scopeOptionId ? item.good_price : (tier === 'good'   ? item.good_price   : 0),
      better_price: scopeOptionId ? 0               : (tier === 'better' ? (item.better_price || item.good_price) : 0),
      best_price:   scopeOptionId ? 0               : (tier === 'best'   ? (item.best_price   || item.good_price) : 0),
      sort_order: index,
    }));

    // Step 2: apply company pricing (no tier tag set yet → inGood/inBetter/inBest all true)
    const pricedItems = applyCompanyPricing(rawItems);

    // Step 3: apply markup then add tier/scope tags
    const newItems: LineItem[] = pricedItems.map(item => ({
      ...item,
      good_price:   applyMarkup(item.good_price),
      better_price: applyMarkup(item.better_price),
      best_price:   applyMarkup(item.best_price),
      tiers_applicable: [tier] as ('good' | 'better' | 'best')[],
      ...(scopeOptionId ? { quote_option_id: scopeOptionId, price: applyMarkup(item.good_price) } : {}),
    }));

    // Build a set of category+unit+name slots that the new template occupies,
    // so shared (measurement-generated) items that duplicate those slots can be
    // removed.  This prevents "Architectural Shingles" from bleeding into a
    // corrugated/standing-seam scope when measurements were imported first.
    const SHARED_MATERIAL_ALIASES = [
      'architectural shingles', 'field shingles', 'shingles', '3-tab shingles',
    ];
    const templateCatUnitSlots = new Set(
      newItems.map(i => `${i.category.toLowerCase()}|${i.unit}`)
    );

    setLineItemsWithHistory(prev => {
      // Drop any existing items for this tier/scope; keep others
      const kept = prev.filter(item => {
        if (scopeOptionId) {
          return item.quote_option_id !== scopeOptionId;
        }
        const ta = item.tiers_applicable;
        if (ta && ta.length > 0 && ta.includes(tier)) return false;
        // Drop shared (untagged) items whose category+unit slot is now covered by
        // the new template — prevents duplicate primary-material rows across scopes.
        const isShared = !ta || ta.length === 0;
        if (isShared && SHARED_MATERIAL_ALIASES.includes(item.item_name.toLowerCase().trim())) {
          if (templateCatUnitSlots.has(`${item.category.toLowerCase()}|${item.unit}`)) return false;
        }
        return true;
      });
      return [
        ...kept,
        ...newItems.map((item, i) => ({ ...item, sort_order: kept.length + i })),
      ];
    });

    // Auto-set metal-appropriate waste % when a metal template is loaded for a tier
    const metalWasteForTier = METAL_WASTE_DEFAULTS[template.id];
    if (metalWasteForTier !== undefined) {
      setRoofrWastePercent(metalWasteForTier);
      setCustomWasteInput(String(metalWasteForTier));
    }
    const tierLabel = tier === 'good' ? goodTierName : tier === 'better' ? betterTierName : bestTierName;
    setPerTierLabels(prev => ({ ...prev, [tier]: template.name }));
    toast.success(`"${template.name}" loaded for ${tierLabel} tier — ${newItems.length} items added.`);
  };

  // Add a blank custom section — must be tagged to the active scope/tier so it's visible
  const addCustomSection = (sectionName: string) => {
    if (!sectionName.trim()) return;
    // Determine the correct tag so the item appears in the right scope/tier view
    const scopeOptionId = quoteStructureType === 'multi_scope' && activeOptionId ? activeOptionId : null;
    const tierTag: string[] | undefined = usePerTierItems ? [perTierEditorTab] : undefined;
    const blankItem: LineItem = {
      id: `temp-${Date.now()}`,
      quote_id: '',
      category: sectionName.trim(),
      item_name: 'New Item',
      description: '',
      unit: 'lot',
      quantity: 1,
      good_price: 0,
      better_price: 0,
      best_price: 0,
      sort_order: lineItems.length,
      ...(scopeOptionId ? { quote_option_id: scopeOptionId, price: 0 } : {}),
      ...(tierTag ? { tiers_applicable: tierTag } : {}),
    };
    setLineItemsWithHistory(prev => [...prev, blankItem]);
    setShowAddSection(false);
    setAddSectionName('');
    toast.success(`"${sectionName}" section added.`);
  };

  const normalizeSortOrder = (items: LineItem[]) =>
    items.map((item, index) => ({ ...item, sort_order: index }));

  const handleSalesRepPhotoUpload = async (file: File) => {
    setUploadingSalesRepPhoto(true);
    const toastId = toast.loading('Uploading photo…');
    try {
      const compressed = await compressImage(file, COMPRESS_PRESETS.salesRepPhoto);
      const path = `${companyId}/rep-photo-${Date.now()}.jpg`;

      // Race the upload against a 20 s timeout so the spinner never hangs
      // indefinitely on a slow connection or cold Supabase Storage edge.
      const uploadResult = await Promise.race([
        supabase.storage.from('quote-photos').upload(path, compressed, {
          contentType: 'image/jpeg',
          cacheControl: STORAGE_CACHE_CONTROL,
          upsert: true,
        }),
        new Promise<{ error: Error }>((_resolve, reject) =>
          setTimeout(() => reject(new Error('Upload timed out — please try again.')), 20_000)
        ),
      ]);

      if ('error' in uploadResult && uploadResult.error) throw uploadResult.error;

      const { data: urlData } = supabase.storage.from('quote-photos').getPublicUrl(path);
      setSalesRepPhotoUrl(urlData.publicUrl);
      setSalesRepPhotoZoom(1);
      setSalesRepPhotoOffsetX(50);
      setSalesRepPhotoOffsetY(50);
      toast.success('Photo uploaded', { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload photo. Please try again.', { id: toastId });
    } finally {
      setUploadingSalesRepPhoto(false);
    }
  };

  const handleRoofrFile = async (file: File, opts?: { fromStored?: boolean }) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a Roofr or EagleView PDF report.');
      return;
    }

    setParsingRoofr(true);
    try {
      const parsed = await parseRoofrPdfReport(file);
      // Only fail if we have absolutely no usable measurement data
      if (!parsed.reportSummary && parsed.structures.length === 0 && parsed.totalRoofAreaSqft === 0) {
        throw new Error('Could not read measurement data from this PDF. Please upload a Roofr or EagleView measurement report.');
      }

      setRoofrReport(parsed);
      setRoofrFileName(file.name);
      setRoofrStructureScope('all'); // reset to combined total on new upload
      setRoofrImportMode('combined');
      // Upload original PDF to storage so it can be shared with the customer
      try {
        const storageFileName = `${companyId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: uploadErr } = await supabase.storage
          .from('signed-quotes')
          .upload(`reports/${storageFileName}`, file, { contentType: 'application/pdf', upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('signed-quotes').getPublicUrl(`reports/${storageFileName}`);
          setMeasurementReportUrl(urlData.publicUrl);
        }
      } catch { /* non-fatal */ }
      // Auto-select the provider's suggested waste % if available
      if (parsed.suggestedWastePercent !== undefined) {
        setRoofrWastePercent(parsed.suggestedWastePercent as 0 | 10 | 12 | 15);
        setCustomWasteInput(String(parsed.suggestedWastePercent));
      }
      const source = parsed.source === 'eagleview' ? 'EagleView' : 'Roofr';
      toast.success(`${source} report imported.`);
      if (!opts?.fromStored) void saveMeasurementReportToCustomer(file, companyId, selectedCustomerId);
    } catch (error: any) {
      console.error('Measurement report parse failed:', error);
      toast.error(error?.message || 'Failed to parse measurement report.');
    } finally {
      setParsingRoofr(false);
    }
  };

  /**
   * Merges measurement-derived items into the existing line item list.
   * - Existing items that match a measured item (by category + item_name) get
   *   their quantity, prices, and description updated from the measurement.
   * - Existing items with no matching measurement get quantity=0 so they
   *   contribute $0 to the quote but remain visible for manual adjustment.
   * - Measured items not already in the list are appended at the end.
   *
   * Alias normalization: "Field Shingles" and "Architectural Shingles" are
   * treated as the same item so re-importing measurements never produces
   * duplicate shingle rows.
   */
  const syncMeasuredItems = (
    existingItems: LineItem[],
    measuredItems: LineItem[],
    // When true (per-tier calls): items are consumed normally so no extras are
    // appended to the result.  When false (shared single-map call): tier-specific
    // items keep the slot open so all three tiers can each pick up the same qty.
    consumeEntries: boolean = false,
    // Tier this call is syncing (only meaningful when consumeEntries is true).
    // Any measured item that doesn't match an existing template item is still
    // appended — tagged to this tier — instead of being silently discarded.
    // Omit for the "shared" call so genuinely shared extras stay untagged.
    appendTier?: 'good' | 'better' | 'best',
    // When true: only quantities (and unit) are taken from the measured items;
    // prices already on the existing items are never touched.  Use this when
    // applying an *additional* report so supplemental measurements don't
    // overwrite custom or per-tier prices the user has already set.
    preservePrices: boolean = false,
  ): LineItem[] => {
    // Map common historical aliases to the canonical name so that old quotes
    // using "Field Shingles" or "Synthetic Underlayment" merge correctly with
    // measurement imports that generate the standardized canonical names.
    const ITEM_ALIASES: Record<string, string> = {
      'field shingles': 'architectural shingles',
      'shingles': 'architectural shingles',
      'synthetic underlayment': 'underlayment / leak barrier',
    };
    const normalizeKey = (category: string, name: string) => {
      const n = name.toLowerCase().trim();
      return `${category.toLowerCase()}\t${ITEM_ALIASES[n] ?? n}`;
    };

    // Category-type groups: when exact name doesn't match (e.g. template has a
    // specific product name like "GAF Timberline HDZ – Charcoal" while the
    // measurement import uses the canonical "Architectural Shingles"), fall back
    // to matching by *type group*.  Each group lists keywords that appear in the
    // template item's CATEGORY and the canonical NAMES used by measurement imports.
    const TYPE_GROUPS: { catKeys: string[]; measureNames: string[] }[] = [
      // ── Roofing ──────────────────────────────────────────────────────────────
      { catKeys: ['decking', 'sheathing', 'osb', 'cdx', 'plywood deck'], measureNames: ['roof decking', 'decking repair', 'roof deck repair', 'roof deck inspection'] },
      { catKeys: ['shingles', '3-tab'],           measureNames: ['architectural shingles', 'field shingles', 'shingles'] },
      { catKeys: ['starter'],                     measureNames: ['starter strip', 'starter'] },
      { catKeys: ['ridge cap', 'hip & ridge', 'hip and ridge'], measureNames: ['hip & ridge cap', 'hip and ridge cap', 'ridge cap'] },
      { catKeys: ['underlayment'],                measureNames: ['underlayment / leak barrier', 'underlayment'] },
      { catKeys: ['ice & water', 'ice and water'], measureNames: ['ice & water shield', 'ice and water shield', 'ice & water'] },
      { catKeys: ['drip edge'],                   measureNames: ['drip edge'] },
      { catKeys: ['ventilation', 'ridge vent'],   measureNames: ['ridge vent', 'ventilation'] },
      { catKeys: ['pipe', 'boot'],                measureNames: ['pipe boot', 'pipe flashing', 'pipe boots'] },
      { catKeys: ['step flashing'],               measureNames: ['step flashing'] },
      { catKeys: ['valley'],                      measureNames: ['valley metal', 'valley flashing'] },
      { catKeys: ['fastener', 'nail', 'screw', 'clip'],  measureNames: ['roofing nails', 'coil nails', 'cap nails', 'nails', 'nails & fasteners', 'metal roofing screws & sealant', 'concealed fastener clips & closures'] },
      { catKeys: ['tear off', 'tearoff'],         measureNames: ['tear off existing roof', 'tear off', 'tear-off existing roof'] },
      // ── Siding ───────────────────────────────────────────────────────────────
      { catKeys: ['vinyl', 'fiber cement', 'hardie', 'smartside', 'lp smart', 'wood siding', 'cedar', 'siding installation', 'siding material'], measureNames: ['vinyl siding', 'fiber cement siding', 'siding installation', 'siding'] },
      { catKeys: ['house wrap', 'weather barrier', 'building wrap', 'moisture barrier'], measureNames: ['house wrap', 'house wrap / weather barrier', 'building wrap', 'moisture barrier'] },
      { catKeys: ['siding removal'],              measureNames: ['siding removal'] },
      { catKeys: ['j-channel', 'j channel', 'j trim'], measureNames: ['j-channel', 'j channel', 'j-trim'] },
      { catKeys: ['inside corner'],               measureNames: ['inside corners', 'inside corner', 'interior corner'] },
      { catKeys: ['outside corner', 'exterior corner'], measureNames: ['outside corners', 'outside corner', 'exterior corner'] },
      { catKeys: ['window trim', 'door trim', 'trim casing', 'window & door trim'], measureNames: ['window & door trim', 'window trim', 'door trim', 'trim casing'] },
      { catKeys: ['siding caulk', 'siding sealant'], measureNames: ['siding caulk / sealant', 'caulk / sealant', 'caulk', 'sealant'] },
      // ── Gutters ──────────────────────────────────────────────────────────────
      { catKeys: ['seamless', 'aluminum gutter', 'k-style', 'box gutter', 'half-round gutter', 'copper gutter', 'gutter material', 'gutter installation'], measureNames: ['5 aluminum gutter – seamless (per lf)', '6 aluminum gutter – seamless (per lf)', 'seamless aluminum gutter', 'aluminum gutter', 'gutter', 'box gutter (per lf)'] },
      { catKeys: ['downspout material', 'aluminum downspout', '2x3 downspout', '3x4 downspout'], measureNames: ['2x3 aluminum downspout', '3x4 aluminum downspout', '5 aluminum downspout – 2x3 (per lf)', '6 aluminum downspout – 3x4 (per lf)', 'aluminum downspout', 'downspout'] },
      { catKeys: ['gutter guard', 'leaf guard', 'micro-mesh guard'], measureNames: ['standard aluminum gutter guard', 'leaf guard (aluminum mesh)', 'leaf guard (solid cover)', 'premium micro-mesh gutter guard', 'gutter guard', 'guards'] },
    ];

    const findGroupForMeasured = (name: string) => {
      const n = name.toLowerCase();
      return TYPE_GROUPS.find(g => g.measureNames.some(mn => n === mn || n.includes(mn)));
    };

    // findGroupForTemplate also accepts the item's unit so it can fall back to
    // unit-based matching when all template items share the generic "Roofing"
    // category and the product name doesn't embed the material type
    // (e.g. "CertainTeed Landmark" won't match catKey "shingles" by name).
    const findGroupForTemplate = (category: string, name: string, unit?: string) => {
      const c = category.toLowerCase();
      const n = name.toLowerCase();
      const u = (unit ?? '').toLowerCase();
      // Primary: category or known measurement-name match
      const byKey = TYPE_GROUPS.find(g =>
        g.catKeys.some(k => c.includes(k)) ||
        g.measureNames.some(mn => n === mn)
      );
      if (byKey) return byKey;
      // Secondary: name keyword + unit fallback.
      // Applies to any roofing-flavoured category (e.g. 'Roofing', 'Metal Roofing',
      // 'Roofing Material', 'Roof', 'Steep Roof', etc.) — checking for 'roof'
      // rather than 'roofing' so categories without the '-ing' suffix still match.
      // Name keywords are checked BEFORE unit so combined items like
      // "Underlayment + Ice & Water Shield" (unit='sq') map to ice/underlayment
      // groups rather than being swallowed by the catch-all sq→shingles fallback.
      if (c.includes('roof')) {
        if (n.includes('ridge') || n.includes('hip') || n.includes('ridglass') || n.includes('timbertex') || n.includes('seal-a-ridge'))
          return TYPE_GROUPS.find(g => g.catKeys.some(k => k.includes('ridge cap')));
        if (n.includes('starter'))
          return TYPE_GROUPS.find(g => g.catKeys.includes('starter'));
        // Ice & water shield: generic keywords + brand-specific names that lack
        // 'ice'/'water' (e.g. 'Atlas GlasBase Plus', 'Atlas StormSeal',
        // 'CertainTeed WinterGuard', 'Owens Corning WeatherLock').
        if (
          n.includes('ice') || n.includes('water') || n.includes('shield') ||
          n.includes('weatherwatch') || n.includes('stormguard') ||
          n.includes('glasbase') || n.includes('stormseal') ||
          n.includes('winterguard') || n.includes('weatherlock')
        )
          return TYPE_GROUPS.find(g => g.catKeys.some(k => k.includes('ice')));
        if (n.includes('underlayment') || n.includes('synthetic') || n.includes('rhino') || n.includes('felt'))
          return TYPE_GROUPS.find(g => g.catKeys.includes('underlayment'));
        if (n.includes('drip'))
          return TYPE_GROUPS.find(g => g.catKeys.includes('drip edge'));
        if (n.includes('pipe') || n.includes('boot'))
          return TYPE_GROUPS.find(g => g.catKeys.includes('pipe'));
        if (n.includes('valley'))
          return TYPE_GROUPS.find(g => g.catKeys.includes('valley'));
        // Require both words together — a bare "flashing" substring also matches
        // unrelated accessories like "Braun/Broan Stove Vent Flashing" or
        // "Flashing (Misc / Apron)", which have no step-flashing measurement to
        // inherit and should be left untouched instead of stealing that value.
        if (n.includes('step') && n.includes('flashing'))
          return TYPE_GROUPS.find(g => g.catKeys.includes('step flashing'));
        // Require the specific ridge-vent / attic-ventilation phrasing — a bare
        // "vent" substring also matches unrelated per-unit accessories like
        // "Box Vents" or "Braun/Broan Stove Vent Flashing", which have no ridge
        // vent measurement to inherit and should be left untouched instead.
        if (n.includes('ridge vent') || n.includes('attic vent') || n.includes('ventilation'))
          return TYPE_GROUPS.find(g => g.catKeys.includes('ventilation'));
        if (n.includes('nail') || n.includes('fastener') || n.includes('screw'))
          return TYPE_GROUPS.find(g => g.catKeys.includes('fastener'));
        // Tear-off / demo items → dedicated tear-off group so they match
        // "Tear Off Existing Roof" (base squares, no waste) and get consumed,
        // preventing a duplicate extra item from being appended.
        if (n.includes('tear off') || n.includes('tear-off') || n.includes('tearoff'))
          return TYPE_GROUPS.find(g => g.catKeys.includes('tear off'));
        // Flat-roof membrane products (EPDM, TPO, modified bitumen, etc.) →
        // shingles group to pick up the correct sq quantity.  Description is NOT
        // copied for type-group matches (see merge below) so the template's own
        // product description is always preserved.
        if (
          n.includes('membrane') || n.includes('epdm') || n.includes('tpo') ||
          n.includes('modified bitumen') || n.includes('torch down') || n.includes('torch-down') ||
          n.includes('built-up') || n.includes('gravel surface') || n.includes('cap sheet')
        ) return TYPE_GROUPS.find(g => g.catKeys.includes('shingles'));
        // Decking/sheathing items must never inherit the shingles sq quantity —
        // they are billed per sheet (3.125 sheets per roofing square), not per sq.
        if (n.includes('deck') || n.includes('sheath') || n.includes('osb') || n.includes('plywood'))
          return TYPE_GROUPS.find(g => g.catKeys.includes('decking'));
        // Unit-based last-resort: sq → shingles group (catches generic metal
        // panel items like "Corrugated Metal Panels" or "Standing Seam Metal Panels")
        if (u === 'sq') return TYPE_GROUPS.find(g => g.catKeys.includes('shingles'));
      }
      return undefined;
    };

    const measuredMap = new Map<string, LineItem>(
      measuredItems.map(m => [normalizeKey(m.category, m.item_name), m]),
    );

    // Track which measured items were consumed by a type-group fallback match
    const consumedByTypeGroup = new Set<string>();

    const merged = existingItems.map(item => {
      // ── Step 1: exact name match ────────────────────────────────────────────
      const key = normalizeKey(item.category, item.item_name);
      const exactMatch = measuredMap.get(key);
      if (exactMatch) {
        // In shared single-map mode (consumeEntries=false): tier-specific items
        // keep the slot open so Good/Better/Best can each pick up the same qty.
        // In per-tier mode (consumeEntries=true): consume normally — each tier
        // gets its own fresh map so preservation isn't needed, and consuming
        // prevents the item from appearing as an "extra" at the end.
        const isTierSpecific = (item.tiers_applicable?.length ?? 0) === 1;
        if (!isTierSpecific || consumeEntries) measuredMap.delete(key);
        return {
          ...item,
          description: exactMatch.description || item.description,
          quantity: exactMatch.quantity,
          // preservePrices: keep whatever the existing item already has — only
          // quantities come from the additional report, never catalog prices.
          ...(preservePrices ? {} : {
            good_price: exactMatch.good_price || item.good_price,
            better_price: exactMatch.better_price || item.better_price,
            best_price: exactMatch.best_price || item.best_price,
          }),
          unit: exactMatch.unit || item.unit,
        };
      }

      // ── Step 2: category-type fallback (product names like "GAF Timberline") ─
      const templateGroup = findGroupForTemplate(item.category, item.item_name, item.unit);
      if (templateGroup) {
        for (const [mKey, measuredItem] of measuredMap) {
          if (consumedByTypeGroup.has(mKey)) continue;
          const measuredGroup = findGroupForMeasured(measuredItem.item_name);
          if (measuredGroup === templateGroup) {
            const isTierSpecific = (item.tiers_applicable?.length ?? 0) === 1;
            if (!isTierSpecific || consumeEntries) consumedByTypeGroup.add(mKey);
            // Keep the template's item name AND description — type-group matches
            // pair different product names (e.g. "EPDM Membrane" ↔ "Architectural
            // Shingles"), so the measurement description would be wrong.
            // Only the quantity (and unit) comes from the measurement.
            return {
              ...item,
              quantity: measuredItem.quantity,
              unit: measuredItem.unit || item.unit,
            };
          }
        }
      }

      // No match — keep the template item as-is
      return item;
    });

    // Remove consumed type-group items from the map so they aren't appended as extras
    for (const k of consumedByTypeGroup) measuredMap.delete(k);

    // In per-tier mode (consumeEntries=true), unmatched measurement items are
    // still appended so nothing imported from the report silently vanishes —
    // but tagged to this call's tier (appendTier) so they don't get counted
    // as "shared" and confuse per-tier detection on a later sync.
    const extras = consumeEntries
      ? Array.from(measuredMap.values()).map(item => appendTier ? { ...item, tiers_applicable: [appendTier] } : item)
      : Array.from(measuredMap.values());
    return normalizeSortOrder([...merged, ...extras]);
  };

  // Scale roofing material items' good/better/best prices so their combined
  // per-square total lands on the company's configured target rate (Material
  // Preferences → "Price per Square" for each tier), instead of only overriding
  // the primary shingle item and leaving every other item at its unscaled
  // catalog price — which let the real per-sq total land far above or below
  // the target the company actually wanted.
  const applyPerSqTargets = (items: LineItem[], totalSquares: number): LineItem[] => {
    if (!totalSquares || totalSquares <= 0) return items;
    const matPrefs = localCompany?.material_preferences?.roofing;
    const targets: Record<'good' | 'better' | 'best', number | undefined> = {
      good: matPrefs?.good?.per_sq,
      better: matPrefs?.better?.per_sq,
      best: matPrefs?.best?.per_sq,
    };
    if (!targets.good && !targets.better && !targets.best) return items;

    // Situational surcharges represent extra cost ON TOP of a normal-difficulty
    // roof — calibrating them along with everything else would silently shrink
    // or inflate the very surcharge that accounts for a steep/complex roof's
    // extra difficulty, so they're left untouched.
    const EXCLUDED_NAMES = new Set([
      'steep slope labor', 'steep slope labor surcharge', 'steep charge',
      'high complexity labor', 'high complexity labor surcharge', 'complexity charge', 'cut-up factor',
    ]);
    const isScalable = (item: LineItem) =>
      !(item as any).is_divider &&
      (item.category || '').toLowerCase() === 'roofing' &&
      !EXCLUDED_NAMES.has((item.item_name || '').toLowerCase());

    let result = items;
    (['good', 'better', 'best'] as const).forEach(tier => {
      const target = targets[tier];
      if (!target || target <= 0) return;
      const priceKey = `${tier}_price` as 'good_price' | 'better_price' | 'best_price';
      const naturalPerSq = result
        .filter(isScalable)
        .reduce((sum, i) => sum + i.quantity * (i[priceKey] || 0), 0) / totalSquares;
      if (naturalPerSq <= 0) return;
      const factor = target / naturalPerSq;
      result = result.map(i => isScalable(i) ? { ...i, [priceKey]: Math.round(i[priceKey] * factor * 100) / 100 } : i);
    });
    return result;
  };

  const applyRoofrLineItems = () => {
    if (!roofrReport) return;

    // Build the report view to use — either the combined total or a single structure
    let reportToUse: RoofrParsedReport;
    let structureLabel: string;
    if (roofrStructureScope === 'all' || roofrReport.structures.length === 0) {
      // Always use 'combined' so we generate exactly one set of items.
      // Multiple-structure layouts (separate / separate-and-combined) produce one block
      // per structure which causes items to appear 2–3× when syncing.
      const effectiveMode = roofrImportMode === 'combined' ? 'combined' : roofrImportMode;
      reportToUse = {
        ...roofrReport,
        importMode: effectiveMode,
      };
      structureLabel =
        effectiveMode === 'separate'
          ? `${roofrReport.structures.length} separate structures`
          : effectiveMode === 'separate-and-combined'
            ? `${roofrReport.structures.length} structures plus combined total`
            : roofrReport.structures.length > 1
              ? `${roofrReport.structures.length} structures`
              : '1 structure';
    } else {
      const selectedStructure = roofrReport.structures[roofrStructureScope];
      reportToUse = {
        ...roofrReport,
        importMode: 'combined',
        reportSummary: selectedStructure,
        totalRoofAreaSqft: selectedStructure.totalRoofAreaSqft,
        structures: [selectedStructure],
        // Clear pre-computed material calcs — they cover the entire roof, not just this
        // structure. Clearing forces each material to fall back to the structure's own
        // measured area, so shingles, underlayment, starter, ice & water, etc. all
        // reflect only the selected structure (same as tear-off already does).
        materialCalculations: [],
      };
      structureLabel = `Structure ${selectedStructure.structureNumber}`;
    }

    let importedItems = buildMeasurementLineItems('roofr', reportToUse, companyPricing, roofrWastePercent, { stories: jobStories, layers: jobLayers });
    if (!importedItems.length) {
      toast.error('No roofing line items were generated from that report.');
      return;
    }

    // Apply the company's preferred brand products to each imported item
    const activeBrand = localCompany?.preferred_shingle_brand;
    if (activeBrand) {
      importedItems = importedItems.map(item => {
        const suggestions = getProductSuggestions(item.item_name, activeBrand);
        if (!suggestions) return item;
        return {
          ...item,
          good_product: item.good_product || suggestions.good,
          better_product: item.better_product || suggestions.better,
          best_product: item.best_product || suggestions.best,
        };
      });
    }

    // Per-square pricing: zero standard material prices (quantities stay), keep extras priced
    // Per square, itemized: hit the same $/sq target, but by scaling the real
    // material prices rather than zeroing them. Every line keeps a price and
    // the lines still add up to rate x squares.
    if (roofrPricingMode === 'per-sq-items') {
      const rates = {
        good: parseFloat(roofrPerSqGoodRate),
        better: parseFloat(roofrPerSqBetterRate),
        best: parseFloat(roofrPerSqBestRate),
      };
      const squares = totalSquaresFromImport(importedItems);
      if (squares > 0) {
        (['good', 'better', 'best'] as const).forEach(tier => {
          const rate = !isNaN(rates[tier]) && rates[tier] > 0
            ? rates[tier]
            : (!isNaN(rates.good) && rates.good > 0 ? rates.good : NaN);
          if (isNaN(rate)) return;
          const key = `${tier}_price` as const;

          // Pass-throughs (labor, disposal) come off the target first — they
          // are not marked up — then materials are scaled to cover the rest.
          let materials = 0;
          let passThrough = 0;
          for (const item of importedItems) {
            if ((item as any).is_divider) continue;
            const line = (item.quantity ?? 0) * ((item as any)[key] ?? 0);
            if (isPassThroughLine(item)) passThrough += line;
            else materials += line;
          }
          if (materials <= 0) return;

          const target = rate * squares;
          const factor = (target - passThrough) / materials;
          // A target that cannot cover the pass-throughs would invert the
          // prices; leave the tier alone rather than produce negatives.
          if (!Number.isFinite(factor) || factor <= 0) return;

          importedItems = importedItems.map(item => {
            if ((item as any).is_divider || isPassThroughLine(item)) return item;
            const cur = (item as any)[key] ?? 0;
            return { ...item, [key]: Math.round(cur * factor * 100) / 100 };
          });
        });
      }
    }

    if (roofrPricingMode === 'per-sq') {
      const goodRate = parseFloat(roofrPerSqGoodRate);
      const betterRate = parseFloat(roofrPerSqBetterRate);
      const bestRate = parseFloat(roofrPerSqBestRate);
      if (!isNaN(goodRate) && goodRate > 0) {
        importedItems = importedItems.map(item => {
          // Keep shingle item — it receives the all-in rate below
          if (isShinglePrimaryItem(item)) return item;
          // Keep true extras priced: flashing (lf), pipe boots, steep/complexity surcharges
          const n = item.item_name?.toLowerCase() ?? '';
          const isExtra =
            item.unit === 'lf' ||
            n.includes('pipe boot') ||
            n.includes('steep slope') ||
            n.includes('high complexity') ||
            n.includes('complexity charge') ||
            n.includes('cut-up');
          if (isExtra) return item;
          // Standard included material — zero the price but keep the quantity visible
          return { ...item, good_price: 0, better_price: 0, best_price: 0, fixed_price: null };
        });
        // Find shingles item first, then fall back to any sq-unit item
        const shingleIdx = importedItems.findIndex(item => isShinglePrimaryItem(item));
        const targetIdx = shingleIdx >= 0
          ? shingleIdx
          : importedItems.findIndex(item => !item.is_divider && item.unit === 'sq');
        if (targetIdx >= 0) {
          const b = !isNaN(betterRate) && betterRate > 0 ? betterRate : goodRate;
          const bs = !isNaN(bestRate) && bestRate > 0 ? bestRate : b;
          // Rates entered are $/sq — a bundle-billed shingle item (3 bundles/sq)
          // needs the equivalent per-bundle price so the total still matches.
          const isBdl = importedItems[targetIdx].unit === 'bdl';
          importedItems[targetIdx] = {
            ...importedItems[targetIdx],
            good_price: toCents(isBdl ? goodRate / 3 : goodRate),
            better_price: toCents(isBdl ? b / 3 : b),
            best_price: toCents(isBdl ? bs / 3 : bs),
            description: `${importedItems[targetIdx].description || ''} — $${goodRate.toFixed(2)}/$${b.toFixed(2)}/$${bs.toFixed(2)}/sq (Good/Better/Best all-in rate; other line items show quantities for material ordering only).`.trimStart(),
          };
        }
      }
    }

    // Apply company per-sq rates to the primary material item (if set in Material Preferences).
    // This overrides only the primary sq-unit item — all other line items keep their normal prices.
    // Only applies in standard pricing mode (per-sq mode has its own price override above).
    if (roofrPricingMode === 'standard') {
      const matPrefs = localCompany?.material_preferences?.roofing;
      const perSqGood   = matPrefs?.good?.per_sq;
      const perSqBetter = matPrefs?.better?.per_sq;
      const perSqBest   = matPrefs?.best?.per_sq;
      if (perSqGood || perSqBetter || perSqBest) {
        const primaryIdx = importedItems.findIndex(i => isShinglePrimaryItem(i));
        if (primaryIdx >= 0) {
          // Rates are configured per square — shingles billed in bundles need
          // the equivalent square count (3 bundles/sq), not the raw bundle qty.
          const primaryItem = importedItems[primaryIdx];
          const sqEquivalent = primaryItem.unit === 'bdl' ? primaryItem.quantity / 3 : primaryItem.quantity;
          importedItems[primaryIdx] = {
            ...primaryItem,
            ...(perSqGood   ? { good_price:   Math.round(perSqGood   * sqEquivalent * 100) / 100 } : {}),
            ...(perSqBetter ? { better_price: Math.round(perSqBetter * sqEquivalent * 100) / 100 } : {}),
            ...(perSqBest   ? { best_price:   Math.round(perSqBest   * sqEquivalent * 100) / 100 } : {}),
          };
        }
      }
    }

    // Determine effective tier target for this sync
    const tierTarget = roofrMeasureTier !== 'all' ? roofrMeasureTier : undefined;

    // When targeting a specific tier, tag imported items so they only price that tier
    if (tierTarget && roofrPricingMode === 'standard') {
      importedItems = importedItems.map(item => ({
        ...item,
        tiers_applicable: [tierTarget],
        good_price:   tierTarget === 'good'   ? item.good_price   : 0,
        better_price: tierTarget === 'better' ? item.better_price : 0,
        best_price:   tierTarget === 'best'   ? item.best_price   : 0,
      }));
    }

    let syncedItems: LineItem[];
    if (lineItems.length === 0) {
      syncedItems = normalizeSortOrder(importedItems);
    } else {
      const goodItems   = lineItems.filter(it => it.tiers_applicable?.length === 1 && it.tiers_applicable[0] === 'good');
      const betterItems = lineItems.filter(it => it.tiers_applicable?.length === 1 && it.tiers_applicable[0] === 'better');
      const bestItems   = lineItems.filter(it => it.tiers_applicable?.length === 1 && it.tiers_applicable[0] === 'best');
      const sharedItems = lineItems.filter(it => !it.tiers_applicable?.length || it.tiers_applicable.length !== 1 ||
        (it.tiers_applicable[0] !== 'good' && it.tiers_applicable[0] !== 'better' && it.tiers_applicable[0] !== 'best'));
      const isSeparateTiers = goodItems.length >= 2 && betterItems.length >= 2 && bestItems.length >= 2;

      if (isSeparateTiers) {
        // Per-tier sync: only sync the targeted tier(s), leave others untouched
        const mergedGood   = (!tierTarget || tierTarget === 'good')   && goodItems.length   ? syncMeasuredItems(goodItems,   importedItems, true, 'good') : goodItems;
        const mergedBetter = (!tierTarget || tierTarget === 'better') && betterItems.length ? syncMeasuredItems(betterItems, importedItems, true, 'better') : betterItems;
        const mergedBest   = (!tierTarget || tierTarget === 'best')   && bestItems.length   ? syncMeasuredItems(bestItems,   importedItems, true, 'best') : bestItems;
        const mergedShared = sharedItems.length ? syncMeasuredItems(sharedItems, importedItems, true) : sharedItems;
        syncedItems = normalizeSortOrder([...mergedShared, ...mergedGood, ...mergedBetter, ...mergedBest]);
      } else if (quoteStructureType === 'multi_scope' && quoteOptions.length > 0) {
        // Multi-scope quotes keep one line-item copy per quote_option_id (e.g. a
        // separate "Tear Off Existing Roof" row under Good, Better, and Best).
        // Syncing the whole flat lineItems array against a single measuredItems
        // map lets the first option to match a given item name consume that
        // map entry — every other option's identically-named item then finds
        // nothing left to match and silently keeps its old quantity. Sync each
        // option against its own copy of the import so every option is matched.
        const scoped = quoteOptions.flatMap(opt => {
          const optItems = lineItems.filter(it => it.quote_option_id === opt.id);
          const merged = optItems.length > 0
            ? syncMeasuredItems(optItems, importedItems, true)
            : importedItems.map(it => ({ ...it, id: `${it.id}-${opt.id}` }));
          return merged.map(it => ({ ...it, quote_option_id: opt.id }));
        });
        const dividers = lineItems.filter(it => it.is_divider);
        syncedItems = normalizeSortOrder([...dividers, ...scoped]);
      } else {
        syncedItems = syncMeasuredItems(lineItems, importedItems);
      }
    }

    // Multi-scope quotes don't map cleanly onto a single "which tier is this
    // option" target (each option mainly uses good_price regardless of what
    // it's named), so per-sq target calibration only runs for tiered quotes.
    if (quoteStructureType !== 'multi_scope' && roofrPricingMode === 'standard') {
      const calibrationSquares = (reportToUse.reportSummary?.totalRoofAreaSqft || reportToUse.totalRoofAreaSqft) / 100;
      syncedItems = applyPerSqTargets(syncedItems, calibrationSquares);
    }

    setLineItemsWithHistory(syncedItems);
    const providerName = roofrReport.source === 'eagleview' ? 'EagleView' : 'Roofr';
    setMeasurementProvider(roofrReport.source === 'eagleview' ? 'eagleview' : 'roofr');
    setMeasurementSourceName(roofrFileName || `${providerName} Report`);
    setMeasurementData(reportToUse);
    setRoofrReport(reportToUse);
    if (!projectDescription.trim()) {
      const areaSqft = reportToUse.reportSummary?.totalRoofAreaSqft || reportToUse.totalRoofAreaSqft;
      setProjectDescription(
        `Asphalt shingle roof replacement scope generated from ${providerName} measurements for ${roofrReport.address || 'this property'} (${structureLabel}, ${(areaSqft / 100).toFixed(1)} squares).`
      );
    }
    toast.success(`Measurements synced from ${providerName} report.`);
  };

  // ── Insurance supplement helpers ────────────────────────────────────────────
  // Default rates used when company hasn't configured custom supplement pricing.
  // Thresholds match common carrier guidelines (Xactimate steep-slope categories).
  const SUPPLEMENT_DEFAULTS = {
    mod_steep:        { good: 15, better: 20, best:  25 },
    steep:            { good: 40, better: 50, best:  65 },
    very_steep:       { good: 75, better: 95, best: 125 },
    two_story:        { good: 15, better: 20, best:  25 },
    three_plus_story: { good: 30, better: 40, best:  50 },
  };
  const compSupp = company.supplement_rates ?? {};

  const getSteepSlopeRates = (pitch: number): { label: string; good: number; better: number; best: number } | null => {
    if (pitch >= 13) {
      const r = compSupp.very_steep ?? SUPPLEMENT_DEFAULTS.very_steep;
      return { label: `${pitch}/12 (Very Steep)`, ...r };
    }
    if (pitch >= 10) {
      const r = compSupp.steep ?? SUPPLEMENT_DEFAULTS.steep;
      return { label: `${pitch}/12 (Steep)`, ...r };
    }
    if (pitch >= 7) {
      const r = compSupp.mod_steep ?? SUPPLEMENT_DEFAULTS.mod_steep;
      return { label: `${pitch}/12 (Mod. Steep)`, ...r };
    }
    return null; // ≤ 6/12 is baseline — no supplement
  };

  const getStoryRates = (stories: '1' | '2' | '3+'): { label: string; good: number; better: number; best: number } | null => {
    if (stories === '2') {
      const r = compSupp.two_story ?? SUPPLEMENT_DEFAULTS.two_story;
      return { label: '2-Story', ...r };
    }
    if (stories === '3+') {
      const r = compSupp.three_plus_story ?? SUPPLEMENT_DEFAULTS.three_plus_story;
      return { label: '3+ Story', ...r };
    }
    return null; // 1-story baseline — no supplement
  };

  const buildSupplementLineItems = (totalSquares: number): LineItem[] => {
    if (!manualSupplementsEnabled) return [];
    const items: LineItem[] = [];
    const nextId = () => `supplement-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Pitch zone supplements — one line item per zone that qualifies
    manualPitchZones.forEach(zone => {
      const pitch = parseInt(zone.pitch, 10);
      const sq = parseFloat(zone.squares);
      if (isNaN(pitch) || isNaN(sq) || sq <= 0) return;
      const rates = getSteepSlopeRates(pitch);
      if (!rates) return;
      items.push({
        id: nextId(), quote_id: '', category: 'Roofing',
        item_name: `Steep Slope Supplement — ${rates.label}`,
        description: `Insurance supplement for steep-slope labor: ${sq} sq at ${pitch}/12 pitch. Adjust price to match carrier schedule.`,
        unit: 'sq', quantity: sq,
        good_price: rates.good, better_price: rates.better, best_price: rates.best,
        sort_order: 0,
      });
    });

    // Story height supplement — applied to the full roof area
    const storyRates = getStoryRates(manualStories);
    if (storyRates && totalSquares > 0) {
      items.push({
        id: nextId(), quote_id: '', category: 'Roofing',
        item_name: `Story Height Supplement — ${storyRates.label}`,
        description: `Insurance supplement for elevated-access labor: ${totalSquares.toFixed(1)} sq at ${storyRates.label}. Adjust price to match carrier schedule.`,
        unit: 'sq', quantity: totalSquares,
        good_price: storyRates.good, better_price: storyRates.better, best_price: storyRates.best,
        sort_order: 0,
      });
    }

    // Custom supplements — added as qty 1 line items (rep adjusts qty after import)
    const customSupps = (compSupp as any).custom as Array<{ id: string; label: string; description: string; good: number; better: number; best: number }> | undefined;
    if (customSupps && customSupps.length > 0) {
      customSupps.forEach(supp => {
        if (!supp.label?.trim()) return;
        items.push({
          id: nextId(), quote_id: '', category: 'Roofing',
          item_name: supp.label.trim(),
          description: supp.description?.trim() || 'Insurance supplement — adjust quantity and price to match carrier schedule.',
          unit: 'ea', quantity: 1,
          good_price: supp.good ?? 0, better_price: supp.better ?? 0, best_price: supp.best ?? 0,
          sort_order: 0,
        });
      });
    }

    return items;
  };
  // ────────────────────────────────────────────────────────────────────────────

  // Save current measurement fields to the pool for the active key, then load the new key's pool.
  // Call this whenever the tier/scope dropdown changes.
  const switchMeasureTarget = (
    newTier: 'all' | 'good' | 'better' | 'best',
    newOptionId: string | null,
  ) => {
    // Determine the key we are leaving
    const leavingKey = quoteStructureType === 'multi_scope'
      ? manualTargetOptionId
      : (manualMeasureTier !== 'all' ? manualMeasureTier : null);

    // Save current fields into the leaving pool
    if (leavingKey) {
      setTierMeasurementPools(prev => ({
        ...prev,
        [leavingKey]: { squares: manualSquares, eaves: manualEaves, rakes: manualRakes,
          ridge: manualRidge, hips: manualHips, valleys: manualValleys,
          pipeBoots: manualPipeBoots, waste: manualWaste },
      }));
    }

    // Determine the key we are entering
    const enteringKey = quoteStructureType === 'multi_scope'
      ? newOptionId
      : (newTier !== 'all' ? newTier : null);

    // Restore from that pool, or clear fields if it's a fresh pool
    const pool = enteringKey ? tierMeasurementPools[enteringKey] : null;
    if (pool) {
      setManualSquares(pool.squares);
      setManualEaves(pool.eaves);
      setManualRakes(pool.rakes);
      setManualRidge(pool.ridge);
      setManualHips(pool.hips);
      setManualValleys(pool.valleys);
      setManualPipeBoots(pool.pipeBoots);
      setManualWaste(pool.waste);
    } else if (enteringKey) {
      setManualSquares(''); setManualEaves(''); setManualRakes('');
      setManualRidge(''); setManualHips(''); setManualValleys('');
      setManualPipeBoots(''); setManualWaste(10);
    }

    setManualMeasureTier(newTier);
    setManualTargetOptionId(newOptionId);
  };

  // Apply line items from manual square entry — builds a synthetic RoofrParsedReport
  // with no pre-computed waste tables so the fallback math runs off the raw values.
  const applyManualSquaresLineItems = (opts?: { forcePricingMode?: 'standard' | 'per-sq'; targetTier?: 'good' | 'better' | 'best'; targetOptionId?: string }) => {
    const squares = parseFloat(manualSquares);
    if (isNaN(squares) || squares <= 0) { toast.error('Enter a valid square count first.'); return; }

    const eaves = parseFloat(manualEaves) || 0;
    const rakes = parseFloat(manualRakes) || 0;
    const ridge = parseFloat(manualRidge) || 0;
    const hips = parseFloat(manualHips) || 0;
    const ridgeHips = ridge + hips;
    const valleys = parseFloat(manualValleys) || 0;
    const pipeBoots = parseInt(manualPipeBoots, 10) || 0;

    // Warn if any key measurements are missing
    const missingItems: string[] = [];
    if (!manualEaves) { missingItems.push('Eaves'); }
    if (!manualRakes) { missingItems.push('Rakes'); }
    if (!manualRidge) { missingItems.push('Ridge'); }
    if (!manualHips) { missingItems.push('Hips'); }
    if (!manualValleys) { missingItems.push('Valleys'); }

    const doApply = () => {
      // Resolve the target scope option ID — opts?.targetOptionId is provided when
      // manualTargetOptionId is null but the dropdown is visually showing scope 0 via fallback.
      const resolvedScopeOptionId = quoteStructureType === 'multi_scope'
        ? (opts?.targetOptionId || manualTargetOptionId || quoteOptions[0]?.id || null)
        : null;

      const syntheticStructure = {
        structureNumber: 1,
        totalRoofAreaSqft: squares * 100,
        totalPitchedAreaSqft: squares * 100,
        totalFlatAreaSqft: 0,
        totalRoofFacets: 0,
        predominantPitch: '',
        totalEavesFt: eaves,
        totalValleysFt: valleys,
        totalHipsFt: hips,
        totalRidgesFt: ridge,
        totalRakesFt: rakes,
        totalWallFlashingFt: 0,
        totalStepFlashingFt: 0,
        hipsAndRidgesFt: ridgeHips,
        eavesAndRakesFt: eaves + rakes,
      };

      // Build materialCalculations so getWasteValue applies waste correctly on top of
      // exact field measurements entered by the user.
      const withWaste = (base: number, pct: number) => base * (1 + pct / 100);
      const sqft = squares * 100;
      const eavesRakes = eaves + rakes;
      const eavesValleys = eaves + valleys;
      const dripEdgeSticks = eavesRakes / 10; // exact lf ÷ 10' per stick

      const syntheticReport: RoofrParsedReport = {
        address: 'Manual Entry',
        totalRoofAreaSqft: sqft,
        totalRoofFacets: 0,
        predominantPitch: '',
        structures: [syntheticStructure],
        reportSummary: syntheticStructure,
        source: 'roofr',
        materialCalculations: [
          {
            product: 'Shingle (total sqft)',
            unit: 'sqft',
            waste0: sqft,
            waste10: withWaste(sqft, 10),
            waste12: withWaste(sqft, 12),
            waste15: withWaste(sqft, 15),
          },
          {
            product: 'Synthetic (total sqft; no laps)',
            unit: 'sqft',
            waste0: sqft,
            waste10: withWaste(sqft, 10),
            waste12: withWaste(sqft, 12),
            waste15: withWaste(sqft, 15),
          },
          ...(eavesRakes > 0 ? [{
            product: 'Starter (eaves + rakes)',
            unit: 'ft',
            waste0: eavesRakes,
            waste10: withWaste(eavesRakes, 10),
            waste12: withWaste(eavesRakes, 12),
            waste15: withWaste(eavesRakes, 15),
          }] : []),
          ...(eavesValleys > 0 ? [{
            product: 'Ice and Water (eaves + valleys + flashings)',
            unit: 'ft',
            waste0: eavesValleys,
            waste10: withWaste(eavesValleys, 10),
            waste12: withWaste(eavesValleys, 12),
            waste15: withWaste(eavesValleys, 15),
          }] : []),
          ...(ridgeHips > 0 ? [{
            product: 'Capping (hips + ridges)',
            unit: 'ft',
            waste0: ridgeHips,
            waste10: withWaste(ridgeHips, 10),
            waste12: withWaste(ridgeHips, 12),
            waste15: withWaste(ridgeHips, 15),
          }] : []),
          ...(ridge > 0 ? [{
            product: 'Ridge (ridgeline only)',
            unit: 'ft',
            waste0: ridge,
            waste10: withWaste(ridge, 10),
            waste12: withWaste(ridge, 12),
            waste15: withWaste(ridge, 15),
          }] : []),
          ...(eavesRakes > 0 ? [{
            product: "10' Drip Edge (eaves + rakes; no laps)",
            unit: 'sheets',
            waste0: dripEdgeSticks,
            waste10: withWaste(dripEdgeSticks, 10),
            waste12: withWaste(dripEdgeSticks, 12),
            waste15: withWaste(dripEdgeSticks, 15),
          }] : []),
          ...(pipeBoots > 0 ? [{
            product: 'Pipe Boots',
            unit: 'each',
            waste0: pipeBoots,
            waste10: pipeBoots,
            waste12: pipeBoots,
            waste15: pipeBoots,
          }] : []),
        ],
      };

      let importedItems = buildMeasurementLineItems('roofr', syntheticReport, companyPricing, manualWaste, { stories: jobStories, layers: jobLayers });
      if (!importedItems.length) { toast.error('No roofing line items were generated. Make sure you have a Roofing template loaded.'); return; }

      // Apply preferred brand products
      const activeBrand = localCompany?.preferred_shingle_brand;
      if (activeBrand) {
        importedItems = importedItems.map(item => {
          const suggestions = getProductSuggestions(item.item_name, activeBrand);
          return suggestions ? { ...item, good_product: item.good_product || suggestions.good, better_product: item.better_product || suggestions.better, best_product: item.best_product || suggestions.best } : item;
        });
      }

      // Per-square pricing override
      const effectivePricingMode = opts?.forcePricingMode ?? manualPricingMode;
      if (effectivePricingMode === 'per-sq') {
        const goodRate   = parseFloat(manualPerSqGoodRate);
        const betterRate = parseFloat(manualPerSqBetterRate);
        const bestRate   = parseFloat(manualPerSqBestRate);
        const hasGood   = !isNaN(goodRate)   && goodRate > 0;
        const hasBetter = !isNaN(betterRate) && betterRate > 0;
        const hasBest   = !isNaN(bestRate)   && bestRate > 0;
        if (hasGood || hasBetter || hasBest) {
          importedItems = importedItems.map(item => ({ ...item, good_price: 0, better_price: 0, best_price: 0, fixed_price: null }));
          const shingleIdx = importedItems.findIndex(item => isShinglePrimaryItem(item));
          const targetIdx = shingleIdx >= 0 ? shingleIdx : importedItems.findIndex(item => !item.is_divider && item.unit === 'sq');
          if (targetIdx >= 0) {
            // When a specific tier is targeted, only that tier gets the rate; others stay 0
            const tier = opts?.targetTier;
            // Fallback chain for each tier (so filling just Better still prices correctly)
            const firstRate = hasGood ? goodRate : hasBetter ? betterRate : bestRate;
            const effectiveGood   = tier ? (tier === 'good'   ? (hasGood   ? goodRate   : 0) : 0) : (hasGood   ? goodRate   : firstRate);
            const effectiveBetter = tier ? (tier === 'better' ? (hasBetter ? betterRate : 0) : 0) : (hasBetter ? betterRate : effectiveGood);
            const effectiveBest   = tier ? (tier === 'best'   ? (hasBest   ? bestRate   : 0) : 0) : (hasBest   ? bestRate   : effectiveBetter);
            // Description label
            const tierLabel = tier
              ? `${tier.charAt(0).toUpperCase() + tier.slice(1)} tier ($${(tier === 'good' ? effectiveGood : tier === 'better' ? effectiveBetter : effectiveBest).toFixed(2)}/sq all-in)`
              : `$${effectiveGood.toFixed(2)}/$${effectiveBetter.toFixed(2)}/$${effectiveBest.toFixed(2)}/sq all-in (Good/Better/Best)`;
            // Rates entered are $/sq — a bundle-billed shingle item (3 bundles/sq)
            // needs the equivalent per-bundle price so the total still matches.
            const isBdl = importedItems[targetIdx].unit === 'bdl';
            importedItems[targetIdx] = {
              ...importedItems[targetIdx],
              good_price:   toCents(isBdl ? effectiveGood / 3 : effectiveGood),
              better_price: toCents(isBdl ? effectiveBetter / 3 : effectiveBetter),
              best_price:   toCents(isBdl ? effectiveBest / 3 : effectiveBest),
              description: `${tierLabel}. Other items show quantities for material ordering only.`,
            };
          }
        }
      }
      // When a measurement tier target is selected (non-per-sq mode), zero out the
      // non-targeted tiers so the generated items only price the intended tier,
      // AND tag each item with tiers_applicable so calculateTotals() never counts
      // it toward the wrong tier total (prevents stale DB totals on the dashboard).
      const tierTarget = opts?.targetTier ?? (manualMeasureTier !== 'all' ? manualMeasureTier : undefined);
      if (tierTarget && effectivePricingMode !== 'per-sq') {
        importedItems = importedItems.map(item => ({
          ...item,
          tiers_applicable: [tierTarget],
          good_price:   tierTarget === 'good'   ? item.good_price   : 0,
          better_price: tierTarget === 'better' ? item.better_price : 0,
          best_price:   tierTarget === 'best'   ? item.best_price   : 0,
        }));
      }

      const supplementItems = buildSupplementLineItems(squares);
      const freshItems = [...importedItems, ...supplementItems];

      // Apply company per-sq rates to the primary material item (standard pricing only)
      if (effectivePricingMode !== 'per-sq') {
        const matPrefs = localCompany?.material_preferences?.roofing;
        const perSqGood   = matPrefs?.good?.per_sq;
        const perSqBetter = matPrefs?.better?.per_sq;
        const perSqBest   = matPrefs?.best?.per_sq;
        if (perSqGood || perSqBetter || perSqBest) {
          const primaryIdx = freshItems.findIndex(i => isShinglePrimaryItem(i));
          if (primaryIdx >= 0) {
            // Rates are configured per square — shingles billed in bundles need
            // the equivalent square count (3 bundles/sq), not the raw bundle qty.
            const primaryItem = freshItems[primaryIdx];
            const sqEquivalent = primaryItem.unit === 'bdl' ? primaryItem.quantity / 3 : primaryItem.quantity;
            freshItems[primaryIdx] = {
              ...primaryItem,
              ...(perSqGood   ? { good_price:   Math.round(perSqGood   * sqEquivalent * 100) / 100 } : {}),
              ...(perSqBetter ? { better_price: Math.round(perSqBetter * sqEquivalent * 100) / 100 } : {}),
              ...(perSqBest   ? { best_price:   Math.round(perSqBest   * sqEquivalent * 100) / 100 } : {}),
            };
          }
        }
      }

      // If a template is already loaded, merge measurements into it so the
      // user's template products and custom items are preserved.  Items that
      // don't have a measurement counterpart keep their existing quantity.
      //
      // When separate templates are loaded per tier (each item tagged to a
      // single tier), run syncMeasuredItems once PER TIER so each tier gets
      // its own fresh measurement map.  This eliminates any cross-tier map
      // consumption and guarantees Good, Better, and Best each independently
      // match the same measurement items.
      let result: LineItem[];
      if (lineItems.length === 0) {
        result = freshItems;
      } else if (quoteStructureType === 'multi_scope' && resolvedScopeOptionId) {
        // Multi-scope: sync only the items belonging to the target scope, leave other scopes untouched
        const scopeItems  = lineItems.filter(i => i.quote_option_id === resolvedScopeOptionId);
        const otherItems  = lineItems.filter(i => i.quote_option_id !== resolvedScopeOptionId);
        const syncedScope = scopeItems.length > 0
          ? syncMeasuredItems(scopeItems, freshItems)
          : freshItems.map(i => ({ ...i, quote_option_id: resolvedScopeOptionId }));
        result = normalizeSortOrder([...otherItems, ...syncedScope]);
      } else {
        const goodItems   = lineItems.filter(it => it.tiers_applicable?.length === 1 && it.tiers_applicable[0] === 'good');
        const betterItems = lineItems.filter(it => it.tiers_applicable?.length === 1 && it.tiers_applicable[0] === 'better');
        const bestItems   = lineItems.filter(it => it.tiers_applicable?.length === 1 && it.tiers_applicable[0] === 'best');
        const sharedItems = lineItems.filter(it => !it.tiers_applicable?.length || it.tiers_applicable.length !== 1 ||
          (it.tiers_applicable[0] !== 'good' && it.tiers_applicable[0] !== 'better' && it.tiers_applicable[0] !== 'best'));

        const isSeparateTiers = goodItems.length >= 2 && betterItems.length >= 2 && bestItems.length >= 2;
        if (isSeparateTiers) {
          const mergedGood   = goodItems.length   ? syncMeasuredItems(goodItems,   freshItems, true, 'good') : [];
          const mergedBetter = betterItems.length ? syncMeasuredItems(betterItems, freshItems, true, 'better') : [];
          const mergedBest   = bestItems.length   ? syncMeasuredItems(bestItems,   freshItems, true, 'best') : [];
          const mergedShared = sharedItems.length ? syncMeasuredItems(sharedItems, freshItems, true) : [];
          result = normalizeSortOrder([...mergedShared, ...mergedGood, ...mergedBetter, ...mergedBest]);
        } else {
          result = syncMeasuredItems(lineItems, freshItems);
        }
      }

      // Auto-apply the company's default margin % on the first measurement import.
      // Previously this only fired when companyPricing was empty (assuming company
      // prices already included margin). Now we use default_margin_percent so
      // companies that price at cost get the right markup applied automatically.
      const defaultMargin = localCompany.default_margin_percent ?? (companyPricing.length === 0 ? 50 : 0);
      const isFirstApply = lineItems.length === 0 && priceAdjPctRef.current === 0 && defaultMargin > 0;
      let finalItems = normalizeSortOrder(result);
      if (isFirstApply) {
        const mult = 1 + defaultMargin / 100;
        finalItems = finalItems.map(item => ({
          ...item,
          good_price:   Math.round(item.good_price   * mult * 100) / 100,
          better_price: Math.round(item.better_price * mult * 100) / 100,
          best_price:   Math.round(item.best_price   * mult * 100) / 100,
        }));
        priceAdjPctRef.current = defaultMargin;
        setPriceAdjPct(defaultMargin);
      }
      // Multi-scope quotes don't map cleanly onto a single "which tier is this
      // option" target (each option mainly uses good_price regardless of what
      // it's named), so per-sq target calibration only runs for tiered quotes.
      if (quoteStructureType !== 'multi_scope' && effectivePricingMode !== 'per-sq') {
        finalItems = applyPerSqTargets(finalItems, squares);
      }
      setLineItemsWithHistory(finalItems);

      // Persist manual inputs as 'manual' provider so they restore correctly on re-edit
      setMeasurementProvider('manual');
      setMeasurementSourceName(`Manual Entry — ${squares} sq`);
      // Snapshot current fields into the active pool before persisting
      const activeKey = quoteStructureType === 'multi_scope'
        ? resolvedScopeOptionId
        : (manualMeasureTier !== 'all' ? manualMeasureTier : null);
      const updatedPools = activeKey
        ? { ...tierMeasurementPools, [activeKey]: { squares: manualSquares, eaves: manualEaves,
            rakes: manualRakes, ridge: manualRidge, hips: manualHips, valleys: manualValleys,
            pipeBoots: manualPipeBoots, waste: manualWaste } }
        : tierMeasurementPools;

      setMeasurementData({
        squares: manualSquares,
        eaves: manualEaves,
        rakes: manualRakes,
        ridge: manualRidge,
        hips: manualHips,
        valleys: manualValleys,
        pipeBoots: manualPipeBoots,
        waste: manualWaste,
        pricingMode: effectivePricingMode,
        perSqGoodRate: manualPerSqGoodRate,
        perSqBetterRate: manualPerSqBetterRate,
        perSqBestRate: manualPerSqBestRate,
        tierMeasurementPools: updatedPools,
        manualMeasureTier,
        manualTargetOptionId: manualTargetOptionId ?? undefined,
      } as unknown as typeof syntheticReport);
      // Mark this tier/scope as having saved measurements
      const savedKey = quoteStructureType === 'multi_scope'
        ? (resolvedScopeOptionId ?? 'all')
        : (manualMeasureTier !== 'all' ? manualMeasureTier : 'all');
      setMeasuredTiers(prev => new Set([...prev, savedKey]));

      toast.success('Quote generated — review and adjust items below.');
    };

    if (missingItems.length > 0) {
      toast(`Synced with available data. Missing: ${missingItems.join(', ')} — enter them manually if needed.`);
    }
    doApply();
  };

  const handleSelectMeasurementProvider = (providerId: MeasurementProviderId) => {
    setMeasurementProvider(providerId);
    if (providerId !== 'roofr' && providerId !== 'eagleview') {
      setRoofrReport(null);
      setRoofrFileName('');
      setRoofrImportMode('combined');
      setRoofrStructureScope('all');
    }
  };

  // Remove all line items that were auto-generated from a measurement import
  // Covers both Roofr/EagleView roof items (roofr-*) and EagleView Walls siding items (eagleview-walls-*)
  const handleRemoveImportedItems = () => {
    const before = lineItems.length;
    const filtered = lineItems.filter(
      item => !item.id.startsWith('roofr-') && !item.id.startsWith('eagleview-walls-'),
    );
    setLineItems(normalizeSortOrder(filtered));
    const removed = before - filtered.length;
    toast.success(`Removed ${removed} imported item${removed !== 1 ? 's' : ''}.`);
  };

  const hasImportedItems = lineItems.some(
    item => item.id.startsWith('roofr-') || item.id.startsWith('eagleview-walls-'),
  );

  const handleWallsFile = async (file: File, opts?: { fromStored?: boolean }) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload an EagleView Walls PDF report.');
      return;
    }
    setParsingWalls(true);
    try {
      const parsed = await parseEagleViewWallsReportFromFile(file);
      setWallsReport(parsed);
      setWallsFileName(file.name);
      // Upload original PDF to storage so it can be shared with the customer
      try {
        const storageFileName = `${companyId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: uploadErr } = await supabase.storage
          .from('signed-quotes')
          .upload(`reports/${storageFileName}`, file, { contentType: 'application/pdf', upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('signed-quotes').getPublicUrl(`reports/${storageFileName}`);
          setMeasurementReportUrl(urlData.publicUrl);
        }
      } catch { /* non-fatal */ }
      const sidingSq = (parsed.totalSidingAreaSqft / 100).toFixed(1);
      toast.success(`EagleView Walls imported — ${sidingSq} sq of siding detected.`);
      if (!opts?.fromStored) void saveMeasurementReportToCustomer(file, companyId, selectedCustomerId);
    } catch (error: any) {
      console.error('Walls report parse failed:', error);
      toast.error(error?.message || 'Failed to parse EagleView Walls report.');
    } finally {
      setParsingWalls(false);
    }
  };

  // ── Additional report upload & apply ─────────────────────────────────────
  // Accepts any measurement PDF (EagleView Walls OR Roofr/EagleView standard).
  // Auto-detects format, stores the result, and shows per-report apply buttons.
  const handleAdditionalReportFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF measurement report.');
      return;
    }
    setParsingAdditional(true);
    try {
      let wallsData: EagleViewWallsReport | null = null;
      let roofData: RoofrParsedReport | null = null;

      // Try EagleView Walls format first (siding-specific reports)
      try {
        wallsData = await parseEagleViewWallsReportFromFile(file);
      } catch { /* not EagleView Walls */ }

      // If that didn't work, try Roofr / EagleView standard format
      if (!wallsData) {
        try {
          const parsed = await parseRoofrPdfReport(file);
          if (parsed.totalRoofAreaSqft > 0 || parsed.structures.length > 0) {
            roofData = parsed;
          }
        } catch { /* not Roofr either */ }
      }

      if (!roofData && !wallsData) {
        toast.error('Could not read measurement data from this PDF. Please upload a Roofr or EagleView report.');
        return;
      }

      const newReport: AdditionalMeasurementReport = {
        id: `extra-${Date.now()}`,
        fileName: file.name,
        roofData,
        wallsData,
      };
      setAdditionalReports(prev => [...prev, newReport]);

      if (wallsData) {
        toast.success(`Walls report loaded — ${(wallsData.totalSidingAreaSqft / 100).toFixed(1)} sq siding.`);
      } else if (roofData) {
        const src = roofData.source === 'eagleview' ? 'EagleView' : 'Roofr';
        toast.success(`${src} roof report loaded — ${(roofData.totalRoofAreaSqft / 100).toFixed(1)} sq.`);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to parse report.');
    } finally {
      setParsingAdditional(false);
    }
  };

  const applyAdditionalRoofReport = (report: AdditionalMeasurementReport) => {
    if (!report.roofData) return;
    const importedItems = buildMeasurementLineItems('roofr', report.roofData, companyPricing, roofrWastePercent, { stories: jobStories, layers: jobLayers });
    if (!importedItems.length) { toast.error('No roofing items generated from that report.'); return; }
    // preservePrices=true: only update quantities from the additional report —
    // never overwrite the custom or per-tier prices already on the quote items.
    const result = lineItems.length > 0
      ? syncMeasuredItems(lineItems, importedItems, false, undefined, true)
      : normalizeSortOrder(importedItems);
    setLineItemsWithHistory(normalizeSortOrder(result));
    const src = report.roofData.source === 'eagleview' ? 'EagleView' : 'Roofr';
    toast.success(`Roofing quantities updated from ${src} report (${report.fileName}).`);
  };

  const applyAdditionalWallsReport = (report: AdditionalMeasurementReport, areaSourceOverride?: 'siding' | 'wall') => {
    if (!report.wallsData) return;
    const area = areaSourceOverride === 'wall'
      ? report.wallsData.totalWallAreaSqft
      : (report.wallsData.totalSidingAreaSqft || report.wallsData.totalWallAreaSqft);
    const importedItems = buildEagleViewWallsLineItems(report.wallsData, companyPricing, wallsWastePercent, area);
    if (!importedItems.length) { toast.error('No siding items generated from that report.'); return; }
    // preservePrices=true: only update quantities from the additional report —
    // never overwrite the custom or per-tier prices already on the quote items.
    const result = lineItems.length > 0
      ? syncMeasuredItems(lineItems, importedItems, false, undefined, true)
      : normalizeSortOrder(importedItems);
    setLineItemsWithHistory(normalizeSortOrder(result));
    toast.success(`Siding quantities updated from ${report.fileName}.`);
  };

  const applyWallsLineItems = () => {
    if (!wallsReport) return;
    const areaSourceSqft =
      wallsAreaSource === 'wall'    ? wallsReport.totalWallAreaSqft :
      wallsAreaSource === 'masonry' ? wallsReport.totalMasonryAreaSqft :
      wallsReport.totalSidingAreaSqft;
    let importedItems = buildEagleViewWallsLineItems(wallsReport, companyPricing, wallsWastePercent, areaSourceSqft);
    if (!importedItems.length) {
      toast.error('No siding line items were generated from that report.');
      return;
    }
    // Per-square pricing: zero all prices, then set rates on the primary siding (sq-unit) item
    if (wallsPricingMode === 'per-sq') {
      const goodRate = parseFloat(wallsPerSqGoodRate);
      const betterRate = parseFloat(wallsPerSqBetterRate);
      const bestRate = parseFloat(wallsPerSqBestRate);
      if (!isNaN(goodRate) && goodRate > 0) {
        importedItems = importedItems.map(item => ({
          ...item,
          good_price: 0,
          better_price: 0,
          best_price: 0,
          fixed_price: null,
        }));
        const sidingIdx = importedItems.findIndex(
          item => !item.is_divider && item.unit === 'sq'
        );
        if (sidingIdx >= 0) {
          const b = !isNaN(betterRate) && betterRate > 0 ? betterRate : goodRate;
          const bs = !isNaN(bestRate) && bestRate > 0 ? bestRate : b;
          importedItems[sidingIdx] = {
            ...importedItems[sidingIdx],
            good_price: goodRate,
            better_price: b,
            best_price: bs,
            description: `${importedItems[sidingIdx].description || ''} — $${goodRate.toFixed(2)}/$${b.toFixed(2)}/$${bs.toFixed(2)}/sq (Good/Better/Best all-in rate; other line items show quantities for material ordering only).`.trimStart(),
          };
        }
      }
    }
    const nextItems =
      lineItems.length > 0
        ? syncMeasuredItems(lineItems, importedItems)
        : normalizeSortOrder(importedItems);
    setLineItems(normalizeSortOrder(nextItems));
    toast.success('EagleView Walls measurements synced.');
  };

  // Apply line items from manual siding square entry — builds a synthetic EagleViewWallsReport
  // from the user-entered measurements and calls buildEagleViewWallsLineItems.
  const applyManualSidingLineItems = (opts?: { forcePricingMode?: 'standard' | 'per-sq'; targetTier?: 'good' | 'better' | 'best' }) => {
    const squares = parseFloat(manualSidingSquares);
    if (isNaN(squares) || squares <= 0) { toast.error('Enter a valid siding square count first.'); return; }

    const sidingBaseSqft = squares * 100;
    const perimeter = parseFloat(manualSidingPerimeter) || 0;
    const eaveLf = parseFloat(manualSidingEaves) || 0;
    const windows = parseInt(manualSidingWindows, 10) || 0;
    const doors = parseInt(manualSidingDoors, 10) || 0;
    const insideCorners = parseInt(manualSidingInsideCorners, 10) || 0;
    const outsideCorners = parseInt(manualSidingOutsideCorners, 10) || 0;
    const wallHeight = parseFloat(manualSidingWallHeight) || 0;

    // Build a synthetic EagleViewWallsReport from the user's manual inputs.
    // The user enters net siding area (windows/doors already excluded), so
    // totalSidingAreaSqft === totalWallAreaSqft to avoid double-subtracting openings.
    const syntheticReport: EagleViewWallsReport = {
      address: 'Manual Entry',
      source: 'eagleview-walls',
      totalWallAreaSqft: sidingBaseSqft,
      totalSidingAreaSqft: sidingBaseSqft,
      totalMasonryAreaSqft: 0,
      windowAreaSqft: 0,
      doorAreaSqft: 0,
      wallPerimeterFt: perimeter,
      eaveLinearFt: eaveLf,
      windowCount: windows,
      doorCount: doors,
      insideCornerCount: insideCorners,
      outsideCornerCount: outsideCorners,
      wallHeightFt: wallHeight,
    };

    let importedItems = buildEagleViewWallsLineItems(syntheticReport, companyPricing, manualSidingWaste, sidingBaseSqft);
    if (!importedItems.length) {
      toast.error('No siding line items were generated. Make sure you have Siding items in your price list.');
      return;
    }

    // Apply preferred siding brand products
    const activeBrand = localCompany?.preferred_siding_brand;
    if (activeBrand) {
      importedItems = importedItems.map(item => {
        const suggestions = getSidingProductSuggestions(item.item_name, activeBrand);
        return suggestions
          ? { ...item, good_product: item.good_product || suggestions.good, better_product: item.better_product || suggestions.better, best_product: item.best_product || suggestions.best }
          : item;
      });
    }

    // Per-square pricing override
    const effectivePricingMode = opts?.forcePricingMode ?? manualSidingPricingMode;
    if (effectivePricingMode === 'per-sq') {
      const goodRate   = parseFloat(manualSidingPerSqGoodRate);
      const betterRate = parseFloat(manualSidingPerSqBetterRate);
      const bestRate   = parseFloat(manualSidingPerSqBestRate);
      const hasGood   = !isNaN(goodRate)   && goodRate > 0;
      const hasBetter = !isNaN(betterRate) && betterRate > 0;
      const hasBest   = !isNaN(bestRate)   && bestRate > 0;
      if (hasGood || hasBetter || hasBest) {
        importedItems = importedItems.map(item => ({ ...item, good_price: 0, better_price: 0, best_price: 0, fixed_price: null }));
        // Target the primary siding sq item (not Siding Removal)
        const sidingIdx = importedItems.findIndex(
          item => !item.is_divider && item.unit === 'sq' &&
            !item.item_name.toLowerCase().includes('removal'),
        );
        const targetIdx = sidingIdx >= 0 ? sidingIdx : importedItems.findIndex(item => !item.is_divider && item.unit === 'sq');
        if (targetIdx >= 0) {
          const tier = opts?.targetTier;
          const firstRate = hasGood ? goodRate : hasBetter ? betterRate : bestRate;
          const effectiveGood   = tier ? (tier === 'good'   ? (hasGood   ? goodRate   : 0) : 0) : (hasGood   ? goodRate   : firstRate);
          const effectiveBetter = tier ? (tier === 'better' ? (hasBetter ? betterRate : 0) : 0) : (hasBetter ? betterRate : effectiveGood);
          const effectiveBest   = tier ? (tier === 'best'   ? (hasBest   ? bestRate   : 0) : 0) : (hasBest   ? bestRate   : effectiveBetter);
          const tierLabel = tier
            ? `${tier.charAt(0).toUpperCase() + tier.slice(1)} tier ($${(tier === 'good' ? effectiveGood : tier === 'better' ? effectiveBetter : effectiveBest).toFixed(2)}/sq all-in)`
            : `$${effectiveGood.toFixed(2)}/$${effectiveBetter.toFixed(2)}/$${effectiveBest.toFixed(2)}/sq all-in (Good/Better/Best)`;
          importedItems[targetIdx] = {
            ...importedItems[targetIdx],
            good_price:   effectiveGood,
            better_price: effectiveBetter,
            best_price:   effectiveBest,
            description: `${tierLabel}. Other items show quantities for material ordering only.`,
          };
        }
      }
    }
    // Tier-targeted sync: zero out non-targeted tiers so items only price the intended tier,
    // AND tag each item with tiers_applicable so calculateTotals() isolates it correctly.
    const sidingTierTarget = opts?.targetTier ?? (manualMeasureTier !== 'all' ? manualMeasureTier : undefined);
    if (sidingTierTarget && effectivePricingMode !== 'per-sq') {
      importedItems = importedItems.map(item => ({
        ...item,
        tiers_applicable: [sidingTierTarget],
        good_price:   sidingTierTarget === 'good'   ? item.good_price   : 0,
        better_price: sidingTierTarget === 'better' ? item.better_price : 0,
        best_price:   sidingTierTarget === 'best'   ? item.best_price   : 0,
      }));
    }

    // Merge into existing template, or replace if empty
    const result = lineItems.length > 0
      ? syncMeasuredItems(lineItems, importedItems)
      : normalizeSortOrder(importedItems);
    setLineItems(normalizeSortOrder(result));
    toast.success(`Siding quote generated — ${squares} sq. Review and adjust items below.`);
  };

  // Generate line items from manual gutter entry
  const applyManualGutterLineItems = () => {
    const gutterLf = parseFloat(manualGutterLf);
    if (isNaN(gutterLf) || gutterLf <= 0) { toast.error('Enter a valid gutter linear footage first.'); return; }

    const input: GutterManualInput = {
      style: manualGutterStyle,
      gutterLf,
      downspoutCount: parseInt(manualGutterDownspoutCount, 10) || 0,
      downspoutLf: parseFloat(manualGutterDownspoutLf) || 0,
      stories: manualGutterStories,
      gutterGuards: manualGutterGuards,
    };

    const importedItems = buildGutterLineItems(input, companyPricing);
    if (!importedItems.length) {
      toast.error('No gutter items were generated. Make sure you have Gutter items in your price list.');
      return;
    }

    const result = lineItems.length > 0
      ? syncMeasuredItems(lineItems, importedItems)
      : normalizeSortOrder(importedItems);
    setLineItems(normalizeSortOrder(result));
    toast.success(`Gutter items generated — ${gutterLf} lf. Review and adjust below.`);
  };

  // ── EagleView Solar import handlers ─────────────────────────────────────────

  const handleSolarFile = async (file: File, opts?: { fromStored?: boolean }) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload an EagleView solar PDF (Inform Advanced or SunSite™).');
      return;
    }
    setParsingSolar(true);
    try {
      const parsed = await parseEagleViewSolarReportFromFile(file);
      setSolarReport(parsed);
      setSolarFileName(file.name);
      const sq = (parsed.totalRoofAreaSqft / 100).toFixed(1);
      const isSunSite = parsed.source === 'eagleview-sunsite';
      const detail = isSunSite
        ? (parsed.southFacingAreaSqft ? `, ${parsed.southFacingAreaSqft.toLocaleString()} sq ft south-facing` : '')
        : (parsed.avgTsrfPercent ? `, avg TSRF ${parsed.avgTsrfPercent}%` : '');
      toast.success(
        `EagleView ${isSunSite ? 'SunSite™' : 'Solar'} imported — ${sq} sq, ${parsed.totalFacets} facets${detail}.`,
      );
      if (!opts?.fromStored) void saveMeasurementReportToCustomer(file, companyId, selectedCustomerId);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to parse EagleView Solar report.');
    } finally {
      setParsingSolar(false);
    }
  };

  const applySolarLineItems = () => {
    if (!solarReport) return;
    const importedItems = buildEagleViewSolarLineItems(solarReport, companyPricing);
    if (!importedItems.length) {
      toast.error('No solar line items were generated from that report.');
      return;
    }
    // Remove existing solar items (eagleview-solar-*) before adding new ones
    const withoutOld = lineItems.filter(item => !item.id.startsWith('eagleview-solar-'));
    setLineItems(normalizeSortOrder([...withoutOld, ...importedItems]));
    setMeasurementProvider('eagleview-solar');
    setMeasurementSourceName(solarFileName || 'EagleView Solar Report');
    setMeasurementData(solarReport as unknown as Record<string, unknown>);
    const panels = importedItems.find(i => i.item_name.toLowerCase().includes('panel'))?.quantity ?? 0;
    toast.success(`EagleView Solar measurements applied — ${panels} panels estimated.`);
  };


  const handleGenerateAIDescription = async () => {
    setGeneratingDescription(true);
    try {
      const description = await generateQuoteProjectDescription(companyId, {
        projectType,
        coverPageTitle,
        notes,
        customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || undefined,
        propertyAddress: [customer.address, customer.city, customer.state].filter(Boolean).join(', ') || undefined,
        lineItems: lineItems.map((item) => ({
          item_name: item.item_name,
          description: item.description,
          category: item.category,
          good_product: item.good_product || undefined,
          better_product: item.better_product || undefined,
          best_product: item.best_product || undefined,
          tiers_applicable: item.tiers_applicable || undefined,
        })),
        photoNotes: photos.map((photo) => [photo.caption, photo.notes].filter(Boolean).join(': ')),
        measurementSummary: roofrReport
          ? `${roofrReport.address || 'Property'} - ${(roofrReport.reportSummary?.totalRoofAreaSqft || roofrReport.totalRoofAreaSqft)} sqft`
          : undefined,
        perTierLabels: {
          good: perTierLabels.good ?? undefined,
          better: perTierLabels.better ?? undefined,
          best: perTierLabels.best ?? undefined,
        },
        existingDescription: projectDescription || undefined,
      });

      setProjectDescription(description);
      toast.success('Project description generated.');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to generate project description.');
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleGenerateTierDescs = async () => {
    const totals = calculateTotals();
    setGeneratingTierDescs(true);
    try {
      const descs = await suggestTierDescriptions(companyId, {
        projectType: projectType === 'exterior' ? 'exterior roofing/siding' : projectType === 'interior' ? 'interior renovation' : 'home improvement',
        goodTierName: goodTierName.trim() || 'Good',
        betterTierName: betterTierName.trim() || 'Better',
        bestTierName: bestTierName.trim() || 'Best',
        goodTotal: totals.good,
        betterTotal: totals.better,
        bestTotal: totals.best,
        lineItemSample: lineItems.slice(0, 5).map(i => i.item_name).filter(Boolean),
        goodHint: tierDescGood,
        betterHint: tierDescBetter,
        bestHint: tierDescBest,
      });
      setTierDescGood(descs.good);
      setTierDescBetter(descs.better);
      setTierDescBest(descs.best);
    } catch (err: any) {
      toast.error(err?.message || 'Unable to generate tier descriptions.');
    } finally {
      setGeneratingTierDescs(false);
    }
  };

  const handleGenerateEmailDraft = async () => {
    if (!customer.email) {
      toast.error('Add a customer email before drafting the send email.');
      return;
    }

    setDraftingEmail(true);
    try {
      const totals = calculateTotals();
      const draft = await generateQuoteEmailDraft(companyId, {
        customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer',
        quoteNumber: quoteNumber || `${inspectionOnly ? 'IC' : invoiceMode ? 'IN' : 'QT'}-${new Date().getFullYear()}-DRAFT`,
        companyName: company.name,
        projectDescription: projectDescription || coverPageTitle || 'Quote proposal',
        ...emailTierContext(),
        senderName: currentUser?.full_name || undefined,
        senderPhone: currentUser?.phone || company?.phone || undefined,
        senderEmail: currentUser?.email || company?.email || undefined,
      });
      setAiEmailDraft(draft);
      toast.success('AI email draft ready.');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to draft the customer email.');
    } finally {
      setDraftingEmail(false);
    }
  };

  const copyEmailDraft = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };


  const buildPreviewData = (): QuotePDFData => {
    const totals = calculateTotals();
    const nowIso = new Date().toISOString();
    return {
      id: quoteId || `preview-${Date.now()}`,
      quote_number: quoteNumber || `PREVIEW-${String(Date.now()).slice(-6)}`,
      status: 'draft',
      project_type: projectType,
      project_description: projectDescription,
      good_total: totals.good,
      better_total: totals.better,
      best_total: totals.best,
      cover_page_title: coverPageTitle || 'Home Restoration Proposal',
      include_about_page: includeAbout !== false,
      include_warranty_page: includeWarranty !== false,
      include_cancel_notice: includeCancel !== false,
      include_better: includeBetter !== false,
      include_best: includeBest !== false,
      show_line_item_prices: showLineItemPrices !== false,
      show_section_totals: showSectionTotals !== false,
      show_item_descriptions: showItemDescriptions !== false,
      show_upgrade_prices: showUpgradePrices !== false,
      use_manual_totals: useManualTotals,
      manual_good_total: useManualTotals ? manualGoodTotal : null,
      manual_better_total: useManualTotals ? manualBetterTotal : null,
      manual_best_total: useManualTotals ? manualBestTotal : null,
      tier_photo_good: tierPhotoGood || null,
      tier_photo_better: tierPhotoBetter || null,
      tier_photo_best: tierPhotoBest || null,
      tier_desc_good: tierDescGood || null,
      tier_desc_better: tierDescBetter || null,
      tier_desc_best: tierDescBest || null,
      good_tier_name: goodTierName.trim() || 'Good',
      better_tier_name: betterTierName.trim() || 'Better',
      best_tier_name: bestTierName.trim() || 'Best',
      quote_style: quoteStyle,
      cover_photo_url: coverPhotoUrl || null,
      cover_photo_zoom: coverPhotoZoom,
      cover_photo_offset_x: coverPhotoOffsetX,
      cover_photo_offset_y: coverPhotoOffsetY,
      sales_rep_photo_url: salesRepPhotoUrl || null,
      sales_rep_photo_zoom: salesRepPhotoZoom,
      sales_rep_photo_offset_x: salesRepPhotoOffsetX,
      sales_rep_photo_offset_y: salesRepPhotoOffsetY,
      notes,
      price_adj_pct: priceAdjPctRef.current,
      contingency_enabled: contingencyEnabled,
      completion_certificate_enabled: completionCertificateEnabled,
      quote_structure_type: quoteStructureType,
      signed_at: null,
      signed_by: null,
      signature_data: null,
      created_at: nowIso,
      customer:
        customer.first_name || customer.last_name
          ? {
            first_name: customer.first_name || '',
            last_name: customer.last_name || '',
            email: customer.email || '',
            phone: customer.phone || '',
            address: customer.address || '',
            city: customer.city || '',
            state: customer.state || '',
            zip: customer.zip || '',
            second_first_name: customer.second_first_name || '',
            second_last_name: customer.second_last_name || '',
            second_phone: customer.second_phone || '',
          }
          : undefined,
      creator: {
        full_name: currentUser.full_name,
        email: currentUser.email,
        phone: currentUser.phone || '',
      },
    };
  };

  const buildAutosaveSnapshot = () =>
    JSON.stringify({
      currentStep,
      customer,
      selectedCustomerId,
      projectType,
      projectDescription,
      coverPageTitle,
      includeAbout,
      includeWarranty,
      includeCancel,
      includeBetter,
      includeBest,
      goodTierName,
      betterTierName,
      bestTierName,
      showLineItemPrices,
      showSectionTotals,
      showItemDescriptions,
      useManualTotals,
      manualGoodTotal,
      manualBetterTotal,
      manualBestTotal,
      notes,
      lineItems,
      photos,
      tierPhotoGood,
      tierPhotoBetter,
      tierPhotoBest,
      coverPhotoUrl,
      coverPhotoZoom,
      coverPhotoOffsetX,
      coverPhotoOffsetY,
      salesRepPhotoUrl,
      salesRepPhotoZoom,
      salesRepPhotoOffsetX,
      salesRepPhotoOffsetY,
      selectedCustomPages,
      attachedFiles,
      includeBrochures,
      selectedFinancingIds,
      showFinancing,
      selectedTemplateId,
      measurementProvider,
      measurementSourceName,
      measurementData,
      roofrReport,
      roofrFileName,
      roofrWastePercent,
      roofrImportMode,
      solarReport,
      solarFileName,
      additionalReports,
      quoteNumber,
      tierDescGood,
      tierDescBetter,
      tierDescBest,
      quoteStyle,
    });

  const hasDraftContent = () =>
    Boolean(
      customer.first_name ||
      customer.last_name ||
      customer.email ||
      customer.phone ||
      customer.address ||
      projectDescription.trim() ||
      notes.trim() ||
      lineItems.length ||
      photos.length ||
      selectedCustomPages.length
    );


  const handlePreviewWithoutSaving = async () => {
    if (previewingUnsaved) return;
    setPreviewingUnsaved(true);
    try {
      // Save silently to get a real quoteId, then open the full QuotePreview
      // which supports both Professional and Classic views.
      const savedId = await handleSave(false, true);
      if (savedId) {
        onPreview(savedId, currentStep);
      } else if (quoteId) {
        // Save failed but we have an existing quote — open preview with last saved state
        toast.warning('Could not save latest changes. Showing last saved version.');
        onPreview(quoteId, currentStep);
      } else {
        toast.error('Unable to save quote before previewing. Please try again.');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Unable to generate preview right now.');
    } finally {
      setPreviewingUnsaved(false);
    }
  };

  const handleCoverPhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    setUploadingCoverPhoto(true);
    const toastId = toast.loading('Uploading cover photo…');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `cover-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const uploadResult = await Promise.race([
        supabase.storage.from('quote-photos').upload(fileName, file, { contentType: file.type, upsert: true }),
        new Promise<{ error: Error }>((_resolve, reject) =>
          setTimeout(() => reject(new Error('Upload timed out — please try again.')), 20_000)
        ),
      ]);
      if ('error' in uploadResult && uploadResult.error) throw uploadResult.error;
      const { data: urlData } = supabase.storage.from('quote-photos').getPublicUrl(fileName);
      setCoverPhotoUrl(urlData.publicUrl);
      setCoverPhotoZoom(1);
      setCoverPhotoOffsetX(50);
      setCoverPhotoOffsetY(50);
      toast.success('Cover photo uploaded', { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload cover photo', { id: toastId });
    } finally {
      setUploadingCoverPhoto(false);
    }
  };

  const handleSave = async (andSend = false, silent = false): Promise<string | null> => {
    // Prevent concurrent silent saves: the perTierLoadSaveDone (800ms) and autosave
    // (1500ms) both fire on every per-tier quote load.  Without this guard the second
    // save's DELETE runs while the first save's INSERT is in-flight, producing
    // duplicate line items in the database.
    if (silent && silentSaveInProgress.current) return null;
    if (silent) {
      silentSaveInProgress.current = true;
      setAutoSaveStatus('saving');
    } else {
      setSaving(true);
    }
    try {
      // Save or create customer
      let customerId = selectedCustomerId;
      // Create the customer whenever we have a name and no customer is linked yet.
      // Previously this was gated on (!silent || !quoteId), which caused a race:
      // if the quote was auto-saved before the name was complete, quoteId would be
      // set and all subsequent silent saves would skip customer creation permanently.
      if (!customerId && customer.first_name && customer.last_name) {
        const { data: newCustomer, error } = await supabase.from('customers').insert({
          company_id: companyId,
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          zip: customer.zip,
          second_first_name: customer.second_first_name || null,
          second_last_name: customer.second_last_name || null,
          second_phone: customer.second_phone || null,
        }).select().single();
        if (error) throw error;
        customerId = newCustomer.id;
        setSelectedCustomerId(customerId);
      } else if (customerId) {
        // Update existing customer fields when editing
        const { error } = await supabase.from('customers').update({
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          zip: customer.zip,
          second_first_name: customer.second_first_name || null,
          second_last_name: customer.second_last_name || null,
          second_phone: customer.second_phone || null,
        }).eq('id', customerId);
        if (error) throw error;
      }

      const totals = calculateTotals();
      // For multi_scope quotes, the three tier slots map to the first three options
      // sorted by sort_order (using good_price per item, same as quote_options.subtotal).
      // Using calculateTotals() here would sum ALL options' items together.
      const sortedOptsForSave = [...quoteOptions].sort((a, b) => a.sort_order - b.sort_order);
      const resolvedSaveTotals = quoteStructureType === 'multi_scope' && quoteOptions.length > 0
        ? {
            good:   lineItems.filter(i => i.quote_option_id === sortedOptsForSave[0]?.id).reduce((s, i) => s + (i.quantity ?? 0) * (i.good_price ?? 0), 0),
            better: lineItems.filter(i => i.quote_option_id === sortedOptsForSave[1]?.id).reduce((s, i) => s + (i.quantity ?? 0) * (i.good_price ?? 0), 0),
            best:   lineItems.filter(i => i.quote_option_id === sortedOptsForSave[2]?.id).reduce((s, i) => s + (i.quantity ?? 0) * (i.good_price ?? 0), 0),
          }
        : totals;
      const quoteData = {
        company_id: companyId,
        created_by: userId,
        customer_id: customerId,
        quote_number: quoteId ? undefined : `${inspectionOnly ? 'IC' : invoiceMode ? 'IN' : 'QT'}-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        // A re-send must not un-sign a quote: a signature is a fact about the
        // customer that sending a new copy cannot undo. A *view* is the
        // opposite -- it describes the version the customer opened before, so
        // carrying it past a fresh send makes a brand-new send read as
        // "viewed 21 hours ago" the moment it lands, and strands the quote in
        // 'viewed' forever (which also trips the signed-only line-item edit
        // lock on every later save). Reset to 'sent' and clear viewed_at
        // below, matching DashboardView's re-send and QuotePreview's send.
        status: andSend
          ? (existingStatus === 'signed' ? 'signed' : 'sent')
          : (quoteId && existingStatus && existingStatus !== 'draft' ? existingStatus : 'draft'),
        project_type: projectType,
        project_description: projectDescription,
        good_total: resolvedSaveTotals.good,
        better_total: resolvedSaveTotals.better,
        best_total: resolvedSaveTotals.best,
        cover_page_title: coverPageTitle,
        include_about_page: includeAbout !== false,
        include_warranty_page: includeWarranty !== false,
        include_cancel_notice: includeCancel !== false,
        include_better: includeBetter !== false,
        include_best: includeBest !== false,
        show_line_item_prices: showLineItemPrices !== false,
        show_section_totals: showSectionTotals !== false,
        show_item_descriptions: showItemDescriptions !== false,
        show_upgrade_prices: showUpgradePrices !== false,
        use_manual_totals: useManualTotals,
        manual_good_total: useManualTotals ? manualGoodTotal : null,
        manual_better_total: useManualTotals ? manualBetterTotal : null,
        manual_best_total: useManualTotals ? manualBestTotal : null,
        tier_photo_good: tierPhotoGood || null,
        tier_photo_better: tierPhotoBetter || null,
        tier_photo_best: tierPhotoBest || null,
        tier_desc_good: tierDescGood || null,
        tier_desc_better: tierDescBetter || null,
        tier_desc_best: tierDescBest || null,
        good_tier_name: goodTierName.trim() || 'Good',
        better_tier_name: betterTierName.trim() || 'Better',
        best_tier_name: bestTierName.trim() || 'Best',
        quote_style: quoteStyle,
        notes,
        price_adj_pct: priceAdjPctRef.current,
        cover_photo_url: coverPhotoUrl || null,
        cover_photo_zoom: coverPhotoZoom,
        cover_photo_offset_x: coverPhotoOffsetX,
        cover_photo_offset_y: coverPhotoOffsetY,
        show_financing: showFinancing,
        attached_files: attachedFiles,
        include_brochures: includeBrochures,
        upgrades: upgrades.map(u => ({ ...u, is_suggested: true })),
        sales_rep_photo_url: salesRepPhotoUrl || null,
        sales_rep_photo_zoom: salesRepPhotoZoom,
        sales_rep_photo_offset_x: salesRepPhotoOffsetX,
        sales_rep_photo_offset_y: salesRepPhotoOffsetY,
        measurement_report_url: measurementReportUrl || null,
        include_measurement_report: includeReportWithQuote,
        use_per_tier_items: usePerTierItems,
        quote_structure_type: quoteStructureType,
        selected_template_id: selectedTemplateId || null,
        per_tier_template_labels: usePerTierItems
          ? { good: perTierLabels.good, better: perTierLabels.better, best: perTierLabels.best }
          : null,
        // Persist per-tier template selections so Project Details highlights them on reload
        good_template_id: perTierPending.good || null,
        better_template_id: perTierPending.better || null,
        best_template_id: perTierPending.best || null,
        // Persist per-scope template selections for multi_scope quotes
        scope_template_ids: quoteStructureType === 'multi_scope'
          ? scopeConfigs.map(s => s.templateId || null)
          : null,
        contingency_enabled: contingencyEnabled,
      completion_certificate_enabled: completionCertificateEnabled,
        ...(invoiceMode && !inspectionOnly ? {
          deposit_amount: parseFloat(depositAmount) || 0,
          deposit_due_date: depositDueDate || null,
          manual_good_total: parseFloat(invoiceTotal) || 0,
          use_manual_totals: true,
          include_cancel_notice: false,
        } : {}),
        updated_at: new Date().toISOString(),
        ...(andSend ? { sent_at: new Date().toISOString() } : {}),
        // Clear the previous version's view so the dashboard doesn't report
        // the new send as already opened. Signed quotes keep their history.
        ...(andSend && existingStatus !== 'signed' ? { viewed_at: null } : {}),
      };

      let savedQuoteId = quoteId;
      const isNewQuote = !quoteId;
      let itemsForSave = lineItems;

      if (quoteId) {
        const { data: updatedRow, error } = await supabase.from('quotes').update(quoteData).eq('id', quoteId).select('id').single();
        if (error) throw error;
        if (!updatedRow) throw new Error('Quote not found — it may have been deleted. Please refresh and try again.');
        savedQuoteId = updatedRow.id;
      } else {
        const { data, error } = await supabase.from('quotes').insert({ ...quoteData, quote_number: `${inspectionOnly ? 'IC' : invoiceMode ? 'IN' : 'QT'}-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}` }).select().single();
        if (error) throw error;
        savedQuoteId = data.id;
        setQuoteId(data.id);
        setQuoteNumber(data.quote_number || '');

        // Create quote_options for new quotes
        if (quoteOptions.length === 0) {
          const optionNames = quoteStructureType === 'tiered'
            ? [goodTierName || 'Good', betterTierName || 'Better', bestTierName || 'Best']
            : scopeConfigs.map((s, i) => s.name.trim() || `Scope ${i + 1}`);
          const { data: newOptions } = await supabase.from('quote_options').insert(
            optionNames.map((name, idx) => ({ quote_id: savedQuoteId, name, sort_order: idx, subtotal: 0 }))
          ).select();
          if (newOptions) {
            setQuoteOptions(newOptions as QuoteOption[]);
            setActiveOptionId((newOptions as QuoteOption[])[0].id);

            // For multi_scope: pre-populate each scope from its assigned template
            if (quoteStructureType === 'multi_scope') {
              const preloaded: typeof lineItems = [];
              scopeConfigs.forEach((scope, idx) => {
                if (scope.templateId) {
                  const tmpl = availableTemplates.find(t => t.id === scope.templateId);
                  const optId = (newOptions as QuoteOption[])[idx]?.id;
                  if (tmpl && optId) {
                    let items = applyCompanyPricing(mapTemplateToLineItems(tmpl));
                    // Apply per-scope brand products (roof and/or siding)
                    if (scope.roofBrand || scope.sidingBrand) {
                      items = items.map(item => {
                        const roofSugg = scope.roofBrand ? getProductSuggestions(item.item_name, scope.roofBrand) : null;
                        const sidingSugg = scope.sidingBrand ? getSidingProductSuggestions(item.item_name, scope.sidingBrand) : null;
                        const sugg = roofSugg ?? sidingSugg;
                        if (!sugg) return item;
                        return {
                          ...item,
                          good_product:   item.good_product   || sugg.good,
                          better_product: item.better_product || sugg.better,
                          best_product:   item.best_product   || sugg.best,
                        };
                      });
                    }
                    items.forEach(item => {
                      preloaded.push({ ...item, quote_option_id: optId, price: item.good_price });
                    });
                  }
                }
              });
              if (preloaded.length > 0) {
                itemsForSave = preloaded;
                setLineItemsWithHistory(preloaded);
              }
            }

          }
        }

        // Offer to copy photos from source IC report (convert-to-retail flow)
        if (prefilledSourceQuoteId && savedQuoteId) {
          const { data: sourcePhotos } = await supabase
            .from('quote_photos')
            .select('photo_url, caption, notes, sort_order')
            .eq('quote_id', prefilledSourceQuoteId)
            .order('sort_order');
          // Skip anything already on this quote. The copy is keyed on photo_url
          // rather than trusting that it only ever runs once — a second pass
          // through here would otherwise add a whole second set, which is how
          // inspection photos end up doubled and tripled.
          const { data: existingPhotos } = await supabase
            .from('quote_photos')
            .select('photo_url')
            .eq('quote_id', savedQuoteId);
          const alreadyCopied = new Set((existingPhotos ?? []).map(p => p.photo_url));
          const photosToCopy = (sourcePhotos ?? []).filter(p => !alreadyCopied.has(p.photo_url));

          if (photosToCopy.length > 0) {
            const confirmed = window.confirm(
              `Copy ${photosToCopy.length} photo${photosToCopy.length !== 1 ? 's' : ''} from the inspection report into this quote?`
            );
            if (confirmed) {
              await supabase.from('quote_photos').insert(
                photosToCopy.map((p, i) => ({
                  quote_id: savedQuoteId,
                  photo_url: p.photo_url,
                  caption: p.caption,
                  notes: p.notes,
                  sort_order: p.sort_order ?? i,
                }))
              );
            }
          }
        }
      }

      // Save line items
      if (savedQuoteId) {
        // Snapshot items BEFORE delete so we can restore on partial failure
        const itemsSnapshot = itemsForSave;
        const { error: deleteItemsErr } = await supabase.from('quote_line_items').delete().eq('quote_id', savedQuoteId);
        if (deleteItemsErr) throw new Error(`Failed to clear line items: ${deleteItemsErr.message}`);
        if (itemsForSave.length > 0) {
          // Build a map from any 'preview-scope-N' placeholder IDs → real quote_option UUIDs.
          // This covers the case where the user selected templates before the first save (so
          // items got preview IDs) and then saved an already-created quote on a subsequent save.
          const sortedOpts = [...quoteOptions].sort((a, b) => a.sort_order - b.sort_order);
          const previewIdToRealId: Record<string, string> = {};
          sortedOpts.forEach((opt, idx) => {
            previewIdToRealId[`preview-scope-${idx}`] = opt.id;
          });

          const itemsToInsert = itemsForSave.map((item, i) => {
            const rawOptId = item.quote_option_id || null;
            const resolvedOptId = (rawOptId && rawOptId.startsWith('preview-scope-'))
              ? (previewIdToRealId[rawOptId] ?? null)
              : rawOptId;
            return {
            quote_id: savedQuoteId,
            category: item.category,
            item_name: item.item_name,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            good_price: item.good_price,
            better_price: item.better_price,
            best_price: item.best_price,
            fixed_price: item.fixed_price ?? false,
            good_product: item.good_product || null,
            better_product: item.better_product || null,
            best_product: item.best_product || null,
            tiers_applicable: item.tiers_applicable?.length ? item.tiers_applicable : null,
            hidden_from_customer: item.hidden_from_customer ?? false,
            // Estimator-only; never rendered on the customer's copy.
            internal_note: item.internal_note ?? null,
            quote_option_id: resolvedOptId,
            // For multi-scope items, keep price in sync with good_price to prevent display discrepancies
            price: resolvedOptId ? item.good_price : (item.price ?? null),
            product_name: item.product_name || null,
            sort_order: i,
            };
          });
          let { error: insertItemsErr } = await supabase.from('quote_line_items').insert(itemsToInsert);
          // 42501 is a row-level-security rejection. For line items that is
          // deterministic, not a blip: the quote is signed and its pricing is
          // deliberately frozen, so retrying only delays the real message.
          // Anything else gets one short delayed retry, which rides out a
          // genuinely transient failure instead of making the user notice the
          // error and re-click Save themselves.
          if (insertItemsErr && insertItemsErr.code !== '42501') {
            await new Promise(resolve => setTimeout(resolve, 700));
            ({ error: insertItemsErr } = await supabase.from('quote_line_items').insert(itemsToInsert));
          }
          if (insertItemsErr) {
            // A row-level-security rejection here means the quote is signed:
            // its line items are intentionally frozen so the pricing can't
            // drift away from what the customer actually put their signature
            // on. The preceding DELETE was filtered by that same policy
            // (Postgres filters DELETE by RLS rather than raising), so
            // nothing was removed and there is nothing to restore -- say that
            // plainly, because the generic wording below reads like data loss
            // and the raw Postgres text reads like a permissions bug.
            if (insertItemsErr.code === '42501') {
              throw new Error(
                'This quote has been signed, so its line items are locked and your changes were not saved. ' +
                'Nothing on the existing quote was altered. To revise the pricing, duplicate this quote and edit the copy.'
              );
            }
            // INSERT failed after DELETE (twice) — attempt to restore the original items so
            // the DB isn't left empty.  This is best-effort: if the restore also fails the
            // quote items are lost from the DB but still live in React state, so the user
            // can try saving again once connectivity / auth is restored.
            const restoreRows = itemsSnapshot.map((item, i) => ({
              quote_id: savedQuoteId,
              category: item.category,
              item_name: item.item_name,
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              good_price: item.good_price,
              better_price: item.better_price,
              best_price: item.best_price,
              fixed_price: item.fixed_price ?? false,
              good_product: item.good_product || null,
              better_product: item.better_product || null,
              best_product: item.best_product || null,
              tiers_applicable: item.tiers_applicable?.length ? item.tiers_applicable : null,
              quote_option_id: item.quote_option_id || null,
              price: item.price ?? null,
              product_name: item.product_name || null,
              sort_order: i,
            }));
            const { error: restoreErr } = await supabase.from('quote_line_items').insert(restoreRows);
            if (restoreErr) {
              throw new Error(
                `Your line items could not be saved and the previous version could not be restored either ` +
                `(quote=${savedQuoteId}). Please do not close this tab — try Save again, and if it keeps failing, ` +
                `reload the page before making further changes. Details: ${insertItemsErr.message}`
              );
            }
            throw new Error(`Failed to save line items (quote=${savedQuoteId}), but your previous items were restored — please try saving again. Details: ${insertItemsErr.message}`);
          }

          // Flush any remaining preview-scope-N IDs out of React state so future saves
          // always have real UUIDs (avoids the "invalid input syntax for type uuid" error
          // on subsequent saves of the same multi-scope quote).
          const hasPreviewIds = itemsForSave.some(li => li.quote_option_id?.startsWith('preview-scope-'));
          if (hasPreviewIds) {
            setLineItemsWithHistory(
              itemsForSave.map(li => ({
                ...li,
                quote_option_id: li.quote_option_id?.startsWith('preview-scope-')
                  ? (previewIdToRealId[li.quote_option_id] ?? li.quote_option_id)
                  : li.quote_option_id,
              }))
            );
          }
        }

        // Update quote_option subtotals AND names
        if (quoteOptions.length > 0) {
          if (quoteStructureType === 'multi_scope') {
            // Multi-scope: subtotals use good_price as the baseline tier.
            // Name resolution: the "Option name" input is authoritative; fall back to the
            // corresponding tier-name field if the option name is still the creation-time default.
            const sortedMulti = [...quoteOptions].sort((a, b) => a.sort_order - b.sort_order);
            const defaultNames = ['Good', 'Better', 'Best'];
            const tierNameFallbacks = [goodTierName.trim() || 'Good', betterTierName.trim() || 'Better', bestTierName.trim() || 'Best'];
            for (let i = 0; i < sortedMulti.length; i++) {
              const opt = sortedMulti[i];
              const optSubtotal = itemsForSave
                .filter(li => li.quote_option_id === opt.id)
                .reduce((sum, li) => sum + li.quantity * (li.good_price ?? 0), 0);
              // If the option name was explicitly changed via the "Option name" input, keep it.
              // Otherwise (still at the creation default), honour whatever the user typed into
              // the tier-name fields so either editing path works.
              const nameToSave = (opt.name && opt.name !== defaultNames[i])
                ? opt.name
                : (i < 3 ? tierNameFallbacks[i] : opt.name);
              await supabase.from('quote_options').update({ subtotal: optSubtotal, name: nameToSave }).eq('id', opt.id);
            }
          } else {
            // Tiered: subtotals from good/better/best price columns; names from tier name state
            const sorted = [...quoteOptions].sort((a, b) => a.sort_order - b.sort_order);
            const priceKeys = ['good_price', 'better_price', 'best_price'] as const;
            const tierNames = [goodTierName.trim() || 'Good', betterTierName.trim() || 'Better', bestTierName.trim() || 'Best'];
            for (let i = 0; i < sorted.length && i < 3; i++) {
              const key = priceKeys[i];
              const subtotal = itemsForSave.reduce((sum, item) => sum + item.quantity * (item[key] ?? 0), 0);
              await supabase.from('quote_options').update({ subtotal, name: tierNames[i] }).eq('id', sorted[i].id);
            }
          }
        }

        // Save photos
        const { error: deletePhotosErr } = await supabase.from('quote_photos').delete().eq('quote_id', savedQuoteId);
        if (deletePhotosErr) throw new Error(`Failed to clear photos: ${deletePhotosErr.message}`);
        if (photos.length > 0) {
          const photosToInsert = photos.map((photo, i) => ({
            quote_id: savedQuoteId,
            photo_url: photo.photo_url,
            caption: photo.caption,
            location: photo.location,
            damage_type: photo.damage_type,
            notes: photo.notes,
            sort_order: i,
          }));
          const { error: insertPhotosErr } = await supabase.from('quote_photos').insert(photosToInsert);
          if (insertPhotosErr) throw new Error(`Failed to save photos: ${insertPhotosErr.message}`);
        }
      }

      // Save financing links
      if (savedQuoteId && availableFinancing.length > 0) {
        await supabase.from('quote_financing').delete().eq('quote_id', savedQuoteId);
        if (selectedFinancingIds.length > 0) {
          const financingRows = selectedFinancingIds.map((fid, i) => ({
            quote_id: savedQuoteId,
            financing_option_id: fid,
            sort_order: i,
          }));
          await supabase.from('quote_financing').insert(financingRows);
        }
      }

      if (!silent) {
        if (andSend && customer.email && savedQuoteId) {
          // Get share token
          const { data: quoteRow } = await supabase.from('quotes').select('share_token').eq('id', savedQuoteId).single();
          const { error: emailErr } = await supabase.functions.invoke('send-quote-email', {
            body: {
              company_id: company.id,
              to_email: customer.email,
              to_name: `${customer.first_name} ${customer.last_name}`,
              from_company: company.name,
              from_name: company.quote_sender_name || company.name,
              from_email: company.quote_sender_email || company.email,
              reply_to_email: company.quote_reply_to_email || company.email,
              quote_number: quoteNumber || quoteData.quote_number || '',
              share_token: quoteRow?.share_token,
              quote_url: quoteUrl(quoteRow?.share_token),
              certificate_url: completionCertificateEnabled
                ? certUrl(quoteRow?.share_token)
                : undefined,
              // Deep-links straight to this quote (AppLayout's existing
              // ?view=estimate-preview&estimate_id= handler) instead of the
              // bare app origin, which just dropped the rep on the dashboard
              // home with no way to find the document they just sent.
              dashboard_url: `${window.location.origin}/?view=estimate-preview&estimate_id=${savedQuoteId}`,
              quote_total: emailTierContext().totalAmount,
              project_description: projectDescription,
              email_subject: emailDraftSubject || undefined,
              email_message: emailDraftBody || undefined,
              cc_emails: additionalEmails.split(',').map(e => e.trim()).filter(Boolean),
            }
          });
          if (emailErr) {
            toast.warning('Quote saved, but email delivery failed. Check your email settings in Settings → Company.');
          }
          await supabase.from('quotes').update({
            last_sent_subject: emailDraftSubject || null,
            last_sent_message: emailDraftBody || null,
          }).eq('id', savedQuoteId);
          toast.success('Quote saved and sent!');
          if (onSent) onSent(savedQuoteId!);
          return savedQuoteId ?? null;
        } else {
          toast.success('Quote saved!');
        }
        onSave(savedQuoteId!);
      } else {
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000);
      }
      return savedQuoteId ?? null;
    } catch (err: any) {
      if (silent) {
        setAutoSaveStatus('idle');
        console.error('[QuoteBuilder] silent save failed:', err?.message, err);
        const msg: string = err?.message ?? '';
        const isServerError = msg.includes('Failed to save') || msg.includes('JWT') ||
          msg.includes('401') || msg.includes('403') || msg.includes('token');
        if (isServerError) {
          toast.error('Auto-save failed — changes may not be saved. Try saving manually or reload the page.');
        }
      } else {
        toast.error(err.message || 'Failed to save quote');
      }
      return null;
    } finally {
      if (silent) {
        silentSaveInProgress.current = false;
      } else {
        setSaving(false);
      }
    }
  };

  const totals = calculateTotals();
  // For multi_scope quotes, map sorted options to the three tier slots so the
  // Review & Options summary shows per-option totals, not the combined sum.
  const sortedOptsForDisplay = [...quoteOptions].sort((a, b) => a.sort_order - b.sort_order);
  const displayTotals = quoteStructureType === 'multi_scope' && quoteOptions.length > 0
    ? {
        good:   lineItems.filter(i => i.quote_option_id === sortedOptsForDisplay[0]?.id).reduce((s, i) => s + (i.quantity ?? 0) * (i.good_price ?? 0), 0),
        better: lineItems.filter(i => i.quote_option_id === sortedOptsForDisplay[1]?.id).reduce((s, i) => s + (i.quantity ?? 0) * (i.good_price ?? 0), 0),
        best:   lineItems.filter(i => i.quote_option_id === sortedOptsForDisplay[2]?.id).reduce((s, i) => s + (i.quantity ?? 0) * (i.good_price ?? 0), 0),
      }
    : totals;
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);

  // For multi_scope quotes, show scope tabs even before the first autosave creates real
  // quoteOptions.  Preview entries use the same 'preview-scope-N' IDs that the
  // onClick handlers assign to lineItems, so items appear immediately.
  const effectiveScopeOptions: QuoteOption[] = quoteStructureType === 'multi_scope'
    ? (quoteOptions.length > 0
        ? quoteOptions
        : scopeConfigs.map((s, idx) => ({
            id: `preview-scope-${idx}`,
            quote_id: '',
            name: s.name.trim() || `Scope ${idx + 1}`,
            sort_order: idx,
            subtotal: 0,
          } as QuoteOption)))
    : quoteOptions;

  // Use the first effective scope as the active one if nothing is selected yet
  const effectiveActiveOptionId = activeOptionId ?? (effectiveScopeOptions[0]?.id ?? null);
  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits.length ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-3 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{inspectionOnly ? 'Inspection Report' : editQuoteId ? 'Edit Quote' : 'New Quote'}</h1>
          <p className="text-gray-500 text-sm">Build a professional proposal for your customer</p>
        </div>
        <div className="flex items-center gap-2">
          {autoSaveStatus !== 'idle' && (
            <span className={`text-xs hidden sm:inline ${autoSaveStatus === 'saving' ? 'text-amber-500' : 'text-green-600'}`}>
              {autoSaveStatus === 'saving' ? '⟳ Saving…' : '✓ Saved'}
            </span>
          )}
          {/* Top step navigation */}
          <div className="hidden sm:flex items-center gap-1 border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              title="Previous step"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs text-gray-500 font-medium">{currentStep + 1}/{activeSteps.length}</span>
            <button
              onClick={() => setCurrentStep(s => Math.min(activeSteps.length - 1, s + 1))}
              disabled={currentStep === activeSteps.length - 1}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
              title="Next step"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => handleSave(false)} disabled={saving || existingStatus === 'signed'} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Save Draft</span>
          </button>
          <button onClick={handlePreviewWithoutSaving} disabled={previewingUnsaved} className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white hover:bg-[#2d5a8e] rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
            {previewingUnsaved ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Preview</span>
          </button>
        </div>
      </div>

      {/* Signed lock banner */}
      {existingStatus === 'signed' && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <span className="text-amber-700 text-lg">🔒</span>
          <p className="text-sm font-medium text-amber-800">
            This quote has been signed and is locked. To make changes, create a Change Order.
          </p>
        </div>
      )}

      {/* Progress Steps — wraps to fit the window; labels shorten as it narrows */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 mb-8">
        {activeSteps.map((step, i) => (
          <React.Fragment key={step.id}>
            <button
              onClick={() => setCurrentStep(i)}
              title={step.label}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${i === currentStep
                ? 'bg-[#1e3a5f] text-white shadow-lg'
                : i < currentStep
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
            >
              {i < currentStep ? <Check className="w-4 h-4 flex-shrink-0" /> : <step.icon className="w-4 h-4 flex-shrink-0" />}
              {/* Full name on wide screens, short name from medium up, and on the
                  narrowest screens just the number — except the step you are on. */}
              <span className="hidden xl:inline">{step.label}</span>
              <span className="hidden md:inline xl:hidden">{step.short ?? step.label}</span>
              <span className="md:hidden">{i === currentStep ? (step.short ?? step.label) : i + 1}</span>
            </button>
            {i < activeSteps.length - 1 && <ChevronRight className="hidden sm:block w-4 h-4 text-gray-300 flex-shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {/* Step 1: Customer Info */}
        {renderStep === 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
              <button
                onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                className="text-sm text-[#1e3a5f] hover:underline font-medium"
              >
                Select Existing Customer
              </button>
            </div>

            {showCustomerSearch && (() => {
              const term = customerSearchTerm.toLowerCase().trim();
              const filtered = existingCustomers.filter(c => {
                if (!term) return true;
                const full = `${c.first_name} ${c.last_name}`.toLowerCase();
                const fullRev = `${c.last_name} ${c.first_name}`.toLowerCase();
                return (
                  c.first_name.toLowerCase().includes(term) ||
                  c.last_name.toLowerCase().includes(term) ||
                  full.includes(term) ||
                  fullRev.includes(term) ||
                  (c.address || '').toLowerCase().includes(term) ||
                  (c.city || '').toLowerCase().includes(term) ||
                  (c.email || '').toLowerCase().includes(term) ||
                  (c.phone || '').includes(term)
                );
              });
              return (
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <input
                    type="text"
                    autoFocus
                    value={customerSearchTerm}
                    onChange={e => setCustomerSearchTerm(e.target.value)}
                    placeholder="Search by name or address..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none bg-white"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {filtered.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No customers match</p>
                    ) : filtered.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { selectExistingCustomer(c); setCustomerSearchTerm(''); }}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white rounded-lg transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.first_name} {c.last_name}</p>
                          {(c.address || c.city) && (
                            <p className="text-xs text-gray-500 truncate">{[c.address, c.city].filter(Boolean).join(', ')}</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input type="text" value={customer.first_name || ''} onChange={(e) => setCustomer({ ...customer, first_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none" placeholder="John" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input type="text" value={customer.last_name || ''} onChange={(e) => setCustomer({ ...customer, last_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none" placeholder="Smith" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={customer.email || ''} onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={customer.phone || ''} onChange={(e) => setCustomer({ ...customer, phone: formatPhone(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none" placeholder="(555) 123-4567" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input type="text" value={customer.address || ''} onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none" placeholder="123 Main Street" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" value={customer.city || ''} onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none" placeholder="Dallas" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" value={customer.state || ''} onChange={(e) => setCustomer({ ...customer, state: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none" placeholder="TX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                <input type="text" value={customer.zip || ''} onChange={(e) => setCustomer({ ...customer, zip: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none" placeholder="75201" />
              </div>
            </div>
            {/* Second property owner — optional. Jointly-owned homes need both
                names on the agreement, and the co-owner is often reachable. */}
            <div className="pt-4 mt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-gray-700">Second Owner</span>
                <span className="text-xs font-medium text-gray-400">Optional</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" value={customer.second_first_name || ''} onChange={(e) => setCustomer({ ...customer, second_first_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none" placeholder="Robert" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" value={customer.second_last_name || ''} onChange={(e) => setCustomer({ ...customer, second_last_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none" placeholder="Smith" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Second Phone</label>
                  <input type="tel" value={customer.second_phone || ''} onChange={(e) => setCustomer({ ...customer, second_phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none" placeholder="(555) 000-0000" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Project Details */}
        {renderStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Project Details</h2>

            {/* Quote Structure Setup */}
            {/* For inspection reports with contingency selected, show a simple locked indicator instead of a selector */}
            {inspectionOnly && quoteStructureType === 'inspection_report' ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-indigo-200 bg-indigo-50">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">Contingency / Inspection Report</p>
                    <p className="text-xs text-indigo-600">Insurance contingency agreement · No pricing required</p>
                  </div>
                </div>
              ) : (
              <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-0.5">Quote Structure</p>
                <p className="text-xs text-gray-500">How do you want to present this quote to the customer?</p>
              </div>

              {/* Mode selector — 2 large cards (+ Inspection Report card in inspectionOnly mode) */}
              <div className="grid grid-cols-2 gap-3">
                {inspectionOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuoteStructureType('inspection_report');
                      setContingencyEnabled(true);
                    }}
                    className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition-all col-span-2 ${
                      quoteStructureType === 'inspection_report'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${quoteStructureType === 'inspection_report' ? 'bg-indigo-600' : 'bg-gray-100'}`}>
                        <Shield className={`w-4 h-4 ${quoteStructureType === 'inspection_report' ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <span className={`text-sm font-semibold ${quoteStructureType === 'inspection_report' ? 'text-indigo-900' : 'text-gray-700'}`}>Contingency / Inspection Report</span>
                      {quoteStructureType === 'inspection_report' && <span className="ml-auto text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full">Selected</span>}
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">Inspection report · Customer signs insurance contingency agreement</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">Insurance Contingency</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">3-Day Right to Cancel</span>
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setQuoteStructureType('tiered');
                    setUsePerTierItems(false);
                    if (inspectionOnly) setContingencyEnabled(false);
                  }}
                  className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition-all ${
                    quoteStructureType !== 'multi_scope'
                      ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${quoteStructureType !== 'multi_scope' ? 'bg-[#1e3a5f]' : 'bg-gray-100'}`}>
                      <svg className={`w-4 h-4 ${quoteStructureType !== 'multi_scope' ? 'text-white' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <span className={`text-sm font-semibold ${quoteStructureType !== 'multi_scope' ? 'text-[#1e3a5f]' : 'text-gray-700'}`}>Quality Tiers</span>
                    {quoteStructureType !== 'multi_scope' && <span className="ml-auto text-[10px] font-bold text-[#1e3a5f] bg-[#1e3a5f]/10 px-1.5 py-0.5 rounded-full">Selected</span>}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">One project · Customer picks Good, Better, or Best</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">Atlas ProLam</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100">Pinnacle Pristine</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-100">StormMaster</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setQuoteStructureType('multi_scope'); if (inspectionOnly) setContingencyEnabled(false); }}
                  className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition-all ${
                    quoteStructureType === 'multi_scope'
                      ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${quoteStructureType === 'multi_scope' ? 'bg-[#1e3a5f]' : 'bg-gray-100'}`}>
                      <svg className={`w-4 h-4 ${quoteStructureType === 'multi_scope' ? 'text-white' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    </div>
                    <span className={`text-sm font-semibold ${quoteStructureType === 'multi_scope' ? 'text-[#1e3a5f]' : 'text-gray-700'}`}>Separate Scopes</span>
                    {quoteStructureType === 'multi_scope' && <span className="ml-auto text-[10px] font-bold text-[#1e3a5f] bg-[#1e3a5f]/10 px-1.5 py-0.5 rounded-full">Selected</span>}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">Multiple projects · Customer can accept any scope</p>
                  <div className="flex flex-col gap-1 mt-0.5 w-full">
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-600 font-medium border border-slate-100">Asphalt Shingle</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-600 font-medium border border-slate-100">Corrugated Metal</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-600 font-medium border border-slate-100">Standing Seam</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-600 font-medium border border-slate-100">Asphalt Shingle</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-600 font-medium border border-slate-100">Siding</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-600 font-medium border border-slate-100">Gutters</span>
                    </div>
                  </div>
                </button>
              </div>

              {/* Insurance Supplement — full-width card below the 2-col grid */}
              <button
                type="button"
                onClick={() => {
                  setQuoteStructureType('insurance_supplement');
                  setContingencyEnabled(false);
                  setIncludeBetter(false);
                  setIncludeBest(false);
                  if (inspectionOnly) setContingencyEnabled(false);
                }}
                className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition-all w-full ${
                  quoteStructureType === 'insurance_supplement'
                    ? 'border-sky-500 bg-sky-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${quoteStructureType === 'insurance_supplement' ? 'bg-sky-600' : 'bg-gray-100'}`}>
                    <svg className={`w-4 h-4 ${quoteStructureType === 'insurance_supplement' ? 'text-white' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <span className={`text-sm font-semibold ${quoteStructureType === 'insurance_supplement' ? 'text-sky-900' : 'text-gray-700'}`}>Insurance Supplement</span>
                  {quoteStructureType === 'insurance_supplement' && <span className="ml-auto text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-full">Selected</span>}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">Scope &amp; photos to send directly to the insurance company — no contingency agreement, no signature page</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-medium border border-sky-100">Scope of Work</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-medium border border-sky-100">Photos</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-medium border border-sky-100">No Signature Required</span>
                </div>
              </button>

              {/* Quality Tiers: template card grid */}
              {quoteStructureType !== 'multi_scope' && quoteStructureType !== 'inspection_report' && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-600">Choose a starting template <span className="text-gray-400 font-normal">(loads line items — you can customize after)</span></p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableTemplates.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (editQuoteId && lineItems.length > 0 && selectedTemplateId !== t.id) {
                            if (!window.confirm(`Replace all line items with the "${t.name}" template? This cannot be undone.`)) return;
                          }
                          applyProjectTemplate(t);
                          setSelectedTemplateId(t.id);
                          setUsePerTierItems(false);
                          setQuoteStructureType('tiered');
                          setPerTierPending({ good: t.id, better: t.id, best: t.id });
                        }}
                        className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${
                          selectedTemplateId === t.id
                            ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <span className={`text-xs font-semibold leading-tight ${selectedTemplateId === t.id ? 'text-[#1e3a5f]' : 'text-gray-800'}`}>{t.name}</span>
                        {(t as any).description && (
                          <span className="text-[10px] text-gray-400 leading-tight line-clamp-2">{(t as any).description}</span>
                        )}
                        {selectedTemplateId === t.id && (
                          <span className="text-[10px] font-bold text-emerald-600 mt-0.5">✓ Active</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">💡 Same project with three material quality levels (e.g. Atlas ProLam / Pinnacle Pristine / StormMaster)? Pick the same template above, then adjust prices per tier in Line Items.</p>
                </div>
              )}

              {/* Separate Scopes: 3 scope rows with dropdowns */}
              {quoteStructureType === 'multi_scope' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600">Configure up to 3 project scopes <span className="text-gray-400 font-normal">(customer can accept any or all)</span></p>
                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
                    {([
                      { tier: 'good' as const, badge: 'bg-emerald-100 text-emerald-700', scopeIdx: 0, nameValue: goodTierName, nameSetter: setGoodTierName, defaultName: 'Scope 1' },
                      { tier: 'better' as const, badge: 'bg-blue-100 text-blue-700', scopeIdx: 1, nameValue: betterTierName, nameSetter: setBetterTierName, defaultName: 'Scope 2' },
                      { tier: 'best' as const, badge: 'bg-amber-100 text-amber-700', scopeIdx: 2, nameValue: bestTierName, nameSetter: setBestTierName, defaultName: 'Scope 3' },
                    ]).map(({ tier, badge, scopeIdx, nameValue, nameSetter, defaultName }) => {
                      const loadedLabel = perTierLabels[tier];
                      return (
                        <div key={tier} className="flex items-center gap-2 px-3 py-2.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 w-16 text-center ${badge}`}>
                            {nameValue || defaultName}
                          </span>
                          <select
                            value={perTierPending[tier]}
                            onChange={e => {
                              const newTemplateId = e.target.value;
                              const next = { ...perTierPending, [tier]: newTemplateId };
                              setPerTierPending(next);
                              if (!newTemplateId) {
                                // Clear scopeConfigs entry
                                setScopeConfigs(prev => prev.map((s, i) => i === scopeIdx ? { ...s, templateId: null } : s));
                                return;
                              }
                              const tmpl = availableTemplates.find(t => t.id === newTemplateId);
                              if (!tmpl) return;
                              // Auto-name the scope from the template if not yet named
                              const autoName = !nameValue || nameValue === defaultName
                                ? tmpl.name.split(' ').slice(0, 2).join(' ')
                                : nameValue;
                              if (!nameValue || nameValue === defaultName) {
                                nameSetter(autoName);
                              }
                              // Update scopeConfigs so the save logic picks up this template
                              setScopeConfigs(prev => prev.map((s, i) =>
                                i === scopeIdx ? { ...s, templateId: newTemplateId, name: autoName } : s
                              ));
                              if (!usePerTierItems) {
                                setUsePerTierItems(true);
                                setLineItemsWithHistory(prev =>
                                  prev.map(item => ({
                                    ...item,
                                    tiers_applicable: item.tiers_applicable?.length ? item.tiers_applicable : ['good'],
                                  }))
                                );
                              }
                              const scopeOptId = effectiveScopeOptions[scopeIdx]?.id;
                              loadTemplateForTier(tier, tmpl, scopeOptId);
                              setSelectedTemplateId(null);
                            }}
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 min-w-0"
                          >
                            <option value="">Select project type…</option>
                            {availableTemplates.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={nameValue}
                            onChange={e => {
                              nameSetter(e.target.value);
                              setScopeConfigs(prev => prev.map((s, i) => i === scopeIdx ? { ...s, name: e.target.value } : s));
                            }}
                            maxLength={20}
                            placeholder={defaultName}
                            className="w-24 shrink-0 px-2 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                          />
                          {loadedLabel && (
                            <span className="text-[11px] text-emerald-600 font-medium shrink-0 hidden sm:inline">✓</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400">Each scope gets its own line items and pricing. The customer can accept Roofing only, Siding only, or both.</p>
                </div>
              )}
            </div>
            )}

            {selectedTemplateId && lineItems.length > 0 && !inspectionOnly && (() => {
              const activeTmpl = availableTemplates.find(t => t.id === selectedTemplateId);
              if (!activeTmpl) return null;
              return (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <p className="text-xs text-amber-800">
                    <span className="font-semibold">{activeTmpl.name}</span> template is active · {lineItems.length} items loaded
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Reset all line items to the "${activeTmpl.name}" template defaults? This cannot be undone.`)) {
                        setLineItemsWithHistory(applyCompanyPricing(mapTemplateToLineItems(activeTmpl)));
                        toast.success(`Items reset to "${activeTmpl.name}" template.`);
                      }
                    }}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline ml-4 shrink-0"
                  >
                    Reset Items
                  </button>
                </div>
              );
            })()}


            {!inspectionOnly && <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
              <div className="flex gap-3">
                {(['exterior', 'interior', 'both'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setProjectType(type)}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium capitalize transition-all ${projectType === type
                      ? 'border-[#1e3a5f] bg-blue-50 text-[#1e3a5f]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                  >
                    {type === 'both' ? 'Interior & Exterior' : type}
                  </button>
                ))}
              </div>
            </div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cover Page Title</label>
              <input type="text" value={coverPageTitle} onChange={(e) => setCoverPageTitle(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none" />
            </div>

            {/* Sales Rep Photo */}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">Your Representative Photo <span className="font-normal text-gray-400">(optional)</span></p>
              <div className="flex items-center gap-3">
                {/* Circular preview */}
                <div
                  className="relative shrink-0 rounded-full overflow-hidden bg-gray-100 shadow-sm"
                  style={{ width: 56, height: 56, border: '2.5px solid #ff6b35' }}
                >
                  {salesRepPhotoUrl ? (
                    <FramedPhotoPreview
                      photoUrl={salesRepPhotoUrl}
                      zoom={salesRepPhotoZoom}
                      offsetX={salesRepPhotoOffsetX}
                      offsetY={salesRepPhotoOffsetY}
                      className="absolute inset-0 w-full h-full"
                      shape="circle"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                </div>

                {/* Controls + focal editor */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-medium transition-colors">
                      {uploadingSalesRepPhoto ? <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Upload className="w-3 h-3" />}
                      {uploadingSalesRepPhoto ? 'Uploading…' : salesRepPhotoUrl ? 'Change' : 'Upload'}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingSalesRepPhoto} onChange={e => { const f = e.target.files?.[0]; if (f) handleSalesRepPhotoUpload(f); e.target.value = ''; }} />
                    </label>
                    {salesRepPhotoUrl && (
                      <button onClick={() => { setSalesRepPhotoUrl(''); setSalesRepPhotoZoom(1); setSalesRepPhotoOffsetX(50); setSalesRepPhotoOffsetY(50); }} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Remove">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {salesRepPhotoUrl && (
                    <PhotoPositionEditor
                      photoUrl={salesRepPhotoUrl}
                      zoom={salesRepPhotoZoom}
                      offsetX={salesRepPhotoOffsetX}
                      offsetY={salesRepPhotoOffsetY}
                      onZoomChange={setSalesRepPhotoZoom}
                      onOffsetChange={(x, y) => { setSalesRepPhotoOffsetX(x); setSalesRepPhotoOffsetY(y); }}
                      shape="circle"
                      editorHeight={200}
                      hint="Drag the photo to reposition · use the slider to zoom."
                    />
                  )}
                  {!salesRepPhotoUrl && <p className="text-xs text-gray-400">Circular headshot on your quote cover page.</p>}
                </div>
              </div>
            </div>

            {/* Cover Photo — optional suggestion */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Cover Photo
                  <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">Optional</span>
                </label>
                {!coverPhotoUrl && (
                  <span className="text-xs text-[#ff6b35] font-medium flex items-center gap-1">
                    💡 A photo of the home makes a great first impression
                  </span>
                )}
              </div>
              {coverPhotoUrl ? (
                <div className="space-y-2">
                  <div className="relative">
                    <PhotoPositionEditor
                      photoUrl={coverPhotoUrl}
                      zoom={coverPhotoZoom}
                      offsetX={coverPhotoOffsetX}
                      offsetY={coverPhotoOffsetY}
                      onZoomChange={setCoverPhotoZoom}
                      onOffsetChange={(x, y) => { setCoverPhotoOffsetX(x); setCoverPhotoOffsetY(y); }}
                      shape="rect"
                      editorHeight={176}
                      hint="Drag the photo to reposition · use the slider to zoom."
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <label className="cursor-pointer px-3 py-1.5 text-xs font-medium bg-white/95 text-gray-700 rounded-lg shadow hover:bg-white transition-colors">
                        Change
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleCoverPhotoUpload(e.target.files[0])} />
                      </label>
                      <button onClick={() => { setCoverPhotoUrl(''); setCoverPhotoZoom(1); setCoverPhotoOffsetX(50); setCoverPhotoOffsetY(50); }} className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-colors flex items-center gap-1">
                        <X className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-[#1e3a5f] hover:bg-blue-50/40 transition-all group">
                  {uploadingCoverPhoto ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 text-[#1e3a5f] animate-spin" />
                      <p className="text-sm text-gray-500">Uploading…</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 justify-center">
                      <div className="w-9 h-9 bg-gray-100 group-hover:bg-blue-100 rounded-lg flex items-center justify-center transition-colors shrink-0">
                        <Camera className="w-4.5 h-4.5 text-gray-400 group-hover:text-[#1e3a5f] transition-colors" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-600 group-hover:text-[#1e3a5f] transition-colors">Add a photo of the property</p>
                        <p className="text-xs text-gray-400">JPG or PNG · Appears as the cover background · Skipping is totally fine</p>
                      </div>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleCoverPhotoUpload(e.target.files[0])} />
                </label>
              )}
            </div>

            {/* Why Clients Choose Us — info + quick link to settings */}
            <div className="flex items-start justify-between gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-800 mb-0.5">Why Clients Choose Us</p>
                <p className="text-xs text-blue-600 leading-relaxed">
                  {company.about_highlights && company.about_highlights.length > 0
                    ? `${company.about_highlights.length} reason${company.about_highlights.length === 1 ? '' : 's'} configured — shown in the sidebar of your cover page.`
                    : 'Using default reasons. Customize these to reflect your company\'s strengths.'}
                </p>
              </div>
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => onOpenSettings('company')}
                  className="shrink-0 text-xs font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2 whitespace-nowrap"
                >
                  Edit →
                </button>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Project Description</label>
                <button
                  onClick={handleGenerateDescription}
                  disabled={aiGeneratingDesc}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-[#1e3a5f] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiGeneratingDesc
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />}
                  {aiGeneratingDesc ? 'Generating…' : '✨ Generate with AI'}
                </button>
              </div>
              <textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)}
                rows={3} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none resize-none"
                placeholder="Describe the scope of work, or click Generate with AI…" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none resize-none"
                placeholder="Any additional notes for the customer..." />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Document Sections</h3>
              {[
                { label: 'Include About Company Page', value: includeAbout, setter: setIncludeAbout },
                { label: 'Include Warranty Page', value: includeWarranty, setter: setIncludeWarranty },
                { label: 'Include 3-Day Right to Cancel', value: includeCancel, setter: setIncludeCancel },
              ].map((toggle, i) => (
                <label key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <span className="text-sm text-gray-700">{toggle.label}</span>
                  <div className={`w-10 h-6 rounded-full transition-colors relative ${toggle.value ? 'bg-[#1e3a5f]' : 'bg-gray-300'}`}
                    onClick={() => toggle.setter(!toggle.value)}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${toggle.value ? 'left-5' : 'left-1'}`} />
                  </div>
                </label>
              ))}
              {!inspectionOnly && <div className="border-t border-gray-200 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pricing Display</p>
                <p className="text-xs text-gray-400 mb-3">Control what pricing information customers see on their quote.</p>
                {[
                  { label: 'Show individual line item prices', value: showLineItemPrices, setter: setShowLineItemPrices },
                  { label: 'Show section subtotals', value: showSectionTotals, setter: setShowSectionTotals },
                  { label: 'Show item descriptions', value: showItemDescriptions, setter: setShowItemDescriptions },
                ].map((toggle, i) => (
                  <label key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors mb-2">
                    <div>
                      <span className="text-sm text-gray-700">{toggle.label}</span>
                      {!showLineItemPrices && !showSectionTotals && i === 1 && (
                        <p className="text-xs text-amber-600 mt-0.5">Only project totals will be shown</p>
                      )}
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-colors relative ${toggle.value ? 'bg-emerald-500' : 'bg-gray-300'}`}
                      onClick={() => toggle.setter(!toggle.value)}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${toggle.value ? 'left-5' : 'left-1'}`} />
                    </div>
                  </label>
                ))}
                  {!showLineItemPrices && !showSectionTotals && (
                    <div className="mt-3 border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-blue-900">Set Total Price Manually</p>
                          <p className="text-xs text-blue-600 mt-0.5">Enter a flat total for each tier instead of calculating from line items.</p>
                        </div>
                        <div
                          className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${useManualTotals ? 'bg-blue-600' : 'bg-gray-300'}`}
                          onClick={() => setUseManualTotals(v => !v)}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${useManualTotals ? 'left-5' : 'left-1'}`} />
                        </div>
                      </div>
                      {useManualTotals && (
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Good Total', value: manualGoodTotal, setter: setManualGoodTotal, color: 'border-emerald-300 bg-emerald-50 focus:ring-emerald-400' },
                            { label: 'Better Total', value: manualBetterTotal, setter: setManualBetterTotal, color: 'border-blue-300 bg-blue-50 focus:ring-blue-400' },
                            { label: 'Best Total', value: manualBestTotal, setter: setManualBestTotal, color: 'border-amber-300 bg-amber-50 focus:ring-amber-400' },
                          ].map(f => (
                            <div key={f.label}>
                              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-sm text-gray-400">$</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={100}
                                  value={f.value}
                                  onChange={e => f.setter(parseFloat(e.target.value) || 0)}
                                  className={`w-full pl-6 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:border-transparent outline-none ${f.color}`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
              </div>}
              {/* Tiered quotes only. With separate scopes each scope is its own
                  priced option, so these toggles govern nothing — leaving them
                  visible made a scoped quote look like it had been reduced to a
                  single price when it still had three scopes. */}
              {!inspectionOnly && quoteStructureType === 'multi_scope' && (
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Included Pricing Options</p>
                  <p className="text-xs text-gray-400">
                    This quote uses separate scopes, so each scope is priced as its own option on the customer proposal.
                    Good / Better / Best do not apply — manage the options in the Line Items step.
                  </p>
                </div>
              )}
              {!inspectionOnly && quoteStructureType !== 'multi_scope' && <div className="border-t border-gray-200 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Included Pricing Options</p>
                <p className="text-xs text-gray-400 mb-3">Good is always included. Toggle off Better or Best to send a single-price quote.</p>
                {[
                  { label: 'Include Better Option', value: includeBetter, setter: setIncludeBetter },
                  { label: 'Include Best Option', value: includeBest, setter: setIncludeBest },
                ].map((toggle, i) => (
                  <label key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors mb-2">
                    <span className="text-sm text-gray-700">{toggle.label}</span>
                    <div className={`w-10 h-6 rounded-full transition-colors relative ${toggle.value ? 'bg-[#ff6b35]' : 'bg-gray-300'}`}
                      onClick={() => toggle.setter(!toggle.value)}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${toggle.value ? 'left-5' : 'left-1'}`} />
                    </div>
                  </label>
                ))}
                {!includeBetter && !includeBest && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <p className="text-xs text-emerald-700 font-medium">Single Price Mode — one price, one project. Tier labels are hidden from your customer.</p>
                  </div>
                )}
              </div>}
            </div>
          </div>
        )}

        {/* Step 3: Contingency Agreement (inspection reports only) */}
        {renderStep === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Contingency Agreement</h2>
              <p className="text-sm text-gray-500 mt-1">Enable this to attach an Insurance Contingency Agreement and 3-Day Right to Cancel to the report. The customer will sign both forms digitally when they view the report.</p>
            </div>

            {/* Toggle */}
            <button
              type="button"
              onClick={() => setContingencyEnabled(v => !v)}
              className={`w-full flex items-center justify-between gap-4 p-4 rounded-xl border-2 transition-all ${contingencyEnabled ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${contingencyEnabled ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                  <Shield className={`w-5 h-5 ${contingencyEnabled ? 'text-indigo-600' : 'text-gray-400'}`} />
                </div>
                <div className="text-left">
                  <p className={`font-semibold ${contingencyEnabled ? 'text-indigo-900' : 'text-gray-700'}`}>Include Contingency Agreement</p>
                  <p className="text-xs text-gray-500 mt-0.5">Customer signs insurance contingency + 3-day right to cancel</p>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${contingencyEnabled ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mt-0.5 ${contingencyEnabled ? 'translate-x-6 ml-0.5' : 'translate-x-0.5 ml-0'}`} />
              </div>
            </button>

            {contingencyEnabled && (
              <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden">
                <div className="bg-indigo-700 px-5 py-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-white" />
                  <span className="text-sm font-bold text-white uppercase tracking-wide">Insurance Contingency Agreement — Preview</span>
                </div>
                <div className="p-5 space-y-4 text-sm text-gray-700">
                  <p className="text-xs text-gray-500 italic">This document will be shown to the customer for signature when they open the report.</p>

                  <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-center">
                    <p className="font-bold text-amber-900 text-sm">⚠ THREE (3) BUSINESS DAY RIGHT TO CANCEL</p>
                    <p className="text-xs text-amber-800 mt-1">You may cancel this agreement without penalty within 3 business days of signing.</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      ['1. Contingency Basis', 'This Agreement is entered into on a contingency basis. No restoration or repair work will be performed and no payment will be due from the Property Owner unless and until the Property Owner\'s insurance carrier approves a claim for the repair or replacement of damage to the property described herein.'],
                      ['2. Authorization to Act', 'Property Owner hereby authorizes Contractor to communicate directly with Property Owner\'s insurance company, insurance adjuster, and any related parties on Property Owner\'s behalf for the sole purpose of facilitating the insurance claim and scope of approved repairs. This authorization does not constitute assignment of benefits.'],
                      ['3. Scope of Work', 'Contractor agrees to perform all work as outlined and approved in the final insurance scope of loss issued by the insurance carrier. Any supplements or additional line items identified during the course of the project that are approved by the insurance carrier shall be included in the final contract price.'],
                      ['4. Payment Terms', 'Property Owner agrees to pay Contractor all insurance proceeds received from the insurance carrier for covered repairs, including any recoverable depreciation released upon completion of work, all approved supplements, and the applicable insurance deductible as stated in the Property Owner\'s policy. Property Owner shall not profit from the insurance claim proceeds beyond the cost of the completed work.'],
                      ['5. No Out-of-Pocket Cost Representation', 'Contractor makes no guarantee that Property Owner will owe nothing beyond the deductible. Final amounts owed are determined by the insurance carrier\'s approved scope and applicable policy terms.'],
                      ['6. Property Owner Responsibilities', 'Property Owner agrees to promptly provide Contractor with all insurance documentation, adjuster reports, and claim correspondence. Property Owner shall not independently settle or close the insurance claim without written consent from Contractor while this Agreement is in effect.'],
                      ['7. Contractor Obligations', 'Contractor agrees to provide professional workmanship meeting or exceeding industry standards, maintain all required licenses and insurance coverage, and pursue all legitimate supplements on behalf of the Property Owner at no additional charge to the Property Owner beyond the approved insurance scope.'],
                      ['8. Cancellation', 'Either party may cancel this Agreement within three (3) business days of execution without penalty. After the three-day rescission period, cancellation by the Property Owner after work has commenced may result in liability for costs incurred by Contractor up to the date of cancellation.'],
                    ].map(([title, body]) => (
                      <div key={title as string}>
                        <p className="font-semibold text-gray-900 text-xs">{title as string}</p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{body as string}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3 text-xs text-gray-500">
                    <p className="font-semibold text-gray-700 mb-1">Customer will provide:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Printed name</li>
                      <li>Digital signature on the contingency agreement</li>
                      <li>Digital signature on the 3-day right to cancel</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {!contingencyEnabled && (
              <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <AlertTriangle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-500">When disabled, the report will be sent without any agreement — the customer can view photos and notes only. Enable the toggle above to collect a signed contingency agreement.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Invoice Details (invoiceMode) OR Line Items (standard) */}
        {renderStep === 4 && invoiceMode && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Invoice Details</h2>
              <p className="text-sm text-gray-500 mt-1">Enter the insurance-approved project total and deposit information.</p>
            </div>

            {/* Total */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Project Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoiceTotal}
                    onChange={e => setInvoiceTotal(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-4 py-3 border border-gray-300 rounded-xl text-lg font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit / Down Payment</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Due Date <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="date"
                  value={depositDueDate}
                  onChange={e => setDepositDueDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Balance summary */}
            {invoiceTotal && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-2">
                <div className="flex justify-between text-sm text-indigo-700">
                  <span>Project Total</span>
                  <span className="font-semibold">${parseFloat(invoiceTotal || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                {depositAmount && parseFloat(depositAmount) > 0 && (
                  <div className="flex justify-between text-sm text-indigo-700">
                    <span>Deposit Due</span>
                    <span className="font-semibold">− ${parseFloat(depositAmount || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {depositAmount && parseFloat(depositAmount) > 0 && (
                  <div className="flex justify-between text-sm font-bold text-indigo-900 border-t border-indigo-200 pt-2 mt-2">
                    <span>Balance Due at Completion</span>
                    <span>${(parseFloat(invoiceTotal || '0') - parseFloat(depositAmount || '0')).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {renderStep === 5 && !invoiceMode && (
          <div className="space-y-4">

            {/* ── Measurement summary — pinned at the top so it's visible without
                 scrolling down to the Import Measurements card below ── */}
            {(roofrReport || solarReport || additionalReports.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5">
                <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                {roofrReport && (
                  <span className="text-xs font-semibold text-emerald-800 bg-white border border-emerald-200 rounded-full px-2.5 py-1">
                    {roofrReport.source === 'eagleview' ? 'EagleView' : 'Roofr'}: {roofrReport.address || roofrFileName} · {(((roofrReport.reportSummary?.totalRoofAreaSqft ?? 0) || roofrReport.totalRoofAreaSqft) / 100).toFixed(1)} sq
                    {roofrReport.structures.length > 1 && ` · ${roofrReport.structures.length} structures`}
                  </span>
                )}
                {solarReport && (
                  <span className="text-xs font-semibold text-emerald-800 bg-white border border-emerald-200 rounded-full px-2.5 py-1">
                    Solar: {solarReport.address || solarFileName} · {solarReport.totalRoofAreaSqft.toFixed(0)} sqft
                  </span>
                )}
                {additionalReports.map(r => (
                  <span key={r.id} className="text-xs font-semibold text-emerald-800 bg-white border border-emerald-200 rounded-full px-2.5 py-1">
                    {r.fileName}
                    {r.wallsData && ` · ${r.wallsData.totalSidingAreaSqft.toFixed(0)} sqft siding`}
                    {r.roofData && ` · ${(r.roofData.totalRoofAreaSqft / 100).toFixed(1)} sq`}
                  </span>
                ))}
              </div>
            )}

            {/* ── Quick Per-Square Quote ── */}
            {(() => {
              const hasRates = !!(manualPerSqGoodRate && parseFloat(manualPerSqGoodRate) > 0);
              const hasSq   = !!(manualSquares && parseFloat(manualSquares) > 0);
              const isActive = hasRates || hasSq;
              return (
                <div className={`border rounded-2xl overflow-hidden transition-colors ${isActive ? 'border-orange-200 bg-orange-50/20' : 'border-gray-200 bg-white'}`}>
                  <button
                    type="button"
                    onClick={() => setQuickPerSqOpen(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#ff6b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Quick Per-Square Quote</p>
                        <p className="text-xs text-gray-500">Skip the itemized breakdown — just enter squares + $/sq</p>
                      </div>
                    </div>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${quickPerSqOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  {quickPerSqOpen && (() => {
                    const sq  = parseFloat(manualSquares) || 0;
                    const qty = sq * (1 + manualWaste / 100);
                    const g   = parseFloat(manualPerSqGoodRate)   || 0;
                    const b   = parseFloat(manualPerSqBetterRate) || g;
                    const bs  = parseFloat(manualPerSqBestRate)   || b;
                    const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
                    const tiers = [
                      { key: 'good',   label: goodTierName   || 'Good',   val: manualPerSqGoodRate,   set: setManualPerSqGoodRate,   rate: g,  color: 'text-emerald-700', ring: 'focus:ring-emerald-400' },
                      { key: 'better', label: betterTierName || 'Better', val: manualPerSqBetterRate, set: setManualPerSqBetterRate, rate: b,  color: 'text-blue-700',    ring: 'focus:ring-blue-400' },
                      { key: 'best',   label: bestTierName   || 'Best',   val: manualPerSqBestRate,   set: setManualPerSqBestRate,   rate: bs, color: 'text-amber-700',   ring: 'focus:ring-amber-400' },
                    ] as const;
                    return (
                      <div className="px-4 pb-4 border-t border-orange-100 space-y-3 pt-3">
                        {/* Squares + Waste */}
                        <div className="flex flex-wrap gap-4 items-end">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Total Squares</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number" min="1" step="0.5"
                                value={manualSquares}
                                onChange={e => setManualSquares(e.target.value)}
                                placeholder="e.g. 27"
                                className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                              />
                              <span className="text-xs text-gray-400">sq</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Waste %</label>
                            <div className="flex gap-1.5">
                              {[0, 10, 12, 15].map(pct => (
                                <button key={pct} type="button" onClick={() => setManualWaste(pct)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${manualWaste === pct ? 'bg-orange-500 text-white' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-orange-300'}`}>
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Tier rate inputs */}
                        <div className="grid gap-2">
                          {tiers.map(({ key, label, val, set, rate: r, color, ring }) => {
                            const total = r > 0 && qty > 0 ? r * qty : null;
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <span className={`text-xs font-bold shrink-0 whitespace-nowrap min-w-[3.5rem] ${color}`}>{label}</span>
                                <div className="flex items-center gap-1 flex-1">
                                  <span className="text-xs text-gray-400">$</span>
                                  <input
                                    type="number" min={0} step={5} placeholder="0"
                                    value={val}
                                    onChange={e => set(e.target.value)}
                                    className={`flex-1 px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:ring-2 ${ring} focus:border-transparent outline-none`}
                                  />
                                  <span className="text-xs text-gray-400 shrink-0">/sq</span>
                                </div>
                                {total !== null && (
                                  <span className={`text-sm font-bold w-20 text-right tabular-nums shrink-0 ${color}`}>{fmt(total)}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {sq > 0 && manualWaste > 0 && (
                          <p className="text-[10px] text-gray-400">{sq} sq + {manualWaste}% waste = <span className="font-semibold">{qty.toFixed(1)} sq</span> installed</p>
                        )}

                        {/* Per-tier generate buttons */}
                        <div className="grid grid-cols-3 gap-2">
                          {tiers.map(({ key, label, rate: r, color, ring }) => {
                            const canGen = sq > 0 && r > 0;
                            const btnColors: Record<string, string> = {
                              good:   'bg-emerald-600 hover:bg-emerald-700',
                              better: 'bg-blue-600 hover:bg-blue-700',
                              best:   'bg-amber-500 hover:bg-amber-600',
                            };
                            return (
                              <button
                                key={key}
                                type="button"
                                disabled={!canGen}
                                onClick={() => {
                                  if (lineItems.length > 0) {
                                    if (!window.confirm(`Replace all existing line items with the ${label} per-square breakdown?`)) return;
                                  }
                                  applyManualSquaresLineItems({ forcePricingMode: 'per-sq', targetTier: key });
                                  setShowLineItemPrices(false);
                                }}
                                className={`py-2 ${btnColors[key]} disabled:opacity-35 disabled:grayscale text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1`}
                              >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-gray-400 text-center">Each button generates a full material breakdown for that tier — individual prices hidden, total driven by your $/sq rate.</p>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* ── Unified Measurement Import ── */}
            <div className="border-2 border-indigo-300 rounded-2xl overflow-hidden bg-white shadow-sm">
              {/* Card header with scope selector */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100 bg-indigo-50">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-indigo-900">Import Measurements</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-indigo-600 whitespace-nowrap">Scope:</span>
                  <select
                    value={importScope}
                    onChange={e => setImportScope(e.target.value as 'roof' | 'siding' | 'both' | 'solar' | 'gutters' | 'roof-gutters')}
                    className="text-xs font-semibold border-2 border-indigo-400 rounded-lg px-2.5 py-1.5 bg-white text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm hover:border-indigo-500 transition-colors"
                  >
                    <option value="roof">Roof</option>
                    <option value="siding">Siding</option>
                    <option value="gutters">Gutters</option>
                    <option value="both">Roof + Siding</option>
                    <option value="roof-gutters">Roof + Gutters</option>
                    <option value="solar">Solar</option>
                  </select>
                </div>
              </div>

            {/* ── Roof section ── */}
            {(importScope === 'roof' || importScope === 'both' || importScope === 'roof-gutters') && (
            <div className={`${importScope === 'both' ? 'border-b border-gray-100' : ''} ${roofrReport ? 'bg-emerald-50' : 'bg-blue-50'} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${roofrReport ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                    <FileText className={`w-4 h-4 ${roofrReport ? 'text-emerald-600' : 'text-blue-600'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${roofrReport ? 'text-emerald-800' : 'text-blue-800'}`}>
                      {roofrReport
                        ? `${roofrReport.source === 'eagleview' ? 'EagleView' : 'Roofr'}: ${roofrReport.address || roofrFileName}`
                        : 'Import Measurements (Roofr or EagleView)'}
                    </p>
                    <p className={`text-xs mt-0.5 ${roofrReport ? 'text-emerald-600' : 'text-blue-500'}`}>
                      {roofrReport
                        ? `${(((roofrReport.reportSummary?.totalRoofAreaSqft ?? 0) || roofrReport.totalRoofAreaSqft) / 100).toFixed(1)} squares${roofrReport.structures.length > 1 ? ` · ${roofrReport.structures.length} structures` : ''}`
                        : 'Upload a Roofr or EagleView PDF to auto-populate roofing line items'}
                    </p>
                  </div>
                </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {roofrReport && (
                    <button onClick={() => { setRoofrReport(null); setRoofrFileName(''); setRoofrImportMode('combined'); setRoofrStructureScope('all'); }} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-white/60 transition-colors">
                      Clear
                    </button>
                  )}
                  <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${roofrReport ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} ${parsingRoofr ? 'opacity-60 pointer-events-none' : ''}`}>
                    {parsingRoofr ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {parsingRoofr ? 'Reading…' : roofrReport ? 'Re-upload' : 'Upload PDF'}
                    <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleRoofrFile(f); e.target.value = ''; }} />
                  </label>
                </div>
              </div>
              <StoredMeasurementReports
                customerId={selectedCustomerId}
                kind="roof"
                currentFileName={roofrFileName}
                disabled={parsingRoofr}
                onUse={(f) => handleRoofrFile(f, { fromStored: true })}
              />
              {roofrReport && (
                <div className="mt-3 pt-3 border-t border-emerald-200 space-y-3">
                  {/* Structure scope selector — only shown when report has multiple structures */}
                  {roofrReport.structures.length > 1 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-emerald-700 font-medium">Estimate for:</span>
                      <button
                        onClick={() => setRoofrStructureScope('all')}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${roofrStructureScope === 'all' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'}`}>
                        All Structures ({(roofrReport.totalRoofAreaSqft / 100).toFixed(1)} sq)
                      </button>
                      {roofrReport.structures.map((s, idx) => (
                        <button
                          key={idx}
                          onClick={() => setRoofrStructureScope(idx)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${roofrStructureScope === idx ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'}`}>
                          Structure {s.structureNumber} ({(s.totalRoofAreaSqft / 100).toFixed(1)} sq)
                        </button>
                      ))}
                    </div>
                  )}

                  {roofrReport.structures.length > 1 && roofrStructureScope === 'all' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-emerald-700 font-medium">Import layout:</span>
                        {([
                          { value: 'combined', label: 'Combined Only' },
                          { value: 'separate', label: 'Separate Structures' },
                          { value: 'separate-and-combined', label: 'Combined + Separate' },
                        ] as const).map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setRoofrImportMode(option.value)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                              roofrImportMode === option.value
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                            }`}>
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {roofrReport.structures
                          .slice()
                          .sort((left, right) => left.structureNumber - right.structureNumber)
                          .map((structure) => (
                            <div
                              key={structure.structureNumber}
                              className="rounded-lg border border-emerald-200 bg-white/70 px-3 py-2">
                              <p className="text-xs font-semibold text-emerald-800">
                                Structure {structure.structureNumber}
                              </p>
                              <p className="text-xs text-emerald-700">
                                {(structure.totalRoofAreaSqft / 100).toFixed(1)} sq
                                {structure.predominantPitch ? ` · ${structure.predominantPitch}` : ''}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-emerald-700 font-medium">Waste %:</span>
                    {[0, 10, 12, 15, ...(roofrReport?.suggestedWastePercent && ![0,10,12,15].includes(roofrReport.suggestedWastePercent) ? [roofrReport.suggestedWastePercent] : [])].sort((a,b)=>a-b).map(pct => (
                      <button key={pct} onClick={() => { setRoofrWastePercent(pct); setCustomWasteInput(String(pct)); }}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${roofrWastePercent === pct ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'}`}>
                        {pct}%{roofrReport?.suggestedWastePercent === pct ? ' ★' : ''}
                      </button>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="0" max="50"
                        value={customWasteInput}
                        onChange={e => setCustomWasteInput(e.target.value)}
                        onBlur={() => { const v = parseInt(customWasteInput, 10); if (!isNaN(v) && v >= 0 && v <= 50) setRoofrWastePercent(v); }}
                        onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(customWasteInput, 10); if (!isNaN(v) && v >= 0 && v <= 50) setRoofrWastePercent(v); }}}
                        className="w-14 px-2 py-1 text-xs border border-emerald-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-emerald-800"
                        placeholder="custom"
                      />
                      <span className="text-xs text-emerald-600">%</span>
                    </div>
                    <div className="ml-auto flex gap-2 flex-wrap">
                      {hasImportedItems && (
                        <button onClick={handleRemoveImportedItems}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-red-300 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1">
                          <Trash2 className="w-3 h-3" /> Remove Imported
                        </button>
                      )}
                      <button onClick={() => applyRoofrLineItems()}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                        {roofrMeasureTier === 'all'
                          ? 'Sync from Measurements'
                          : `Sync → ${roofrMeasureTier === 'good' ? (goodTierName || 'Good') : roofrMeasureTier === 'better' ? (betterTierName || 'Better') : (bestTierName || 'Best')} Tier`}
                      </button>
                    </div>
                  </div>
                  {/* Apply-to tier selector — only shown when per-tier templates are loaded */}
                  {quoteStructureType !== 'multi_scope' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-emerald-700 font-medium">Apply to:</span>
                      {([
                        { key: 'all',    label: 'All Tiers' },
                        { key: 'good',   label: goodTierName   || 'Good' },
                        { key: 'better', label: betterTierName || 'Better' },
                        { key: 'best',   label: bestTierName   || 'Best' },
                      ] as { key: 'all' | 'good' | 'better' | 'best'; label: string }[]).map(({ key, label }) => (
                        <button key={key}
                          onClick={() => setRoofrMeasureTier(key)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${roofrMeasureTier === key ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'}`}>
                          {label}
                        </button>
                      ))}
                      {roofrMeasureTier !== 'all' && (
                        <span className="text-[10px] text-emerald-600 italic">
                          ✓ Only the <strong>{roofrMeasureTier === 'good' ? (goodTierName || 'Good') : roofrMeasureTier === 'better' ? (betterTierName || 'Better') : (bestTierName || 'Best')}</strong> tier will be updated — other tiers stay unchanged.
                        </span>
                      )}
                    </div>
                  )}
                  {/* Pricing Mode */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-emerald-700 font-medium">Pricing:</span>
                    <button
                      onClick={() => setRoofrPricingMode('standard')}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${roofrPricingMode === 'standard' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'}`}>
                      Standard (price list)
                    </button>
                    <button
                      onClick={() => setRoofrPricingMode('per-sq-items')}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${roofrPricingMode === 'per-sq-items' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'}`}
                      title="Hit a $/sq target with every line item still priced, adding up to the total">
                      Per Square — Itemized
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoofrPricingMode('per-sq')}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${roofrPricingMode === 'per-sq' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'}`}
                      title="All-in: the rate lands on the shingle line, other materials show quantity only">
                      Per Square — All-In
                    </button>
                    {(roofrPricingMode === 'per-sq' || roofrPricingMode === 'per-sq-items') && (() => {
                      const sq = roofrStructureScope === 'all'
                        ? roofrReport!.totalRoofAreaSqft / 100
                        : roofrReport!.structures[roofrStructureScope as number]?.totalRoofAreaSqft / 100 || 0;
                      const g = parseFloat(roofrPerSqGoodRate);
                      const b = parseFloat(roofrPerSqBetterRate);
                      const bs = parseFloat(roofrPerSqBestRate);
                      return (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                          {([
                            {label: 'Good', val: roofrPerSqGoodRate, set: setRoofrPerSqGoodRate, total: !isNaN(g) && g > 0 ? g * sq : null, color: 'emerald'},
                            {label: 'Better', val: roofrPerSqBetterRate, set: setRoofrPerSqBetterRate, total: !isNaN(b) && b > 0 ? b * sq : null, color: 'emerald'},
                            {label: 'Best', val: roofrPerSqBestRate, set: setRoofrPerSqBestRate, total: !isNaN(bs) && bs > 0 ? bs * sq : null, color: 'emerald'},
                          ] as const).map(({label, val, set, total}) => (
                            <div key={label} className="flex items-center gap-1">
                              <span className="text-xs text-emerald-700 w-10">{label}:</span>
                              <span className="text-xs text-emerald-700">$</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={val}
                                onChange={e => set(e.target.value)}
                                className="w-20 px-2 py-1 text-xs border border-emerald-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-emerald-800"
                                placeholder="0"
                              />
                              <span className="text-xs text-emerald-600">/sq</span>
                              {total !== null && (
                                <span className="text-xs font-semibold text-emerald-800">= ${total.toLocaleString('en-US', {maximumFractionDigits: 0})}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  {measurementReportUrl && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <div
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          includeReportWithQuote ? 'bg-[#1e3a5f]' : 'bg-gray-300'
                        }`}
                        onClick={() => setIncludeReportWithQuote(v => !v)}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          includeReportWithQuote ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`} />
                      </div>
                      <span className="text-xs text-gray-600">Share measurement report with customer</span>
                    </label>
                  )}
                </div>
              )}
            </div>
            )}

            {/* ── Siding section ── */}
            {(importScope === 'siding' || importScope === 'both') && (
            <div className={`p-3.5 ${wallsReport ? 'bg-purple-50' : 'bg-indigo-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${wallsReport ? 'bg-purple-100' : 'bg-indigo-100'}`}>
                    <Building2 className={`w-4 h-4 ${wallsReport ? 'text-purple-600' : 'text-indigo-500'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${wallsReport ? 'text-purple-800' : 'text-indigo-800'}`}>
                      {wallsReport
                        ? `EagleView Walls: ${wallsReport.address || wallsFileName}`
                        : 'Import Siding Measurements (EagleView Walls)'}
                    </p>
                    <p className={`text-xs mt-0.5 ${wallsReport ? 'text-purple-600' : 'text-indigo-500'}`}>
                      {wallsReport
                        ? `${(wallsReport.totalSidingAreaSqft / 100).toFixed(1)} sq siding${wallsReport.totalMasonryAreaSqft ? ` · ${(wallsReport.totalMasonryAreaSqft / 100).toFixed(1)} sq masonry` : ''}`
                        : 'Upload an EagleView Walls PDF to auto-populate siding line items'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {wallsReport && (
                    <button
                      onClick={() => { setWallsReport(null); setWallsFileName(''); setWallsWastePercent(10); }}
                      className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-white/60 transition-colors">
                      Clear
                    </button>
                  )}
                  <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${wallsReport ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} ${parsingWalls ? 'opacity-60 pointer-events-none' : ''}`}>
                    {parsingWalls ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {parsingWalls ? 'Reading…' : wallsReport ? 'Re-upload' : 'Upload PDF'}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleWallsFile(f); e.target.value = ''; }}
                    />
                  </label>
                </div>
              </div>
              <StoredMeasurementReports
                customerId={selectedCustomerId}
                kind="walls"
                currentFileName={wallsFileName}
                disabled={parsingWalls}
                onUse={(f) => handleWallsFile(f, { fromStored: true })}
              />
              {wallsReport && (() => {
                const activeAreaSqft =
                  wallsAreaSource === 'wall'    ? wallsReport.totalWallAreaSqft :
                  wallsAreaSource === 'masonry' ? wallsReport.totalMasonryAreaSqft :
                  wallsReport.totalSidingAreaSqft;
                const withWaste = Math.round(activeAreaSqft * (1 + wallsWastePercent / 100));
                const withWasteSq = (withWaste / 100).toFixed(1);
                return (
                  <div className="mt-3 pt-3 border-t border-purple-200 space-y-3">
                    <p className="text-xs text-purple-600 font-semibold">Select area to use for siding calculations:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {/* Siding Area — always shown */}
                      <button
                        onClick={() => setWallsAreaSource('siding')}
                        className={`rounded-lg px-3 py-2 text-left border transition-all ${wallsAreaSource === 'siding' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white/70 border-purple-200 hover:border-purple-400'}`}>
                        <p className={`text-xs font-medium ${wallsAreaSource === 'siding' ? 'text-purple-100' : 'text-purple-500'}`}>Siding Area</p>
                        <p className={`text-sm font-bold ${wallsAreaSource === 'siding' ? 'text-white' : 'text-purple-800'}`}>{(wallsReport.totalSidingAreaSqft / 100).toFixed(1)} sq</p>
                        <p className={`text-xs ${wallsAreaSource === 'siding' ? 'text-purple-200' : 'text-purple-500'}`}>{wallsReport.totalSidingAreaSqft.toFixed(0)} sqft</p>
                      </button>
                      {wallsReport.totalWallAreaSqft > 0 && (
                        <button
                          onClick={() => setWallsAreaSource('wall')}
                          className={`rounded-lg px-3 py-2 text-left border transition-all ${wallsAreaSource === 'wall' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white/70 border-purple-200 hover:border-purple-400'}`}>
                          <p className={`text-xs font-medium ${wallsAreaSource === 'wall' ? 'text-purple-100' : 'text-purple-500'}`}>Wall Area (incl. openings)</p>
                          <p className={`text-sm font-bold ${wallsAreaSource === 'wall' ? 'text-white' : 'text-purple-800'}`}>{(wallsReport.totalWallAreaSqft / 100).toFixed(1)} sq</p>
                          <p className={`text-xs ${wallsAreaSource === 'wall' ? 'text-purple-200' : 'text-purple-500'}`}>{wallsReport.totalWallAreaSqft.toFixed(0)} sqft</p>
                        </button>
                      )}
                      {wallsReport.totalMasonryAreaSqft > 0 && (
                        <button
                          onClick={() => setWallsAreaSource('masonry')}
                          className={`rounded-lg px-3 py-2 text-left border transition-all ${wallsAreaSource === 'masonry' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white/70 border-purple-200 hover:border-purple-400'}`}>
                          <p className={`text-xs font-medium ${wallsAreaSource === 'masonry' ? 'text-purple-100' : 'text-purple-500'}`}>Masonry Area</p>
                          <p className={`text-sm font-bold ${wallsAreaSource === 'masonry' ? 'text-white' : 'text-purple-800'}`}>{(wallsReport.totalMasonryAreaSqft / 100).toFixed(1)} sq</p>
                          <p className={`text-xs ${wallsAreaSource === 'masonry' ? 'text-purple-200' : 'text-purple-500'}`}>{wallsReport.totalMasonryAreaSqft.toFixed(0)} sqft</p>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-purple-700 font-medium">Waste %:</span>
                      {[0, 5, 10, 15].map(pct => (
                        <button
                          key={pct}
                          onClick={() => setWallsWastePercent(pct)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${wallsWastePercent === pct ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 border border-purple-300 hover:bg-purple-100'}`}>
                          {pct}%
                        </button>
                      ))}
                      {/* Live waste-adjusted total */}
                      <span className="text-xs text-purple-500 ml-1">
                        → <span className="font-semibold text-purple-800">{withWasteSq} sq</span> <span className="text-purple-400">({withWaste.toLocaleString()} sqft) after waste</span>
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        {/* ? hint toggle */}
                        {!wallsHintDismissed && (
                          <button
                            onClick={() => setWallsHintOpen(v => !v)}
                            className={`w-5 h-5 rounded-full text-xs font-bold border transition-colors flex items-center justify-center shrink-0 ${wallsHintOpen ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-500 border-purple-300 hover:border-purple-500 hover:text-purple-700'}`}
                            title="What's the difference?"
                          >?</button>
                        )}
                        <button
                          onClick={() => applyWallsLineItems()}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors">
                          Sync from Measurements
                        </button>
                      </div>
                    </div>
                    {/* Pricing Mode */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-purple-700 font-medium">Pricing:</span>
                      <button
                        onClick={() => setWallsPricingMode('standard')}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${wallsPricingMode === 'standard' ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 border border-purple-300 hover:bg-purple-100'}`}>
                        Standard (price list)
                      </button>
                      <button
                        onClick={() => setWallsPricingMode('per-sq')}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${wallsPricingMode === 'per-sq' ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 border border-purple-300 hover:bg-purple-100'}`}>
                        Per Square Rate
                      </button>
                      {wallsPricingMode === 'per-sq' && (() => {
                        const areaSourceSqft =
                          wallsAreaSource === 'wall'    ? wallsReport!.totalWallAreaSqft :
                          wallsAreaSource === 'masonry' ? wallsReport!.totalMasonryAreaSqft :
                          wallsReport!.totalSidingAreaSqft;
                        const sq = Math.round(areaSourceSqft * (1 + wallsWastePercent / 100)) / 100;
                        const g = parseFloat(wallsPerSqGoodRate);
                        const b = parseFloat(wallsPerSqBetterRate);
                        const bs = parseFloat(wallsPerSqBestRate);
                        return (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                            {([
                              {label: 'Good', val: wallsPerSqGoodRate, set: setWallsPerSqGoodRate, total: !isNaN(g) && g > 0 ? g * sq : null},
                              {label: 'Better', val: wallsPerSqBetterRate, set: setWallsPerSqBetterRate, total: !isNaN(b) && b > 0 ? b * sq : null},
                              {label: 'Best', val: wallsPerSqBestRate, set: setWallsPerSqBestRate, total: !isNaN(bs) && bs > 0 ? bs * sq : null},
                            ] as const).map(({label, val, set, total}) => (
                              <div key={label} className="flex items-center gap-1">
                                <span className="text-xs text-purple-700 w-10">{label}:</span>
                                <span className="text-xs text-purple-700">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={val}
                                  onChange={e => set(e.target.value)}
                                  className="w-20 px-2 py-1 text-xs border border-purple-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-purple-800"
                                  placeholder="0"
                                />
                                <span className="text-xs text-purple-600">/sq</span>
                                {total !== null && (
                                  <span className="text-xs font-semibold text-purple-800">= ${total.toLocaleString('en-US', {maximumFractionDigits: 0})}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  {/* Hint panel */}
                  {!wallsHintDismissed && wallsHintOpen && (
                    <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3 text-xs text-purple-800 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-purple-600 shrink-0">+ Add to Quote</span>
                        <span>— Appends siding items to the bottom of your existing line items. Nothing is removed. Use this when adding siding alongside roofing or other work already in the quote.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-purple-600 shrink-0">Replace Siding Items</span>
                        <span>— Removes all existing Siding category items first, then adds the imported items. Use this when re-importing updated measurements so you don't end up with duplicates.</span>
                      </div>
                      <div className="pt-1 flex items-center gap-3">
                        <button
                          onClick={() => setWallsHintOpen(false)}
                          className="text-purple-500 hover:text-purple-700 underline underline-offset-2">
                          Got it, hide for now
                        </button>
                        <button
                          onClick={() => {
                            setWallsHintDismissed(true);
                            setWallsHintOpen(false);
                            localStorage.setItem('wallsHintDismissed', 'true');
                          }}
                          className="text-purple-400 hover:text-purple-600 underline underline-offset-2">
                          Don't show again
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })()}
            </div>
            )}

            {/* ── Solar section ── */}
            {importScope === 'solar' && (
            <div className={`p-3.5 ${solarReport ? 'bg-amber-50' : 'bg-yellow-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${solarReport ? 'bg-amber-100' : 'bg-yellow-100'}`}>
                    <svg className={`w-4 h-4 ${solarReport ? 'text-amber-600' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${solarReport ? 'text-amber-800' : 'text-yellow-800'}`}>
                      {solarReport
                        ? `EagleView Solar: ${solarReport.address || solarFileName}`
                        : 'Import Solar Measurements (EagleView)'}
                    </p>
                    <p className={`text-xs mt-0.5 ${solarReport ? 'text-amber-600' : 'text-yellow-600'}`}>
                      {solarReport
                        ? `${solarReport.totalRoofAreaSqft.toLocaleString()} sq ft · ${solarReport.totalFacets} facets${solarReport.source === 'eagleview-solar' && solarReport.avgTsrfPercent ? ` · Avg TSRF ${solarReport.avgTsrfPercent}%` : solarReport.source === 'eagleview-sunsite' && solarReport.southFacingAreaSqft ? ` · ${solarReport.southFacingAreaSqft.toLocaleString()} sq ft south-facing` : ''}`
                        : 'Upload an EagleView Inform Advanced for Solar or SunSite™ PDF to auto-populate solar line items'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {solarReport && (
                    <button
                      onClick={() => { setSolarReport(null); setSolarFileName(''); }}
                      className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-white/60 transition-colors">
                      Clear
                    </button>
                  )}
                  <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${solarReport ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-yellow-600 hover:bg-yellow-700 text-white'} ${parsingSolar ? 'opacity-60 pointer-events-none' : ''}`}>
                    {parsingSolar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {parsingSolar ? 'Reading…' : solarReport ? 'Re-upload' : 'Upload PDF'}
                    <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleSolarFile(f); e.target.value = ''; }} />
                  </label>
                </div>
              </div>
              <StoredMeasurementReports
                customerId={selectedCustomerId}
                kind="solar"
                currentFileName={solarFileName}
                disabled={parsingSolar}
                onUse={(f) => handleSolarFile(f, { fromStored: true })}
              />

              {solarReport && (() => {
                const isSunSite = solarReport.source === 'eagleview-sunsite';
                const eligibleFacets = solarReport.facets.filter(f => f.tsrfPercent >= 60);
                const topFacets = [...solarReport.facets].sort((a, b) => b.tsrfPercent - a.tsrfPercent).slice(0, 5);
                const PANEL_SQFT = 17.5;
                const PACKING = 0.70;
                const eligibleFraction = solarReport.facets.length > 0 ? eligibleFacets.length / solarReport.facets.length : 1;
                const eligibleArea = Math.round(solarReport.usableRoofAreaSqft * eligibleFraction);
                const estimatedPanels = Math.max(1, Math.floor(eligibleArea * PACKING / PANEL_SQFT));
                return (
                  <div className="mt-3 space-y-3">
                    {/* Key metrics */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-white/70 border border-amber-200 px-3 py-2">
                        <p className="text-xs font-medium text-amber-500">{isSunSite ? 'South-Facing Area' : 'Usable Area'}</p>
                        <p className="text-sm font-bold text-amber-800">{solarReport.usableRoofAreaSqft.toLocaleString()} sq ft</p>
                        <p className="text-xs text-amber-500">{isSunSite ? `of ${solarReport.totalRoofAreaSqft.toLocaleString()} total` : `${(solarReport.usableRoofAreaSqft / 100).toFixed(1)} squares`}</p>
                      </div>
                      <div className="rounded-lg bg-white/70 border border-amber-200 px-3 py-2">
                        <p className="text-xs font-medium text-amber-500">Est. Panels</p>
                        <p className="text-sm font-bold text-amber-800">{estimatedPanels}</p>
                        <p className="text-xs text-amber-500">~{(estimatedPanels * 0.4).toFixed(1)} kW</p>
                      </div>
                      <div className="rounded-lg bg-white/70 border border-amber-200 px-3 py-2">
                        {isSunSite ? (
                          <>
                            <p className="text-xs font-medium text-amber-500">Facets</p>
                            <p className="text-sm font-bold text-amber-800">{solarReport.totalFacets}</p>
                            <p className="text-xs text-amber-500">SunSite™ report</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-medium text-amber-500">Avg TSRF</p>
                            <p className="text-sm font-bold text-amber-800">{solarReport.avgTsrfPercent > 0 ? `${solarReport.avgTsrfPercent}%` : '—'}</p>
                            <p className="text-xs text-amber-500">{eligibleFacets.length}/{solarReport.facets.length || solarReport.totalFacets} eligible</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Top facets table — Inform Advanced only */}
                    {topFacets.length > 0 && (
                      <div className="rounded-lg bg-white/70 border border-amber-200 overflow-hidden">
                        <div className="px-3 py-1.5 bg-amber-100/60 border-b border-amber-200">
                          <p className="text-xs font-semibold text-amber-700">Top Facets by TSRF (best for solar placement)</p>
                        </div>
                        <div className="px-3 py-2">
                          <div className="grid grid-cols-4 gap-x-2 text-xs font-semibold text-amber-600 mb-1">
                            <span>Facet</span><span>TSRF %</span><span>SAV %</span><span>Azimuth</span>
                          </div>
                          {topFacets.map(f => (
                            <div key={f.id} className="grid grid-cols-4 gap-x-2 text-xs text-amber-800 py-0.5">
                              <span className="font-bold">{f.id}</span>
                              <span className={`font-semibold ${f.tsrfPercent >= 80 ? 'text-green-600' : f.tsrfPercent >= 70 ? 'text-amber-600' : 'text-orange-600'}`}>{f.tsrfPercent}%</span>
                              <span>{f.savPercent}%</span>
                              <span>{f.azimuthDeg > 0 ? `${f.azimuthDeg}°` : '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Apply button */}
                    <button
                      onClick={applySolarLineItems}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                      Apply Solar Line Items to Quote
                    </button>
                    <p className="text-xs text-amber-600 text-center">
                      Adds Site Assessment, Panels (~{estimatedPanels} ea), Racking, Inverter, Wiring, Labor &amp; Monitoring to your Solar scope.
                    </p>
                  </div>
                );
              })()}
            </div>
            )}
            {/* ── Manual Measurement Entry (inside unified card, roof scopes) ── */}
            {(importScope === 'roof' || importScope === 'both' || importScope === 'roof-gutters') && (
            <div className="border-t border-gray-100 px-3 pb-3 pt-2 bg-gray-50/40">
              {/* ── Target tier/scope selector ── */}
              {(() => {
                // Build dropdown options based on current quote mode
                const isPerTier = usePerTierItems && (perTierPending.good || perTierPending.better || perTierPending.best);
                const isMultiScope = quoteStructureType === 'multi_scope' && quoteOptions.length > 0;

                if (isPerTier) {
                  // Per-tier: one option per tier that has a template loaded
                  const tierOptions = [
                    { tier: 'good' as const,   label: goodTierName   || 'Good',   templateId: perTierPending.good },
                    { tier: 'better' as const, label: betterTierName || 'Better', templateId: perTierPending.better },
                    { tier: 'best' as const,   label: bestTierName   || 'Best',   templateId: perTierPending.best },
                  ].filter(o => o.templateId);
                  const templateName = (id: string) => availableTemplates.find(t => t.id === id)?.name ?? id;
                  // If state hasn't caught up yet (still 'all'), visually default to first option
                  const effectiveTierValue = (manualMeasureTier === 'all' && tierOptions.length > 0)
                    ? tierOptions[0].tier
                    : manualMeasureTier;
                  return (
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className="text-xs font-semibold text-sky-700 whitespace-nowrap">Entering measurements for:</span>
                      <select
                        value={effectiveTierValue}
                        onChange={e => switchMeasureTarget(e.target.value as 'good' | 'better' | 'best', null)}
                        className="flex-1 text-xs font-semibold border-2 border-sky-400 rounded-lg px-2.5 py-1.5 bg-white text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-sm"
                      >
                        {tierOptions.map(({ tier, label, templateId }) => (
                          <option key={tier} value={tier}>
                            {label} — {templateName(templateId)}
                          </option>
                        ))}
                      </select>
                      {manualMeasureTier !== 'all' && tierMeasurementPools[manualMeasureTier === 'good' ? 'better' : manualMeasureTier === 'better' ? 'good' : 'good'] && (
                        <span className="text-[10px] text-sky-500 whitespace-nowrap">Fields isolated per tier</span>
                      )}
                    </div>
                  );
                }

                if (isMultiScope) {
                  // Multi-scope: one option per scope with its template name
                  const activeOptId = manualTargetOptionId || quoteOptions[0]?.id || null;
                  return (
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className="text-xs font-semibold text-sky-700 whitespace-nowrap">Entering measurements for:</span>
                      <select
                        value={activeOptId ?? ''}
                        onChange={e => switchMeasureTarget('all', e.target.value || null)}
                        className="flex-1 text-xs font-semibold border-2 border-sky-400 rounded-lg px-2.5 py-1.5 bg-white text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-sm"
                      >
                        {quoteOptions.map((opt, idx) => {
                          const templateName = scopeConfigs[idx]?.templateId
                            ? (availableTemplates.find(t => t.id === scopeConfigs[idx].templateId)?.name ?? '')
                            : '';
                          return (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}{templateName ? ` — ${templateName}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                }

                // Single-template: no external header needed — tier picker is inside the collapsible
                return null;
              })()}
            <div className={`border rounded-2xl overflow-hidden transition-colors ${manualSqExpanded ? 'border-sky-200 bg-sky-50/30' : 'border-gray-200 bg-white'}`}>
              <button
                type="button"
                onClick={() => setManualSqExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Manual Measurement Entry</p>
                    <p className="text-xs text-gray-500">Know the squares? Enter measurements to auto-fill roofing quantities.</p>
                  </div>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${manualSqExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {manualSqExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-sky-100">
                  {/* ── Tier target picker — first control so it's always seen ── */}
                  {!usePerTierItems && (
                    <div className="pt-3">
                      <p className="text-xs font-semibold text-gray-600 mb-2">
                        {quoteStructureType === 'multi_scope' ? 'Save tier pricing to:' : 'Save measurements to:'}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {([
                          { key: 'all' as const,    label: 'All Tiers',           color: 'sky' },
                          { key: 'good' as const,   label: goodTierName   || 'Good',   color: 'emerald' },
                          { key: 'better' as const, label: betterTierName || 'Better', color: 'blue' },
                          { key: 'best' as const,   label: bestTierName   || 'Best',   color: 'amber' },
                        ] as const).map(({ key, label, color }) => (
                          <button key={key} type="button"
                            onClick={() => setManualMeasureTier(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                              manualMeasureTier === key
                                ? color === 'sky'     ? 'bg-sky-600     text-white border-sky-600'
                                : color === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600'
                                : color === 'blue'    ? 'bg-blue-600    text-white border-blue-600'
                                :                       'bg-amber-500   text-white border-amber-500'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
                            }`}
                          >{label}</button>
                        ))}
                      </div>
                      {manualMeasureTier !== 'all' && (
                        <p className="text-[11px] text-sky-600 mt-1.5">
                          ✓ Only the <strong>{manualMeasureTier === 'good' ? (goodTierName || 'Good') : manualMeasureTier === 'better' ? (betterTierName || 'Better') : (bestTierName || 'Best')}</strong> tier will be populated — other tiers stay unchanged.
                        </p>
                      )}
                    </div>
                  )}
                  {/* Square input */}
                  <div className={usePerTierItems ? 'pt-3' : ''}>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Total Squares <span className="text-red-400">*</span></label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={manualSquares}
                        onChange={e => setManualSquares(e.target.value)}
                        placeholder="e.g. 27"
                        className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                      <span className="text-sm text-gray-500">squares (1 sq = 100 sq ft)</span>
                    </div>
                  </div>

                  {/* Optional linear measurements */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Linear Measurements <span className="text-gray-400 font-normal">(optional — improves starter, drip edge, capping quantities)</span></p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { label: 'Eaves', value: manualEaves, setter: setManualEaves, unit: 'lf' },
                        { label: 'Rakes', value: manualRakes, setter: setManualRakes, unit: 'lf' },
                        { label: 'Ridge', value: manualRidge, setter: setManualRidge, unit: 'lf' },
                        { label: 'Hips', value: manualHips, setter: setManualHips, unit: 'lf' },
                        { label: 'Valleys', value: manualValleys, setter: setManualValleys, unit: 'lf' },
                        { label: 'Pipe Boots', value: manualPipeBoots, setter: setManualPipeBoots, unit: 'count' },
                      ].map(({ label, value, setter, unit }) => (
                        <div key={label}>
                          <label className="block text-xs text-gray-500 mb-1">{label} ({unit})</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={value}
                            onChange={e => setter(e.target.value)}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Job conditions — drive the labor adders the report can't infer */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">
                      Job conditions <span className="text-gray-400 font-normal">(sets the labor adders — pitch comes from the report)</span>
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Stories</label>
                        <select
                          value={jobStories}
                          onChange={e => setJobStories(parseInt(e.target.value, 10))}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 outline-none bg-white"
                        >
                          <option value={1}>1 story</option>
                          <option value={2}>2 stories</option>
                          <option value={3}>3+ stories</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Existing layers</label>
                        <select
                          value={jobLayers}
                          onChange={e => setJobLayers(parseInt(e.target.value, 10))}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 outline-none bg-white"
                        >
                          <option value={1}>1 layer</option>
                          <option value={2}>2 layers</option>
                          <option value={3}>3+ layers</option>
                        </select>
                      </div>
                    </div>
                    {(jobStories > 1 || jobLayers > 1) && (
                      <p className="mt-1.5 text-[11px] text-gray-500">
                        Adds{jobStories > 1 ? ` a ${jobStories >= 3 ? '3+' : '2'}-story height adder` : ''}
                        {jobStories > 1 && jobLayers > 1 ? ' and' : ''}
                        {jobLayers > 1 ? ` a ${jobLayers >= 3 ? '3rd+' : '2nd'} layer tear-off adder` : ''} when measurements are applied.
                      </p>
                    )}
                  </div>

                  {/* Waste */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Waste % <span className="text-gray-400 font-normal">(applied to shingles &amp; underlayment)</span></p>
                    <div className="flex flex-wrap gap-2">
                      {[0, 10, 12, 15].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setManualWaste(pct)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${manualWaste === pct ? 'bg-sky-600 text-white' : 'bg-white text-sky-700 border border-sky-300 hover:bg-sky-50'}`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-700 leading-relaxed">
                      <span className="font-semibold">Waste Factor Guide</span> — Waste accounts for cuts, overlaps, site damage, and complexity. Adjust based on your crew's efficiency and project constraints.
                      <table className="mt-1.5 w-full text-xs border-collapse">
                        <thead>
                          <tr className="text-sky-800">
                            <th className="text-left pr-2 pb-0.5 font-semibold">Material</th>
                            <th className="text-center px-1 pb-0.5 font-semibold">Simple</th>
                            <th className="text-center px-1 pb-0.5 font-semibold">Moderate</th>
                            <th className="text-center px-1 pb-0.5 font-semibold">Complex</th>
                          </tr>
                        </thead>
                        <tbody className="text-sky-700">
                          {[
                            ['Asphalt Shingles', '5–10%', '10–15%', '15–20%'],
                            ['Metal Roofing', '10–15%', '15–20%', '20–25%'],
                            ['Tile (Clay/Concrete)', '10–15%', '15–20%', '20–30%'],
                            ['Slate', '10–15%', '15–25%', '25–35%'],
                            ['TPO/EPDM (Flat)', '5–8%', '8–12%', '12–15%'],
                            ['Cedar Shakes', '10–15%', '15–20%', '20–25%'],
                            ['Siding', '5–10%', '10–15%', '15–20%'],
                          ].map(([mat, s, m, c]) => (
                            <tr key={mat} className="border-t border-sky-100">
                              <td className="pr-2 py-0.5">{mat}</td>
                              <td className="text-center px-1 py-0.5">{s}</td>
                              <td className="text-center px-1 py-0.5">{m}</td>
                              <td className="text-center px-1 py-0.5">{c}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-1.5 space-y-0.5 text-sky-700">
                        <p><span className="font-semibold">Complexity:</span> More hips, valleys, dormers, and penetrations = more unusable off-cuts = higher waste.</p>
                        <p><span className="font-semibold">Material rigidity:</span> Large inflexible panels (metal, tile) have less reusability than modular shingles.</p>
                        <p><span className="font-semibold">Crew experience:</span> Skilled crews minimize off-cuts by reusing remnants strategically.</p>
                        <p><span className="font-semibold">Linear items</span> (starter, drip edge, ridge cap) are automatically capped at 10% regardless of your selection.</p>
                      </div>
                    </div>
                    <div className="mt-1.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 leading-relaxed">
                      <span className="font-semibold">Uses your price list:</span> Items are matched to your saved company pricing automatically. Go to <span className="font-semibold">Settings → Price List</span> to set up your material costs.
                    </div>
                  </div>

                  {/* Pricing mode */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Pricing</p>
                    <div className="flex gap-2 flex-wrap items-center">
                      <button type="button" onClick={() => setManualPricingMode('standard')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${manualPricingMode === 'standard' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300'}`}>Standard Pricing</button>
                      <button type="button" onClick={() => setManualPricingMode('per-sq')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${manualPricingMode === 'per-sq' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300'}`}>$ per Square</button>
                      {manualPricingMode === 'per-sq' && (() => {
                        const sq = parseFloat(manualSquares) || 0;
                        const g = parseFloat(manualPerSqGoodRate);
                        const b = parseFloat(manualPerSqBetterRate);
                        const bs = parseFloat(manualPerSqBestRate);
                        return (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                            {([
                              {label: 'Good', val: manualPerSqGoodRate, set: setManualPerSqGoodRate, total: !isNaN(g) && g > 0 && sq > 0 ? g * sq : null},
                              {label: 'Better', val: manualPerSqBetterRate, set: setManualPerSqBetterRate, total: !isNaN(b) && b > 0 && sq > 0 ? b * sq : null},
                              {label: 'Best', val: manualPerSqBestRate, set: setManualPerSqBestRate, total: !isNaN(bs) && bs > 0 && sq > 0 ? bs * sq : null},
                            ] as const).map(({label, val, set, total}) => (
                              <div key={label} className="flex items-center gap-1">
                                <span className="text-xs text-gray-500 w-10">{label}:</span>
                                <span className="text-xs text-gray-400">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="5"
                                  value={val}
                                  onChange={e => set(e.target.value)}
                                  className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400"
                                  placeholder="0"
                                />
                                <span className="text-xs text-gray-400">/sq</span>
                                {total !== null && (
                                  <span className="text-xs font-semibold text-sky-700">= ${total.toLocaleString('en-US', {maximumFractionDigits: 0})}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ── Insurance Supplements (opt-in toggle) ── */}
                  <div className={`rounded-xl border transition-colors ${manualSupplementsEnabled ? 'border-orange-200 bg-orange-50/40' : 'border-gray-200 bg-gray-50/60'}`}>
                    <button
                      type="button"
                      onClick={() => setManualSupplementsEnabled(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">Insurance Supplements</span>
                        <span className="text-xs text-gray-400 font-normal">Pitch &amp; story height adders</span>
                      </div>
                      {/* Toggle pill */}
                      <div
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${manualSupplementsEnabled ? 'bg-orange-500' : 'bg-gray-300'}`}
                        onClick={e => { e.stopPropagation(); setManualSupplementsEnabled(v => !v); }}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${manualSupplementsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>

                    {manualSupplementsEnabled && (
                      <div className="px-3 pb-3 space-y-3 border-t border-orange-200">
                        {/* Story Height */}
                        <div className="pt-2">
                          <p className="text-xs font-semibold text-gray-700 mb-1.5">Story Height</p>
                          <div className="flex gap-1.5">
                            {(['1', '2', '3+'] as const).map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setManualStories(s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${manualStories === s ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'}`}
                              >
                                {s === '1' ? '1-Story' : s === '2' ? '2-Story' : '3+ Story'}
                              </button>
                            ))}
                          </div>
                          {manualStories !== '1' && (() => {
                            const rates = getStoryRates(manualStories);
                            const sq = parseFloat(manualSquares) || 0;
                            return rates && sq > 0 ? (
                              <p className="text-xs text-orange-600 mt-1">
                                +${rates.good}–${rates.best}/sq × {sq} sq = <span className="font-semibold">${(rates.good * sq).toLocaleString('en-US', { maximumFractionDigits: 0 })}–${(rates.best * sq).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span> supplement
                              </p>
                            ) : null;
                          })()}
                        </div>

                        {/* Pitch Breakdown */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-semibold text-gray-700">Steep Slope Breakdown <span className="font-normal text-gray-400">(only pitches &gt; 6/12 generate a supplement)</span></p>
                            <button
                              type="button"
                              onClick={() => setManualPitchZones(prev => [...prev, { pitch: '7', squares: '' }])}
                              className="text-xs text-orange-600 hover:text-orange-800 font-semibold"
                            >
                              + Add Zone
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {manualPitchZones.map((zone, idx) => {
                              const pitch = parseInt(zone.pitch, 10);
                              const sq = parseFloat(zone.squares);
                              const rates = !isNaN(pitch) ? getSteepSlopeRates(pitch) : null;
                              const supplement = rates && !isNaN(sq) && sq > 0
                                ? `+$${rates.good}–${rates.best}/sq = $${(rates.good * sq).toLocaleString('en-US', { maximumFractionDigits: 0 })}–$${(rates.best * sq).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                                : null;
                              return (
                                <div key={idx} className="flex items-center gap-2">
                                  <select
                                    value={zone.pitch}
                                    onChange={e => setManualPitchZones(prev => prev.map((z, i) => i === idx ? { ...z, pitch: e.target.value } : z))}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                                  >
                                    {[3,4,5,6,7,8,9,10,11,12,13,14].map(p => (
                                      <option key={p} value={String(p)}>{p}/12{p >= 7 ? ' ★' : ''}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={zone.squares}
                                    onChange={e => setManualPitchZones(prev => prev.map((z, i) => i === idx ? { ...z, squares: e.target.value } : z))}
                                    placeholder="sq"
                                    className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
                                  />
                                  <span className="text-xs text-gray-400">sq</span>
                                  {supplement && <span className="text-xs text-orange-600 font-medium">{supplement}</span>}
                                  {!rates && !isNaN(pitch) && pitch <= 6 && <span className="text-xs text-gray-400">no supplement ≤6/12</span>}
                                  {manualPitchZones.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setManualPitchZones(prev => prev.filter((_, i) => i !== idx))}
                                      className="text-gray-300 hover:text-red-400 ml-auto text-sm leading-none"
                                    >×</button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-gray-400 mt-1.5">★ = qualifies for steep-slope supplement. Rates are editable after import.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tier / scope target — shown at the top of the expanded card so
                      it's the first thing the user sees before entering measurements. */}
                  {(() => {
                    const hasPerTierTemplates = !!(perTierPending.good || perTierPending.better || perTierPending.best);
                    const isInlinePerTier = usePerTierItems && !hasPerTierTemplates;
                    const isInlineMultiScope = quoteStructureType === 'multi_scope' && quoteOptions.length > 0 && !manualTargetOptionId;
                    // Always show single-tier picker for standard (non-per-tier, non-multi-scope) quotes.
                    // Don't gate on hasPerTierTemplates — stale template IDs from a prior per-tier session
                    // should not hide the picker for users who have since turned off per-tier mode.
                    const isInlineSingleTierPicker = !usePerTierItems && quoteStructureType !== 'multi_scope';
                    if (!isInlinePerTier && !isInlineMultiScope && !isInlineSingleTierPicker) return null;
                    return (
                      <div className="flex items-center gap-2 pt-1 pb-1 border-t border-sky-100 mt-1">
                        <span className="text-xs font-semibold text-sky-700 whitespace-nowrap flex-shrink-0">
                          {usePerTierItems ? 'Save measurements to:' : 'Apply to:'}
                        </span>
                        {quoteStructureType === 'multi_scope' && quoteOptions.length > 0 ? (
                          <select
                            value={manualTargetOptionId || quoteOptions[0]?.id || ''}
                            onChange={e => switchMeasureTarget('all', e.target.value || null)}
                            className="flex-1 text-xs font-semibold border-2 border-sky-400 rounded-lg px-2.5 py-1 bg-white text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            {quoteOptions.map((opt, idx) => {
                              const tmplName = scopeConfigs[idx]?.templateId
                                ? (availableTemplates.find(t => t.id === scopeConfigs[idx].templateId)?.name ?? '') : '';
                              return <option key={opt.id} value={opt.id}>{opt.name}{tmplName ? ` — ${tmplName}` : ''}</option>;
                            })}
                          </select>
                        ) : (
                          <div className="flex items-center gap-1 flex-wrap">
                            {([
                              { key: 'all' as const,    label: 'All Tiers' },
                              { key: 'good' as const,   label: goodTierName   || 'Good' },
                              { key: 'better' as const, label: betterTierName || 'Better' },
                              { key: 'best' as const,   label: bestTierName   || 'Best' },
                            ] as const)
                              .map(({ key, label }) => (
                              <button key={key} type="button"
                                onClick={() => setManualMeasureTier(key)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${manualMeasureTier === key ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-500 border-gray-200 hover:border-sky-400 hover:text-sky-700'}`}
                              >{label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Action buttons */}
                  <div className="space-y-2 pt-1">
                    {(() => {
                      const hasPerTierTemplates = !!(perTierPending.good || perTierPending.better || perTierPending.best);
                      const effectiveTargetOptionId = quoteStructureType === 'multi_scope'
                        ? (manualTargetOptionId || quoteOptions[0]?.id || null)
                        : null;
                      const isScopeMode = quoteStructureType === 'multi_scope' && !!effectiveTargetOptionId;
                      const effectiveTier = (usePerTierItems && hasPerTierTemplates && manualMeasureTier === 'all')
                        ? (perTierPending.good ? 'good' : perTierPending.better ? 'better' : 'best') as 'good' | 'better' | 'best'
                        : manualMeasureTier as 'good' | 'better' | 'best' | 'all';
                      const isTierMode = !isScopeMode && effectiveTier !== 'all';
                      const tierLabel = (t: string) => t === 'good' ? (goodTierName || 'Good') : t === 'better' ? (betterTierName || 'Better') : (bestTierName || 'Best');
                      const scopeLabel = quoteOptions.find(o => o.id === effectiveTargetOptionId)?.name ?? 'Scope';

                      // Per-tier+templates mode: show "Save to:" multi-checkbox row + single save button
                      if (usePerTierItems && hasPerTierTemplates && !isScopeMode) {
                        const availableTiers = (['good', 'better', 'best'] as const).filter(t =>
                          perTierPending.good || perTierPending.better || perTierPending.best
                        );
                        const toggleTier = (t: 'good' | 'better' | 'best') => {
                          setManualSaveTierTargets(prev => {
                            const next = new Set(prev);
                            if (next.has(t)) { next.delete(t); } else { next.add(t); }
                            return next;
                          });
                        };
                        const saveTargets = Array.from(manualSaveTierTargets);
                        const allSaved = saveTargets.length > 0 && saveTargets.every(t => measuredTiers.has(t));
                        return (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-sky-700 whitespace-nowrap">Save to:</span>
                              {(['good', 'better', 'best'] as const).map(t => (
                                <button key={t} type="button"
                                  onClick={() => toggleTier(t)}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                                    manualSaveTierTargets.has(t)
                                      ? 'bg-sky-600 text-white border-sky-600'
                                      : 'bg-white text-gray-400 border-gray-200 hover:border-sky-400 hover:text-sky-600'
                                  }`}
                                >
                                  {manualSaveTierTargets.has(t)
                                    ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                    : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                  }
                                  {tierLabel(t)}
                                </button>
                              ))}
                              {saveTargets.length === 0 && (
                                <span className="text-xs text-amber-600 italic">Select at least one tier</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={!manualSquares || parseFloat(manualSquares) <= 0 || saveTargets.length === 0}
                                onClick={() => {
                                  saveTargets.forEach(t => applyManualSquaresLineItems({ targetTier: t }));
                                }}
                                className={`flex items-center gap-1.5 px-4 py-2 text-white text-sm font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${allSaved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#ff6b35] hover:bg-[#e55a25]'}`}
                              >
                                {allSaved
                                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                                }
                                {allSaved
                                  ? `Resave to ${saveTargets.map(tierLabel).join(' + ')}`
                                  : saveTargets.length === 3
                                    ? 'Save to All Tiers'
                                    : `Save to ${saveTargets.map(tierLabel).join(' + ')}`}
                              </button>
                            </div>
                          </>
                        );
                      }

                      // All other modes (single-tier, scope, all) — original single save button
                      const saveKey = isScopeMode ? effectiveTargetOptionId! : (isTierMode ? effectiveTier : 'all');
                      const alreadySaved = measuredTiers.has(saveKey);
                      const label = isScopeMode
                        ? `Save to ${scopeLabel}`
                        : isTierMode
                          ? `Save ${tierLabel(effectiveTier as string)} Measurements`
                          : 'Save to All Tiers';
                      return (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!manualSquares || parseFloat(manualSquares) <= 0}
                            onClick={() => applyManualSquaresLineItems(isScopeMode ? { targetOptionId: effectiveTargetOptionId! } : isTierMode ? { targetTier: effectiveTier as 'good' | 'better' | 'best' } : undefined)}
                            className={`flex items-center gap-1.5 px-4 py-2 text-white text-sm font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                              alreadySaved
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : isTierMode || isScopeMode
                                  ? 'bg-[#ff6b35] hover:bg-[#e55a25]'
                                  : 'bg-sky-600 hover:bg-sky-700'
                            }`}
                          >
                            {alreadySaved
                              ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                            }
                            {alreadySaved ? `Resave ${isTierMode ? tierLabel(effectiveTier as string) : isScopeMode ? scopeLabel : ''}`.trim() : label}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
            </div>
            )}

            {/* ── Manual Siding Entry (inside unified card, siding scopes) ── */}
            {(importScope === 'siding' || importScope === 'both') && (
            <div className="border-t border-gray-100 px-3 pb-3 pt-2 bg-gray-50/40">
              {/* Tier/scope target selector — siding view reuses same switchMeasureTarget */}
              {importScope === 'siding' && (() => {
                const isPerTier = usePerTierItems && (perTierPending.good || perTierPending.better || perTierPending.best);
                const isMultiScope = quoteStructureType === 'multi_scope' && quoteOptions.length > 0;
                if (isPerTier || isMultiScope) {
                  // Render the same compact dropdown as the roof section
                  return (
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className="text-xs font-semibold text-indigo-700 whitespace-nowrap">Entering measurements for:</span>
                      <select
                        value={isMultiScope ? (manualTargetOptionId || quoteOptions[0]?.id || '') : manualMeasureTier}
                        onChange={e => isMultiScope
                          ? switchMeasureTarget('all', e.target.value || null)
                          : switchMeasureTarget(e.target.value as 'good' | 'better' | 'best', null)
                        }
                        className="flex-1 text-xs font-semibold border-2 border-indigo-400 rounded-lg px-2.5 py-1.5 bg-white text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                      >
                        {isMultiScope
                          ? quoteOptions.map((opt, idx) => {
                              const tmplName = scopeConfigs[idx]?.templateId
                                ? (availableTemplates.find(t => t.id === scopeConfigs[idx].templateId)?.name ?? '') : '';
                              return <option key={opt.id} value={opt.id}>{opt.name}{tmplName ? ` — ${tmplName}` : ''}</option>;
                            })
                          : ([
                              { tier: 'good' as const, label: goodTierName || 'Good', id: perTierPending.good },
                              { tier: 'better' as const, label: betterTierName || 'Better', id: perTierPending.better },
                              { tier: 'best' as const, label: bestTierName || 'Best', id: perTierPending.best },
                            ] as const).filter(o => o.id).map(({ tier, label, id }) => (
                              <option key={tier} value={tier}>{label} — {availableTemplates.find(t => t.id === id)?.name ?? id}</option>
                            ))
                        }
                      </select>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Manual Measurement Entry</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 mr-0.5">{usePerTierItems ? 'Save to tier:' : 'Apply to:'}</span>
                      {([
                        { key: 'all' as const, label: 'All' },
                        { key: 'good' as const, label: goodTierName || 'Good' },
                        { key: 'better' as const, label: betterTierName || 'Better' },
                        { key: 'best' as const, label: bestTierName || 'Best' },
                      ] as const)
                        .filter(({ key }) => !(usePerTierItems && key === 'all'))
                        .map(({ key, label }) => (
                        <button key={key} type="button"
                          onClick={() => switchMeasureTarget(key, null)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-colors ${manualMeasureTier === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-400'}`}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {importScope === 'both' && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Manual Siding Entry</p>
              )}
            <div className={`border rounded-2xl overflow-hidden transition-colors ${manualSidingSqExpanded ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200 bg-white'}`}>
              <button
                type="button"
                onClick={() => setManualSidingSqExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Manual Measurement Entry</p>
                    <p className="text-xs text-gray-500">Know the squares? Enter measurements to auto-fill siding quantities.</p>
                  </div>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${manualSidingSqExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {manualSidingSqExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-indigo-100">
                  {/* ── Tier target picker (siding card) — shown for all non-per-tier quotes ── */}
                  {!usePerTierItems && (
                    <div className="pt-3">
                      <p className="text-xs font-semibold text-gray-600 mb-2">
                        {quoteStructureType === 'multi_scope' ? 'Save tier pricing to:' : 'Save measurements to:'}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {([
                          { key: 'all' as const,    label: 'All Tiers',           color: 'indigo' },
                          { key: 'good' as const,   label: goodTierName   || 'Good',   color: 'emerald' },
                          { key: 'better' as const, label: betterTierName || 'Better', color: 'blue' },
                          { key: 'best' as const,   label: bestTierName   || 'Best',   color: 'amber' },
                        ] as const).map(({ key, label, color }) => (
                          <button key={key} type="button"
                            onClick={() => setManualMeasureTier(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                              manualMeasureTier === key
                                ? color === 'indigo'  ? 'bg-indigo-600  text-white border-indigo-600'
                                : color === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600'
                                : color === 'blue'    ? 'bg-blue-600    text-white border-blue-600'
                                :                       'bg-amber-500   text-white border-amber-500'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
                            }`}
                          >{label}</button>
                        ))}
                      </div>
                      {manualMeasureTier !== 'all' && (
                        <p className="text-[11px] text-indigo-600 mt-1.5">
                          ✓ Only the <strong>{manualMeasureTier === 'good' ? (goodTierName || 'Good') : manualMeasureTier === 'better' ? (betterTierName || 'Better') : (bestTierName || 'Best')}</strong> tier will be populated — other tiers stay unchanged.
                        </p>
                      )}
                    </div>
                  )}
                  {/* Two core fields: squares + perimeter */}
                  <div className={`${!usePerTierItems && quoteStructureType !== 'multi_scope' ? '' : 'pt-3'} grid grid-cols-2 gap-3`}>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Wall Squares <span className="text-red-400">*</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={manualSidingSquares}
                          onChange={e => setManualSidingSquares(e.target.value)}
                          placeholder="e.g. 24"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <span className="text-xs text-gray-400 shrink-0">sq</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Wall Perimeter
                        <span className="text-gray-400 font-normal ml-1">(optional)</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={manualSidingPerimeter}
                          onChange={e => setManualSidingPerimeter(e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <span className="text-xs text-gray-400 shrink-0">lf</span>
                      </div>
                    </div>
                  </div>

                  {/* Waste % */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Waste % <span className="text-gray-400 font-normal">(applied to siding area)</span></p>
                    <div className="flex flex-wrap gap-2">
                      {[0, 5, 10, 15].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setManualSidingWaste(pct)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${manualSidingWaste === pct ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-300 hover:bg-indigo-50'}`}
                        >
                          {pct}%
                        </button>
                      ))}
                      {manualSidingSquares && parseFloat(manualSidingSquares) > 0 && (
                        <span className="text-xs text-gray-500 self-center ml-1">
                          → <span className="font-semibold text-indigo-700">{(parseFloat(manualSidingSquares) * (1 + manualSidingWaste / 100)).toFixed(1)} sq</span> after waste
                        </span>
                      )}
                    </div>
                    <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                      <span className="font-semibold">Uses your price list:</span> Items are matched to your saved siding pricing automatically. Go to <span className="font-semibold">Settings → Price List</span> to set up costs.
                    </div>
                  </div>

                  {/* Pricing mode */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Pricing</p>
                    <div className="flex gap-2 flex-wrap items-center">
                      <button type="button" onClick={() => setManualSidingPricingMode('standard')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${manualSidingPricingMode === 'standard' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>Standard Pricing</button>
                      <button type="button" onClick={() => setManualSidingPricingMode('per-sq')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${manualSidingPricingMode === 'per-sq' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>$ per Square</button>
                      {manualSidingPricingMode === 'per-sq' && (() => {
                        const sq = parseFloat(manualSidingSquares) * (1 + manualSidingWaste / 100) || 0;
                        const g = parseFloat(manualSidingPerSqGoodRate);
                        const b = parseFloat(manualSidingPerSqBetterRate);
                        const bs = parseFloat(manualSidingPerSqBestRate);
                        return (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                            {([
                              { label: 'Good', val: manualSidingPerSqGoodRate, set: setManualSidingPerSqGoodRate, total: !isNaN(g) && g > 0 && sq > 0 ? g * sq : null },
                              { label: 'Better', val: manualSidingPerSqBetterRate, set: setManualSidingPerSqBetterRate, total: !isNaN(b) && b > 0 && sq > 0 ? b * sq : null },
                              { label: 'Best', val: manualSidingPerSqBestRate, set: setManualSidingPerSqBestRate, total: !isNaN(bs) && bs > 0 && sq > 0 ? bs * sq : null },
                            ] as const).map(({ label, val, set, total }) => (
                              <div key={label} className="flex items-center gap-1">
                                <span className="text-xs text-gray-500 w-10">{label}:</span>
                                <span className="text-xs text-gray-400">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="5"
                                  value={val}
                                  onChange={e => set(e.target.value)}
                                  className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  placeholder="0"
                                />
                                <span className="text-xs text-gray-400">/sq</span>
                                {total !== null && (
                                  <span className="text-xs font-semibold text-indigo-700">= ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!manualSidingSquares || parseFloat(manualSidingSquares) <= 0}
                      onClick={() => applyManualSidingLineItems(manualMeasureTier !== 'all' ? { targetTier: manualMeasureTier } : undefined)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {manualMeasureTier === 'all'
                        ? 'Generate Siding Items'
                        : `Generate Siding → ${manualMeasureTier === 'good' ? (goodTierName || 'Good') : manualMeasureTier === 'better' ? (betterTierName || 'Better') : (bestTierName || 'Best')} Tier`}
                    </button>
                  </div>
                </div>
              )}
            </div>
            </div>
            )}

            {/* ── Manual Gutter Entry (inside unified card, gutter scopes) ── */}
            {(importScope === 'gutters' || importScope === 'roof-gutters') && (
            <div className="border-t border-gray-100 px-3 pb-3 pt-2 bg-gray-50/40">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Manual Gutter Entry</p>
            <div className={`border rounded-2xl overflow-hidden transition-colors ${manualGutterExpanded ? 'border-teal-200 bg-teal-50/30' : 'border-gray-200 bg-white'}`}>
              <button
                type="button"
                onClick={() => setManualGutterExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9H5M5 9l4-4M5 9l4 4M19 9v6a2 2 0 01-2 2H7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Manual Gutter Entry</p>
                    <p className="text-xs text-gray-500">Enter measurements to auto-fill gutter material quantities.</p>
                  </div>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${manualGutterExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {manualGutterExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-teal-100">

                  {/* Row 1: LF + Style */}
                  <div className="pt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Linear Feet <span className="text-red-400">*</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={manualGutterLf}
                          onChange={e => setManualGutterLf(e.target.value)}
                          placeholder="e.g. 180"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                        <span className="text-xs text-gray-400 shrink-0">lf</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Style</label>
                      <select
                        value={manualGutterStyle}
                        onChange={e => setManualGutterStyle(e.target.value as typeof manualGutterStyle)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                      >
                        <option value="5-inch">5 Inch</option>
                        <option value="6-inch">6 Inch</option>
                        <option value="7-inch">7 Inch</option>
                        <option value="box">Box</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Downspout count + LF */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Downspout Count</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={manualGutterDownspoutCount}
                          onChange={e => setManualGutterDownspoutCount(e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                        <span className="text-xs text-gray-400 shrink-0">ea</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Downspout Linear Feet</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={manualGutterDownspoutLf}
                          onChange={e => setManualGutterDownspoutLf(e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                        <span className="text-xs text-gray-400 shrink-0">lf</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Stories */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Stories</p>
                    <div className="flex gap-2">
                      {(['1', '2'] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setManualGutterStories(s)}
                          className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${manualGutterStories === s ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}
                        >
                          {s === '1' ? '1-Story' : '2-Story'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Row 4: Gutter Guards toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setManualGutterGuards(v => !v)}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border text-left transition-colors ${manualGutterGuards ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-gray-50/60'}`}
                    >
                      <div className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${manualGutterGuards ? 'bg-teal-500' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${manualGutterGuards ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">Gutter Guards</span>
                      {manualGutterGuards && manualGutterLf && parseFloat(manualGutterLf) > 0 && (
                        <span className="text-xs text-teal-600 ml-auto">{manualGutterLf} lf</span>
                      )}
                    </button>
                  </div>

                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                    <span className="font-semibold">Uses your price list:</span> Gutter material, downspouts, elbows, hangers, sealant, and guards are matched to your saved pricing automatically.
                  </div>

                  {/* Action button */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!manualGutterLf || parseFloat(manualGutterLf) <= 0}
                      onClick={() => applyManualGutterLineItems()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Generate Gutter Items
                    </button>
                  </div>
                </div>
              )}
            </div>
            </div>
            )}

            {/* ── Additional Reports Section ── */}
            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Additional Reports</p>
                <label className={`cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-gray-100 hover:bg-gray-200 text-gray-700 ${parsingAdditional ? 'opacity-60 pointer-events-none' : ''}`}>
                  {parsingAdditional ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-sm leading-none">+</span>}
                  {parsingAdditional ? 'Reading…' : 'Add Report'}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAdditionalReportFile(f); e.target.value = ''; }}
                  />
                </label>
              </div>

              {additionalReports.length === 0 ? (
                <p className="text-xs text-gray-400 italic px-1">
                  Upload additional Roofr or EagleView PDFs when you have separate reports for different scopes (e.g. roof + siding from two reports).
                </p>
              ) : (
                <div className="space-y-2">
                  {additionalReports.map(report => {
                    const isRoof = report.roofData !== null;
                    const isWalls = report.wallsData !== null;
                    const roofSq = isRoof ? ((report.roofData!.reportSummary?.totalRoofAreaSqft ?? report.roofData!.totalRoofAreaSqft) / 100).toFixed(1) : null;
                    const sidingSq = isWalls ? (report.wallsData!.totalSidingAreaSqft / 100).toFixed(1) : null;
                    return (
                      <div key={report.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{report.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {isRoof && roofSq && `Roof: ${roofSq} sq`}
                            {isRoof && isWalls && ' · '}
                            {isWalls && sidingSq && `Siding: ${sidingSq} sq`}
                            {!isRoof && !isWalls && 'Unknown format'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isRoof && (
                            <button
                              onClick={() => applyAdditionalRoofReport(report)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                            >
                              Apply to Roofing
                            </button>
                          )}
                          {isWalls && (
                            <button
                              onClick={() => applyAdditionalWallsReport(report)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                            >
                              Apply to Siding
                            </button>
                          )}
                          <button
                            onClick={() => setAdditionalReports(prev => prev.filter(r => r.id !== report.id))}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </div>{/* end unified import card */}

            {/* ── Option-Based Editor — multi_scope only ─────────────── */}
            {quoteStructureType === 'multi_scope' && (() => {
              const activeItems = lineItems.filter(i => i.quote_option_id === effectiveActiveOptionId);
              const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
              const grandTotal = effectiveScopeOptions.reduce((sum, opt) => {
                return sum + lineItems.filter(i => i.quote_option_id === opt.id).reduce((s, i) => s + i.quantity * (i.good_price ?? 0), 0);
              }, 0);
              const isPreview = quoteOptions.length === 0;
              return (
                <div className="space-y-4">
                  {/* Option tab bar */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {effectiveScopeOptions.map(opt => {
                      const optTotal = lineItems.filter(i => i.quote_option_id === opt.id).reduce((s, i) => s + i.quantity * (i.good_price ?? 0), 0);
                      const isActive = effectiveActiveOptionId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setActiveOptionId(opt.id)}
                          className={`flex flex-col items-start px-4 py-2.5 rounded-xl border-2 transition-all whitespace-nowrap min-w-[140px] ${
                            isActive
                              ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-[#1e3a5f]/40'
                          }`}
                        >
                          <span className="text-sm font-semibold">{opt.name}</span>
                          <span className={`text-xs mt-0.5 ${isActive ? 'text-white/70' : 'text-gray-400'}`}>{fmt(optTotal)}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active option name editor — only available after first save */}
                  {!isPreview && effectiveActiveOptionId && (
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Option name:</span>
                      <input
                        className="flex-1 text-sm font-semibold text-gray-900 border-none outline-none bg-transparent"
                        value={quoteOptions.find(o => o.id === effectiveActiveOptionId)?.name ?? ''}
                        onChange={e => {
                          setQuoteOptions(prev => prev.map(o => o.id === effectiveActiveOptionId ? { ...o, name: e.target.value } : o));
                          supabase.from('quote_options').update({ name: e.target.value }).eq('id', effectiveActiveOptionId);
                        }}
                        placeholder="Option name"
                      />
                    </div>
                  )}

                  {/* Line Items & Pricing header for option */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">Line Items &amp; Pricing</h2>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-medium text-[#1e3a5f]">
                        {effectiveScopeOptions.find(o => o.id === effectiveActiveOptionId)?.name ?? 'Option'}: {fmt(activeItems.reduce((s, i) => s + i.quantity * (i.good_price ?? 0), 0))}
                      </span>
                      <span className="text-gray-400">All scopes: {fmt(grandTotal)}</span>
                    </div>
                  </div>

                  {/* Visibility toggles */}
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer sees:</span>
                    {[
                      { label: 'Line Item Prices', val: showLineItemPrices, set: setShowLineItemPrices },
                      { label: 'Section Totals', val: showSectionTotals, set: setShowSectionTotals },
                      { label: 'Item Descriptions', val: showItemDescriptions, set: setShowItemDescriptions },
                    ].map(({ label, val, set }) => (
                      <button
                        key={label}
                        onClick={() => set(!val)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${val ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-400 border-gray-300 line-through'}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${val ? 'bg-white' : 'bg-gray-300'}`} />
                        {label}
                      </button>
                    ))}
                    {!showLineItemPrices && (
                      <button
                        onClick={() => setShowUpgradePrices(!showUpgradePrices)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${showUpgradePrices ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-400 border-gray-300 line-through'}`}
                        title="Show prices on upgrade/add-on items even when line item prices are hidden"
                      >
                        <span className={`w-2 h-2 rounded-full ${showUpgradePrices ? 'bg-white' : 'bg-gray-300'}`} />
                        Upgrade Prices
                      </button>
                    )}
                  </div>

                  {/* Items for active option — single-price column for multi_scope */}
                  <LineItemEditor
                    items={activeItems}
                    onChange={changed => {
                      setLineItemsWithHistory(prev => [
                        ...prev.filter(i => i.quote_option_id !== effectiveActiveOptionId),
                        ...changed.map(i => ({
                          ...i,
                          quote_option_id: effectiveActiveOptionId,
                          price: i.good_price,
                        })),
                      ]);
                    }}
                    showLineItemPrices={showLineItemPrices}
                    showSectionTotals={showSectionTotals}
                    showItemDescriptions={showItemDescriptions}
                    companyId={companyId}
                    aiEnabled={aiEnabled}
                    company={localCompany}
                    onCompanyChange={setLocalCompany}
                    companyPricing={companyPricing}
                    onPriceSave={handlePriceSave}
                    activeTier="good"
                    goodTierName={effectiveScopeOptions.find(o => o.id === effectiveActiveOptionId)?.name || 'Option'}
                  />

                  {/* Scope totals summary — per-option chips for multi_scope */}
                  {activeItems.length > 0 && (() => {
                    const optColors = [
                      'text-emerald-700 bg-emerald-50 border-emerald-200',
                      'text-blue-700 bg-blue-50 border-blue-200',
                      'text-amber-700 bg-amber-50 border-amber-200',
                    ];
                    const allOptChips = sortedOptsForDisplay.map((opt, idx) => {
                      const total = lineItems
                        .filter(i => i.quote_option_id === opt.id)
                        .reduce((s, i) => s + (i.quantity ?? 0) * (i.good_price ?? 0), 0);
                      return { label: opt.name, total, color: optColors[idx % optColors.length] };
                    }).filter(c => c.total > 0);
                    return allOptChips.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {allOptChips.map(({ label, total, color }) => (
                          <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${color}`}>
                            <span className="text-xs font-bold opacity-70">{label}</span>
                            <span>{fmt(total)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}

                  {/* Add Items from Template */}
                  <button
                    onClick={() => { setShowAddSection(true); setAddSectionType('template'); setAddSectionName(''); }}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 hover:border-[#ff6b35] hover:text-[#ff6b35] rounded-xl text-sm font-medium text-gray-500 transition-colors"
                  >
                    <span className="text-lg leading-none">+</span> Add Template
                  </button>
                </div>
              );
            })()}

            {/* ── Per-Tier Templates + Line Items (tiered model) ─ */}
            {quoteStructureType !== 'multi_scope' && (<>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Different Materials Per Tier</p>
                    <p className="text-xs text-gray-500">Load a separate project template for each option (e.g. Asphalt / Metal / Standing Seam)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !usePerTierItems;
                    setUsePerTierItems(next);
                    if (next) {
                      // Tag every currently-untagged item to 'good' so they don't
                      // bleed through to Better/Best when per-tier mode activates.
                      // Items that already have a tier tag are left unchanged.
                      setLineItemsWithHistory(prev =>
                        prev.map(item => ({
                          ...item,
                          tiers_applicable: item.tiers_applicable?.length ? item.tiers_applicable : ['good'],
                        }))
                      );
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${usePerTierItems ? 'bg-indigo-600' : 'bg-gray-200'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${usePerTierItems ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {usePerTierItems && (
                <div className="mt-4 grid gap-3">
                  {([
                    { tier: 'good' as const, label: goodTierName, color: 'emerald', badge: 'bg-emerald-100 text-emerald-700' },
                    { tier: 'better' as const, label: betterTierName, color: 'blue', badge: 'bg-blue-100 text-blue-700' },
                    { tier: 'best' as const, label: bestTierName, color: 'amber', badge: 'bg-amber-100 text-amber-700' },
                  ]).map(({ tier, label, badge }) => (
                    <div key={tier} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge}`}>{label}</span>
                      <select
                        value={perTierPending[tier]}
                        onChange={e => setPerTierPending(prev => ({ ...prev, [tier]: e.target.value }))}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="">Select a template…</option>
                        {availableTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!perTierPending[tier]}
                        onClick={() => {
                          const tmpl = availableTemplates.find(t => t.id === perTierPending[tier]);
                          if (tmpl) loadTemplateForTier(tier, tmpl);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                      >
                        Load
                      </button>
                      {perTierLabels[tier] && (
                        <span className="text-xs text-gray-500 flex-shrink-0 hidden sm:block">✓ {perTierLabels[tier]}</span>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 mt-1">Items loaded per tier are tagged and shown independently on the customer quote. You can still add shared items below that appear in all tiers.</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Line Items &amp; Pricing</h2>
              <div className="flex items-center gap-4 text-sm">
                <span className={`font-medium transition-opacity ${usePerTierItems && perTierEditorTab !== 'good' ? 'opacity-30 text-gray-400' : 'text-emerald-600'}`}>
                  {goodTierName}: {formatCurrency(totals.good)}
                </span>
                {includeBetter && (
                  <span className={`font-medium transition-opacity ${usePerTierItems && perTierEditorTab !== 'better' ? 'opacity-30 text-gray-400' : 'text-blue-600'}`}>
                    {betterTierName}: {formatCurrency(totals.better)}
                  </span>
                )}
                {includeBest && (
                  <span className={`font-medium transition-opacity ${usePerTierItems && perTierEditorTab !== 'best' ? 'opacity-30 text-gray-400' : 'text-amber-600'}`}>
                    {bestTierName}: {formatCurrency(totals.best)}
                  </span>
                )}
              </div>
            </div>

            {/* Visibility toggles + undo */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer sees:</span>
              <button
                onClick={() => setShowLineItemPrices(!showLineItemPrices)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  showLineItemPrices
                    ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                    : 'bg-white text-gray-400 border-gray-300 line-through'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${showLineItemPrices ? 'bg-white' : 'bg-gray-300'}`} />
                Line Item Prices
              </button>
              <button
                onClick={() => setShowSectionTotals(!showSectionTotals)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  showSectionTotals
                    ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                    : 'bg-white text-gray-400 border-gray-300 line-through'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${showSectionTotals ? 'bg-white' : 'bg-gray-300'}`} />
                Section Totals
              </button>
              <button
                onClick={() => setShowItemDescriptions(!showItemDescriptions)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  showItemDescriptions
                    ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                    : 'bg-white text-gray-400 border-gray-300 line-through'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${showItemDescriptions ? 'bg-white' : 'bg-gray-300'}`} />
                Item Descriptions
              </button>
              {!showLineItemPrices && (
                <button
                  onClick={() => setShowUpgradePrices(!showUpgradePrices)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    showUpgradePrices
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-400 border-gray-300 line-through'
                  }`}
                  title="Show prices on upgrade/add-on items even when line item prices are hidden"
                >
                  <span className={`w-2 h-2 rounded-full ${showUpgradePrices ? 'bg-white' : 'bg-gray-300'}`} />
                  Upgrade Prices
                </button>
              )}
              {!showLineItemPrices && !showSectionTotals && (
                <span className="text-xs text-amber-600 font-medium ml-1">⚠ Only grand total will be shown</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {lineItemsHistory.length > 0 && (
                  <button
                    onClick={undoLineItems}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all"
                    title="Undo last add/remove"
                  >
                    ↩ Undo
                  </button>
                )}
                {lineItems.length > 0 && (
                  <button
                    onClick={() => {
                      const tierLabel = usePerTierItems
                        ? (perTierEditorTab === 'good' ? goodTierName : perTierEditorTab === 'better' ? betterTierName : bestTierName)
                        : null;
                      const msg = tierLabel
                        ? `Are you sure you want to clear all ${tierLabel} materials?`
                        : 'Are you sure you want to clear all material? This will remove all line items.';
                      if (window.confirm(msg)) {
                        if (usePerTierItems) {
                          setLineItemsWithHistory(prev => prev.filter(i => !i.tiers_applicable?.includes(perTierEditorTab)));
                        } else {
                          setLineItemsWithHistory([]);
                          setUseManualTotals(false);
                          setManualGoodTotal(0);
                          setManualBetterTotal(0);
                          setManualBestTotal(0);
                        }
                        toast.success(tierLabel ? `${tierLabel} materials cleared.` : 'All line items cleared.');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 transition-all"
                    title="Clear line items"
                  >
                    ✕ Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Per-tier tab bar */}
            {usePerTierItems && (
              <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/40 p-3">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2 px-1">
                  Select a tier to edit its line items
                </p>
                <div className="flex gap-2">
                  {([
                    { key: 'good' as const, label: goodTierName, color: 'emerald',
                      activeBg: 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-300',
                      activeCount: 'bg-emerald-500 text-white',
                      inactiveText: 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100' },
                    { key: 'better' as const, label: betterTierName, color: 'blue',
                      activeBg: 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300',
                      activeCount: 'bg-blue-500 text-white',
                      inactiveText: 'text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100' },
                    { key: 'best' as const, label: bestTierName, color: 'amber',
                      activeBg: 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300',
                      activeCount: 'bg-amber-400 text-white',
                      inactiveText: 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100' },
                  ] as const).map(({ key, label, activeBg, activeCount, inactiveText }) => {
                    const count = lineItems.filter(i => i.tiers_applicable?.includes(key)).length;
                    const active = perTierEditorTab === key;
                    const saved = measuredTiers.has(key);
                    const templateForTier = key === 'good' ? perTierPending.good : key === 'better' ? perTierPending.better : perTierPending.best;
                    const templateNameForTier = templateForTier ? (availableTemplates.find(t => t.id === templateForTier)?.name ?? '') : '';
                    return (
                      <button
                        key={key}
                        onClick={() => setPerTierEditorTab(key)}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-3 rounded-xl text-sm font-bold transition-all duration-150 ${active ? activeBg : inactiveText}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{label}</span>
                          {saved && (
                            <svg className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${active ? activeCount : 'bg-white/70 text-gray-500'}`}>{count}</span>
                        </div>
                        {templateNameForTier && (
                          <span className={`text-xs leading-tight truncate max-w-full ${active ? 'opacity-90' : 'opacity-60'}`}>{templateNameForTier}</span>
                        )}
                        {active && !templateNameForTier && <span className="text-xs opacity-75">← editing now</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active tier editing banner */}
            {usePerTierItems && (() => {
              const tierColor = perTierEditorTab === 'good' ? { bg: 'bg-emerald-600', ring: 'ring-emerald-300', text: 'text-emerald-700', light: 'bg-emerald-50 border-emerald-200' }
                : perTierEditorTab === 'better' ? { bg: 'bg-blue-600', ring: 'ring-blue-300', text: 'text-blue-700', light: 'bg-blue-50 border-blue-200' }
                : { bg: 'bg-amber-500', ring: 'ring-amber-300', text: 'text-amber-700', light: 'bg-amber-50 border-amber-200' };
              const activeTierLabel = perTierEditorTab === 'good' ? (goodTierName || 'Good') : perTierEditorTab === 'better' ? (betterTierName || 'Better') : (bestTierName || 'Best');
              const activeTierTemplate = perTierEditorTab === 'good' ? perTierPending.good : perTierEditorTab === 'better' ? perTierPending.better : perTierPending.best;
              const activeTierTemplateName = activeTierTemplate ? (availableTemplates.find(t => t.id === activeTierTemplate)?.name ?? '') : '';
              const isSaved = measuredTiers.has(perTierEditorTab);
              return (
                <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${tierColor.light}`}>
                  <div className={`flex items-center gap-2 ${tierColor.bg} text-white text-xs font-bold px-3 py-1 rounded-lg`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Editing: {activeTierLabel}
                  </div>
                  {activeTierTemplateName && (
                    <span className={`text-sm font-semibold ${tierColor.text}`}>{activeTierTemplateName}</span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    {isSaved
                      ? <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>Measurements saved</span>
                      : <span className="text-xs text-gray-400">No measurements saved yet</span>
                    }
                  </div>
                </div>
              );
            })()}

            <LineItemEditor
              items={usePerTierItems
                ? lineItems.filter(i => !i.tiers_applicable?.length || i.tiers_applicable.includes(perTierEditorTab))
                : lineItems}
              onChange={changed => {
                if (!usePerTierItems) {
                  setLineItemsWithHistory(changed);
                } else {
                  // Merge: replace items for the active tier (and null-tagged universal items),
                  // keep items that are explicitly tagged to other tiers only
                  setLineItemsWithHistory(prev => [
                    ...prev.filter(i => i.tiers_applicable?.length && !i.tiers_applicable.includes(perTierEditorTab)),
                    ...changed,
                  ]);
                }
              }}
              showLineItemPrices={showLineItemPrices}
              showSectionTotals={showSectionTotals}
              showItemDescriptions={showItemDescriptions}
              activeTier={usePerTierItems ? perTierEditorTab : undefined}
              includeBetter={includeBetter}
              includeBest={includeBest}
              companyId={companyId}
              aiEnabled={aiEnabled}
              company={localCompany}
              onCompanyChange={setLocalCompany}
              companyPricing={companyPricing}
              onPriceSave={handlePriceSave}
            />

            {/* Add Items from Template button */}
            <button
              onClick={() => { setShowAddSection(true); setAddSectionType('template'); setAddSectionName(''); }}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 hover:border-[#ff6b35] hover:text-[#ff6b35] rounded-xl text-sm font-medium text-gray-500 transition-colors"
            >
              <span className="text-lg leading-none">+</span> Add Template
            </button>
            </>)}
            {/* end quoteOptions.length === 0 legacy section */}

            {/* Add-ons & Suggested Upgrades */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Add-ons &amp; Suggested Upgrades</h3>
                <p className="text-xs text-gray-500 mt-0.5">These appear after the quote tiers, letting customers select optional enhancements before signing.</p>
              </div>
              <div className="p-4 space-y-2">
                {upgrades.map((upgrade, upgradeIndex) => (
                  <div
                    key={upgrade.id}
                    className="border border-gray-100 hover:border-gray-200 rounded-lg p-3 mb-2 transition-all"
                  >
                    {/* Top row: drag handle + grid */}
                    <div className="flex items-start gap-2">
                      {/* Drag handle */}
                      <div className="mt-2 text-gray-300 hover:text-gray-500 transition-colors shrink-0 cursor-grab" title="Drag to reorder">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      {/* Main fields grid */}
                      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">
                        {/* Item name — 6 cols */}
                        <div className="lg:col-span-6">
                          <label className="lg:hidden text-xs text-gray-500 mb-1 block">Item Name</label>
                          <input
                            type="text"
                            value={upgrade.item_name}
                            onChange={(e) => {
                              const updated = [...upgrades];
                              updated[upgradeIndex] = { ...updated[upgradeIndex], item_name: e.target.value };
                              setUpgrades(updated);
                            }}
                            placeholder="Add-on name"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                          />
                        </div>
                        {/* Unit — 1 col */}
                        <div className="lg:col-span-1">
                          <label className="lg:hidden text-xs text-gray-500 mb-1 block">Unit</label>
                          <select
                            value={upgrade.unit}
                            onChange={(e) => {
                              const updated = [...upgrades];
                              updated[upgradeIndex] = { ...updated[upgradeIndex], unit: e.target.value };
                              setUpgrades(updated);
                            }}
                            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none bg-white"
                          >
                            <option value="each">each</option>
                            <option value="sq">sq (square)</option>
                            <option value="sheet">sheet (4×8)</option>
                            <option value="gal">gal</option>
                            <option value="lf">lf</option>
                            <option value="sq ft">sq ft</option>
                            <option value="hr">hr</option>
                            <option value="lot">lot</option>
                          </select>
                        </div>
                        {/* Qty — 1 col */}
                        <div className="lg:col-span-1">
                          <label className="lg:hidden text-xs text-gray-500 mb-1 block">Qty</label>
                          <input
                            type="number"
                            value={upgrade.quantity}
                            onChange={(e) => {
                              const updated = [...upgrades];
                              updated[upgradeIndex] = { ...updated[upgradeIndex], quantity: parseFloat(e.target.value) || 1 };
                              setUpgrades(updated);
                            }}
                            className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                            min="0.5"
                            step="0.5"
                          />
                        </div>
                        {/* Price — 3 cols (spans where good/better/best would be) */}
                        <div className="lg:col-span-3">
                          <label className="lg:hidden text-xs text-gray-500 mb-1 block">Add-on Price</label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                            <input
                              type="number"
                              value={upgrade.price}
                              onChange={(e) => {
                                const updated = [...upgrades];
                                updated[upgradeIndex] = { ...updated[upgradeIndex], price: parseFloat(e.target.value) || 0 };
                                setUpgrades(updated);
                              }}
                              className="w-full pl-5 pr-2 py-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        {/* Delete — 1 col */}
                        <div className="lg:col-span-1 flex items-center justify-end">
                          <button
                            onClick={() => setUpgrades(upgrades.filter((_, i) => i !== upgradeIndex))}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove upgrade"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Description row — full width, matches line item style */}
                    <div className="mt-2 pl-6">
                      <div className="relative">
                        <textarea
                          rows={2}
                          value={upgrade.description}
                          onChange={(e) => {
                            if (upgradeDescUndo.has(upgrade.id)) {
                              setUpgradeDescUndo(prev => { const m = new Map(prev); m.delete(upgrade.id); return m; });
                            }
                            const updated = [...upgrades];
                            updated[upgradeIndex] = { ...updated[upgradeIndex], description: e.target.value };
                            setUpgrades(updated);
                          }}
                          placeholder="Description (optional) — or click ✨ to generate with AI"
                          className="w-full px-3 py-2 pr-28 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none resize-none"
                        />
                        <div className="absolute bottom-2 right-2 flex items-center gap-1">
                          {upgradeDescUndo.has(upgrade.id) && (
                            <button
                              type="button"
                              onClick={() => {
                                const prev = upgradeDescUndo.get(upgrade.id) ?? '';
                                const updated = [...upgrades];
                                updated[upgradeIndex] = { ...updated[upgradeIndex], description: prev };
                                setUpgrades(updated);
                                setUpgradeDescUndo(m => { const n = new Map(m); n.delete(upgrade.id); return n; });
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                              title="Undo AI — restore previous description"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Undo
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={upgradeDescGenerating.has(upgrade.id)}
                            onClick={async () => {
                              if (!aiEnabled) {
                                toast('Enable AI in Settings → AI Configuration to use description generation.');
                                return;
                              }
                              const prev = upgrade.description || '';
                              setUpgradeDescGenerating(s => new Set(s).add(upgrade.id));
                              try {
                                const desc = await generateLineItemDescription(companyId, {
                                  item_name: upgrade.item_name,
                                  category: 'Add-on',
                                  existing_description: upgrade.description || null,
                                });
                                setUpgradeDescUndo(m => new Map(m).set(upgrade.id, prev));
                                setUpgrades(u => u.map((up, i) => i === upgradeIndex ? { ...up, description: desc } : up));
                              } catch (err: any) {
                                toast.error('AI description failed: ' + (err.message || 'Check AI settings'));
                              } finally {
                                setUpgradeDescGenerating(s => { const n = new Set(s); n.delete(upgrade.id); return n; });
                              }
                            }}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors
                              ${aiEnabled
                                ? 'text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200'
                                : 'text-gray-400 bg-gray-50 border border-gray-200 cursor-not-allowed'}`}
                            title={aiEnabled ? (upgrade.description ? 'Rewrite description with AI' : 'Generate description with AI') : 'Enable AI in Settings → AI Configuration'}
                          >
                            {upgradeDescGenerating.has(upgrade.id)
                              ? <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                              : <Sparkles className="w-3 h-3" />}
                            {upgradeDescGenerating.has(upgrade.id) ? 'Writing…' : '✨ AI'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setUpgrades([...upgrades, {
                    id: `upgrade-${Date.now()}-${Math.random()}`,
                    item_name: '',
                    description: '',
                    unit: 'each',
                    quantity: 1,
                    price: 0,
                    is_suggested: true,
                  }])}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 hover:border-[#ff6b35] hover:text-[#ff6b35] rounded-xl text-sm font-medium text-gray-500 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Upgrade
                </button>
              </div>
            </div>

            {/* Add Section Modal */}
            {showAddSection && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Add Items from Template</h3>
                      <button onClick={() => setShowAddSection(false)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">✕</button>
                    </div>

                    {/* Toggle template vs custom */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setAddSectionType('template')}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${addSectionType === 'template' ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                      >From Template</button>
                      <button
                        onClick={() => setAddSectionType('custom')}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${addSectionType === 'custom' ? 'bg-[#ff6b35] text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                      >Custom Section</button>
                    </div>

                    {addSectionType === 'template' ? (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 mb-3">Pick a template to append its items as a new section.</p>
                        {availableTemplates.map(t => (
                          <button
                            key={t.id}
                            onClick={() => appendTemplateSection(t)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent rounded-xl text-left transition-colors"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">{t.name}</p>
                              <p className="text-xs text-gray-500">{t.lineItems.length} items • {t.coverPageTitle}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-xs text-gray-500">Name your section (e.g. "Gutters", "Interior Work", "Windows").</p>
                        <input
                          type="text"
                          value={addSectionName}
                          onChange={e => setAddSectionName(e.target.value)}
                          placeholder="Section name..."
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent outline-none"
                          onKeyDown={e => e.key === 'Enter' && addCustomSection(addSectionName)}
                          autoFocus
                        />
                        <button
                          onClick={() => addCustomSection(addSectionName)}
                          disabled={!addSectionName.trim()}
                          className="w-full py-2.5 bg-[#ff6b35] text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-[#e55a2b] transition-colors"
                        >Add Custom Section</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Scope Pricing Summary (tiered model) ── */}
            {quoteStructureType !== 'multi_scope' && lineItems.length > 0 && (() => {
              const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
              const tierFilter = (tier: 'good' | 'better' | 'best') => (i: LineItem) =>
                !usePerTierItems || !i.tiers_applicable?.length || i.tiers_applicable.includes(tier);
              const goodTotal   = lineItems.filter(tierFilter('good'))  .reduce((s, i) => s + i.quantity * i.good_price,   0);
              const betterTotal = lineItems.filter(tierFilter('better')).reduce((s, i) => s + i.quantity * i.better_price, 0);
              const bestTotal   = lineItems.filter(tierFilter('best'))  .reduce((s, i) => s + i.quantity * i.best_price,   0);
              // Use squares WITH waste applied so $/sq reflects the actual installed area
              const roofSquaresRaw = roofrReport
                ? ((roofrReport.reportSummary?.totalRoofAreaSqft || roofrReport.totalRoofAreaSqft) / 100)
                : (parseFloat(manualSquares) || null);
              // Fallback: infer sq count from line items when no report or manual entry
              const lineItemSqFallback = roofSquaresRaw == null
                ? lineItems
                    .filter(i => i.unit === 'sq' && (
                      i.item_name?.toLowerCase().includes('tear off') ||
                      i.item_name?.toLowerCase().includes('shingle') ||
                      i.item_name?.toLowerCase().includes('install labor')
                    ))
                    .reduce((max, i) => Math.max(max, i.quantity ?? 0), 0) || null
                : null;
              const roofSquares = roofSquaresRaw
                ? roofSquaresRaw * (1 + manualWaste / 100)
                : lineItemSqFallback;
              const showBetter = includeBetter && betterTotal > 0;
              const showBest   = includeBest   && bestTotal  > 0;
              return (
                <div className="rounded-2xl border border-[#1e3a5f]/20 bg-[#1e3a5f]/[0.03] p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#1e3a5f] uppercase tracking-wide">Quote Total</h3>
                  </div>

                  {/* Per Square Pricing — above tier totals so the equation is visible first */}
                  {(() => {
                    const rate = parseFloat(globalPerSqGoodRate) || 0;
                    const sq   = roofSquares || 0;
                    const proj = rate > 0 && sq > 0 ? rate * sq : null;
                    const tierCfg = {
                      good:   {label: goodTierName,   ring: 'focus:ring-emerald-500', btnCls: 'bg-emerald-700 hover:bg-emerald-800', activeCls: 'bg-emerald-700 text-white border-emerald-700', previewCls: 'bg-emerald-50 border-emerald-100 text-emerald-700'},
                      better: {label: betterTierName, ring: 'focus:ring-blue-500',    btnCls: 'bg-blue-700 hover:bg-blue-800',       activeCls: 'bg-blue-700 text-white border-blue-700',       previewCls: 'bg-blue-50 border-blue-100 text-blue-700'},
                      best:   {label: bestTierName,   ring: 'focus:ring-amber-500',   btnCls: 'bg-amber-700 hover:bg-amber-800',     activeCls: 'bg-amber-700 text-white border-amber-700',     previewCls: 'bg-amber-50 border-amber-100 text-amber-700'},
                    } as const;
                    const cfg = tierCfg[globalPerSqTier];
                    return (
                      <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-700">Per Square Pricing</p>
                          {sq > 0 && <span className="text-[10px] text-gray-400">{sq.toFixed(1)} sq</span>}
                        </div>
                        <p className="text-[10px] text-gray-400">Apply a $/sq rate to one tier only — other tiers stay untouched. Sets the primary sq item price and zeroes all other prices in that tier.</p>

                        {/* Tier selector */}
                        <div className="flex gap-1.5">
                          {(['good', 'better', 'best'] as const).map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setGlobalPerSqTier(t)}
                              className={`flex-1 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                                globalPerSqTier === t
                                  ? tierCfg[t].activeCls
                                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {tierCfg[t].label}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 shrink-0">{cfg.label} $/sq</span>
                          <input
                            type="number"
                            min={0}
                            step={5}
                            placeholder="e.g. 550"
                            value={globalPerSqGoodRate}
                            onChange={e => setGlobalPerSqGoodRate(e.target.value)}
                            className={`flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 ${cfg.ring} focus:border-transparent outline-none`}
                          />
                        </div>
                        {rate > 0 && (
                          <div className={`text-center border rounded-lg py-1.5 space-y-0.5 text-[11px] ${cfg.previewCls}`}>
                            <p className="font-semibold">{cfg.label}: ${rate}/sq</p>
                            {proj && <p className="font-bold text-sm">{fmt(proj)}</p>}
                            {!proj && sq === 0 && <p className="text-[10px] opacity-70">enter squares to see total</p>}
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={!rate}
                          onClick={() => {
                            if (!rate) return;
                            // Snapshot for undo (per-sq only changes prices, not item count)
                            setLineItemsHistory(prev => [...prev.slice(-19), lineItems]);
                            const priceKey = (globalPerSqTier + '_price') as 'good_price' | 'better_price' | 'best_price';

                            // In per-tier-items mode restrict the search to items belonging to
                            // the selected tier so we don't grab the 'good'-tagged shingle when
                            // the user is applying a 'better' rate.
                            const tierCandidates = usePerTierItems
                              ? lineItems.filter(i => !i.tiers_applicable?.length || i.tiers_applicable.includes(globalPerSqTier))
                              : lineItems;

                            // Find primary sq item — shingle/panel first, then first sq-unit item
                            const shingleCandidate = tierCandidates.find(i => isShinglePrimaryItem(i));
                            const targetItem = shingleCandidate ?? tierCandidates.find(i => !(i as any).is_divider && i.unit === 'sq');
                            const targetIdx = targetItem ? lineItems.indexOf(targetItem) : -1;

                            // Only zero items in the same category as the target so that a
                            // roofing per-sq apply doesn't wipe siding/gutter prices (and vice-versa).
                            // In per-tier mode also restrict zeroing to items in the same tier.
                            const targetCategory = targetItem
                              ? (targetItem.category || '').toLowerCase()
                              : null;
                            const updated = lineItems.map(item => {
                              if (targetCategory !== null && (item.category || '').toLowerCase() !== targetCategory) return item;
                              if (usePerTierItems && item.tiers_applicable?.length && !item.tiers_applicable.includes(globalPerSqTier)) return item;
                              return { ...item, [priceKey]: 0 };
                            });
                            if (targetIdx >= 0) {
                              // The entered rate is $/sq — a bundle-billed shingle item
                              // (3 bundles/sq) needs the equivalent per-bundle price so
                              // quantity(bundles) × price still totals to rate × squares.
                              const appliedRate = toCents(updated[targetIdx].unit === 'bdl' ? rate / 3 : rate);
                              updated[targetIdx] = { ...updated[targetIdx], [priceKey]: appliedRate };
                            }
                            setLineItems(updated);
                            setGlobalPerSqGoodRate('');
                            toast.success(`Applied ${cfg.label} $${rate}/sq — other tiers unchanged · Undo to reverse`);
                          }}
                          className={`w-full py-2 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors ${cfg.btnCls}`}
                        >
                          Apply to {cfg.label}
                        </button>
                      </div>
                    );
                  })()}

                  {/* Tier totals */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white border border-emerald-200 p-3 text-center">
                      <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">{goodTierName}</p>
                      <p className="text-lg font-bold text-gray-900">{fmt(goodTotal)}</p>
                      {roofSquares && roofSquares > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{fmt(goodTotal / roofSquares)}/sq</p>
                      )}
                    </div>
                    {showBetter && (
                      <div className="rounded-xl bg-white border border-blue-200 p-3 text-center">
                        <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-1">{betterTierName}</p>
                        <p className="text-lg font-bold text-gray-900">{fmt(betterTotal)}</p>
                        {roofSquares && roofSquares > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{fmt(betterTotal / roofSquares)}/sq</p>
                        )}
                      </div>
                    )}
                    {showBest && (
                      <div className="rounded-xl bg-white border border-amber-200 p-3 text-center">
                        <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">{bestTierName}</p>
                        <p className="text-lg font-bold text-gray-900">{fmt(bestTotal)}</p>
                        {roofSquares && roofSquares > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{fmt(bestTotal / roofSquares)}/sq</p>
                        )}
                      </div>
                    )}
                    {!showBetter && !showBest && <div />}
                    {!showBest && <div />}
                  </div>

                  {/* Price mode toggle + markup indicator */}
                  {lineItems.length > 0 && (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700">Price list mode</p>
                        <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
                          {pricesIncludeMarkup
                            ? 'Prices already include your markup — no additional markup applied'
                            : 'Prices are contractor cost — use the slider below to add markup'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5 shrink-0">
                        <button
                          onClick={() => pricesIncludeMarkup && togglePricesIncludeMarkup()}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            !pricesIncludeMarkup ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Cost
                        </button>
                        <button
                          onClick={() => !pricesIncludeMarkup && togglePricesIncludeMarkup()}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            pricesIncludeMarkup ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Sell Price
                        </button>
                      </div>
                    </div>
                  )}
                  {priceAdjPct > 0 && !pricesIncludeMarkup && (
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      Pricing includes {priceAdjPct}% labor &amp; profit markup
                    </div>
                  )}
                  {pricesIncludeMarkup && (
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      Sell prices — markup already included in your price list
                    </div>
                  )}
                  {priceAdjPct === 0 && lineItems.length > 0 && !pricesIncludeMarkup && (
                    <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      No material markup applied — use the slider below
                    </div>
                  )}
                  {/* Labor is required before a quote can be sent */}
                  {lineItems.length > 0 && quoteNeedsLabor({ created_at: quoteCreatedAt }) && !hasPricedLabor(lineItems as any) && (
                    <div className="flex items-start gap-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span>
                        <span className="font-bold">No labor priced on this quote.</span> Sending is blocked until labor is added —
                        without it the quote is below cost, and a target price would load entirely onto materials.
                      </span>
                    </div>
                  )}

                </div>
              );
            })()}

            {/* ── Labor & Profit Markup Slider ── hidden when prices already include markup ── */}
            {lineItems.length > 0 && !pricesIncludeMarkup && (
              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Material Markup</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Applied to materials only · labor stays at its real rate so it can be checked and changed
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-black tabular-nums ${priceAdjPct > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {priceAdjPct > 0 ? '+' : ''}{priceAdjPct}%
                    </span>
                    {priceAdjPct > 0 && (
                      <p className="text-xs text-emerald-600 font-medium">×{(1 + priceAdjPct / 100).toFixed(2)} multiplier</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-emerald-700 font-semibold w-6 shrink-0">0%</span>
                  <input
                    type="range" min={0} max={200} step={5}
                    value={Math.max(0, priceAdjPct)}
                    onChange={e => handlePriceAdjust(parseInt(e.target.value, 10))}
                    className="flex-1 accent-emerald-600 h-2"
                  />
                  <span className="text-xs text-emerald-700 font-semibold w-10 shrink-0">+200%</span>
                </div>

                <div className="flex items-center justify-between text-xs text-emerald-700">
                  <span>e.g. +65% turns $100 material → $165 &nbsp;·&nbsp; +100% doubles the price</span>
                  {priceAdjPct !== 0 && (
                    <button
                      onClick={() => handlePriceAdjust(0)}
                      className="text-xs text-orange-600 hover:text-orange-700 font-semibold underline underline-offset-2 shrink-0 ml-3"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Price to a target $/sq — solves for the material markup */}
                {(() => {
                  const sq = targetSquares;
                  if (!sq || sq <= 0) return null;
                  const target = parseFloat(targetPerSq);
                  const solved = target > 0 ? solveMarkupForTarget(target, sq, targetTier) : null;
                  return (
                    <div className="pt-2 border-t border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-emerald-800">Or price to a target</p>
                        <span className="text-[10px] text-emerald-600">{sq.toFixed(1)} sq</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {/* Only the tiers this quote offers. A single-tier quote listed
                              Better and Best, selectable but never priceable. */}
                          {(['good', 'better', 'best'] as const)
                            .filter(t =>
                              t === 'good' ||
                              // Separate scopes price each scope once, on the
                              // good tier — the preview renders every scope
                              // that way — so Better and Best mean nothing here
                              // however the Project Details toggles are set.
                              (quoteStructureType !== 'multi_scope' &&
                                (t === 'better' ? includeBetter : includeBest)))
                            .map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTargetTier(t)}
                              className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                                targetTier === t
                                  ? 'bg-emerald-700 text-white border-emerald-700'
                                  : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                              }`}
                            >
                              {t === 'good' ? goodTierName : t === 'better' ? betterTierName : bestTierName}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1 flex-1">
                          <span className="text-xs text-emerald-700">$</span>
                          <input
                            type="number" min="0" step="5" placeholder="525"
                            value={targetPerSq}
                            onChange={e => setTargetPerSq(e.target.value)}
                            className="w-24 px-2 py-1 border border-emerald-200 rounded-md text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                          <span className="text-xs text-emerald-700">/sq</span>
                        </div>
                        <button
                          type="button"
                          disabled={!solved || solved.pct < 0 || solved.pct > MAX_MARKUP_PCT}
                          onClick={() => solved && applyTargetToTier(target, sq, targetTier)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Apply
                        </button>
                      </div>
                      {target > 0 && (
                        !solved
                          ? <p className="text-[11px] text-emerald-700">Add some material lines first.</p>
                          : solved.pct > MAX_MARKUP_PCT
                            ? <p className="text-[11px] text-orange-700">Reaching ${target.toFixed(0)}/sq would need +{solved.pct}% on materials, past the {MAX_MARKUP_PCT}% limit. Check your material costs — they look too low for this target.</p>
                          : solved.pct < 0
                            ? (
                              // A negative solve means the quote already costs
                              // more than the target — not necessarily that
                              // labor alone does. Saying "labor alone" when
                              // materials are the larger half sends people to
                              // the wrong number.
                              <p className="text-[11px] text-orange-700">
                                At cost this comes to ${((solved.labor + solved.materialsAtCost) / sq).toFixed(2)}/sq
                                {' '}— materials ${(solved.materialsAtCost / sq).toFixed(2)}/sq plus labor and fees ${(solved.labor / sq).toFixed(2)}/sq
                                {' '}— which is already above the ${target.toFixed(0)}/sq target. Raise the target, or check the lines counted as labor and fees.
                              </p>
                            )
                            : (
                              <div className="space-y-1">
                                <p className="text-[11px] text-emerald-700">
                                  Materials ${((target * sq - solved.labor) / sq).toFixed(2)}/sq
                                  {' '}+ labor ${(solved.labor / sq).toFixed(2)}/sq = <span className="font-bold">${target.toFixed(2)}/sq</span>
                                  {' '}· needs <span className="font-bold">+{solved.pct}%</span> on materials
                                </p>
                                {solved.labor === 0 && (
                                  <p className="text-[11px] text-orange-700 font-medium">
                                    No labor on this quote yet — materials would have to carry the whole ${target.toFixed(0)}/sq.
                                    Add your labor lines first, then set the target.
                                  </p>
                                )}
                              </div>
                            )
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Reuse the numbers from a quote already dialled in. Inert by
                design: applying touches this quote only, never the price list. */}
            <PricingPresets
              companyId={companyId}
              userId={userId}
              createdByMemberId={currentUser?.id ?? null}
              lineItems={lineItems as any}
              onApply={handleApplyPricingPreset}
              onRevert={handleRevertToCompanyPricing}
            />
          </div>
        )}

        {/* Step 3: Photos */}
        {renderStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Photo Documentation</h2>
            <p className="text-sm text-gray-500">Upload inspection photos with damage descriptions and notes for the customer.</p>
            <PhotoUploader
              photos={photos}
              onChange={setPhotos}
              quoteId={quoteId || undefined}
              onAnalyzePhoto={handleAnalyzePhoto}
              analyzingPhotoIndex={aiAnalyzingPhoto}
            />
          </div>
        )}

        {/* Step 6: Brochures & Files */}
        {renderStep === 6 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Brochures & Files</h2>
                <p className="text-sm text-gray-500 mt-0.5">Attach brochures and documents from your file library to include with this quote.</p>
              </div>
              <button
                onClick={() => setIncludeBrochures(v => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${includeBrochures ? 'border-[#1e3a5f] text-[#1e3a5f] bg-blue-50' : 'border-gray-200 text-gray-400 bg-gray-50'}`}
              >
                {includeBrochures ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                {includeBrochures ? 'Included in Quote' : 'Hidden from Quote'}
              </button>
            </div>

            {!includeBrochures && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                Brochures are toggled off — selected files won't appear in the customer's quote.
              </div>
            )}

            {loadingFiles ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#1e3a5f]" />
              </div>
            ) : companyFileLibrary.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
                <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No files in your library yet</p>
                <p className="text-sm text-gray-400 mt-1">Upload brochures and documents in the Files section, then come back to attach them.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {companyFileLibrary.map(file => {
                  const isSelected = attachedFiles.some(f => f.id === file.id);
                  const isPdf = file.fileType === 'application/pdf' || file.fileName.toLowerCase().endsWith('.pdf');
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => {
                        setAttachedFiles(prev =>
                          isSelected ? prev.filter(f => f.id !== file.id) : [...prev, file]
                        );
                      }}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-[#1e3a5f] bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {isPdf ? <FileDown className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium text-sm truncate ${isSelected ? 'text-[#1e3a5f]' : 'text-gray-900'}`}>{file.title || file.fileName}</p>
                          {file.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{file.description}</p>}
                          <p className="text-xs text-gray-400 mt-1">{(file.fileSizeBytes / 1024).toFixed(0)} KB · {file.uploadedByName}</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${isSelected ? 'bg-[#1e3a5f] border-[#1e3a5f]' : 'border-gray-300'}`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {attachedFiles.length > 0 && (
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                <p className="text-sm font-medium text-green-800">{attachedFiles.length} file{attachedFiles.length !== 1 ? 's' : ''} attached</p>
                <p className="text-xs text-green-600 mt-0.5">These will appear as a "Documents & Brochures" section in the customer's quote.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 7: Review */}
        {renderStep === 7 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Review & Send</h2>

            {/* Quote Style — shown here for mobile visibility (not for inspection reports) */}
            {!inspectionOnly && <div className="bg-gray-50 rounded-xl p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Quote Style</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: 'classic' as const, label: 'Classic PDF', desc: 'Clean, professional PDF document' },
                  { id: 'professional' as const, label: 'Professional', desc: 'Modern layout with tier cards' },
                ] as const).map(({ id, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => setQuoteStyle(id)}
                    className={`p-4 rounded-xl border-2 text-left transition-colors ${
                      quoteStyle === id
                        ? 'border-[#ff6b35] bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${quoteStyle === id ? 'text-[#ff6b35]' : 'text-gray-700'}`}>{label}</p>
                    <p className="text-xs text-gray-400 mt-1">{desc}</p>
                  </button>
                ))}
              </div>
            </div>}

            {inspectionOnly ? (
              /* Inspection report review: contingency docs toggle + preview */
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl border border-indigo-200 bg-indigo-50">
                  <Camera className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <p className="text-sm text-indigo-800"><span className="font-semibold">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span> attached to this report</p>
                </div>

                {/* Contingency + 3-day cancel toggle — off for reports used as a
                    completion certificate, where there's no contingency or
                    cancellation window since the work is already done. */}
                <button
                  type="button"
                  onClick={() => setContingencyEnabled(v => !v)}
                  className={`w-full flex items-center justify-between gap-4 p-4 rounded-xl border-2 transition-all ${contingencyEnabled ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${contingencyEnabled ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                      <Shield className={`w-5 h-5 ${contingencyEnabled ? 'text-indigo-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="text-left">
                      <p className={`font-semibold ${contingencyEnabled ? 'text-indigo-900' : 'text-gray-700'}`}>Include Contingency Agreement &amp; 3-Day Right to Cancel</p>
                      <p className="text-xs text-gray-500 mt-0.5">Turn off for a completion certificate — photos and notes only, no cancellation window</p>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${contingencyEnabled ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mt-0.5 ${contingencyEnabled ? 'translate-x-6 ml-0.5' : 'translate-x-0.5 ml-0'}`} />
                  </div>
                </button>

                {contingencyEnabled ? (
                  <>
                    {/* Contingency Agreement preview */}
                    <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden">
                      <div className="bg-indigo-700 px-4 py-2.5 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-white" />
                        <span className="text-sm font-bold text-white">Insurance Contingency Agreement</span>
                        <span className="ml-auto text-xs text-indigo-200">Customer will sign</span>
                      </div>
                      <div className="p-4 space-y-2.5 text-xs text-gray-600">
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-center">
                          <p className="font-bold text-amber-900 text-xs">⚠ THREE (3) BUSINESS DAY RIGHT TO CANCEL</p>
                        </div>
                        {[
                          ['1. Contingency Basis', 'No work performed and no payment due unless insurance carrier approves a claim for the damage described herein.'],
                          ['2. Authorization to Act', 'Property Owner authorizes Contractor to communicate directly with the insurance company on their behalf to facilitate the claim and scope of approved repairs.'],
                          ['3. Scope of Work', 'Contractor agrees to perform all work as outlined in the final insurance scope of loss. Approved supplements will be included in the final contract price.'],
                          ['4. Payment Terms', 'Property Owner agrees to pay all insurance proceeds, any released depreciation, approved supplements, and the applicable deductible.'],
                          ['5–8.', 'Additional terms cover no out-of-pocket cost representations, Property Owner responsibilities, Contractor obligations, and cancellation rights.'],
                        ].map(([title, body]) => (
                          <div key={title as string}>
                            <span className="font-semibold text-gray-800">{title as string} </span>
                            <span>{body as string}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3-Day Right to Cancel preview */}
                    <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
                      <div className="bg-red-700 px-4 py-2.5 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-white" />
                        <span className="text-sm font-bold text-white">3-Day Right to Cancel</span>
                        <span className="ml-auto text-xs text-red-200">Customer will sign</span>
                      </div>
                      <div className="p-4 text-xs text-gray-600 space-y-2">
                        <p>The buyer may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction.</p>
                        <p>If cancelled, any payments made will be returned within 10 business days of receipt of the cancellation notice.</p>
                        <p className="text-gray-400 italic">Company contact information will be shown to the customer for cancellation delivery.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <AlertTriangle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-500">The report will be sent without any agreement — the customer can view photos and notes only. Use this for a completion certificate or any report that doesn't need a signed contingency agreement.</p>
                  </div>
                )}

                {/* Completion certificate toggle — independent of the contingency
                    agreement above. Signable anytime, regardless of quote status,
                    since the underlying agreement is sometimes signed outside the app. */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !completionCertificateEnabled;
                    setCompletionCertificateEnabled(next);
                    // Reflect the document's purpose in its own title, but only
                    // when it's still the untouched default — never clobber a
                    // title the user typed themselves.
                    if (next && coverPageTitle === 'Inspection Report') {
                      setCoverPageTitle('Completion Photos & Certificate');
                    } else if (!next && coverPageTitle === 'Completion Photos & Certificate') {
                      setCoverPageTitle('Inspection Report');
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-4 p-4 rounded-xl border-2 transition-all ${completionCertificateEnabled ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${completionCertificateEnabled ? 'bg-amber-100' : 'bg-gray-100'}`}>
                      <Award className={`w-5 h-5 ${completionCertificateEnabled ? 'text-amber-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="text-left">
                      <p className={`font-semibold ${completionCertificateEnabled ? 'text-amber-900' : 'text-gray-700'}`}>Include Completion Certificate</p>
                      <p className="text-xs text-gray-500 mt-0.5">Customer can sign a Certificate of Completion anytime, whether or not the agreement itself was signed in this app</p>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${completionCertificateEnabled ? 'bg-amber-500' : 'bg-gray-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mt-0.5 ${completionCertificateEnabled ? 'translate-x-6 ml-0.5' : 'translate-x-0.5 ml-0'}`} />
                  </div>
                </button>
              </div>
            ) : quoteStructureType === 'multi_scope' ? (
              /* Multi-scope: show per-option name + total summary */
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Scope Summary</h3>
                <p className="text-xs text-gray-400 mb-4">Each scope is presented as a separate priced option on the customer proposal. Edit scope names in the Line Items step.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[...quoteOptions].sort((a, b) => a.sort_order - b.sort_order).map((opt, idx) => {
                    const optColors = ['border-emerald-200 bg-emerald-50 text-emerald-700', 'border-blue-200 bg-blue-50 text-blue-700', 'border-amber-200 bg-amber-50 text-amber-700'];
                    const cls = optColors[idx % optColors.length];
                    const optTotal = lineItems.filter(i => i.quote_option_id === opt.id).reduce((s, i) => s + (i.quantity ?? 0) * (i.good_price ?? 0), 0);
                    const optItemCount = lineItems.filter(i => i.quote_option_id === opt.id).length;
                    return (
                      <div key={opt.id} className={`rounded-xl border-2 p-5 ${cls}`}>
                        <h3 className="text-sm font-semibold uppercase">{opt.name}</h3>
                        <p className="text-3xl font-bold mt-2">{formatCurrency(optTotal)}</p>
                        <p className="text-xs text-gray-500 mt-1">{optItemCount} line items</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* Tier Name Editor — tiered quotes only */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Tier Names</h3>
                  <p className="text-xs text-gray-400 mb-4">Customize what each tier is called on the customer proposal (e.g. "Silver / Gold / Platinum").</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Good', value: goodTierName, setter: setGoodTierName, color: 'emerald' },
                      { label: 'Better', value: betterTierName, setter: setBetterTierName, color: 'blue', disabled: !includeBetter },
                      { label: 'Best', value: bestTierName, setter: setBestTierName, color: 'amber', disabled: !includeBest },
                    ].map(({ label, value, setter, color, disabled }) => (
                      <div key={label} className={disabled ? 'opacity-40 pointer-events-none' : ''}>
                        <label className={`block text-xs font-semibold mb-1 ${color === 'emerald' ? 'text-emerald-700' : color === 'blue' ? 'text-blue-700' : 'text-amber-700'}`}>{label}</label>
                        <input
                          type="text"
                          value={value}
                          onChange={e => setter(e.target.value)}
                          maxLength={20}
                          className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 ${color === 'emerald' ? 'border-emerald-200 focus:ring-emerald-300' : color === 'blue' ? 'border-blue-200 focus:ring-blue-300' : 'border-amber-200 focus:ring-amber-300'}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary Cards — tiered quotes only */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['good', 'better', 'best'] as const)
                    .filter(tier => tier === 'good' || (tier === 'better' && includeBetter) || (tier === 'best' && includeBest))
                    .map(tier => {
                    const colors = tier === 'good' ? 'border-emerald-200 bg-emerald-50' : tier === 'better' ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50';
                    const textColor = tier === 'good' ? 'text-emerald-700' : tier === 'better' ? 'text-blue-700' : 'text-amber-700';
                    const tierName = tier === 'good' ? goodTierName : tier === 'better' ? betterTierName : bestTierName;
                    return (
                      <div key={tier} className={`rounded-xl border-2 p-5 ${colors}`}>
                        <h3 className={`text-sm font-semibold uppercase ${textColor}`}>{tierName} Option</h3>
                        <p className={`text-3xl font-bold mt-2 ${textColor}`}>{formatCurrency(displayTotals[tier])}</p>
                        <p className="text-xs text-gray-500 mt-1">{lineItems.length} line items</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Tier Option Photos — tiered quotes only (not inspection reports) */}
            {!inspectionOnly && quoteStructureType !== 'multi_scope' && <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Option Photos <span className="font-normal text-gray-400">(optional)</span></h3>
              <p className="text-xs text-gray-400 mb-4">Add a photo to each tier showing what that product option looks like (e.g. a sample roof, siding style, etc.)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  { tier: 'Good', color: 'emerald', value: tierPhotoGood, setter: setTierPhotoGood, enabled: true },
                  { tier: 'Better', color: 'blue', value: tierPhotoBetter, setter: setTierPhotoBetter, enabled: includeBetter },
                  { tier: 'Best', color: 'amber', value: tierPhotoBest, setter: setTierPhotoBest, enabled: includeBest },
                ] as const).map(({ tier, color, value, setter, enabled }) => {
                  const colorMap: Record<string, string> = { emerald: 'border-emerald-400 bg-emerald-50', blue: 'border-blue-400 bg-blue-50', amber: 'border-amber-400 bg-amber-50' };
                  const labelMap: Record<string, string> = { emerald: 'text-emerald-700', blue: 'text-blue-700', amber: 'text-amber-700' };
                  return (
                    <div key={tier} className={`rounded-xl border-2 ${enabled ? colorMap[color] : 'border-gray-200 bg-gray-100 opacity-50'} p-3`}>
                      <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${enabled ? labelMap[color] : 'text-gray-400'}`}>{tier} Option Photo</p>
                      {value ? (
                        <div className="relative">
                          <img src={value} alt={`${tier} option`} className="w-full h-28 object-cover rounded-lg" />
                          {enabled && (
                            <button onClick={() => setter('')} className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80">
                              ×
                            </button>
                          )}
                        </div>
                      ) : enabled ? (
                        <label className="cursor-pointer flex flex-col items-center justify-center h-28 border-2 border-dashed border-current rounded-lg text-gray-400 hover:bg-white/60 transition-colors">
                          <Camera className="w-6 h-6 mb-1" />
                          <span className="text-xs">Upload photo</span>
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingTierPhoto(tier);
                            const tierToastId = toast.loading('Uploading photo…');
                            try {
                              const ext = file.name.split('.').pop() || 'jpg';
                              // flat path — no subfolders, keeps same policy as regular photos
                              const path = `tier-${tier.toLowerCase()}-${companyId}-${Date.now()}.${ext}`;
                              const uploadResult = await Promise.race([
                                supabase.storage.from('quote-photos').upload(path, file, { contentType: file.type, upsert: true }),
                                new Promise<{ error: Error }>((_resolve, reject) =>
                                  setTimeout(() => reject(new Error('Upload timed out — please try again.')), 20_000)
                                ),
                              ]);
                              if ('error' in uploadResult && uploadResult.error) throw uploadResult.error;
                              const { data: urlData } = supabase.storage.from('quote-photos').getPublicUrl(path);
                              setter(urlData.publicUrl);
                              toast.success('Photo uploaded', { id: tierToastId });
                            } catch (err: any) {
                              toast.error(`Upload failed: ${err?.message || 'Unknown error'}`, { id: tierToastId });
                            } finally {
                              setUploadingTierPhoto(null);
                            }
                          }} />
                        </label>
                      ) : (
                        <div className="flex items-center justify-center h-28 text-xs text-gray-400">Tier disabled</div>
                      )}
                      {uploadingTierPhoto === tier && (
                        <p className="text-xs text-center text-gray-500 mt-1">Uploading...</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>}

            {/* Tier Descriptions — tiered quotes only */}
            {quoteStructureType !== 'multi_scope' && <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-700">Tier Descriptions <span className="font-normal text-gray-400">(optional)</span></h3>
                <button
                  onClick={handleGenerateTierDescs}
                  disabled={generatingTierDescs}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white text-xs font-medium rounded-lg hover:bg-[#162d4a] disabled:opacity-50 transition-colors"
                >
                  {generatingTierDescs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {generatingTierDescs ? 'Generating…' : 'AI Generate All'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-4">A short sentence explaining what makes each tier special — shown on the quote so customers understand the value difference. Optionally type a note in each box first (e.g. "full replacement" or "repair only") and AI will base the description on it.</p>
              <div className="space-y-3">
                {([
                  { tier: 'Good', color: 'emerald', value: tierDescGood, setter: setTierDescGood, enabled: true },
                  { tier: 'Better', color: 'blue', value: tierDescBetter, setter: setTierDescBetter, enabled: includeBetter },
                  { tier: 'Best', color: 'amber', value: tierDescBest, setter: setTierDescBest, enabled: includeBest },
                ] as const).map(({ tier, color, value, setter, enabled }) => {
                  const labelMap: Record<string, string> = { emerald: 'text-emerald-700', blue: 'text-blue-700', amber: 'text-amber-700' };
                  const borderMap: Record<string, string> = { emerald: 'border-emerald-200 focus:border-emerald-400', blue: 'border-blue-200 focus:border-blue-400', amber: 'border-amber-200 focus:border-amber-400' };
                  return (
                    <div key={tier} className={`${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                      <label className={`block text-xs font-bold uppercase tracking-wide mb-1 ${labelMap[color]}`}>{tier}</label>
                      <textarea
                        value={value}
                        onChange={e => setter(e.target.value)}
                        placeholder={tier === 'Good' ? 'Type a note for AI (e.g. "full replacement") or leave blank and AI will infer from line items.' : tier === 'Better' ? 'Type a note for AI (e.g. "repair + upgrade") or leave blank and AI will infer from line items.' : 'Type a note for AI (e.g. "premium full replacement") or leave blank and AI will infer from line items.'}
                        rows={2}
                        className={`w-full text-sm px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-offset-0 ${borderMap[color]} text-gray-800 placeholder-gray-300`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>}

            {/* Quote Style Toggle */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Quote Style</h3>
              <p className="text-xs text-gray-400 mb-3">Choose how the quote looks when sent to your customer. Your preference is saved.</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setQuoteStyle('classic')}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${quoteStyle === 'classic' ? 'border-[#1e3a5f] bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                >
                  {quoteStyle === 'classic' && (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-[#1e3a5f] rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                  <div className="w-14 h-16 bg-white border border-gray-300 rounded shadow-sm flex flex-col p-1 gap-0.5">
                    <div className="h-2 bg-gray-800 rounded-sm" />
                    <div className="h-1 bg-gray-300 rounded-sm" />
                    <div className="h-1 bg-gray-300 rounded-sm w-3/4" />
                    <div className="mt-1 h-1 bg-gray-400 rounded-sm" />
                    <div className="h-1 bg-gray-200 rounded-sm" />
                    <div className="h-1 bg-gray-200 rounded-sm" />
                    <div className="h-1 bg-gray-200 rounded-sm w-2/3" />
                  </div>
                  <span className={`text-sm font-semibold ${quoteStyle === 'classic' ? 'text-[#1e3a5f]' : 'text-gray-600'}`}>Classic PDF</span>
                  <span className="text-xs text-gray-400 text-center">Traditional format, downloads as PDF</span>
                </button>
                <button
                  onClick={() => setQuoteStyle('professional')}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${quoteStyle === 'professional' ? 'border-[#ff6b35] bg-orange-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                >
                  {quoteStyle === 'professional' && (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-[#ff6b35] rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                  <div className="w-14 h-16 bg-white border border-gray-300 rounded shadow-sm flex flex-col overflow-hidden">
                    <div className="h-5 bg-[#1e3a5f] flex items-center px-1 gap-0.5">
                      <div className="w-1.5 h-1.5 bg-white rounded-full opacity-80" />
                      <div className="h-1 bg-white/60 rounded-sm flex-1" />
                    </div>
                    <div className="p-1 flex flex-col gap-0.5">
                      <div className="h-1 bg-emerald-400 rounded-sm w-full" />
                      <div className="h-1 bg-blue-400 rounded-sm w-full" />
                      <div className="h-1 bg-amber-400 rounded-sm w-full" />
                      <div className="mt-0.5 h-1 bg-gray-200 rounded-sm" />
                      <div className="h-1 bg-gray-200 rounded-sm w-2/3" />
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${quoteStyle === 'professional' ? 'text-[#ff6b35]' : 'text-gray-600'}`}>Professional</span>
                  <span className="text-xs text-gray-400 text-center">Modern branded layout, opens in browser</span>
                </button>
              </div>
            </div>

            {/* Customer Summary */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Customer</h3>
              <p className="text-sm text-gray-900">{customer.first_name} {customer.last_name}</p>
              <p className="text-sm text-gray-500">{customer.address}, {customer.city}, {customer.state} {customer.zip}</p>
              {customer.email && <p className="text-sm text-gray-500">{customer.email}</p>}
            </div>

            {/* Document Options Summary */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Document Includes</h3>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border">Cover Page</span>
                {includeAbout && <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border">About Company</span>}
                <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border">3-Tier Pricing</span>
                {photos.length > 0 && <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border">{photos.length} Photos</span>}
                {includeWarranty && <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border">Warranty</span>}
                <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border">3-Day Cancel Notice</span>
              </div>
            </div>

            {/* Financing Options */}
            {availableFinancing.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Financing Options</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-gray-500">Show on quote</span>
                    <div
                      className={`w-10 h-6 rounded-full transition-colors relative ${showFinancing ? 'bg-[#1e3a5f]' : 'bg-gray-300'}`}
                      onClick={() => setShowFinancing(!showFinancing)}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${showFinancing ? 'left-5' : 'left-1'}`} />
                    </div>
                  </label>
                </div>
                {showFinancing && (
                  <div className="space-y-2">
                    <p className="text-xs text-blue-600 mb-2">Customers will see an Apply Now button linking to each lender's application.</p>
                    <p className="text-xs text-gray-500 mb-2">Select which programs to show to this customer:</p>
                    {availableFinancing.map(opt => (
                      <label key={opt.id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-[#1e3a5f]/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedFinancingIds.includes(opt.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedFinancingIds(prev => [...prev, opt.id]);
                            } else {
                              setSelectedFinancingIds(prev => prev.filter(id => id !== opt.id));
                            }
                          }}
                          className="w-4 h-4 accent-[#1e3a5f]"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900">{opt.lender_name}</span>
                          {opt.program_name && <span className="text-xs text-gray-500 ml-2">{opt.program_name}</span>}
                          {opt.apr_low !== null && (
                            <span className="text-xs text-gray-400 ml-2">
                              {opt.apr_low === opt.apr_high ? `${opt.apr_low}%` : `${opt.apr_low}–${opt.apr_high}%`} APR
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => handleSave(false)} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors disabled:opacity-50">
                <Save className="w-5 h-5" />
                Save as Draft
              </button>
              <button onClick={handleOpenSendModal} disabled={saving || !customer.email}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#ff6b35] hover:bg-[#e55a2b] text-white rounded-xl font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-orange-200">
                <Send className="w-5 h-5" />
                Save & Send to Customer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Photo Analysis Modal */}
      {aiPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#1e3a5f]" />
                <h2 className="text-lg font-semibold text-gray-900">AI Photo Analysis</h2>
              </div>
              <button onClick={() => setAiPhotoModal(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Summary */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-1.5">
                <p className="text-sm font-semibold text-[#1e3a5f]">{aiPhotoModal.analysis.damage_type}</p>
                <p className="text-sm text-gray-700">{aiPhotoModal.analysis.caption}</p>
                {aiPhotoModal.analysis.notes && (
                  <p className="text-xs text-gray-500 mt-1">{aiPhotoModal.analysis.notes}</p>
                )}
              </div>

              {/* Suggested line items */}
              {aiPhotoModal.analysis.suggested_line_items.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Suggested Line Items — select which to add:
                  </p>
                  <div className="space-y-2">
                    {aiPhotoModal.analysis.suggested_line_items.map((item, i) => (
                      <label
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          aiPhotoModal.selectedItems[i]
                            ? 'border-[#1e3a5f] bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={aiPhotoModal.selectedItems[i]}
                          onChange={() => {
                            const updated = [...aiPhotoModal.selectedItems];
                            updated[i] = !updated[i];
                            setAiPhotoModal({ ...aiPhotoModal, selectedItems: updated });
                          }}
                          className="mt-0.5 accent-[#1e3a5f]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
                          <p className="text-xs text-gray-500">{item.category} · {item.quantity} {item.unit}</p>
                          {item.description && (
                            <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setAiPhotoModal(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAiLineItems}
                disabled={!aiPhotoModal.selectedItems.some(Boolean)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#2d5a8e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add {aiPhotoModal.selectedItems.filter(Boolean).length} Item{aiPhotoModal.selectedItems.filter(Boolean).length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </button>
        {currentStep < activeSteps.length - 1 && (
          <button
            onClick={() => setCurrentStep(currentStep + 1)}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#1e3a5f] text-white rounded-xl font-medium hover:bg-[#2d5a8e] transition-colors"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Send Email Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Send Quote to Customer</h3>
                <button onClick={() => setShowSendModal(false)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">✕</button>
              </div>
              <p className="text-sm text-gray-500 mb-3">Sending to: <span className="font-medium text-gray-700">{customer.email}</span></p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Also send to (CC)
                  <span className="ml-1.5 text-xs font-normal text-gray-400">separate multiple with commas</span>
                </label>
                <input
                  type="text"
                  value={additionalEmails}
                  onChange={(e) => setAdditionalEmails(e.target.value)}
                  placeholder="e.g. spouse@email.com, manager@company.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">View &amp; signature notifications go to the primary email only</p>
              </div>
              {generatingEmailDraft ? (
                <div className="flex items-center gap-3 py-8 justify-center text-gray-500">
                  <div className="w-5 h-5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Generating AI email draft...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                    <input
                      type="text"
                      value={emailDraftSubject}
                      onChange={(e) => setEmailDraftSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                    <textarea
                      value={emailDraftBody}
                      onChange={(e) => setEmailDraftBody(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none resize-none"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowSendModal(false)} className="py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button
                  onClick={() => {
                    setShowSendModal(false);
                    const draft = {
                      last_sent_subject: emailDraftSubject || null,
                      last_sent_message: emailDraftBody || null,
                      last_sent_cc_emails: additionalEmails || null,
                    };
                    // Update local state immediately too — reopening the send
                    // modal later in this same session must see the saved
                    // draft without waiting on a fresh fetch from the server.
                    setSavedDraftEmail({ subject: draft.last_sent_subject, message: draft.last_sent_message, ccEmails: draft.last_sent_cc_emails });
                    supabase.from('quotes').update(draft).eq('id', quoteId).then(() => toast.success('Email draft saved!'));
                  }}
                  disabled={saving || generatingEmailDraft}
                  className="py-2.5 px-4 border border-[#1e3a5f] text-[#1e3a5f] rounded-xl text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => { setShowSendModal(false); handleSave(true); }}
                  disabled={saving || generatingEmailDraft || !customer.email}
                  className="flex-1 py-2.5 bg-[#1e3a5f] text-white rounded-xl text-sm font-semibold hover:bg-[#2d5a8e] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  Send Quote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuoteBuilder;
