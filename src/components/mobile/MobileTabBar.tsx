import { LayoutDashboard, Users, Kanban, Calendar, Menu } from 'lucide-react';
import { useCRM, ViewType } from '@/lib/crmStore';

const tabs: { id: ViewType | 'menu'; label: string; icon: React.ComponentType<{ size: number }> }[] = [
  { id: 'dashboard', label: 'Home',     icon: LayoutDashboard },
  { id: 'contacts',  label: 'Contacts', icon: Users },
  { id: 'pipeline',  label: 'Pipeline', icon: Kanban },
  { id: 'calendar',  label: 'Calendar', icon: Calendar },
  { id: 'menu',      label: 'Menu',     icon: Menu },
];

interface Props {
  onMenuOpen: () => void;
}

export default function MobileTabBar({ onMenuOpen }: Props) {
  const { state, dispatch } = useCRM();

  const handleTap = (id: ViewType | 'menu') => {
    if (id === 'menu') {
      onMenuOpen();
    } else {
      dispatch({ type: 'SET_VIEW', payload: id });
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = id !== 'menu' && state.currentView === id;
          return (
            <button
              key={id}
              onClick={() => handleTap(id)}
              className={`flex flex-col items-center justify-center flex-1 py-2.5 gap-0.5 transition-colors touch-manipulation ${
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
