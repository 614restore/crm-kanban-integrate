import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchDocumentObjectUrl, resolveDocumentSignedUrl } from '../lib/documentAccess';

type ViewerState = {
  objectUrl: string | null;
  sourceUrl: string | null;
  contentType: string;
  name: string;
  htmlContent: string | null;
};

export default function DocumentViewer() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [documentRecord, setDocumentRecord] = useState<any>(null);
  const [viewerState, setViewerState] = useState<ViewerState>({
    objectUrl: null,
    sourceUrl: null,
    contentType: '',
    name: '',
    htmlContent: null,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const isHtml = useMemo(() => {
    return (
      viewerState.contentType.includes('html') ||
      viewerState.htmlContent !== null ||
      (documentRecord?.html_content && !viewerState.contentType.includes('pdf'))
    );
  }, [documentRecord?.html_content, viewerState.contentType, viewerState.htmlContent]);

  const isPdf = useMemo(() => {
    if (isHtml) return false;
    return (
      viewerState.contentType.includes('pdf') ||
      viewerState.name.toLowerCase().endsWith('.pdf') ||
      documentRecord?.type === 'contract' ||
      documentRecord?.type === 'estimate' ||
      documentRecord?.type === 'invoice'
    );
  }, [isHtml, documentRecord?.type, viewerState.contentType, viewerState.name]);

  const isImage = useMemo(() => {
    return viewerState.contentType.startsWith('image/');
  }, [viewerState.contentType]);

  useEffect(() => {
    return () => {
      if (viewerState.objectUrl) {
        URL.revokeObjectURL(viewerState.objectUrl);
      }
    };
  }, [viewerState.objectUrl]);

  useEffect(() => {
    const loadDocument = async () => {
      if (!documentId) return;

      setLoading(true);
      setErrorMessage('');

      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Document record not found.');
        const record: any = data;
        setDocumentRecord(record);

        // If the record already has html_content, use it directly — no need to fetch storage
        if (record.html_content) {
          setViewerState((current) => {
            if (current.objectUrl) URL.revokeObjectURL(current.objectUrl);
            return {
              objectUrl: null,
              sourceUrl: null,
              contentType: 'text/html',
              name: record.name || 'Document',
              htmlContent: record.html_content,
            };
          });
          return;
        }

        const loaded = await fetchDocumentObjectUrl(record.url);

        // If the fetched file is HTML, read it as text and use srcdoc to avoid
        // browsers rendering the blob as plain text source code.
        let htmlContent: string | null = null;
        if (loaded.blob.type.includes('html')) {
          htmlContent = await loaded.blob.text();
        }

        setViewerState((current) => {
          if (current.objectUrl) {
            URL.revokeObjectURL(current.objectUrl);
          }

          return {
            objectUrl: htmlContent ? null : loaded.objectUrl,
            sourceUrl: loaded.sourceUrl,
            contentType: loaded.blob.type || '',
            name: record.name || 'Document',
            htmlContent,
          };
        });
      } catch (err) {
        console.error('Error loading document viewer:', err);
        setErrorMessage((err as Error)?.message || 'Unable to load this document.');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentId]);

  const handleOpenExternal = async () => {
    try {
      const sourceUrl = viewerState.sourceUrl || (documentRecord?.url ? (await resolveDocumentSignedUrl(documentRecord.url)).signedUrl : null);
      if (!sourceUrl) throw new Error('No document URL available');
      window.open(sourceUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Error opening external document:', err);
      alert('Unable to open the document outside the app.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <nav className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-primary">{viewerState.name || documentRecord?.name || 'Document Viewer'}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Saved Document</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <RefreshCw size={18} />
          </button>
          <button
            type="button"
            onClick={handleOpenExternal}
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <ExternalLink size={18} />
          </button>
        </div>
      </nav>

      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          </div>
        ) : errorMessage ? (
          <div className="mx-auto max-w-md rounded-3xl border border-rose-100 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <FileText size={28} />
            </div>
            <p className="text-base font-bold text-primary">Document unavailable</p>
            <p className="mt-2 text-sm text-slate-500">{errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white"
            >
              Retry
            </button>
          </div>
        ) : (viewerState.objectUrl || viewerState.htmlContent) ? (
          <div className="mx-auto flex h-full max-w-5xl flex-col gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
              {isHtml ? (
                <iframe
                  title={viewerState.name}
                  srcdoc={viewerState.htmlContent ?? documentRecord?.html_content ?? ''}
                  className="h-[78vh] w-full rounded-2xl bg-slate-50"
                  sandbox="allow-same-origin"
                />
              ) : isPdf ? (
                <iframe
                  title={viewerState.name}
                  src={viewerState.objectUrl!}
                  className="h-[78vh] w-full rounded-2xl bg-slate-50"
                />
              ) : isImage ? (
                <div className="flex justify-center rounded-2xl bg-slate-50 p-3">
                  <img
                    src={viewerState.objectUrl}
                    alt={viewerState.name}
                    className="max-h-[78vh] w-auto max-w-full rounded-2xl object-contain"
                  />
                </div>
              ) : (
                <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl bg-slate-50 p-8 text-center">
                  <FileText size={40} className="text-slate-400" />
                  <p className="text-sm text-slate-500">Preview is not available for this file type.</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <a
                href={viewerState.objectUrl ?? (viewerState.htmlContent ? `data:text/html;charset=utf-8,${encodeURIComponent(viewerState.htmlContent)}` : '#')}
                download={viewerState.name}
                className="flex-1 rounded-2xl bg-primary px-4 py-3 text-center text-sm font-bold text-white"
              >
                <span className="inline-flex items-center gap-2">
                  <Download size={16} />
                  Download
                </span>
              </a>
              <button
                type="button"
                onClick={handleOpenExternal}
                className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-bold text-primary"
              >
                Open Outside App
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
