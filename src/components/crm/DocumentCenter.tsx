import React, { useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import { formatDate, getContactFullName } from '@/lib/crmData';
import {
  FileText,
  Search,
  Upload,
  Download,
  Folder,
  Image,
  File,
  FileSpreadsheet,
  Grid,
  List,
  Filter,
  MoreVertical,
  Eye,
  Trash2,
  Share2,
  Clock,
  User,
  FolderOpen,
} from 'lucide-react';

type ViewMode = 'list' | 'grid';
type DocCategory = 'all' | 'contract' | 'estimate' | 'invoice' | 'photo' | 'insurance' | 'other';

interface DocumentItem {
  id: string;
  name: string;
  type: string;
  category: DocCategory;
  size: string;
  uploadedAt: string;
  uploadedBy: string;
  contactName?: string;
  contactId?: string;
}

export default function DocumentCenter() {
  const { state, dispatch } = useCRM();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocCategory>('all');

  // Gather all documents from contacts
  const allDocuments: DocumentItem[] = state.contacts.flatMap((contact) =>
    (contact.documents || []).map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      category: doc.type as DocCategory,
      size: doc.size,
      uploadedAt: doc.uploadedAt,
      uploadedBy: doc.uploadedBy,
      contactName: getContactFullName(contact),
      contactId: contact.id,
    }))
  );

  // Filter documents
  const filteredDocuments = allDocuments.filter((doc) => {
    const matchesSearch =
      searchQuery === '' ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.contactName && doc.contactName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Sort by upload date (newest first)
  const sortedDocuments = [...filteredDocuments].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'contract':
        return <FileText className="text-blue-500" size={24} />;
      case 'estimate':
        return <FileSpreadsheet className="text-green-500" size={24} />;
      case 'invoice':
        return <FileText className="text-purple-500" size={24} />;
      case 'photo':
        return <Image className="text-amber-500" size={24} />;
      case 'insurance':
        return <FileText className="text-red-500" size={24} />;
      default:
        return <File className="text-gray-500" size={24} />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'contract':
        return 'bg-blue-100 text-blue-800';
      case 'estimate':
        return 'bg-green-100 text-green-800';
      case 'invoice':
        return 'bg-purple-100 text-purple-800';
      case 'photo':
        return 'bg-amber-100 text-amber-800';
      case 'insurance':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const categories = [
    { id: 'all', label: 'All Files', icon: <FolderOpen size={18} /> },
    { id: 'contract', label: 'Contracts', icon: <FileText size={18} /> },
    { id: 'estimate', label: 'Estimates', icon: <FileSpreadsheet size={18} /> },
    { id: 'invoice', label: 'Invoices', icon: <FileText size={18} /> },
    { id: 'photo', label: 'Photos', icon: <Image size={18} /> },
    { id: 'insurance', label: 'Insurance', icon: <FileText size={18} /> },
    { id: 'other', label: 'Other', icon: <File size={18} /> },
  ];

  // Count documents by category
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat.id] =
      cat.id === 'all'
        ? allDocuments.length
        : allDocuments.filter((d) => d.category === cat.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex-shrink-0">
        <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-6">
          <Upload size={18} />
          <span className="font-medium">Upload Files</span>
        </button>

        <nav className="space-y-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id as DocCategory)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                categoryFilter === cat.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {cat.icon}
                <span className="font-medium">{cat.label}</span>
              </div>
              <span className="text-sm text-gray-400">{categoryCounts[cat.id]}</span>
            </button>
          ))}
        </nav>

        {/* Storage Info */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Storage Used</span>
            <span className="text-sm text-gray-500">2.4 GB / 10 GB</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full w-1/4 bg-blue-500 rounded-full" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-6 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {categories.find((c) => c.id === categoryFilter)?.label || 'All Files'}
            </h2>
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
              >
                <List size={18} className={viewMode === 'list' ? 'text-blue-600' : 'text-gray-500'} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
              >
                <Grid size={18} className={viewMode === 'grid' ? 'text-blue-600' : 'text-gray-500'} />
              </button>
            </div>
          </div>

          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {viewMode === 'list' ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Name
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Contact
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Category
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Size
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Uploaded
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {getFileIcon(doc.type)}
                          <span className="font-medium text-gray-900">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {doc.contactName ? (
                          <button
                            onClick={() =>
                              dispatch({ type: 'SELECT_CONTACT', payload: doc.contactId! })
                            }
                            className="text-blue-600 hover:underline"
                          >
                            {doc.contactName}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getCategoryColor(
                            doc.category
                          )}`}
                        >
                          {doc.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{doc.size}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="text-gray-900">{formatDate(doc.uploadedAt)}</p>
                          <p className="text-gray-500">{doc.uploadedBy}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <Eye size={16} className="text-gray-500" />
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <Download size={16} className="text-gray-500" />
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <Share2 size={16} className="text-gray-500" />
                          </button>
                          <button className="p-2 hover:bg-red-100 rounded-lg transition-colors">
                            <Trash2 size={16} className="text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {sortedDocuments.length === 0 && (
                <div className="p-12 text-center">
                  <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No documents found</h3>
                  <p className="text-gray-500">Upload files or adjust your search</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {sortedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer group"
                >
                  <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center mb-3">
                    {getFileIcon(doc.type)}
                  </div>
                  <h4 className="font-medium text-gray-900 truncate text-sm">{doc.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{doc.size}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getCategoryColor(
                        doc.category
                      )}`}
                    >
                      {doc.category}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <Download size={14} className="text-gray-500" />
                      </button>
                      <button className="p-1 hover:bg-red-100 rounded">
                        <Trash2 size={14} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {sortedDocuments.length === 0 && (
                <div className="col-span-full p-12 text-center">
                  <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No documents found</h3>
                  <p className="text-gray-500">Upload files or adjust your search</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
