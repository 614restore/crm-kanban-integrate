import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    // Check if window is available (not during SSR)
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Set initial value
    setMatches(mediaQuery.matches);

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

// Predefined breakpoints for convenience
export const useIsMobile = () => useMediaQuery('(max-width: 768px)');
export const useIsTablet = () => useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1025px)');

// Orientation detection
export const useIsLandscape = () => useMediaQuery('(orientation: landscape)');
export const useIsPortrait = () => useMediaQuery('(orientation: portrait)');

// Touch device detection
export const useHasHover = () => useMediaQuery('(hover: hover) and (pointer: fine)');
export const useHasTouch = () => useMediaQuery('(pointer: coarse)');

// Reduced motion preference
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

// Dark mode preference detection
export const usePrefersDark = () => useMediaQuery('(prefers-color-scheme: dark)');

// High DPI display detection
export const useIsHighDPI = () => useMediaQuery('(min-resolution: 2dppx)');

// Network connection type (experimental)
export const useIsSlowConnection = () => {
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const isSlowConnectionType = ['slow-2g', '2g', '3g'].includes(connection?.effectiveType);
      setIsSlowConnection(isSlowConnectionType);

      const handleChange = () => {
        const isSlowConnectionType = ['slow-2g', '2g', '3g'].includes(connection?.effectiveType);
        setIsSlowConnection(isSlowConnectionType);
      };

      connection.addEventListener('change', handleChange);
      return () => connection.removeEventListener('change', handleChange);
    }
  }, []);

  return isSlowConnection;
};