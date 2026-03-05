import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Users2, 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  Eye,
  EyeOff,
  TrendingUp,
  Search,
  Filter,
  MoreHorizontal,
  Building2,
  User,
  Calendar,
  Target,
  AlertCircle,
  CheckCircle,
  Star,
  FileText
} from 'lucide-react';
import { LeadSource } from '../../lib/crmData';
import { usePermissions, withPermission } from '../../lib/permissions/PermissionProvider';

// Remove userRole prop since we'll get it from permission context
type LeadSourceManagementProps = Record<string, never>;

const LeadSourceManagement: React.FC<LeadSourceManagementProps> = () => {
  const { user, hasPermission, canManageResource, isManagerOrHigher } = usePermissions();
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState<LeadSource | null>(null);
  const [formData, setFormData] = useState<Partial<LeadSource>>({});

  // Check if user has permission to add/edit lead sources
  const canManageLeadSources = canManageResource('lead-sources') && isManagerOrHigher();

  useEffect(() => {
    loadLeadSources();
  }, []);

  const loadLeadSources = () => {
    const savedSources = localStorage.getItem('leadSources');
    if (savedSources) {
      setLeadSources(JSON.parse(savedSources));
    } else {
      // Initialize with default lead sources
      const defaultSources: LeadSource[] = [
        {
          id: 'ls1',
          name: 'Door Knock',
          isActive: true,
          isCustom: false,
          createdAt: new Date().toISOString(),
          performance: { totalLeads: 45, convertedLeads: 12, conversionRate: 26.7, lastLeadDate: '2026-03-01' }
        },
        {
          id: 'ls2',
          name: 'Google Ads',
          isActive: true,
          isCustom: false,
          createdAt: new Date().toISOString(),
          contactInfo: {
            repName: 'Sarah Mitchell',
            email: 'sarah@digitalleads.com',
            phone: '(555) 123-4567',
            website: 'https://digitalleads.com'
          },
          performance: { totalLeads: 78, convertedLeads: 23, conversionRate: 29.5, lastLeadDate: '2026-03-02' }
        },
        {
          id: 'ls3',
          name: 'Home Advisor',
          isActive: true,
          isCustom: true,
          createdBy: 'admin',
          createdAt: new Date().toISOString(),
          contactInfo: {
            repName: 'Mike Johnson',
            email: 'mike.johnson@homeadvisor.com',
            phone: '(555) 987-6543',
            website: 'https://homeadvisor.com',
            notes: 'Premium lead provider - $45 per qualified lead'
          },
          performance: { totalLeads: 32, convertedLeads: 18, conversionRate: 56.3, lastLeadDate: '2026-03-03' }
        },
        {
          id: 'ls4',
          name: 'Facebook Ads',
          isActive: false,
          isCustom: true,
          createdBy: 'manager',
          createdAt: new Date().toISOString(),
          contactInfo: {
            repName: 'Jennifer Lee',
            email: 'jennifer@socialmedia.pro',
            phone: '(555) 456-7890'
          },
          performance: { totalLeads: 15, convertedLeads: 3, conversionRate: 20.0, lastLeadDate: '2026-02-28' }
        }
      ];
      setLeadSources(defaultSources);
      localStorage.setItem('leadSources', JSON.stringify(defaultSources));
    }
  };

  const saveLeadSources = (sources: LeadSource[]) => {
    setLeadSources(sources);
    localStorage.setItem('leadSources', JSON.stringify(sources));
  };

  const filteredSources = leadSources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         source.contactInfo?.repName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         source.contactInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'active' && source.isActive) ||
                         (filterStatus === 'inactive' && !source.isActive);
    
    return matchesSearch && matchesFilter;
  });

  const openModal = (source?: LeadSource) => {
    if (!canManageLeadSources) {
      alert('You do not have permission to manage lead sources.');
      return;
    }

    setEditingSource(source || null);
    setFormData(source ? { ...source } : {
      name: '',
      isActive: true,
      isCustom: true,
      contactInfo: {
        repName: '',
        email: '',
        phone: '',
        website: '',
        address: '',
        notes: ''
      }
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.name?.trim()) {
      alert('Please enter a lead source name');
      return;
    }

    const newSource: LeadSource = {
      id: editingSource?.id || `ls_${Date.now()}`,
      name: formData.name.trim(),
      isActive: formData.isActive ?? true,
      isCustom: true,
      createdBy: user?.role.level || 'user',
      createdAt: editingSource?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      contactInfo: formData.contactInfo,
      performance: editingSource?.performance || { totalLeads: 0, convertedLeads: 0, conversionRate: 0 }
    };

    let updatedSources;
    if (editingSource) {
      updatedSources = leadSources.map(source => 
        source.id === editingSource.id ? newSource : source
      );
    } else {
      updatedSources = [...leadSources, newSource];
    }

    saveLeadSources(updatedSources);
    setShowModal(false);
    setEditingSource(null);
    setFormData({});
  };

  const handleDelete = (sourceId: string) => {
    if (!canManageLeadSources) {
      alert('You do not have permission to delete lead sources.');
      return;
    }

    const source = leadSources.find(s => s.id === sourceId);
    if (source && !source.isCustom) {
      alert('Default lead sources cannot be deleted.');
      return;
    }

    if (confirm('Are you sure you want to delete this lead source? This action cannot be undone.')) {
      const updatedSources = leadSources.filter(source => source.id !== sourceId);
      saveLeadSources(updatedSources);
    }
  };

  const toggleStatus = (sourceId: string) => {
    if (!canManageLeadSources) {
      alert('You do not have permission to modify lead sources.');
      return;
    }

    const updatedSources = leadSources.map(source =>
      source.id === sourceId 
        ? { ...source, isActive: !source.isActive, updatedAt: new Date().toISOString() }
        : source
    );
    saveLeadSources(updatedSources);
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? 
      <CheckCircle className="w-4 h-4 text-green-600" /> : 
      <AlertCircle className="w-4 h-4 text-red-600" />;
  };

  const getPerformanceColor = (conversionRate: number) => {
    if (conversionRate >= 40) return 'text-green-600';
    if (conversionRate >= 25) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lead Source Management</h1>
            <p className="text-gray-600">
              Manage your lead sources and track their performance. Add contact information for better relationship management.
            </p>
          </div>
          
          {canManageLeadSources && (
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Lead Source
            </button>
          )}
        </div>

        {!hasPermission('lead-sources', 'read') ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-800">
                You do not have permission to view lead sources. Contact your administrator.
              </span>
            </div>
          </div>
        ) : !canManageLeadSources ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                You have read-only access. Only users with management permissions can add or modify lead sources.
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search lead sources, reps, or emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Sources</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Lead Sources Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredSources.map((source) => (
          <div key={source.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${source.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {getStatusIcon(source.isActive)}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{source.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{source.isCustom ? 'Custom' : 'Default'}</span>
                      {source.isCustom && source.createdBy && (
                        <>
                          <span>•</span>
                          <span className="capitalize">{source.createdBy}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {canManageLeadSources && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openModal(source)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {source.isCustom && (
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => toggleStatus(source.id)}
                      className={`p-2 rounded-md ${
                        source.isActive 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {source.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Contact Information */}
              {source.contactInfo && (
                <div className="mb-4 space-y-2">
                  {source.contactInfo.repName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">{source.contactInfo.repName}</span>
                    </div>
                  )}
                  {source.contactInfo.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a 
                        href={`mailto:${source.contactInfo.email}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {source.contactInfo.email}
                      </a>
                    </div>
                  )}
                  {source.contactInfo.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a 
                        href={`tel:${source.contactInfo.phone}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {source.contactInfo.phone}
                      </a>
                    </div>
                  )}
                  {source.contactInfo.website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <a 
                        href={source.contactInfo.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Visit Website
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Performance Metrics */}
              {source.performance && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Total Leads</div>
                      <div className="font-medium text-gray-900">{source.performance.totalLeads}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Converted</div>
                      <div className="font-medium text-gray-900">{source.performance.convertedLeads}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-gray-500">Conversion Rate</div>
                      <div className={`font-medium ${getPerformanceColor(source.performance.conversionRate)}`}>
                        {source.performance.conversionRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {source.contactInfo?.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <div className="text-xs text-gray-500 mb-1">Notes</div>
                  <div className="text-sm text-gray-700">{source.contactInfo.notes}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredSources.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Lead Sources Found</h3>
          <p className="text-gray-500">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Start by creating your first lead source.'}
          </p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                {editingSource ? 'Edit Lead Source' : 'Add New Lead Source'}
              </h2>

              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lead Source Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Google Ads, Home Advisor"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={formData.isActive ? 'active' : 'inactive'}
                        onChange={(e) => setFormData({...formData, isActive: e.target.value === 'active'})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Representative Name
                      </label>
                      <input
                        type="text"
                        value={formData.contactInfo?.repName || ''}
                        onChange={(e) => setFormData({
                          ...formData, 
                          contactInfo: {...formData.contactInfo, repName: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Contact person name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={formData.contactInfo?.email || ''}
                        onChange={(e) => setFormData({
                          ...formData, 
                          contactInfo: {...formData.contactInfo, email: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="contact@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.contactInfo?.phone || ''}
                        onChange={(e) => setFormData({
                          ...formData, 
                          contactInfo: {...formData.contactInfo, phone: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Website
                      </label>
                      <input
                        type="url"
                        value={formData.contactInfo?.website || ''}
                        onChange={(e) => setFormData({
                          ...formData, 
                          contactInfo: {...formData.contactInfo, website: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://example.com"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      value={formData.contactInfo?.address || ''}
                      onChange={(e) => setFormData({
                        ...formData, 
                        contactInfo: {...formData.contactInfo, address: e.target.value}
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Street address, City, State, ZIP"
                    />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      rows={3}
                      value={formData.contactInfo?.notes || ''}
                      onChange={(e) => setFormData({
                        ...formData, 
                        contactInfo: {...formData.contactInfo, notes: e.target.value}
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Additional notes, pricing info, special terms, etc."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingSource ? 'Update' : 'Create'} Lead Source
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default withPermission(LeadSourceManagement, 'lead-sources', 'read');