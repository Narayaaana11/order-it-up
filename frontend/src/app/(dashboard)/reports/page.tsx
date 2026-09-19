'use client';

import { useState, useEffect, useTransition } from 'react';
import api from '@/lib/api';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useFormatDate } from '@/hooks/useFormatDate';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Receipt, 
  Users, 
  Calendar, 
  Download, 
  PieChart, 
  ArrowUpRight, 
  RotateCcw,
  Sparkles,
  Layers,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface FinancialStats {
  startDate: string;
  endDate: string;
  grossCollected: number;
  refunded: number;
  netCollected: number;
  billCount: number;
  refundCount: number;
  averageOrderValue: number;
  paymentMethods: { method: string | null; count: number; total: number }[];
}

interface TopProduct {
  product_id: number;
  product_name: string;
  category_name?: string;
  total_quantity: number;
  total_revenue: number;
  order_count: number;
}

interface TopStaff {
  user_id: string;
  name: string;
  role: string;
  revenue: number;
  orderCount: number;
}

interface TaxStats {
  totalTax: number;
  taxableAmount: number;
  components?: { name: string; rate: number; amount: number }[];
}

export default function ReportsPage() {
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();
  const [isPending, startTransition] = useTransition();

  // Date filters: preset or custom
  const [preset, setPreset] = useState<'today' | 'yesterday' | '7days' | '30days'>('today');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Data states
  const [financial, setFinancial] = useState<FinancialStats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topStaff, setTopStaff] = useState<TopStaff[]>([]);
  const [taxStats, setTaxStats] = useState<TaxStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick preset dates
  const handlePreset = (newPreset: 'today' | 'yesterday' | '7days' | '30days') => {
    setPreset(newPreset);
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    if (newPreset === 'today') {
      const d = fmt(today);
      setStartDate(d);
      setEndDate(d);
    } else if (newPreset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const d = fmt(y);
      setStartDate(d);
      setEndDate(d);
    } else if (newPreset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 6);
      setStartDate(fmt(past));
      setEndDate(fmt(today));
    } else if (newPreset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 29);
      setStartDate(fmt(past));
      setEndDate(fmt(today));
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = { start_date: startDate, end_date: endDate };

      const [finRes, prodRes, staffRes, taxRes] = await Promise.allSettled([
        api.get('/api/reports/financial', { params }).catch(() => api.get('/api/reports/financial-summary', { params })),
        api.get('/api/reports/top-products', { params }).catch(() => api.get('/api/reports/topProducts', { params })),
        api.get('/api/reports/top-staff', { params }).catch(() => api.get('/api/reports/insights', { params: { days: 30 } })),
        api.get('/api/reports/tax-liability', { params }).catch(() => api.get('/api/reports/tax-components', { params })),
      ]);

      if (finRes.status === 'fulfilled' && finRes.value.data) {
        const d = finRes.value.data.financialSummary || finRes.value.data;
        setFinancial(d);
      }
      if (prodRes.status === 'fulfilled' && prodRes.value.data) {
        const raw = prodRes.value.data.products || prodRes.value.data.topProducts || [];
        const normalized = raw.map((p: any) => ({
          product_id: p.product_id || p.id,
          product_name: p.product_name || p.name,
          total_quantity: p.total_quantity || p.quantity || 0,
          total_revenue: p.total_revenue || p.revenue || 0,
          order_count: p.order_count || 1,
        }));
        setTopProducts(normalized);
      }
      if (staffRes.status === 'fulfilled' && staffRes.value.data) {
        const raw = staffRes.value.data.staff || staffRes.value.data.topStaff || [];
        setTopStaff(raw);
      }
      if (taxRes.status === 'fulfilled' && taxRes.value.data) {
        const d = taxRes.value.data;
        if (d.taxComponents) {
          setTaxStats({
            totalTax: d.taxComponents.taxAmount,
            taxableAmount: 0,
            components: d.taxComponents.components,
          });
        } else {
          setTaxStats(d);
        }
      }
    } catch (err) {
      console.error('Failed to load reports', err);
      toast.error('Could not load all reports data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      fetchReports();
    });
  }, [startDate, endDate]);

  // Export CSV generator
  const exportToCSV = () => {
    if (!financial) return;

    let csv = `Order It Up - Financial & Sales Report\n`;
    csv += `Period: ${startDate} to ${endDate}\n\n`;

    csv += `Executive Summary\n`;
    csv += `Gross Collected,${financial.grossCollected}\n`;
    csv += `Refunds,${financial.refunded}\n`;
    csv += `Net Collected,${financial.netCollected}\n`;
    csv += `Total Bills,${financial.billCount}\n`;
    csv += `Average Order Value,${financial.averageOrderValue}\n\n`;

    csv += `Payment Methods Breakdown\n`;
    csv += `Method,Transactions,Amount\n`;
    (financial.paymentMethods || []).forEach(pm => {
      csv += `${pm.method || 'Unknown'},${pm.count},${pm.total}\n`;
    });

    csv += `\nTop Performing Items\n`;
    csv += `Product Name,Units Sold,Revenue,Orders Count\n`;
    topProducts.forEach(p => {
      csv += `"${p.product_name}",${p.total_quantity},${p.total_revenue},${p.order_count}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OIU_Report_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded successfully');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Business Intelligence & Reports</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
              Real-time Analytics
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track revenue, peak traffic hours, staff productivity, and tax liabilities with 100% local precision.
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-muted/60 p-1 rounded-lg flex items-center gap-1 border border-border/40">
            <button
              onClick={() => handlePreset('today')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                preset === 'today' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handlePreset('yesterday')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                preset === 'yesterday' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => handlePreset('7days')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                preset === '7days' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => handlePreset('30days')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                preset === '30days' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              30 Days
            </button>
          </div>

          <div className="flex items-center gap-1 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/40 text-xs">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent focus:outline-none text-foreground font-mono"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent focus:outline-none text-foreground font-mono"
            />
          </div>

          <Button
            onClick={exportToCSV}
            variant="outline"
            size="sm"
            className="gap-2 border-emerald-500/30 hover:border-emerald-500/60 text-emerald-600 dark:text-emerald-400"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Collected */}
        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {financial ? formatCurrency(financial.netCollected) : '...'}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
              <span>Gross: {financial ? formatCurrency(financial.grossCollected) : '...'}</span>
            </div>
          </div>
        </div>

        {/* Total Orders / Bills */}
        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Invoices</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {financial ? financial.billCount : '...'}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
              <span>Refunds: {financial?.refundCount || 0}</span>
            </div>
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg Ticket Size (AOV)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {financial ? formatCurrency(financial.averageOrderValue) : '...'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5">Per guest / table bill</p>
          </div>
        </div>

        {/* Tax Collected */}
        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tax Liability</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {taxStats ? formatCurrency(taxStats.totalTax) : '...'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5">
              On {taxStats ? formatCurrency(taxStats.taxableAmount) : '...'} taxable
            </p>
          </div>
        </div>
      </div>

      {/* Second Row: Payment Breakdown & Staff Productivity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods Breakdown */}
        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">Payment Methods</h4>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {financial?.paymentMethods?.length || 0} Methods
            </span>
          </div>

          <div className="space-y-3">
            {financial?.paymentMethods && financial.paymentMethods.length > 0 ? (
              financial.paymentMethods.map((pm, idx) => {
                const totalGross = financial.grossCollected || 1;
                const percentage = Math.min(100, Math.round((pm.total / totalGross) * 100));
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium capitalize">{pm.method || 'Other'}</span>
                      <span className="text-muted-foreground font-mono">
                        {formatCurrency(pm.total)} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pm.method === 'cash'
                            ? 'bg-emerald-500'
                            : pm.method === 'card'
                            ? 'bg-blue-500'
                            : pm.method === 'upi'
                            ? 'bg-amber-500'
                            : 'bg-primary'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">No payment records in selected range.</p>
            )}
          </div>
        </div>

        {/* Staff Sales Performance */}
        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">Staff Sales Performance</h4>
            </div>
            <span className="text-xs text-muted-foreground">Floor Captains & Cashiers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="pb-2 font-medium">Staff Member</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium text-right">Orders Taken</th>
                  <th className="pb-2 font-medium text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {topStaff.length > 0 ? (
                  topStaff.map((staff, i) => (
                    <tr key={staff.user_id || i} className="hover:bg-muted/20">
                      <td className="py-2.5 font-medium flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                          {staff.name.charAt(0)}
                        </span>
                        {staff.name}
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-semibold bg-muted text-muted-foreground">
                          {staff.role}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono">{staff.orderCount}</td>
                      <td className="py-2.5 text-right font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(staff.revenue)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      No staff sales data recorded for this time window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Third Row: Top Selling Dishes / Products */}
      <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm">Top Selling Products & Velocity</h4>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {topProducts.length} Products Sold
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="pb-2 font-medium w-12 text-center">#</th>
                <th className="pb-2 font-medium">Product Name</th>
                <th className="pb-2 font-medium text-right">Units Sold</th>
                <th className="pb-2 font-medium text-right">Orders Count</th>
                <th className="pb-2 font-medium text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {topProducts.length > 0 ? (
                topProducts.map((prod, idx) => (
                  <tr key={prod.product_id || idx} className="hover:bg-muted/20">
                    <td className="py-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                    <td className="py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{prod.product_name}</span>
                        {idx === 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20">
                            ★ Bestseller
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-right font-mono font-semibold">{prod.total_quantity}</td>
                    <td className="py-3 text-right font-mono text-muted-foreground">{prod.order_count}</td>
                    <td className="py-3 text-right font-mono font-bold text-foreground">
                      {formatCurrency(prod.total_revenue)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No item sales records found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
