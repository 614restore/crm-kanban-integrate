import React, { useEffect, useState } from 'react';
import { useCRM, ViewType, canViewFinancials, canManageTeam } from '@/lib/crmStore';
import type { BoardType } from '@/lib/crmData';
import { useAuth } from '@/lib/authContext';
import { useCompanyBrand } from '@/lib/useCompanyBrand';
import { useNotificationFeed, type FeedNotification } from '@/hooks/useNotificationFeed';
import NotificationDetailDialog from './NotificationDetailDialog';
import { openNotificationTarget } from '@/lib/notificationNavigation';
import {
  LayoutDashboard,
  Kanban,
  Users,
  MessageSquare,
  Calendar,
  DollarSign,
  UserCog,
  Zap,
  Settings,
  Bot,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  LogOut,
  Store,
  Bell,
  FolderKanban,
  FolderOpen,
  Clipboard,
  Package,
  Receipt,
  Wallet,
  BarChart,
  Shield,
  AlertCircle,
  CalendarClock,
  Wrench,
  BadgeDollarSign,
  TrendingUp,
  ClipboardList,
  FileSignature,
  CloudRain,
} from 'lucide-react';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  requiresPermission?: 'financials' | 'team';
  /**
   * Board links all open the Pipeline view; this picks which board it focuses.
   * Boards are matched by type, not id: each company's boards are seeded with
   * generated ids, so the fixed ids in defaultBoards only exist offline.
   */
  boardType?: BoardType;
}

interface NavSection {
  key: string;
  title?: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    key: 'primary',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
      { id: 'contacts', label: 'Contacts', icon: <Users size={20} /> },
      { id: 'quotes', label: 'Quotes', icon: <FileSignature size={20} /> },
      { id: 'storm-search', label: 'Storm Data', icon: <CloudRain size={20} /> },
      { id: 'calendar', label: 'Calendar', icon: <Calendar size={20} /> },
    ],
  },
  {
    key: 'boards',
    title: 'Boards',
    items: [
      { id: 'pipeline', label: 'Sales Board', icon: <Kanban size={20} />, boardType: 'sales' },
      { id: 'pipeline', label: 'Project Board', icon: <FolderKanban size={20} />, boardType: 'production' },
      { id: 'pipeline', label: 'Financial Board', icon: <DollarSign size={20} />, boardType: 'billing', requiresPermission: 'financials' },
    ],
  },
  {
    key: 'finance',
    title: 'Finance',
    items: [
      { id: 'invoices', label: 'Invoices', icon: <Receipt size={20} />, requiresPermission: 'financials' },
      { id: 'financial', label: 'Financial Overview', icon: <Wallet size={20} />, requiresPermission: 'financials' },
      { id: 'reports', label: 'Reports', icon: <BarChart size={20} /> },
    ],
  },
  {
    key: 'communication',
    title: 'Communication',
    items: [
      { id: 'communications', label: 'Messages', icon: <MessageSquare size={20} /> },
      { id: 'automations', label: 'Automation', icon: <Zap size={20} /> },
    ],
  },
];

// Job tools (work orders, inspections…) also open from inside a job
// record; they stay here so the company-wide lists remain one click away.
// Document templates moved to Settings → Document Templates.
const moreItems: NavItem[] = [
  { id: 'work-orders', label: 'Work Orders', icon: <Clipboard size={20} /> },
  { id: 'material-orders', label: 'Material Orders', icon: <Package size={20} /> },
  { id: 'inspections', label: 'Inspections', icon: <ClipboardList size={20} /> },
  { id: 'documents', label: 'Documents', icon: <FolderOpen size={20} /> },
  { id: 'insurance-tracking', label: 'Insurance', icon: <Shield size={20} /> },
  { id: 'supplement-tracking', label: 'Supplements', icon: <AlertCircle size={20} /> },
  { id: 'crew-schedule', label: 'Crew Schedule', icon: <CalendarClock size={20} /> },
  { id: 'equipment', label: 'Equipment', icon: <Wrench size={20} /> },
  { id: 'suppliers', label: 'Suppliers', icon: <Store size={20} /> },
  { id: 'expenses', label: 'Expenses', icon: <Wallet size={20} /> },
  { id: 'commission-payroll', label: 'Commission Payroll', icon: <BadgeDollarSign size={20} />, requiresPermission: 'financials' },
  { id: 'sales-analytics', label: 'Sales Analytics', icon: <TrendingUp size={20} />, requiresPermission: 'financials' },
  { id: 'team', label: 'Team', icon: <UserCog size={20} />, requiresPermission: 'team' },
  { id: 'ai-assistant', label: 'AI Assistant', icon: <Bot size={20} /> },
];

export default function Sidebar() {
  const { state, dispatch } = useCRM();
  const { profile, signOut } = useAuth();
  const { currentView, sidebarCollapsed, currentUser } = state;
  const { name: companyName, logoUrl: companyLogoUrl } = useCompanyBrand();
  const [showNotifications, setShowNotifications] = useState(false);
  // Same list as the top bar bell, including notifications saved in the database.
  const { items: notificationFeed, unreadCount, markRead, markAllRead } = useNotificationFeed();
  // Clicking opens the whole notification; the list cuts long messages off.
  const [openedNotification, setOpenedNotification] = useState<FeedNotification | null>(null);
  // Track logo load failure so we fall back to the TrussCTR shield without needing a setter
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => { setLogoFailed(false); }, [companyLogoUrl]);

  const userRole = (currentUser?.role || profile?.role || 'owner') as any;

  // Same fallback as useCurrentBoard, so the highlighted board matches what Pipeline shows.
  const selectedBoard = state.boards.find((b) => b.id === state.selectedBoardId) ?? state.boards[0];

  const canSee = (item: NavItem) => {
    if (item.requiresPermission === 'financials' && !canViewFinancials(userRole)) return false;
    if (item.requiresPermission === 'team' && !canManageTeam(userRole)) return false;
    // A board link with no board of that type behind it would select nothing.
    if (item.boardType && !state.boards.some((b) => b.type === item.boardType)) return false;
    return true;
  };

  const isActive = (item: NavItem) =>
    item.boardType
      ? currentView === 'pipeline' && selectedBoard?.type === item.boardType
      : currentView === item.id;

  const visibleMore = moreItems.filter(canSee);
  const activeInMore = visibleMore.some(isActive);
  const [moreOpen, setMoreOpen] = useState(activeInMore);
  // Opening a More screen from elsewhere (e.g. a job record) should reveal where you are.
  useEffect(() => { if (activeInMore) setMoreOpen(true); }, [activeInMore]);

  const handleNavClick = (item: NavItem) => {
    if (item.boardType) {
      const board = state.boards.find((b) => b.type === item.boardType);
      if (board) dispatch({ type: 'SELECT_BOARD', payload: board.id });
    }
    dispatch({ type: 'SET_VIEW', payload: item.id });
  };

  const handleSignOut = async () => { await signOut(); };

  const renderItem = (item: NavItem) => {
    const active = isActive(item);
    return (
      <li key={`${item.id}:${item.boardType ?? ''}`}>
        <button
          onClick={() => handleNavClick(item)}
          aria-current={active ? 'page' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
            active
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
          title={sidebarCollapsed ? item.label : undefined}
        >
          <span className="flex-shrink-0">{item.icon}</span>
          {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
        </button>
      </li>
    );
  };

  return (
    <aside
      className={`${
        sidebarCollapsed ? 'w-16' : 'w-64'
      } bg-slate-900 text-white flex flex-col transition-all duration-300 ease-in-out h-screen sticky top-0 flex-shrink-0`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            {companyLogoUrl && !logoFailed ? (
              <img src={companyLogoUrl} alt="Company logo" className="w-8 h-8 rounded-lg object-contain" onError={() => setLogoFailed(true)} />
            ) : (
              <img src="/trussctr-logo-shield.png" alt="TrussCTR Logo" className="w-8 h-8 object-contain" />
            )}
            <span className="font-bold text-lg truncate">{companyName}</span>
          </div>
        )}
        <button onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })} className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto" aria-label="Main">
        {sections.map((section) => {
          const items = section.items.filter(canSee);
          if (items.length === 0) return null;
          return (
            <div key={section.key} className="mb-4">
              {section.title && (sidebarCollapsed ? (
                <div className="mx-3 mb-2 border-t border-slate-700" aria-hidden="true" />
              ) : (
                <p className="px-5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{section.title}</p>
              ))}
              <ul className="space-y-1 px-2">{items.map(renderItem)}</ul>
            </div>
          );
        })}

        {visibleMore.length > 0 && (
          <div>
            <button
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              className="w-full flex items-center gap-3 px-5 py-2 text-slate-400 hover:text-white transition-colors"
              title={sidebarCollapsed ? 'More' : undefined}
            >
              {sidebarCollapsed ? (
                <MoreHorizontal size={20} />
              ) : (
                <>
                  <span className="text-[11px] font-semibold uppercase tracking-wider">More</span>
                  <ChevronDown size={14} className={`ml-auto transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
            {moreOpen && <ul className="space-y-1 px-2 mt-1">{visibleMore.map(renderItem)}</ul>}
          </div>
        )}
      </nav>

      {/* Settings */}
      <div className="px-3 pt-2 border-t border-slate-700">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'settings' })}
          aria-current={currentView === 'settings' ? 'page' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
            currentView === 'settings'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
          title={sidebarCollapsed ? 'Settings' : undefined}
        >
          <span className="flex-shrink-0"><Settings size={20} /></span>
          {!sidebarCollapsed && <span className="font-medium">Settings</span>}
        </button>
      </div>

      {/* Notifications */}
      <div className="px-3 mb-2 relative">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-slate-300 hover:bg-slate-800 hover:text-white relative"
          title={sidebarCollapsed ? 'Notifications' : undefined}
        >
          <span className="flex-shrink-0 relative">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </span>
          {!sidebarCollapsed && <span className="font-medium">Notifications</span>}
          {!sidebarCollapsed && unreadCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
        {showNotifications && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
            <div className={`absolute bottom-full mb-2 ${sidebarCollapsed ? 'left-full ml-2' : 'left-0'} w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50`}>
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-sm text-blue-600 hover:text-blue-700">Mark all read</button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notificationFeed.length === 0 ? (
                  <div className="p-8 text-center text-gray-500"><Bell size={32} className="mx-auto mb-2 opacity-50" /><p>No notifications</p></div>
                ) : (
                  notificationFeed.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => {
                        markRead(notification);
                        setShowNotifications(false);
                        setOpenedNotification(notification);
                      }}
                      className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.read ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                          <p className="text-sm text-gray-500 truncate">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notification.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                        {!notification.read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Legal Links */}
      {!sidebarCollapsed && (
        <div className="px-3 pb-2 flex flex-wrap gap-x-2 gap-y-1 justify-center">
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Terms</a>
          <span className="text-slate-600 text-xs">·</span>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Privacy</a>
          <span className="text-slate-600 text-xs">·</span>
          <a href="/eula" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">EULA</a>
          <span className="text-slate-600 text-xs">·</span>
          <a href="mailto:614restorellc@gmail.com?subject=TrussCTR%20Support" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Support</a>
        </div>
      )}

      {/* User Profile */}
      <div className="border-t border-slate-700 p-3">
        {profile ? (
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.email || 'Profile avatar'} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {profile.first_name?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase() || 'U'}
                {profile.last_name?.[0]?.toUpperCase() || ''}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : profile.email}
                </p>
                <p className="text-xs text-slate-400 capitalize">{profile.role || 'User'}</p>
              </div>
            )}
            <button onClick={handleSignOut} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        ) : currentUser ? (
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-400 capitalize">{currentUser.role}</p>
              </div>
            )}
            <button onClick={handleSignOut} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          // No profile yet, or it failed to load: keep sign-out reachable so
          // nobody is stuck in a half-loaded session with no way out.
          <button
            onClick={handleSignOut}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2 px-2'} py-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors`}
            title="Sign out"
          >
            <LogOut size={16} />
            {!sidebarCollapsed && <span className="text-sm font-medium">Sign out</span>}
          </button>
        )}
      </div>
      <NotificationDetailDialog
        notification={openedNotification}
        onClose={() => setOpenedNotification(null)}
        onOpenTarget={(notification) => {
          setOpenedNotification(null);
          openNotificationTarget(notification, dispatch);
        }}
      />
    </aside>
  );
}
