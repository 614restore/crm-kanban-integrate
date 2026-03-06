import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, 
  Users, 
  Calendar, 
  Camera, 
  Menu, 
  BarChart3,
  FileText,
  Upload,
  Wifi,
  WifiOff 
} from 'lucide-react';
import { offlineDB } from '@/lib/offlineDB';
import { useCRM, ViewType } from '@/lib/crmStore';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  color: string;
  badge?: number;
  view?: ViewType;
}

export default function MobileNav() {
  const navigate = useNavigate();
  const { state, dispatch } = useCRM();
  const [photoCount, setPhotoCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showMore, setShowMore] = useState(false);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending photo upload count
  useEffect(() => {
    const loadPhotoCount = async () => {
      try {
        const count = await offlineDB.getPendingUploadsCount();
        setPhotoCount(count);
      } catch (error) {
        console.error('Error loading photo count:', error);
      }
    };

    loadPhotoCount();

    // Update count periodically
    const interval = setInterval(loadPhotoCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const primaryNavItems: NavItem[] = [
    { icon: Home, label: 'Dashboard', path: '/', view: 'dashboard', color: 'text-blue-600' },
    { icon: Users, label: 'Contacts', path: '/', view: 'contacts', color: 'text-green-600' },
    { 
      icon: Camera, label: 'Photos', path: '/photos', color: 'text-purple-600',
      badge: photoCount > 0 ? photoCount : undefined
    },
    { icon: BarChart3, label: 'Pipeline', path: '/', view: 'pipeline', color: 'text-orange-600' },
    { icon: Menu, label: 'More', path: '/more', color: 'text-gray-600' }
  ];

  const secondaryNavItems: NavItem[] = [
    { icon: Calendar, label: 'Calendar', path: '/', view: 'calendar', color: 'text-blue-500' },
    { icon: FileText, label: 'Estimates', path: '/', view: 'estimates', color: 'text-green-500' },
    { icon: BarChart3, label: 'Projects', path: '/', view: 'projects', color: 'text-orange-500' },
    { icon: FileText, label: 'Work Orders', path: '/', view: 'work_orders', color: 'text-purple-500' },
    { icon: Upload, label: 'Documents', path: '/', view: 'documents', color: 'text-indigo-500' },
  ];

  const handleNavigation = (item: NavItem) => {
    if (item.path === '/more') {
      setShowMore(!showMore);
    } else if (item.path === '/photos') {
      navigate('/photos');
      setShowMore(false);
    } else if (item.view) {
      dispatch({ type: 'SET_VIEW', payload: item.view });
      navigate('/');
      setShowMore(false);
    }
  };

  const isActive = (item: NavItem) => {
    if (item.path === '/more') return showMore;
    if (item.path === '/photos') return window.location.pathname === '/photos';
    return item.view === state.currentView;
  };

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowMore(false)}
        >
          <div className="absolute bottom-16 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      active 
                        ? `${item.color} bg-blue-50 dark:bg-blue-900/20 border-blue-200` 
                        : 'text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
            
            {/* Connection status */}
            <div className="flex items-center justify-between text-sm text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-600" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-orange-600" />
                    <span>Offline Mode</span>
                  </>
                )}
              </div>
              {photoCount > 0 && (
                <div className="text-xs text-purple-600">
                  {photoCount} photos pending upload
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 safe-area-pb">
        <div className="flex items-center justify-around px-1 py-2">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = item.path === '/more' ? showMore : isActive(item);
            
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item)}
                className={`relative flex flex-col items-center py-2 px-3 rounded-lg transition-colors min-w-0 flex-1 max-w-[70px] touch-manipulation ${
                  active 
                    ? `${item.color} bg-blue-50 dark:bg-blue-900/20` 
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 mb-1" />
                  
                  {/* Badge for pending uploads */}
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                
                <span className="text-xs font-medium truncate max-w-full">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
        
        {/* Offline indicator bar */}
        {!isOnline && (
          <div className="bg-orange-500 text-white text-center py-1">
            <div className="flex items-center justify-center gap-2 text-xs">
              <WifiOff className="w-3 h-3" />
              <span>Working Offline</span>
              {photoCount > 0 && (
                <span>• {photoCount} photos queued</span>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}