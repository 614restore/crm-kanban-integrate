import React, { useState, useEffect } from 'react';
import { Plus, Clock, Users, Eye, EyeOff, Calendar, AlertCircle, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useCRM } from '@/lib/crmStore';
import * as db from '@/lib/database';
import { toLocalDateString } from '@/lib/dates';

interface LimitedAccount {
  id: string;
  email: string;
  full_name: string;
  role: 'canvasser' | 'field_contractor';
  is_active: boolean;
  account_expires_at?: string;
  status: 'active' | 'inactive' | 'expired' | 'expiring_soon';
  assigned_customers_count: number;
  created_at: string;
  created_by_name?: string;
}

interface LimitedAccountManagerProps {
  companyId: string;
  currentUserId: string;
}

export default function LimitedAccountManager({ companyId, currentUserId }: LimitedAccountManagerProps) {
  const { state } = useCRM();
  const [accounts, setAccounts] = useState<LimitedAccount[]>([]);
  const [seatUsage, setSeatUsage] = useState({ total: 5, used: 0, available: 5 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Create account form
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'canvasser' | 'field_contractor'>('canvasser');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');

  // Customer assignment modal
  const [selectedAccount, setSelectedAccount] = useState<LimitedAccount | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  useEffect(() => {
    loadLimitedAccounts();
    loadSeatUsage();
  }, [companyId]);

  const loadLimitedAccounts = async () => {
    try {
      const data = await db.getLimitedAccounts(companyId);
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load limited accounts:', error);
      toast.error('Failed to load limited accounts');
    }
  };

  const loadSeatUsage = async () => {
    try {
      const usage = await db.getLimitedSeatUsage(companyId);
      setSeatUsage(usage);
    } catch (error) {
      console.error('Failed to load seat usage:', error);
    }
  };

  const generateRandomPassword = () => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPassword(password);
  };

  const handleCreateAccount = async () => {
    if (!email || !firstName || !password || !role) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (seatUsage.available === 0) {
      toast.error('No available limited permission seats');
      return;
    }

    setLoading(true);
    try {
      const result = await db.createDirectAccount({
        email: email.trim().toLowerCase(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role,
        company_id: companyId,
        expires_at: expiresAt || undefined,
        created_by: currentUserId
      });

      if (result.success) {
        toast.success(`Account created successfully! Credentials: ${email} / ${password}`);
        setShowCreateModal(false);
        resetForm();
        await loadLimitedAccounts();
        await loadSeatUsage();
      } else {
        toast.error(result.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('Failed to create account:', error);
      toast.error('Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setRole('canvasser');
    setPassword('');
    setExpiresAt('');
  };

  const handleToggleActive = async (accountId: string, newStatus: boolean) => {
    try {
      await db.updateLimitedAccount(accountId, { is_active: newStatus });
      toast.success(`Account ${newStatus ? 'activated' : 'deactivated'}`);
      await loadLimitedAccounts();
      await loadSeatUsage();
    } catch (error) {
      console.error('Failed to update account status:', error);
      toast.error('Failed to update account status');
    }
  };

  const handleExtendExpiry = async (accountId: string) => {
    const newExpiry = new Date();
    newExpiry.setMonth(newExpiry.getMonth() + 3); // Extend by 3 months
    
    try {
      await db.updateLimitedAccount(accountId, { 
        account_expires_at: newExpiry.toISOString() 
      });
      toast.success('Account extended by 3 months');
      await loadLimitedAccounts();
    } catch (error) {
      console.error('Failed to extend account:', error);
      toast.error('Failed to extend account');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
      case 'expiring_soon':
        return <Badge className="bg-yellow-100 text-yellow-800">Expiring Soon</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'canvasser':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Canvasser</Badge>;
      case 'field_contractor':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700">Field Contractor</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Seat Usage Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Limited Permission Seats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold">
                {seatUsage.used} / {seatUsage.total}
              </div>
              <div className="text-sm text-gray-600">
                {seatUsage.available} seats available
              </div>
            </div>
            
            <Button
              onClick={() => setShowCreateModal(true)}
              disabled={seatUsage.available === 0}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Limited Account
            </Button>
          </div>

          {seatUsage.available === 0 && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800 text-sm">
                <AlertCircle className="h-4 w-4" />
                All limited permission seats are in use. Deactivate an account to free up a seat.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Limited Accounts List */}
      <Card>
        <CardHeader>
          <CardTitle>Limited Permission Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No limited permission accounts created yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{account.full_name}</h4>
                        {getRoleBadge(account.role)}
                        {getStatusBadge(account.status)}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Email:</span>
                          <div>{account.email}</div>
                        </div>
                        
                        <div>
                          <span className="font-medium">Expires:</span>
                          <div>{formatDate(account.account_expires_at)}</div>
                        </div>
                        
                        <div>
                          <span className="font-medium">Created:</span>
                          <div>{formatDate(account.created_at)}</div>
                        </div>

                        {account.role === 'field_contractor' && (
                          <div>
                            <span className="font-medium">Assigned Customers:</span>
                            <div>{account.assigned_customers_count}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Active/Inactive Toggle */}
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`active-${account.id}`} className="text-sm">
                          {account.is_active ? 'Active' : 'Inactive'}
                        </Label>
                        <Switch
                          id={`active-${account.id}`}
                          checked={account.is_active}
                          onCheckedChange={(checked) => handleToggleActive(account.id, checked)}
                        />
                      </div>

                      {/* Extend Expiry Button */}
                      {account.status === 'expiring_soon' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExtendExpiry(account.id)}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Extend
                        </Button>
                      )}

                      {/* Assign Customers Button */}
                      {account.role === 'field_contractor' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAccount(account);
                            setShowAssignmentModal(true);
                          }}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Assign Customers
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Limited Account</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john.doe@example.com"
                />
              </div>

              <div>
                <Label htmlFor="role">Role *</Label>
                <Select value={role} onValueChange={(value: 'canvasser' | 'field_contractor') => setRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="canvasser">Canvasser - Add leads, schedule inspections</SelectItem>
                    <SelectItem value="field_contractor">Field Contractor - Assigned customers only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="password">Password *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateRandomPassword}
                  >
                    Generate
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="expiresAt">Expiration Date (Optional)</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={toLocalDateString()}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Leave empty for no expiration
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreateAccount}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Creating...' : 'Create Account'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Assignment Modal */}
      {showAssignmentModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Assign Customers to {selectedAccount.full_name}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAssignmentModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select which customers this field contractor can access. They will only see assigned customers in their dashboard.
              </p>

              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {state.contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`contact-${contact.id}`}
                      checked={selectedCustomers.includes(contact.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCustomers([...selectedCustomers, contact.id]);
                        } else {
                          setSelectedCustomers(selectedCustomers.filter(id => id !== contact.id));
                        }
                      }}
                    />
                    <Label
                      htmlFor={`contact-${contact.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {contact.firstName} {contact.lastName} - {contact.address}
                    </Label>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    // TODO: Implement customer assignment
                    toast.success('Customer assignments updated');
                    setShowAssignmentModal(false);
                  }}
                  className="flex-1"
                >
                  Save Assignments
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAssignmentModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}