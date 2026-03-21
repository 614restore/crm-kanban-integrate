import React, { useState, useEffect } from 'react';
import { useCRM, canManageTeam, getAssignableRoles, canModifyMember, canAssignRole } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { TeamMember, formatCurrency, roleLabels, UserRole } from '@/lib/crmData';
import { toast } from 'sonner';
import PermissionsEditor from '../settings/PermissionsEditor';
import type { PermissionCategory, PermissionLevel } from '@/lib/permissions';
import {
  Search,
  Mail,
  Phone,
  Shield,
  Edit2,
  UserPlus,
  Copy,
  CheckCircle,
  X,
  Save,
  TrendingUp,
  Target,
  DollarSign,
  Loader2,
} from 'lucide-react';

export default function TeamView() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('sales_rep');
  const [copied, setCopied] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);

  const [pendingInvites, setPendingInvites] = useState<Array<{
    id: string; email: string; role: string; created_at: string; expires_at: string; accepted: boolean;
  }>>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);

  const userRole = state.currentUser?.role || profile?.role || 'owner';
  const canManage = canManageTeam(userRole);
  const assignableRoles = getAssignableRoles(userRole);

  useEffect(() => {}, [state.teamMembers, state.companyId, profile]);

  useEffect(() => {
    if (!state.companyId || !canManageTeam(userRole)) return;
    setIsLoadingInvites(true);
    supabase
      .from('invitations')
      .select('id, email, role, created_at, expires_at, accepted')
      .eq('company_id', state.companyId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setPendingInvites(data);
        setIsLoadingInvites(false);
      });
  }, [state.companyId, userRole]);

  const filteredMembers = state.teamMembers.filter((tm) =>
    searchQuery === '' ||
    tm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tm.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tm.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const membersByDepartment = filteredMembers.reduce((acc, tm) => {
    if (!acc[tm.department]) acc[tm.department] = [];
    acc[tm.department].push(tm);
    return acc;
  }, {} as Record<string, TeamMember[]>);

  const companyId = state.companyId || 'No company linked';

  const handleCopyCompanyId = () => {
    if (!state.companyId) return;
    navigator.clipboard.writeText(state.companyId)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch((err) => console.error('Failed to copy company ID:', err));
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

    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address.');
      return;
    }

    setIsSendingInvite(true);

    const timeoutId = setTimeout(() => {
      setIsSendingInvite(false);
      toast.error('Request timed out. Please try again.');
    }, 15000);

    try {
      const token = globalThis.crypto?.randomUUID?.() || `invite-${Date.now()}`;

      const { data: inviteRecord, error: inviteError } = await supabase
        .from('invitations')
        .insert({
          company_id: effectiveCompanyId,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          invited_by: profile?.id,
          token,
          accepted: false,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (inviteError || !inviteRecord) {
        clearTimeout(timeoutId);
        setIsSendingInvite(false);
        toast.error(`Failed to save invite: ${inviteError?.message || 'Unknown error'}`);
        return;
      }

      // Call the Supabase Edge Function directly — works from GitHub Pages, Vercel, anywhere
      const { error: fnError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          email: inviteEmail.trim().toLowerCase(),
          token,
          companyId: effectiveCompanyId,
          role: inviteRole,
          invitedBy: profile?.id,
        },
      });

      if (fnError) {
        clearTimeout(timeoutId);
        toast.error(`Failed to send invitation email: ${fnError.message}`);
        return;
      }

      toast.success(`Invitation email sent to ${inviteEmail}!`);

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: `notif-${Date.now()}`,
          type: 'success',
          title: 'Invitation Sent',
          message: `Invitation email sent to ${inviteEmail}.`,
          timestamp: new Date().toISOString(),
          read: false,
        },
      });

      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('sales_rep');
      clearTimeout(timeoutId);

      const { data } = await supabase
        .from('invitations')
        .select('id, email, role, created_at, expires_at, accepted')
        .eq('company_id', state.companyId)
        .order('created_at', { ascending: false });
      if (data) setPendingInvites(data);
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      console.error('Failed to send invitation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation');
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
    try {
      const [firstName, ...lastParts] = selectedMember.name.trim().split(/\s+/);
      const updated = await db.updateProfile(selectedMember.id, {
        first_name: firstName || '',
        last_name: lastParts.join(' '),
        email: selectedMember.email,
        role: selectedMember.role,
        department: selectedMember.department,
        phone: selectedMember.phone,
        is_active: selectedMember.isActive,
      });

      const { error: rateError } = await supabase
        .from('profiles')
        .update({
          commission_rate_self_gen: selectedMember.commission_rate_self_gen ?? 0,
          commission_rate_company:  selectedMember.commission_rate_company  ?? 0,
          commission_rate_custom:   selectedMember.commission_rate_custom   ?? 0,
        })
        .eq('id', selectedMember.id);

      if (rateError) {
        console.error('Failed to save commission rates:', rateError);
        toast.error('Saved profile but failed to update commission rates');
      }

      if (!updated) { toast.error('Failed to save team member'); return; }

      dispatch({ type: 'UPDATE_TEAM_MEMBER', payload: selectedMember });
      toast.success('Team member updated');
      setShowEditModal(false);
      setSelectedMember(null);
    } catch (error) {
      console.error('Failed to save team member:', error);
      toast.error('Failed to save team member');
    } finally {
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
      const { error } = await supabase
        .from('profiles')
        .update({ custom_permissions: permissions })
        .eq('id', selectedMember.id);

      if (error) {
        if (error.message?.includes('column') && error.message?.includes('custom_permissions')) {
          toast.error('Database not set up yet. Please run the custom_permissions migration in Supabase.');
        } else if (error.message?.includes('permission') || error.message?.includes('policy')) {
          toast.error('Permission denied. Only owners and admins can modify permissions.');
        } else {
          toast.error(`Failed to save permissions: ${error.message || 'Unknown error'}`);
        }
        return;
      }

      dispatch({ type: 'UPDATE_TEAM_MEMBER', payload: { ...selectedMember, customPermissions: permissions } });
      toast.success('Permissions updated successfully');
      setShowPermissionsModal(false);
      setSelectedMember(null);
    } catch (error: any) {
      toast.error(`Failed to save permissions: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleRevokeInvite = async (inviteId: string, email: string) => {
    if (!confirm(`Revoke invite for ${email}?`)) return;
    const { error } = await supabase.from('invitations').delete().eq('id', inviteId);
    if (error) { toast.error('Failed to revoke invite'); return; }
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    toast.success(`Invite for ${email} revoked`);
  };

  const totalLeads   = state.teamMembers.reduce((s, tm) => s + (tm.performance?.leadsGenerated || 0), 0);
  const totalDeals   = state.teamMembers.reduce((s, tm) => s + (tm.performance?.dealsClosed    || 0), 0);
  const totalRevenue = state.teamMembers.reduce((s, tm) => s + (tm.performance?.revenue        || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team Management</h2>
          <p className="text-gray-500 mt-1">
            {state.teamMembers.length} team members across {Object.keys(membersByDepartment).length} departments
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus size={18} />
            <span className="font-medium">Invite Member</span>
          </button>
        )}
      </div>

      {/* Company ID Card */}
      {canManage && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Company ID</p>
              <p className="text-2xl font-mono font-bold mt-1">{companyId}</p>
              <p className="text-slate-400 text-sm mt-2">Share this ID with team members to join your organization</p>
            </div>
            <button
              onClick={handleCopyCompanyId}
              disabled={!state.companyId}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              {copied ? <><CheckCircle size={18} /> Copied!</> : <><Copy size={18} /> Copy ID</>}
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
              <div key={member.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <img src={member.avatar} alt={member.name} className="w-14 h-14 rounded-full object-cover" />
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
                      <button onClick={() => handleManagePermissions(member)} className="p-2 hover:bg-blue-50 rounded-lg transition-colors group" title="Manage Permissions">
                        <Shield size={16} className="text-gray-500 group-hover:text-blue-600" />
                      </button>
                      <button onClick={() => handleEditMember(member)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Edit Member">
                        <Edit2 size={16} className="text-gray-500" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail size={14} className="text-gray-400" />
                    <a href={`mailto:${member.email}`} className="hover:text-blue-600">{member.email}</a>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone size={14} className="text-gray-400" />
                    <a href={`tel:${member.phone}`} className="hover:text-blue-600">{member.phone}</a>
                  </div>
                </div>
                {member.performance && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-gray-900">{member.performance.leadsGenerated}</p>
                        <p className="text-xs text-gray-500">Leads</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">{member.performance.dealsClosed}</p>
                        <p className="text-xs text-gray-500">Deals</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(member.performance.revenue)}</p>
                        <p className="text-xs text-gray-500">Revenue</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Pending Invites */}
      {canManage && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <Mail size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900">Pending Invites</h3>
            {pendingInvites.filter(i => !i.accepted).length > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                {pendingInvites.filter(i => !i.accepted).length} pending
              </span>
            )}
          </div>
          {isLoadingInvites ? (
            <div className="p-6 text-center text-gray-400 text-sm">Loading invites...</div>
          ) : pendingInvites.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No invites sent yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingInvites.map(invite => {
                const isExpired = new Date(invite.expires_at) < new Date();
                return (
                  <div key={invite.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Mail size={14} className="text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{invite.email}</p>
                        <p className="text-xs text-gray-500 capitalize">{invite.role.replace('_', ' ')} · Sent {new Date(invite.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {invite.accepted ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          <CheckCircle size={12} /> Accepted
                        </span>
                      ) : isExpired ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">Expired</span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Pending</span>
                      )}
                      {!invite.accepted && (
                        <button onClick={() => handleRevokeInvite(invite.id, invite.email)} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors" title="Revoke invite">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Invite Team Member</h2>
              <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
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
                    <option key={value} value={value}>{roleLabels[value]}</option>
                  ))}
                </select>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  The invited member will receive an email with a link to join your team.
                  Company ID: <span className="font-mono font-bold">{companyId}</span>
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowInviteModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium">
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail || isSendingInvite}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {isSendingInvite ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Sending...
                  </span>
                ) : 'Send Invitation'}
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
              <button onClick={() => { setShowEditModal(false); setSelectedMember(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={selectedMember.name} onChange={(e) => setSelectedMember({ ...selectedMember, name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={selectedMember.email} onChange={(e) => setSelectedMember({ ...selectedMember, email: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={selectedMember.phone} onChange={(e) => setSelectedMember({ ...selectedMember, phone: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={selectedMember.role} onChange={(e) => setSelectedMember({ ...selectedMember, role: e.target.value as UserRole })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                  {assignableRoles.map((value) => <option key={value} value={value}>{roleLabels[value]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input type="text" value={selectedMember.department} onChange={(e) => setSelectedMember({ ...selectedMember, department: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
              </div>
              {['owner', 'admin', 'manager', 'sales_manager'].includes(userRole) && (
                <div>
                  <p className="block text-sm font-semibold text-gray-700 mb-2">Commission Rates (%)</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(['commission_rate_self_gen', 'commission_rate_company', 'commission_rate_custom'] as const).map((field, i) => (
                      <div key={field}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{['Self Generated', 'Company Lead', 'Custom / Override'][i]}</label>
                        <input
                          type="number" min="0" max="100" step="0.1"
                          value={selectedMember[field] ?? ''}
                          onChange={(e) => setSelectedMember({ ...selectedMember, [field]: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                          placeholder={['e.g. 10', 'e.g. 5', 'e.g. 7'][i]}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Self Generated = leads they sourced · Company Lead = marketing leads · Custom = special arrangement override</p>
                </div>
              )}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" checked={selectedMember.isActive} onChange={(e) => setSelectedMember({ ...selectedMember, isActive: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active member</label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => { setShowEditModal(false); setSelectedMember(null); }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium">Cancel</button>
              <button onClick={handleSaveMember} disabled={isSavingMember} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50">
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
          onClose={() => { setShowPermissionsModal(false); setSelectedMember(null); }}
        />
      )}
    </div>
  );
}
