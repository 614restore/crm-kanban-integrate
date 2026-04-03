import { useEffect, useRef, useCallback } from 'react';

const DEBOUNCE_MS = 1500;

/**
 * Auto-saves form data to localStorage and restores it on mount.
 *
 * Usage:
 *   const { clearDraft } = useFormDraft('work_order', formData, { enabled: !editingRecord });
 *
 * @param key       Unique storage key (e.g. 'work_order_draft_<companyId>')
 * @param data      Current form data to persist
 * @param options   enabled: only auto-save when creating new records (skip edits)
 */
export function useFormDraft<T>(
  key: string,
  data: T,
  options: { enabled: boolean }
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Debounced save on every data change
  useEffect(() => {
    if (!options.enabled) return;
    // Skip the very first render — avoids overwriting a restored draft immediately
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
      } catch {
        // Storage full or private browsing — fail silently
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, data, options.enabled]);

  const loadDraft = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Discard drafts older than 7 days
      if (Date.now() - (parsed.savedAt || 0) > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.data as T;
    } catch {
      return null;
    }
  }, [key]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }, [key]);

  return { loadDraft, clearDraft };
}
