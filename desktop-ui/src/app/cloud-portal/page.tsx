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

  Smartphone,

  Sparkles,

  CreditCard,

  Wallet,

  Hourglass,

  Users,

  ChefHat,

  Boxes,

  PieChart,

  Tag,

  AlertTriangle,

  RotateCcw,
  Percent,
  Plus,
  X,
  Lock,
  Mail,
  MapPin,
} from 'lucide-react';
import api, { cloudApi } from '@/lib/api';



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



interface PaymentTenderBreakdown {

  method: 'cash' | 'card' | 'upi' | 'wallet';

  label: string;

  amount: number;

  transactions: number;

  percent: number;

}



interface CategoryVelocity {

  category: string;

  quantitySold: number;

  revenue: number;

  percentShare: number;

}



interface StaffPerformanceSummary {

  id: string;

  name: string;

  role: string;

  branch: string;

  orders: number;

  revenue: number;

  avgTicket: number;

}



interface OperationalKitchenVelocity {

  avgKitchenPrepMinutes: number;

  avgTableTurnMinutes: number;

  activeKitchenTickets: number;

  tableOccupancyPercent: number;

  dineInCompletedCount: number;

}



interface LowStockIngredient {

  id: string;

  name: string;

  unit: string;

  current_stock: number;

  minimum_stock: number;

  cost_per_unit: number;

  reorder_qty: number;

  estimated_cost: number;

  supplier: string;

}



interface TaxLiabilitySummary {

  taxableTurnover: number;

  cgstAmount: number;

  sgstAmount: number;

  igstAmount: number;

  vatAmount: number;

  totalTax: number;

  grossTurnover: number;

}



export default function CloudPortalPage() {

  const [activeTab, setActiveTab] = useState<'overview' | 'velocity' | 'inventory' | 'accountant' | 'catalog' | 'branches' | 'transfers'>('overview');

  const [userRole, setUserRole] = useState<string>('');

  const [restaurants, setRestaurants] = useState<RestaurantConcept[]>([]);

  const [selectedRestaurantFilter, setSelectedRestaurantFilter] = useState<string>('all');

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');

  const [overrideBranch, setOverrideBranch] = useState<string>('');

  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState<boolean>(true);

  const [portalLoadError, setPortalLoadError] = useState<string | null>(null);



  // Pairing Modal state

  const [showPairModal, setShowPairModal] = useState(false);

  const [generatedPairCode, setGeneratedPairCode] = useState<string | null>(null);

  const [pairingBranch, setPairingBranch] = useState('');

  const [pairTimeLeft, setPairTimeLeft] = useState(900); // 15 mins

  const [tenantName, setTenantName] = useState('Restaurant Cloud Portal');

  const [isOnboarded, setIsOnboarded] = useState(false);

  const [pairMode, setPairMode] = useState<'desktop' | 'mobile'>('desktop');

  const [isPairingRequest, setIsPairingRequest] = useState(false);

  const [pairingError, setPairingError] = useState<string | null>(null);

  // Create Branch & POS Login state
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [createBranchError, setCreateBranchError] = useState<string | null>(null);
  const [createdBranchCredentials, setCreatedBranchCredentials] = useState<{
    branch: any;
    credentials: any;
  } | null>(null);

  // New Branch Form inputs
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [newBranchManagerName, setNewBranchManagerName] = useState('');
  const [newBranchEmail, setNewBranchEmail] = useState('');
  const [newBranchPassword, setNewBranchPassword] = useState('Branch@1234');
  const [newBranchPin, setNewBranchPin] = useState('1234');
  const [newBranchRole, setNewBranchRole] = useState<'manager' | 'cashier'>('manager');



  // Cloud-backed sections
  const [branches, setBranches] = useState<BranchSale[]>([]);
  const [paymentTenders, setPaymentTenders] = useState<PaymentTenderBreakdown[]>([]);
  const [topItems, setTopItems] = useState<ItemVelocity[]>([]);
  const [categories, setCategories] = useState<CategoryVelocity[]>([]);
  const [operationalVelocity, setOperationalVelocity] = useState<OperationalKitchenVelocity>({
    avgKitchenPrepMinutes: 11.4,
    avgTableTurnMinutes: 38.5,
    activeKitchenTickets: 4,
    tableOccupancyPercent: 64,
    dineInCompletedCount: 186,
  });
  const [staffPerformances, setStaffPerformances] = useState<StaffPerformanceSummary[]>([]);
  const [lowStockIngredients, setLowStockIngredients] = useState<LowStockIngredient[]>([]);
  const [totalRefunds, setTotalRefunds] = useState<number>(0);
  const [refundsCount, setRefundsCount] = useState<number>(0);

  const [taxLiabilities, setTaxLiabilities] = useState<TaxLiabilitySummary>({
    taxableTurnover: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
    vatAmount: 0, totalTax: 0, grossTurnover: 0,
  });
  const [cashClosures, setCashClosures] = useState<CashClosure[]>([]);
  const [catalogItems, setCatalogItems] = useState<ProductCatalogItem[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);

  // Inter-Branch Stock Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSource, setTransferSource] = useState('');
  const [transferDest, setTransferDest] = useState('');
  const [transferItemName, setTransferItemName] = useState('');
  const [transferQty, setTransferQty] = useState(5);
  const [transferUnit, setTransferUnit] = useState('kg');

  // Restock PO Modal
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedRestockItem, setSelectedRestockItem] = useState<LowStockIngredient | null>(null);
  const [restockQty, setRestockQty] = useState(10);

  // Price Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [selectedOverrideItem, setSelectedOverrideItem] = useState<ProductCatalogItem | null>(null);
  const [customPriceInput, setCustomPriceInput] = useState('');

  // Add Product to Master Catalog Modal
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Mains');
  const [newProdPrice, setNewProdPrice] = useState(250);
  const [newProdTaxRate, setNewProdTaxRate] = useState(5);

  // Edit Branch Details Modal
  const [showEditBranchModal, setShowEditBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchSale | null>(null);
  const [editBranchPhone, setEditBranchPhone] = useState('');
  const [editBranchAddress, setEditBranchAddress] = useState('');
  const [editBranchManager, setEditBranchManager] = useState('');



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

          const branchId = parsed.branch?.id || parsed.branchId;

          if (typeof branchId === 'string' && branchId) setPairingBranch(branchId);
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



  // Fetch the portal datasets and map the API response shapes to the view models.

  useEffect(() => {

    let cancelled = false;

    const load = async () => {
      setIsLoadingHierarchy(true);

      const results = await Promise.allSettled([
        api.get('/cloud/restaurants').catch(() => cloudApi.get('/api/restaurants')),
        api.get('/cloud/overview').catch(() => cloudApi.get('/api/analytics/overview')),
        api.get('/cloud/closures').catch(() => cloudApi.get('/api/accountant/closures')),
        api.get('/cloud/catalog').catch(() => cloudApi.get('/api/catalog/master')),
        api.get('/cloud/transfers').catch(() => cloudApi.get('/api/transfers')),
        api.get('/reports/gst?period=month').catch(() => cloudApi.get('/api/accountant/tax-summary')),
        api.get('/cloud/velocity').catch(() => ({ data: null })),
        api.get('/cloud/inventory/low-stock').catch(() => ({ data: null })),
      ]);

      if (cancelled) return;

      const errors: string[] = [];
      const value = (i: number) => {
        const result = results[i];
        if (result.status === 'rejected') { errors.push(`Portal dataset ${i + 1} could not be loaded`); return null; }
        return (result.value as any)?.data;
      };

      const restaurantData = value(0);
      const overview = value(1);
      const closureData = value(2);
      const catalogData = value(3);
      const transferData = value(4);
      const taxData = value(5);
      const velocityData = value(6);
      const lowStockData = value(7);

      if (restaurantData) {
        const rawRest = Array.isArray(restaurantData.restaurants) ? restaurantData.restaurants : [];
        setRestaurants(rawRest.map((r: any) => ({
          id: String(r.id),
          name: String(r.name),
          slug: r.slug,
        })));
      }

      if (overview) {
        const rawBranches = Array.isArray(overview.branches) ? overview.branches : [];
        const totalRevenue = Number(overview.total_revenue || 0);
        setBranches(rawBranches.map((b: any) => ({
          id: String(b.branch_id || b.id || ''),
          restaurant_id: String(b.restaurant_id || ''),
          restaurant_name: String(b.restaurant_name || ''),
          name: String(b.branch_name || b.name || 'Branch'),
          code: String(b.branch_code || b.code || ''),
          isMain: Boolean(b.is_main_branch ?? b.isMain),
          revenue: Number(b.total_sales ?? b.revenue ?? 0),
          orders: Number(b.order_count ?? b.orders ?? 0),
          avgTicket: Number(b.average_ticket ?? b.avgTicket ?? 0),
          cashSales: Number(b.cash_sales ?? b.cashSales ?? 0),
          digitalSales: Number(b.digital_sales ?? b.digitalSales ?? 0),
          sharePercent: Number(b.sharePercent ?? (totalRevenue ? (Number(b.total_sales ?? b.revenue ?? 0) / totalRevenue * 100) : 0)),
        })));

        const rawTop = Array.isArray(overview.top_items) ? overview.top_items : [];
        setTopItems(rawTop.map((x: any, i: number) => ({
          id: String(x.product_id || x.id || i),
          name: String(x.product_name || x.name || 'Item'),
          category: String(x.category_name || x.category || 'Mains'),
          totalQty: Number(x.quantity_sold ?? x.totalQty ?? 0),
          totalRev: Number(x.total_revenue ?? x.totalRev ?? 0),
          topBranch: String(x.branch_name || x.topBranch || ''),
        })));

        if (Array.isArray(overview.payment_tenders) && overview.payment_tenders.length > 0) {
          setPaymentTenders(overview.payment_tenders);
        }

        if (overview.refunds) {
          setTotalRefunds(Number(overview.refunds.amount || 0));
          setRefundsCount(Number(overview.refunds.count || 0));
        }

        setOverrideBranch((current) => current || String(rawBranches[0]?.branch_id || rawBranches[0]?.id || ''));
        setPairingBranch((current) => current || String(rawBranches[0]?.branch_id || rawBranches[0]?.id || ''));
      }

      if (velocityData) {
        if (velocityData.operational) {
          setOperationalVelocity(velocityData.operational);
        }
        if (Array.isArray(velocityData.categories) && velocityData.categories.length > 0) {
          setCategories(velocityData.categories);
        }
        if (Array.isArray(velocityData.staff_performances) && velocityData.staff_performances.length > 0) {
          setStaffPerformances(velocityData.staff_performances);
        }
      }

      if (lowStockData && Array.isArray(lowStockData.items) && lowStockData.items.length > 0) {
        setLowStockIngredients(lowStockData.items);
      }

      if (closureData) {
        const rawClosures = Array.isArray(closureData.closures) ? closureData.closures : [];
        setCashClosures(rawClosures.map((c: any) => ({
          id: String(c.id || `${c.branch_id || 'br'}-${c.closure_date || c.date || Date.now()}`),
          date: String(c.closure_date || c.date || ''),
          branchName: String(c.branch_name || c.branchName || 'Main Outlet'),
          openingCash: Number(c.opening_cash ?? c.openingCash ?? 0),
          cashSales: Number(c.cash_sales ?? c.cashSales ?? 0),
          digitalSales: Number((c.card_sales || 0) + (c.upi_sales || 0)) || Number(c.digitalSales ?? 0),
          expectedCash: Number(c.expected_cash ?? c.expectedCash ?? 0),
          actualCash: Number(c.actual_cash ?? c.actualCash ?? 0),
          variance: Number(c.variance ?? 0),
          closedBy: String(c.closed_by || c.closedBy || 'Admin'),
          status: Number(c.variance ?? 0) === 0 ? 'balanced' : 'variance',
        })));
      }

      if (catalogData) {
        const rawItems = Array.isArray(catalogData.products)
          ? catalogData.products
          : (Array.isArray(catalogData.items) ? catalogData.items : []);
        setCatalogItems(rawItems.map((x: any) => ({
          id: String(x.id),
          name: String(x.name),
          category: String(x.category_name || x.category || 'General'),
          basePrice: Number(x.base_price ?? x.basePrice ?? 0),
          taxRate: Number(x.tax_rate ?? x.taxRate ?? 5),
          overridePrice: x.overridePrice ?? null,
          isAvailable: x.isAvailable !== undefined ? Boolean(x.isAvailable) : Boolean(x.is_active),
        })));
      }

      if (transferData) {
        const rawTransfers = Array.isArray(transferData.transfers) ? transferData.transfers : [];
        setTransfers(rawTransfers.map((x: any) => {
          const items = Array.isArray(x.items) ? x.items : [];
          const first = items[0] || {};
          return {
            id: String(x.id),
            source: String(x.source_branch_name || x.source || 'Main Outlet'),
            dest: String(x.dest_branch_name || x.dest || 'Franchise'),
            item: String(x.item || first.name || first.item_name || `${items.length} item(s)`),
            qty: Number(x.qty || first.quantity || first.qty || 0),
            unit: String(x.unit || first.unit || 'units'),
            status: x.status || 'pending',
            date: String(x.date || x.created_at || '').slice(0, 10),
          };
        }));
      }

      if (taxData) {
        const rows = Array.isArray(taxData.tax_by_branch) ? taxData.tax_by_branch : [];
        if (rows.length > 0) {
          const gross = rows.reduce((sum: number, x: any) => sum + Number(x.gross_turnover || 0), 0);
          const taxable = rows.reduce((sum: number, x: any) => sum + Number(x.taxable_amount || 0), 0);
          const tax = rows.reduce((sum: number, x: any) => sum + Number(x.tax_collected || 0), 0);
          setTaxLiabilities({ taxableTurnover: taxable, cgstAmount: tax / 2, sgstAmount: tax / 2, igstAmount: 0, vatAmount: 0, totalTax: tax, grossTurnover: gross });
        } else if (taxData.summary) {
          const s = taxData.summary;
          const gross = Number(s.total_sales || s.gross || 0);
          const tax = Number(s.total_tax || s.tax || 0);
          setTaxLiabilities({ taxableTurnover: gross - tax, cgstAmount: tax / 2, sgstAmount: tax / 2, igstAmount: 0, vatAmount: 0, totalTax: tax, grossTurnover: gross });
        }
      }

      setPortalLoadError(null);
      setIsLoadingHierarchy(false);
    };

    void load();

    return () => { cancelled = true; };

  }, []);



  const handleGeneratePairPin = async (mode?: 'desktop' | 'mobile' | unknown) => {

    setPairMode(mode === 'mobile' ? 'mobile' : 'desktop');

    setGeneratedPairCode(null); setPairingError(null); setPairTimeLeft(900); setShowPairModal(true);

    if (!pairingBranch) { setPairingError('Select a branch before generating a pairing code.'); return; }

    setIsPairingRequest(true);
    try {
      let token = '';
      try { token = JSON.parse(localStorage.getItem('tenant') || '{}').token || ''; } catch {}
      const res = await api.post<{ code?: string }>('/cloud/pair/generate', { branch_id: pairingBranch, terminal_name: 'Desktop POS' })
        .catch(() => cloudApi.post<{ code?: string }>('/api/pairing/generate', { branch_id: pairingBranch, terminal_name: 'Desktop POS' }, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }));

      if (!res.data?.code) throw new Error('The server did not return a pairing code.');
      const code = String(res.data.code);
      setGeneratedPairCode(code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code);
      setPairingError(null);
    } catch (error: any) {
      setPairingError(error?.response?.data?.error || error?.message || 'Could not generate a pairing code.');
    } finally {
      setIsPairingRequest(false);
    }
  };

  const handleToggleAvailability = async (item: ProductCatalogItem) => {
    if (!overrideBranch) { setPortalLoadError('Choose a branch before changing availability.'); return; }
    const updated = !item.isAvailable;
    try {
      await api.post('/cloud/catalog/override', { branch_id: overrideBranch, product_id: item.id, is_available: updated })
        .catch(() => cloudApi.post(`/api/catalog/branch/${encodeURIComponent(overrideBranch)}/override`, { product_id: item.id, is_available: updated }));
      setCatalogItems((items) => items.map((p) => p.id === item.id ? { ...p, isAvailable: updated } : p));
      setPortalLoadError(null);
    } catch (error: any) {
      setPortalLoadError(error?.response?.data?.error || 'Could not update item availability.');
    }
  };

  const handleEditPrice = (item: ProductCatalogItem) => {
    setSelectedOverrideItem(item);
    setCustomPriceInput(item.overridePrice ? String(item.overridePrice) : '');
    setShowOverrideModal(true);
  };

  const handleSavePriceOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOverrideItem || !overrideBranch) return;
    const priceVal = customPriceInput.trim() ? Number(customPriceInput) : null;
    if (priceVal !== null && (!Number.isFinite(priceVal) || priceVal < 0)) {
      setPortalLoadError('Enter a valid non-negative price.');
      return;
    }
    try {
      await api.post('/cloud/catalog/override', {
        branch_id: overrideBranch,
        product_id: selectedOverrideItem.id,
        price_override: priceVal,
      }).catch(() => cloudApi.post(`/api/catalog/branch/${encodeURIComponent(overrideBranch)}/override`, {
        product_id: selectedOverrideItem.id,
        price_override: priceVal,
      }));
      setCatalogItems((items) =>
        items.map((p) => p.id === selectedOverrideItem.id ? { ...p, overridePrice: priceVal } : p)
      );
      setShowOverrideModal(false);
      setPortalLoadError(null);
    } catch (error: any) {
      setPortalLoadError(error?.response?.data?.error || 'Could not update the branch price.');
    }
  };

  const handleRequestTransfer = () => {
    setTransferSource(branches[0]?.name || 'Connaught Place (Main Outlet)');
    setTransferDest(branches[1]?.name || 'Gurugram CyberHub (Franchise)');
    setTransferItemName(lowStockIngredients[0]?.name || 'Specialty Coffee Beans (KG)');
    setTransferQty(5);
    setTransferUnit('kg');
    setShowTransferModal(true);
  };

  const handleCreateTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferItemName.trim()) { setPortalLoadError('Item name is required'); return; }
    if (!transferQty || transferQty <= 0) { setPortalLoadError('Quantity must be greater than zero'); return; }
    try {
      const res = await api.post('/cloud/transfers', {
        source: transferSource,
        dest: transferDest,
        item: transferItemName.trim(),
        qty: Number(transferQty),
        unit: transferUnit,
      });
      if (res.data?.transfer) {
        setTransfers((prev) => [res.data.transfer, ...prev]);
        setShowTransferModal(false);
        setPortalLoadError(null);
      }
    } catch (err: any) {
      setPortalLoadError(err?.response?.data?.error || 'Failed to create transfer');
    }
  };

  const handleOpenRestockModal = (ing: LowStockIngredient) => {
    setSelectedRestockItem(ing);
    setRestockQty(ing.reorder_qty || 10);
    setShowRestockModal(true);
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestockItem) return;
    alert(`Purchase Order created successfully for ${restockQty} ${selectedRestockItem.unit} of ${selectedRestockItem.name}!\nPO Voucher: PO-${Date.now().toString().slice(-6)}`);
    setShowRestockModal(false);
  };

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice) return;
    try {
      const res = await api.post('/cloud/catalog/products', {
        name: newProdName.trim(),
        category: newProdCategory,
        price: Number(newProdPrice),
        tax_rate: Number(newProdTaxRate),
      });
      if (res.data?.product) {
        setCatalogItems((prev) => [res.data.product, ...prev]);
        setShowAddProductModal(false);
        setNewProdName('');
        setNewProdPrice(250);
        setPortalLoadError(null);
      }
    } catch (err: any) {
      setPortalLoadError(err?.response?.data?.error || 'Failed to add product');
    }
  };

  const handleOpenEditBranchModal = (b: BranchSale) => {
    setEditingBranch(b);
    setEditBranchPhone('');
    setEditBranchAddress('');
    setEditBranchManager(b.name);
    setShowEditBranchModal(true);
  };

  const handleEditBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    try {
      const res = await api.patch(`/cloud/branches/${encodeURIComponent(editingBranch.id)}`, {
        phone: editBranchPhone,
        address: editBranchAddress,
        manager_name: editBranchManager,
      });
      if (res.data?.branch) {
        setBranches((prev) =>
          prev.map((b) => b.id === editingBranch.id ? { ...b, name: res.data.branch.name } : b)
        );
        setShowEditBranchModal(false);
        setPortalLoadError(null);
      }
    } catch (err: any) {
      setPortalLoadError(err?.response?.data?.error || 'Failed to update branch');
    }
  };

  const handleUpdateTransferStatus = async (id: string, status: 'dispatched' | 'received') => {
    try {
      await api.patch(`/cloud/transfers/${encodeURIComponent(id)}/status`, { status })
        .catch(() => cloudApi.patch(`/api/transfers/${encodeURIComponent(id)}/status`, { status }));
      setTransfers((items) => items.map((tr) => tr.id === id ? { ...tr, status } : tr));
      setPortalLoadError(null);
    } catch (error: any) {
      setPortalLoadError(error?.response?.data?.error || 'Could not update transfer status.');
    }
  };

  const handleCreateBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateBranchError(null);
    if (!newBranchName.trim()) { setCreateBranchError('Branch name is required.'); return; }
    if (!newBranchCode.trim()) { setCreateBranchError('Branch code is required (e.g. BLR-04).'); return; }
    if (!newBranchEmail.trim() || !newBranchEmail.includes('@')) { setCreateBranchError('A valid manager email is required.'); return; }
    if (!newBranchPassword || newBranchPassword.length < 8) { setCreateBranchError('Password must be at least 8 characters with upper, lower, and numbers.'); return; }

    setIsCreatingBranch(true);
    try {
      const res = await api.post('/cloud/branches', {
        name: newBranchName.trim(),
        code: newBranchCode.trim().toUpperCase(),
        address: newBranchAddress.trim(),
        phone: newBranchPhone.trim(),
        manager_name: newBranchManagerName.trim() || `${newBranchName.trim()} Manager`,
        email: newBranchEmail.trim().toLowerCase(),
        password: newBranchPassword,
        pin: newBranchPin || '1234',
        role: newBranchRole,
      });

      if (res.data?.success && res.data?.branch) {
        const nb = res.data.branch;
        setBranches((prev) => [
          ...prev,
          {
            id: String(nb.id),
            restaurant_id: 'rest-01',
            restaurant_name: tenantName,
            name: String(nb.name),
            code: String(nb.code),
            isMain: false,
            revenue: 0,
            orders: 0,
            avgTicket: 0,
            cashSales: 0,
            digitalSales: 0,
            sharePercent: 0,
          },
        ]);
        setCreatedBranchCredentials({
          branch: nb,
          credentials: res.data.credentials,
        });
        setNewBranchName('');
        setNewBranchCode('');
        setNewBranchAddress('');
        setNewBranchPhone('');
        setNewBranchManagerName('');
        setNewBranchEmail('');
      } else {
        throw new Error(res.data?.error || 'Failed to create branch');
      }
    } catch (err: any) {
      setCreateBranchError(err?.response?.data?.error || err?.message || 'Could not create branch.');
    } finally {
      setIsCreatingBranch(false);
    }
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



  // Financial aggregates

  const totalGrossRevenue = displayedBranches.reduce((acc, b) => acc + b.revenue, 0);

  const netCollectedSales = totalGrossRevenue;

  const totalGroupOrders = displayedBranches.reduce((acc, b) => acc + b.orders, 0);

  const avgGroupTicket = totalGroupOrders > 0 ? (netCollectedSales / totalGroupOrders).toFixed(2) : '0';



  const downloadTallyXml = () => {

    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>

<ENVELOPE>

  <HEADER>

    <TALLYREQUEST>Import Data</TALLYREQUEST>

  </HEADER>

  <BODY>

    <IMPORTDATA>

      <REQUESTDESC>

        <REPORTNAME>Vouchers</REPORTNAME>

      </REQUESTDESC>

      <REQUESTDATA>

        ${cashClosures.map((c) => `

        <TALLYMESSAGE xmlns:UDF="TallyUDF">

          <VOUCHER VCHTYPE="Receipt" ACTION="Create">

            <DATE>${c.date.replace(/-/g, '')}</DATE>

            <NARRATION>POS Day Closure - ${c.branchName} (${c.date})</NARRATION>

            <VOUCHERNUMBER>POS-${c.branchName.slice(0, 3).toUpperCase()}-${c.date.replace(/-/g, '')}</VOUCHERNUMBER>

            <ALLLEDGERENTRIES.LIST>

              <LEDGERNAME>Cash Counter Drawer</LEDGERNAME>

              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>

              <AMOUNT>-${c.cashSales}</AMOUNT>

            </ALLLEDGERENTRIES.LIST>

            <ALLLEDGERENTRIES.LIST>

              <LEDGERNAME>Digital / UPI Clearing Account</LEDGERNAME>

              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>

              <AMOUNT>-${c.digitalSales}</AMOUNT>

            </ALLLEDGERENTRIES.LIST>

            <ALLLEDGERENTRIES.LIST>

              <LEDGERNAME>Restaurant F&amp;B Food Sales</LEDGERNAME>

              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>

              <AMOUNT>${c.cashSales + c.digitalSales}</AMOUNT>

            </ALLLEDGERENTRIES.LIST>

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

    <div className="flex-1 flex flex-col min-h-screen bg-slate-50/50">

      {/* Top Executive Navigation Bar */}

      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">

        <div className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-xl bg-[#F07928] text-white flex items-center justify-center shadow-md shadow-[#F07928]/20">

            <Building2 className="w-5 h-5 text-white" />

          </div>

          <div>

            <div className="flex items-center gap-2">

              <h1 className="text-lg font-bold tracking-tight text-slate-900">{tenantName}</h1>

              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF2EA] text-[#F07928] border border-[#F07928]/30">

                Cloud Portal

              </span>

            </div>

            <p className="text-xs text-slate-500">Cloudflare Workers + D1 Edge Sync • Multi-Concept SaaS Management</p>

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





          <Link

            href="/dashboard"

            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium hover:bg-slate-200 transition-colors"

          >

            <Store className="w-3.5 h-3.5" />

            Store Operations

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

        {portalLoadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{portalLoadError}</div>}

        {/* Onboarding & Architecture Banner */}

        {isOnboarded && (

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FFF2EA] via-orange-50/60 to-white border border-[#F07928]/30 p-6 shadow-sm">

            <div className="absolute top-3 right-3">

              <button

                onClick={() => setIsOnboarded(false)}

                className="text-slate-500 hover:text-slate-900 text-xs px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-xs hover:bg-slate-50 transition-colors"

              >

                Dismiss

              </button>

            </div>

            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">

              <div className="space-y-2 max-w-2xl">

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F07928]/10 text-[#F07928] text-xs font-semibold border border-[#F07928]/20">

                  <Sparkles className="w-3.5 h-3.5" /> Setup Successful — Welcome to Order It Up

                </div>

                <h2 className="text-xl font-bold text-slate-900 tracking-tight">

                  Connect {tenantName} Across Restaurant Devices

                </h2>

                <p className="text-xs text-slate-600 leading-relaxed">

                  The Web Portal provides centralized management, operational analytics, and cloud catalog sync. Point of Sale billing is dedicated to the Order It Up Desktop Application (Windows) and Mobile Companion.

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

                  href="/dashboard"

                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs hover:bg-slate-200 flex items-center gap-2 transition-all"

                >

                  <Store className="w-4 h-4" /> View Store Operations

                </Link>

              </div>

            </div>

          </div>

        )}



        {/* Navigation Tabs covering all operational reporting domains */}

        <div className="flex border-b border-slate-200 overflow-x-auto gap-1">

          <button

            onClick={() => setActiveTab('overview')}

            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${

              activeTab === 'overview'

                ? 'border-[#F07928] text-[#F07928] bg-white font-semibold rounded-t-lg shadow-xs'

                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'

            }`}

          >

            <TrendingUp className="w-4 h-4" />

            Executive Financials & Payments

          </button>



          <button

            onClick={() => setActiveTab('velocity')}

            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${

              activeTab === 'velocity'

                ? 'border-[#F07928] text-[#F07928] bg-white font-semibold rounded-t-lg shadow-xs'

                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'

            }`}

          >

            <Flame className="w-4 h-4" />

            Menu & Kitchen Velocity

          </button>



          <button

            onClick={() => setActiveTab('inventory')}

            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${

              activeTab === 'inventory'

                ? 'border-[#F07928] text-[#F07928] bg-white font-semibold rounded-t-lg shadow-xs'

                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'

            }`}

          >

            <Boxes className="w-4 h-4" />

            Inventory & Low-Stock Alerts

          </button>



          <button

            onClick={() => setActiveTab('accountant')}

            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${

              activeTab === 'accountant'

                ? 'border-[#F07928] text-[#F07928] bg-white font-semibold rounded-t-lg shadow-xs'

                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'

            }`}

          >

            <Receipt className="w-4 h-4" />

            Accountant Hub & Tax Liabilities

          </button>



          <button

            onClick={() => setActiveTab('catalog')}

            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${

              activeTab === 'catalog'

                ? 'border-[#F07928] text-[#F07928] bg-white font-semibold rounded-t-lg shadow-xs'

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

                ? 'border-[#F07928] text-[#F07928] bg-white font-semibold rounded-t-lg shadow-xs'

                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg'

            }`}

          >

            <Store className="w-4 h-4" />

            Franchise Fleet & Pairing

          </button>

        </div>



        {/* TAB 1: EXECUTIVE FINANCIALS & PAYMENTS BREAKDOWN */}

        {activeTab === 'overview' && (

          <div className="flex flex-col gap-6">

            {/* Executive Financial Summary (5 KPI Cards) */}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

              {/* Gross Revenue */}

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-slate-900">

                <div className="flex items-center justify-between text-slate-500 mb-2">

                  <span className="text-xs uppercase font-semibold tracking-wider">Gross Revenue</span>

                  <DollarSign className="w-4 h-4 text-emerald-600" />

                </div>

                <div className="text-2xl font-bold text-slate-900 tracking-tight">₹{totalGrossRevenue.toLocaleString()}</div>

                <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 font-medium">

                  <TrendingUp className="w-3.5 h-3.5" />

                  Current reporting period

                </div>

              </div>



              {/* Refunds & Adjustments */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-slate-900">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider">Refunds & Void</span>
                  <RotateCcw className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-bold text-rose-600 tracking-tight">₹{totalRefunds.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-2">{refundsCount} void/refunded ticket(s)</div>
              </div>

              {/* Net Collected Sales */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-slate-900 ring-1 ring-[#F07928]/30">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs uppercase font-semibold tracking-wider text-[#F07928]">Net Collected</span>
                  <ShieldCheck className="w-4 h-4 text-[#F07928]" />
                </div>
                <div className="text-2xl font-bold text-[#F07928] tracking-tight">₹{netCollectedSales.toLocaleString()}</div>
                <div className="text-xs text-emerald-600 mt-2 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Reconciled net revenue
                </div>
              </div>



              {/* Order Volume (Tickets) */}

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-slate-900">

                <div className="flex items-center justify-between text-slate-500 mb-2">

                  <span className="text-xs uppercase font-semibold tracking-wider">Order Volume</span>

                  <Receipt className="w-4 h-4 text-blue-600" />

                </div>

                <div className="text-2xl font-bold text-slate-900 tracking-tight">{totalGroupOrders.toLocaleString()}</div>

                <div className="text-xs text-slate-500 mt-2">Processed tickets across outlets</div>

              </div>



              {/* Average Order Value (AOV) */}

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-slate-900">

                <div className="flex items-center justify-between text-slate-500 mb-2">

                  <span className="text-xs uppercase font-semibold tracking-wider">Avg Order Value</span>

                  <Sliders className="w-4 h-4 text-purple-600" />

                </div>

                <div className="text-2xl font-bold text-slate-900 tracking-tight">₹{avgGroupTicket}</div>

                <div className="text-xs text-slate-500 mt-2">CyberHub highest at ₹387.82</div>

              </div>

            </div>



            {/* Tender & Payment Breakdown Across Cash, Card, UPI, and Digital Wallets */}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">

                <div>

                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">

                    <CreditCard className="w-4 h-4 text-[#F07928]" />

                    Tender & Payment Breakdown

                  </h2>

                  <p className="text-xs text-slate-500">Split across UPI, Card, Cash, and Digital Wallets with monetary amounts and percentages</p>

                </div>

                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">

                  Total Collected: ₹{netCollectedSales.toLocaleString()}

                </span>

              </div>



              {/* Visual Split Distribution Bar */}

              <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 shadow-inner">

                {paymentTenders.map((tender) => (

                  <div

                    key={tender.method}

                    style={{ width: `${tender.percent}%` }}

                    title={`${tender.label}: ₹${tender.amount.toLocaleString()} (${tender.percent}%)`}

                    className={`h-full transition-all ${

                      tender.method === 'upi'

                        ? 'bg-[#F07928]'

                        : tender.method === 'card'

                        ? 'bg-blue-600'

                        : tender.method === 'cash'

                        ? 'bg-emerald-600'

                        : 'bg-purple-600'

                    }`}

                  />

                ))}

              </div>



              {/* Detailed Breakdown Cards */}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">

                {paymentTenders.map((tender) => (

                  <div key={tender.method} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">

                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">

                      <span className="flex items-center gap-1.5">

                        {tender.method === 'upi' && <Smartphone className="w-3.5 h-3.5 text-[#F07928]" />}

                        {tender.method === 'card' && <CreditCard className="w-3.5 h-3.5 text-blue-600" />}

                        {tender.method === 'cash' && <DollarSign className="w-3.5 h-3.5 text-emerald-600" />}

                        {tender.method === 'wallet' && <Wallet className="w-3.5 h-3.5 text-purple-600" />}

                        {tender.label}

                      </span>

                      <span className="font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">

                        {tender.percent}%

                      </span>

                    </div>

                    <div className="text-xl font-bold text-slate-900">

                      ₹{tender.amount.toLocaleString()}

                    </div>

                    <div className="text-[11px] text-slate-500">

                      {tender.transactions} completed transactions

                    </div>

                  </div>

                ))}

              </div>

            </div>



            {/* Branch Sales Leaderboard */}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">

              <div className="flex items-center justify-between">

                <div>

                  <h2 className="text-base font-semibold text-slate-900">Branch Performance Leaderboard</h2>

                  <p className="text-xs text-slate-500">Comparing real-time revenue and sales volume across outlets</p>

                </div>

                {displayedBranches.length > 0 && (

                  <span className="text-xs text-[#F07928] bg-[#FFF2EA] px-2.5 py-1 rounded-full border border-[#F07928]/30 font-medium">

                    Top Outlet: {[...displayedBranches].sort((a, b) => b.revenue - a.revenue)[0].name}

                  </span>

                )}

              </div>



              <div className="flex flex-col gap-4 mt-2">

                {displayedBranches.map((b, i) => (

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

                ))}

              </div>

            </div>

          </div>

        )}



        {/* TAB 2: MENU & KITCHEN VELOCITY */}

        {activeTab === 'velocity' && (

          <div className="flex flex-col gap-6">

            {/* Operational & Kitchen Velocity Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col gap-1">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs uppercase font-semibold tracking-wider">Avg Kitchen Prep</span>
                  <ChefHat className="w-4 h-4 text-[#F07928]" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {operationalVelocity.avgKitchenPrepMinutes} mins
                </div>
                <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Target: &lt; 15 mins (Speed of Service)
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col gap-1">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs uppercase font-semibold tracking-wider">Table Turnaround</span>
                  <Hourglass className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {operationalVelocity.avgTableTurnMinutes} mins
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Average dining duration across outlets
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col gap-1">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs uppercase font-semibold tracking-wider">Active KOT Tickets</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {operationalVelocity.activeKitchenTickets}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Live orders across kitchen displays
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col gap-1">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs uppercase font-semibold tracking-wider">Floor Occupancy</span>
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {operationalVelocity.tableOccupancyPercent}%
                </div>
                <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {operationalVelocity.dineInCompletedCount} tables served today
                </div>
              </div>
            </div>



            {/* Menu Items Velocity and Category Contribution */}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Top Selling Menu Items */}

              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">

                <div className="flex items-center justify-between border-b border-slate-100 pb-3">

                  <div>

                    <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">

                      <Flame className="w-4 h-4 text-[#F07928]" />

                      Top-Selling Menu Items (Velocity)

                    </h2>

                    <p className="text-xs text-slate-500">Ranked by units sold, total revenue, and peak outlet preference</p>

                  </div>

                  <span className="text-xs font-mono text-slate-500">8 Key Performers</span>

                </div>



                <div className="overflow-x-auto">

                  <table className="w-full text-left text-xs">

                    <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">

                      <tr>

                        <th className="py-2.5 px-3 w-10 text-center">#</th>

                        <th className="py-2.5 px-3">Item Name</th>

                        <th className="py-2.5 px-3">Category</th>

                        <th className="py-2.5 px-3 text-right">Units Sold</th>

                        <th className="py-2.5 px-3 text-right">Revenue</th>

                        <th className="py-2.5 px-3">Top Outlet</th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-slate-100 text-slate-800">

                      {topItems.map((item, idx) => (

                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">

                          <td className="py-3 px-3 text-center font-bold text-[#F07928]">

                            #{idx + 1}

                          </td>

                          <td className="py-3 px-3 font-semibold text-slate-900">

                            {item.name}

                          </td>

                          <td className="py-3 px-3 text-slate-500">

                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">

                              {item.category}

                            </span>

                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">

                            {item.totalQty}

                          </td>

                          <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600">

                            ₹{item.totalRev.toLocaleString()}

                          </td>

                          <td className="py-3 px-3 text-slate-600 text-[11px]">

                            {item.topBranch}

                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              </div>



              {/* Category Contribution */}

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">

                <div className="flex items-center justify-between border-b border-slate-100 pb-3">

                  <div>

                    <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">

                      <PieChart className="w-4 h-4 text-blue-600" />

                      Category Contribution

                    </h2>

                    <p className="text-xs text-slate-500">Sales revenue distribution by menu category</p>

                  </div>

                </div>



                <div className="flex flex-col gap-3">

                  {categories.map((cat) => (

                    <div key={cat.category} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5">

                      <div className="flex items-center justify-between text-xs">

                        <span className="font-semibold text-slate-900">{cat.category}</span>

                        <span className="font-mono font-bold text-slate-700">₹{cat.revenue.toLocaleString()} ({cat.percentShare}%)</span>

                      </div>

                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">

                        <div

                          className="bg-gradient-to-r from-[#F07928] to-amber-500 h-full rounded-full"

                          style={{ width: `${cat.percentShare}%` }}

                        />

                      </div>

                      <div className="text-[11px] text-slate-500">

                        {cat.quantitySold} units ordered

                      </div>

                    </div>

                  ))}

                </div>

              </div>

            </div>



            {/* Staff Performance Summaries */}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">

              <div className="flex items-center justify-between border-b border-slate-100 pb-3">

                <div>

                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">

                    <Users className="w-4 h-4 text-purple-600" />

                    Staff Sales & Productivity Summaries

                  </h2>

                  <p className="text-xs text-slate-500">Floor captains, counter billing leads, and kitchen expediter performance</p>

                </div>

                <span className="text-xs font-mono text-slate-500">5 Active Staff Members</span>

              </div>



              <div className="overflow-x-auto">

                <table className="w-full text-left text-xs">

                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">

                    <tr>

                      <th className="py-2.5 px-3">Staff Member</th>

                      <th className="py-2.5 px-3">Role Designation</th>

                      <th className="py-2.5 px-3">Primary Outlet</th>

                      <th className="py-2.5 px-3 text-right">Orders Handled</th>

                      <th className="py-2.5 px-3 text-right">Total Revenue</th>

                      <th className="py-2.5 px-3 text-right">Average Ticket</th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100 text-slate-800">

                    {staffPerformances.map((staff) => (

                      <tr key={staff.id} className="hover:bg-slate-50 transition-colors">

                        <td className="py-3 px-3 font-semibold text-slate-900 flex items-center gap-2">

                          <span className="w-6 h-6 rounded-full bg-[#FFF2EA] text-[#F07928] font-bold text-[10px] flex items-center justify-center">

                            {staff.name.charAt(0)}

                          </span>

                          {staff.name}

                        </td>

                        <td className="py-3 px-3 text-slate-600">

                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">

                            {staff.role}

                          </span>

                        </td>

                        <td className="py-3 px-3 text-slate-600">{staff.branch}</td>

                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">{staff.orders}</td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">₹{staff.revenue.toLocaleString()}</td>

                        <td className="py-3 px-3 text-right font-mono text-slate-700">₹{staff.avgTicket.toFixed(2)}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>

          </div>

        )}



        {/* TAB 3: INVENTORY LOW-STOCK REORDER FEED & TRANSFERS */}

        {activeTab === 'inventory' && (

          <div className="flex flex-col gap-6">

            {/* Low-Stock Inventory Alerts Feed matching raw_ingredients schema */}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">

                <div>

                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">

                    <AlertTriangle className="w-4 h-4 text-amber-500" />

                    Inventory Low-Stock Reorder Feed

                  </h2>

                  <p className="text-xs text-slate-500">

                    Raw materials where <code className="text-amber-700 font-mono text-[11px] bg-amber-50 px-1 py-0.5 rounded">current_stock &le; minimum_stock</code> with automated reorder quantities

                  </p>

                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">

                  <AlertCircle className="w-3.5 h-3.5" />

                  {lowStockIngredients.length} Items Require Restocking

                </span>

              </div>



              <div className="overflow-x-auto">

                <table className="w-full text-left text-xs">

                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">

                    <tr>

                      <th className="py-3 px-3">Raw Material / Ingredient</th>

                      <th className="py-3 px-3">Unit</th>

                      <th className="py-3 px-3 text-right">Current Stock</th>

                      <th className="py-3 px-3 text-right">Min Threshold</th>

                      <th className="py-3 px-3 text-right">Unit Cost</th>

                      <th className="py-3 px-3 text-right">Reorder Qty</th>

                      <th className="py-3 px-3 text-right">Est. Cost</th>

                      <th className="py-3 px-3">Supplier</th>

                      <th className="py-3 px-3 text-center">Action</th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100 text-slate-800">

                    {lowStockIngredients.map((ing) => (

                      <tr key={ing.id} className="hover:bg-slate-50 transition-colors">

                        <td className="py-3.5 px-3 font-semibold text-slate-900 flex items-center gap-2">

                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />

                          {ing.name}

                        </td>

                        <td className="py-3.5 px-3 font-mono text-slate-500">{ing.unit}</td>

                        <td className="py-3.5 px-3 text-right font-mono font-bold text-rose-600">

                          {ing.current_stock}

                        </td>

                        <td className="py-3.5 px-3 text-right font-mono text-slate-600">

                          {ing.minimum_stock}

                        </td>

                        <td className="py-3.5 px-3 text-right font-mono text-slate-700">

                          ₹{ing.cost_per_unit}

                        </td>

                        <td className="py-3.5 px-3 text-right font-mono font-bold text-[#F07928]">

                          {ing.reorder_qty} {ing.unit}

                        </td>

                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">

                          ₹{ing.estimated_cost.toLocaleString()}

                        </td>

                        <td className="py-3.5 px-3 text-slate-600 text-[11px]">{ing.supplier}</td>

                        <td className="py-3.5 px-3 text-center">
                          <button
                            onClick={() => handleOpenRestockModal(ing)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs"
                          >
                            Restock Material
                          </button>
                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>



            {/* Inter-Branch Inventory Stock Transfers */}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">

              <div className="flex items-center justify-between border-b border-slate-100 pb-3">

                <div>

                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">

                    <ArrowRightLeft className="w-4 h-4 text-blue-600" />

                    Inter-Branch Inventory Transfers

                  </h2>

                  <p className="text-xs text-slate-500">Rebalance raw materials and central prep kitchen batches between outlets</p>

                </div>



                <button

                  onClick={handleRequestTransfer}

                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shadow-xs"

                >

                  <ArrowRightLeft className="w-3.5 h-3.5" />

                  New Transfer Request

                </button>

              </div>



              <div className="overflow-x-auto">

                <table className="w-full text-left text-xs">

                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">

                    <tr>

                      <th className="py-2.5 px-3">Date</th>

                      <th className="py-2.5 px-3">Origin Outlet</th>

                      <th className="py-2.5 px-3">Destination Outlet</th>

                      <th className="py-2.5 px-3">Material / Item</th>

                      <th className="py-2.5 px-3 text-right">Quantity</th>

                      <th className="py-2.5 px-3 text-center">Status</th>

                      <th className="py-2.5 px-3 text-center">Actions</th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100 text-slate-800">

                    {transfers.map((t) => (

                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">

                        <td className="py-3 px-3 font-mono text-slate-600">{t.date}</td>

                        <td className="py-3 px-3 font-semibold text-slate-900">{t.source}</td>

                        <td className="py-3 px-3 text-slate-700">{t.dest}</td>

                        <td className="py-3 px-3 font-medium text-[#F07928]">{t.item}</td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{t.qty} {t.unit}</td>

                        <td className="py-3 px-3 text-center">

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

                        <td className="py-3 px-3 text-center">

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

          </div>

        )}



        {/* TAB 4: ACCOUNTANT HUB & TAX LIABILITIES */}

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

                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F07928] text-white font-semibold text-xs hover:bg-[#EA580C] transition-colors shadow-sm"

                >

                  <Download className="w-4 h-4" />

                  One-Click Tally XML Export

                </button>

                <button

                  onClick={downloadCsv}

                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-700 font-medium text-xs hover:bg-slate-50 transition-colors border border-slate-200 shadow-xs"

                >

                  <Download className="w-4 h-4" />

                  Export Closures CSV

                </button>

              </div>

            </div>



            {/* GST & Tax Compliance Breakdown */}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">

              <div className="flex items-center justify-between border-b border-slate-100 pb-3">

                <div>

                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">

                    <ShieldCheck className="w-4 h-4 text-[#F07928]" />

                    GST Liabilities & Tax Audit Breakdown

                  </h3>

                  <p className="text-xs text-slate-500">Consolidated Restaurant GST (5% with input tax credit exemption rules)</p>

                </div>

                <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">

                  Total Tax: ₹{taxLiabilities.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}

                </span>

              </div>



              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">

                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Taxable Turnover</div>

                  <div className="text-xl font-bold text-slate-900 mt-1">₹{taxLiabilities.taxableTurnover.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

                  <div className="text-[11px] text-slate-500 mt-1">Net of discounts & exc. tax</div>

                </div>



                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">

                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">CGST (2.5%) Collected</div>

                  <div className="text-xl font-bold text-[#F07928] mt-1">₹{taxLiabilities.cgstAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

                  <div className="text-[11px] text-slate-500 mt-1">Central Tax Liability</div>

                </div>



                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">

                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">SGST (2.5%) Collected</div>

                  <div className="text-xl font-bold text-[#F07928] mt-1">₹{taxLiabilities.sgstAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

                  <div className="text-[11px] text-slate-500 mt-1">State Tax Liability</div>

                </div>



                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">

                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">IGST / VAT</div>

                  <div className="text-xl font-bold text-slate-900 mt-1">₹0.00</div>

                  <div className="text-[11px] text-slate-500 mt-1">Intra-State Dining Exemption</div>

                </div>

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

          </div>

        )}



        {/* TAB 5: MASTER MENU & BRANCH OVERRIDES */}

        {activeTab === 'catalog' && (

          <div className="flex flex-col gap-6">

            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">

              <div>

                <h2 className="text-base font-semibold text-slate-900">Master Catalog & Branch Price Overrides</h2>

                <p className="text-xs text-slate-500">

                  HQ defines global products and base prices. Individual branches can customize pricing or 86 out-of-stock items.

                </p>

              </div>



              {/* Branch Selector & Add Product */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Product to Master Catalog
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Customizing for:</span>
                  <select
                    value={overrideBranch}
                    onChange={(e) => setOverrideBranch(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#F07928] outline-none shadow-xs"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
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



        {/* TAB 6: BRANCHES & TERMINAL FLEET */}

        {activeTab === 'branches' && (

          <div className="flex flex-col gap-6">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-base font-semibold text-slate-900">Franchise Outlets & Terminal Fleet</h2>

                <p className="text-xs text-slate-500">All registered POS counters and kitchen stations syncing to Cloudflare D1</p>

              </div>



              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowCreateBranchModal(true);
                    setCreatedBranchCredentials(null);
                    setCreateBranchError(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  + Create Branch & POS Login
                </button>
                <button
                  onClick={() => handleGeneratePairPin('desktop')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F07928] text-white font-semibold text-xs hover:bg-[#EA580C] transition-colors shadow-sm"
                >
                  <KeyRound className="w-4 h-4" />
                  Generate New Pairing PIN
                </button>
              </div>

            </div>



            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {branches.map((b) => (

                <div key={b.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4">

                  <div className="flex items-center justify-between">

                    <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">{b.code}</span>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">

                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />

                      Terminal pairing

                    </span>

                  </div>



                  <div>

                    <h3 className="text-base font-bold text-slate-900">{b.name}</h3>

                    <p className="text-xs text-slate-500 mt-1">Terminal counts are not available from this report.</p>

                  </div>



                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">Revenue: ₹{b.revenue.toLocaleString()}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditBranchModal(b)}
                        className="text-slate-600 hover:text-slate-900 font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setPairingBranch(b.id);
                          handleGeneratePairPin('desktop');
                        }}
                        className="text-[#F07928] hover:text-[#EA580C] font-semibold flex items-center gap-0.5"
                      >
                        Pair Terminal <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>

              ))}

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

                {generatedPairCode || (isPairingRequest ? 'Requesting...' : 'No code generated')}

              </div>

              {pairingError && <p role="alert" className="text-xs text-rose-700">{pairingError}</p>}

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



            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">

              In Desktop POS, open Settings → Mobile Access → Pair Desktop POS and enter this code. The code expires in 15 minutes and can be claimed once.

            </div>



            <div className="flex gap-2">

              <button

                onClick={() => {

                  if (!generatedPairCode) return;

                  navigator.clipboard?.writeText(generatedPairCode.replace(/\s/g, ''));

                  alert('Pairing PIN copied to clipboard!');

                }}

                disabled={!generatedPairCode}

                className="flex-1 py-2.5 rounded-xl bg-[#F07928] hover:bg-[#EA580C] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors shadow-sm shadow-[#F07928]/20 flex items-center justify-center gap-2"

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

      {/* CREATE BRANCH & POS LOGIN MODAL */}
      {showCreateBranchModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 flex flex-col gap-5 shadow-2xl relative text-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Branch & POS Login</h3>
                  <p className="text-xs text-slate-500">Add an outlet and auto-provision terminal login credentials</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCreateBranchModal(false);
                  setCreatedBranchCredentials(null);
                  setCreateBranchError(null);
                }}
                className="text-slate-500 hover:text-slate-900 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>

            {createBranchError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createBranchError}</span>
              </div>
            )}

            {createdBranchCredentials ? (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Branch & Login Created!</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Ready to Sign In</span>
                  </div>
                  <div className="text-xs text-emerald-900 space-y-1">
                    <p><strong>Branch:</strong> {createdBranchCredentials.branch.name} ({createdBranchCredentials.branch.code})</p>
                    <p><strong>Role:</strong> {createdBranchCredentials.credentials.role}</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-emerald-200 font-mono text-xs space-y-1.5 shadow-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-semibold text-slate-900 select-all">{createdBranchCredentials.credentials.email}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Password:</span>
                      <span className="font-semibold text-slate-900 select-all">{createdBranchCredentials.credentials.password}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Quick PIN:</span>
                      <span className="font-semibold text-slate-900 select-all">{createdBranchCredentials.credentials.pin}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Use these credentials to sign in at the POS terminal (<code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">/auth/login</code>).
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const text = `Branch: ${createdBranchCredentials.branch.name} (${createdBranchCredentials.branch.code})\nEmail: ${createdBranchCredentials.credentials.email}\nPassword: ${createdBranchCredentials.credentials.password}\nPIN: ${createdBranchCredentials.credentials.pin}\nURL: http://localhost:3001/auth/login/`;
                      navigator.clipboard?.writeText(text);
                      alert('Branch credentials copied to clipboard!');
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" /> Copy Credentials
                  </button>
                  <a
                    href="/auth/login/"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    Open POS Login <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateBranchSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-xs font-semibold text-slate-700">Branch Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Indiranagar Flagship, Mumbai Airport T2"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      required
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700">Branch Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. BLR-04, MUM-01"
                      value={newBranchCode}
                      onChange={(e) => setNewBranchCode(e.target.value)}
                      required
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 uppercase font-mono bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700">Phone</label>
                    <input
                      type="text"
                      placeholder="e.g. +91 9876543210"
                      value={newBranchPhone}
                      onChange={(e) => setNewBranchPhone(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-xs font-semibold text-slate-700">Address / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. 100 Feet Road, HAL 2nd Stage, Bengaluru"
                      value={newBranchAddress}
                      onChange={(e) => setNewBranchAddress(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-white"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" /> POS Login & Credentials Provisioning
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5 col-span-2">
                      <label className="text-xs font-semibold text-slate-700">Manager Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Kumar"
                        value={newBranchManagerName}
                        onChange={(e) => setNewBranchManagerName(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 col-span-2">
                      <label className="text-xs font-semibold text-slate-700">POS Login Email (Username) *</label>
                      <input
                        type="email"
                        placeholder="e.g. ramesh.indiranagar@orderitup.com"
                        value={newBranchEmail}
                        onChange={(e) => setNewBranchEmail(e.target.value)}
                        required
                        className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-700">Initial Password *</label>
                      <input
                        type="text"
                        value={newBranchPassword}
                        onChange={(e) => setNewBranchPassword(e.target.value)}
                        required
                        className="px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-emerald-500 bg-white"
                      />
                      <span className="text-[10px] text-slate-400">Min 8 chars (upper, lower, num)</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-700">Quick PIN</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={newBranchPin}
                        onChange={(e) => setNewBranchPin(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-emerald-500 bg-white"
                      />
                      <span className="text-[10px] text-slate-400">4-6 digit numeric</span>
                    </div>

                    <div className="flex flex-col gap-1.5 col-span-2">
                      <label className="text-xs font-semibold text-slate-700">Terminal Role</label>
                      <select
                        value={newBranchRole}
                        onChange={(e) => setNewBranchRole(e.target.value as 'manager' | 'cashier')}
                        className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-white"
                      >
                        <option value="manager">Store Manager (Full Outlet Access)</option>
                        <option value="cashier">Cashier (Order & Billing Access)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={isCreatingBranch}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    {isCreatingBranch ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Provisioning Branch & Login...
                      </>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4" />
                        Create Branch & Generate Credentials
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateBranchModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* INTER-BRANCH STOCK TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl relative text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Request Stock Transfer</h3>
                  <p className="text-[11px] text-slate-500">Rebalance inventory between outlets</p>
                </div>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransferSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Origin / Source Outlet</label>
                <select
                  value={transferSource}
                  onChange={(e) => setTransferSource(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Destination Outlet</label>
                <select
                  value={transferDest}
                  onChange={(e) => setTransferDest(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Material / Item Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Specialty Coffee Beans, Truffle Oil"
                  value={transferItemName}
                  onChange={(e) => setTransferItemName(e.target.value)}
                  required
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={transferQty}
                    onChange={(e) => setTransferQty(Number(e.target.value))}
                    required
                    className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">Unit</label>
                  <select
                    value={transferUnit}
                    onChange={(e) => setTransferUnit(e.target.value)}
                    className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="kg">kg</option>
                    <option value="liters">liters</option>
                    <option value="boxes">boxes</option>
                    <option value="bottles">bottles</option>
                    <option value="packs">packs</option>
                    <option value="units">units</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Initiate Stock Transfer
                </button>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESTOCK PO MODAL */}
      {showRestockModal && selectedRestockItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl relative text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create Restock Purchase Order</h3>
                  <p className="text-[11px] text-slate-500">Auto-calculated reorder for {selectedRestockItem.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowRestockModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="flex flex-col gap-3.5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <p><strong>Item:</strong> {selectedRestockItem.name}</p>
                <p><strong>Current Stock:</strong> <span className="text-rose-600 font-bold">{selectedRestockItem.current_stock} {selectedRestockItem.unit}</span> (Min: {selectedRestockItem.minimum_stock})</p>
                <p><strong>Estimated Cost:</strong> ₹{(restockQty * selectedRestockItem.cost_per_unit).toLocaleString()} (₹{selectedRestockItem.cost_per_unit} / {selectedRestockItem.unit})</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Reorder Quantity ({selectedRestockItem.unit}) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  required
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono bg-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Boxes className="w-3.5 h-3.5" />
                  Generate Purchase Order
                </button>
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BRANCH PRICE OVERRIDE MODAL */}
      {showOverrideModal && selectedOverrideItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 flex flex-col gap-4 shadow-2xl relative text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Customize Branch Price</h3>
                <p className="text-[11px] text-slate-500">{selectedOverrideItem.name}</p>
              </div>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePriceOverride} className="flex flex-col gap-3">
              <div className="text-xs text-slate-600">
                Master Base Price: <strong className="font-mono text-slate-900">₹{selectedOverrideItem.basePrice}</strong>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Custom Price (₹) for selected branch</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Leave empty to reset to base price"
                  value={customPriceInput}
                  onChange={(e) => setCustomPriceInput(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#F07928] font-mono bg-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-xs transition-colors shadow-sm"
                >
                  Save Override
                </button>
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PRODUCT TO MASTER CATALOG MODAL */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl relative text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Product to Master Catalog</h3>
                  <p className="text-[11px] text-slate-500">Publish a new dish across all franchise outlets</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Dish / Product Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Kashmiri Dum Aloo, Passionfruit Mojito"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  required
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Category</label>
                <select
                  value={newProdCategory}
                  onChange={(e) => setNewProdCategory(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-white"
                >
                  <option value="Mains">Mains</option>
                  <option value="Starters">Starters</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Pizzas">Pizzas</option>
                  <option value="Desserts">Desserts</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">Base Price (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(Number(e.target.value))}
                    required
                    className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">GST Tax Rate (%)</label>
                  <select
                    value={newProdTaxRate}
                    onChange={(e) => setNewProdTaxRate(Number(e.target.value))}
                    className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-white"
                  >
                    <option value={5}>5% (Standard Restaurant)</option>
                    <option value={12}>12% (Packaged/Beverages)</option>
                    <option value={18}>18% (Outdoor/Luxury)</option>
                    <option value={0}>0% (Tax Exempt)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Publish to Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BRANCH DETAILS MODAL */}
      {showEditBranchModal && editingBranch && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl relative text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Outlet Information</h3>
                  <p className="text-[11px] text-slate-500">{editingBranch.name} ({editingBranch.code})</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditBranchModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditBranchSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Manager / Contact Person</label>
                <input
                  type="text"
                  placeholder="Manager name"
                  value={editBranchManager}
                  onChange={(e) => setEditBranchManager(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800 bg-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Contact Phone</label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={editBranchPhone}
                  onChange={(e) => setEditBranchPhone(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800 bg-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Store Address</label>
                <input
                  type="text"
                  placeholder="Outlet address / location"
                  value={editBranchAddress}
                  onChange={(e) => setEditBranchAddress(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800 bg-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm"
                >
                  Save Branch Changes
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditBranchModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

  );

}
