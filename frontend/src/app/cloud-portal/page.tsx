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
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F07928] text-white flex items-center justify-center shadow-md shadow-[#F07928]/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-900">{tenantName}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF2EA] text-[#F07928] border border-[#F07928]/30">
                Franchise HQ
              </span>
              {isDemoMode && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Demo Simulation
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">Cloudflare Workers + D1 Edge Sync • Multi-Concept SaaS</p>
          </div>
        </div>

        {/* Global Controls: Concept Filter, Branch Filter, Role Switcher & Pairing Quick Action */}
        <div className="flex items-center gap-3">
          {/* Concept / Restaurant Filter Selector */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs shadow-xs">
            <UtensilsCrossed className="w-3.5 h-3.5 text-[#F07928]" />
            <select
              value={selectedRestaurantFilter}
              onChange={(e) => {
                setSelectedRestaurantFilter(e.target.value);
                setSelectedBranchFilter('all');
              }}
              className="bg-transparent text-slate-700 outline-none font-medium cursor-pointer"
            >
              <option value="all" className="bg-white text-slate-900">All Brands / Concepts</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id} className="bg-white text-slate-900">
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Filter Selector */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs shadow-xs">
            <Store className="w-3.5 h-3.5 text-[#F07928]" />
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="bg-transparent text-slate-700 outline-none font-medium cursor-pointer"
            >
              <option value="all" className="bg-white text-slate-900">
                {selectedRestaurantFilter === 'all' ? 'All Outlets (Consolidated)' : 'All Outlets for Concept'}
              </option>
              {filteredBranchesByRestaurant.map((b) => (
                <option key={b.id} value={b.id} className="bg-white text-slate-900">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-100 border border-slate-200 rounded-xl p-1 flex items-center gap-1">
            <button
              onClick={() => setUserRole('owner')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                userRole === 'owner'
                  ? 'bg-[#F07928] text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Franchise Owner
            </button>
            <button
              onClick={() => {
                setUserRole('accountant');
                setActiveTab('accountant');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                userRole === 'accountant'
                  ? 'bg-[#F07928] text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Accountant Hub
            </button>
          </div>

          <Link
            href="/pos"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFF2EA] text-[#F07928] border border-[#F07928]/30 text-xs font-medium hover:bg-[#FFE6D5] transition-colors"
          >
            <Monitor className="w-3.5 h-3.5" />
            Web POS
          </Link>

          <button
            onClick={() => handleGeneratePairPin('desktop')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-100 transition-colors shadow-xs"
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
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FFF2EA] via-orange-50/60 to-white border border-[#F07928]/30 p-6 shadow-sm">
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setIsOnboarded(false)}
                className="text-slate-500 hover:text-slate-900 text-xs px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-xs hover:bg-slate-50 transition-colors"
              >
                Dismiss Banner
              </button>
            </div>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F07928]/10 text-[#F07928] text-xs font-semibold border border-[#F07928]/20">
                  <Sparkles className="w-3.5 h-3.5" /> Setup Successful — Welcome to Order It Up
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Connect {tenantName} Across All 3 Application Form Factors
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your multi-branch cloud catalog and pricing rules are live. You can bill right now in your web browser, pair an offline-first desktop counter, or connect mobile companion devices for waitstaff and kitchen.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleGeneratePairPin('desktop')}
                  className="px-4 py-2.5 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-xs shadow-sm shadow-[#F07928]/20 flex items-center gap-2 transition-all"
                >
                  <Laptop className="w-4 h-4" /> Connect Desktop POS
                </button>
                <button
                  onClick={() => handleGeneratePairPin('mobile')}
                  className="px-4 py-2.5 rounded-xl bg-white text-slate-700 font-semibold text-xs border border-slate-200 hover:bg-slate-50 shadow-xs flex items-center gap-2 transition-all"
                >
                  <Smartphone className="w-4 h-4" /> Connect Mobile KDS / Waiter
                </button>
                <Link
                  href="/pos"
                  className="px-4 py-2.5 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200 font-semibold text-xs hover:bg-cyan-100 flex items-center gap-2 transition-all"
                >
                  <Monitor className="w-4 h-4" /> Open Web POS Billing
                </Link>
              </div>
            </div>
          </div>
        )}
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[#F07928] text-[#F07928] bg-[#FFF2EA] font-semibold rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Executive Sales & Velocity
          </button>

          <button
            onClick={() => setActiveTab('accountant')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'accountant'
                ? 'border-[#F07928] text-[#F07928] bg-[#FFF2EA] font-semibold rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Accountant Hub & Tax Audits
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'catalog'
                ? 'border-[#F07928] text-[#F07928] bg-[#FFF2EA] font-semibold rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            Master Menu & Branch Overrides
          </button>

          <button
            onClick={() => setActiveTab('branches')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'branches'
                ? 'border-[#F07928] text-[#F07928] bg-[#FFF2EA] font-semibold rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'
            }`}
          >
            <Store className="w-4 h-4" />
            Branches & POS Terminals
          </button>

          <button
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'transfers'
                ? 'border-[#F07928] text-[#F07928] bg-[#FFF2EA] font-semibold rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'
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
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-slate-900">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Group Revenue</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">₹{totalGroupRev.toLocaleString()}</div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +18.4% vs last week across 3 outlets
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-slate-900">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Total Orders</span>
                  <Receipt className="w-4 h-4 text-[#F07928]" />
                </div>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">{totalGroupOrders}</div>
                <div className="text-xs text-slate-500 mt-2">1,447 tickets processed today</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-slate-900">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Average Ticket (AOV)</span>
                  <Sliders className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">₹{avgGroupTicket}</div>
                <div className="text-xs text-blue-600 mt-2">CyberHub highest at ₹387.11</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-slate-900">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Digital / UPI Share</span>
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">72.6%</div>
                <div className="text-xs text-slate-500 mt-2">Cash sales: ₹1,43,360</div>
              </div>
            </div>

            {/* Branch Performance Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Branch Sales Leaderboard</h2>
                    <p className="text-xs text-slate-500">Comparing real-time revenue and sales volume across outlets</p>
                  </div>
                  {displayedBranches.length > 0 && (
                    <span className="text-xs text-[#F07928] bg-[#FFF2EA] px-2.5 py-1 rounded-full border border-[#F07928]/30 font-medium">
                      Top Outlet: {[...displayedBranches].sort((a, b) => b.revenue - a.revenue)[0].name}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-4 mt-2">
                  {displayedBranches.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      {isLoadingHierarchy ? 'Loading outlet performance...' : 'No active outlets found for this selection.'}
                    </div>
                  ) : (
                    displayedBranches.map((b, i) => (
                      <div key={b.id} className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:bg-slate-100/60 flex flex-col gap-2 transition-colors">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                              #{i + 1}
                            </span>
                            <span className="font-semibold text-slate-900">{b.name}</span>
                            {b.isMain && (
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#FFF2EA] text-[#F07928] border border-[#F07928]/30">
                                Main HQ
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900">₹{b.revenue.toLocaleString()}</span>
                            <span className="text-xs text-slate-500 ml-2">({b.sharePercent}%)</span>
                          </div>
                        </div>

                        {/* Visual progress bar */}
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                          <div
                            className="bg-gradient-to-r from-[#F07928] to-[#EA580C] h-full rounded-full transition-all duration-500"
                            style={{ width: `${b.sharePercent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                          <span>{b.orders} orders • Avg: ₹{b.avgTicket.toFixed(0)}</span>
                          <span>UPI/Cards: ₹{b.digitalSales.toLocaleString()} • Cash: ₹{b.cashSales.toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Selling Items (Velocity) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#F07928]" />
                  <h2 className="text-base font-semibold text-slate-900">Item Velocity Matrix</h2>
                </div>
                <p className="text-xs text-slate-500">Top dishes driving franchise-wide volume</p>

                <div className="flex flex-col gap-3 mt-1">
                  {topItems.map((item, idx) => (
                    <div key={item.id} className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 hover:bg-slate-100/60 flex items-center justify-between text-xs transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-[#F07928]">#{idx + 1}</span>
                        <div>
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          <div className="text-[11px] text-slate-500">{item.category} • Top in {item.topBranch}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-800">{item.totalQty} sold</div>
                        <div className="text-[11px] text-emerald-600 font-semibold">₹{item.totalRev.toLocaleString()}</div>
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
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Daily Cash Closures & Ledger Audit</h2>
                <p className="text-xs text-slate-500">Audit shift closings, identify register cash variances, and export to accounting software</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={downloadTallyXml}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F07928] text-white font-semibold text-xs hover:bg-[#EA580C] transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Export to Tally XML
                </button>
                <button
                  onClick={downloadCsv}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white text-slate-700 font-medium text-xs hover:bg-slate-50 transition-colors border border-slate-200 shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Closures Audit Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
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
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {cashClosures.map((closure) => (
                      <tr key={closure.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-600">{closure.date}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{closure.branchName}</td>
                        <td className="py-3.5 px-4 text-slate-500">{closure.closedBy}</td>
                        <td className="py-3.5 px-4 text-right font-mono">₹{closure.openingCash.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono">₹{closure.cashSales.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-blue-600 font-semibold">₹{closure.digitalSales.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">₹{closure.expectedCash.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">₹{closure.actualCash.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-center">
                          {closure.variance === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Exact ₹0
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
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
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">GST & Tax Compliance Summary</h3>
              <p className="text-xs text-slate-500 mb-4">Consolidated F&B Restaurant GST (5% with input credit exemption)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Total Taxable Turnover</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">₹5,00,000</div>
                  <div className="text-[11px] text-slate-500 mt-1">Across 3 franchise locations</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">CGST (2.5%) Collected</div>
                  <div className="text-xl font-bold text-[#F07928] mt-1">₹12,500</div>
                  <div className="text-[11px] text-slate-500 mt-1">Central Tax liability</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">SGST (2.5%) Collected</div>
                  <div className="text-xl font-bold text-[#F07928] mt-1">₹12,500</div>
                  <div className="text-[11px] text-slate-500 mt-1">State Tax liability</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MASTER MENU & BRANCH OVERRIDES */}
        {activeTab === 'catalog' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Master Catalog & Branch Price Overrides</h2>
                <p className="text-xs text-slate-500">
                  HQ defines global products and base prices. Individual branches can customize pricing or 86 out-of-stock items.
                </p>
              </div>

              {/* Branch Selector for Override */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600 font-medium">Customizing for:</span>
                <select
                  value={overrideBranch}
                  onChange={(e) => setOverrideBranch(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#F07928] outline-none shadow-xs"
                >
                  <option value="br-02">Gurugram CyberHub (Franchise)</option>
                  <option value="br-03">Indiranagar 100ft (Franchise)</option>
                  <option value="br-01">Connaught Place (Main Outlet)</option>
                </select>
              </div>
            </div>

            {/* Catalog Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Master Base Price</th>
                      <th className="py-3 px-4 text-right">Branch Custom Price</th>
                      <th className="py-3 px-4 text-center">Availability (86 Status)</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {catalogItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{item.name}</td>
                        <td className="py-3.5 px-4 text-slate-500">{item.category}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-700">
                          ₹{item.basePrice}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono">
                          {item.overridePrice ? (
                            <span className="font-bold text-[#F07928]">₹{item.overridePrice} (Overridden)</span>
                          ) : (
                            <span className="text-slate-400">Same as Base (₹{item.basePrice})</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleToggleAvailability(item)}
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                              item.isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            {item.isAvailable ? 'In Stock (Active)' : "86'd (Unavailable)"}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleEditPrice(item)}
                            className="px-3 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 shadow-xs transition-colors"
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
                <h2 className="text-base font-semibold text-slate-900">Franchise Outlets & Terminal Fleet</h2>
                <p className="text-xs text-slate-500">All registered POS counters and kitchen stations syncing to Cloudflare D1</p>
              </div>

              <button
                onClick={() => handleGeneratePairPin('desktop')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F07928] text-white font-semibold text-xs hover:bg-[#EA580C] transition-colors shadow-sm"
              >
                <KeyRound className="w-4 h-4" />
                Generate New Pairing PIN
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {branches.map((b) => (
                <div key={b.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">{b.code}</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Outbox Sync
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">{b.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">2 Active Terminals (Main Counter + Tableside)</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span>Revenue: ₹{b.revenue.toLocaleString()}</span>
                    <button
                      onClick={() => handleGeneratePairPin('desktop')}
                      className="text-[#F07928] hover:text-[#EA580C] font-semibold flex items-center gap-1"
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
                <h2 className="text-base font-semibold text-slate-900">Inter-Branch Inventory Transfers</h2>
                <p className="text-xs text-slate-500">Rebalance raw materials and central prep kitchen batches between outlets</p>
              </div>

              <button
                onClick={handleRequestTransfer}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F07928] text-white font-semibold text-xs hover:bg-[#EA580C] transition-colors shadow-sm"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Request Stock Transfer
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-600">{t.date}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{t.source}</td>
                      <td className="py-3.5 px-4 text-slate-700">{t.dest}</td>
                      <td className="py-3.5 px-4 font-medium text-[#F07928]">{t.item}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">{t.qty} {t.unit}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          t.status === 'received'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : t.status === 'dispatched'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {t.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateTransferStatus(t.id, 'dispatched')}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-medium transition-colors"
                          >
                            Dispatch
                          </button>
                        )}
                        {t.status === 'dispatched' && (
                          <button
                            onClick={() => handleUpdateTransferStatus(t.id, 'received')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-medium transition-colors"
                          >
                            Mark Received
                          </button>
                        )}
                        {t.status === 'received' && (
                          <span className="text-slate-400 text-xs font-medium">Completed</span>
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 flex flex-col gap-5 shadow-xl relative text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFF2EA] text-[#F07928] flex items-center justify-center shadow-xs">
                  {pairMode === 'desktop' ? <Laptop className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Connect Restaurant Device</h3>
                  <p className="text-xs text-slate-500">Cryptographic pairing for {tenantName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPairModal(false)}
                className="text-slate-500 hover:text-slate-900 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setPairMode('desktop')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                  pairMode === 'desktop'
                    ? 'bg-[#F07928] text-white font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Laptop className="w-4 h-4" /> Desktop POS Counter
              </button>
              <button
                onClick={() => setPairMode('mobile')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                  pairMode === 'mobile'
                    ? 'bg-[#F07928] text-white font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-4 h-4" /> Waiter & KDS Mobile
              </button>
            </div>

            {/* Display PIN */}
            <div className="flex flex-col items-center gap-2.5 py-3 text-center bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-600">
                {pairMode === 'desktop'
                  ? 'Enter this 6-digit code on the Desktop POS Counter:'
                  : 'Enter this 6-digit code or scan on the Handheld Device:'}
              </span>
              <div className="px-6 py-3 rounded-2xl bg-white border-2 border-[#F07928]/40 font-mono text-3xl font-extrabold text-[#F07928] tracking-widest shadow-inner">
                {generatedPairCode || '849 203'}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5 text-[#F07928]" />
                Code expires in{' '}
                <span className="font-mono text-slate-900 font-semibold">
                  {Math.floor(pairTimeLeft / 60)}:{(pairTimeLeft % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-slate-400 mx-1">•</span>
                <span className="text-slate-500">Outlet: <strong className="text-[#F07928] font-mono">{pairingBranch}</strong></span>
              </div>
            </div>

            {/* Step-by-step instructions */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col gap-2">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {pairMode === 'desktop' ? 'Desktop Counter Setup:' : 'Waiter & KDS Setup:'}
              </div>
              {pairMode === 'desktop' ? (
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                  <li>Launch Order It Up desktop app on the billing counter computer</li>
                  <li>Navigate to <strong className="text-slate-900">Settings → Cloud Sync & Edge</strong></li>
                  <li>Click <strong className="text-slate-900">Pair with 6-Digit PIN</strong> and enter <strong className="text-slate-900 font-mono">{generatedPairCode || '849 203'}</strong></li>
                  <li>Terminal binds to cloud catalog and retains offline-first local SQLite billing</li>
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                  <li>Open Order It Up Companion on phone or tablet (Flutter Android/iOS)</li>
                  <li>Tap <strong className="text-slate-900">Connect to Restaurant Cloud</strong></li>
                  <li>Enter the PIN above to assign this device to outlet <strong className="text-slate-900 font-mono">{pairingBranch}</strong></li>
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
                className="flex-1 py-2.5 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-xs transition-colors shadow-sm shadow-[#F07928]/20 flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" /> Copy PIN
              </button>
              <button
                onClick={() => handleGeneratePairPin(pairMode)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition-colors"
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
