// Measurement reports already on file for the customer being quoted.
//
// A Roofr or EagleView PDF uploaded to a customer (from their Documents tab, the
// Roofr/EagleView panels, or an earlier quote) is offered in the quote builder's
// import boxes, so the estimator picks it with one click instead of finding and
// uploading it again — or ignores it and uploads a different one.
//
// Nothing is applied automatically: a customer can have several reports (an old
// one, a re-measure, a walls report), and using the wrong one prices the job wrong.
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { db, type DbDocument } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { getDocumentSignedUrl, uploadDocument, formatFileSize } from '@/lib/storage';

export type MeasurementKind = 'roof' | 'walls' | 'solar';

const KIND_PATTERN: Record<MeasurementKind, RegExp> = {
  roof: /roofr|eagle\s*view|eagleview|roof|measure/i,
  walls: /wall|siding/i,
  solar: /solar|sunsite|inform\s*advanced/i,
};

const KIND_LABEL: Record<MeasurementKind, string> = {
  roof: 'roof',
  walls: 'siding walls',
  solar: 'solar',
};

const isPdf = (doc: DbDocument) => /\.pdf(\?|$)/i.test(doc.url || '') || /\.pdf$/i.test(doc.name || '');

/** Which measurement report this looks like, judged from its name. */
export function guessMeasurementKind(name: string): MeasurementKind | null {
  if (KIND_PATTERN.walls.test(name)) return 'walls';
  if (KIND_PATTERN.solar.test(name)) return 'solar';
  if (KIND_PATTERN.roof.test(name)) return 'roof';
  return null;
}

const providerOf = (name: string) =>
  /eagle\s*view|eagleview/i.test(name) ? 'EagleView' : /roofr/i.test(name) ? 'Roofr' : null;

/** The file name to hand the parsers, which require it to end in .pdf. */
function fileNameFor(doc: DbDocument): string {
  const fromPath = decodeURIComponent((doc.url || '').split('?')[0].split('/').pop() || '');
  if (/\.pdf$/i.test(fromPath)) return fromPath.replace(/^\d+[-_]/, '') || `${doc.name}.pdf`;
  return /\.pdf$/i.test(doc.name) ? doc.name : `${doc.name}.pdf`;
}

/**
 * Keeps a report the estimator just uploaded in the quote builder with the
 * customer, so it is on file next time. Skips a report that is already there.
 * Never throws: failing to file a copy must not fail the import.
 */
export async function saveMeasurementReportToCustomer(
  file: File,
  companyId: string | null | undefined,
  customerId: string | null | undefined,
): Promise<void> {
  if (!companyId || !customerId) return;
  try {
    const existing = await db.getDocumentsByContact(customerId);
    const baseName = file.name.replace(/\.pdf$/i, '').toLowerCase();
    const already = existing.some(
      (d) => d.name.toLowerCase() === baseName || fileNameFor(d).toLowerCase() === file.name.toLowerCase(),
    );
    if (already) return;

    const uploaded = await uploadDocument(file, companyId, customerId);
    if (uploaded.error || !uploaded.path) return;
    const { data } = await supabase.auth.getUser();
    await db.createDocument({
      company_id: companyId,
      contact_id: customerId,
      name: file.name.replace(/\.pdf$/i, ''),
      type: 'other',
      url: uploaded.path,
      size: formatFileSize(file.size),
      uploaded_by: data?.user?.id,
    });
  } catch (err) {
    console.warn('[StoredMeasurementReports] could not file the report with the customer:', err);
  }
}

interface StoredMeasurementReportsProps {
  customerId?: string | null;
  kind: MeasurementKind;
  /** The report currently loaded in the builder, so its row can say so. */
  currentFileName?: string;
  /** Called with the stored PDF as a File, ready for the same handler an upload uses. */
  onUse: (file: File) => void | Promise<void>;
  disabled?: boolean;
}

export default function StoredMeasurementReports({
  customerId,
  kind,
  currentFileName,
  onUse,
  disabled = false,
}: StoredMeasurementReportsProps) {
  const [docs, setDocs] = useState<DbDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDocs([]);
    if (!customerId) return;
    setLoading(true);
    db.getDocumentsByContact(customerId)
      .then((rows) => {
        if (!cancelled) setDocs(rows.filter(isPdf));
      })
      .catch(() => {
        if (!cancelled) setDocs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  // Reports that look like this kind first; every other PDF stays one click away,
  // since a report is often filed under a name that says nothing about it.
  const { suggested, others } = useMemo(() => {
    const matches = (d: DbDocument) => {
      const guessed = guessMeasurementKind(`${d.name} ${d.url}`);
      return guessed === kind;
    };
    return { suggested: docs.filter(matches), others: docs.filter((d) => !matches(d)) };
  }, [docs, kind]);

  const loadStoredReport = async (doc: DbDocument) => {
    setUsingId(doc.id);
    try {
      const signed = await getDocumentSignedUrl(doc.url);
      if (!signed) throw new Error('Could not open the stored file.');
      const res = await fetch(signed);
      if (!res.ok) throw new Error(`Could not download the stored file (HTTP ${res.status}).`);
      const blob = await res.blob();
      await onUse(new File([blob], fileNameFor(doc), { type: 'application/pdf' }));
    } catch (err: any) {
      toast.error(err?.message || 'Could not load that report.');
    } finally {
      setUsingId(null);
    }
  };

  if (!customerId || (!loading && docs.length === 0)) return null;

  const row = (doc: DbDocument) => {
    const name = fileNameFor(doc);
    const inUse = !!currentFileName && currentFileName.toLowerCase() === name.toLowerCase();
    const provider = providerOf(`${doc.name} ${doc.url}`);
    return (
      <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/80 border border-gray-200 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">
              {doc.name}
              {provider && (
                <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                  {provider}
                </span>
              )}
            </p>
            <p className="text-[11px] text-gray-500">
              {new Date(doc.created_at).toLocaleDateString()}
              {doc.size ? ` · ${doc.size}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={disabled || usingId !== null || inUse}
          onClick={() => loadStoredReport(doc)}
          className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {usingId === doc.id ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </span>
          ) : inUse ? (
            'In use'
          ) : (
            'Use this report'
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-3 space-y-2">
      {loading ? (
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Checking this customer&rsquo;s documents…
        </p>
      ) : (
        <>
          <p className="text-xs font-semibold text-gray-700">
            {suggested.length > 0
              ? `On file for this customer (${KIND_LABEL[kind]}) — use one, or upload a different report`
              : `No ${KIND_LABEL[kind]} report on file for this customer — upload one, or use another PDF they have`}
          </p>
          {suggested.map(row)}
          {others.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowOthers((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                {showOthers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {suggested.length > 0 ? 'Other PDFs' : 'PDFs'} on file ({others.length})
              </button>
              {showOthers && others.map(row)}
            </>
          )}
        </>
      )}
    </div>
  );
}
