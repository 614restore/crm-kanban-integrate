import React, { useRef, useState, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { formatDate, getContactFullName } from '@/lib/crmData';
import { db } from '@/lib/database';
import { uploadDocument, validateDocumentFile, formatFileSize, getDocumentSignedUrl, isHttpUrl } from '@/lib/storage';
import { toast } from 'sonner';
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
  Eye,
  Trash2,
  Share2,
  FolderOpen,
  Loader2,
  User,
  Camera,
  X,
} from 'lucide-react';

type ViewMode = 'list' | 'grid';
type DocCategory = 'all' | 'contract' | 'estimate' | 'invoice' | 'photo' | 'insurance' | 'other';

interface DocumentItem {
  id: string;
  name: string;
  type: string;
  category: DocCategory;
  url?: string;
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
  const [contactFilter, setContactFilter] = useState<string>('all');
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadCompanyDocuments = async () => {
      if (!state.companyId) {
        setUploadedDocuments([]);
        return;
      }

      const docs = await db.getDocuments(state.companyId);
      const mapped: DocumentItem[] = await Promise.all(docs.map(async (doc) => {
        const linkedContact = state.contacts.find((contact) => contact.id === doc.contact_id);
        const type = (doc.type || 'other') as DocCategory;
        const url = doc.url
          ? (isHttpUrl(doc.url) && !doc.url.includes('/projectceo-documents/')
              ? doc.url
              : (await getDocumentSignedUrl(doc.url)) || undefined)
          : undefined;

        return {
          id: doc.id,
          name: doc.name,
          type,
          category: type,
          url,
          size: doc.size || 'Unknown',
          uploadedAt: doc.created_at,
          uploadedBy: doc.uploaded_by || 'Team member',
          contactName: linkedContact ? getContactFullName(linkedContact) : undefined,
          contactId: doc.contact_id || undefined,
        };
      }));

      setUploadedDocuments(mapped);
    };

    loadCompanyDocuments();
  }, [state.companyId, state.contacts]);

  const inferCategory = (file: File): DocCategory => {
    const fileName = file.name.toLowerCase();
    if (fileName.includes('contract')) return 'contract';
    if (fileName.includes('estimate')) return 'estimate';
    if (fileName.includes('invoice')) return 'invoice';
    if (file.type.startsWith('image/')) return 'photo';
    if (fileName.includes('insurance')) return 'insurance';
    return 'other';
  };

  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>, forceCategory?: DocCategory) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!state.companyId) {
      toast.error('No company selected. Please refresh and sign in again.');
      return;
    }

    const validationError = validateDocumentFile(file, 15);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsUploading(true);
    
    try {
      const uploadResult = await uploadDocument(file, state.companyId);
      
      if (uploadResult.error) {
        console.error('[DocumentCenter] Upload failed:', uploadResult.error);
        toast.error(`Upload failed: ${uploadResult.error}`);
        setIsUploading(false);
        event.target.value = '';
        return;
      }

      const category = forceCategory || inferCategory(file);
      const linkedContactId = contactFilter !== 'all' ? contactFilter : undefined;

      const created = await db.createDocument({
        company_id: state.companyId,
        contact_id: linkedContactId || undefined,
        name: file.name,
        type: category,
        url: uploadResult.path,
        size: formatFileSize(file.size),
        uploaded_by: state.currentUser?.id,
      });

      if (!created) {
        toast.error('File uploaded but failed to save document record');
        setIsUploading(false);
        event.target.value = '';
        return;
      }

      const signedUrl = created.url
        ? (isHttpUrl(created.url) && !created.url.includes('/projectceo-documents/')
            ? created.url
            : (await getDocumentSignedUrl(created.url)) || undefined)
        : undefined;

      const linkedContact = linkedContactId ? state.contacts.find(c => c.id === linkedContactId) : undefined;

      setUploadedDocuments((prev) => [
        {
          id: created.id,
          name: created.name,
          type: created.type,
          category: created.type as DocCategory,
          url: signedUrl,
          size: created.size || formatFileSize(file.size),
          uploadedAt: created.created_at,
          uploadedBy: created.uploaded_by || 'Team member',
          contactName: linkedContact ? getContactFullName(linkedContact) : undefined,
          contactId: linkedContactId,
        },
        ...prev,
      ]);

      toast.success(`${file.name} uploaded successfully!${linkedContact ? ` Linked to ${getContactFullName(linkedContact)}` : ''}`);
    } catch (error) {
      console.error('[DocumentCenter] Document upload error:', error);
      toast.error('Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    const confirmed = window.confirm('Delete this document?');
    if (!confirmed) return;

    const ok = await db.deleteDocument(docId);
    if (!ok) {
      toast.error('Failed to delete document');
      return;
    }

    setUploadedDocuments((prev) => prev.filter((doc) => doc.id !== docId));
    toast.success('Document deleted');
  };

  // Gather all documents from contacts
  const contactDocuments: DocumentItem[] = state.contacts.flatMap((contact) =>
    (contact.documents || []).map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      category: doc.type as DocCategory,
      url: doc.url,
      size: doc.size,
      uploadedAt: doc.uploadedAt,
      uploadedBy: doc.uploadedBy,
      contactName: getContactFullName(contact),
      contactId: contact.id,
    }))
  );

  const allDocuments: DocumentItem[] = [...uploadedDocuments, ...contactDocuments];

  // Filter documents
  const filteredDocuments = allDocuments.filter((doc) => {
    const matchesSearch =
      searchQuery === '' ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.contactName && doc.contactName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    const matchesContact = contactFilter === 'all' || doc.contactId === contactFilter;
    return matchesSearch && matchesCategory && matchesContact;
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

  const resolveDocumentUrl = async (url?: string): Promise<string | null> => {
    if (!url) return null;
    
    // If it's already a signed URL (contains token), return it directly
    if (isHttpUrl(url) && (url.includes('token=') || url.includes('/sign/'))) {
      return url;
    }
    
    // If it's an external HTTP URL (not from our storage), return it directly
    if (isHttpUrl(url) && !url.includes('/projectceo-documents/')) return url;
    
    const signedUrl = await getDocumentSignedUrl(url);
    
    if (!signedUrl) {
      console.error('[DocumentCenter] Failed to create signed URL');
    }
    
    return signedUrl;
  };

  const handleOpenDocument = async (url?: string) => {
    const resolved = await resolveDocumentUrl(url);
    if (!resolved) {
      console.error('[DocumentCenter] Failed to resolve document URL');
      console.error('[DocumentCenter] Check browser console for detailed [Storage] logs above');
      toast.error('Unable to open document. Check console for details or verify Supabase bucket setup.');
      return;
    }
    window.open(resolved, '_blank', 'noopener,noreferrer');
  };

  const handleCopyDocumentLink = async (url?: string) => {
    const resolved = await resolveDocumentUrl(url);
    if (!resolved) {
      toast.error('Unable to copy link. The file may not exist or you may not have permission.');
      return;
    }

    try {
      await navigator.clipboard.writeText(resolved);
      toast.success('Document link copied to clipboard');
    } catch (error) {
      console.error('[DocumentCenter] Failed to copy document link:', error);
      toast.error('Unable to copy link to clipboard');
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
    <>
    <div className="h-full flex">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleUploadFile}
        disabled={isUploading}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleUploadFile(e, 'photo')}
        disabled={isUploading}
      />

      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex-shrink-0 overflow-y-auto">
        {/* Customer Filter */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Customer</label>
          <div className="relative">
            <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
            >
              <option value="all">All Customers</option>
              {state.contacts.map((c) => (
                <option key={c.id} value={c.id}>{getContactFullName(c)}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          <span className="font-medium text-sm">{isUploading ? 'Uploading...' : 'Upload File'}</span>
        </button>
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors mb-5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera size={16} />
          <span className="font-medium text-sm">Upload Photo</span>
        </button>
        {contactFilter !== 'all' && (
          <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center justify-between">
            <span>Files linked to: <strong>{getContactFullName(state.contacts.find(c => c.id === contactFilter)!)}</strong></span>
            <button onClick={() => setContactFilter('all')}><X size={12} /></button>
          </div>
        )}

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
        <div className="mt-8 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 text-center">
          {allDocuments.length} file{allDocuments.length !== 1 ? 's' : ''} stored
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
                          <button
                            onClick={() => handleOpenDocument(doc.url)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Eye
                              size={16}
                              className="text-gray-500"
                            />
                          </button>
                          <button
                            onClick={() => handleOpenDocument(doc.url)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Download size={16} className="text-gray-500" />
                          </button>
                          <button
                            onClick={() => handleCopyDocumentLink(doc.url)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Share2 size={16} className="text-gray-500" />
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          >
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
                  <div
                    onClick={() => doc.category === 'photo' && doc.url ? setLightboxUrl(doc.url) : handleOpenDocument(doc.url)}
                    className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center mb-3 overflow-hidden"
                  >
                    {doc.category === 'photo' && doc.url ? (
                      <img src={doc.url} alt={doc.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      getFileIcon(doc.type)
                    )}
                  </div>
                  <h4 className="font-medium text-gray-900 truncate text-sm">{doc.name}</h4>
                  {doc.contactName && (
                    <p className="text-xs text-blue-600 mt-0.5 truncate">{doc.contactName}</p>
                  )}
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
                      <button
                        onClick={() => handleOpenDocument(doc.url)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Download size={14} className="text-gray-500" />
                      </button>
                      <button onClick={() => handleDeleteDocument(doc.id)} className="p-1 hover:bg-red-100 rounded">
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

    {/* Photo Lightbox */}
    {lightboxUrl && (
      <div
        className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
        onClick={() => setLightboxUrl(null)}
      >
        <button
          className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
          onClick={() => setLightboxUrl(null)}
        >
          <X size={28} />
        </button>
        <img
          src={lightboxUrl}
          alt="Photo"
          className="max-w-full max-h-full object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    </>
  );
}
