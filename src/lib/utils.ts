import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format a phone number string as (xxx) xxx-xxxx
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Race a promise against a timeout. Rejects with an Error on timeout. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** 
 * Creates a safety timeout to prevent infinite spinners on mobile saves.
 * Use this pattern in all save operations to ensure UI doesn't hang.
 */
export function createSafetyTimeout(
  setLoadingState: (loading: boolean) => void,
  timeoutMs: number = 30000,
  componentName: string = 'Component'
): number {
  return setTimeout(() => {
    console.error(`${componentName}: Save operation exceeded ${timeoutMs}ms limit, forcing reset`);
    setLoadingState(false);
    toast.error('Save operation timed out. Please try again.');
  }, timeoutMs) as unknown as number;
}

/** 
 * Enhanced error handler for save operations with timeout-specific messaging.
 */
export function handleSaveError(error: unknown, componentName: string = 'Component'): void {
  console.error(`${componentName}: Save failed with error:`, error);
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  
  if (errorMessage.includes('timed out')) {
    toast.error('Save timed out - please check your connection and try again');
  } else if (errorMessage.includes('permission')) {
    toast.error('Permission denied - you may not have access to perform this action');
  } else {
    toast.error(`Save failed: ${errorMessage}`);
  }
}
