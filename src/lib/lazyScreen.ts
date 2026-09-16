// Screens are loaded on demand, and their file names carry a content hash, so a
// new deployment replaces them. A tab left open from the previous build then asks
// for a file that no longer exists and React throws "Importing a module script
// failed". Reload once to pick up the new build instead of showing the error page.
import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'trussctr-chunk-reload';

const readFlag = (): boolean => {
  try {
    return window.sessionStorage.getItem(RELOAD_FLAG) === '1';
  } catch {
    return false; // Private browsing: just let the error through.
  }
};

const writeFlag = (value: boolean) => {
  try {
    if (value) window.sessionStorage.setItem(RELOAD_FLAG, '1');
    else window.sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // Nothing to do: the reload guard is a nicety, not a requirement.
  }
};

/** True for the errors a browser raises when an on-demand file has gone missing. */
export function isMissingChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|chunkloaderror|loading chunk \d+ failed/i.test(
    message,
  );
}

/** Reloads the page once so a stale tab picks up the current build. */
export function reloadForNewBuild(): boolean {
  if (readFlag()) return false;
  writeFlag(true);
  window.location.reload();
  return true;
}

/** lazy() for a screen, recovering from a deployment that replaced its file. */
export function lazyScreen<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const loaded = await load();
      writeFlag(false);
      return loaded;
    } catch (error) {
      if (isMissingChunkError(error) && reloadForNewBuild()) {
        // The page is reloading; never resolve, so the loading state stays put.
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
