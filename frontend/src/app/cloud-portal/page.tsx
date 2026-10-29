'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Store,
  DollarSign,
  Receipt,
  Download,
  KeyRound,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Copy,
  Clock,
  ChevronRight,
  ShieldCheck,
  Building2,
  Flame,
  UtensilsCrossed,
  Sliders,
  Laptop
} from 'lucide-react';

interface BranchSale {
  id: string;
  name: string;
  code: string;
  isMain: boolean;
  revenue: number;
  orders: number;
  avgTicket: number;
  cashSales: number;
  digitalSales: number;
  sharePercent: number;
}

interface ItemVelocity {
  id: string;
  name: string;
  category: string;
  totalQty: number;
  totalRev: number;
  topBranch: string;
}

interface CashClosure {
  id: string;
  date: string;
  branchName: string;
  openingCash: number;
  cashSales: number;
  digitalSales: number;
  expectedCash: number;
  actualCash: number;
  variance: number;
  closedBy: string;
  status: 'balanced' | 'variance';
}

interface ProductCatalogItem {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  taxRate: number;
  overridePrice?: number | null;
  isAvailable: boolean;
}

interface TransferRecord {
  id: string;
  source: string;
  dest: string;
  item: string;
  qty: number;
  unit: string;
  status: 'pending' | 'dispatched' | 'received';
  date: string;
}

export default function CloudPortalPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'accountant' | 'catalog' | 'branches' | 'transfers' | 'live'>('overview');
  const [userRole, setUserRole] = useState<'owner' | 'accountant'>('owner');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [overrideBranch, setOverrideBranch] = useState<string>('br-02');

  // Pairing Modal state
  const [showPairModal, setShowPairModal] = useState(false);
  const [generatedPairCode, setGeneratedPairCode] = useState<string | null>(null);
  const [pairingBranch, setPairingBranch] = useState('br-02');
  const [pairTimeLeft, setPairTimeLeft] = useState(900); // 15 mins

  // Mock initial data reflecting Cloudflare D1 synced state
  const [branches, setBranches] = useState<BranchSale[]>([
    {
      id: 'br-01',
      name: 'Connaught Place (Main Outlet)',
      code: 'CP-DEL',
      isMain: true,
      revenue: 284500,
      orders: 820,
      avgTicket: 346.95,
      cashSales: 85350,
      digitalSales: 199150,
      sharePercent: 54,
    },
    {
      id: 'br-02',
      name: 'Gurugram CyberHub (Franchise)',
      code: 'CYB-GGN',
      isMain: false,
      revenue: 198200,
      orders: 512,
      avgTicket: 387.11,
      cashSales: 49550,
      digitalSales: 148650,
      sharePercent: 38,
    },
    {
      id: 'br-03',
      name: 'Indiranagar 100ft (Franchise)',
      code: 'IND-BLR',
      isMain: false,
      revenue: 42300,
      orders: 115,
      avgTicket: 367.82,
      cashSales: 8460,
      digitalSales: 33840,
      sharePercent: 8,
    },
  ]);

  const [topItems, setTopItems] = useState<ItemVelocity[]>([
    { id: 'item-1', name: 'Butter Chicken Biryani Box', category: 'Mains', totalQty: 412, totalRev: 144200, topBranch: 'Connaught Place' },
    { id: 'item-2', name: 'Woodfired Truffle Margherita', category: 'Pizzas', totalQty: 328, totalRev: 160720, topBranch: 'Gurugram CyberHub' },
    { id: 'item-3', name: 'Iced Hazelnut Cold Brew', category: 'Beverages', totalQty: 540, totalRev: 118800, topBranch: 'Gurugram CyberHub' },
    { id: 'item-4', name: 'Paneer Tikka Kebab Platter', category: 'Starters', totalQty: 295, totalRev: 97350, topBranch: 'Connaught Place' },
    { id: 'item-5', name: 'Belgian Chocolate Waffle', category: 'Desserts', totalQty: 210, totalRev: 52500, topBranch: 'Indiranagar 100ft' },
  ]);

  const [cashClosures, setCashClosures] = useState<CashClosure[]>([
    {
      id: 'cl-01',
      date: '2026-10-11',
      branchName: 'Connaught Place (Main)',
      openingCash: 5000,
      cashSales: 28400,
      digitalSales: 62100,
      expectedCash: 33400,
      actualCash: 33400,
      variance: 0,
      closedBy: 'Rajesh Kumar (Manager)',
      status: 'balanced',
    },
    {
      id: 'cl-02',
      date: '2026-10-11',
      branchName: 'Gurugram CyberHub',
      openingCash: 5000,
      cashSales: 18200,
      digitalSales: 51200,
      expectedCash: 23200,
      actualCash: 23050,
      variance: -150,
      closedBy: 'Ananya Roy (Cashier)',
      status: 'variance',
    },
    {
      id: 'cl-03',
      date: '2026-10-10',
      branchName: 'Connaught Place (Main)',
      openingCash: 5000,
      cashSales: 31200,
      digitalSales: 74500,
      expectedCash: 36200,
      actualCash: 36200,
      variance: 0,
      closedBy: 'Rajesh Kumar (Manager)',
      status: 'balanced',
    },
    {
      id: 'cl-04',
      date: '2026-10-10',
      branchName: 'Indiranagar 100ft',
      openingCash: 4000,
      cashSales: 8460,
      digitalSales: 33840,
      expectedCash: 12460,
      actualCash: 12460,
      variance: 0,
      closedBy: 'Karthik Rao (Manager)',
      status: 'balanced',
    },
  ]);

  const [catalogItems, setCatalogItems] = useState<ProductCatalogItem[]>([
    { id: 'p-1', name: 'Butter Chicken Biryani Box', category: 'Mains', basePrice: 350, taxRate: 5, overridePrice: 375, isAvailable: true },
    { id: 'p-2', name: 'Woodfired Truffle Margherita', category: 'Pizzas', basePrice: 490, taxRate: 5, overridePrice: null, isAvailable: true },
    { id: 'p-3', name: 'Iced Hazelnut Cold Brew', category: 'Beverages', basePrice: 220, taxRate: 5, overridePrice: 240, isAvailable: true },
    { id: 'p-4', name: 'Paneer Tikka Kebab Platter', category: 'Starters', basePrice: 330, taxRate: 5, overridePrice: null, isAvailable: false },
    { id: 'p-5', name: 'Belgian Chocolate Waffle', category: 'Desserts', basePrice: 250, taxRate: 5, overridePrice: null, isAvailable: true },
  ]);

  const [transfers, setTransfers] = useState<TransferRecord[]>([
    { id: 'tr-1', source: 'Connaught Place (Main)', dest: 'Gurugram CyberHub', item: 'Specialty Coffee Beans (KG)', qty: 15, unit: 'kg', status: 'received', date: '2026-10-10' },
    { id: 'tr-2', source: 'Connaught Place (Main)', dest: 'Indiranagar 100ft', item: 'Signature Spice Blend', qty: 25, unit: 'packs', status: 'dispatched', date: '2026-10-11' },
    { id: 'tr-3', source: 'Gurugram CyberHub', dest: 'Connaught Place (Main)', item: 'Truffle Oil 500ml', qty: 4, unit: 'bottles', status: 'pending', date: '2026-10-12' },
  ]);

  // Timer for 6-digit PIN
  useEffect(() => {
    if (!showPairModal || pairTimeLeft <= 0) return;
    const interval = setInterval(() => setPairTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, [showPairModal, pairTimeLeft]);

  // Fetch live overview, closures, catalog, and transfers from backend
  useEffect(() => {
    fetch('/api/cloud/overview')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.branches && Array.isArray(data.branches)) setBranches(data.branches);
        if (data?.top_items && Array.isArray(data.top_items)) setTopItems(data.top_items);
      })
      .catch(() => {});

    fetch('/api/cloud/closures')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.closures && Array.isArray(data.closures)) setCashClosures(data.closures);
      })
      .catch(() => {});

    fetch('/api/cloud/catalog')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.items && Array.isArray(data.items)) setCatalogItems(data.items);
      })
      .catch(() => {});

    fetch('/api/cloud/transfers')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.transfers && Array.isArray(data.transfers)) setTransfers(data.transfers);
      })
      .catch(() => {});
  }, []);

  const handleGeneratePairPin = () => {
    const code = `${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)}`;
    setGeneratedPairCode(code);
    setPairTimeLeft(900);
    setShowPairModal(true);

    fetch('/api/cloud/pair/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: pairingBranch }),
    }).catch(() => {});
  };

  const handleToggleAvailability = (item: ProductCatalogItem) => {
    const updated = !item.isAvailable;
    setCatalogItems(catalogItems.map((p) => (p.id === item.id ? { ...p, isAvailable: updated } : p)));
    fetch('/api/cloud/catalog/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: item.id, is_available: updated }),
    }).catch(() => {});
  };

  const handleEditPrice = (item: ProductCatalogItem) => {
    const newPrice = prompt(
      `Enter custom price for ${item.name} at this branch (leave blank to reset to base):`,
      item.overridePrice ? String(item.overridePrice) : ''
    );
    if (newPrice !== null) {
      const priceVal = newPrice.trim() ? Number(newPrice) : null;
      setCatalogItems(catalogItems.map((p) => (p.id === item.id ? { ...p, overridePrice: priceVal } : p)));
      fetch('/api/cloud/catalog/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: item.id, price_override: priceVal }),
      }).catch(() => {});
    }
  };

  const handleRequestTransfer = () => {
    const item = prompt('Enter Item Name / Raw Material to transfer:');
    if (!item) return;
    const qtyStr = prompt('Enter Quantity:', '10');
    const qty = qtyStr ? Number(qtyStr) : 10;
    const newTransfer: TransferRecord = {
      id: `tr-${Date.now()}`,
      source: 'Connaught Place (Main Outlet)',
      dest: 'Gurugram CyberHub (Franchise)',
      item,
      qty,
      unit: 'units',
      status: 'pending',
      date: new Date().toISOString().split('T')[0],
    };
    setTransfers([newTransfer, ...transfers]);
    fetch('/api/cloud/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTransfer),
    }).catch(() => {});
  };

  const handleUpdateTransferStatus = (id: string, status: 'dispatched' | 'received') => {
    setTransfers(transfers.map((tr) => (tr.id === id ? { ...tr, status } : tr)));
    fetch(`/api/cloud/transfers/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  };

  // Dynamically calculate metrics based on branch filter
  const displayedBranches = selectedBranchFilter === 'all'
    ? branches
    : branches.filter((b) => b.id === selectedBranchFilter);

  const displayedClosures = selectedBranchFilter === 'all'
    ? cashClosures
    : cashClosures.filter((c) => {
        const match = branches.find((b) => b.id === selectedBranchFilter);
        return match && c.branchName.toLowerCase().includes(match.name.split(' ')[0].toLowerCase());
      });

  const totalGroupRev = displayedBranches.reduce((acc, b) => acc + b.revenue, 0);
  const totalGroupOrders = displayedBranches.reduce((acc, b) => acc + b.orders, 0);
  const avgGroupTicket = totalGroupOrders > 0 ? (totalGroupRev / totalGroupOrders).toFixed(2) : '0';

  const downloadTallyXml = () => {
    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>
        ${cashClosures.map((c) => `
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>${c.date.replace(/-/g, '')}</DATE>
            <NARRATION>POS Day Closure: ${c.branchName}</NARRATION>
            <AMOUNT>-${c.cashSales}</AMOUNT>
          </VOUCHER>
        </TALLYMESSAGE>`).join('')}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tally_POS_Export_${new Date().toISOString().split('T')[0]}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const headers = ['Date', 'Branch', 'Closed By', 'Opening Cash', 'Cash Sales', 'Digital Sales', 'Expected Cash', 'Actual Cash', 'Variance', 'Status'];
    const rows = displayedClosures.map((c) => [
      c.date,
      `"${c.branchName}"`,
      `"${c.closedBy}"`,
      c.openingCash,
      c.cashSales,
      c.digitalSales,
      c.expectedCash,
      c.actualCash,
      c.variance,
      c.status,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `POS_Cash_Closures_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Top Executive Navigation Bar */}
      <header className="border-b border-slate-800 bg-[#0F172A]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">TasteCraft Hospitality</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Franchise HQ
              </span>
            </div>
            <p className="text-xs text-slate-400">Cloudflare Workers + D1 Edge Sync • Global Latency 18ms</p>
          </div>
        </div>

        {/* Global Controls: Branch Filter, Role Switcher & Pairing Quick Action */}
        <div className="flex items-center gap-3">
          {/* Branch Filter Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
            <Store className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="bg-transparent text-slate-200 outline-none font-medium cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Branches (Consolidated)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center gap-1">
            <button
              onClick={() => setUserRole('owner')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                userRole === 'owner'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Franchise Owner
            </button>
            <button
              onClick={() => {
                setUserRole('accountant');
                setActiveTab('accountant');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                userRole === 'accountant'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Accountant Hub
            </button>
          </div>

          <button
            onClick={handleGeneratePairPin}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Pair POS Terminal
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Executive Sales & Velocity
          </button>

          <button
            onClick={() => setActiveTab('accountant')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'accountant'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Accountant Hub & Tax Audits
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'catalog'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            Master Menu & Branch Overrides
          </button>

          <button
            onClick={() => setActiveTab('branches')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'branches'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Store className="w-4 h-4" />
            Branches & POS Terminals
          </button>

          <button
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'transfers'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Stock Transfers
          </button>
        </div>

        {/* TAB 1: EXECUTIVE OVERVIEW & BRANCH VELOCITY */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6">
            {/* KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Group Revenue</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">₹{totalGroupRev.toLocaleString()}</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400 font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +18.4% vs last week across 3 outlets
                </div>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Total Orders</span>
                  <Receipt className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">{totalGroupOrders}</div>
                <div className="text-xs text-slate-400 mt-2">1,447 tickets processed today</div>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Average Ticket (AOV)</span>
                  <Sliders className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">₹{avgGroupTicket}</div>
                <div className="text-xs text-cyan-400 mt-2">CyberHub highest at ₹387.11</div>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Digital / UPI Share</span>
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">72.6%</div>
                <div className="text-xs text-slate-400 mt-2">Cash sales: ₹1,43,360</div>
              </div>
            </div>

            {/* Branch Performance Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">Branch Sales Leaderboard</h2>
                    <p className="text-xs text-slate-400">Comparing real-time revenue and sales volume across outlets</p>
                  </div>
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 font-medium">
                    Top Outlet: Connaught Place
                  </span>
                </div>

                <div className="flex flex-col gap-4 mt-2">
                  {branches.map((b, i) => (
                    <div key={b.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center">
                            #{i + 1}
                          </span>
                          <span className="font-semibold text-white">{b.name}</span>
                          {b.isMain && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                              Main HQ
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-white">₹{b.revenue.toLocaleString()}</span>
                          <span className="text-xs text-slate-400 ml-2">({b.sharePercent}%)</span>
                        </div>
                      </div>

                      {/* Visual progress bar */}
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-orange-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${b.sharePercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                        <span>{b.orders} orders • Avg: ₹{b.avgTicket.toFixed(0)}</span>
                        <span>UPI/Cards: ₹{b.digitalSales.toLocaleString()} • Cash: ₹{b.cashSales.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Selling Items (Velocity) */}
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base font-semibold text-white">Item Velocity Matrix</h2>
                </div>
                <p className="text-xs text-slate-400">Top dishes driving franchise-wide volume</p>

                <div className="flex flex-col gap-3 mt-1">
                  {topItems.map((item, idx) => (
                    <div key={item.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-amber-400">#{idx + 1}</span>
                        <div>
                          <div className="font-semibold text-white">{item.name}</div>
                          <div className="text-[11px] text-slate-400">{item.category} • Top in {item.topBranch}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-200">{item.totalQty} sold</div>
                        <div className="text-[11px] text-emerald-400">₹{item.totalRev.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ACCOUNTANT FINANCIAL HUB & TAX AUDIT */}
        {activeTab === 'accountant' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111827] p-5 rounded-2xl border border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-white">Daily Cash Closures & Ledger Audit</h2>
                <p className="text-xs text-slate-400">Audit shift closings, identify register cash variances, and export to accounting software</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={downloadTallyXml}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors shadow-md shadow-amber-500/10"
                >
                  <Download className="w-4 h-4" />
                  Export to Tally XML
                </button>
                <button
                  onClick={downloadCsv}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 text-white font-medium text-xs hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Closures Audit Table */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Branch</th>
                      <th className="py-3 px-4">Closed By</th>
                      <th className="py-3 px-4 text-right">Opening Cash</th>
                      <th className="py-3 px-4 text-right">Cash Sales</th>
                      <th className="py-3 px-4 text-right">Card / UPI</th>
                      <th className="py-3 px-4 text-right">Expected Drawer</th>
                      <th className="py-3 px-4 text-right">Actual Counted</th>
                      <th className="py-3 px-4 text-center">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {cashClosures.map((closure) => (
                      <tr key={closure.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-300">{closure.date}</td>
                        <td className="py-3.5 px-4 font-semibold text-white">{closure.branchName}</td>
                        <td className="py-3.5 px-4 text-slate-400">{closure.closedBy}</td>
                        <td className="py-3.5 px-4 text-right font-mono">₹{closure.openingCash.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono">₹{closure.cashSales.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-cyan-400">₹{closure.digitalSales.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold">₹{closure.expectedCash.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold">₹{closure.actualCash.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-center">
                          {closure.variance === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Exact ₹0
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <AlertCircle className="w-3 h-3" /> ₹{closure.variance} Short
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* GST Breakdown Grid */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-1">GST & Tax Compliance Summary</h3>
              <p className="text-xs text-slate-400 mb-4">Consolidated F&B Restaurant GST (5% with input credit exemption)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">Total Taxable Turnover</div>
                  <div className="text-xl font-bold text-white mt-1">₹5,00,000</div>
                  <div className="text-[11px] text-slate-500 mt-1">Across 3 franchise locations</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">CGST (2.5%) Collected</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">₹12,500</div>
                  <div className="text-[11px] text-slate-500 mt-1">Central Tax liability</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">SGST (2.5%) Collected</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">₹12,500</div>
                  <div className="text-[11px] text-slate-500 mt-1">State Tax liability</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MASTER MENU & BRANCH OVERRIDES */}
        {activeTab === 'catalog' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111827] p-5 rounded-2xl border border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-white">Master Catalog & Branch Price Overrides</h2>
                <p className="text-xs text-slate-400">
                  HQ defines global products and base prices. Individual branches can customize pricing or 86 out-of-stock items.
                </p>
              </div>

              {/* Branch Selector for Override */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium">Customizing for:</span>
                <select
                  value={overrideBranch}
                  onChange={(e) => setOverrideBranch(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="br-02">Gurugram CyberHub (Franchise)</option>
                  <option value="br-03">Indiranagar 100ft (Franchise)</option>
                  <option value="br-01">Connaught Place (Main Outlet)</option>
                </select>
              </div>
            </div>

            {/* Catalog Table */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Master Base Price</th>
                      <th className="py-3 px-4 text-right">Branch Custom Price</th>
                      <th className="py-3 px-4 text-center">Availability (86 Status)</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {catalogItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">{item.name}</td>
                        <td className="py-3.5 px-4 text-slate-400">{item.category}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-300">
                          ₹{item.basePrice}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono">
                          {item.overridePrice ? (
                            <span className="font-bold text-amber-400">₹{item.overridePrice} (Overridden)</span>
                          ) : (
                            <span className="text-slate-500">Same as Base (₹{item.basePrice})</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleToggleAvailability(item)}
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                              item.isAvailable
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                            }`}
                          >
                            {item.isAvailable ? 'In Stock (Active)' : "86'd (Unavailable)"}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleEditPrice(item)}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                          >
                            Edit Price
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BRANCHES & TERMINAL PAIRING */}
        {activeTab === 'branches' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Franchise Outlets & Terminal Fleet</h2>
                <p className="text-xs text-slate-400">All registered POS counters and kitchen stations syncing to Cloudflare D1</p>
              </div>

              <button
                onClick={handleGeneratePairPin}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
              >
                <KeyRound className="w-4 h-4" />
                Generate New Pairing PIN
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {branches.map((b) => (
                <div key={b.id} className="bg-[#111827] border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">{b.code}</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Outbox Sync
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white">{b.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">2 Active Terminals (Main Counter + Tableside)</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                    <span>Revenue: ₹{b.revenue.toLocaleString()}</span>
                    <button
                      onClick={handleGeneratePairPin}
                      className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                    >
                      Pair Terminal <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: STOCK TRANSFERS */}
        {activeTab === 'transfers' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Inter-Branch Inventory Transfers</h2>
                <p className="text-xs text-slate-400">Rebalance raw materials and central prep kitchen batches between outlets</p>
              </div>

              <button
                onClick={handleRequestTransfer}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Request Stock Transfer
              </button>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Origin Outlet</th>
                    <th className="py-3 px-4">Destination Outlet</th>
                    <th className="py-3 px-4">Material / Item</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono">{t.date}</td>
                      <td className="py-3.5 px-4 font-semibold text-white">{t.source}</td>
                      <td className="py-3.5 px-4 text-slate-300">{t.dest}</td>
                      <td className="py-3.5 px-4 font-medium text-amber-300">{t.item}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">{t.qty} {t.unit}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          t.status === 'received'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : t.status === 'dispatched'
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {t.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateTransferStatus(t.id, 'dispatched')}
                            className="px-2.5 py-1 rounded-lg bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/30 text-xs font-medium"
                          >
                            Dispatch
                          </button>
                        )}
                        {t.status === 'dispatched' && (
                          <button
                            onClick={() => handleUpdateTransferStatus(t.id, 'received')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-medium"
                          >
                            Mark Received
                          </button>
                        )}
                        {t.status === 'received' && (
                          <span className="text-slate-500 text-xs">Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 6-DIGIT POS TERMINAL PAIRING MODAL */}
      {showPairModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl max-w-md w-full p-6 flex flex-col gap-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Laptop className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Pair POS Counter</h3>
                  <p className="text-xs text-slate-400">One-time cryptographic terminal enrollment</p>
                </div>
              </div>
              <button
                onClick={() => setShowPairModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-md bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <span className="text-xs text-slate-400">Enter this 6-digit code on the POS Terminal:</span>
              <div className="px-6 py-4 rounded-2xl bg-slate-900 border-2 border-amber-500/40 font-mono text-3xl font-extrabold text-amber-400 tracking-widest shadow-inner">
                {generatedPairCode || '849 203'}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Code expires in{' '}
                <span className="font-mono text-white font-semibold">
                  {Math.floor(pairTimeLeft / 60)}:{(pairTimeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex flex-col gap-2">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Instructions for Counter Cashier:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>On the desktop POS counter, open <strong>Settings → Cloud Sync</strong></li>
                <li>Click <strong>Connect with 6-Digit PIN</strong></li>
                <li>Enter the code above and click <strong>Verify & Pair</strong></li>
              </ol>
            </div>

            <button
              onClick={() => {
                navigator.clipboard?.writeText((generatedPairCode || '849 203').replace(/\s/g, ''));
                alert('Pairing PIN copied to clipboard!');
              }}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" /> Copy PIN to Clipboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
