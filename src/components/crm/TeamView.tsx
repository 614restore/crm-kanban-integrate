import React, { useState, useEffect } from 'react';
import { useCRM, canManageTeam, getAssignableRoles, canModifyMember, canAssignRole } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { TeamMember, formatCurrency, roleLabels, UserRole } from '@/lib/crmData';
import { toast } from 'sonner';
import { withTimeout } from '@/lib/utils';
import PermissionsEditor from '../settings/PermissionsEditor';
import LimitedAccountManager from '@/components/LimitedAccountManager';
import type { PermissionCategory, PermissionLevel } from '@/lib/permissions';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Shield,
  Edit2,
  Trash2,
  MoreVertical,
  UserPlus,
  Copy,
  CheckCircle,
  X,
  Save,
  TrendingUp,
  Target,
  DollarSign,
  Loader2,
  Settings,
  Users2,
} from 'lucide-react';

export default function TeamView() {
  const { state, dispatch } = useCRM();
  const { profile, session } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('sales_rep');
  const [copied, setCopied] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [companyName, setCompanyName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'team' | 'limited'>('team');

  const [pendingInvites, setPendingInvites] = useState<Array<{
    id: string; email: string; role: string; created_at: string; expires_at: string; accepted: boolean;
  }>>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);

  const userRole = state.currentUser?.role || profile?.role || 'owner';
  const canManage = canManageTeam(userRole);
  const assignableRoles = getAssignableRoles(userRole);

  const [subscriptionPlan, setSubscriptionPlan] = useState<string>('trial');
  const [bonusSeats, setBonusSeats] = useState<number>(0);

  const USER_LIMITS: Record<string, number> = {
    starter: 2, pro: 5, business: 15, scale: Infinity, trial: 2,
  };

  // Fetch company plan + bonus seats so the UI reflects the real seat limit
  useEffect(() => {
    const companyId = state.companyId || profile?.company_id;
    if (!companyId) return;
    db.getCompany(companyId)
      .then(c => {
        if (c?.subscription_plan) setSubscriptionPlan(c.subscription_plan);
        if (c?.name) setCompanyName(c.name);
        setBonusSeats((c as any)?.bonus_seats ?? 0);
      })
      .catch(() => {});
  }, [state.companyId, profile?.company_id]);

  const basePlanLimit = USER_LIMITS[subscriptionPlan] ?? 2;
  // Effective limit = plan limit + any bonus seats granted by platform admin
  const planLimit = basePlanLimit === Infinity ? Infinity : basePlanLimit + bonusSeats;
  const activeSeats = state.teamMembers.length;
  // Members are created active straight away (see handleInvite), so no seats are pending.
  const pendingSeats = 0;
  const atSeatLimit = planLimit !== Infinity && (activeSeats + pendingSeats) >= planLimit;

  // Debug logging for team members
  useEffect(() => {
  }, [state.teamMembers, state.companyId, profile]);

  // Filter team members
  const filteredMembers = state.teamMembers.filter((tm) => {
    const matchesSearch =
      searchQuery === '' ||
      tm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tm.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tm.department.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Group by department
  const membersByDepartment = filteredMembers.reduce((acc, tm) => {
    if (!acc[tm.department]) {
      acc[tm.department] = [];
    }
    acc[tm.department].push(tm);
    return acc;
  }, {} as Record<string, TeamMember[]>);

  const companyId = state.companyId || 'No company linked';

  const handleCopyCompanyId = () => {
    if (!state.companyId) return;

    navigator.clipboard.writeText(state.companyId)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((error) => {
        console.error('Failed to copy company ID:', error);
      });
  };

  const handleInvite = async () => {
    
    if (assignableRoles.length === 0) {
      toast.error('You do not have permission to invite team members');
      return;
    }

    const effectiveCompanyId = state.companyId || profile?.company_id;
    if (!effectiveCompanyId) {
      toast.error('No company linked. Please refresh and try again.');
      return;
    }

    if (!inviteName.trim()) {
      toast.error('Please enter their name.');
      return;
    }

    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address.');
      return;
    }

    // Enforce per-plan user limits before sending the invite.
    // Re-fetch company to get the latest plan in case state is stale.
    const companyRow = effectiveCompanyId
      ? await db.getCompany(effectiveCompanyId).catch(() => null)
      : null;
    const plan = companyRow?.subscription_plan ?? subscriptionPlan ?? 'trial';
    const baseLimit = USER_LIMITS[plan] ?? 2;
    const bonus = (companyRow as any)?.bonus_seats ?? bonusSeats ?? 0;
    const limit = baseLimit === Infinity ? Infinity : baseLimit + bonus;

    if (limit !== Infinity && state.teamMembers.length >= limit) {
      const activeCount = state.teamMembers.length;
      toast.error(
        `Your ${plan} plan allows up to ${limit} user${limit === 1 ? '' : 's'} and you have ${activeCount}. ` +
        `Upgrade your plan to add more team members.`
      );
      return;
    }

    setIsSendingInvite(true);
    const name = inviteName.trim();
    const email = inviteEmail.trim().toLowerCase();
    try {
      // As in QuoteMGR, the member is created straight away by create-team-member,
      // which emails them a link to set their own password. The random password
      // below is never shown or sent; the account just needs one until they pick theirs.
      const bytes = new Uint8Array(24);
      globalThis.crypto.getRandomValues(bytes);
      const placeholderPassword = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + 'Aa1!';

      const { data, error } = await withTimeout(
        supabase.functions.invoke('create-team-member', {
          body: {
            company_id: effectiveCompanyId,
            full_name: name,
            email,
            password: placeholderPassword,
            role: inviteRole,
            app_name: 'TrussCTR',
            redirect_to: window.location.origin,
          },
        }),
        20000,
        'Add team member'
      );

      let failure: string | null = (data as any)?.error ?? null;
      if (error) {
        failure = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) failure = body.error;
        } catch { /* keep the generic message */ }
      }
      if (failure) {
        toast.error(`Could not add ${email}: ${failure}`);
        return;
      }

      const dbMembers = await db.getTeamMembers(effectiveCompanyId);
      dispatch({
        type: 'SET_TEAM_MEMBERS',
        payload: dbMembers.map((tm: any) => ({
          id: tm.id,
          name: `${tm.first_name || ''} ${tm.last_name || ''}`.trim() || tm.email,
          email: tm.email,
          role: (tm.role || 'sales') as any,
          avatar: tm.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${tm.first_name || ''} ${tm.last_name || ''}`.trim() || tm.email || 'User')}&background=random`,
          phone: tm.phone || '',
          department: tm.department || 'General',
          isActive: tm.is_active,
          commission_rate: tm.commission_rate,
          commission_rate_self_gen: tm.commission_rate_self_gen,
          commission_rate_company: tm.commission_rate_company,
          commission_rate_custom: tm.commission_rate_custom,
          member_type: tm.member_type,
          subcontractor_company: tm.subcontractor_company,
        })),
      });

      toast.success(`${name} was added. They'll get an email with a link to set their password.`);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: `notif-${Date.now()}`,
          type: 'success',
          title: 'Team member added',
          message: `${name} (${email}) was added and emailed a set-password link.`,
          timestamp: new Date().toISOString(),
          read: false,
          relatedType: 'team',
        },
      });

      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('sales');
    } catch (error: unknown) {
      console.error('Failed to add team member:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add team member');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleEditMember = (member: TeamMember) => {
    if (!canModifyMember(userRole, member.role)) {
      toast.error('You do not have permission to modify this team member');
      return;
    }
    setSelectedMember(member);
    setShowEditModal(true);
  };

  const handleSaveMember = async () => {
    if (!selectedMember) return;

    if (!canModifyMember(userRole, selectedMember.role) || !canAssignRole(userRole, selectedMember.role)) {
      toast.error('You do not have permission to assign this role');
      return;
    }

    // Validate commission rates are within 0–100 before saving
    const rateFields = [
      selectedMember.commission_rate_self_gen ?? 0,
      selectedMember.commission_rate_company  ?? 0,
      selectedMember.commission_rate_custom   ?? 0,
    ];
    if (rateFields.some((r) => r < 0 || r > 100)) {
      toast.error('Commission rates must be between 0% and 100%');
      return;
    }

    setIsSavingMember(true);
    
    // Safety timeout to prevent infinite spinner (30 seconds max)
    const safetyTimeout = setTimeout(() => {
      console.error('TeamView: Save operation exceeded 30 second limit, forcing reset');
      setIsSavingMember(false);
      toast.error('Save operation timed out. Please try again.');
    }, 30000);
    
    try {
      const [firstName, ...lastParts] = selectedMember.name.trim().split(/\s+/);
      const updated = await withTimeout(
        db.updateProfile(selectedMember.id, {
          first_name: firstName || '',
          last_name: lastParts.join(' '),
          email: selectedMember.email,
          role: selectedMember.role,
          department: selectedMember.department,
          phone: selectedMember.phone,
          is_active: selectedMember.isActive,
        }),
        20000,
        'Update team member'
      );

      // Save commission rates separately (not in RPC args)
      await withTimeout(
        supabase
          .from('profiles')
          .update({
            commission_rate_self_gen: selectedMember.commission_rate_self_gen ?? 0,
            commission_rate_company:  selectedMember.commission_rate_company  ?? 0,
            commission_rate_custom:   selectedMember.commission_rate_custom   ?? 0,
          })
          .eq('id', selectedMember.id),
        15000,
        'Update commission rates'
      );

      if (!updated) {
        toast.error('Failed to save team member');
        return;
      }

      dispatch({ type: 'UPDATE_TEAM_MEMBER', payload: selectedMember });
      toast.success('Team member updated');
      setShowEditModal(false);
      setSelectedMember(null);
    } catch (error) {
      console.error('Failed to save team member:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('timed out')) {
        toast.error('Save timed out - please check your connection and try again');
      } else {
        toast.error('Failed to save team member');
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsSavingMember(false);
    }
  };

  const handleManagePermissions = (member: TeamMember) => {
    if (!canModifyMember(userRole, member.role)) {
      toast.error('You do not have permission to modify this team member');
      return;
    }
    setSelectedMember(member);
    setShowPermissionsModal(true);
  };

  const handleSavePermissions = async (permissions: Partial<Record<PermissionCategory, PermissionLevel>>) => {
    if (!selectedMember) return;

    try {
      // Store custom permissions in the database
      const { error } = await supabase
        .from('profiles')
        .update({
          custom_permissions: permissions,
        })
        .eq('id', selectedMember.id);

      if (error) {
        console.error('Failed to save permissions:', error);
        
        // Provide more specific error messages
        if (error.message?.includes('column') && error.message?.includes('custom_permissions')) {
          toast.error('Database not set up yet. Please run the custom_permissions migration in Supabase.');
          console.error('Missing column: Run the SQL migration in supabase/migrations/001_add_custom_permissions.sql');
        } else if (error.message?.includes('permission') || error.message?.includes('policy')) {
          toast.error('Permission denied. Only owners and admins can modify permissions.');
        } else {
          toast.error(`Failed to save permissions: ${error.message || 'Unknown error'}`);
        }
        return;
      }

      // Update local state to reflect the change
      dispatch({
        type: 'UPDATE_TEAM_MEMBER',
        payload: {
          ...selectedMember,
          customPermissions: permissions,
        },
      });

      toast.success('Permissions updated successfully');
      setShowPermissionsModal(false);
      setSelectedMember(null);
    } catch (error: any) {
      console.error('Failed to save permissions:', error);
      toast.error(`Failed to save permissions: ${error?.message || 'Unknown error'}`);
    }
  };

  // Calculate team stats
  const totalLeads = state.teamMembers.reduce(
    (sum, tm) => sum + (tm.performance?.leadsGenerated || 0),
    0
  );
  const totalDeals = state.teamMembers.reduce(
    (sum, tm) => sum + (tm.performance?.dealsClosed || 0),
    0
  );
  const totalRevenue = state.teamMembers.reduce(
    (sum, tm) => sum + (tm.performance?.revenue || 0),
    0
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team Management</h2>
          <p className="text-gray-500 mt-1">
            {state.teamMembers.length} team members across {Object.keys(membersByDepartment).length}{' '}
            departments
          </p>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'team'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users2 className="h-4 w-4" />
            Full Team
          </button>
          <button
            onClick={() => setActiveTab('limited')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'limited'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="h-4 w-4" />
            Limited Access
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'limited' ? (
        canManage ? (
          <LimitedAccountManager 
            companyId={state.companyId || profile?.company_id || ''} 
            currentUserId={profile?.id || ''}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>You don't have permission to manage limited access accounts</p>
          </div>
        )
      ) : (
        <>
          {/* Full Team Content - existing content here */}
          {canManage && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (atSeatLimit) {
                    toast.error(`Your ${subscriptionPlan} plan allows up to ${planLimit} user${planLimit === 1 ? '' : 's'}. Upgrade to add more team members.`);
                    return;
                  }
                  setShowInviteModal(true);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  atSeatLimit
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title={atSeatLimit ? `Plan limit reached (${planLimit} users). Upgrade to add more.` : 'Invite a team member'}
              >
                <UserPlus size={18} />
                <span className="font-medium">
                  {atSeatLimit ? `Seat Limit Reached (${activeSeats + pendingSeats}/${planLimit})` : 'Invite Member'}
                </span>
              </button>
            </div>
          )}

          {/* Company ID Card */}
          {canManage && (
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Company ID</p>
                  <p className="text-2xl font-mono font-bold mt-1">{companyId}</p>
                  <p className="text-slate-400 text-sm mt-2">
                    Your company's ID. Quote it if you contact support.
                  </p>
                </div>
                <button
              onClick={handleCopyCompanyId}
              disabled={!state.companyId}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle size={18} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={18} />
                  Copy ID
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Target className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
              <p className="text-gray-500 text-sm">Total Leads Generated</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalDeals}</p>
              <p className="text-gray-500 text-sm">Total Deals Closed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <DollarSign className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
              <p className="text-gray-500 text-sm">Total Team Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search team members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Team Members by Department */}
      {Object.entries(membersByDepartment).map(([department, members]) => (
        <div key={department}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{department}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900">{member.name}</h4>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium mt-1">
                        <Shield size={12} />
                        {roleLabels[member.role]}
                      </span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleManagePermissions(member)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                        title="Manage Permissions"
                      >
                        <Shield size={16} className="text-gray-500 group-hover:text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleEditMember(member)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit Member"
                      >
                        <Edit2 size={16} className="text-gray-500" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail size={14} className="text-gray-400" />
                    <a href={`mailto:${member.email}`} className="hover:text-blue-600">
                      {member.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone size={14} className="text-gray-400" />
                    <a href={`tel:${member.phone}`} className="hover:text-blue-600">
                      {member.phone}
                    </a>
                  </div>
                </div>

                {member.performance && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          {member.performance.leadsGenerated}
                        </p>
                        <p className="text-xs text-gray-500">Leads</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          {member.performance.dealsClosed}
                        </p>
                        <p className="text-xs text-gray-500">Deals</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(member.performance.revenue)}
                        </p>
                        <p className="text-xs text-gray-500">Revenue</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      member.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Invite Team Member</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="Jordan Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="colleague@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  {assignableRoles.map((value) => (
                    <option key={value} value={value}>
                      {roleLabels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  They're added to your team right away and get an email with a link to set their
                  password and sign in.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || !inviteName.trim() || isSendingInvite}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {isSendingInvite ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Adding...
                  </span>
                ) : (
                  'Add & Email Invite'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Edit Team Member</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedMember(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={selectedMember.name}
                  onChange={(e) =>
                    setSelectedMember({ ...selectedMember, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={selectedMember.email}
                  onChange={(e) =>
                    setSelectedMember({ ...selectedMember, email: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={selectedMember.phone}
                  onChange={(e) =>
                    setSelectedMember({ ...selectedMember, phone: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={selectedMember.role}
                  onChange={(e) =>
                    setSelectedMember({ ...selectedMember, role: e.target.value as UserRole })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  {assignableRoles.map((value) => (
                    <option key={value} value={value}>
                      {roleLabels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={selectedMember.department}
                  onChange={(e) =>
                    setSelectedMember({ ...selectedMember, department: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              {['owner', 'admin', 'manager', 'sales_manager'].includes(userRole) && (
                <div>
                  <p className="block text-sm font-semibold text-gray-700 mb-2">Commission Rates (%)</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Self Generated</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={selectedMember.commission_rate_self_gen ?? ''}
                        onChange={(e) =>
                          setSelectedMember({
                            ...selectedMember,
                            commission_rate_self_gen: e.target.value === '' ? undefined : parseFloat(e.target.value),
                          })
                        }
                        placeholder="e.g. 10"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Company Lead</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={selectedMember.commission_rate_company ?? ''}
                        onChange={(e) =>
                          setSelectedMember({
                            ...selectedMember,
                            commission_rate_company: e.target.value === '' ? undefined : parseFloat(e.target.value),
                          })
                        }
                        placeholder="e.g. 5"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Custom / Override</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={selectedMember.commission_rate_custom ?? ''}
                        onChange={(e) =>
                          setSelectedMember({
                            ...selectedMember,
                            commission_rate_custom: e.target.value === '' ? undefined : parseFloat(e.target.value),
                          })
                        }
                        placeholder="e.g. 7"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Self Generated = leads they sourced themselves &bull; Company Lead = leads from company marketing &bull; Custom = overrides both for special arrangements</p>
                </div>
              )}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={selectedMember.isActive}
                  onChange={(e) =>
                    setSelectedMember({ ...selectedMember, isActive: e.target.checked })
                  }
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Active member
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedMember(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMember}
                disabled={isSavingMember}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {isSavingMember ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedMember && (
        <PermissionsEditor
          userId={selectedMember.id}
          userName={selectedMember.name}
          role={selectedMember.role}
          customPermissions={undefined}
          onSave={handleSavePermissions}
          onClose={() => {
            setShowPermissionsModal(false);
            setSelectedMember(null);
          }}
        />
      )}
        </>
      )}
    </div>
  );
}
