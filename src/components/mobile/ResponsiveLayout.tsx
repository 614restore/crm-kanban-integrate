import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/useMediaQuery';
import Sidebar from '@/components/crm/Sidebar';
import MobileTabBar from './MobileTabBar';
import MobileDrawer from './MobileDrawer';
import { useCompanyBrand } from '@/lib/useCompanyBrand';
import { RefreshCw, Menu } from 'lucide-react';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
}

export default function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef(0);
  const mainRef = useRef<HTMLElement>(null);
  const { name: companyName, logoUrl: companyLogoUrl } = useCompanyBrand();
  const [logoFailed, setLogoFailed] = useState(false);

  // Pull-to-refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    const main = mainRef.current;
    if (main && main.scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const main = mainRef.current;
    if (main && main.scrollTop > 0) return;
    if (!startYRef.current) return;
    const distance = Math.max(0, e.touches[0].clientY - startYRef.current);
    if (distance > 0 && distance < 120) setPullDistance(distance);
  };
  const handleTouchEnd = async () => {
    if (pullDistance < 80) { setPullDistance(0); startYRef.current = 0; return; }
    setIsRefreshing(true);
    setPullDistance(0);
    startYRef.current = 0;
    await queryClient.invalidateQueries();
    setIsRefreshing(false);
  };

  // ── Desktop layout ─────────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-hidden flex flex-col">
          <div className="h-full flex flex-col">{children}</div>
        </main>
      </div>
    );
  }

  // ── Mobile layout ──────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col bg-gray-50 dark:bg-gray-900"
      style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Mobile top header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 h-14 flex-shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          {companyLogoUrl && !logoFailed ? (
            <img
              src={companyLogoUrl}
              alt="Logo"
              className="w-8 h-8 rounded-lg object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <img src="/trussctr-logo-shield.png" alt="TrussCTR" className="w-8 h-8 object-contain" />
          )}
          <span className="text-base font-bold text-gray-900 dark:text-white truncate max-w-[180px]">
            {companyName || 'TrussCTR'}
          </span>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center bg-blue-600 text-white text-sm font-medium gap-2 overflow-hidden flex-shrink-0 transition-all duration-150"
          style={{ height: `${Math.min(pullDistance * 0.6, 48)}px` }}
        >
          <RefreshCw className={`w-4 h-4 ${pullDistance > 80 ? 'animate-spin' : ''}`} />
          {pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}
      {isRefreshing && (
        <div className="flex items-center justify-center bg-blue-600 text-white text-sm font-medium gap-2 py-2 flex-shrink-0">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Refreshing...
        </div>
      )}

      {/* Scrollable content */}
      <main
        ref={mainRef}
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 60px)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="h-full flex flex-col">{children}</div>
      </main>

      {/* Bottom tab bar */}
      <MobileTabBar onMenuOpen={() => setDrawerOpen(true)} />

      {/* Slide-out nav drawer */}
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
