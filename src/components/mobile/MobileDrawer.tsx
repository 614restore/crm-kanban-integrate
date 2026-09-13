import { useEffect } from 'react';
import { useCRM, ViewType, canViewFinancials, canManageTeam } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { useCompanyBrand } from '@/lib/useCompanyBrand';
import {
  LayoutDashboard, Kanban, Users, MessageSquare, Calendar, FileText,
  DollarSign, UserCog, Zap, Settings, Bot, Building2, LogOut, Store,
  FolderKanban, Clipboard, Package, Receipt, FilePlus, BarChart, Shield,
  AlertCircle, CalendarClock, Wrench, BadgeDollarSign, TrendingUp, ClipboardList, X,
} from 'lucide-react';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  requiresPermission?: 'financials' | 'team';
  group?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard',           label: 'Dashboard',        icon: <LayoutDashboard size={20} />,  group: 'Main' },
  { id: 'pipeline',            label: 'Pipeline',         icon: <Kanban size={20} />,           group: 'Main' },
  { id: 'contacts',            label: 'Contacts',         icon: <Users size={20} />,            group: 'Main' },
  { id: 'calendar',            label: 'Calendar',         icon: <Calendar size={20} />,         group: 'Main' },
  { id: 'communications',      label: 'Communications',   icon: <MessageSquare size={20} />,    group: 'Main' },
  { id: 'documents',           label: 'Documents',        icon: <FileText size={20} />,         group: 'Operations' },
  { id: 'document-templates',  label: 'Templates',        icon: <FilePlus size={20} />,         group: 'Operations' },
  { id: 'quotes',              label: 'Quotes',           icon: <FileText size={20} />,         group: 'Operations' },
  { id: 'projects',            label: 'Projects',         icon: <FolderKanban size={20} />,     group: 'Operations' },
  { id: 'work-orders',         label: 'Work Orders',      icon: <Clipboard size={20} />,        group: 'Operations' },
  { id: 'crew-schedule',       label: 'Crew Schedule',    icon: <CalendarClock size={20} />,    group: 'Operations' },
  { id: 'inspections',         label: 'Inspections',      icon: <ClipboardList size={20} />,    group: 'Operations' },
  { id: 'equipment',           label: 'Equipment',        icon: <Wrench size={20} />,           group: 'Operations' },
  { id: 'material-orders',     label: 'Material Orders',  icon: <Package size={20} />,          group: 'Operations' },
  { id: 'suppliers',           label: 'Suppliers',        icon: <Store size={20} />,            group: 'Operations' },
  { id: 'insurance-tracking',  label: 'Insurance',        icon: <Shield size={20} />,           group: 'Finance', requiresPermission: 'financials' },
  { id: 'supplement-tracking', label: 'Supplements',      icon: <AlertCircle size={20} />,      group: 'Finance', requiresPermission: 'financials' },
  { id: 'financial',           label: 'Financial',        icon: <DollarSign size={20} />,       group: 'Finance', requiresPermission: 'financials' },
  { id: 'expenses',            label: 'Expenses',         icon: <Receipt size={20} />,          group: 'Finance' },
  { id: 'commission-payroll',  label: 'Payroll',          icon: <BadgeDollarSign size={20} />,  group: 'Finance', requiresPermission: 'financials' },
  { id: 'sales-analytics',     label: 'Sales Analytics',  icon: <TrendingUp size={20} />,       group: 'Finance', requiresPermission: 'financials' },
  { id: 'reports',             label: 'Reports',          icon: <BarChart size={20} />,         group: 'Finance' },
  { id: 'team',                label: 'Team',             icon: <UserCog size={20} />,          group: 'Admin', requiresPermission: 'team' },
  { id: 'automations',         label: 'Automations',      icon: <Zap size={20} />,              group: 'Admin' },
  { id: 'ai-assistant',        label: 'AI Assistant',     icon: <Bot size={20} />,              group: 'Admin' },
  { id: 'settings',            label: 'Settings',         icon: <Settings size={20} />,         group: 'Admin' },
];

const groups = ['Main', 'Operations', 'Finance', 'Admin'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDrawer({ isOpen, onClose }: Props) {
  const { state, dispatch } = useCRM();
  const { profile, signOut } = useAuth();
  const { name: companyName, logoUrl: companyLogoUrl } = useCompanyBrand();
  const userRole = (state.currentUser?.role || profile?.role || 'owner') as any;

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const filtered = navItems.filter(item => {
    if (item.requiresPermission === 'financials') return canViewFinancials(userRole);
    if (item.requiresPermission === 'team') return canManageTeam(userRole);
    return true;
  });

  const handleNav = (id: ViewType) => {
    dispatch({ type: 'SET_VIEW', payload: id });
    onClose();
  };

  const displayName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
    : '';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-slate-900 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            {companyLogoUrl ? (
              <img src={companyLogoUrl} alt="Logo" className="w-9 h-9 rounded-lg object-contain flex-shrink-0" />
            ) : (
              <img src="/trussctr-logo-shield.png" alt="TrussCTR" className="w-9 h-9 object-contain flex-shrink-0" />
            )}
            <span className="font-bold text-white text-base truncate">{companyName || 'TrussCTR'}</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Nav items grouped */}
        <nav className="flex-1 overflow-y-auto py-2">
          {groups.map(group => {
            const items = filtered.filter(i => i.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="mb-1">
                <p className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{group}</p>
                <ul>
                  {items.map(item => {
                    const active = state.currentView === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => handleNav(item.id)}
                          className={`w-full flex items-center gap-3 px-5 py-3 transition-colors ${
                            active
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white active:bg-slate-700'
                          }`}
                        >
                          <span className="flex-shrink-0">{item.icon}</span>
                          <span className="text-sm font-medium">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-700 p-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          <div className="flex items-center gap-3 mb-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {(profile?.first_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{displayName}</p>
              <p className="text-xs text-slate-400 truncate">{profile?.role || 'owner'}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
