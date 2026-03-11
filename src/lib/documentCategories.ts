// Document Template Categories Configuration
// Single source of truth for all document categories
// Add new categories here - they'll automatically appear in the UI

import { 
  DollarSign, 
  FileText, 
  FileSignature, 
  ClipboardList, 
  Briefcase, 
  Edit, 
  Wrench,
  type LucideIcon
} from 'lucide-react';

export interface DocumentCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  description?: string;
}

// ⚠️ IMPORTANT: Do NOT change existing category IDs - they're used in the database
// To add a new category: add a new entry to this array
// To rename: only change the 'label' field, keep the 'id' the same
export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    id: 'estimate',
    label: 'Estimates',
    icon: DollarSign,
    color: 'bg-green-100 text-green-800',
    description: 'Cost estimates and quotes for customers'
  },
  {
    id: 'invoice',
    label: 'Invoices',
    icon: FileText,
    color: 'bg-blue-100 text-blue-800',
    description: 'Billing and payment documents'
  },
  {
    id: 'contract',
    label: 'Contracts',
    icon: FileSignature,
    color: 'bg-purple-100 text-purple-800',
    description: 'Legal agreements and service contracts'
  },
  {
    id: 'work-order',
    label: 'Work Orders',
    icon: ClipboardList,
    color: 'bg-orange-100 text-orange-800',
    description: 'Job assignments and crew instructions'
  },
  {
    id: 'proposal',
    label: 'Proposals',
    icon: Briefcase,
    color: 'bg-indigo-100 text-indigo-800',
    description: 'Project proposals and bids'
  },
  {
    id: 'change-order',
    label: 'Change Orders',
    icon: Edit,
    color: 'bg-yellow-100 text-yellow-800',
    description: 'Scope modifications and amendments'
  },
  {
    id: 'safety',
    label: 'Safety Forms',
    icon: Wrench,
    color: 'bg-red-100 text-red-800',
    description: 'Safety checklists and compliance documents'
  },
  {
    id: 'other',
    label: 'Other',
    icon: FileText,
    color: 'bg-gray-100 text-gray-800',
    description: 'Miscellaneous documents'
  }
];

// Helper to get category by ID
export const getCategoryById = (id: string): DocumentCategory | undefined => {
  return DOCUMENT_CATEGORIES.find(cat => cat.id === id);
};

// Helper to get all category IDs (for validation)
export const getAllCategoryIds = (): string[] => {
  return DOCUMENT_CATEGORIES.map(cat => cat.id);
};

// Type for template category field
export type DocumentCategoryId = typeof DOCUMENT_CATEGORIES[number]['id'];
