import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/crm/Sidebar';
import { RefreshCw } from 'lucide-react';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
}

export default function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

  // Pull-to-refresh on the main content area
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
    if (distance > 0 && distance < 120) {
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance < 80) {
      setPullDistance(0);
      startYRef.current = 0;
      return;
    }
    setIsRefreshing(true);
    setPullDistance(0);
    startYRef.current = 0;
    await queryClient.invalidateQueries();
    setIsRefreshing(false);
  };

  return (
    <div className="flex bg-gray-50 dark:bg-gray-900" style={{ height: '100dvh' }}>
      <Sidebar />

      <main
        ref={mainRef}
        className="flex-1 min-w-0 overflow-y-auto flex flex-col relative"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        {pullDistance > 0 && (
          <div
            className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center bg-blue-600 text-white transition-all duration-200 pointer-events-none"
            style={{ height: `${Math.min(pullDistance, 60)}px` }}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <RefreshCw className={`w-4 h-4 ${pullDistance > 60 ? 'animate-spin' : ''}`} />
              {pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
          </div>
        )}

        {isRefreshing && (
          <div className="sticky top-0 z-50 bg-blue-600 text-white py-2 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm font-medium">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Refreshing...
            </div>
          </div>
        )}

        <div className="h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
