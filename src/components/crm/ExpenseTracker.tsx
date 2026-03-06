// Expense tracking component for contractors
// Track job-related expenses, receipts, and reimbursements

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Filter,
  Search,
  DollarSign,
  Calendar,
  FileText,
  Camera,
  Trash2,
  Edit,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  jobId?: string;
  jobName?: string;
  contactId?: string;
  contactName?: string;
  receipt?: string; // base64 image
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  submittedBy: string;
  submittedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  mileage?: number;
  location?: string;
  vendor?: string;
  paymentMethod: 'cash' | 'card' | 'check' | 'company_card';
  reimbursable: boolean;
}

interface ExpenseFilters {
  status: string;
  category: string;
  dateRange: string;
  job: string;
  employee: string;
}

const ExpenseTracker: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [filters, setFilters] = useState<ExpenseFilters>({
    status: 'all',
    category: 'all',
    dateRange: 'all',
    job: 'all',
    employee: 'all'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('cards');
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();

  // Expense categories for contractors
  const expenseCategories = [
    'Materials',
    'Tools & Equipment',
    'Fuel',
    'Vehicle Expenses', 
    'Travel & Lodging',
    'Meals',
    'Permits & Licenses',
    'Insurance',
    'Subcontractors',
    'Office Supplies',
    'Marketing',
    'Training',
    'Other'
  ];

  // Load expenses from storage/API
  const loadExpenses = async () => {
    setLoading(true);
    try {
      // Mock data for demo
      const mockExpenses: Expense[] = [
        {
          id: '1',
          amount: 156.78,
          description: 'Lumber for deck framing',
          category: 'Materials',
          date: '2026-03-01',
          jobId: 'job-123',
          jobName: 'Johnson Deck Rebuild',
          status: 'approved',
          submittedBy: 'Mike Johnson',
          submittedAt: '2026-03-01T14:30:00Z',
          paymentMethod: 'company_card',
          reimbursable: false,
          vendor: 'Home Depot',
          location: 'Store #1234'
        },
        {
          id: '2',
          amount: 45.50,
          description: 'Fuel for work truck',
          category: 'Fuel',
          date: '2026-03-02',
          status: 'pending',
          submittedBy: 'Sarah Wilson',
          submittedAt: '2026-03-02T08:15:00Z',
          paymentMethod: 'cash',
          reimbursable: true,
          vendor: 'Shell Station',
          mileage: 120
        },
        {
          id: '3',
          amount: 89.99,
          description: 'Safety equipment and hard hats',
          category: 'Tools & Equipment',
          date: '2026-03-03',
          jobId: 'job-456',
          jobName: 'Smith Roof Repair',
          status: 'reimbursed',
          submittedBy: 'Mike Johnson',
          submittedAt: '2026-03-03T11:20:00Z',
          approvedBy: 'Manager',
          approvedAt: '2026-03-03T16:45:00Z',
          paymentMethod: 'card',
          reimbursable: true
        }
      ];
      
      setExpenses(mockExpenses);
      setFilteredExpenses(mockExpenses);
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast({
        title: "Error",
        description: "Could not load expenses",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...expenses];

    // Apply filters
    if (filters.status !== 'all') {
      filtered = filtered.filter(expense => expense.status === filters.status);
    }
    if (filters.category !== 'all') {
      filtered = filtered.filter(expense => expense.category === filters.category);
    }
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const days = parseInt(filters.dateRange);
      const cutoff = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      filtered = filtered.filter(expense => new Date(expense.date) >= cutoff);
    }

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(expense =>
        expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.jobName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredExpenses(filtered);
  }, [expenses, filters, searchQuery]);

  // Calculate totals
  const totals = {
    total: filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0),
    pending: filteredExpenses.filter(exp => exp.status === 'pending').reduce((sum, exp) => sum + exp.amount, 0),
    approved: filteredExpenses.filter(exp => exp.status === 'approved').reduce((sum, exp) => sum + exp.amount, 0),
    reimbursed: filteredExpenses.filter(exp => exp.status === 'reimbursed').reduce((sum, exp) => sum + exp.amount, 0)
  };

  // Add new expense
  const handleAddExpense = (expense: Omit<Expense, 'id' | 'submittedAt'>) => {
    const newExpense: Expense = {
      ...expense,
      id: Date.now().toString(),
      submittedAt: new Date().toISOString()
    };
    
    setExpenses(prev => [newExpense, ...prev]);
    setShowAddExpense(false);
    
    toast({
      title: "Expense Added",
      description: `$${expense.amount.toFixed(2)} expense has been submitted`,
      variant: "default"
    });
  };

  // Export expenses to CSV
  const handleExportExpenses = () => {
    if (filteredExpenses.length === 0) {
      toast({ title: 'No Data', description: 'No expenses to export', variant: 'destructive' });
      return;
    }

    const headers = ['Date', 'Description', 'Category', 'Amount', 'Vendor', 'Job', 'Status', 'Payment Method', 'Submitted By', 'Reimbursable', 'Notes'];
    const rows = filteredExpenses.map((exp) => [
      exp.date,
      `"${exp.description.replace(/"/g, '""')}"`,
      exp.category,
      exp.amount.toFixed(2),
      exp.vendor || '',
      exp.jobName || '',
      exp.status,
      exp.paymentMethod,
      exp.submittedBy,
      exp.reimbursable ? 'Yes' : 'No',
      `"${(exp.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Exported', description: `${filteredExpenses.length} expenses exported to CSV` });
  };

  // Update expense status
  const updateExpenseStatus = (expenseId: string, status: Expense['status']) => {
    setExpenses(prev => prev.map(exp => 
      exp.id === expenseId 
        ? { 
            ...exp, 
            status,
            approvedAt: status === 'approved' ? new Date().toISOString() : exp.approvedAt,
            approvedBy: status === 'approved' ? 'Manager' : exp.approvedBy
          }
        : exp
    ));
    
    toast({
      title: "Status Updated",
      description: `Expense has been ${status}`,
      variant: "default"
    });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Get status color
  const getStatusColor = (status: Expense['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'reimbursed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status icon 
  const getStatusIcon = (status: Expense['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <AlertCircle className="w-4 h-4" />;
      case 'reimbursed': return <DollarSign className="w-4 h-4" />;
      default: return <Receipt className="w-4 h-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-6 h-6" />
          <h1 className="text-3xl font-bold">Expense Tracking</h1>
        </div>
        <Button onClick={() => setShowAddExpense(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Expenses</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.total)}</p>
              </div>
              <Receipt className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.pending)}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.approved)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Reimbursed</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.reimbursed)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search expenses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="reimbursed">Reimbursed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.category} onValueChange={(value) => setFilters({...filters, category: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {expenseCategories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.dateRange} onValueChange={(value) => setFilters({...filters, dateRange: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleExportExpenses}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expense List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Expenses ({filteredExpenses.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                variant={viewMode === 'cards' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setViewMode('cards')}
              >
                Cards
              </Button>
              <Button 
                variant={viewMode === 'list' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p>Loading expenses...</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No expenses found</p>
              <Button 
                onClick={() => setShowAddExpense(true)} 
                className="mt-4"
              >
                Add Your First Expense
              </Button>
            </div>
          ) : (
            <div className={viewMode === 'cards' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
              {filteredExpenses.map(expense => (
                <Card 
                  key={expense.id} 
                  className={`cursor-pointer hover:shadow-lg transition-shadow ${
                    viewMode === 'list' ? 'p-4' : ''
                  }`}
                  onClick={() => setSelectedExpense(expense)}
                >
                  <CardContent className={viewMode === 'cards' ? 'p-4' : 'p-0'}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">{expense.description}</h3>
                          <p className="text-sm text-gray-600">{expense.category}</p>
                          {expense.jobName && (
                            <p className="text-sm text-blue-600">{expense.jobName}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{formatCurrency(expense.amount)}</p>
                          <Badge className={getStatusColor(expense.status)}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(expense.status)}
                              {expense.status}
                            </div>
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(expense.date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {expense.submittedBy}
                        </div>
                      </div>

                      {expense.vendor && (
                        <div className="text-sm text-gray-600">
                          Vendor: {expense.vendor}
                        </div>
                      )}

                      {expense.receipt && (
                        <div className="flex items-center gap-1 text-sm text-green-600">
                          <Camera className="w-4 h-4" />
                          Receipt attached
                        </div>
                      )}

                      {viewMode === 'list' && (
                        <div className="flex gap-2">
                          {expense.status === 'pending' && (
                            <>
                              <Button 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateExpenseStatus(expense.id, 'approved');
                                }}
                              >
                                Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateExpenseStatus(expense.id, 'rejected');
                                }}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {expense.status === 'approved' && expense.reimbursable && (
                            <Button 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateExpenseStatus(expense.id, 'reimbursed');
                              }}
                            >
                              Mark Reimbursed
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Expense Modal */}
      <AddExpenseModal 
        open={showAddExpense} 
        onClose={() => setShowAddExpense(false)} 
        onSubmit={handleAddExpense}
        categories={expenseCategories}
      />

      {/* Expense Detail Modal */}
      <ExpenseDetailModal 
        expense={selectedExpense} 
        onClose={() => setSelectedExpense(null)} 
        onUpdateStatus={updateExpenseStatus}
      />
    </div>
  );
};

// Add Expense Modal Component
const AddExpenseModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (expense: Omit<Expense, 'id' | 'submittedAt'>) => void;
  categories: string[];
}> = ({ open, onClose, onSubmit, categories }) => {
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    location: '',
    paymentMethod: 'cash' as const,
    reimbursable: true,
    mileage: '',
    jobId: '',
    jobName: '',
    notes: '',
    receipt: '' as string,
  });
  const receiptInputRef = React.useRef<HTMLInputElement>(null);

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Receipt file must be under 10 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, receipt: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const expense: Omit<Expense, 'id' | 'submittedAt'> = {
      amount: parseFloat(formData.amount),
      description: formData.description,
      category: formData.category,
      date: formData.date,
      vendor: formData.vendor || undefined,
      location: formData.location || undefined,
      paymentMethod: formData.paymentMethod,
      reimbursable: formData.reimbursable,
      mileage: formData.mileage ? parseInt(formData.mileage) : undefined,
      jobId: formData.jobId || undefined,
      jobName: formData.jobName || undefined,
      notes: formData.notes || undefined,
      receipt: formData.receipt || undefined,
      status: 'pending',
      submittedBy: 'Current User' // Would come from auth context
    };

    onSubmit(expense);
    
    // Reset form
    setFormData({
      amount: '',
      description: '',
      category: '',
      date: new Date().toISOString().split('T')[0],
      vendor: '',
      location: '',
      paymentMethod: 'cash',
      reimbursable: true,
      mileage: '',
      jobId: '',
      jobName: '',
      notes: '',
      receipt: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Expense</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                required
              />
            </div>
            
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                required
              />
            </div>
            
            <div className="md:col-span-2">
              <Label>Description *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="What was this expense for?"
                required
              />
            </div>
            
            <div>
              <Label>Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Payment Method</Label>
              <Select value={formData.paymentMethod} onValueChange={(value: any) => setFormData({...formData, paymentMethod: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Personal Card</SelectItem>
                  <SelectItem value="company_card">Company Card</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Vendor</Label>
              <Input
                value={formData.vendor}
                onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                placeholder="Store or vendor name"
              />
            </div>
            
            <div>
              <Label>Job (Optional)</Label>
              <Input
                value={formData.jobName}
                onChange={(e) => setFormData({...formData, jobName: e.target.value})}
                placeholder="Associated job or project"
              />
            </div>
            
            <div className="md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Additional notes or details"
                rows={3}
              />
            </div>

            <div className="md:col-span-2">
              <Label>Receipt / Document</Label>
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleReceiptUpload}
                className="hidden"
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => receiptInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {formData.receipt ? 'Change File' : 'Upload Receipt'}
                </Button>
                {formData.receipt && (
                  <div className="flex items-center gap-2">
                    {formData.receipt.startsWith('data:image') ? (
                      <img src={formData.receipt} alt="Receipt" className="h-10 w-10 object-cover rounded border" />
                    ) : (
                      <FileText className="w-5 h-5 text-blue-600" />
                    )}
                    <span className="text-sm text-green-600 font-medium">Attached</span>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, receipt: ''})}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Max 10 MB — Images or PDF</p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Add Expense
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Expense Detail Modal Component
const ExpenseDetailModal: React.FC<{
  expense: Expense | null;
  onClose: () => void;
  onUpdateStatus: (expenseId: string, status: Expense['status']) => void;
}> = ({ expense, onClose, onUpdateStatus }) => {
  if (!expense) return null;

  return (
    <Dialog open={!!expense} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Expense Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount</Label>
              <p className="text-2xl font-bold">${expense.amount.toFixed(2)}</p>
            </div>
            <div>
              <Label>Status</Label>
              <Badge className={`${
                expense.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                expense.status === 'rejected' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {expense.status}
              </Badge>
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <p>{expense.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <p>{expense.category}</p>
            </div>
            <div>
              <Label>Date</Label>
              <p>{new Date(expense.date).toLocaleDateString()}</p>
            </div>
          </div>

          {expense.vendor && (
            <div>
              <Label>Vendor</Label>
              <p>{expense.vendor}</p>
            </div>
          )}

          {expense.jobName && (
            <div>
              <Label>Job</Label>
              <p>{expense.jobName}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Submitted By</Label>
              <p>{expense.submittedBy}</p>
            </div>
            <div>
              <Label>Submitted Date</Label>
              <p>{new Date(expense.submittedAt).toLocaleString()}</p>
            </div>
          </div>

          {expense.notes && (
            <div>
              <Label>Notes</Label>
              <p className="bg-gray-50 p-3 rounded">{expense.notes}</p>
            </div>
          )}

          {expense.receipt && (
            <div>
              <Label>Receipt / Document</Label>
              <div className="mt-1">
                {expense.receipt.startsWith('data:image') ? (
                  <a href={expense.receipt} target="_blank" rel="noopener noreferrer">
                    <img
                      src={expense.receipt}
                      alt="Receipt"
                      className="max-h-64 rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition"
                    />
                  </a>
                ) : (
                  <a
                    href={expense.receipt}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
                  >
                    <FileText className="w-4 h-4" />
                    View Attached Document
                  </a>
                )}
              </div>
            </div>
          )}

          {expense.status === 'pending' && (
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={() => onUpdateStatus(expense.id, 'approved')}
                className="flex-1"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button 
                variant="destructive"
                onClick={() => onUpdateStatus(expense.id, 'rejected')}
                className="flex-1"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          )}

          {expense.status === 'approved' && expense.reimbursable && (
            <div className="pt-4">
              <Button 
                onClick={() => onUpdateStatus(expense.id, 'reimbursed')}
                className="w-full"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Mark as Reimbursed
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseTracker;