import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Download, 
  Eye, 
  Edit3, 
  Trash2, 
  Copy,
  Search,
  Filter,
  Upload,
  FolderPlus,
  Star,
  Clock,
  User,
  Send,
  PrinterIcon,
  Share2,
  FileCode,
  Mail,
  Phone,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
  MoreHorizontal
} from 'lucide-react';

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'contract' | 'estimate' | 'invoice' | 'proposal' | 'form' | 'letter';
  fileType: 'pdf' | 'docx' | 'html';
  content: string;
  fields: TemplateField[];
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  isDefault: boolean;
  tags: string[];
}

interface TemplateField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'address' | 'currency' | 'boolean';
  label: string;
  placeholder?: string;
  required: boolean;
  defaultValue?: string;
}

interface GeneratedDocument {
  id: string;
  templateId: string;
  templateName: string;
  title: string;
  contactId?: string;
  contactName?: string;
  projectId?: string;
  projectName?: string;
  content: string;
  data: Record<string, any>;
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'completed';
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;
  fileUrl?: string;
}

const DocumentManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'templates' | 'documents' | 'library'>('templates');
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<GeneratedDocument | null>(null);

  useEffect(() => {
    loadDocumentData();
  }, []);

  const loadDocumentData = () => {
    // Load templates and documents from localStorage
    const savedTemplates = localStorage.getItem('documentTemplates');
    const savedDocuments = localStorage.getItem('generatedDocuments');

    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates));
    } else {
      // Initialize with default templates
      const defaultTemplates: DocumentTemplate[] = [
        {
          id: '1',
          name: 'Roofing Contract Agreement',
          description: 'Standard roofing work contract with terms and conditions',
          category: 'contract',
          fileType: 'pdf',
          content: contractTemplate,
          fields: contractFields,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 15,
          isDefault: true,
          tags: ['contract', 'roofing', 'agreement']
        },
        {
          id: '2',
          name: 'Project Estimate Template',
          description: 'Detailed estimate with materials and labor breakdown',
          category: 'estimate',
          fileType: 'pdf',
          content: estimateTemplate,
          fields: estimateFields,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 32,
          isDefault: true,
          tags: ['estimate', 'pricing', 'materials']
        },
        {
          id: '3',
          name: 'Service Proposal',
          description: 'Professional proposal for roofing services',
          category: 'proposal',
          fileType: 'pdf',
          content: proposalTemplate,
          fields: proposalFields,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 8,
          isDefault: true,
          tags: ['proposal', 'service', 'professional']
        }
      ];
      setTemplates(defaultTemplates);
      localStorage.setItem('documentTemplates', JSON.stringify(defaultTemplates));
    }

    if (savedDocuments) {
      setDocuments(JSON.parse(savedDocuments));
    }
  };

  const categories = [
    { id: 'all', label: 'All Categories', icon: FileText },
    { id: 'contract', label: 'Contracts', icon: FileCode },
    { id: 'estimate', label: 'Estimates', icon: DollarSign },
    { id: 'invoice', label: 'Invoices', icon: FileText },
    { id: 'proposal', label: 'Proposals', icon: Star },
    { id: 'form', label: 'Forms', icon: FileText },
    { id: 'letter', label: 'Letters', icon: Mail }
  ];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const filteredDocuments = documents.filter(doc => {
    return doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           doc.templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (doc.contactName && doc.contactName.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const generateDocument = (template: DocumentTemplate, data: Record<string, any>) => {
    const newDocument: GeneratedDocument = {
      id: crypto.randomUUID(),
      templateId: template.id,
      templateName: template.name,
      title: `${template.name} - ${data.customerName || 'Unknown'}`,
      contactId: data.contactId,
      contactName: data.customerName,
      projectId: data.projectId,
      projectName: data.projectName,
      content: fillTemplate(template.content, data),
      data,
      status: 'draft',
      createdAt: new Date().toISOString()
    };

    const updatedDocuments = [...documents, newDocument];
    setDocuments(updatedDocuments);
    localStorage.setItem('generatedDocuments', JSON.stringify(updatedDocuments));
    
    // Update template usage count
    const updatedTemplates = templates.map(t => 
      t.id === template.id ? { ...t, usageCount: t.usageCount + 1 } : t
    );
    setTemplates(updatedTemplates);
    localStorage.setItem('documentTemplates', JSON.stringify(updatedTemplates));

    return newDocument;
  };

  const fillTemplate = (template: string, data: Record<string, any>): string => {
    let result = template;
    
    // Replace placeholders with actual data
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    });
    
    // Add current date if not provided
    const currentDate = new Date().toLocaleDateString();
    result = result.replace(/{{currentDate}}/g, currentDate);
    
    return result;
  };

  const tabs = [
    { id: 'templates', label: 'Templates', description: 'Manage document templates' },
    { id: 'documents', label: 'Generated Documents', description: 'View and manage documents' },
    { id: 'library', label: 'Document Library', description: 'Uploaded files and resources' }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Document Management</h1>
        <p className="text-gray-600">
          Create and manage document templates, generate contracts and estimates, and organize your document library.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search templates and documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        {activeTab === 'templates' && (
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'templates' && (
        <TemplatesTab
          templates={filteredTemplates}
          onEdit={(template) => {
            setSelectedTemplate(template);
            setShowTemplateModal(true);
          }}
          onGenerate={(template) => {
            setSelectedTemplate(template);
            setShowDocumentModal(true);
          }}
          onDuplicate={(template) => {
            const newTemplate = {
              ...template,
              id: crypto.randomUUID(),
              name: `${template.name} (Copy)`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              usageCount: 0,
              isDefault: false
            };
            const updatedTemplates = [...templates, newTemplate];
            setTemplates(updatedTemplates);
            localStorage.setItem('documentTemplates', JSON.stringify(updatedTemplates));
          }}
        />
      )}

      {activeTab === 'documents' && (
        <DocumentsTab
          documents={filteredDocuments}
          onView={(document) => setSelectedDocument(document)}
          onSend={(document) => {
            // Implement send functionality
          }}
        />
      )}

      {activeTab === 'library' && (
        <LibraryTab />
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <TemplateModal
          template={selectedTemplate}
          onSave={(template) => {
            if (selectedTemplate) {
              // Edit existing template
              const updatedTemplates = templates.map(t => 
                t.id === template.id ? { ...template, updatedAt: new Date().toISOString() } : t
              );
              setTemplates(updatedTemplates);
              localStorage.setItem('documentTemplates', JSON.stringify(updatedTemplates));
            } else {
              // Create new template
              const newTemplate = {
                ...template,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                usageCount: 0,
                isDefault: false
              };
              const updatedTemplates = [...templates, newTemplate];
              setTemplates(updatedTemplates);
              localStorage.setItem('documentTemplates', JSON.stringify(updatedTemplates));
            }
            setShowTemplateModal(false);
            setSelectedTemplate(null);
          }}
          onClose={() => {
            setShowTemplateModal(false);
            setSelectedTemplate(null);
          }}
        />
      )}

      {/* Document Generation Modal */}
      {showDocumentModal && selectedTemplate && (
        <DocumentGenerationModal
          template={selectedTemplate}
          onGenerate={(data) => {
            const document = generateDocument(selectedTemplate, data);
            setShowDocumentModal(false);
            setSelectedTemplate(null);
            // Open the generated document
            setSelectedDocument(document);
          }}
          onClose={() => {
            setShowDocumentModal(false);
            setSelectedTemplate(null);
          }}
        />
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <DocumentViewerModal
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onUpdate={(updatedDoc) => {
            const updatedDocuments = documents.map(d => 
              d.id === updatedDoc.id ? updatedDoc : d
            );
            setDocuments(updatedDocuments);
            localStorage.setItem('generatedDocuments', JSON.stringify(updatedDocuments));
            setSelectedDocument(updatedDoc);
          }}
        />
      )}
    </div>
  );
};

// Templates Tab Component
const TemplatesTab: React.FC<{
  templates: DocumentTemplate[];
  onEdit: (template: DocumentTemplate) => void;
  onGenerate: (template: DocumentTemplate) => void;
  onDuplicate: (template: DocumentTemplate) => void;
}> = ({ templates, onEdit, onGenerate, onDuplicate }) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'contract': return FileCode;
      case 'estimate': return DollarSign;
      case 'invoice': return FileText;
      case 'proposal': return Star;
      case 'form': return FileText;
      case 'letter': return Mail;
      default: return FileText;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'contract': return 'bg-red-100 text-red-800';
      case 'estimate': return 'bg-green-100 text-green-800';
      case 'invoice': return 'bg-blue-100 text-blue-800';
      case 'proposal': return 'bg-purple-100 text-purple-800';
      case 'form': return 'bg-yellow-100 text-yellow-800';
      case 'letter': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {templates.map((template) => {
        const CategoryIcon = getCategoryIcon(template.category);
        return (
          <div key={template.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md ${getCategoryColor(template.category)}`}>
                  <CategoryIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  {template.isDefault && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                      <Star className="w-3 h-3 fill-current" />
                      Default
                    </span>
                  )}
                </div>
              </div>
              <div className="relative">
                <button className="p-1 hover:bg-gray-100 rounded">
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">{template.description}</p>

            <div className="flex flex-wrap gap-1 mb-4">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
              <span>Used {template.usageCount} times</span>
              <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onGenerate(template)}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                Generate
              </button>
              <button
                onClick={() => onEdit(template)}
                className="p-2 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDuplicate(template)}
                className="p-2 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Placeholder components for other tabs
const DocumentsTab: React.FC<any> = ({ documents, onView, onSend }) => (
  <div className="text-center py-12">
    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Generated</h3>
    <p className="text-gray-500">Generate documents from templates to see them here.</p>
  </div>
);

const LibraryTab: React.FC = () => (
  <div className="text-center py-12">
    <Upload className="w-16 h-16 text-gray-300 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">Document Library</h3>
    <p className="text-gray-500 mb-4">Upload and organize your document assets.</p>
    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
      Upload Files
    </button>
  </div>
);

// Modal placeholders (to be implemented)
const TemplateModal: React.FC<any> = ({ onClose }) => <div>Template Modal</div>;
const DocumentGenerationModal: React.FC<any> = ({ onClose }) => <div>Document Generation Modal</div>;
const DocumentViewerModal: React.FC<any> = ({ onClose }) => <div>Document Viewer Modal</div>;

// Template content examples
const contractTemplate = `
ROOFING CONTRACT AGREEMENT

Contract Date: {{currentDate}}
Contract Number: {{contractNumber}}

CONTRACTOR INFORMATION:
{{companyName}}
{{companyAddress}}
{{companyPhone}}
{{companyEmail}}

CUSTOMER INFORMATION:
{{customerName}}
{{customerAddress}}
{{customerPhone}}
{{customerEmail}}

PROJECT DETAILS:
Property Address: {{projectAddress}}
Start Date: {{startDate}}
Estimated Completion: {{completionDate}}
Total Contract Amount: {{totalAmount}}

SCOPE OF WORK:
{{scopeOfWork}}

MATERIALS:
{{materials}}

TERMS AND CONDITIONS:
{{termsAndConditions}}

Contractor Signature: _____________________ Date: _____
Customer Signature: _____________________ Date: _____
`;

const estimateTemplate = `
ROOFING ESTIMATE

Estimate Date: {{currentDate}}
Estimate Number: {{estimateNumber}}
Valid Until: {{validUntil}}

CUSTOMER:
{{customerName}}
{{customerAddress}}
{{customerPhone}}

PROJECT ADDRESS:
{{projectAddress}}

MATERIALS:
{{materialsList}}

LABOR:
{{laborDetails}}

SUBTOTAL: {{subtotal}}
TAX: {{tax}}
TOTAL: {{total}}
`;

const proposalTemplate = `
ROOFING SERVICE PROPOSAL

Date: {{currentDate}}
Proposal Number: {{proposalNumber}}

Dear {{customerName}},

Thank you for considering our roofing services. We are pleased to submit this proposal for your roofing project at {{projectAddress}}.

PROJECT OVERVIEW:
{{projectOverview}}

OUR APPROACH:
{{approach}}

TIMELINE:
{{timeline}}

INVESTMENT:
{{investment}}

We look forward to working with you on this project.

Sincerely,
{{contractorName}}
{{companyName}}
`;

// Template field definitions
const contractFields: TemplateField[] = [
  { id: 'contractNumber', name: 'contractNumber', type: 'text', label: 'Contract Number', required: true },
  { id: 'customerName', name: 'customerName', type: 'text', label: 'Customer Name', required: true },
  { id: 'customerAddress', name: 'customerAddress', type: 'address', label: 'Customer Address', required: true },
  { id: 'projectAddress', name: 'projectAddress', type: 'address', label: 'Project Address', required: true },
  { id: 'totalAmount', name: 'totalAmount', type: 'currency', label: 'Total Amount', required: true },
  { id: 'startDate', name: 'startDate', type: 'date', label: 'Start Date', required: true },
  { id: 'completionDate', name: 'completionDate', type: 'date', label: 'Completion Date', required: true }
];

const estimateFields: TemplateField[] = [
  { id: 'estimateNumber', name: 'estimateNumber', type: 'text', label: 'Estimate Number', required: true },
  { id: 'customerName', name: 'customerName', type: 'text', label: 'Customer Name', required: true },
  { id: 'projectAddress', name: 'projectAddress', type: 'address', label: 'Project Address', required: true },
  { id: 'subtotal', name: 'subtotal', type: 'currency', label: 'Subtotal', required: true },
  { id: 'tax', name: 'tax', type: 'currency', label: 'Tax', required: true },
  { id: 'total', name: 'total', type: 'currency', label: 'Total', required: true }
];

const proposalFields: TemplateField[] = [
  { id: 'proposalNumber', name: 'proposalNumber', type: 'text', label: 'Proposal Number', required: true },
  { id: 'customerName', name: 'customerName', type: 'text', label: 'Customer Name', required: true },
  { id: 'projectAddress', name: 'projectAddress', type: 'address', label: 'Project Address', required: true },
  { id: 'projectOverview', name: 'projectOverview', type: 'text', label: 'Project Overview', required: true }
];

export default DocumentManager;