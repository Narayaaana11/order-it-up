'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Laptop,
  Monitor,
  Smartphone,
  Sparkles,
  ExternalLink,
  QrCode
} from 'lucide-react';
import { cloudApi } from '@/lib/api';

interface RestaurantConcept {
  id: string;
  name: string;
  slug?: string;
  concept_type?: string;
  status: string;
}

interface BranchSale {
  id: string;
  restaurant_id?: string;
  restaurant_name?: string;
  name: string;
  code: string;
  isMain: boolean;
  revenue: number;
  orders: number;
  avgTicket: number;
  cashSales: number;
  digitalSales: number;
  sharePercent: number;
  is_demo?: boolean;
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
  const [restaurants, setRestaurants] = useState<RestaurantConcept[]>([]);
  const [selectedRestaurantFilter, setSelectedRestaurantFilter] = useState<string>('all');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [overrideBranch, setOverrideBranch] = useState<string>('');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState<boolean>(true);

  // Pairing Modal state
  const [showPairModal, setShowPairModal] = useState(false);
  const [generatedPairCode, setGeneratedPairCode] = useState<string | null>(null);
  const [pairingBranch, setPairingBranch] = useState('br-01');
  const [pairTimeLeft, setPairTimeLeft] = useState(900); // 15 mins
  const [tenantName, setTenantName] = useState('Order It Up Restaurant Group');
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [pairMode, setPairMode] = useState<'desktop' | 'mobile'>('desktop');

  // Database-backed live sales and locations
  const [branches, setBranches] = useState<BranchSale[]>([]);
  const [topItems, setTopItems] = useState<ItemVelocity[]>([]);
  const [cashClosures, setCashClosures] = useState<CashClosure[]>([]);

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

  // Check onboarding flag and tenant storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('onboarded') === 'true') {
        setIsOnboarded(true);
      }
      try {
        const stored = localStorage.getItem('tenant');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.organization?.name) {
            setTenantName(parsed.organization.name);
          }
          if (parsed.branch?.id) {
            setPairingBranch(parsed.branch.id);
          }
        }
      } catch {}
    }
  }, []);

  // Timer for 6-digit PIN
  useEffect(() => {
    if (!showPairModal || pairTimeLeft <= 0) return;
    const interval = setInterval(() => setPairTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, [showPairModal, pairTimeLeft]);

  // Fetch live overview, restaurants, closures, catalog, and transfers from Cloudflare Edge Worker
  useEffect(() => {
    setIsLoadingHierarchy(true);

    // 1. Fetch authorized restaurant concepts
    cloudApi.get('/api/restaurants')
      .then((res) => {
        const data = res.data;
        if (data?.restaurants && Array.isArray(data.restaurants)) {
          setRestaurants(data.restaurants);
        }
      })
      .catch(() => {});

    // 2. Fetch multi-location overview
    cloudApi.get('/api/analytics/overview')
      .then((res) => {
        const data = res.data;
        if (data?.branches && Array.isArray(data.branches)) {
          setBranches(data.branches);
          if (data.branches[0]?.id && !overrideBranch) {
            setOverrideBranch(data.branches[0].id);
            setPairingBranch(data.branches[0].id);
          }
        }
        if (data?.top_items && Array.isArray(data.top_items)) {
          setTopItems(data.top_items);
        }
        if (data?.is_demo) {
          setIsDemoMode(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoadingHierarchy(false);
      });

    // 3. Fetch closures
    cloudApi.get('/api/accountant/closures')
      .then((res) => {
        const data = res.data;
        if (data?.closures && Array.isArray(data.closures)) setCashClosures(data.closures);
      })
      .catch(() => {});

    // 4. Fetch catalog
    cloudApi.get('/api/catalog/master')
      .then((res) => {
        const data = res.data;
        if (data?.items && Array.isArray(data.items)) setCatalogItems(data.items);
      })
      .catch(() => {});

    // 5. Fetch transfers
    cloudApi.get('/api/transfers')
      .then((res) => {
        const data = res.data;
        if (data?.transfers && Array.isArray(data.transfers)) setTransfers(data.transfers);
      })
      .catch(() => {});
  }, []);

  const handleGeneratePairPin = async (mode?: 'desktop' | 'mobile' | unknown) => {
    const selectedMode = mode === 'mobile' ? 'mobile' : 'desktop';
    setPairMode(selectedMode);
    const fallbackPin = `${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)}`;
    setGeneratedPairCode(fallbackPin);
    setPairTimeLeft(900);
    setShowPairModal(true);

    try {
      let token = '';
      try {
        const stored = localStorage.getItem('tenant');
        if (stored) {
          token = JSON.parse(stored).token || '';
        }
      } catch {}

      const res = await cloudApi.post<{ pin?: string }>('/api/pairing/generate', { branch_id: pairingBranch }, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.data?.pin) {
        const pin = String(res.data.pin);
        setGeneratedPairCode(pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin);
      }
    } catch {
      // Keep fallback random pin
    }
  };

  const handleToggleAvailability = (item: ProductCatalogItem) => {
    const updated = !item.isAvailable;
    setCatalogItems(catalogItems.map((p) => (p.id === item.id ? { ...p, isAvailable: updated } : p)));
    cloudApi.post('/api/cloud/catalog/override', {
      product_id: item.id,
      is_available: updated,
      branch_id: overrideBranch,
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
      cloudApi.post('/api/cloud/catalog/override', {
        product_id: item.id,
        price_override: priceVal,
        branch_id: overrideBranch,
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
    cloudApi.post('/api/transfers', newTransfer).catch(() => {});
  };

  const handleUpdateTransferStatus = (id: string, status: 'dispatched' | 'received') => {
    setTransfers(transfers.map((tr) => (tr.id === id ? { ...tr, status } : tr)));
    cloudApi.patch(`/api/transfers/${id}/status`, { status }).catch(() => {});
  };

  // Filter branches by selected restaurant concept, then by selected branch
  const filteredBranchesByRestaurant = selectedRestaurantFilter === 'all'
    ? branches
    : branches.filter((b) => !b.restaurant_id || b.restaurant_id === selectedRestaurantFilter);

  const displayedBranches = selectedBranchFilter === 'all'
    ? filteredBranchesByRestaurant
    : filteredBranchesByRestaurant.filter((b) => b.id === selectedBranchFilter);

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
              <h1 className="text-lg font-bold tracking-tight text-white">{tenantName}</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Franchise HQ
              </span>
              {isDemoMode && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Demo Simulation
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">Cloudflare Workers + D1 Edge Sync • Multi-Concept SaaS</p>
          </div>
        </div>

        {/* Global Controls: Concept Filter, Branch Filter, Role Switcher & Pairing Quick Action */}
        <div className="flex items-center gap-3">
          {/* Concept / Restaurant Filter Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={selectedRestaurantFilter}
              onChange={(e) => {
                setSelectedRestaurantFilter(e.target.value);
                setSelectedBranchFilter('all');
              }}
              className="bg-transparent text-slate-200 outline-none font-medium cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Brands / Concepts</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Filter Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
            <Store className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="bg-transparent text-slate-200 outline-none font-medium cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">
                {selectedRestaurantFilter === 'all' ? 'All Outlets (Consolidated)' : 'All Outlets for Concept'}
              </option>
              {filteredBranchesByRestaurant.map((b) => (
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

          <Link
            href="/pos"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-medium hover:bg-amber-500/20 transition-colors"
          >
            <Monitor className="w-3.5 h-3.5" />
            Web POS
          </Link>

          <button
            onClick={() => handleGeneratePairPin('desktop')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Connect Devices
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Tri-Platform Onboarding & Connection Hub Banner */}
        {isOnboarded && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-slate-900 border border-amber-500/30 p-6 shadow-xl backdrop-blur-sm">
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setIsOnboarded(false)}
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 transition-colors"
              >
                Dismiss Banner
              </button>
            </div>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30">
                  <Sparkles className="w-3.5 h-3.5" /> Setup Successful — Welcome to Order It Up
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Connect {tenantName} Across All 3 Application Form Factors
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your multi-branch cloud catalog and pricing rules are live. You can bill right now in your web browser, pair an offline-first desktop counter, or connect mobile companion devices for waitstaff and kitchen.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleGeneratePairPin('desktop')}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs hover:brightness-110 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all"
                >
                  <Laptop className="w-4 h-4" /> Connect Desktop POS
                </button>
                <button
                  onClick={() => handleGeneratePairPin('mobile')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-white font-semibold text-xs border border-slate-700 hover:bg-slate-700 flex items-center gap-2 transition-all"
                >
                  <Smartphone className="w-4 h-4" /> Connect Mobile KDS / Waiter
                </button>
                <Link
                  href="/pos"
                  className="px-4 py-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-xs hover:bg-cyan-500/30 flex items-center gap-2 transition-all"
                >
                  <Monitor className="w-4 h-4" /> Open Web POS Billing
                </Link>
              </div>
            </div>
          </div>
        )}
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
                  {displayedBranches.length > 0 && (
                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 font-medium">
                      Top Outlet: {[...displayedBranches].sort((a, b) => b.revenue - a.revenue)[0].name}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-4 mt-2">
                  {displayedBranches.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800 text-xs">
                      {isLoadingHierarchy ? 'Loading outlet performance...' : 'No active outlets found for this selection.'}
                    </div>
                  ) : (
                    displayedBranches.map((b, i) => (
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
                    ))
                  )}
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

      {/* MULTI-PLATFORM DEVICE PAIRING MODAL */}
      {showPairModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl max-w-lg w-full p-6 flex flex-col gap-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
                  {pairMode === 'desktop' ? <Laptop className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Connect Restaurant Device</h3>
                  <p className="text-xs text-slate-400">Cryptographic pairing for {tenantName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPairModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setPairMode('desktop')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                  pairMode === 'desktop'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Laptop className="w-4 h-4" /> Desktop POS Counter
              </button>
              <button
                onClick={() => setPairMode('mobile')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                  pairMode === 'mobile'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" /> Waiter & KDS Mobile
              </button>
            </div>

            {/* Display PIN */}
            <div className="flex flex-col items-center gap-2.5 py-3 text-center bg-slate-900/50 rounded-2xl border border-slate-800/80">
              <span className="text-xs text-slate-400">
                {pairMode === 'desktop'
                  ? 'Enter this 6-digit code on the Desktop POS Counter:'
                  : 'Enter this 6-digit code or scan on the Handheld Device:'}
              </span>
              <div className="px-6 py-3 rounded-2xl bg-slate-950 border-2 border-amber-500/40 font-mono text-3xl font-extrabold text-amber-400 tracking-widest shadow-inner">
                {generatedPairCode || '849 203'}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Code expires in{' '}
                <span className="font-mono text-white font-semibold">
                  {Math.floor(pairTimeLeft / 60)}:{(pairTimeLeft % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-slate-500 mx-1">•</span>
                <span className="text-slate-400">Outlet: <strong className="text-amber-300 font-mono">{pairingBranch}</strong></span>
              </div>
            </div>

            {/* Step-by-step instructions */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex flex-col gap-2">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                {pairMode === 'desktop' ? 'Desktop Counter Setup:' : 'Waiter & KDS Setup:'}
              </div>
              {pairMode === 'desktop' ? (
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                  <li>Launch Order It Up desktop app on the billing counter computer</li>
                  <li>Navigate to <strong>Settings → Cloud Sync & Edge</strong></li>
                  <li>Click <strong>Pair with 6-Digit PIN</strong> and enter <strong className="text-white font-mono">{generatedPairCode || '849 203'}</strong></li>
                  <li>Terminal binds to cloud catalog and retains offline-first local SQLite billing</li>
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                  <li>Open Order It Up Companion on phone or tablet (Flutter Android/iOS)</li>
                  <li>Tap <strong>Connect to Restaurant Cloud</strong></li>
                  <li>Enter the PIN above to assign this device to outlet <strong className="text-white font-mono">{pairingBranch}</strong></li>
                  <li>Staff can immediately punch table orders and view live kitchen tickets</li>
                </ol>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText((generatedPairCode || '849 203').replace(/\s/g, ''));
                  alert('Pairing PIN copied to clipboard!');
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" /> Copy PIN
              </button>
              <button
                onClick={() => handleGeneratePairPin(pairMode)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              >
                Regenerate PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
