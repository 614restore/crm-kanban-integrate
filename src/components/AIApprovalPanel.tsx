import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, Clock, Trash2, Share2 } from 'lucide-react';
import { aiConfigurationManager, AIConfigurationRecord, AIAccessApproval } from '@/lib/aiConfigurationManager';
import { useAuth } from '@/lib/authContext';
import { useCRM } from '@/lib/crmStore';

interface AIApprovalPanelProps {
  companyId: string;
}

export default function AIApprovalPanel({ companyId }: AIApprovalPanelProps) {
  const { profile } = useAuth();
  const { state } = useCRM();
  const [configurations, setConfigurations] = useState<AIConfigurationRecord[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [accessors, setAccessors] = useState<AIAccessApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<'read' | 'write' | 'admin'>('read');

  // Check if user is admin
  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'owner';

  const loadConfigurations = useCallback(async () => {
    setIsLoading(true);
    try {
      const configs = await aiConfigurationManager.getConfigurationsForCompany(companyId);
      setConfigurations(configs);
      if (configs.length > 0 && !selectedConfigId) {
        setSelectedConfigId(configs[0].id);
      }
    } catch (error) {
      toast.error('Failed to load AI configurations');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, selectedConfigId]);

  const loadAccessors = useCallback(async (configId: string) => {
    try {
      const access = await aiConfigurationManager.getConfigurationAccessors(configId);
      setAccessors(access);
    } catch (error) {
      toast.error('Failed to load access permissions');
    }
  }, []);

  useEffect(() => {
    loadConfigurations();
  }, [loadConfigurations]);

  useEffect(() => {
    if (selectedConfigId) {
      loadAccessors(selectedConfigId);
    }
  }, [selectedConfigId, loadAccessors]);

  const handleApproveConfig = async (configId: string) => {
    if (!profile?.email) return;

    setIsApproving(true);
    try {
      const result = await aiConfigurationManager.approveConfiguration(
        configId,
        profile.id,
        companyId
      );

      if (result) {
        toast.success('AI configuration approved!');
        loadConfigurations();
      } else {
        throw new Error('Approval failed');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve configuration');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRevokeConfig = (configId: string) => {
    toast.warning('Are you sure you want to revoke this AI configuration?', {
      action: {
        label: 'Revoke',
        onClick: async () => {
          setIsRevoking(true);
          try {
            const result = await aiConfigurationManager.revokeConfiguration(configId, companyId);
            if (result) {
              toast.success('AI configuration revoked');
              loadConfigurations();
              setSelectedConfigId(null);
            } else {
              throw new Error('Revocation failed');
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to revoke configuration');
          } finally {
            setIsRevoking(false);
          }
        },
      },
      cancel: { label: 'Cancel' },
      duration: 8000,
    });
  };

  const handleGrantAccess = async () => {
    if (!selectedConfigId || !selectedUserId) {
      toast.error('Please select a configuration and user');
      return;
    }

    try {
      const result = await aiConfigurationManager.grantAccess(
        selectedConfigId,
        selectedUserId,
        selectedAccessLevel
      );

      if (result) {
        toast.success(`Access granted with ${selectedAccessLevel} permissions`);
        loadAccessors(selectedConfigId);
        setSelectedUserId('');
      } else {
        throw new Error('Failed to grant access');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to grant access');
    }
  };

  const handleRevokeAccess = (accessId: string, userId: string) => {
    if (!selectedConfigId) return;

    toast.warning('Revoke access for this user?', {
      action: {
        label: 'Revoke',
        onClick: async () => {
          try {
            const result = await aiConfigurationManager.revokeAccess(selectedConfigId, userId);
            if (result) {
              toast.success('Access revoked');
              loadAccessors(selectedConfigId);
            } else {
              throw new Error('Failed to revoke access');
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to revoke access');
          }
        },
      },
      cancel: { label: 'Cancel' },
      duration: 8000,
    });
  };

  if (!isAdmin) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-900">
              Only admins and managers can approve AI configurations.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <div className="text-center py-8 text-gray-600">Loading...</div>;
  }

  const selectedConfig = configurations.find((c) => c.id === selectedConfigId);

  return (
    <div className="space-y-4">
      {/* Pending Approvals */}
      {configurations.some((c) => !c.is_approved) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock size={18} className="text-orange-600" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {configurations
              .filter((c) => !c.is_approved)
              .map((config) => (
                <div key={config.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100">
                  <div>
                    <p className="font-medium text-sm">{config.provider.toUpperCase()}</p>
                    <p className="text-xs text-gray-600">Requested by: {config.user_id}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleApproveConfig(config.id)}
                    disabled={isApproving}
                  >
                    Approve
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Approved Configurations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle size={18} className="text-green-600" />
            AI Configurations
          </CardTitle>
          <CardDescription>Active AI integrations in your organization</CardDescription>
        </CardHeader>
        <CardContent>
          {configurations.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">
              No AI configurations yet. Team members can add their own.
            </p>
          ) : (
            <div className="space-y-2">
              {configurations.map((config) => (
                <button
                  key={config.id}
                  onClick={() => setSelectedConfigId(config.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedConfigId === config.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{config.provider.toUpperCase()} - {config.model}</p>
                      <p className="text-xs text-gray-600">
                        Set up by: {config.user_id} • Used {config.usage_count} times
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {config.is_approved ? (
                        <Badge variant="default" className="bg-green-600">Approved</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">Pending</Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Details and Access Management */}
      {selectedConfig && selectedConfig.is_approved && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Access & Permissions</CardTitle>
            <CardDescription>Manage team member access to this AI configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Configuration Details */}
            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
              <div className="text-sm">
                <span className="text-gray-600">Provider:</span>
                <span className="ml-2 font-medium">{selectedConfig.provider.toUpperCase()}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Model:</span>
                <span className="ml-2 font-medium">{selectedConfig.model}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Enabled Features:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(selectedConfig.features).map(
                    ([feature, enabled]) =>
                      enabled && (
                        <Badge key={feature} variant="secondary">
                          {feature.replace(/([A-Z])/g, ' $1').trim()}
                        </Badge>
                      )
                  )}
                </div>
              </div>
            </div>

            {/* Grant Access */}
            <div className="border-t pt-4">
              <p className="font-medium text-sm mb-3">Grant Team Member Access</p>
              <div className="flex gap-2">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {state.teamMembers
                      ?.filter((member) => !accessors.some((a) => a.user_id === member.id))
                      .map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} ({member.email})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedAccessLevel}
                  onValueChange={(value: 'read' | 'write' | 'admin') => setSelectedAccessLevel(value)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="write">Write</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={handleGrantAccess} size="sm">
                  <Share2 size={16} className="mr-1" />
                  Grant
                </Button>
              </div>
            </div>

            {/* Current Accessors */}
            {accessors.length > 0 && (
              <div className="border-t pt-4">
                <p className="font-medium text-sm mb-3">Current Access</p>
                <div className="space-y-2">
                  {accessors.map((access) => (
                    <div key={access.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <p className="text-sm font-medium">{access.user_id}</p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {access.access_level}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeAccess(access.id, access.user_id)}
                      >
                        <Trash2 size={16} className="text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Revoke Configuration */}
            <div className="border-t pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleRevokeConfig(selectedConfig.id)}
                disabled={isRevoking}
              >
                {isRevoking ? 'Revoking...' : 'Revoke Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
