'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Sparkles, 
  RefreshCw, 
  KeyRound, 
  AlertTriangle,
  Lock,
  ArrowRight
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

export interface PlanEntitlements {
  maxTerminals: number;
  multiTerminal: boolean;
  kdsStations: boolean;
  cloudSync: boolean;
  whatsappReceipts: boolean;
  advancedReports: boolean;
  multiOutlet: boolean;
  inventoryTracking: boolean;
}

export interface SubscriptionInfo {
  status: 'trial' | 'active' | 'past_due' | 'grace_period' | 'suspended' | 'cancelled' | 'expired';
  plan: 'starter' | 'pro' | 'enterprise';
  trialExpiresAt: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEnd: string | null;
  daysRemaining: number;
  isInGracePeriod: boolean;
  isOperational: boolean;
  licenseKey: string | null;
  entitlements: PlanEntitlements;
  storeName: string;
  storeId: string;
}

export interface PlanDefinition {
  name: string;
  monthly: number;
  yearly: number;
  popular?: boolean;
  description: string;
  features: readonly string[];
}

export const PRICING_PLANS: Record<'starter' | 'pro' | 'enterprise', PlanDefinition> = {
  starter: {
    name: 'Starter Plan',
    monthly: 499,
    yearly: 4999,
    popular: false,
    description: 'Perfect for small cafes and quick-service food stalls.',
    features: ['1 Terminal', 'Core Billing & Invoicing', 'Basic Reports', 'Thermal Printing'],
  },
  pro: {
    name: 'Professional Plan',
    monthly: 1299,
    yearly: 12999,
    popular: true,
    description: 'Ideal for busy dine-in restaurants and multi-station kitchens.',
    features: ['Up to 5 Terminals', 'Kitchen Display System (KDS)', 'Cloud HQ Multi-Branch Sync', 'WhatsApp Receipts', 'Inventory & Recipes'],
  },
  enterprise: {
    name: 'Enterprise Plan',
    monthly: 2999,
    yearly: 29999,
    popular: false,
    description: 'Designed for restaurant chains, franchises, and high-volume outlets.',
    features: ['Unlimited Terminals', 'Central Menu Catalog', 'Inter-Branch Stock Transfers', 'Full Financial Audit Logs', '24/7 Priority Support'],
  },
};

export function SubscriptionManager({ isAdmin }: { isAdmin: boolean }) {
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activatingLicense, setActivatingLicense] = useState(false);
  const [initiatingPayment, setInitiatingPayment] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/subscription');
      if (res.data?.ok && res.data?.subscription) {
        setSubInfo(res.data.subscription);
      }
    } catch (err: unknown) {
      console.error('Failed to load subscription status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    api.get('/subscription')
      .then((res) => {
        if (!ignore && res.data?.ok && res.data?.subscription) {
          setSubInfo(res.data.subscription);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) console.error('Failed to load subscription status:', err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, []);

  // Handle plan checkout via Razorpay (server-authoritative order creation)
  const handleStartCheckout = async (planKey: 'starter' | 'pro' | 'enterprise') => {
    if (!isAdmin) {
      toast.error('Only owners or managers can initiate subscription billing.');
      return;
    }

    try {
      setInitiatingPayment(planKey);
      const orderRes = await api.post('/subscription/create-order', {
        plan: planKey,
        billingCycle,
      });

      if (!orderRes.data?.ok || !orderRes.data?.order) {
        throw new Error(orderRes.data?.error || 'Failed to create subscription order');
      }

      const orderData = orderRes.data.order;

      // Check if Razorpay Checkout script is loaded in browser window
      const win = typeof window !== 'undefined' ? (window as Window & { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }) : null;
      if (win?.Razorpay) {
        const rzp = new win.Razorpay({
          key: orderData.keyId,
          amount: orderData.amount * 100,
          currency: orderData.currency || 'INR',
          name: 'Order It Up',
          description: `${PRICING_PLANS[planKey].name} (${billingCycle.toUpperCase()})`,
          order_id: orderData.orderId,
          handler: async function (response: Record<string, string>) {
            try {
              const verifyRes = await api.post('/subscription/verify-payment', {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                plan: planKey,
                billingCycle,
              });

              if (verifyRes.data?.ok) {
                toast.success(verifyRes.data.message || 'Subscription successfully activated!');
                fetchSubscription();
              } else {
                toast.error(verifyRes.data?.error || 'Payment verification failed');
              }
            } catch (vErr: unknown) {
              const msg = (vErr as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Payment verification failed on server';
              toast.error(msg);
            }
          },
          modal: {
            ondismiss: function () {
              toast('Checkout was cancelled.');
            },
          },
        });
        rzp.open();
      } else {
        // Fallback for development / staging sandbox test mode
        toast.success(`Order created: ${orderData.orderId}. Waiting for payment gateway callback.`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error || (err as Error)?.message || 'Could not initiate checkout';
      toast.error(msg);
    } finally {
      setInitiatingPayment(null);
    }
  };

  // Handle offline commercial license activation (Asymmetric Ed25519)
  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) {
      toast.error('Please enter a commercial license key.');
      return;
    }

    try {
      setActivatingLicense(true);
      const res = await api.post('/subscription/activate', {
        licenseKey: licenseKeyInput.trim(),
      });

      if (res.data?.ok) {
        toast.success(res.data.message || 'License activated successfully!');
        setLicenseKeyInput('');
        fetchSubscription();
      } else {
        toast.error(res.data?.error || 'Failed to activate license');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'License verification failed';
      toast.error(msg);
    } finally {
      setActivatingLicense(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 size={13} /> Active</span>;
      case 'trial':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300"><Sparkles size={13} /> Trial Period</span>;
      case 'grace_period':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300"><AlertTriangle size={13} /> Grace Period (7 Days)</span>;
      case 'suspended':
      case 'expired':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300"><XCircle size={13} /> Expired / Suspended</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-800">{status || 'Unknown'}</span>;
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* 1. Header & Live Subscription Status Overview */}
      <div className="bg-card rounded-2xl border-2 border-border p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand/10 text-brand rounded-xl">
              <ShieldCheck size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">Commercial License & Plan</h2>
                {getStatusBadge(subInfo?.status)}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your Order It Up active commercial plan, online billing, and offline license keys.
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchSubscription} 
            disabled={loading}
            className="self-start sm:self-auto gap-2"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Plan</p>
            <p className="text-lg font-bold text-foreground capitalize mt-1">
              {subInfo?.plan ? `${subInfo.plan} Edition` : 'Loading...'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operational Status</p>
            <p className="text-lg font-bold text-foreground mt-1 flex items-center gap-1.5">
              {subInfo?.isOperational ? (
                <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={16} /> Operational</span>
              ) : (
                <span className="text-rose-600 flex items-center gap-1"><Lock size={16} /> Locked</span>
              )}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Days Remaining</p>
            <p className="text-lg font-bold text-foreground mt-1">
              {subInfo ? `${subInfo.daysRemaining} Days` : '—'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expiration Date</p>
            <p className="text-sm font-semibold text-foreground mt-1 truncate">
              {subInfo?.currentPeriodEnd 
                ? new Date(subInfo.currentPeriodEnd).toLocaleDateString(undefined, { dateStyle: 'medium' })
                : subInfo?.trialExpiresAt 
                  ? new Date(subInfo.trialExpiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
                  : '—'}
            </p>
          </div>
        </div>

        {/* Active Entitlements Overview */}
        {subInfo?.entitlements && (
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Included Feature Entitlements</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
              <span className={`flex items-center gap-1.5 p-2 rounded-lg border ${subInfo.entitlements.multiTerminal ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-muted/30 text-muted-foreground border-border'}`}>
                {subInfo.entitlements.multiTerminal ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} />} Multi-Terminal
              </span>
              <span className={`flex items-center gap-1.5 p-2 rounded-lg border ${subInfo.entitlements.kdsStations ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-muted/30 text-muted-foreground border-border'}`}>
                {subInfo.entitlements.kdsStations ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} />} Kitchen KDS
              </span>
              <span className={`flex items-center gap-1.5 p-2 rounded-lg border ${subInfo.entitlements.cloudSync ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-muted/30 text-muted-foreground border-border'}`}>
                {subInfo.entitlements.cloudSync ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} />} Cloud HQ Sync
              </span>
              <span className={`flex items-center gap-1.5 p-2 rounded-lg border ${subInfo.entitlements.whatsappReceipts ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-muted/30 text-muted-foreground border-border'}`}>
                {subInfo.entitlements.whatsappReceipts ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} />} WhatsApp Bills
              </span>
              <span className={`flex items-center gap-1.5 p-2 rounded-lg border ${subInfo.entitlements.inventoryTracking ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-muted/30 text-muted-foreground border-border'}`}>
                {subInfo.entitlements.inventoryTracking ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} />} Inventory Recipes
              </span>
              <span className={`flex items-center gap-1.5 p-2 rounded-lg border ${subInfo.entitlements.multiOutlet ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-muted/30 text-muted-foreground border-border'}`}>
                {subInfo.entitlements.multiOutlet ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} />} Multi-Outlet HQ
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Commercial Pricing Tiers & Online Razorpay Upgrade */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Select Plan & Renewal</h3>
            <p className="text-sm text-muted-foreground">Choose a server-authoritative tier with instant Razorpay checkout.</p>
          </div>
          
          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center p-1 bg-muted rounded-xl border border-border self-start">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                billingCycle === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                billingCycle === 'yearly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yearly Billing
              <span className="px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 rounded font-bold">Save 17%</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(Object.keys(PRICING_PLANS) as Array<keyof typeof PRICING_PLANS>).map((key) => {
            const plan = PRICING_PLANS[key];
            const isCurrent = subInfo?.plan === key && subInfo?.status === 'active';
            const price = plan[billingCycle];

            return (
              <div 
                key={key} 
                className={`relative bg-card rounded-2xl border-2 p-6 flex flex-col justify-between transition-all ${
                  plan.popular ? 'border-brand shadow-md md:-translate-y-1' : 'border-border'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-brand text-brand-foreground text-xs font-bold rounded-full uppercase tracking-wider">
                    Most Popular
                  </span>
                )}

                <div>
                  <h4 className="text-lg font-bold text-foreground">{plan.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1 min-h-[32px]">{plan.description}</p>
                  
                  <div className="mt-4 mb-6">
                    <span className="text-3xl font-extrabold text-foreground">₹{price.toLocaleString('en-IN')}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-foreground mb-6">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-brand shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  onClick={() => handleStartCheckout(key)}
                  disabled={initiatingPayment !== null || !isAdmin}
                  variant={plan.popular ? 'default' : 'outline'}
                  className="w-full gap-2"
                >
                  {isCurrent ? (
                    'Renew Current Plan'
                  ) : initiatingPayment === key ? (
                    'Initiating...'
                  ) : (
                    <>Upgrade to {plan.name} <ArrowRight size={14} /></>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Offline Asymmetric Commercial License Key Activation */}
      <div className="bg-card rounded-2xl border-2 border-border p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-neutral-100 rounded-xl text-neutral-800">
            <KeyRound size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Activate Offline Commercial License</h3>
            <p className="text-xs text-muted-foreground">
              Air-gapped restaurants and enterprise volume licenses can be activated using an asymmetric Ed25519 token.
            </p>
          </div>
        </div>

        <form onSubmit={handleActivateLicense} className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="OIU2.ENTERPRISE.67c13400.STORE01.SIG..."
            value={licenseKeyInput}
            onChange={(e) => setLicenseKeyInput(e.target.value)}
            disabled={activatingLicense || !isAdmin}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <Button 
            type="submit" 
            disabled={activatingLicense || !isAdmin || !licenseKeyInput.trim()}
            className="gap-2 shrink-0"
          >
            {activatingLicense ? 'Verifying...' : 'Activate Offline Key'}
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground mt-2">
          Note: Customer installations verify signed licenses against the official public key. Private keys are never held on premise.
        </p>
      </div>
    </div>
  );
}
