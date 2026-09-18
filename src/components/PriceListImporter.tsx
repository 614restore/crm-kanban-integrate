import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Download, FileText, Check, X, AlertCircle, Table, Trash2, Tag, Search, Filter, AlertTriangle, History, ChevronDown, ChevronRight, DollarSign, Plus, Pencil, Star, RefreshCw, Bell, Send, Copy, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import readXlsxFile from 'read-excel-file/browser';
import type { Company } from '@/data/quoteData';
import { defaultLineItems } from '@/data/quoteData';
import { isNativePlatform } from '@/lib/platform';
import { MATERIAL_LIST_MAINTENANCE_PROMPT, MATERIAL_LIST_RULES } from '@/data/materialListPrompt';

const downloadCSV = async (csvContent: string, filename: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  if (isNativePlatform() && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: 'text/csv' });
      await navigator.share({ files: [file], title: filename });
      return;
    } catch {
      // fall through to anchor method
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const CATEGORIES = [
  'All',
  'Roofing',
  'Gutters',
  'Siding',
  'Windows',
  'Doors',
  'Paint - Exterior',
  'Paint - Interior',
  'Drywall',
  'Flooring',
  'Insulation',
  'Fencing',
  'Decking',
  'General Labor',
  'Permits & Fees',
  'Other',
] as const;

interface PricingItem {
  id: string;
  item_name: string;
  category: string;
  description: string;
  unit: string;
  good_price: number;
  better_price: number;
  best_price: number;
  price_list_name: string;
  list_enabled: boolean;
}

interface ImportHistoryEntry {
  id: string;
  price_list_name: string;
  original_filename: string | null;
  item_count: number | null;
  imported_at: string;
}

interface Props {
  company: Company;
  onCompanyUpdate?: (company: Company) => void;
  userRole?: 'owner' | 'admin' | 'member';
  userId?: string;
}

interface ParsedRow {
  item_name: string;
  category: string;
  description: string;
  unit: string;
  good_price: number;
  better_price: number;
  best_price: number;
  valid: boolean;
  error?: string;
  isDuplicate?: boolean;
}

const REQUIRED_COLS = ['item_name'];
const PRICE_COLS = ['good_price', 'better_price', 'best_price'];
const DIRECT_SCHEMA_COLS = ['item_name', 'category', 'description', 'unit', 'good_price', 'better_price', 'best_price'];

// Try to map common supplier CSV column names to our schema
const COL_ALIASES: Record<string, string> = {
  'name': 'item_name',
  'item': 'item_name',
  'product': 'item_name',
  'product name': 'item_name',
  'description': 'description',
  'desc': 'description',
  'notes': 'description',
  'category': 'category',
  'cat': 'category',
  'type': 'category',
  'unit': 'unit',
  'uom': 'unit',
  'price': 'good_price',
  'cost': 'good_price',
  'good': 'good_price',
  'good price': 'good_price',
  'better': 'better_price',
  'better price': 'better_price',
  'best': 'best_price',
  'best price': 'best_price',
  'unit price': 'good_price',
  'list price': 'good_price',
  'retail': 'best_price',
  'wholesale': 'good_price',
};

// Default supplement rates (mirrors QuoteBuilder SUPPLEMENT_DEFAULTS)
// Labor modifiers are flat across tiers — a steep roof costs the same to walk
// whether the customer bought Good or Best. Rates were previously tiered
// (e.g. steep 40/50/65); each now carries its base rate in all three columns.
const SUPPLEMENT_DEFAULTS = {
  mod_steep:        { good: 15, better: 15, best: 15 },
  steep:            { good: 40, better: 40, best: 40 },
  very_steep:       { good: 75, better: 75, best: 75 },
  two_story:        { good: 15, better: 15, best: 15 },
  three_plus_story: { good: 30, better: 30, best: 30 },
};

type SupplementKey = keyof typeof SUPPLEMENT_DEFAULTS;

export interface CustomSupplement {
  id: string;
  label: string;
  description: string;
  good: number;
  better: number;
  best: number;
}

const SUPPLEMENT_TIERS: Array<{ key: SupplementKey; label: string; description: string }> = [
  { key: 'mod_steep',        label: 'Moderate Steep (7–9/12)',   description: '$/sq adder for 7–9/12 pitch' },
  { key: 'steep',            label: 'Steep (10–12/12)',          description: '$/sq adder for 10–12/12 pitch' },
  { key: 'very_steep',       label: 'Very Steep (13+/12)',       description: '$/sq adder for 13+/12 pitch' },
  { key: 'two_story',        label: '2-Story Height',            description: '$/sq adder for 2-story jobs' },
  { key: 'three_plus_story', label: '3+ Story Height',           description: '$/sq adder for 3+ story jobs' },
];

// Default custom supplements — commonly missed insurance line items with
// Xactimate codes and Midwest/Ohio reference rates (good=low, better=mid, best=high).
// Users can download these as CSV and feed to an AI (e.g. Perplexity) to
// reprice for their specific region.
const DEFAULT_CUSTOM_SUPPLEMENTS: CustomSupplement[] = [
  // O&P and Code Upgrades are job-specific — leave at $0 for user to set
  { id: 'default-op',      label: 'Overhead & Profit (O&P)',            description: 'General contractor overhead and profit — enter as a dollar amount, typically 20% (10% OH + 10% profit) of replacement cost. Adjust to match carrier allowance.', good: 0, better: 0, best: 0 },
  { id: 'default-code',    label: 'Code Upgrades',                      description: 'Required code compliance upgrades (permits, ice & water barrier, drip edge, ventilation, etc.). Adjust to match carrier schedule.',        good: 0,    better: 0,    best: 0    },
  // Flat-rate insurance supplement items — consistent price across all tiers (Midwest/Ohio Xactimate ref)
  { id: 'default-drip',    label: 'Drip Edge (RFG DRPE)',               description: 'Xactimate: RFG DRPE — drip edge metal at eaves & rakes. Flat rate per lf.',                                                               good: 1.50, better: 1.50, best: 1.50 },
  { id: 'default-starter', label: 'Starter Strip (RFG STRT)',           description: 'Xactimate: RFG STRT — starter strip at eaves and rakes. Flat rate per bundle.',                                                           good: 52,   better: 52,   best: 52   },
  { id: 'default-iws',     label: 'Ice & Water Shield (RFG IWS)',       description: 'Xactimate: RFG IWS — self-adhering underlayment in valleys and eaves. Flat rate per sq.',                                                 good: 98,   better: 98,   best: 98   },
  { id: 'default-ridge',   label: 'Enhanced Hip & Ridge Cap (RFG RGCP)',description: 'Xactimate: RFG RGCP — dimensional hip & ridge cap upgrade over cut 3-tab. Flat rate per lf.',                                            good: 5.25, better: 5.25, best: 5.25 },
  { id: 'default-boots',   label: 'Pipe Boots (RFG BOOT)',              description: 'Xactimate: RFG BOOT — rubber pipe boot / pipe flashing per penetration. Flat rate each.',                                                 good: 30,   better: 30,   best: 30   },
  { id: 'default-stepfl',  label: 'Step Flashing (RFG STPF)',           description: 'Xactimate: RFG STPF — step flashing along walls and dormers. Flat rate per bundle.',                                                      good: 30,   better: 30,   best: 30   },
  { id: 'default-chimfl',  label: 'Chimney Flashing Kit (RFG CHMF)',    description: 'Xactimate: RFG CHMF — full chimney flashing kit (counter, step, cap flashing). Flat rate each.',                                         good: 155,  better: 155,  best: 155  },
  { id: 'default-valley',  label: 'Valley Metal (RFG VMET)',            description: 'Xactimate: RFG VMET — open valley metal / W-valley lining. Flat rate per lf.',                                                           good: 4.25, better: 4.25, best: 4.25 },
  { id: 'default-decking', label: 'Deteriorated Decking (RFG DCK)',     description: 'Xactimate: RFG DCK — rotted or damaged OSB/plywood decking replacement. Flat rate per sheet.',                                            good: 42,   better: 42,   best: 42   },
  { id: 'default-gutter',  label: 'Gutter Detach & Reset (GTR DTR)',    description: 'Xactimate: GTR DTR — 5" K-style gutter detach and reset. Flat rate per lf.',                                                             good: 2.10, better: 2.10, best: 2.10 },
  { id: 'default-sat',     label: 'Satellite Dish D&R (RFG SATR)',      description: 'Xactimate: RFG SATR — satellite dish detach and reset. Flat rate each.',                                                                  good: 68,   better: 68,   best: 68   },
  { id: 'default-solar',   label: 'Solar Panel D&R (RFG SOLAR)',        description: 'Xactimate: RFG SOLAR — solar panel detach and reset per square. Flat rate per sq.',                                                       good: 400,  better: 400,  best: 400  },
];

const PriceListImporter: React.FC<Props> = ({ company, onCompanyUpdate, userRole = 'member', userId }) => {
  const companyId = company.id;
  const canManageStandard = userRole === 'owner' || userRole === 'admin';
  const isMember = userRole === 'member';
  const canOverride = isMember && company.sales_can_edit_pricing;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [filename, setFilename] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [priceListName, setPriceListName] = useState('My Prices');
  const [existingLists, setExistingLists] = useState<{ name: string; count: number; enabled: boolean }[]>([]);
  const [deletingList, setDeletingList] = useState<string | null>(null);
  const [togglingList, setTogglingList] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [settingStandard, setSettingStandard] = useState(false);
  const [restoreExpanded, setRestoreExpanded] = useState(false);
  const [resetConfirm, setResetConfirm] = useState<{ type: 'company-standard' | 'app-defaults' } | null>(null);
  const [resetting, setResetting] = useState(false);

  // Price update notices
  const [latestPriceUpdate, setLatestPriceUpdate] = useState<{
    id: string;
    sender_name: string;
    message: string | null;
    price_list_name: string | null;
    created_at: string;
  } | null>(null);
  const [noticeUnread, setNoticeUnread] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [sendingNotice, setSendingNotice] = useState(false);

  // Browse library state
  const [browseItems, setBrowseItems] = useState<PricingItem[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseSearch, setBrowseSearch] = useState('');
  const [browseCategory, setBrowseCategory] = useState<string>('All');

  // Inline edit state for Browse Library
  const [editingBrowseItem, setEditingBrowseItem] = useState<PricingItem | null>(null);
  const [editUnit, setEditUnit] = useState('');
  const [editGood, setEditGood] = useState('');
  const [editBetter, setEditBetter] = useState('');
  const [editBest, setEditBest] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Cost vs Sell Price display toggle (view-only — does not change stored values)
  const [showSellPrices, setShowSellPrices] = useState(false);
  const marginPct = typeof company.default_margin_percent === 'number' ? company.default_margin_percent : 50;
  // sell = cost / (1 − margin%)  e.g. cost $50, margin 50% → sell $100
  const toSell = (cost: number) =>
    marginPct >= 100 ? cost : Math.round((cost / (1 - marginPct / 100)) * 100) / 100;
  const displayPrice = (cost: number) =>
    showSellPrices ? toSell(cost) : cost;

  const toggleSellPrices = (next: boolean) => setShowSellPrices(next);

  // Personal price overrides for Browse Library (members only when feature is enabled)
  const [userOverrides, setUserOverrides] = useState<Map<string, { good_price: number; better_price: number; best_price: number }>>(new Map());
  const [clearingOverride, setClearingOverride] = useState(false);

  // Import history
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);
  const [showHistoryFor, setShowHistoryFor] = useState<string | null>(null);

  // Bulk-update prompt (rules an AI must follow when repricing the list)
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  // Supplement rates editor
  const [suppRates, setSuppRates] = useState<typeof SUPPLEMENT_DEFAULTS>(() => {
    const saved = company.supplement_rates as Partial<typeof SUPPLEMENT_DEFAULTS> | null | undefined;
    return {
      mod_steep:        { ...SUPPLEMENT_DEFAULTS.mod_steep,        ...(saved?.mod_steep        ?? {}) },
      steep:            { ...SUPPLEMENT_DEFAULTS.steep,            ...(saved?.steep            ?? {}) },
      very_steep:       { ...SUPPLEMENT_DEFAULTS.very_steep,       ...(saved?.very_steep       ?? {}) },
      two_story:        { ...SUPPLEMENT_DEFAULTS.two_story,        ...(saved?.two_story        ?? {}) },
      three_plus_story: { ...SUPPLEMENT_DEFAULTS.three_plus_story, ...(saved?.three_plus_story ?? {}) },
    };
  });
  const [savingSupp, setSavingSupp] = useState(false);
  const [suppExpanded, setSuppExpanded] = useState(false);
  const [customSupplements, setCustomSupplements] = useState<CustomSupplement[]>(() => {
    const saved = company.supplement_rates as any;
    const existing = saved?.custom as CustomSupplement[] | undefined;
    // If no custom supplements have been saved yet, pre-populate with commonly
    // missed insurance supplement line items including Xactimate reference rates
    // (Midwest/Ohio pricing — users can download and adjust for their region)
    if (!existing || existing.length === 0) {
      return DEFAULT_CUSTOM_SUPPLEMENTS;
    }
    return existing;
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(false);

  // Auto-save supplement rates 1.5s after the last change
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setAutoSaveStatus('idle');
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        const ratesPayload = { ...suppRates, custom: customSupplements };
        const { error } = await supabase
          .from('companies')
          .update({ supplement_rates: ratesPayload })
          .eq('id', companyId);
        if (error) throw error;
        onCompanyUpdate?.({ ...company, supplement_rates: ratesPayload });
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2500);
      } catch {
        setAutoSaveStatus('idle');
      }
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [suppRates, customSupplements]);

  useEffect(() => {
    fetchExistingLists();
    fetchBrowseItems();
    fetchImportHistory();
    void fetchLatestPriceUpdate();
    if (canOverride && userId) void fetchUserOverrides();
  }, [companyId]);

  const fetchExistingLists = async () => {
    const { data } = await supabase
      .from('company_pricing')
      .select('price_list_name, list_enabled')
      .eq('company_id', companyId);
    if (!data) return;
    const counts: Record<string, number> = {};
    const enabled: Record<string, boolean> = {};
    for (const row of data) {
      const name = (row as any).price_list_name || 'My Prices';
      counts[name] = (counts[name] || 0) + 1;
      if (!(name in enabled)) enabled[name] = (row as any).list_enabled !== false;
    }
    setExistingLists(Object.entries(counts).map(([name, count]) => ({ name, count, enabled: enabled[name] ?? true })));
  };

  const fetchBrowseItems = async () => {
    setBrowseLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_pricing')
        .select('id, item_name, category, description, unit, good_price, better_price, best_price, price_list_name, list_enabled')
        .eq('company_id', companyId)
        .order('category')
        .order('item_name');
      if (error) throw error;
      setBrowseItems((data ?? []) as PricingItem[]);
    } catch {
      // silent
    } finally {
      setBrowseLoading(false);
    }
  };

  const fetchImportHistory = async () => {
    const { data } = await supabase
      .from('price_list_imports')
      .select('id, price_list_name, original_filename, item_count, imported_at')
      .eq('company_id', companyId)
      .order('imported_at', { ascending: false })
      .limit(50);
    setImportHistory((data ?? []) as ImportHistoryEntry[]);
  };

  const handleToggleList = async (listName: string, currentEnabled: boolean) => {
    setTogglingList(listName);
    try {
      const { error } = await supabase
        .from('company_pricing')
        .update({ list_enabled: !currentEnabled })
        .eq('company_id', companyId)
        .eq('price_list_name', listName);
      if (error) throw error;
      await fetchExistingLists();
    } catch (err: any) {
      toast.error('Toggle failed: ' + err.message);
    } finally {
      setTogglingList(null);
    }
  };

  const handleDownloadList = async (listName: string) => {
    const { data, error } = await supabase
      .from('company_pricing')
      .select('item_name,category,description,unit,good_price,better_price,best_price')
      .eq('company_id', companyId)
      .eq('price_list_name', listName)
      .order('category').order('item_name');
    if (error || !data) { toast.error('Download failed'); return; }
    const header = 'item_name,category,description,unit,good_price,better_price,best_price';
    const csvRows = data.map((r: any) =>
      [r.item_name, r.category, r.description, r.unit, r.good_price, r.better_price, r.best_price]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header, ...csvRows].join('\n');
    await downloadCSV(csv, `${listName.replace(/\s+/g, '_')}.csv`);
  };

  const handleDeleteList = async (listName: string) => {
    if (!confirm(`Delete all items in "${listName}"? This cannot be undone.`)) return;
    setDeletingList(listName);
    try {
      const { error } = await supabase
        .from('company_pricing')
        .delete()
        .eq('company_id', companyId)
        .eq('price_list_name', listName);
      if (error) throw error;
      toast.success(`"${listName}" deleted.`);
      await fetchExistingLists();
      await fetchBrowseItems();
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message);
    } finally {
      setDeletingList(null);
    }
  };

  const copyMaintenancePrompt = async () => {
    try {
      await navigator.clipboard.writeText(MATERIAL_LIST_MAINTENANCE_PROMPT);
      setPromptCopied(true);
      toast.success('Prompt copied — paste it into your AI along with your CSV.');
      setTimeout(() => setPromptCopied(false), 2500);
    } catch {
      setPromptExpanded(true);
      toast.error('Copy not supported here — select the prompt text below instead.');
    }
  };

  const downloadPromptFile = async () => {
    const blob = new Blob([MATERIAL_LIST_MAINTENANCE_PROMPT], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'material_list_maintenance_prompt.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = async () => {
    const csv = [
      'item_name,category,description,unit,good_price,better_price,best_price',
      'Architectural Shingles,Roofing,30yr dimensional shingle,sq,280,320,380',
      'Ridge Cap,Roofing,Hip and ridge cap,bundle,45,55,65',
      'Ice & Water Shield,Roofing,Self-adhering underlayment,roll,85,95,110',
      'Synthetic Underlayment,Roofing,Synthetic underlayment (1 roll = 10 sq / 1000 sqft),roll,125,175,240',
      'Drip Edge,Roofing,Galv steel drip edge (10-ft stick),pc,18,18,18',
      'Ridge Vent & Attic Ventilation Balance,Roofing,Continuous ridge vent (1 box = 16 lf),box,65,80,95',
      'Hip & Ridge Cap Shingles,Roofing,Hip/ridge cap shingles (1 bundle = 25 lf),bdl,50,65,85',
      'Starter Strip,Roofing,Starter strip shingles at eaves and rakes (1 bundle = 105 lf),bdl,50,52,55',
    ].join('\n');
    await downloadCSV(csv, 'quotemgr_price_list_template.csv');
  };

  const parseCSV = (text: string): { headers: string[]; data: string[][] } => {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const data = lines.slice(1).map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += char; }
      }
      result.push(current.trim());
      return result;
    });
    return { headers, data };
  };

  const normalizeHeaders = (rawHeaders: unknown[]) =>
    rawHeaders.map(header => String(header ?? '').trim().replace(/^"|"$/g, '').toLowerCase());

  // Build a set of existing item keys for the target list for duplicate detection
  const existingItemKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of browseItems) {
      if (item.price_list_name === priceListName) {
        keys.add(`${(item.category || 'general').toLowerCase()}:::${item.item_name.toLowerCase()}`);
      }
    }
    return keys;
  }, [browseItems, priceListName]);

  const buildRowsFromMatrix = (matrixHeaders: string[], matrixData: string[][]) => {
    const colMap: Record<string, number> = {};

    matrixHeaders.forEach((h, i) => {
      const mapped = COL_ALIASES[h] || (Object.values(COL_ALIASES).includes(h) ? h : null);
      if (mapped) colMap[mapped] = i;
      if (DIRECT_SCHEMA_COLS.includes(h)) {
        colMap[h] = i;
      }
    });

    const parsed: ParsedRow[] = matrixData
      .filter(row => row.some(cell => cell.trim()))
      .map(row => {
        const get = (field: string) => row[colMap[field] ?? -1]?.trim() || '';
        const itemName = get('item_name');
        if (!itemName) {
          return {
            item_name: '',
            category: '',
            description: '',
            unit: '',
            good_price: 0,
            better_price: 0,
            best_price: 0,
            valid: false,
            error: 'Missing item name',
          };
        }

        const goodPrice = parseFloat(get('good_price')) || 0;
        const betterPrice = parseFloat(get('better_price')) || goodPrice;
        const bestPrice = parseFloat(get('best_price')) || betterPrice;
        const category = get('category') || 'General';
        const key = `${category.toLowerCase()}:::${itemName.toLowerCase()}`;

        return {
          item_name: itemName,
          category,
          description: get('description'),
          unit: get('unit'),
          good_price: goodPrice,
          better_price: betterPrice,
          best_price: bestPrice,
          valid: true,
          isDuplicate: existingItemKeys.has(key),
        };
      });

    setHeaders(matrixHeaders);
    setRows(parsed);
  };

  const parseSpreadsheet = async (file: File) => {
    // read-excel-file only supports .xlsx (Office Open XML), not legacy .xls.
    // Give a clear message instead of a confusing binary parse error.
    if (file.name.toLowerCase().endsWith('.xls')) {
      toast.error('Legacy .xls format is not supported. Please open the file in Excel or Google Sheets and save as .xlsx, then re-upload.');
      return;
    }

    let sheetRows: (string | number | boolean | Date | null)[][] = [];
    try {
      sheetRows = (await readXlsxFile(file)) as unknown as (string | number | boolean | Date | null)[][];
    } catch (e: any) {
      toast.error(`Could not read the file — it may be corrupted or password-protected. (${e?.message || 'parse error'})`);
      return;
    }

    if (!sheetRows || sheetRows.length < 2) {
      toast.error('Spreadsheet appears empty or has no data rows. Make sure the first sheet has a header row followed by data.');
      return;
    }

    const [headerRow, ...dataRows] = sheetRows;
    const normalizedHeaders = normalizeHeaders(headerRow.map(cell => String(cell ?? '')));

    // Check that at least one recognisable column is present
    const hasItemCol = normalizedHeaders.some(h => COL_ALIASES[h] === 'item_name' || h === 'item_name');
    if (!hasItemCol) {
      toast.error('No item name column found. Make sure the first row has a header like "Item Name", "Name", or "Product".');
      return;
    }

    const normalizedData = dataRows.map(row =>
      normalizedHeaders.map((_, index) => String(row[index] ?? '').trim())
    );

    buildRowsFromMatrix(normalizedHeaders, normalizedData);
  };

  const handleFile = (file: File) => {
    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith('.csv');
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');

    if (!isCsv && !isExcel) {
      toast.error('Please upload a .csv, .xlsx, or .xls file');
      return;
    }
    setFilename(file.name);
    setImported(false);
    setRows([]);
    setHeaders([]);

    if (isExcel) {
      void parseSpreadsheet(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const { headers: csvHeaders, data } = parseCSV(text);
        buildRowsFromMatrix(csvHeaders, data);
      } catch {
        toast.error('Failed to parse CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setShowBackupModal(false);
    const allValidRows = rows.filter(r => r.valid);
    const parsedCats = new Set(allValidRows.map(r => r.category || 'General'));
    const validRows = parsedCats.size <= 1
      ? allValidRows
      : selectedCategories.size > 0
        ? allValidRows.filter(r => selectedCategories.has(r.category || 'General'))
        : [];
    if (validRows.length === 0) { toast.error('No valid rows to import'); return; }
    setImporting(true);
    try {
      const listName = priceListName.trim() || 'My Prices';
      const deduped = new Map<string, typeof validRows[0] & { sortOrder: number }>();
      validRows.forEach((row, i) => {
        const key = `${(row.category || 'General').toLowerCase()}:::${row.item_name.toLowerCase()}`;
        deduped.set(key, { ...row, sortOrder: i });
      });
      const payload = Array.from(deduped.values()).map((row) => ({
        company_id: companyId,
        item_name: row.item_name,
        category: row.category || 'General',
        description: row.description,
        unit: row.unit,
        good_price: row.good_price,
        better_price: row.better_price,
        best_price: row.best_price,
        price_list_name: listName,
        sort_order: row.sortOrder,
      }));

      if (importMode === 'replace') {
        if (parsedCats.size <= 1 || selectedCategories.size >= parsedCats.size) {
          // Replace the entire list
          const { error: delError } = await supabase
            .from('company_pricing')
            .delete()
            .eq('company_id', companyId)
            .eq('price_list_name', listName);
          if (delError) throw delError;
        } else {
          // Delete only the selected categories, leaving others untouched
          for (const cat of selectedCategories) {
            const { error: delError } = await supabase
              .from('company_pricing')
              .delete()
              .eq('company_id', companyId)
              .eq('price_list_name', listName)
              .eq('category', cat);
            if (delError) throw delError;
          }
        }
        const { error } = await supabase.from('company_pricing').insert(payload);
        if (error) throw error;
      } else {
        // Merge mode: fetch existing rows by (category, item_name) so we can
        // update them by primary key — avoids needing a unique constraint.
        const { data: existingItems } = await supabase
          .from('company_pricing')
          .select('id, category, item_name')
          .eq('company_id', companyId)
          .eq('price_list_name', listName);

        const existingMap = new Map(
          (existingItems ?? []).map((item: any) => [
            `${(item.category || '').toLowerCase()}:::${item.item_name.toLowerCase()}`,
            item.id as string,
          ])
        );

        const toUpdate = payload
          .filter(row => existingMap.has(`${(row.category || '').toLowerCase()}:::${row.item_name.toLowerCase()}`))
          .map(row => ({ ...row, id: existingMap.get(`${(row.category || '').toLowerCase()}:::${row.item_name.toLowerCase()}`) }));
        const toInsert = payload
          .filter(row => !existingMap.has(`${(row.category || '').toLowerCase()}:::${row.item_name.toLowerCase()}`));

        if (toUpdate.length > 0) {
          const { error } = await supabase.from('company_pricing').upsert(toUpdate);
          if (error) throw error;
        }
        if (toInsert.length > 0) {
          const { error } = await supabase.from('company_pricing').insert(toInsert);
          if (error) throw error;
        }
      }

      // Record import history
      await supabase.from('price_list_imports').insert({
        company_id: companyId,
        price_list_name: listName,
        original_filename: filename || null,
        item_count: validRows.length,
      });

      setImportedCount(validRows.length);
      toast.success(`${validRows.length} items saved to "${listName}"!`);
      setImported(true);
      setRows([]);
      await Promise.all([fetchExistingLists(), fetchBrowseItems(), fetchImportHistory()]);
    } catch (err: any) {
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const fetchUserOverrides = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('user_pricing_overrides')
      .select('item_name, category, good_price, better_price, best_price')
      .eq('user_id', userId)
      .eq('company_id', companyId);
    if (!data) return;
    const map = new Map<string, { good_price: number; better_price: number; best_price: number }>();
    data.forEach(row => map.set(`${row.category}::${row.item_name}`, row as any));
    setUserOverrides(map);
  };

  const fetchLatestPriceUpdate = async () => {
    const { data } = await supabase
      .from('company_price_updates')
      .select('id, sender_name, message, price_list_name, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return;
    setLatestPriceUpdate(data as typeof latestPriceUpdate);
    const lastSeen = localStorage.getItem(`lastSeenPriceUpdate_${companyId}`);
    setNoticeUnread(!lastSeen || new Date(lastSeen) < new Date(data.created_at));
  };

  const handleDismissNotice = () => {
    localStorage.setItem(`lastSeenPriceUpdate_${companyId}`, new Date().toISOString());
    setNoticeUnread(false);
  };

  const handleSendNotice = async () => {
    setSendingNotice(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      const { data: member } = await supabase
        .from('team_members')
        .select('full_name')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .maybeSingle();
      const senderName = (member as any)?.full_name || authData.user?.email || 'Admin';

      const { error } = await supabase.from('company_price_updates').insert({
        company_id: companyId,
        updated_by: userId,
        sender_name: senderName,
        message: notifyMessage.trim() || null,
        price_list_name: priceListName.trim() || null,
      });
      if (error) throw error;

      toast.success('Price update notice sent to your team!');
      setShowNotifyModal(false);
      setNotifyMessage('');
      localStorage.setItem(`lastSeenPriceUpdate_${companyId}`, new Date().toISOString());
      setNoticeUnread(false);
      await fetchLatestPriceUpdate();
    } catch (err: any) {
      toast.error('Failed to send notice: ' + err.message);
    } finally {
      setSendingNotice(false);
    }
  };

  const handleSetStandard = async (listName: string) => {
    if (!canManageStandard) return;
    setSettingStandard(true);
    try {
      const current = company.standard_price_list_name ?? null;
      const next = current === listName ? null : listName;
      const { error } = await supabase
        .from('companies')
        .update({ standard_price_list_name: next })
        .eq('id', companyId);
      if (error) throw error;
      onCompanyUpdate?.({ ...company, standard_price_list_name: next });
      toast.success(next ? `"${listName}" is now the company standard.` : 'Company standard cleared.');
    } catch (err: any) {
      toast.error('Update failed: ' + err.message);
    } finally {
      setSettingStandard(false);
    }
  };

  const handleResetToCompanyStandard = async () => {
    const standardName = company.standard_price_list_name;
    if (!standardName) return;
    setResetting(true);
    try {
      const { data, error } = await supabase
        .from('company_pricing')
        .select('item_name, category, description, unit, good_price, better_price, best_price')
        .eq('company_id', companyId)
        .eq('price_list_name', standardName);
      if (error) throw error;
      if (!data?.length) { toast.error('The company standard list is empty.'); return; }

      const listName = priceListName.trim() || 'My Prices';
      const { error: delError } = await supabase
        .from('company_pricing')
        .delete()
        .eq('company_id', companyId)
        .eq('price_list_name', listName);
      if (delError) throw delError;

      const payload = data.map((item, i) => ({
        company_id: companyId,
        price_list_name: listName,
        sort_order: i,
        ...item,
      }));
      const { error: insError } = await supabase.from('company_pricing').insert(payload);
      if (insError) throw insError;

      toast.success(`"${listName}" restored to company standard — ${data.length} items.`);
      setResetConfirm(null);
      await Promise.all([fetchExistingLists(), fetchBrowseItems()]);
    } catch (err: any) {
      toast.error('Restore failed: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const handleResetToAppDefaults = async () => {
    setResetting(true);
    try {
      const listName = priceListName.trim() || 'My Prices';
      const payload = Object.entries(defaultLineItems).flatMap(([category, items], catIdx) =>
        items.map((item, itemIdx) => ({
          company_id: companyId,
          price_list_name: listName,
          item_name: item.item_name,
          category,
          description: item.description,
          unit: item.unit,
          good_price: item.good_price,
          better_price: item.better_price,
          best_price: item.best_price,
          sort_order: catIdx * 1000 + itemIdx,
        }))
      );

      const { error: delError } = await supabase
        .from('company_pricing')
        .delete()
        .eq('company_id', companyId)
        .eq('price_list_name', listName);
      if (delError) throw delError;

      const { error: insError } = await supabase.from('company_pricing').insert(payload);
      if (insError) throw insError;

      toast.success(`"${listName}" restored to app defaults — ${payload.length} items.`);
      setResetConfirm(null);
      await Promise.all([fetchExistingLists(), fetchBrowseItems()]);
    } catch (err: any) {
      toast.error('Restore failed: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const handleSaveSupplementRates = async () => {
    setSavingSupp(true);
    try {
      const ratesPayload = { ...suppRates, custom: customSupplements };
      const { error } = await supabase
        .from('companies')
        .update({ supplement_rates: ratesPayload })
        .eq('id', companyId);
      if (error) throw error;
      toast.success('Supplement rates saved.');
      onCompanyUpdate?.({ ...company, supplement_rates: ratesPayload });
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSavingSupp(false);
    }
  };

  const addCustomSupplement = () => {
    setCustomSupplements(prev => [...prev, {
      id: `custom-${Date.now()}`,
      label: '',
      description: '',
      good: 0,
      better: 0,
      best: 0,
    }]);
  };

  const updateCustomSupplement = (id: string, field: keyof CustomSupplement, value: string | number) => {
    setCustomSupplements(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeCustomSupplement = (id: string) => {
    setCustomSupplements(prev => prev.filter(s => s.id !== id));
  };

  const downloadSupplementReferenceCSV = () => {
    const header = 'supplement_name,xactimate_code,midwest_reference_rate,your_good_price,your_better_price,your_best_price';
    const rows = customSupplements.map(s => {
      const codeMatch = s.label.match(/\(([^)]+)\)$/);
      const code = codeMatch ? codeMatch[1] : '';
      const rateMatch = s.description.match(/ref:\s*([^\n]+)/i);
      const ref = rateMatch ? rateMatch[1].trim() : '';
      return [s.label, code, ref, s.good, s.better, s.best]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });
    const csv = [header, ...rows].join('\n');
    void downloadCSV(csv, 'quotemgr_supplement_rates.csv');
  };

  const updateSuppRate = (key: SupplementKey, tier: 'good' | 'better' | 'best', value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) && value !== '') return;
    setSuppRates(prev => ({
      ...prev,
      [key]: { ...prev[key], [tier]: isNaN(num) ? 0 : num },
    }));
  };

  const openEditBrowseItem = (item: PricingItem) => {
    setEditingBrowseItem(item);
    setEditUnit(item.unit);
    setEditDescription(item.description ?? '');
    // Pre-fill with personal override if member has one, otherwise company price
    const ovKey = `${item.category}::${item.item_name}`;
    const ov = canOverride ? userOverrides.get(ovKey) : undefined;
    setEditGood(String(ov?.good_price ?? item.good_price));
    setEditBetter(String(ov?.better_price ?? item.better_price));
    setEditBest(String(ov?.best_price ?? item.best_price));
  };

  const handleSaveEditBrowseItem = async () => {
    if (!editingBrowseItem) return;
    setSavingEdit(true);
    try {
      const good   = parseFloat(editGood)   || 0;
      const better = parseFloat(editBetter) || 0;
      const best   = parseFloat(editBest)   || 0;

      if (canOverride && userId) {
        // Member path — save to personal overrides, not company_pricing
        const { error } = await supabase.from('user_pricing_overrides').upsert({
          user_id: userId,
          company_id: companyId,
          item_name: editingBrowseItem.item_name,
          category: editingBrowseItem.category || 'General',
          good_price: good,
          better_price: better,
          best_price: best,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,company_id,category,item_name' });
        if (error) throw error;
        toast.success('Your personal price saved — only you will see this change.');
        await fetchUserOverrides();
      } else {
        // Owner/admin path — update company_pricing for the whole team
        const { error } = await supabase
          .from('company_pricing')
          .update({
            unit: editUnit.trim(),
            description: editDescription.trim() || null,
            good_price: good,
            better_price: better,
            best_price: best,
          })
          .eq('id', editingBrowseItem.id);
        if (error) throw error;
        toast.success(`"${editingBrowseItem.item_name}" updated for the whole team.`);
        await fetchBrowseItems();
      }
      setEditingBrowseItem(null);
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleClearOverride = async () => {
    if (!editingBrowseItem || !userId) return;
    setClearingOverride(true);
    try {
      const { error } = await supabase
        .from('user_pricing_overrides')
        .delete()
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .eq('item_name', editingBrowseItem.item_name)
        .eq('category', editingBrowseItem.category || 'General');
      if (error) throw error;
      toast.success('Personal override cleared — you\'ll now see the company price.');
      await fetchUserOverrides();
      setEditingBrowseItem(null);
    } catch (err: any) {
      toast.error('Clear failed: ' + err.message);
    } finally {
      setClearingOverride(false);
    }
  };

  const validCount = rows.filter(r => r.valid).length;
  const invalidCount = rows.filter(r => !r.valid).length;

  const parsedCategoryMap = useMemo(() => {
    const map: Record<string, number> = {};
    rows.filter(r => r.valid).forEach(r => {
      const cat = r.category || 'General';
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [rows]);

  const hasCategoryFilter = Object.keys(parsedCategoryMap).length > 1;

  const filteredValidRows = useMemo(() => {
    const valid = rows.filter(r => r.valid);
    if (!hasCategoryFilter) return valid;
    if (selectedCategories.size === 0) return [];
    return valid.filter(r => selectedCategories.has(r.category || 'General'));
  }, [rows, selectedCategories, hasCategoryFilter]);

  const importCount = filteredValidRows.length;
  const duplicateCount = filteredValidRows.filter(r => r.isDuplicate).length;

  // Select all categories whenever a new file is parsed
  useEffect(() => {
    const cats = Object.keys(parsedCategoryMap);
    if (cats.length > 0) setSelectedCategories(new Set(cats));
  }, [parsedCategoryMap]);

  const handleImportClick = () => {
    const listName = priceListName.trim() || 'My Prices';
    const targetList = existingLists.find(l => l.name === listName);
    if (targetList && targetList.count > 0) {
      setShowBackupModal(true);
    } else {
      void handleImport();
    }
  };

  const filteredBrowseItems = useMemo(() => {
    let items = browseItems;
    if (browseCategory !== 'All') {
      items = items.filter(i => i.category === browseCategory);
    }
    if (browseSearch.trim()) {
      const q = browseSearch.toLowerCase();
      items = items.filter(i =>
        i.item_name.toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q) ||
        (i.category ?? '').toLowerCase().includes(q) ||
        (i.price_list_name ?? '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [browseItems, browseSearch, browseCategory]);

  const groupedBrowse = useMemo(() => {
    const map: Record<string, PricingItem[]> = {};
    for (const item of filteredBrowseItems) {
      const cat = item.category || 'Other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    return Object.entries(map);
  }, [filteredBrowseItems]);

  const availableCategories = useMemo(() => {
    const inData = new Set(browseItems.map(i => i.category || 'Other'));
    return CATEGORIES.filter(c => c === 'All' || inData.has(c));
  }, [browseItems]);

  // Group import history by price list
  const historyByList = useMemo(() => {
    const map: Record<string, ImportHistoryEntry[]> = {};
    for (const entry of importHistory) {
      if (!map[entry.price_list_name]) map[entry.price_list_name] = [];
      map[entry.price_list_name].push(entry);
    }
    return map;
  }, [importHistory]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Price Library</h3>
        <p className="text-sm text-gray-500 mt-1">
          Manage your pricing lists, import from supplier files, and configure insurance supplement rates.
        </p>
      </div>

      {/* ── Price update notice banner ───────────────────────────────────── */}
      {latestPriceUpdate && noticeUnread && (
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <Bell className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-900">
              Prices updated by {latestPriceUpdate.sender_name}
              {latestPriceUpdate.price_list_name && (
                <span className="font-normal text-blue-700"> · "{latestPriceUpdate.price_list_name}"</span>
              )}
              <span className="font-normal text-blue-500 ml-1.5">
                {new Date(latestPriceUpdate.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </p>
            {latestPriceUpdate.message && (
              <p className="text-xs text-blue-700 mt-0.5">{latestPriceUpdate.message}</p>
            )}
          </div>
          <button
            onClick={handleDismissNotice}
            className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Browse / Search Library — always first ──────────────────────── */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Browse Library</span>
          {browseItems.length > 0 && (
            <span className="text-xs text-gray-400">{browseItems.length} items total</span>
          )}
          {browseItems.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-0.5">
              <button
                onClick={() => toggleSellPrices(false)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  !showSellPrices ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Cost
              </button>
              <button
                onClick={() => toggleSellPrices(true)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  showSellPrices ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Sell Price
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={browseSearch}
            onChange={e => setBrowseSearch(e.target.value)}
            placeholder={browseItems.length > 0 ? 'Search items, descriptions…' : 'Import a price list below to search here'}
            disabled={browseItems.length === 0}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {browseSearch && (
            <button
              onClick={() => setBrowseSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {browseItems.length > 0 && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {availableCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setBrowseCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    browseCategory === cat
                      ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#1e3a5f] hover:text-[#1e3a5f]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {browseLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredBrowseItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No items match your search.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {groupedBrowse.map(([cat, catItems]) => (
                  <div key={cat}>
                    {(browseCategory === 'All' || groupedBrowse.length > 1) && (
                      <div className="sticky top-0 bg-gray-50 py-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{cat}</span>
                      </div>
                    )}
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-3 py-1.5 text-left font-semibold text-gray-500">Item</th>
                            <th className="px-3 py-1.5 text-left font-semibold text-gray-500 hidden sm:table-cell">Unit</th>
                            <th className="px-3 py-1.5 text-right font-semibold text-gray-500">Good</th>
                            <th className="px-3 py-1.5 text-right font-semibold text-gray-500">Better</th>
                            <th className="px-3 py-1.5 text-right font-semibold text-gray-500">Best</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {catItems.map(item => (
                            <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors group">
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-gray-900 truncate max-w-[160px]">{item.item_name}</p>
                                  {canOverride && userOverrides.has(`${item.category}::${item.item_name}`) && (
                                    <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide text-purple-700 bg-purple-50 border border-purple-200 px-1 py-0.5 rounded">
                                      My Price
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-gray-400 truncate max-w-[180px] mt-0.5">{item.description}</p>
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{item.unit}</td>
                              <td className="px-3 py-2 text-right text-gray-700">${displayPrice(Number(item.good_price)).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-[#ff6b35]">${displayPrice(Number(item.better_price)).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right text-gray-700">${displayPrice(Number(item.best_price)).toFixed(2)}</td>
                              <td className="px-2 py-2">
                                <button
                                  onClick={() => openEditBrowseItem(item)}
                                  className="p-1 text-gray-300 hover:text-[#1e3a5f] rounded transition-colors opacity-0 group-hover:opacity-100"
                                  title="Edit unit & pricing"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(browseSearch || browseCategory !== 'All') && filteredBrowseItems.length > 0 && (
              <p className="text-xs text-gray-400 text-right">
                Showing {filteredBrowseItems.length} of {browseItems.length} items
              </p>
            )}
          </>
        )}

        {browseItems.length === 0 && !browseLoading && (
          <p className="text-xs text-gray-400 text-center py-2">No pricing items yet — import a price list below to get started.</p>
        )}
      </div>

      {/* ── Insurance Supplement Rates — owners/admins only ────────────── */}
      {!isMember && <div className={`rounded-xl border transition-colors ${suppExpanded ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50/60'}`}>
        <button
          type="button"
          onClick={() => setSuppExpanded(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2.5">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <div>
              <span className="text-sm font-semibold text-gray-800">Insurance Supplement Rates</span>
              <span className="text-xs text-gray-400 font-normal ml-2">Pitch &amp; story height $/sq adders</span>
            </div>
          </div>
          {suppExpanded
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />
          }
        </button>

        {suppExpanded && (
          <div className="px-4 pb-4 space-y-4">
            <p className="text-xs text-gray-500">
              Set your company's $/sq adder for each supplement tier. These prices pre-fill the quote builder when users enable insurance supplements — they can still be adjusted per quote.
            </p>

            <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-500 text-xs">Supplement Type</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-500 text-xs">Good</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-500 text-xs">Better</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-500 text-xs">Best</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {SUPPLEMENT_TIERS.map(({ key, label, description }) => (
                    <tr key={key} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-800 text-xs">{label}</p>
                        <p className="text-gray-400 text-[10px]">{description}</p>
                      </td>
                      {(['good', 'better', 'best'] as const).map(tier => (
                        <td key={tier} className="px-3 py-2.5">
                          <div className="flex items-center justify-center">
                            <span className="text-gray-400 text-xs mr-1">$</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={suppRates[key][tier]}
                              onChange={e => updateSuppRate(key, tier, e.target.value)}
                              className="w-16 text-center px-1.5 py-1 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                          </div>
                        </td>
                      ))}
                      <td className="w-8" />
                    </tr>
                  ))}

                  {/* Custom supplement rows */}
                  {customSupplements.map((supp) => (
                    <tr key={supp.id} className="border-b border-orange-100 bg-orange-50/30">
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          placeholder="Supplement name…"
                          value={supp.label}
                          onChange={e => updateCustomSupplement(supp.id, 'label', e.target.value)}
                          className="w-full text-xs font-medium text-gray-800 bg-transparent border-b border-gray-300 focus:border-orange-400 focus:outline-none pb-0.5 mb-0.5"
                        />
                        <input
                          type="text"
                          placeholder="Description (optional)"
                          value={supp.description}
                          onChange={e => updateCustomSupplement(supp.id, 'description', e.target.value)}
                          className="w-full text-[10px] text-gray-400 bg-transparent border-b border-transparent focus:border-gray-300 focus:outline-none"
                        />
                      </td>
                      {(['good', 'better', 'best'] as const).map(tier => (
                        <td key={tier} className="px-3 py-2.5">
                          <div className="flex items-center justify-center">
                            <span className="text-gray-400 text-xs mr-1">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={supp[tier]}
                              onChange={e => updateCustomSupplement(supp.id, tier, parseFloat(e.target.value) || 0)}
                              className="w-16 text-center px-1.5 py-1 border border-orange-200 rounded-md text-xs focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none bg-white"
                            />
                          </div>
                        </td>
                      ))}
                      <td className="px-2 py-2.5">
                        <button onClick={() => removeCustomSupplement(supp.id)} className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors" title="Remove">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Add custom supplement button */}
              <button
                type="button"
                onClick={addCustomSupplement}
                className="mt-2 flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Custom Supplement Type
              </button>
            </div>

            {/* AI regional repricing tip */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5">🤖</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-900">Adjust rates for your region</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Download your supplement rates as CSV, then upload it to{' '}
                  <a href="https://www.perplexity.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">Perplexity AI</a>
                  {' '}and ask: <em>"Update these insurance supplement rates for [your city/state]. Current rates are Midwest/Ohio pricing."</em>
                </p>
              </div>
              <button
                type="button"
                onClick={downloadSupplementReferenceCSV}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors flex-shrink-0"
              >
                <Download className="w-3 h-3" /> Download CSV
              </button>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSuppRates({ ...SUPPLEMENT_DEFAULTS })}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Reset to defaults
              </button>
              <div className="flex items-center gap-3">
                {/* Auto-save status indicator */}
                <span className={`flex items-center gap-1.5 text-xs transition-opacity duration-300 ${autoSaveStatus === 'idle' ? 'opacity-0' : 'opacity-100'}`}>
                  {autoSaveStatus === 'saving' && (
                    <>
                      <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-blue-500">Saving…</span>
                    </>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <>
                      <Check className="w-3 h-3 text-green-500" />
                      <span className="text-green-600">Saved</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleSaveSupplementRates}
                  disabled={savingSupp || autoSaveStatus === 'saving'}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {savingSupp ? 'Saving…' : 'Save Now'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>}

      {/* Template download */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">Need a template?</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Download our CSV template with the correct column headers and example roofing items.
            {' '}<span className="text-blue-500">💡 Tip: download your existing price list, upload it to <a href="https://www.perplexity.ai" target="_blank" rel="noopener noreferrer" className="underline">Perplexity AI</a>, and ask it to reprice for your region.</span>
          </p>
        </div>
        <button onClick={downloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors flex-shrink-0">
          <Download className="w-3.5 h-3.5" /> Template
        </button>
      </div>

      {/* Bulk update prompt — rules an AI must follow when editing the price list */}
      {!isMember && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-violet-900">Update your whole list at once</p>
              <p className="text-xs text-violet-600 mt-0.5">
                Download a price list as CSV, copy this prompt, and paste both into an AI assistant.
                The prompt carries your pricing rules, so tiers stay consistent and the file comes back
                in a format this importer accepts.
              </p>
              <ol className="text-xs text-violet-700 mt-2 space-y-0.5 list-decimal list-inside">
                <li>Download the list you want to change (from "Your Price Lists" below).</li>
                <li>Copy the prompt and paste it into the AI with your CSV attached.</li>
                <li>Save the CSV it returns and import it above using <span className="font-medium">Replace</span>.</li>
              </ol>
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={copyMaintenancePrompt}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                {promptCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {promptCopied ? 'Copied' : 'Copy Prompt'}
              </button>
              <button
                type="button"
                onClick={downloadPromptFile}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-violet-200 rounded-lg text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Save .md
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {MATERIAL_LIST_RULES.map(rule => (
              <div key={rule.title} className="bg-white border border-violet-100 rounded-lg px-2.5 py-2">
                <p className="text-[11px] font-semibold text-violet-900">{rule.title}</p>
                <p className="text-[11px] text-violet-600 mt-0.5 leading-snug">{rule.detail}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPromptExpanded(v => !v)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900"
          >
            {promptExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {promptExpanded ? 'Hide full prompt' : 'View full prompt'}
          </button>
          {promptExpanded && (
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words bg-white border border-violet-100 rounded-lg p-3 text-[11px] leading-relaxed text-gray-700 select-text">
              {MATERIAL_LIST_MAINTENANCE_PROMPT}
            </pre>
          )}
        </div>
      )}

      {/* Existing price lists with import history — owners/admins only */}
      {!isMember && existingLists.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Price Lists</span>
            {canManageStandard && (
              <button
                onClick={() => setShowNotifyModal(true)}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                title="Notify team of price changes"
              >
                <Bell className="w-3 h-3" /> Notify Team
              </button>
            )}
          </div>
          <div className="space-y-2">
            {existingLists.map(({ name, count, enabled }) => {
              const history = historyByList[name] ?? [];
              const isShowingHistory = showHistoryFor === name;
              return (
                <div key={name} className={`border rounded-lg overflow-hidden bg-white ${enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() => setPriceListName(name)}
                        className={`w-2 h-2 rounded-full border-2 flex-shrink-0 ${priceListName === name ? 'bg-[#1e3a5f] border-[#1e3a5f]' : 'border-gray-300'}`}
                      />
                      <span className="text-sm font-medium text-gray-800 truncate">{name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{count} items</span>
                      {company.standard_price_list_name === name && (
                        <span className="flex-shrink-0 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          Company Standard
                        </span>
                      )}
                      {!enabled && <span className="flex-shrink-0 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Off</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Set as company standard (owners/admins only) */}
                      {canManageStandard && (
                        <button
                          onClick={() => handleSetStandard(name)}
                          disabled={settingStandard}
                          className={`p-1 rounded transition-colors ${
                            company.standard_price_list_name === name
                              ? 'text-amber-500 hover:text-amber-400'
                              : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'
                          }`}
                          title={company.standard_price_list_name === name ? 'Remove company standard' : 'Set as company standard'}
                        >
                          <Star className="w-3.5 h-3.5" fill={company.standard_price_list_name === name ? 'currentColor' : 'none'} />
                        </button>
                      )}
                      {/* History toggle */}
                      {history.length > 0 && (
                        <button
                          onClick={() => setShowHistoryFor(isShowingHistory ? null : name)}
                          className={`flex items-center gap-1 p-1 rounded transition-colors text-xs ${isShowingHistory ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                          title={`${history.length} import${history.length !== 1 ? 's' : ''}`}
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>{history.length}</span>
                        </button>
                      )}
                      {/* Download */}
                      <button
                        onClick={() => handleDownloadList(name)}
                        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                        title={`Download "${name}" as CSV`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {/* Toggle enabled */}
                      <button
                        onClick={() => handleToggleList(name, enabled)}
                        disabled={togglingList === name}
                        className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title={enabled ? `Disable "${name}"` : `Enable "${name}"`}
                      >
                        {togglingList === name
                          ? <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          : <span className={`block w-7 h-4 rounded-full relative transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-200'}`}>
                              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${enabled ? 'left-3.5' : 'left-0.5'}`} />
                            </span>
                        }
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteList(name)}
                        disabled={deletingList === name}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title={`Delete "${name}"`}
                      >
                        {deletingList === name
                          ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Import history drawer */}
                  {isShowingHistory && history.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Import History</p>
                      {history.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700 font-medium truncate max-w-[180px]">
                              {entry.original_filename ?? 'Unknown file'}
                            </span>
                            {entry.item_count != null && (
                              <span className="text-gray-400">{entry.item_count} items</span>
                            )}
                          </div>
                          <span className="text-gray-400 flex-shrink-0">
                            {new Date(entry.imported_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isMember && (<>
      {/* ── Restore / Reset section ─────────────────────────────────────── */}
      <div className={`rounded-xl border transition-colors ${restoreExpanded ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200 bg-gray-50/60'}`}>
        <button
          type="button"
          onClick={() => setRestoreExpanded(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 text-orange-500" />
            <div>
              <span className="text-sm font-semibold text-gray-800">Restore Price Library</span>
              <span className="text-xs text-gray-400 font-normal ml-2">Reset to company standard or app defaults</span>
            </div>
          </div>
          {restoreExpanded
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />
          }
        </button>

        {restoreExpanded && (
          <div className="px-4 pb-4 space-y-3">
            <p className="text-xs text-gray-500">
              Restoring replaces all items in the selected price list. Download a backup first if you want to keep your current prices.
            </p>

            {/* Company standard card */}
            <div className={`rounded-lg border p-3 flex items-start justify-between gap-3 ${
              company.standard_price_list_name
                ? 'border-amber-200 bg-amber-50/60'
                : 'border-gray-200 bg-white opacity-60'
            }`}>
              <div className="flex items-start gap-2.5 min-w-0">
                <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill={company.standard_price_list_name ? 'currentColor' : 'none'} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800">
                    {company.standard_price_list_name
                      ? `Restore from "${company.standard_price_list_name}"`
                      : 'No company standard set'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {company.standard_price_list_name
                      ? `Replaces "${priceListName.trim() || 'My Prices'}" with the company standard list.`
                      : canManageStandard
                        ? 'Star a price list above to designate it as the company standard.'
                        : 'Ask your owner or admin to designate a price list as the company standard.'}
                  </p>
                </div>
              </div>
              {company.standard_price_list_name && (
                <button
                  onClick={() => setResetConfirm({ type: 'company-standard' })}
                  disabled={company.standard_price_list_name === (priceListName.trim() || 'My Prices')}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors"
                  title={company.standard_price_list_name === (priceListName.trim() || 'My Prices') ? "Can't restore a list to itself" : undefined}
                >
                  <RefreshCw className="w-3 h-3" /> Restore
                </button>
              )}
            </div>

            {/* App defaults card */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800">Restore App Defaults</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Replaces "{priceListName.trim() || 'My Prices'}" with the full built-in item library —{' '}
                    {Object.values(defaultLineItems).reduce((s, arr) => s + arr.length, 0)} items across all categories.
                    Prices are regional estimates — adjust for your market.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResetConfirm({ type: 'app-defaults' })}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Restore
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Price list name for this import */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Save to price list
        </label>
        <div className="flex gap-2 flex-wrap mb-1">
          {['My Prices', ...existingLists.map(l => l.name).filter(n => n !== 'My Prices')].map(name => (
            <button
              key={name}
              onClick={() => setPriceListName(name)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                priceListName === name
                  ? 'bg-[#1e3a5f] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={priceListName}
          onChange={e => setPriceListName(e.target.value)}
          placeholder="e.g. SRS Distribution, ABC Supply, My Prices"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
        />
        <p className="text-xs text-gray-400 mt-1">Type a new name to create a new list, or pick an existing one to update it.</p>
      </div>

      {/* Upload area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#1e3a5f] hover:bg-blue-50/40 transition-all"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
            <Upload className="w-6 h-6 text-[#1e3a5f]" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {filename ? `📄 ${filename} — click to replace` : 'Drop your supplier CSV here or click to browse'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Supports .csv, .xlsx, and .xls files from most distributors</p>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {/* Accepted column names hint */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Table className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recognized column names</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(COL_ALIASES).map(alias => (
            <span key={alias} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">{alias}</span>
          ))}
        </div>
      </div>

      {/* Quick-action bar — appears immediately after a file is parsed so users don't have to scroll past the preview */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-blue-900">
            <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              <span className="font-semibold">{validCount} items</span> ready to import
              {invalidCount > 0 && <span className="text-blue-600 ml-1">({invalidCount} skipped)</span>}
            </span>
          </div>
          <button
            onClick={handleImportClick}
            disabled={importing || importCount === 0}
            className="flex items-center gap-2 px-5 py-2 bg-[#1e3a5f] hover:bg-[#152d4a] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow"
          >
            {importing ? 'Importing…' : `Import ${importCount} Items`}
          </button>
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Preview ({rows.length} rows)</h4>
            {validCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3" /> {validCount} valid
              </span>
            )}
            {invalidCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                <X className="w-3 h-3" /> {invalidCount} skipped
              </span>
            )}
            {duplicateCount > 0 && importMode === 'merge' && (
              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" /> {duplicateCount} will update existing
              </span>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Item</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Category</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Good</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Better</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Best</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${!row.valid ? 'bg-red-50' : row.isDuplicate ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-3 py-2 text-gray-900 font-medium truncate max-w-[180px]">{row.item_name || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{row.category || '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-700">${displayPrice(row.good_price).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">${displayPrice(row.better_price).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">${displayPrice(row.best_price).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      {!row.valid
                        ? <span title={row.error}><AlertCircle className="w-3.5 h-3.5 text-red-400 mx-auto" /></span>
                        : row.isDuplicate
                          ? <span title="Exists in this list — will update price">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mx-auto" />
                            </span>
                          : <Check className="w-3.5 h-3.5 text-green-500 mx-auto" />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Category filter — only shown when file spans 2+ categories */}
          {hasCategoryFilter && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-900">Import only these categories</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedCategories(new Set(Object.keys(parsedCategoryMap)))}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedCategories(new Set())}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(parsedCategoryMap).map(([cat, count]) => {
                  const checked = selectedCategories.has(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategories(prev => {
                        const next = new Set(prev);
                        if (next.has(cat)) next.delete(cat); else next.add(cat);
                        return next;
                      })}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        checked
                          ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {cat}
                      <span className={`text-[10px] ${checked ? 'text-blue-200' : 'text-gray-400'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
              {selectedCategories.size === 0 && (
                <p className="text-[11px] text-red-500 mt-2">Select at least one category to import.</p>
              )}
              {selectedCategories.size > 0 && selectedCategories.size < Object.keys(parsedCategoryMap).length && (
                <p className="text-[11px] text-blue-700 mt-2">
                  Unchecked categories will not be modified in your price list.
                </p>
              )}
            </div>
          )}

          {duplicateCount > 0 && importMode === 'merge' && (
            <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {duplicateCount} item{duplicateCount !== 1 ? 's' : ''} already exist in "{priceListName}" and will have their prices updated.
            </p>
          )}

          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setImportMode('merge')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${importMode === 'merge' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Merge (add &amp; update)
              </button>
              <button
                onClick={() => setImportMode('replace')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${importMode === 'replace' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Replace all
              </button>
            </div>
            <div className="flex items-center gap-3">
              {importMode === 'replace' && (
                <p className="text-xs text-red-500">
                  {hasCategoryFilter && selectedCategories.size > 0 && selectedCategories.size < Object.keys(parsedCategoryMap).length
                    ? `⚠️ Replaces only the selected ${selectedCategories.size === 1 ? 'category' : 'categories'}`
                    : '⚠️ Replaces your entire existing list'}
                </p>
              )}
              <button onClick={handleImportClick} disabled={importing || importCount === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#1e3a5f] hover:bg-[#152d4a] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg">
                {importing ? 'Importing…' : `Import ${importCount} Items`}
              </button>
            </div>
          </div>
        </div>
      )}

      {imported && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500" />
          <div>
            <p className="text-sm font-medium text-green-900">{importedCount} items saved to your pricing library!</p>
            <p className="text-xs text-green-600 mt-0.5">They're now available in the Quote Builder line items and your pricing library.</p>
          </div>
        </div>
      )}
      </>)}

      {/* ── Notify team modal ────────────────────────────────────────────── */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Bell className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Notify Your Team</h3>
                  <p className="text-xs text-gray-400">Let everyone know prices have changed</p>
                </div>
              </div>
              <button onClick={() => setShowNotifyModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Message <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={notifyMessage}
                onChange={e => setNotifyMessage(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="e.g. Updated roofing labor rates for spring — all shingle prices increased by 5%."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
              <p className="text-[10px] text-gray-400 text-right mt-0.5">{notifyMessage.length}/300</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                All team members will see a notification in the Price Library the next time they open it.
                Prices in the database are already live — this just lets everyone know to check.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowNotifyModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendNotice}
                disabled={sendingNotice}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {sendingNotice
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />
                }
                Send Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset confirmation modal ─────────────────────────────────────── */}
      {resetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {resetConfirm.type === 'company-standard' ? 'Restore Company Standard?' : 'Restore App Defaults?'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will replace all items in{' '}
                  <strong className="text-gray-700">"{priceListName.trim() || 'My Prices'}"</strong>{' '}
                  {resetConfirm.type === 'company-standard'
                    ? `with the items from "${company.standard_price_list_name}".`
                    : `with the built-in app defaults (${Object.values(defaultLineItems).reduce((s, a) => s + a.length, 0)} items).`}
                  {' '}Download a backup if you need to keep your current prices.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={async () => {
                  await handleDownloadList(priceListName.trim() || 'My Prices');
                  if (resetConfirm.type === 'company-standard') {
                    await handleResetToCompanyStandard();
                  } else {
                    await handleResetToAppDefaults();
                  }
                }}
                disabled={resetting}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1e3a5f] hover:bg-[#152d4a] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Save Backup &amp; Restore
              </button>
              <button
                onClick={() => {
                  if (resetConfirm.type === 'company-standard') {
                    void handleResetToCompanyStandard();
                  } else {
                    void handleResetToAppDefaults();
                  }
                }}
                disabled={resetting}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {resetting && <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
                Restore Without Backup
              </button>
              <button
                onClick={() => setResetConfirm(null)}
                disabled={resetting}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Backup prompt modal ──────────────────────────────────────────── */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Save a backup first?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  You're about to update <strong className="text-gray-700">"{priceListName.trim() || 'My Prices'}"</strong>.
                  Download a copy of your current list before importing in case you need to restore it.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={async () => {
                  await handleDownloadList(priceListName.trim() || 'My Prices');
                  void handleImport();
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1e3a5f] hover:bg-[#152d4a] text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Download className="w-4 h-4" /> Save Backup &amp; Continue
              </button>
              <button
                onClick={() => void handleImport()}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Import Without Backup
              </button>
              <button
                onClick={() => setShowBackupModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit item modal ──────────────────────────────────────────────── */}
      {editingBrowseItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 truncate max-w-[280px]">
                  {editingBrowseItem.item_name}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{editingBrowseItem.category} · {editingBrowseItem.price_list_name}</p>
                {canOverride && (
                  <p className="text-xs text-purple-600 mt-0.5 font-medium">Personal override — only visible to you</p>
                )}
              </div>
              <button
                onClick={() => setEditingBrowseItem(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description — owners/admins only; members can only override prices */}
            {!canOverride && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none resize-none"
                  placeholder="Item description…"
                />
              </div>
            )}

            {/* Unit — owners/admins only */}
            {!canOverride && <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Unit of measure</label>
              <select
                value={editUnit}
                onChange={e => setEditUnit(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none bg-white"
              >
                <option value="each">each</option>
                <option value="sq">sq (square)</option>
                <option value="sheet">sheet (4×8)</option>
                <option value="gal">gal</option>
                <option value="bundle">bundle</option>
                <option value="roll">roll</option>
                <option value="lf">lf</option>
                <option value="stick">stick</option>
                <option value="sq ft">sq ft</option>
                <option value="hr">hr</option>
                <option value="lot">lot</option>
              </select>
              {/* Also allow free-text override */}
              <input
                type="text"
                value={editUnit}
                onChange={e => setEditUnit(e.target.value)}
                placeholder="Or type a custom unit…"
                className="mt-1.5 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
              />
            </div>}

            {/* Prices */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                {canOverride ? 'Your price override' : `Prices (installed, per ${editUnit || 'unit'})`}
              </label>
              {canOverride && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 py-1.5 px-2.5 bg-gray-50 border border-gray-100 rounded-lg">
                  <span className="text-[10px] font-semibold text-gray-500">Company price:</span>
                  <span className="text-[10px] text-gray-400">Good <span className="font-medium text-gray-600">${displayPrice(Number(editingBrowseItem.good_price)).toFixed(2)}</span></span>
                  <span className="text-[10px] text-gray-400">Better <span className="font-medium text-[#ff6b35]">${displayPrice(Number(editingBrowseItem.better_price)).toFixed(2)}</span></span>
                  <span className="text-[10px] text-gray-400">Best <span className="font-medium text-gray-600">${displayPrice(Number(editingBrowseItem.best_price)).toFixed(2)}</span></span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                {([['Good', editGood, setEditGood], ['Better', editBetter, setEditBetter], ['Best', editBest, setEditBest]] as const).map(([label, val, setter]) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold text-gray-400 text-center mb-1">{label}</p>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={val}
                        onChange={e => setter(e.target.value)}
                        className="w-full pl-5 pr-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              {canOverride && editingBrowseItem && userOverrides.has(`${editingBrowseItem.category}::${editingBrowseItem.item_name}`) && (
                <button
                  onClick={handleClearOverride}
                  disabled={clearingOverride}
                  title="Remove your personal override and use the company price"
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-red-200 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {clearingOverride
                    ? <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    : <RefreshCw className="w-3 h-3" />}
                  Reset
                </button>
              )}
              <button
                onClick={() => setEditingBrowseItem(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditBrowseItem}
                disabled={savingEdit}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1e3a5f] hover:bg-[#152d4a] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {savingEdit ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {canOverride ? 'Save My Price' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceListImporter;
