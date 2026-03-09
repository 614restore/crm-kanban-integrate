// CRM Data Types and Mock Data

export type CustomerStatus = 
  | 'prospect' 
  | 'lead' 
  | 'appt_set' 
  | 'inspection_completed'
  | 'estimate_sent' 
  | 'contingency' 
  | 'retail' 
  | 'signed' 
  | 'in_progress' 
  | 'build_phase' 
  | 'cleanup' 
  | 'invoicing' 
  | 'pending_payment' 
  | 'completed' 
  | 'lost';

export type UserRole = 
  | 'owner' 
  | 'admin'
  | 'sales_manager' 
  | 'sales_rep' 
  | 'production_manager'
  | 'project_manager'
  | 'field_tech'
  | 'office_staff'
  | 'subcontractor'
  // Legacy roles for backward compatibility
  | 'manager'
  | 'sales'
  | 'production'
  | 'billing'
  | 'canvas';

export type BoardType = 'sales' | 'production' | 'billing' | 'custom';

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone1: string;
  phone2?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: CustomerStatus;
  leadSource: string;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  // Insurance Info
  insuranceCompany?: string;
  policyNumber?: string;
  claimNumber?: string;
  adjusterName?: string;
  adjusterPhone?: string;
  adjusterEmail?: string;
  deductible?: number;
  // Project Info
  projectType?: string;
  projectValue?: number;
  depositAmount?: number;
  depositPaid?: boolean;
  depositDate?: string;
  finalPaymentAmount?: number;
  finalPaymentPaid?: boolean;
  finalPaymentDate?: string;
  // Retail Info
  isRetail?: boolean;
  retailNotes?: string;
  // Jobs
  jobs?: Job[];
  // Inspection Info
  inspectionScheduled?: boolean;
  inspectionDate?: string;
  inspectionCompleted?: boolean;
  inspectionCompletedDate?: string;
  inspectionNotes?: string;
  // Communication
  communications?: Communication[];
  // Documents
  documents?: Document[];
  notes?: string;
}

export interface Job {
  id: string;
  contactId: string;
  title: string;
  description: string;
  status: 'new' | 'estimating' | 'scheduled' | 'in_progress' | 'complete' | 'invoiced' | 'paid';
  scheduledDate?: string;
  completedDate?: string;
  estimatedValue: number;
  actualValue?: number;
  assignedTeam: string[];
  materials?: string[];
  notes?: string;
}

export interface CommunicationAttachment {
  id: string;
  name: string;
  url: string;
  size: string;
  type: string;
}

export interface Communication {
  id: string;
  contactId: string;
  type: 'email' | 'sms' | 'call' | 'note' | 'insurance';
  direction: 'inbound' | 'outbound';
  subject?: string;
  content: string;
  timestamp: string;
  userId: string;
  userName: string;
  attachments?: CommunicationAttachment[];
  mentions?: string[]; // Array of mentioned user IDs
}

export interface Document {
  id: string;
  contactId: string;
  name: string;
  type: 'contract' | 'estimate' | 'invoice' | 'photo' | 'insurance' | 'other';
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  size: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  work_email?: string; // Configured work email for integration
  role: UserRole;
  avatar: string;
  phone: string;
  department: string;
  isActive: boolean;
  performance?: {
    leadsGenerated: number;
    dealsClosed: number;
    revenue: number;
  };
}

export interface KanbanBoard {
  id: string;
  name: string;
  type: BoardType;
  columns: KanbanColumn[];
  visibleTo: UserRole[];
  createdBy: string;
  isDefault: boolean;
}

export interface KanbanColumn {
  id: string;
  title: string;
  status: CustomerStatus;
  color: string;
  order: number;
}

export interface LeadSource {
  id: string;
  name: string;
  isActive: boolean;
  isCustom: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  contactInfo?: {
    repName?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    notes?: string;
  };
  performance?: {
    totalLeads: number;
    convertedLeads: number;
    conversionRate: number;
    lastLeadDate?: string;
  };
}

export interface Appointment {
  id: string;
  contactId: string;
  contactName: string;
  title: string;
  type: 'inspection' | 'estimate' | 'follow_up' | 'installation' | 'final_walkthrough';
  date: string;
  time: string;
  duration: number;
  assignedTo: string;
  location: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
}

export interface Invoice {
  id: string;
  contactId: string;
  contactName: string;
  jobId: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  createdAt: string;
  paidAt?: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Automation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  isActive: boolean;
  createdBy: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'contract' | 'change_order' | '3_day_cancel' | 'work_order' | 'invoice' | 'estimate' | 'other';
  description?: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyGoals {
  id: string;
  companyId: string;
  month: string; // Format: YYYY-MM
  salesGoal?: number;
  revenueGoal?: number;
  profitMarginGoal?: number; // Percentage
  jobsCompletedGoal?: number;
  leadsGoal?: number;
  conversionRateGoal?: number; // Percentage
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  website?: string;
  accountNumber?: string;
  paymentTerms?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  contactId?: string;
  jobId?: string;
  orderNumber?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status: 'pending' | 'ordered' | 'partial' | 'delivered' | 'cancelled';
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  items: MaterialOrderItem[];
  notes?: string;
  attachments?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialOrderItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Estimate {
  id: string;
  contactId: string;
  contactName: string;
  jobId?: string;
  estimateNumber: string;
  title: string;
  description?: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
  amount: number;
  tax: number;
  total: number;
  validUntil?: string;
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  signedBy?: string;
  signatureData?: string;
  signToken?: string;
  items: EstimateItem[];
  terms?: string;
  notes?: string;
  createdBy: string;
  updatedAt: string;
}

export interface EstimateItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Project {
  id: string;
  projectNumber: string;
  name: string;
  contactId: string;
  contactName: string;
  estimateId?: string;
  description?: string;
  status: 'planning' | 'scheduled' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: string;
  endDate?: string;
  completedDate?: string;
  estimatedBudget: number;
  actualCost: number;
  // Expense Goals
  materialCostGoal?: number;
  subcontractorCostGoal?: number;
  salesRepPayGoal?: number;
  otherExpensesGoal?: number;
  profitMarginGoal?: number; // Percentage (e.g., 20 = 20%)
  // Actual Expenses
  actualMaterialCost?: number;
  actualSubcontractorCost?: number;
  actualSalesRepPay?: number;
  actualOtherExpenses?: number;
  actualProfitMargin?: number; // Calculated
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  projectManagerId?: string;
  projectManagerName?: string;
  notes?: string;
  tags?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrder {
  id: string;
  workOrderNumber: string;
  projectId?: string;
  projectName?: string;
  contactId: string;
  contactName: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledDate?: string;
  startedAt?: string;
  completedAt?: string;
  assignedTo: string[]; // Array of team member IDs
  assignedToNames?: string[];
  estimatedHours?: number;
  actualHours?: number;
  laborCost: number;
  materialCost: number;
  totalCost: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  attachments?: string[];
  checklistItems?: WorkOrderChecklistItem[];
  signedBy?: string;
  signatureData?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderChecklistItem {
  id: string;
  description: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

// Avatar URLs
export const avatars = {
  male1: 'https://d64gsuwffb70l.cloudfront.net/6999e82c82de1e7a627673e6_1771694251592_d27903bd.jpg',
  male2: 'https://d64gsuwffb70l.cloudfront.net/6999e82c82de1e7a627673e6_1771694261290_bbe78c1e.png',
  male3: 'https://d64gsuwffb70l.cloudfront.net/6999e82c82de1e7a627673e6_1771694272926_d462416a.png',
  male4: 'https://d64gsuwffb70l.cloudfront.net/6999e82c82de1e7a627673e6_1771694255830_1eaecc47.jpg',
  female1: 'https://d64gsuwffb70l.cloudfront.net/6999e82c82de1e7a627673e6_1771694287261_f2772873.jpg',
  female2: 'https://d64gsuwffb70l.cloudfront.net/6999e82c82de1e7a627673e6_1771694303107_8bc52692.png',
  female3: 'https://d64gsuwffb70l.cloudfront.net/6999e82c82de1e7a627673e6_1771694306934_1fca3331.png',
  female4: 'https://d64gsuwffb70l.cloudfront.net/6999e82c82de1e7a627673e6_1771694303639_d2e2186c.png',
};

export const heroImage = 'https://d64gsuwffb70l.cloudfront.net/6999e82c82de1e7a627673e6_1771694231168_e9011b29.jpg';

// Default Lead Sources
export const defaultLeadSources: LeadSource[] = [
  { id: 'ls1', name: 'Door Knock', isActive: true, isCustom: false },
  { id: 'ls2', name: 'Referral', isActive: true, isCustom: false },
  { id: 'ls3', name: 'Storm Damage', isActive: true, isCustom: false },
  { id: 'ls4', name: 'Website', isActive: true, isCustom: false },
  { id: 'ls5', name: 'Google Ads', isActive: true, isCustom: false },
  { id: 'ls6', name: 'Facebook', isActive: true, isCustom: false },
  { id: 'ls7', name: 'Home Show', isActive: true, isCustom: false },
  { id: 'ls8', name: 'Insurance Referral', isActive: true, isCustom: false },
  { id: 'ls9', name: 'Yard Sign', isActive: true, isCustom: false },
  { id: 'ls10', name: 'Repeat Customer', isActive: true, isCustom: false },
];

// Default Kanban Boards
export const defaultBoards: KanbanBoard[] = [
  {
    id: 'board-sales',
    name: 'Sales Pipeline',
    type: 'sales',
    visibleTo: ['owner', 'manager', 'admin', 'sales'],
    createdBy: 'system',
    isDefault: true,
    columns: [
      { id: 'col-0', title: 'Prospect', status: 'prospect', color: '#94a3b8', order: 0 },
      { id: 'col-1', title: 'Lead', status: 'lead', color: '#6366f1', order: 1 },
      { id: 'col-2', title: 'Appt Set', status: 'appt_set', color: '#8b5cf6', order: 2 },
      { id: 'col-2b', title: 'Inspection Completed', status: 'inspection_completed', color: '#06b6d4', order: 3 },
      { id: 'col-3', title: 'Estimate Sent', status: 'estimate_sent', color: '#a855f7', order: 4 },
      { id: 'col-4', title: 'Signed Customer', status: 'signed', color: '#22c55e', order: 5 },
      { id: 'col-5', title: 'Lost', status: 'lost', color: '#ef4444', order: 6 },
    ],
  },
  {
    id: 'board-production',
    name: 'Production Board',
    type: 'production',
    visibleTo: ['owner', 'manager', 'admin', 'production'],
    createdBy: 'system',
    isDefault: true,
    columns: [
      { id: 'col-p1', title: 'New', status: 'signed', color: '#3b82f6', order: 0 },
      { id: 'col-p2', title: 'Estimating', status: 'contingency', color: '#f59e0b', order: 1 },
      { id: 'col-p3', title: 'Scheduling', status: 'in_progress', color: '#8b5cf6', order: 2 },
      { id: 'col-p4', title: 'Production', status: 'build_phase', color: '#06b6d4', order: 3 },
      { id: 'col-p5', title: 'Billing', status: 'cleanup', color: '#22c55e', order: 4 },
    ],
  },
  {
    id: 'board-billing',
    name: 'Billing Board',
    type: 'billing',
    visibleTo: ['owner', 'manager', 'admin', 'billing'],
    createdBy: 'system',
    isDefault: true,
    columns: [
      { id: 'col-b1', title: 'Incoming Job', status: 'cleanup', color: '#3b82f6', order: 0 },
      { id: 'col-b2', title: 'Scheduled Job', status: 'in_progress', color: '#8b5cf6', order: 1 },
      { id: 'col-b3', title: 'In Progress', status: 'build_phase', color: '#f59e0b', order: 2 },
      { id: 'col-b4', title: 'Complete', status: 'cleanup', color: '#06b6d4', order: 3 },
      { id: 'col-b5', title: 'Invoicing', status: 'invoicing', color: '#ec4899', order: 4 },
      { id: 'col-b6', title: 'Pending Payment', status: 'pending_payment', color: '#f97316', order: 5 },
      { id: 'col-b7', title: 'Paid & Closed', status: 'completed', color: '#22c55e', order: 6 },
    ],
  },
];

// Mock Team Members
export const mockTeamMembers: TeamMember[] = [
  {
    id: 'tm1',
    name: 'Marcus Johnson',
    email: 'marcus@trussctr.com',
    role: 'owner',
    avatar: avatars.male1,
    phone: '(555) 123-4567',
    department: 'Executive',
    isActive: true,
    performance: { leadsGenerated: 45, dealsClosed: 32, revenue: 485000 },
  },
  {
    id: 'tm2',
    name: 'Sarah Williams',
    email: 'sarah@trussctr.com',
    role: 'manager',
    avatar: avatars.female1,
    phone: '(555) 234-5678',
    department: 'Sales',
    isActive: true,
    performance: { leadsGenerated: 78, dealsClosed: 45, revenue: 325000 },
  },
  {
    id: 'tm3',
    name: 'David Chen',
    email: 'david@trussctr.com',
    role: 'sales',
    avatar: avatars.male2,
    phone: '(555) 345-6789',
    department: 'Sales',
    isActive: true,
    performance: { leadsGenerated: 120, dealsClosed: 28, revenue: 215000 },
  },
  {
    id: 'tm4',
    name: 'Emily Rodriguez',
    email: 'emily@trussctr.com',
    role: 'production',
    avatar: avatars.female2,
    phone: '(555) 456-7890',
    department: 'Production',
    isActive: true,
    performance: { leadsGenerated: 0, dealsClosed: 0, revenue: 0 },
  },
  {
    id: 'tm5',
    name: 'James Wilson',
    email: 'james@trussctr.com',
    role: 'canvas',
    avatar: avatars.male3,
    phone: '(555) 567-8901',
    department: 'Canvas',
    isActive: true,
    performance: { leadsGenerated: 156, dealsClosed: 0, revenue: 0 },
  },
  {
    id: 'tm6',
    name: 'Lisa Thompson',
    email: 'lisa@trussctr.com',
    role: 'billing',
    avatar: avatars.female3,
    phone: '(555) 678-9012',
    department: 'Billing',
    isActive: true,
    performance: { leadsGenerated: 0, dealsClosed: 0, revenue: 0 },
  },
  {
    id: 'tm7',
    name: 'Michael Brown',
    email: 'michael@trussctr.com',
    role: 'admin',
    avatar: avatars.male4,
    phone: '(555) 789-0123',
    department: 'Admin',
    isActive: true,
    performance: { leadsGenerated: 12, dealsClosed: 8, revenue: 95000 },
  },
  {
    id: 'tm8',
    name: 'Amanda Davis',
    email: 'amanda@trussctr.com',
    role: 'sales',
    avatar: avatars.female4,
    phone: '(555) 890-1234',
    department: 'Sales',
    isActive: true,
    performance: { leadsGenerated: 89, dealsClosed: 35, revenue: 278000 },
  },
];

// Mock Contacts
export const mockContacts: Contact[] = [
  {
    id: 'c1',
    firstName: 'Robert',
    lastName: 'Anderson',
    email: 'robert.anderson@email.com',
    phone1: '(555) 111-2222',
    phone2: '(555) 111-3333',
    address: '1234 Oak Street',
    city: 'Dallas',
    state: 'TX',
    zip: '75201',
    status: 'signed',
    leadSource: 'Storm Damage',
    assignedTo: 'tm2',
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-02-20T14:30:00Z',
    tags: ['priority', 'insurance'],
    insuranceCompany: 'State Farm',
    policyNumber: 'SF-12345678',
    claimNumber: 'CLM-2026-001234',
    adjusterName: 'John Smith',
    adjusterPhone: '(555) 999-8888',
    adjusterEmail: 'jsmith@statefarm.com',
    deductible: 2500,
    projectType: 'Full Roof Replacement',
    projectValue: 18500,
    depositAmount: 5000,
    depositPaid: true,
    depositDate: '2026-02-15',
    isRetail: false,
    notes: 'Large hail damage from February storm. Customer very responsive.',
    jobs: [
      {
        id: 'j1',
        contactId: 'c1',
        title: 'Roof Replacement - Shingle',
        description: 'Complete tear-off and replacement with architectural shingles',
        status: 'scheduled',
        scheduledDate: '2026-02-25',
        estimatedValue: 18500,
        assignedTeam: ['tm4'],
        materials: ['Architectural Shingles', 'Underlayment', 'Flashing'],
      },
    ],
    communications: [
      {
        id: 'comm1',
        contactId: 'c1',
        type: 'call',
        direction: 'outbound',
        content: 'Initial consultation call. Scheduled inspection for tomorrow.',
        timestamp: '2026-02-01T10:30:00Z',
        userId: 'tm2',
        userName: 'Sarah Williams',
      },
      {
        id: 'comm2',
        contactId: 'c1',
        type: 'insurance',
        direction: 'outbound',
        subject: 'Claim Documentation',
        content: 'Sent inspection photos and estimate to adjuster.',
        timestamp: '2026-02-10T09:00:00Z',
        userId: 'tm2',
        userName: 'Sarah Williams',
      },
    ],
    documents: [
      {
        id: 'doc1',
        contactId: 'c1',
        name: 'Roof Inspection Report.pdf',
        type: 'estimate',
        url: '#',
        uploadedAt: '2026-02-02T11:00:00Z',
        uploadedBy: 'Sarah Williams',
        size: '2.4 MB',
      },
      {
        id: 'doc2',
        contactId: 'c1',
        name: 'Signed Contract.pdf',
        type: 'contract',
        url: '#',
        uploadedAt: '2026-02-15T14:00:00Z',
        uploadedBy: 'Sarah Williams',
        size: '1.8 MB',
      },
    ],
  },
  {
    id: 'c2',
    firstName: 'Jennifer',
    lastName: 'Martinez',
    email: 'jennifer.m@email.com',
    phone1: '(555) 222-3333',
    address: '5678 Maple Avenue',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76102',
    status: 'estimate_sent',
    leadSource: 'Referral',
    assignedTo: 'tm3',
    createdAt: '2026-02-10T09:00:00Z',
    updatedAt: '2026-02-19T16:00:00Z',
    tags: ['referral', 'hot-lead'],
    projectType: 'Roof Repair',
    projectValue: 4500,
    isRetail: true,
    retailNotes: 'Cash customer, no insurance claim',
    notes: 'Referred by Robert Anderson. Minor leak repair needed.',
  },
  {
    id: 'c3',
    firstName: 'William',
    lastName: 'Thompson',
    email: 'wthompson@email.com',
    phone1: '(555) 333-4444',
    phone2: '(555) 333-5555',
    address: '9012 Pine Road',
    city: 'Arlington',
    state: 'TX',
    zip: '76001',
    status: 'build_phase',
    leadSource: 'Door Knock',
    assignedTo: 'tm5',
    createdAt: '2026-01-15T14:00:00Z',
    updatedAt: '2026-02-21T10:00:00Z',
    tags: ['insurance', 'large-project'],
    insuranceCompany: 'Allstate',
    policyNumber: 'AS-98765432',
    claimNumber: 'CLM-2026-005678',
    adjusterName: 'Mary Johnson',
    adjusterPhone: '(555) 888-7777',
    deductible: 1500,
    projectType: 'Full Roof + Gutters',
    projectValue: 28000,
    depositAmount: 8000,
    depositPaid: true,
    depositDate: '2026-02-01',
    isRetail: false,
    jobs: [
      {
        id: 'j2',
        contactId: 'c3',
        title: 'Roof Replacement',
        description: 'Full tear-off with premium shingles',
        status: 'in_progress',
        scheduledDate: '2026-02-18',
        estimatedValue: 22000,
        assignedTeam: ['tm4'],
      },
      {
        id: 'j3',
        contactId: 'c3',
        title: 'Gutter Installation',
        description: '6-inch seamless aluminum gutters',
        status: 'scheduled',
        scheduledDate: '2026-02-26',
        estimatedValue: 6000,
        assignedTeam: ['tm4'],
      },
    ],
  },
  {
    id: 'c4',
    firstName: 'Patricia',
    lastName: 'Garcia',
    email: 'pgarcia@email.com',
    phone1: '(555) 444-5555',
    address: '3456 Cedar Lane',
    city: 'Plano',
    state: 'TX',
    zip: '75023',
    status: 'appt_set',
    leadSource: 'Google Ads',
    assignedTo: 'tm8',
    createdAt: '2026-02-18T11:00:00Z',
    updatedAt: '2026-02-20T09:00:00Z',
    tags: ['new-lead'],
    projectType: 'Roof Inspection',
    notes: 'Scheduled inspection for Feb 22nd at 2pm',
  },
  {
    id: 'c5',
    firstName: 'Christopher',
    lastName: 'Lee',
    email: 'chris.lee@email.com',
    phone1: '(555) 555-6666',
    address: '7890 Birch Street',
    city: 'Irving',
    state: 'TX',
    zip: '75038',
    status: 'pending_payment',
    leadSource: 'Website',
    assignedTo: 'tm2',
    createdAt: '2026-01-05T08:00:00Z',
    updatedAt: '2026-02-19T15:00:00Z',
    tags: ['insurance', 'completed-work'],
    insuranceCompany: 'USAA',
    policyNumber: 'USAA-11223344',
    claimNumber: 'CLM-2026-002345',
    deductible: 2000,
    projectType: 'Full Roof Replacement',
    projectValue: 21000,
    depositAmount: 6000,
    depositPaid: true,
    depositDate: '2026-01-20',
    finalPaymentAmount: 15000,
    finalPaymentPaid: false,
    isRetail: false,
    notes: 'Work completed. Waiting on insurance check.',
  },
  {
    id: 'c6',
    firstName: 'Michelle',
    lastName: 'Robinson',
    email: 'mrobinson@email.com',
    phone1: '(555) 666-7777',
    address: '2345 Elm Drive',
    city: 'Garland',
    state: 'TX',
    zip: '75040',
    status: 'lead',
    leadSource: 'Facebook',
    assignedTo: 'tm3',
    createdAt: '2026-02-20T16:00:00Z',
    updatedAt: '2026-02-20T16:00:00Z',
    tags: ['new-lead', 'social'],
    projectType: 'Unknown',
    notes: 'Inquiry through Facebook. Needs callback.',
  },
  {
    id: 'c7',
    firstName: 'Daniel',
    lastName: 'White',
    email: 'dwhite@email.com',
    phone1: '(555) 777-8888',
    phone2: '(555) 777-9999',
    address: '6789 Spruce Court',
    city: 'McKinney',
    state: 'TX',
    zip: '75069',
    status: 'completed',
    leadSource: 'Referral',
    assignedTo: 'tm2',
    createdAt: '2025-12-01T10:00:00Z',
    updatedAt: '2026-02-10T12:00:00Z',
    tags: ['completed', 'satisfied'],
    insuranceCompany: 'Farmers',
    policyNumber: 'FM-55667788',
    claimNumber: 'CLM-2025-009876',
    deductible: 3000,
    projectType: 'Full Roof + Siding',
    projectValue: 45000,
    depositAmount: 12000,
    depositPaid: true,
    depositDate: '2025-12-15',
    finalPaymentAmount: 33000,
    finalPaymentPaid: true,
    finalPaymentDate: '2026-02-10',
    isRetail: false,
    notes: 'Excellent customer. Left 5-star review.',
  },
  {
    id: 'c8',
    firstName: 'Elizabeth',
    lastName: 'Taylor',
    email: 'etaylor@email.com',
    phone1: '(555) 888-9999',
    address: '1357 Walnut Way',
    city: 'Frisco',
    state: 'TX',
    zip: '75034',
    status: 'contingency',
    leadSource: 'Storm Damage',
    assignedTo: 'tm8',
    createdAt: '2026-02-12T13:00:00Z',
    updatedAt: '2026-02-21T08:00:00Z',
    tags: ['insurance', 'contingency'],
    insuranceCompany: 'Liberty Mutual',
    policyNumber: 'LM-44556677',
    claimNumber: 'CLM-2026-003456',
    adjusterName: 'Robert Davis',
    adjusterPhone: '(555) 666-5555',
    deductible: 2500,
    projectType: 'Roof Replacement',
    projectValue: 19500,
    isRetail: false,
    notes: 'Waiting on adjuster approval. Meeting scheduled for Feb 24.',
  },
  {
    id: 'c9',
    firstName: 'Thomas',
    lastName: 'Harris',
    email: 'tharris@email.com',
    phone1: '(555) 999-0000',
    address: '2468 Ash Boulevard',
    city: 'Allen',
    state: 'TX',
    zip: '75002',
    status: 'invoicing',
    leadSource: 'Yard Sign',
    assignedTo: 'tm3',
    createdAt: '2026-01-20T09:00:00Z',
    updatedAt: '2026-02-20T11:00:00Z',
    tags: ['retail', 'invoiced'],
    projectType: 'Roof Repair + Gutters',
    projectValue: 8500,
    depositAmount: 2500,
    depositPaid: true,
    depositDate: '2026-01-25',
    isRetail: true,
    retailNotes: 'Cash customer, paying in installments',
    notes: 'Work completed. Invoice sent Feb 20.',
  },
  {
    id: 'c10',
    firstName: 'Nancy',
    lastName: 'Clark',
    email: 'nclark@email.com',
    phone1: '(555) 000-1111',
    address: '3579 Hickory Lane',
    city: 'Richardson',
    state: 'TX',
    zip: '75080',
    status: 'prospect',
    leadSource: 'Home Show',
    assignedTo: 'tm5',
    createdAt: '2026-02-19T15:00:00Z',
    updatedAt: '2026-02-19T15:00:00Z',
    tags: ['prospect', 'trade-show'],
    projectType: 'Unknown',
    notes: 'Met at Dallas Home Show. Interested in roof inspection.',
  },
  {
    id: 'c11',
    firstName: 'Kevin',
    lastName: 'Lewis',
    email: 'klewis@email.com',
    phone1: '(555) 111-0000',
    address: '4680 Poplar Street',
    city: 'Carrollton',
    state: 'TX',
    zip: '75006',
    status: 'in_progress',
    leadSource: 'Insurance Referral',
    assignedTo: 'tm2',
    createdAt: '2026-02-05T10:00:00Z',
    updatedAt: '2026-02-21T09:00:00Z',
    tags: ['insurance', 'priority'],
    insuranceCompany: 'Progressive',
    policyNumber: 'PR-99887766',
    claimNumber: 'CLM-2026-004567',
    adjusterName: 'Susan Miller',
    adjusterPhone: '(555) 444-3333',
    deductible: 1000,
    projectType: 'Full Roof Replacement',
    projectValue: 16500,
    depositAmount: 4500,
    depositPaid: true,
    depositDate: '2026-02-12',
    isRetail: false,
    notes: 'Materials delivered. Installation starts tomorrow.',
  },
  {
    id: 'c12',
    firstName: 'Sandra',
    lastName: 'Walker',
    email: 'swalker@email.com',
    phone1: '(555) 222-1111',
    address: '5791 Chestnut Avenue',
    city: 'Lewisville',
    state: 'TX',
    zip: '75067',
    status: 'lost',
    leadSource: 'Door Knock',
    assignedTo: 'tm5',
    createdAt: '2026-01-25T14:00:00Z',
    updatedAt: '2026-02-15T10:00:00Z',
    tags: ['lost', 'price-objection'],
    projectType: 'Roof Replacement',
    projectValue: 14000,
    isRetail: true,
    notes: 'Lost to competitor. Price was main objection.',
  },
  {
    id: 'c13',
    firstName: 'Brian',
    lastName: 'Hall',
    email: 'bhall@email.com',
    phone1: '(555) 333-2222',
    phone2: '(555) 333-3333',
    address: '6802 Willow Road',
    city: 'Denton',
    state: 'TX',
    zip: '76201',
    status: 'cleanup',
    leadSource: 'Repeat Customer',
    assignedTo: 'tm4',
    createdAt: '2026-01-10T11:00:00Z',
    updatedAt: '2026-02-21T14:00:00Z',
    tags: ['repeat', 'cleanup'],
    projectType: 'Roof + Windows',
    projectValue: 35000,
    depositAmount: 10000,
    depositPaid: true,
    depositDate: '2026-01-18',
    isRetail: false,
    insuranceCompany: 'Nationwide',
    policyNumber: 'NW-33445566',
    claimNumber: 'CLM-2026-001111',
    deductible: 2000,
    notes: 'Work complete. Final walkthrough scheduled for Feb 22.',
  },
  {
    id: 'c14',
    firstName: 'Karen',
    lastName: 'Young',
    email: 'kyoung@email.com',
    phone1: '(555) 444-3333',
    address: '7913 Sycamore Drive',
    city: 'Mesquite',
    state: 'TX',
    zip: '75149',
    status: 'retail',
    leadSource: 'Website',
    assignedTo: 'tm8',
    createdAt: '2026-02-14T09:00:00Z',
    updatedAt: '2026-02-20T16:00:00Z',
    tags: ['retail', 'signed'],
    projectType: 'Gutter Installation',
    projectValue: 4200,
    depositAmount: 1200,
    depositPaid: true,
    depositDate: '2026-02-18',
    isRetail: true,
    retailNotes: 'Cash customer. Wants seamless gutters.',
    notes: 'Scheduled for installation Feb 27.',
  },
  {
    id: 'c15',
    firstName: 'Steven',
    lastName: 'King',
    email: 'sking@email.com',
    phone1: '(555) 555-4444',
    address: '8024 Magnolia Court',
    city: 'Grand Prairie',
    state: 'TX',
    zip: '75050',
    status: 'signed',
    leadSource: 'Google Ads',
    assignedTo: 'tm3',
    createdAt: '2026-02-16T10:00:00Z',
    updatedAt: '2026-02-21T11:00:00Z',
    tags: ['insurance', 'new-signed'],
    insuranceCompany: 'Travelers',
    policyNumber: 'TV-77889900',
    claimNumber: 'CLM-2026-005555',
    adjusterName: 'Tom Wilson',
    adjusterPhone: '(555) 222-1111',
    deductible: 1500,
    projectType: 'Full Roof Replacement',
    projectValue: 17800,
    depositAmount: 5000,
    depositPaid: false,
    isRetail: false,
    notes: 'Contract signed. Waiting on deposit before scheduling.',
  },
  {
    id: 'c16',
    firstName: 'Donna',
    lastName: 'Scott',
    email: 'dscott@email.com',
    phone1: '(555) 666-5555',
    address: '9135 Redwood Lane',
    city: 'Euless',
    state: 'TX',
    zip: '76039',
    status: 'lead',
    leadSource: 'Door Knock',
    assignedTo: 'tm5',
    createdAt: '2026-02-21T08:00:00Z',
    updatedAt: '2026-02-21T08:00:00Z',
    tags: ['new-lead', 'canvas'],
    projectType: 'Roof Inspection',
    notes: 'Canvas lead from this morning. Interested in free inspection.',
  },
];

// Mock Appointments
export const mockAppointments: Appointment[] = [
  {
    id: 'apt1',
    contactId: 'c4',
    contactName: 'Patricia Garcia',
    title: 'Roof Inspection',
    type: 'inspection',
    date: '2026-02-22',
    time: '14:00',
    duration: 60,
    assignedTo: 'tm8',
    location: '3456 Cedar Lane, Plano, TX 75023',
    status: 'scheduled',
  },
  {
    id: 'apt2',
    contactId: 'c13',
    contactName: 'Brian Hall',
    title: 'Final Walkthrough',
    type: 'final_walkthrough',
    date: '2026-02-22',
    time: '10:00',
    duration: 45,
    assignedTo: 'tm4',
    location: '6802 Willow Road, Denton, TX 76201',
    status: 'scheduled',
  },
  {
    id: 'apt3',
    contactId: 'c8',
    contactName: 'Elizabeth Taylor',
    title: 'Adjuster Meeting',
    type: 'estimate',
    date: '2026-02-24',
    time: '09:00',
    duration: 90,
    assignedTo: 'tm8',
    location: '1357 Walnut Way, Frisco, TX 75034',
    notes: 'Meet with adjuster Robert Davis',
    status: 'scheduled',
  },
  {
    id: 'apt4',
    contactId: 'c1',
    contactName: 'Robert Anderson',
    title: 'Installation Start',
    type: 'installation',
    date: '2026-02-25',
    time: '07:00',
    duration: 480,
    assignedTo: 'tm4',
    location: '1234 Oak Street, Dallas, TX 75201',
    status: 'scheduled',
  },
  {
    id: 'apt5',
    contactId: 'c3',
    contactName: 'William Thompson',
    title: 'Gutter Installation',
    type: 'installation',
    date: '2026-02-26',
    time: '08:00',
    duration: 240,
    assignedTo: 'tm4',
    location: '9012 Pine Road, Arlington, TX 76001',
    status: 'scheduled',
  },
  {
    id: 'apt6',
    contactId: 'c14',
    contactName: 'Karen Young',
    title: 'Gutter Installation',
    type: 'installation',
    date: '2026-02-27',
    time: '08:00',
    duration: 180,
    assignedTo: 'tm4',
    location: '7913 Sycamore Drive, Mesquite, TX 75149',
    status: 'scheduled',
  },
  {
    id: 'apt7',
    contactId: 'c6',
    contactName: 'Michelle Robinson',
    title: 'Follow-up Call',
    type: 'follow_up',
    date: '2026-02-22',
    time: '11:00',
    duration: 15,
    assignedTo: 'tm3',
    location: 'Phone',
    status: 'scheduled',
  },
  {
    id: 'apt8',
    contactId: 'c10',
    contactName: 'Nancy Clark',
    title: 'Initial Consultation',
    type: 'estimate',
    date: '2026-02-23',
    time: '15:00',
    duration: 60,
    assignedTo: 'tm5',
    location: '3579 Hickory Lane, Richardson, TX 75080',
    status: 'scheduled',
  },
];

// Mock Invoices
export const mockInvoices: Invoice[] = [
  {
    id: 'inv1',
    contactId: 'c9',
    contactName: 'Thomas Harris',
    jobId: 'j-th1',
    amount: 6000,
    status: 'sent',
    dueDate: '2026-03-05',
    createdAt: '2026-02-20T11:00:00Z',
    items: [
      { description: 'Roof Repair - Labor', quantity: 1, unitPrice: 3500, total: 3500 },
      { description: 'Gutter Installation - 6" Seamless', quantity: 120, unitPrice: 15, total: 1800 },
      { description: 'Materials & Supplies', quantity: 1, unitPrice: 700, total: 700 },
    ],
  },
  {
    id: 'inv2',
    contactId: 'c5',
    contactName: 'Christopher Lee',
    jobId: 'j-cl1',
    amount: 15000,
    status: 'sent',
    dueDate: '2026-02-28',
    createdAt: '2026-02-15T14:00:00Z',
    items: [
      { description: 'Full Roof Replacement - Labor', quantity: 1, unitPrice: 8000, total: 8000 },
      { description: 'Architectural Shingles - 30 Year', quantity: 35, unitPrice: 150, total: 5250 },
      { description: 'Underlayment & Flashing', quantity: 1, unitPrice: 1750, total: 1750 },
    ],
  },
  {
    id: 'inv3',
    contactId: 'c7',
    contactName: 'Daniel White',
    jobId: 'j-dw1',
    amount: 33000,
    status: 'paid',
    dueDate: '2026-02-10',
    createdAt: '2026-01-28T10:00:00Z',
    paidAt: '2026-02-10T12:00:00Z',
    items: [
      { description: 'Full Roof Replacement', quantity: 1, unitPrice: 22000, total: 22000 },
      { description: 'Siding Installation', quantity: 1, unitPrice: 11000, total: 11000 },
    ],
  },
  {
    id: 'inv4',
    contactId: 'c13',
    contactName: 'Brian Hall',
    jobId: 'j-bh1',
    amount: 25000,
    status: 'draft',
    dueDate: '2026-03-10',
    createdAt: '2026-02-21T14:00:00Z',
    items: [
      { description: 'Roof Replacement - Premium Shingles', quantity: 1, unitPrice: 18000, total: 18000 },
      { description: 'Window Installation (6 windows)', quantity: 6, unitPrice: 1000, total: 6000 },
      { description: 'Cleanup & Disposal', quantity: 1, unitPrice: 1000, total: 1000 },
    ],
  },
  {
    id: 'inv5',
    contactId: 'c11',
    contactName: 'Kevin Lewis',
    jobId: 'j-kl1',
    amount: 12000,
    status: 'draft',
    dueDate: '2026-03-15',
    createdAt: '2026-02-21T09:00:00Z',
    items: [
      { description: 'Full Roof Replacement - Labor', quantity: 1, unitPrice: 7000, total: 7000 },
      { description: 'Materials - Architectural Shingles', quantity: 1, unitPrice: 5000, total: 5000 },
    ],
  },
];

// Mock Automations
export const mockAutomations: Automation[] = [
  {
    id: 'auto1',
    name: 'New Lead Welcome Email',
    trigger: 'When contact status changes to Lead',
    action: 'Send welcome email with company info',
    isActive: true,
    createdBy: 'tm1',
  },
  {
    id: 'auto2',
    name: 'Appointment Reminder',
    trigger: '24 hours before scheduled appointment',
    action: 'Send SMS reminder to customer',
    isActive: true,
    createdBy: 'tm1',
  },
  {
    id: 'auto3',
    name: 'Follow-up After Estimate',
    trigger: '3 days after estimate sent',
    action: 'Create follow-up task for sales rep',
    isActive: true,
    createdBy: 'tm2',
  },
  {
    id: 'auto4',
    name: 'Payment Reminder',
    trigger: '7 days before invoice due date',
    action: 'Send payment reminder email',
    isActive: true,
    createdBy: 'tm6',
  },
  {
    id: 'auto5',
    name: 'Job Completion Notification',
    trigger: 'When job status changes to Complete',
    action: 'Notify billing team and send customer survey',
    isActive: true,
    createdBy: 'tm1',
  },
  {
    id: 'auto6',
    name: 'Overdue Invoice Alert',
    trigger: 'When invoice becomes overdue',
    action: 'Send alert to billing manager',
    isActive: true,
    createdBy: 'tm6',
  },
  {
    id: 'auto7',
    name: 'Canvas Lead Assignment',
    trigger: 'When new canvas lead is created',
    action: 'Auto-assign to available sales rep',
    isActive: false,
    createdBy: 'tm2',
  },
  {
    id: 'auto8',
    name: 'Insurance Claim Follow-up',
    trigger: '14 days after claim submitted',
    action: 'Create task to follow up with adjuster',
    isActive: true,
    createdBy: 'tm2',
  },
  {
    id: 'auto9',
    name: 'Deposit Confirmation',
    trigger: 'When deposit is marked as paid',
    action: 'Send confirmation email and notify production',
    isActive: true,
    createdBy: 'tm1',
  },
  {
    id: 'auto10',
    name: 'Review Request',
    trigger: '7 days after final payment received',
    action: 'Send review request email to customer',
    isActive: true,
    createdBy: 'tm1',
  },
  {
    id: 'auto11',
    name: 'Material Order Alert',
    trigger: 'When job is scheduled',
    action: 'Create material order checklist',
    isActive: false,
    createdBy: 'tm4',
  },
  {
    id: 'auto12',
    name: 'Lost Lead Re-engagement',
    trigger: '90 days after lead marked as lost',
    action: 'Send re-engagement email campaign',
    isActive: false,
    createdBy: 'tm2',
  },
];

// Status display helpers
export const statusLabels: Record<CustomerStatus, string> = {
  prospect: 'Prospect',
  lead: 'Lead',
  appt_set: 'Appointment Set',
  inspection_completed: 'Inspection Completed',
  estimate_sent: 'Estimate Sent',
  contingency: 'Contingency',
  retail: 'Retail Customer',
  signed: 'Signed Customer',
  in_progress: 'In Progress',
  build_phase: 'Build Phase',
  cleanup: 'Cleanup',
  invoicing: 'Invoicing',
  pending_payment: 'Pending Payment',
  completed: 'Completed',
  lost: 'Lost',
};

export const statusColors: Record<CustomerStatus, string> = {
  prospect: 'bg-gray-100 text-gray-800',
  lead: 'bg-blue-100 text-blue-800',
  appt_set: 'bg-purple-100 text-purple-800',
  inspection_completed: 'bg-cyan-100 text-cyan-800',
  estimate_sent: 'bg-indigo-100 text-indigo-800',
  contingency: 'bg-yellow-100 text-yellow-800',
  retail: 'bg-teal-100 text-teal-800',
  signed: 'bg-green-100 text-green-800',
  in_progress: 'bg-cyan-100 text-cyan-800',
  build_phase: 'bg-orange-100 text-orange-800',
  cleanup: 'bg-pink-100 text-pink-800',
  invoicing: 'bg-rose-100 text-rose-800',
  pending_payment: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-red-100 text-red-800',
};

export const roleLabels: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  sales_manager: 'Sales Manager',
  sales_rep: 'Sales Rep',
  production_manager: 'Production Manager',
  project_manager: 'Project Manager',
  field_tech: 'Field Tech/Crew',
  office_staff: 'Office Staff',
  subcontractor: 'Subcontractor',
  // Legacy roles
  manager: 'Manager (Legacy)',
  sales: 'Sales (Legacy)',
  production: 'Production (Legacy)',
  billing: 'Billing (Legacy)',
  canvas: 'Canvas (Legacy)',
};

// Helper functions
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getContactFullName(contact: Contact): string {
  return `${contact.firstName} ${contact.lastName}`;
}

export function getTeamMemberById(id: string): TeamMember | undefined {
  return mockTeamMembers.find((tm) => tm.id === id);
}
