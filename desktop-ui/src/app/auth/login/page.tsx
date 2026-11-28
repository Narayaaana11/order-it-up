'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, type AppConfig } from 'use-intl';
import { getLandingPage } from '@/components/layout/AuthGuard';
import { useAuthStore, StorageUnavailableError } from '@/store/auth';
import { parseLoginFailure } from '@/lib/login-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import toast from 'react-hot-toast';
import {
  Eye,
  EyeOff,
  Crown,
  Briefcase,
  Receipt,
  Utensils,
  ChefHat,
  Building2,
  Copy,
  Check,
  Zap,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Shield,
  Headphones,
  Calculator,
  Truck,
  UserRound,
  Landmark,
  FileSearch,
} from 'lucide-react';
import { ROLE_LABEL_KEYS } from '@/lib/i18n-enums';
import { isElectronEnvironment } from '@/lib/api';

// Backend enum → leaf key maps for the tenant picker.
type BusinessTypeKey = keyof AppConfig['Messages']['businessType'];

const BUSINESS_TYPE_LEAF_KEYS: Record<string, BusinessTypeKey> = {
  restaurant: 'restaurant',
};

interface TestAccount {
  id: string;
  role: string;
  roleKey: string;
  title: string;
  email: string;
  pass: string;
  pin: string;
  badge: string;
  landingRoute: string;
  landingLabel: string;
  description: string;
  category: 'platform' | 'management' | 'operations' | 'branch';
}

const TEST_ACCOUNTS: TestAccount[] = [
  {
    id: 'super-admin',
    role: 'Super Admin',
    roleKey: 'super_admin',
    title: 'Super Administrator',
    email: 'superadmin@orderitup.com',
    pass: 'superadmin12345',
    pin: '0001',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    landingRoute: '/cloud-portal',
    landingLabel: 'Cloud HQ (/cloud-portal)',
    description: 'Global SaaS Platform Control, Tenant Lifecycle, Billing & Audit Logs',
    category: 'platform',
  },
  {
    id: 'central-admin',
    role: 'Central Admin',
    roleKey: 'admin',
    title: 'Central Platform Admin',
    email: 'centraladmin@orderitup.com',
    pass: 'centraladmin12345',
    pin: '0002',
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    landingRoute: '/cloud-portal',
    landingLabel: 'Cloud HQ (/cloud-portal)',
    description: 'SaaS Operations, Enterprise Support Escalation & Tenant Onboarding',
    category: 'platform',
  },
  {
    id: 'finance',
    role: 'Finance',
    roleKey: 'finance',
    title: 'Finance Operator',
    email: 'finance@orderitup.com',
    pass: 'finance12345',
    pin: '0003',
    badge: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    landingRoute: '/cloud-portal',
    landingLabel: 'Cloud HQ (/cloud-portal)',
    description: 'SaaS Subscription Billing, Payment Reconciliation & Royalty Audits',
    category: 'platform',
  },
  {
    id: 'support',
    role: 'Support',
    roleKey: 'support',
    title: 'Support Operator',
    email: 'support@orderitup.com',
    pass: 'support12345',
    pin: '0004',
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    landingRoute: '/cloud-portal',
    landingLabel: 'Cloud HQ (/cloud-portal)',
    description: 'Technical Troubleshooting, Pairing Token Reset & Device Diagnostics',
    category: 'platform',
  },
  {
    id: 'read-only',
    role: 'Auditor',
    roleKey: 'read_only',
    title: 'Platform Auditor (Read-Only)',
    email: 'auditor@orderitup.com',
    pass: 'auditor12345',
    pin: '0005',
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    landingRoute: '/cloud-portal',
    landingLabel: 'Cloud HQ (/cloud-portal)',
    description: 'Read-Only Inspection of Tenant Metrics, Compliance & Security Trails',
    category: 'platform',
  },
  {
    id: 'owner',
    role: 'Owner',
    roleKey: 'owner',
    title: 'Store Owner / SaaS HQ',
    email: 'admin@orderitup.com',
    pass: 'admin12345',
    pin: '1234',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    landingRoute: '/cloud-portal',
    landingLabel: 'Cloud HQ (/cloud-portal)',
    description: 'Executive Financials, Multi-Branch Fleet, Tax/Tally & Catalog Overrides',
    category: 'management',
  },
  {
    id: 'manager',
    role: 'Manager',
    roleKey: 'manager',
    title: 'Operations Manager',
    email: 'manager@orderitup.com',
    pass: 'manager12345',
    pin: '2345',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    landingRoute: '/dashboard',
    landingLabel: 'Dashboard (/dashboard)',
    description: 'Inventory Transfers, Daily Cash Closures, Voids & Staff Audits',
    category: 'management',
  },
  {
    id: 'branch-mgr',
    role: 'Branch Manager',
    roleKey: 'manager',
    title: 'Whitefield Outlet Manager',
    email: 'whitefield_wht349@orderitup.test',
    pass: 'manager12345',
    pin: '5678',
    badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    landingRoute: '/dashboard',
    landingLabel: 'Outlet Dashboard (/dashboard)',
    description: 'Whitefield IT Park Franchise Outlet & Local Stock Inwarding',
    category: 'branch',
  },
  {
    id: 'accountant',
    role: 'Accountant',
    roleKey: 'accountant',
    title: 'Head Accountant',
    email: 'accountant@orderitup.com',
    pass: 'accountant12345',
    pin: '6789',
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    landingRoute: '/reports',
    landingLabel: 'Reports (/reports)',
    description: 'Financial Reports, GST/Tax Summaries, Ledger Auditing & Tally XML Export',
    category: 'management',
  },
  {
    id: 'cashier',
    role: 'Cashier',
    roleKey: 'cashier',
    title: 'Front Counter Cashier',
    email: 'cashier@orderitup.com',
    pass: 'cashier12345',
    pin: '3456',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    landingRoute: '/pos',
    landingLabel: 'POS Billing (/pos)',
    description: 'Fast Counter Checkout, Split Bills, Cash/UPI/Card & Thermal Receipts',
    category: 'operations',
  },
  {
    id: 'server',
    role: 'Waiter',
    roleKey: 'server',
    title: 'Head Waiter / Floor Server',
    email: 'waiter@orderitup.com',
    pass: 'waiter12345',
    pin: '4567',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    landingRoute: '/tables',
    landingLabel: 'Floor Tables (/tables)',
    description: 'Table Layout, Guest Seating, Course Firing & Waiter Station',
    category: 'operations',
  },
  {
    id: 'chef',
    role: 'Chef',
    roleKey: 'chef',
    title: 'Kitchen Chef / Station Lead',
    email: 'chef@orderitup.com',
    pass: 'chef12345',
    pin: '5678',
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    landingRoute: '/kds',
    landingLabel: 'Kitchen Display (/kds)',
    description: 'Live Cooking Ticket Queue, Prep Timers & Station Bump Bars',
    category: 'operations',
  },
  {
    id: 'delivery',
    role: 'Delivery',
    roleKey: 'delivery',
    title: 'Delivery Driver',
    email: 'driver@orderitup.com',
    pass: 'driver12345',
    pin: '7890',
    badge: 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20',
    landingRoute: '/dashboard',
    landingLabel: 'Dispatch (/dashboard)',
    description: 'Dispatch Routing, Delivery Status Updates & Cash-on-Delivery Collection',
    category: 'operations',
  },
  {
    id: 'customer',
    role: 'Customer',
    roleKey: 'customer',
    title: 'Guest / QR Diner',
    email: 'customer@orderitup.com',
    pass: 'customer12345',
    pin: '8901',
    badge: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    landingRoute: '/menu',
    landingLabel: 'Digital Menu (/menu)',
    description: 'Contactless QR Menu Browsing, Table Self-Ordering & UPI QR Checkout',
    category: 'operations',
  },
];

function getRoleIcon(id: string) {
  switch (id) {
    case 'super-admin':
      return <Shield size={16} className="text-red-600 dark:text-red-400" />;
    case 'central-admin':
      return <ShieldCheck size={16} className="text-orange-600 dark:text-orange-400" />;
    case 'finance':
      return <Landmark size={16} className="text-teal-600 dark:text-teal-400" />;
    case 'support':
      return <Headphones size={16} className="text-sky-600 dark:text-sky-400" />;
    case 'read-only':
      return <FileSearch size={16} className="text-slate-600 dark:text-slate-400" />;
    case 'owner':
      return <Crown size={16} className="text-purple-600 dark:text-purple-400" />;
    case 'manager':
      return <Briefcase size={16} className="text-blue-600 dark:text-blue-400" />;
    case 'branch-mgr':
      return <Building2 size={16} className="text-cyan-600 dark:text-cyan-400" />;
    case 'accountant':
      return <Calculator size={16} className="text-indigo-600 dark:text-indigo-400" />;
    case 'cashier':
      return <Receipt size={16} className="text-emerald-600 dark:text-emerald-400" />;
    case 'server':
      return <Utensils size={16} className="text-amber-600 dark:text-amber-400" />;
    case 'chef':
      return <ChefHat size={16} className="text-rose-600 dark:text-rose-400" />;
    case 'delivery':
      return <Truck size={16} className="text-lime-600 dark:text-lime-400" />;
    case 'customer':
      return <UserRound size={16} className="text-pink-600 dark:text-pink-400" />;
    default:
      return <ShieldCheck size={16} className="text-muted-foreground" />;
  }
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, selectTenant, user, tenants, currentTenant, loadFromStorage } = useAuthStore();
  const t = useTranslations('auth');
  const tStaff = useTranslations('staff');
  const tBusinessType = useTranslations('businessType');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'platform' | 'management' | 'operations'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const triggerDesktopDownload = () => {
    toast.error('Desktop installer downloads are temporarily unavailable. Please contact Order It Up support.');
  };

  useEffect(() => {
    if (!isElectronEnvironment()) return;

    fetch('/api/auth/setup/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.needsSetup) router.replace('/setup');
      })
      .catch(() => { });

    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.status !== 'ok') {
          setDbError(data.db || t('dbErrorPrefix'));
        }
      })
      .catch(() => { });
  }, [router, t]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const handleTenantSelect = useCallback(
    async (tenantId: number | string) => {
      setLoading(true);
      try {
        await selectTenant(tenantId);
      } catch {
        toast.error(t('selectBusinessFailed'));
      } finally {
        setLoading(false);
      }
    },
    [selectTenant, t],
  );

  useEffect(() => {
    if (user && currentTenant) {
      router.push(getLandingPage());
    }
  }, [user, currentTenant, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);
    try {
      await login(email, password, rememberMe);
      toast.success(t('signInSuccess'));
      if (searchParams.get('redirect') === 'download') {
        triggerDesktopDownload();
      }
    } catch (err: unknown) {
      if (err instanceof StorageUnavailableError) {
        setLoginError(t('storageUnavailable'));
      } else {
        const failure = parseLoginFailure(err);
        if (failure.status === 401) {
          const remaining = failure.attemptsRemaining;
          if (remaining === 0) {
            const mins = failure.lockoutMinutes ?? 15;
            setLoginError(t('lockedOut', { minutes: mins }));
          } else if (typeof remaining === 'number' && remaining < 4) {
            setLoginError(t('invalidCredentials') + ' ' + t('attemptsRemaining', { count: remaining }));
          } else {
            setLoginError(t('invalidCredentials'));
          }
        } else if (failure.status === 429) {
          setLoginError(t('lockedOut', { minutes: 15 }));
        } else if (failure.status === undefined) {
          setLoginError(t('connectionFailed'));
        } else {
          setDbError(t('loginFailed'));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, label: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success(`Copied ${label}`);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleQuickLogin = async (acc: TestAccount) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    setRememberMe(true);
    setLoginError(null);
    setLoading(true);
    try {
      toast.loading(`Signing in as ${acc.title}...`, { id: 'quick-login' });
      await login(acc.email, acc.pass, true);
      toast.success(`Signed in as ${acc.title} (PIN: ${acc.pin})`, { id: 'quick-login' });
    } catch (err: unknown) {
      toast.dismiss('quick-login');
      const failure = parseLoginFailure(err);
      setLoginError(failure.message || t('invalidCredentials'));
      toast.error(t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = TEST_ACCOUNTS.filter((acc) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'platform') return acc.category === 'platform';
    if (activeCategory === 'management') return acc.category === 'management' || acc.category === 'branch';
    if (activeCategory === 'operations') return acc.category === 'operations';
    return true;
  });

  const shouldShowTenantSelect = !!(user && (tenants.length > 1 || searchParams.get('select_tenant') === 'true'));

  if (shouldShowTenantSelect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-2">{t('selectBusiness')}</h2>
              <p className="text-muted-foreground text-sm mb-6">{t('selectBusinessHint')}</p>
              <div className="space-y-3">
                {tenants.map((tenant) => {
                  const businessTypeKey = tenant.business_type ? BUSINESS_TYPE_LEAF_KEYS[tenant.business_type] : undefined;
                  const roleKey = tenant.role ? ROLE_LABEL_KEYS[tenant.role] : undefined;
                  return (
                    <button
                      key={tenant.id}
                      onClick={() => handleTenantSelect(tenant.id)}
                      disabled={loading}
                      className="w-full text-start p-4 border rounded-lg hover:border-primary hover:bg-accent transition-colors group"
                    >
                      <div className="font-semibold group-hover:text-primary">{tenant.business_name}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {businessTypeKey ? tBusinessType(businessTypeKey) : tenant.business_type ?? ''} &middot;{' '}
                        {roleKey ? tStaff(roleKey) : tenant.role ?? ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Order It Up" width={80} height={80} className="mx-auto mb-2 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Order It Up POS</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('signInTitle')}</p>
        </div>

        {dbError && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive max-w-md mx-auto">
            <strong>{t('dbErrorPrefix')}</strong> {dbError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Sign-In Form */}
          <div className="lg:col-span-5">
            <Card className="shadow-sm border-border/80">
              <CardContent className="pt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('emailPlaceholder')}
                      dir="ltr"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">{t('password')}</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('passwordPlaceholder')}
                        className="pe-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-muted-foreground select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary"
                    />
                    {t('rememberMe')}
                  </label>

                  {loginError && <p className="text-sm text-destructive text-center font-medium">{loginError}</p>}

                  <Button type="submit" disabled={loading} className="w-full" size="lg">
                    {loading ? t('signingIn') : t('signIn')}
                  </Button>

                  <button
                    type="button"
                    onClick={() => router.push('/auth/recover')}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t('forgotPasswordLink')}
                  </button>

                  <div className="pt-4 border-t border-border text-center">
                    <p className="text-xs text-muted-foreground">
                      Don&apos;t have a store account?{' '}
                      <a
                        href={process.env.NEXT_PUBLIC_OIU_PILOT_ACCESS_URL || 'http://localhost:3004/request-access/'}
                        className="font-semibold text-primary hover:underline transition-colors"
                      >
                        Register here
                      </a>
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Testing & Operational Role Credentials Hub */}
          <div className="lg:col-span-7">
            <Card className="shadow-sm border-border/80 bg-card/60 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight text-foreground">Operational Test Credentials</h2>
                      <p className="text-xs text-muted-foreground">Pre-seeded accounts for role & feature testing</p>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center flex-wrap gap-1 bg-muted/60 p-1 rounded-lg border border-border/50 text-xs">
                    {(
                      [
                        { key: 'all', label: `All (${TEST_ACCOUNTS.length})` },
                        { key: 'platform', label: 'Platform' },
                        { key: 'management', label: 'Management' },
                        { key: 'operations', label: 'Operations' },
                      ] as const
                    ).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveCategory(key)}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          activeCategory === key
                            ? 'bg-background text-foreground shadow-sm font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-3 max-h-[520px] overflow-y-auto pe-1">
                  {filteredAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="group p-3.5 rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:bg-muted/20 transition-all shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-muted/80 flex items-center justify-center">
                            {getRoleIcon(acc.id)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground">{acc.title}</span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${acc.badge}`}
                              >
                                {acc.role}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{acc.description}</p>
                          </div>
                        </div>

                        {/* Direct Landing Link indicator */}
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-primary/80 bg-primary/5 px-2 py-0.5 rounded border border-primary/10 whitespace-nowrap">
                          {acc.landingLabel}
                        </span>
                      </div>

                      {/* Credentials Strip */}
                      <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                        {/* Email */}
                        <div className="sm:col-span-5 flex items-center justify-between bg-muted/40 px-2.5 py-1.5 rounded-md border border-border/40 font-mono text-[11px]">
                          <span className="truncate text-foreground/90">{acc.email}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(acc.email, 'Email', `${acc.id}-email`)}
                            className="ms-1.5 text-muted-foreground hover:text-foreground p-0.5 rounded"
                            title="Copy Email"
                          >
                            {copiedKey === `${acc.id}-email` ? (
                              <Check size={12} className="text-emerald-500" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>

                        {/* Password */}
                        <div className="sm:col-span-4 flex items-center justify-between bg-muted/40 px-2.5 py-1.5 rounded-md border border-border/40 font-mono text-[11px]">
                          <span className="truncate text-foreground/90">{acc.pass}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(acc.pass, 'Password', `${acc.id}-pass`)}
                            className="ms-1.5 text-muted-foreground hover:text-foreground p-0.5 rounded"
                            title="Copy Password"
                          >
                            {copiedKey === `${acc.id}-pass` ? (
                              <Check size={12} className="text-emerald-500" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>

                        {/* PIN */}
                        <div className="sm:col-span-3 flex items-center justify-center gap-1 bg-muted/40 px-2 py-1.5 rounded-md border border-border/40 font-mono text-[11px] text-muted-foreground">
                          <KeyRound size={12} />
                          <span>PIN {acc.pin}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEmail(acc.email);
                            setPassword(acc.pass);
                            setLoginError(null);
                            toast.success(`Loaded ${acc.title} into login form`);
                          }}
                          className="h-7 text-xs px-2.5"
                        >
                          Auto-Fill
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          disabled={loading}
                          onClick={() => handleQuickLogin(acc)}
                          className="h-7 text-xs px-3 gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                        >
                          <Zap size={12} />
                          <span>Sign In Instantly</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>💡 Tip: Click &quot;Sign In Instantly&quot; to test that role immediately</span>
                  <span className="font-mono">SQLite v97 Verified</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/80 mt-6 tracking-wide">
          Order It Up POS • Developed by <span className="font-semibold text-foreground">IndentDev</span>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
