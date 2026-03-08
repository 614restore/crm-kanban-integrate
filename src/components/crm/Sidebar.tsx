import React, { useCallback, useEffect, useState } from 'react';
import { useCRM, ViewType, canViewFinancials, canManageTeam } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import {
  LayoutDashboard,
  Kanban,
  Users,
  MessageSquare,
  Calendar,
  FileText,
  DollarSign,
  UserCog,
  Zap,
  Settings,
  Bot,
  ChevronLeft,
  ChevronRight,
  Building2,
  LogOut,
  Store,
  Bell,
  FolderKanban,
  Clipboard,
  Package,
  Receipt,
  FilePlus,
  BarChart,
  Shield,
  AlertCircle,
} from 'lucide-react';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  requiresPermission?: 'financials' | 'team';
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'pipeline', label: 'Pipeline', icon: <Kanban size={20} /> },
  { id: 'contacts', label: 'Contacts', icon: <Users size={20} /> },
  { id: 'communications', label: 'Communications', icon: <MessageSquare size={20} /> },
  { id: 'calendar', label: 'Calendar', icon: <Calendar size={20} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={20} /> },
  { id: 'document-templates', label: 'Templates', icon: <FilePlus size={20} /> },
  { id: 'financial', label: 'Financial', icon: <DollarSign size={20} />, requiresPermission: 'financials' },
  { id: 'expenses', label: 'Expenses', icon: <Receipt size={20} /> },
  { id: 'suppliers', label: 'Suppliers', icon: <Store size={20} /> },
  { id: 'estimates', label: 'Estimates', icon: <FileText size={20} /> },
  { id: 'projects', label: 'Projects', icon: <FolderKanban size={20} /> },
  { id: 'crew-schedule', label: 'Crew Schedule', icon: <CalendarClock size={20} /> },
  { id: 'equipment', label: 'Equipment', icon: <Wrench size={20} /> },
  { id: 'work-orders', label: 'Work Orders', icon: <Clipboard size={20} /> },
  { id: 'material-orders', label: 'Material Orders', icon: <Package size={20} /> },
  { id: 'insurance-tracking', label: 'Insurance', icon: <Shield size={20} /> },
  { id: 'supplement-tracking', label: 'Supplements', icon: <AlertCircle size={20} /> },
  { id: 'reports', label: 'Reports', icon: <BarChart size={20} /> },
  { id: 'team', label: 'Team', icon: <UserCog size={20} />, requiresPermission: 'team' },
  { id: 'automations', label: 'Automations', icon: <Zap size={20} /> },
  { id: 'ai-assistant', label: 'AI Assistant', icon: <Bot size={20} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
];

function normalizeCompanyName(rawName?: string | null, email?: string | null): string {
  const trimmed = (rawName || '').trim();
  const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (trimmed && !emailLike.test(trimmed)) {
    return trimmed;
  }

  const source = (email || trimmed || '').trim();
  if (source.includes('@')) {
    const local = source.split('@')[0].replace(/[._-]+/g, ' ').trim();
    if (local) {
      return local
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') + ' Company';
    }
  }

  return 'My Company';
}

export default function Sidebar() {
  const { state, dispatch } = useCRM();
  const { profile, signOut } = useAuth();
  const { currentView, sidebarCollapsed, currentUser } = state;
  const [companyName, setCompanyName] = useState('TrussCTR');
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

  const userRole = (currentUser?.role || profile?.role || 'owner') as any;

  const loadCompanyBrand = useCallback(async () => {
    if (!profile?.company_id) {
      // Don't reset to defaults — keep whatever branding is already loaded.
      // This prevents flicker during token refresh when profile is momentarily stale.
      return;
    }

    try {
      const company = await db.getCompany(profile.company_id);
      if (!company) return;

      setCompanyName(normalizeCompanyName(company.name, company.email));
      setCompanyLogoUrl(company.logo_url || null);
    } catch (error) {
      console.error('Failed to load company branding:', error);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    loadCompanyBrand();
  }, [loadCompanyBrand]);

  useEffect(() => {
    const onCompanyUpdated = () => {
      loadCompanyBrand();
    };

    window.addEventListener('crm-company-updated', onCompanyUpdated);
    return () => window.removeEventListener('crm-company-updated', onCompanyUpdated);
  }, [loadCompanyBrand]);

  const filteredNavItems = navItems.filter((item) => {
    if (item.requiresPermission === 'financials') {
      return canViewFinancials(userRole);
    }
    if (item.requiresPermission === 'team') {
      return canManageTeam(userRole);
    }
    return true;
  });

  const handleNavClick = (viewId: ViewType) => {
    dispatch({ type: 'SET_VIEW', payload: viewId });
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <aside
      className={`${
        sidebarCollapsed ? 'w-16' : 'w-64'
      } bg-slate-900 text-white flex flex-col transition-all duration-300 ease-in-out h-screen sticky top-0`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt="Company logo"
                className="w-8 h-8 rounded-lg object-contain"
                onError={() => setCompanyLogoUrl(null)}
              />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Building2 size={18} className="text-white" />
              </div>
            )}
            <span className="font-bold text-lg truncate">{companyName}</span>
          </div>
        )}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {filteredNavItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  currentView === item.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Notifications */}
      <div className="px-3 mb-2">
        <button
          onClick={() => handleNavClick('calendar')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-slate-300 hover:bg-slate-800 hover:text-white relative`}
          title={sidebarCollapsed ? 'Notifications' : undefined}
        >
          <span className="flex-shrink-0 relative">
            <Bell size={20} />
            {state.notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                {state.notifications.filter(n => !n.read).length > 9 ? '9+' : state.notifications.filter(n => !n.read).length}
              </span>
            )}
          </span>
          {!sidebarCollapsed && (
            <span className="font-medium">Notifications</span>
          )}
          {!sidebarCollapsed && state.notifications.filter(n => !n.read).length > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {state.notifications.filter(n => !n.read).length}
            </span>
          )}
        </button>
      </div>

      {/* Legal Links */}
      {!sidebarCollapsed && (
        <div className="px-3 pb-2 flex flex-wrap gap-x-2 gap-y-1 justify-center">
          <a href="/crm-kanban-integrate/terms" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Terms</a>
          <span className="text-slate-600 text-xs">·</span>
          <a href="/crm-kanban-integrate/privacy" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Privacy</a>
          <span className="text-slate-600 text-xs">·</span>
          <a href="/crm-kanban-integrate/eula" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">EULA</a>
          <span className="text-slate-600 text-xs">·</span>
          <a href="mailto:scopemgr@614restore.com?subject=CONTACT%20TrussCTR" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Support</a>
        </div>
      )}

      {/* User Profile */}
      <div className="border-t border-slate-700 p-3">
        {profile ? (
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.email || 'Profile avatar'}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {profile.first_name?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase() || 'U'}
                {profile.last_name?.[0]?.toUpperCase() || ''}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile.first_name && profile.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : profile.email}
                </p>
                <p className="text-xs text-slate-400 capitalize">{profile.role || 'User'}</p>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : currentUser ? (
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-400 capitalize">{currentUser.role}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
