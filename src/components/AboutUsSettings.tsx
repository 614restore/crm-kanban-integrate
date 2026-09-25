import React, { useEffect, useRef, useState } from 'react';
import {
  GripVertical, Image, Loader2, Plus, Save, Sparkles, Trash2, Upload, X, Eye, EyeOff, LayoutTemplate,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { optimizeImageForUpload, COMPRESS_PRESETS, STORAGE_CACHE_CONTROL } from '@/lib/imageUtils';
import { getAIConfig } from '@/lib/aiHelper';
import type { Company } from '@/data/quoteData';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Highlight {
  id: string;
  title: string;
  description: string;
  photoUrl?: string;
}

interface ProcessStep {
  id: string;
  title: string;
  description: string;
}

interface ShowcasePhoto {
  id: string;
  url: string;
  caption: string;
}

interface AboutUsSettingsProps {
  company: Company;
  onUpdate: (updated: Company) => void;
}

type PageTemplate = 'about_us' | 'value_pillars';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_HIGHLIGHTS: Highlight[] = [
  { id: uid(), title: 'Quality Craftsmanship', description: 'Every project is completed with meticulous attention to detail and the highest quality materials.' },
  { id: uid(), title: 'Transparent Pricing', description: 'No hidden fees — our quotes are detailed, honest, and exactly what you pay.' },
  { id: uid(), title: 'Licensed & Insured', description: 'Fully licensed, bonded, and insured so you can have complete peace of mind.' },
  { id: uid(), title: 'Fast Response Times', description: 'We respond quickly, show up on time, and keep you updated every step of the way.' },
];

const DEFAULT_PROCESS_STEPS: ProcessStep[] = [
  { id: uid(), title: 'Free Inspection & Photo Report', description: 'We inspect your property and deliver a detailed photo report with findings and recommendations—no pressure, just facts.' },
  { id: uid(), title: 'Custom Quote & Planning', description: 'Receive a no-obligation quote with transparent pricing, materials, and timeline. We handle insurance claims if needed.' },
  { id: uid(), title: 'Scheduling & Prep', description: 'We order premium materials, secure permits, and schedule at your convenience. Your project manager keeps you updated every step.' },
  { id: uid(), title: 'Expert Installation & Final Check', description: 'Our certified crew completes the job efficiently, cleans up completely, and walks through the result with you. 2-year labor warranty included.' },
  { id: uid(), title: 'Ongoing Support & Warranty', description: 'We activate your manufacturer warranty, provide all documentation, and offer priority service for any future needs.' },
];

const DEFAULT_VALUE_PILLARS: Highlight[] = [
  { id: uid(), title: 'Communication & Transparency', description: 'We provide real-time photo updates and drone footage during the build so you\'re never left wondering — you see exactly what we see, when we see it.' },
  { id: uid(), title: 'The Clean Site Guarantee', description: 'Using specialized equipment including catch-all nets and magnetic sweeps, we ensure not a single nail or scrap is left behind on your property.' },
  { id: uid(), title: 'No-Surprise Pricing', description: 'Your quote is final — period. Even if we uncover unexpected wood rot or damage mid-project, the price you approved is the price you pay.' },
  { id: uid(), title: 'Workmanship Longevity', description: 'Our dedicated labor warranty goes above and beyond the manufacturer\'s material warranty, because we stand behind every nail we drive.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components: Page Previews
// ─────────────────────────────────────────────────────────────────────────────
interface PreviewProps {
  company: Company;
  tagline: string;
  mission: string;
  highlights: Highlight[];
  showcasePhotos: ShowcasePhoto[];
  bgImageUrl: string;
  bgOpacity: number;
  bgZoom: number;
  pageTemplate: PageTemplate;
}

// ─── Value Pillars Preview ────────────────────────────────────────────────────
const ValuePillarsPreview: React.FC<PreviewProps> = ({
  company, highlights, bgImageUrl, bgOpacity, bgZoom,
}) => {
  const primaryColor = company.quote_primary_color || '#1e3a5f';

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-lg bg-white" style={{ minHeight: 520 }}>
      {/* Background image layer */}
      {bgImageUrl && (
        <div
          className="absolute inset-0 bg-center"
          style={{ backgroundImage: `url(${bgImageUrl})`, backgroundSize: `${bgZoom}%`, backgroundRepeat: 'no-repeat', opacity: bgOpacity }}
        />
      )}
      <div className="absolute inset-0 bg-white/70" />

      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="text-center mb-8 pb-6 border-b border-gray-200">
          {company.logo_url && (
            <img src={company.logo_url} alt={company.name} className="h-14 object-contain mx-auto mb-3" />
          )}
          <h1 className="text-2xl font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
            {company.name}
          </h1>
        </div>

        {/* Headline */}
        <div className="mb-6">
          <h2 className="text-xl font-extrabold leading-tight mb-2" style={{ color: primaryColor }}>
            What Makes Us Different?
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            In a crowded market, "doing a good job" is the baseline. Here's how we stand apart:
          </p>
        </div>

        {/* Value Pillars — single column, bold cards */}
        <div className="space-y-4">
          {highlights.map((h, i) => (
            <div key={h.id} className="bg-white/90 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {/* Pillar header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-bold text-sm" style={{ color: primaryColor }}>{h.title}</h3>
              </div>
              {/* Photo */}
              {h.photoUrl && (
                <div className="w-full aspect-video overflow-hidden">
                  <img src={h.photoUrl} alt={h.title} className="w-full h-full object-cover" />
                </div>
              )}
              {/* Description */}
              {h.description && (
                <p className="px-4 py-3 text-xs text-gray-600 leading-relaxed">{h.description}</p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          {company.license_number && <span className="mr-3">Lic #{company.license_number}</span>}
          {company.phone && <span className="mr-3">{company.phone}</span>}
          {company.website && <span>{company.website}</span>}
        </div>
      </div>
    </div>
  );
};

// ─── About Us Preview ─────────────────────────────────────────────────────────
const AboutUsPreview: React.FC<PreviewProps> = ({
  company, tagline, mission, highlights, showcasePhotos, bgImageUrl, bgOpacity, bgZoom, pageTemplate,
}) => {
  if (pageTemplate === 'value_pillars') {
    return <ValuePillarsPreview company={company} tagline={tagline} mission={mission} highlights={highlights} showcasePhotos={showcasePhotos} bgImageUrl={bgImageUrl} bgOpacity={bgOpacity} bgZoom={bgZoom} pageTemplate={pageTemplate} />;
  }
  const primaryColor = company.quote_primary_color || '#1e3a5f';

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-lg bg-white" style={{ minHeight: 520 }}>
      {/* Background image layer */}
      {bgImageUrl && (
        <div
          className="absolute inset-0 bg-center"
          style={{
            backgroundImage: `url(${bgImageUrl})`,
            backgroundSize: `${bgZoom}%`,
            backgroundRepeat: 'no-repeat',
            opacity: bgOpacity,
          }}
        />
      )}
      {/* Subtle white overlay to ensure readability */}
      <div className="absolute inset-0 bg-white/70" />

      {/* Content */}
      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="text-center mb-8 pb-6 border-b border-gray-200">
          {company.logo_url && (
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-14 object-contain mx-auto mb-3"
            />
          )}
          <h1 className="text-2xl font-bold uppercase tracking-widest" style={{ color: primaryColor }}>
            {company.name}
          </h1>
          {tagline && (
            <p className="text-sm text-gray-500 mt-1 italic">{tagline}</p>
          )}
        </div>

        {/* Mission */}
        {mission && (
          <div className="mb-8">
            <h2
              className="text-lg font-bold mb-3 pl-3 border-l-4"
              style={{ color: primaryColor, borderColor: primaryColor }}
            >
              Our Mission
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed max-w-2xl">{mission}</p>
          </div>
        )}

        {/* Highlights grid */}
        {highlights.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {highlights.map((h, i) => (
              <div
                key={h.id}
                className="bg-white/80 border border-gray-200 rounded-xl overflow-hidden shadow-sm"
              >
                <div className="px-4 pt-4 pb-2">
                  <h3 className="font-bold text-sm" style={{ color: primaryColor }}>
                    {String(i + 1).padStart(2, '0')}. {h.title}
                  </h3>
                </div>
                {h.photoUrl && (
                  <div className="w-full aspect-video overflow-hidden">
                    <img src={h.photoUrl} alt={h.title} className="w-full h-full object-cover" />
                  </div>
                )}
                {h.description && (
                  <p className="px-4 py-3 text-xs text-gray-600 leading-relaxed">{h.description}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Showcase photos */}
        {showcasePhotos.length > 0 && (
          <div>
            <h2
              className="text-sm font-bold mb-3 pl-3 border-l-4"
              style={{ color: primaryColor, borderColor: primaryColor }}
            >
              Our Work
            </h2>
            <div className="flex flex-wrap gap-3">
              {showcasePhotos.map((p) => (
                <div key={p.id} className="relative rounded-lg overflow-hidden shadow-sm border border-gray-200" style={{ width: 100, height: 80 }}>
                  <img src={p.url} alt={p.caption || 'Showcase'} className="w-full h-full object-cover" />
                  {p.caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[9px] px-1.5 py-0.5 truncate">
                      {p.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          {company.license_number && <span className="mr-3">Lic #{company.license_number}</span>}
          {company.phone && <span className="mr-3">{company.phone}</span>}
          {company.website && <span>{company.website}</span>}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
const AboutUsSettings: React.FC<AboutUsSettingsProps> = ({ company, onUpdate }) => {
  const [tagline, setTagline] = useState(company.about_tagline || '');
  const [mission, setMission] = useState(company.about_mission || '');
  const [highlights, setHighlights] = useState<Highlight[]>(() => {
    const saved = company.about_highlights;
    if (Array.isArray(saved) && saved.length > 0) {
      return saved.map((h) => ({ ...h, id: uid() }));
    }
    return DEFAULT_HIGHLIGHTS;
  });
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>(() => {
    const saved = company.about_process_steps;
    if (Array.isArray(saved) && saved.length > 0) {
      return saved.map((s) => ({ ...s, id: uid() }));
    }
    return DEFAULT_PROCESS_STEPS;
  });
  const [processDraggingId, setProcessDraggingId] = useState<string | null>(null);
  const processDragOverId = useRef<string | null>(null);
  const [showcasePhotos, setShowcasePhotos] = useState<ShowcasePhoto[]>(() =>
    (company.about_showcase_photos || []).map((p) => ({ ...p, id: uid(), caption: p.caption || '' }))
  );
  const [pageTemplate, setPageTemplate] = useState<PageTemplate>((company.about_page_template as PageTemplate) || 'about_us');
  const [bgImageUrl, setBgImageUrl] = useState(company.about_bg_image_url || '');
  const [bgOpacity, setBgOpacity] = useState<number>(company.about_bg_opacity ?? 0.12);
  const [bgZoom, setBgZoom] = useState<number>(company.about_bg_zoom ?? 100);
  const [showPreview, setShowPreview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingShowcase, setUploadingShowcase] = useState(false);
  const [uploadingHighlightId, setUploadingHighlightId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOverId = useRef<string | null>(null);
  const [generatingMission, setGeneratingMission] = useState(false);
  const [generatingHighlights, setGeneratingHighlights] = useState(false);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        about_page_template: pageTemplate,
        about_tagline: tagline.trim() || null,
        about_mission: mission.trim() || null,
        about_highlights: highlights.map(({ title, description, photoUrl }) => ({ title, description, ...(photoUrl ? { photoUrl } : {}) })),
        about_showcase_photos: showcasePhotos.map(({ url, caption }) => ({ url, caption: caption.trim() || undefined })),
        about_bg_image_url: bgImageUrl.trim() || null,
        about_bg_opacity: bgOpacity,
        about_bg_zoom: bgZoom,
        about_process_steps: processSteps.map(({ title, description }) => ({ title, description })),
      };
      const { error } = await supabase.from('companies').update(payload).eq('id', company.id);
      if (error) throw error;
      onUpdate({ ...company, ...payload });
      toast.success('About Us page saved!');
    } catch (err) {
      toast.error('Failed to save — please try again');
    } finally {
      setSaving(false);
    }
  };

  // ── Background image upload ───────────────────────────────────────────────
  const handleBgUpload = async (file: File) => {
    setUploadingBg(true);
    try {
      const optimized = (await optimizeImageForUpload(file, COMPRESS_PRESETS.coverPhoto)) as File;
      const ext = optimized.name.split('.').pop() || 'jpg';
      const path = `about-bg-${company.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('quote-photos').upload(path, optimized, { upsert: true, cacheControl: STORAGE_CACHE_CONTROL });
      if (error) throw error;
      const { data } = supabase.storage.from('quote-photos').getPublicUrl(path);
      setBgImageUrl(data.publicUrl);
      toast.success('Background image uploaded');
    } catch (err: any) {
      console.error('Background image upload error:', err);
      toast.error(`Failed to upload background image: ${err?.message || err?.error || 'please try again'}`);
    } finally {
      setUploadingBg(false);
    }
  };

  // ── Highlight photo upload ────────────────────────────────────────────────
  const handleHighlightPhotoUpload = async (highlightId: string, file: File) => {
    setUploadingHighlightId(highlightId);
    try {
      const optimized = (await optimizeImageForUpload(file, COMPRESS_PRESETS.quotePhoto)) as File;
      const ext = optimized.name.split('.').pop() || 'jpg';
      const path = `highlight-${company.id}-${highlightId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('quote-photos').upload(path, optimized, { upsert: true, cacheControl: STORAGE_CACHE_CONTROL });
      if (error) throw error;
      const { data } = supabase.storage.from('quote-photos').getPublicUrl(path);
      setHighlights((prev) => prev.map((h) => h.id === highlightId ? { ...h, photoUrl: data.publicUrl } : h));
      toast.success('Photo uploaded');
    } catch (err: any) {
      console.error('Highlight photo upload error:', err);
      toast.error(`Failed to upload photo: ${err?.message || err?.error || 'please try again'}`);
    } finally {
      setUploadingHighlightId(null);
    }
  };

  // ── Showcase photo upload ─────────────────────────────────────────────────
  const handleShowcaseUpload = async (files: FileList) => {
    setUploadingShowcase(true);
    try {
      const uploaded: ShowcasePhoto[] = [];
      for (const file of Array.from(files)) {
        const optimized = (await optimizeImageForUpload(file)) as File;
        const ext = optimized.name.split('.').pop() || 'jpg';
        const path = `about-showcase-${company.id}-${Date.now()}-${uid()}.${ext}`;
        const { error } = await supabase.storage.from('quote-photos').upload(path, optimized, { upsert: true, cacheControl: STORAGE_CACHE_CONTROL });
        if (error) throw error;
        const { data } = supabase.storage.from('quote-photos').getPublicUrl(path);
        uploaded.push({ id: uid(), url: data.publicUrl, caption: '' });
      }
      setShowcasePhotos((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} photo${uploaded.length > 1 ? 's' : ''} added`);
    } catch (err: any) {
      console.error('Showcase photo upload error:', err);
      toast.error(`Failed to upload photos: ${err?.message || err?.error || 'please try again'}`);
    } finally {
      setUploadingShowcase(false);
    }
  };

  // ── Highlight drag-and-drop reorder ──────────────────────────────────────
  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragOverId.current = id;
  };
  const handleDrop = () => {
    if (!draggingId || !dragOverId.current || draggingId === dragOverId.current) return;
    setHighlights((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((h) => h.id === draggingId);
      const toIdx = arr.findIndex((h) => h.id === dragOverId.current);
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    setDraggingId(null);
    dragOverId.current = null;
  };

  // ── Process steps drag-and-drop reorder ─────────────────────────────────
  const handleProcessDragStart = (id: string) => setProcessDraggingId(id);
  const handleProcessDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    processDragOverId.current = id;
  };
  const handleProcessDrop = () => {
    if (!processDraggingId || !processDragOverId.current || processDraggingId === processDragOverId.current) return;
    setProcessSteps((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((s) => s.id === processDraggingId);
      const toIdx = arr.findIndex((s) => s.id === processDragOverId.current);
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    setProcessDraggingId(null);
    processDragOverId.current = null;
  };

  // ── AI Generate: Mission / About Us ──────────────────────────────────────
  const handleGenerateMission = async () => {
    setGeneratingMission(true);
    try {
      const config = await getAIConfig(company.id);
      if (!config) { toast.error('AI is not configured. Set it up in Settings → AI Assistant.'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const trade = (company as any).trade || 'contractor';
      const prompt = `Write a professional ~150-word mission/about us paragraph for ${company.name}, a ${trade} company. The paragraph should convey trust, quality, and expertise. Return plain text only, no markdown, no heading.`;
      const body = config.provider === 'google'
        ? { contents: [{ parts: [{ text: prompt }] }] }
        : { model: config.model, messages: [{ role: 'user', content: prompt }], max_tokens: 300 };
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ provider: config.provider, model: config.model, body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'AI error');
      const text = config.provider === 'google'
        ? data.candidates?.[0]?.content?.parts?.[0]?.text
        : config.provider === 'anthropic'
          ? data.content?.[0]?.text
          : data.choices?.[0]?.message?.content;
      if (text) { setMission(text.trim()); toast.success('Mission generated!'); }
      else throw new Error('No text returned');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate mission');
    } finally {
      setGeneratingMission(false);
    }
  };

  // ── AI Suggest: Highlights / Value Pillars ────────────────────────────────
  const handleSuggestHighlights = async () => {
    setGeneratingHighlights(true);
    try {
      const config = await getAIConfig(company.id);
      if (!config) { toast.error('AI is not configured. Set it up in Settings → AI Assistant.'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const trade = (company as any).trade || 'contractor';
      const sectionLabel = pageTemplate === 'value_pillars' ? 'value pillars' : 'reasons why customers should choose this company';
      const prompt = `Generate 4-5 ${sectionLabel} for ${company.name}, a ${trade} company.

Return valid JSON only — an array of objects, each with "title" (short, 2-5 words) and "description" (1-2 sentences). No markdown, no extra keys.

Example format:
[{"title":"Licensed & Insured","description":"We are fully licensed and insured for your protection."}]`;
      const body = config.provider === 'google'
        ? { contents: [{ parts: [{ text: prompt }] }] }
        : { model: config.model, messages: [{ role: 'user', content: prompt }], max_tokens: 600 };
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ provider: config.provider, model: config.model, body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'AI error');
      const raw = config.provider === 'google'
        ? data.candidates?.[0]?.content?.parts?.[0]?.text
        : config.provider === 'anthropic'
          ? data.content?.[0]?.text
          : data.choices?.[0]?.message?.content;
      if (!raw) throw new Error('No text returned');
      const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      const parsed: { title: string; description: string }[] = JSON.parse(cleaned.slice(start, end + 1));
      const newItems = parsed.map((item) => ({ id: uid(), title: item.title, description: item.description }));
      setHighlights((prev) => [...prev, ...newItems]);
      toast.success(`${newItems.length} suggestions added!`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to suggest highlights');
    } finally {
      setGeneratingHighlights(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {pageTemplate === 'about_us' ? 'About Us Page' : 'What Makes Us Different?'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Build a professional company profile page included in your quotes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white text-sm font-semibold rounded-lg hover:bg-[#162d4a] transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Template Switcher ──────────────────────────────────────────────── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-1.5 flex gap-1.5">
        <button
          onClick={() => setPageTemplate('about_us')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            pageTemplate === 'about_us'
              ? 'bg-white shadow-sm text-[#1e3a5f] border border-gray-200'
              : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
          }`}
        >
          <LayoutTemplate className="w-4 h-4" />
          About Us
        </button>
        <button
          onClick={() => {
            if (pageTemplate === 'about_us') {
              const hasContent = highlights.some((h) => h.title.trim());
              if (!hasContent) setHighlights(DEFAULT_VALUE_PILLARS);
            }
            setPageTemplate('value_pillars');
          }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            pageTemplate === 'value_pillars'
              ? 'bg-white shadow-sm text-[#1e3a5f] border border-gray-200'
              : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
          }`}
        >
          <LayoutTemplate className="w-4 h-4" />
          What Makes Us Different?
        </button>
      </div>

      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* ── Editor column ─────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Background image */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Image className="w-4 h-4 text-gray-400" /> Background Image
            </h3>
            <div className="flex items-start gap-4">
              {/* Thumbnail or placeholder */}
              <div
                className="relative flex-shrink-0 w-24 h-20 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden bg-gray-50 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors group"
                onClick={() => document.getElementById('bg-upload')?.click()}
              >
                {bgImageUrl ? (
                  <>
                    <img src={bgImageUrl} alt="Background" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Upload className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </>
                ) : (
                  uploadingBg ? (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  ) : (
                    <div className="text-center">
                      <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                      <span className="text-[10px] text-gray-400">Upload</span>
                    </div>
                  )
                )}
              </div>
              <input
                id="bg-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBgUpload(f); e.target.value = ''; }}
              />

              <div className="flex-1 space-y-3">
                <p className="text-xs text-gray-500">
                  This image shows behind your content at low opacity — choose a photo that represents your brand or work.
                </p>
                {/* Opacity slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700">Opacity</label>
                    <span className="text-xs text-gray-500">{Math.round(bgOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.35}
                    step={0.01}
                    value={bgOpacity}
                    onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
                    className="w-full accent-[#1e3a5f]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>Subtle (0%)</span>
                    <span>Vivid (35%)</span>
                  </div>
                </div>
                {/* Zoom slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700">Zoom</label>
                    <span className="text-xs text-gray-500">{bgZoom}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={200}
                    step={1}
                    value={bgZoom}
                    onChange={(e) => setBgZoom(parseInt(e.target.value, 10))}
                    className="w-full accent-[#1e3a5f]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>Zoomed out (50%)</span>
                    <span>Zoomed in (200%)</span>
                  </div>
                </div>
                {bgImageUrl && (
                  <button
                    onClick={() => setBgImageUrl('')}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Remove background
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tagline + Mission — About Us only */}
          {pageTemplate === 'about_us' && <>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block font-semibold text-gray-900 mb-2 text-sm">Tagline</label>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Precision. Integrity. Transparency."
              maxLength={120}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">{tagline.length}/120 characters — shown beneath your company name</p>
          </div>

          {/* Mission / About text */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="block font-semibold text-gray-900 text-sm">Mission / About Us</label>
              <button
                onClick={handleGenerateMission}
                disabled={generatingMission}
                className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800 px-2.5 py-1.5 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
              >
                {generatingMission ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generatingMission ? 'Generating…' : '✦ Generate'}
              </button>
            </div>
            <textarea
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              placeholder="Tell customers who you are, what you stand for, and why they should choose you…"
              rows={5}
              maxLength={800}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{mission.length}/800 characters</p>
          </div>
          </>}

          {/* Highlights / Value Pillars */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  {pageTemplate === 'value_pillars' ? 'Value Pillars' : 'Why Clients Choose Us'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {pageTemplate === 'value_pillars'
                    ? 'What sets you apart — drag to reorder. 3–5 pillars recommended.'
                    : 'These appear in the "Why Clients Choose Us" sidebar on your quote cover page and About page. Add up to 6 items.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSuggestHighlights}
                  disabled={generatingHighlights}
                  className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800 px-2.5 py-1.5 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
                >
                  {generatingHighlights ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {generatingHighlights ? 'Generating…' : '✦ Suggest with AI'}
                </button>
                {highlights.length < 6 && (
                  <button
                    onClick={() => setHighlights((prev) => [...prev, { id: uid(), title: '', description: '' }])}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#1e3a5f] hover:text-[#162d4a] px-2.5 py-1.5 border border-[#1e3a5f]/30 rounded-lg hover:bg-[#1e3a5f]/5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add reason
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {highlights.map((h, i) => (
                <div
                  key={h.id}
                  draggable
                  onDragStart={() => handleDragStart(h.id)}
                  onDragOver={(e) => handleDragOver(e, h.id)}
                  onDrop={handleDrop}
                  onDragEnd={() => setDraggingId(null)}
                  className={`flex gap-2 p-3 border rounded-xl transition-all ${draggingId === h.id ? 'opacity-40 scale-95' : 'bg-gray-50 border-gray-200'}`}
                >
                  <div className="flex-shrink-0 flex items-start pt-2 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-5">{String(i + 1).padStart(2, '0')}.</span>
                      <input
                        value={h.title}
                        onChange={(e) => setHighlights((prev) => prev.map((x) => x.id === h.id ? { ...x, title: e.target.value } : x))}
                        placeholder="Title (e.g. Licensed & Insured)"
                        className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    {/* Highlight photo */}
                    <div className="flex items-center gap-2">
                      <input
                        id={`highlight-photo-${h.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleHighlightPhotoUpload(h.id, f); e.target.value = ''; }}
                      />
                      {h.photoUrl ? (
                        <div className="relative group rounded-lg overflow-hidden border border-gray-200 flex-shrink-0" style={{ width: 72, height: 48 }}>
                          <img src={h.photoUrl} alt="Highlight" className="w-full h-full object-cover" />
                          <div
                            className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            onClick={() => document.getElementById(`highlight-photo-${h.id}`)?.click()}
                          >
                            <Upload className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <button
                            onClick={() => setHighlights((prev) => prev.map((x) => x.id === h.id ? { ...x, photoUrl: undefined } : x))}
                            className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => document.getElementById(`highlight-photo-${h.id}`)?.click()}
                          disabled={uploadingHighlightId === h.id}
                          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-[#1e3a5f] border border-dashed border-gray-300 hover:border-[#1e3a5f]/40 rounded-lg px-2.5 py-1.5 transition-colors"
                        >
                          {uploadingHighlightId === h.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Image className="w-3 h-3" />}
                          Add photo
                        </button>
                      )}
                    </div>
                    <textarea
                      value={h.description}
                      onChange={(e) => setHighlights((prev) => prev.map((x) => x.id === h.id ? { ...x, description: e.target.value } : x))}
                      placeholder="Short description (1–2 sentences)"
                      rows={2}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                    />
                  </div>
                  <button
                    onClick={() => setHighlights((prev) => prev.filter((x) => x.id !== h.id))}
                    className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-500 transition-colors self-start mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Our Seamless Process steps — About Us only */}
          {pageTemplate === 'about_us' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Our Seamless Process</h3>
                <p className="text-xs text-gray-400 mt-0.5">5 steps shown on your About page — drag to reorder.</p>
              </div>
              {processSteps.length < 7 && (
                <button
                  onClick={() => setProcessSteps((prev) => [...prev, { id: uid(), title: '', description: '' }])}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#1e3a5f] hover:text-[#162d4a] px-2.5 py-1.5 border border-[#1e3a5f]/30 rounded-lg hover:bg-[#1e3a5f]/5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add step
                </button>
              )}
            </div>
            <div className="space-y-3">
              {processSteps.map((step, i) => (
                <div
                  key={step.id}
                  draggable
                  onDragStart={() => handleProcessDragStart(step.id)}
                  onDragOver={(e) => handleProcessDragOver(e, step.id)}
                  onDrop={handleProcessDrop}
                  onDragEnd={() => setProcessDraggingId(null)}
                  className={`flex gap-2 p-3 border rounded-xl transition-all ${processDraggingId === step.id ? 'opacity-40 scale-95' : 'bg-gray-50 border-gray-200'}`}
                >
                  <div className="flex-shrink-0 flex items-start pt-2 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-5">{String(i + 1).padStart(2, '0')}.</span>
                      <input
                        value={step.title}
                        onChange={(e) => setProcessSteps((prev) => prev.map((x) => x.id === step.id ? { ...x, title: e.target.value } : x))}
                        placeholder="Step title"
                        className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <textarea
                      value={step.description}
                      onChange={(e) => setProcessSteps((prev) => prev.map((x) => x.id === step.id ? { ...x, description: e.target.value } : x))}
                      placeholder="Brief description of this step (1–2 sentences)"
                      rows={2}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                    />
                  </div>
                  <button
                    onClick={() => setProcessSteps((prev) => prev.filter((x) => x.id !== step.id))}
                    className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-500 transition-colors self-start mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Showcase photos — About Us only */}
          {pageTemplate === 'about_us' && <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Showcase Photos</h3>
                <p className="text-xs text-gray-400 mt-0.5">Add 3–8 photos of your best work.</p>
              </div>
              <button
                onClick={() => document.getElementById('showcase-upload')?.click()}
                className="flex items-center gap-1.5 text-xs font-medium text-[#1e3a5f] hover:text-[#162d4a] px-2.5 py-1.5 border border-[#1e3a5f]/30 rounded-lg hover:bg-[#1e3a5f]/5 transition-colors"
                disabled={uploadingShowcase}
              >
                {uploadingShowcase ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload photos
              </button>
              <input
                id="showcase-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files?.length) handleShowcaseUpload(e.target.files); e.target.value = ''; }}
              />
            </div>

            {showcasePhotos.length === 0 ? (
              <div
                onClick={() => document.getElementById('showcase-upload')?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
              >
                <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Click to upload showcase photos</p>
                <p className="text-xs text-gray-300 mt-1">JPG, PNG, WEBP — multiple files OK</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {showcasePhotos.map((p) => (
                  <div key={p.id} className="group relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={p.url} alt={p.caption || 'Showcase'} className="w-full aspect-square object-cover" />
                    <input
                      value={p.caption}
                      onChange={(e) => setShowcasePhotos((prev) => prev.map((x) => x.id === p.id ? { ...x, caption: e.target.value } : x))}
                      placeholder="Caption…"
                      className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1.5 py-1 w-full placeholder-white/60 focus:outline-none"
                    />
                    <button
                      onClick={() => setShowcasePhotos((prev) => prev.filter((x) => x.id !== p.id))}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {/* Add more slot */}
                <div
                  onClick={() => document.getElementById('showcase-upload')?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors bg-gray-50"
                >
                  <Plus className="w-5 h-5 text-gray-300" />
                  <span className="text-[10px] text-gray-300 mt-1">Add more</span>
                </div>
              </div>
            )}
          </div>}
        </div>

        {/* ── Preview column ────────────────────────────────────────────── */}
        {showPreview && (
          <div className="lg:sticky lg:top-6 self-start">
            <div className="mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-500">Live Preview</span>
              <span className="text-xs text-gray-400">(scales with actual content)</span>
            </div>
            <AboutUsPreview
              company={company}
              tagline={tagline}
              mission={mission}
              highlights={highlights}
              showcasePhotos={showcasePhotos}
              bgImageUrl={bgImageUrl}
              bgOpacity={bgOpacity}
              bgZoom={bgZoom}
              pageTemplate={pageTemplate}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AboutUsSettings;
