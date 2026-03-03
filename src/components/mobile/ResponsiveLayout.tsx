import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import Sidebar from '@/components/crm/Sidebar';
import MobileNav from './MobileNav';
import { offlineDB, initializeOfflineDB } from '@/lib/offlineDB';
import { RefreshCw } from 'lucide-react';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
}

export default function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const isMobile = useIsMobile();
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);

  // Initialize offline database on mount
  useEffect(() => {
    const initOffline = async () => {
      const success = await initializeOfflineDB();
      setIsOfflineReady(success);
    };

    initOffline();
  }, []);

  // Pull-to-refresh functionality for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile || window.scrollY > 0) return;
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || window.scrollY > 0 || startY === 0) return;
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY);
    
    if (distance > 0 && distance < 120) {
      setPullDistance(distance);
      e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (!isMobile || pullDistance < 80) {
      setPullDistance(0);
      setStartY(0);
      return;
    }

    setIsRefreshing(true);
    setPullDistance(0);
    setStartY(0);

    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Refresh the page
    window.location.reload();
  };

  // Mobile layout with bottom navigation
  if (isMobile) {
    return (
      <div 
        className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-16 relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        {pullDistance > 0 && (
          <div 
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-blue-600 text-white transition-all duration-200"
            style={{ 
              height: `${Math.min(pullDistance, 80)}px`,
              transform: `translateY(-${Math.max(0, 80 - pullDistance)}px)` 
            }}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <RefreshCw 
                className={`w-4 h-4 ${pullDistance > 60 ? 'animate-spin' : ''}`} 
              />
              {pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
          </div>
        )}

        {/* Refresh loading overlay */}
        {isRefreshing && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white py-2 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm font-medium">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Refreshing...
            </div>
          </div>
        )}

        {/* Mobile header - minimal */}
        <header className={`bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 ${isRefreshing ? 'mt-10' : ''}`}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SC</span>
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                StormCraft
              </span>
            </div>
            
            {/* Connection status indicator */}
            <div className="flex items-center gap-2">
              {!navigator.onLine && (
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Offline Mode"></div>
              )}
              {isOfflineReady && (
                <div className="w-2 h-2 bg-green-500 rounded-full" title="Offline Ready"></div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile content area */}
        <main className="p-4 min-h-[calc(100vh-theme(spacing.16)-theme(spacing.16))]">
          <div className="mx-auto max-w-lg">
            {children}
          </div>
        </main>
        
        {/* Mobile bottom navigation */}
        <MobileNav />
      </div>
    );
  }

  // Desktop layout with sidebar (existing layout)
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="h-full">
          {children}
        </div>
      </main>
    </div>
  );
}