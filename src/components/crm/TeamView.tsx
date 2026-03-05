import React, { useState } from 'react';
import { useCRM, canManageTeam, getAssignableRoles, canModifyMember, canAssignRole } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { TeamMember, formatCurrency, roleLabels, UserRole } from '@/lib/crmData';
import { toast } from 'sonner';
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
} from 'lucide-react';

export default function TeamView() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('sales');
  const [copied, setCopied] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);

  const userRole = state.currentUser?.role || 'sales';
  const canManage = canManageTeam(userRole);
  const assignableRoles = getAssignableRoles(userRole);

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
    console.log('=== INVITE START ===');
    console.log('Assignable roles:', assignableRoles.length);
    console.log('Company ID:', state.companyId);
    console.log('Email:', inviteEmail);
    
    if (assignableRoles.length === 0) {
      toast.error('You do not have permission to invite team members');
      return;
    }

    if (!state.companyId) {
      toast.error('No company linked. Please refresh and try again.');
      return;
    }

    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address.');
      return;
    }

    console.log('=== VALIDATION PASSED ===');
    setIsSendingInvite(true);
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsSendingInvite(false);
      toast.error('Request timed out. Please check your email - the invite may have been sent anyway.');
    }, 30000); // 30 second timeout

    try {
      const token = globalThis.crypto?.randomUUID?.() || `invite-${Date.now()}`;
      
      console.log('Creating invite record...');
      const inviteRecord = await db.createInvite({
        company_id: state.companyId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        invited_by: profile?.id,
        token,
        accepted: false,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (!inviteRecord) {
        clearTimeout(timeoutId);
        toast.error('Failed to create invite record in database');
        return;
      }

      console.log('Invite record created:', inviteRecord);

      // Send email via Supabase Edge Function
      console.log('Sending email via Supabase Edge Function...');
      
      // Get current session to ensure we have auth
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session exists:', !!session);
      console.log('Access token exists:', !!session?.access_token);
      
      if (!session) {
        clearTimeout(timeoutId);
        toast.error('Not authenticated. Please log in again.');
        return;
      }
      
      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          email: inviteEmail.trim().toLowerCase(),
          token,
          companyId: state.companyId,
          role: inviteRole,
          invitedBy: profile?.id,
        },
      });
      
      console.log('Function response:', { emailData, emailError });

      if (emailError) {
        console.error('Email sending failed:', emailError);
        clearTimeout(timeoutId);
        toast.error(`Failed to send invitation email. Check console for details.`);
        return;
      }
      
      console.log('Email sent successfully:', emailData);
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
      setInviteRole('sales');
      clearTimeout(timeoutId);
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      console.error('Failed to send invitation:', error);
      const message = error instanceof Error ? error.message : 'Failed to send invitation';
      toast.error(message);
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
      toast.error('Failed to save team member');
    } finally {
      setIsSavingMember(false);
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
        {canManage && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus size={18} />
              <span className="font-medium">Invite Member</span>
            </button>
          </div>
        )}
      </div>

      {/* Company ID Card */}
      {canManage && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Company ID</p>
              <p className="text-2xl font-mono font-bold mt-1">{companyId}</p>
              <p className="text-slate-400 text-sm mt-2">
                Share this ID with team members to join your organization
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
                    <button
                      onClick={() => handleEditMember(member)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} className="text-gray-500" />
                    </button>
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
                  The invited member will receive an email with instructions to join your team using
                  the company ID: <span className="font-mono font-bold">{companyId}</span>
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
                disabled={!inviteEmail || isSendingInvite}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {isSendingInvite ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Sending...
                  </span>
                ) : (
                  'Send Invitation'
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
    </div>
  );
}
