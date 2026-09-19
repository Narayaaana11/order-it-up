'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useFormatDate } from '@/hooks/useFormatDate';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  X, 
  Tag, 
  Building2, 
  Wallet, 
  Calendar, 
  ArrowUpRight, 
  CreditCard,
  RefreshCw,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
}

interface ExpenseItem {
  id: string;
  category_id: string;
  category_name?: string;
  amount: number;
  payment_method: string;
  description: string;
  vendor_id: string | null;
  vendor_name?: string;
  expense_date: string;
  created_at: string;
}

interface Vendor {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  balance: number;
}

export default function ExpensesPage() {
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const [activeTab, setActiveTab] = useState<'expenses' | 'categories' | 'vendors'>('expenses');
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    category_id: '',
    amount: '',
    payment_method: 'cash',
    description: '',
    vendor_id: '',
    expense_date: new Date().toISOString().split('T')[0],
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  });

  const [vendorForm, setVendorForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    gstin: '',
    address: '',
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [expRes, catRes, venRes] = await Promise.allSettled([
        api.get('/api/expenses', { params: { start_date: startDate, end_date: endDate } }),
        api.get('/api/expenses/categories'),
        api.get('/api/vendors'),
      ]);

      if (expRes.status === 'fulfilled' && expRes.value.data) {
        setExpenses(expRes.value.data.expenses || []);
      }
      if (catRes.status === 'fulfilled' && catRes.value.data) {
        const cats = catRes.value.data.categories || [];
        setCategories(cats);
        if (cats.length > 0 && !expenseForm.category_id) {
          setExpenseForm(prev => ({ ...prev, category_id: cats[0].id }));
        }
      }
      if (venRes.status === 'fulfilled' && venRes.value.data) {
        setVendors(venRes.value.data.vendors || []);
      }
    } catch (err) {
      console.error('Failed to load expenses data', err);
      toast.error('Failed to load expense records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [startDate, endDate]);

  // Handle Save Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      toast.error('Enter a valid expense amount');
      return;
    }
    if (!expenseForm.description.trim()) {
      toast.error('Expense description is required');
      return;
    }

    try {
      await api.post('/api/expenses', {
        category_id: expenseForm.category_id,
        amount: Number(expenseForm.amount),
        payment_method: expenseForm.payment_method,
        description: expenseForm.description,
        vendor_id: expenseForm.vendor_id || null,
        expense_date: expenseForm.expense_date,
      });
      toast.success('Expense recorded successfully');
      setShowAddExpense(false);
      setExpenseForm({
        category_id: categories[0]?.id || '',
        amount: '',
        payment_method: 'cash',
        description: '',
        vendor_id: '',
        expense_date: new Date().toISOString().split('T')[0],
      });
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record expense');
    }
  };

  // Handle Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;

    try {
      await api.post('/api/expenses/categories', categoryForm);
      toast.success('Expense category created');
      setShowAddCategory(false);
      setCategoryForm({ name: '', description: '' });
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create category');
    }
  };

  // Handle Save Vendor
  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.name.trim()) return;

    try {
      await api.post('/api/vendors', vendorForm);
      toast.success('Vendor profile created');
      setShowAddVendor(false);
      setVendorForm({ name: '', contact_person: '', phone: '', email: '', gstin: '', address: '' });
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create vendor');
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await api.delete(`/api/expenses/${id}`);
      toast.success('Expense deleted');
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  // Summary Metrics
  const totalExpensesPeriod = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalCashExpenses = expenses
    .filter(item => item.payment_method === 'cash')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exp.vendor_name && exp.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || exp.category_id === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Expenses & Petty Cash</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 font-medium">
              Ledger Active
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Log daily kitchen payouts, raw milk/vegetable bills, maintenance costs, and vendor statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'expenses' && (
            <Button
              onClick={() => setShowAddExpense(true)}
              size="sm"
              className="gap-2 bg-primary text-primary-foreground"
            >
              <Plus className="w-4 h-4" />
              Record Expense
            </Button>
          )}
          {activeTab === 'categories' && (
            <Button
              onClick={() => setShowAddCategory(true)}
              size="sm"
              className="gap-2 bg-primary text-primary-foreground"
            >
              <Plus className="w-4 h-4" />
              New Category
            </Button>
          )}
          {activeTab === 'vendors' && (
            <Button
              onClick={() => setShowAddVendor(true)}
              size="sm"
              className="gap-2 bg-primary text-primary-foreground"
            >
              <Plus className="w-4 h-4" />
              Add Vendor
            </Button>
          )}
          <Button onClick={loadAll} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Outflow</span>
            <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-red-500">
              {formatCurrency(totalExpensesPeriod)}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">In selected date range</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Petty Cash Paid</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight">
              {formatCurrency(totalCashExpenses)}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Deducted from register drawer</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Vendors</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight">
              {vendors.length}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Suppliers & service providers</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/40 gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'expenses'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Expenses Log ({expenses.length})
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'categories'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Tag className="w-4 h-4" />
          Categories ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'vendors'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Vendors ({vendors.length})
        </button>
      </div>

      {/* TAB 1: EXPENSES LOG */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Controls & Date Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 max-w-xs bg-muted/40 border border-border/40 px-3 py-1.5 rounded-xl">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search description or vendor..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-transparent text-xs w-full focus:outline-none"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-muted/40 border border-border/40 text-xs rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 text-xs">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent font-mono focus:outline-none"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent font-mono focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground">
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Description</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Vendor</th>
                    <th className="py-3 px-4 font-medium">Payment Method</th>
                    <th className="py-3 px-4 font-medium text-right">Amount</th>
                    <th className="py-3 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filteredExpenses.length > 0 ? (
                    filteredExpenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {exp.expense_date}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {exp.description}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground">
                            {exp.category_name || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {exp.vendor_name || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize font-mono text-[11px]">
                            {exp.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-red-500">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            onClick={() => handleDeleteExpense(exp.id)}
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No expense records found for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div key={cat.id} className="p-4 rounded-2xl bg-card border border-border/50 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm">{cat.name}</h4>
                <Tag className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">{cat.description || 'No description provided'}</p>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: VENDORS */}
      {activeTab === 'vendors' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map(ven => (
            <div key={ven.id} className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/30">
                <div>
                  <h4 className="font-bold text-sm">{ven.name}</h4>
                  {ven.contact_person && (
                    <p className="text-xs text-muted-foreground mt-0.5">Contact: {ven.contact_person}</p>
                  )}
                </div>
                <Building2 className="w-5 h-5 text-primary" />
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                {ven.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{ven.phone}</span>
                  </div>
                )}
                {ven.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{ven.email}</span>
                  </div>
                )}
                {ven.gstin && (
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="font-semibold text-foreground">GSTIN:</span> {ven.gstin}
                  </div>
                )}
                {ven.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{ven.address}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <h3 className="font-bold text-base">Record New Expense</h3>
              <button onClick={() => setShowAddExpense(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Description / Purpose</label>
                <input
                  type="text"
                  required
                  value={expenseForm.description}
                  onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="e.g. Milk & Dairy daily delivery, Kitchen plumbing repair"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Amount</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 font-mono text-sm focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Payment Method</label>
                  <select
                    value={expenseForm.payment_method}
                    onChange={e => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
                  >
                    <option value="cash">Cash (Petty Drawer)</option>
                    <option value="upi">UPI / QR</option>
                    <option value="card">Debit / Credit Card</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Expense Category</label>
                  <select
                    value={expenseForm.category_id}
                    onChange={e => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Paid To Vendor (Optional)</label>
                  <select
                    value={expenseForm.vendor_id}
                    onChange={e => setExpenseForm({ ...expenseForm, vendor_id: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
                  >
                    <option value="">None / Local Store</option>
                    {vendors.map(ven => (
                      <option key={ven.id} value={ven.id}>
                        {ven.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Expense Date</label>
                <input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 font-mono focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowAddExpense(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Record Expense
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <h3 className="font-bold text-base">New Expense Category</h3>
              <button onClick={() => setShowAddCategory(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Category Name</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g., Dairy, LPG Gas, Cleaning"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium text-foreground">Description (Optional)</label>
                <input
                  type="text"
                  value={categoryForm.description}
                  onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowAddCategory(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Category</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showAddVendor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <h3 className="font-bold text-base">Register New Vendor</h3>
              <button onClick={() => setShowAddVendor(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSaveVendor} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Vendor / Business Name</label>
                <input
                  type="text"
                  required
                  value={vendorForm.name}
                  onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })}
                  placeholder="e.g., Metro Cash & Carry, Amul Dairy Supply"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Contact Person</label>
                  <input
                    type="text"
                    value={vendorForm.contact_person}
                    onChange={e => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Phone Number</label>
                  <input
                    type="text"
                    value={vendorForm.phone}
                    onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Email</label>
                  <input
                    type="email"
                    value={vendorForm.email}
                    onChange={e => setVendorForm({ ...vendorForm, email: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-foreground">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={vendorForm.gstin}
                    onChange={e => setVendorForm({ ...vendorForm, gstin: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none font-mono uppercase"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-medium text-foreground">Address / Notes</label>
                <input
                  type="text"
                  value={vendorForm.address}
                  onChange={e => setVendorForm({ ...vendorForm, address: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowAddVendor(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Vendor</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
