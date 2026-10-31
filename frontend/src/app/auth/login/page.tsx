'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
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
import { Eye, EyeOff } from 'lucide-react';
import { ROLE_LABEL_KEYS } from '@/lib/i18n-enums';
import { isElectronEnvironment } from '@/lib/api';

// Backend enum → leaf key maps for the tenant picker.
type BusinessTypeKey = keyof AppConfig['Messages']['businessType'];

const BUSINESS_TYPE_LEAF_KEYS: Record<string, BusinessTypeKey> = {
  restaurant: 'restaurant',
};

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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const triggerDesktopDownload = () => {
    try {
      const blob = new Blob(
        [
          `Order It Up Desktop POS v1.2.0\n` +
          `Platform: Windows 10 / 11 (x64 / ARM64)\n` +
          `Engine: Standalone Electron + Express (:3001) + SQLite WAL\n` +
          `Zero Cloud Lock-in • Offline Durability Guaranteed\n` +
          `Artifact: Order-It-Up-Setup.exe\n` +
          `Visit: https://orderitup.pages.dev/ for documentation.`
        ],
        { type: 'application/octet-stream' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Order-It-Up-Setup.exe';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download trigger error:', err);
    }
  };

  const handleGoogleDemoSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      // Simulate brief network connection
      await new Promise((resolve) => setTimeout(resolve, 600));

      const demoOwnerUser = {
        id: 'usr_owner_01',
        name: 'Priya Sharma',
        email: 'demo.owner@orderitup.in',
        role: 'owner',
        isOwner: true,
        organization_id: 'org_demo_showcase_01',
        organization_name: 'The Rustic Olive Bistro & Bar',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      };

      const demoTenant = {
        id: 'org_demo_showcase_01',
        business_name: 'The Rustic Olive Bistro & Bar',
        name: 'The Rustic Olive Bistro & Bar',
        slug: 'the-rustic-olive',
        database_name: 'cloud_d1',
        business_type: 'restaurant' as const,
        country: 'IN',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        plan: 'saas_production',
        status: 'active',
        role: 'owner',
      };

      const demoToken = 'demo_google_jwt_token_priya_sharma';

      localStorage.setItem('token', demoToken);
      localStorage.setItem('cloud_token', demoToken);
      localStorage.setItem('user', JSON.stringify(demoOwnerUser));
      localStorage.setItem('tenant', JSON.stringify(demoTenant));
      localStorage.setItem(
        'orderitup_demo_auth_user',
        JSON.stringify({
          id: demoOwnerUser.id,
          name: demoOwnerUser.name,
          email: demoOwnerUser.email,
          role: demoOwnerUser.role,
          organizationId: demoOwnerUser.organization_id,
          organizationName: demoOwnerUser.organization_name,
          token: demoToken,
        })
      );

      useAuthStore.setState({
        user: demoOwnerUser as any,
        token: demoToken,
        tenants: [demoTenant as any],
        currentTenant: demoTenant as any,
        loading: false,
      });

      toast.success('Signed in with Google as Demo Owner');

      if (searchParams.get('redirect') === 'download') {
        triggerDesktopDownload();
      }

      router.push(getLandingPage());
    } catch (err) {
      console.error('Google Sign-in failed:', err);
      toast.error('Google sign-in demo failed');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  useEffect(() => {
    // Only check local SQLite setup and health in Electron desktop environment
    if (!isElectronEnvironment()) return;

    fetch('/api/auth/setup/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.needsSetup) router.replace('/setup');
      })
      .catch(() => {});

    fetch('/api/health')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.status !== 'ok') {
          setDbError(data.db || t('dbErrorPrefix'));
        }
      })
      .catch(() => {});
  }, [router, t]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const handleTenantSelect = useCallback(async (tenantId: number | string) => {
    setLoading(true);
    try {
      await selectTenant(tenantId);
      // useEffect on currentTenant will handle the redirect
    } catch {
      toast.error(t('selectBusinessFailed'));
    } finally {
      setLoading(false);
    }
  }, [selectTenant, t]);

  useEffect(() => {
    // Navigate to landing page once user and tenant are selected (auto-selection handled in auth store).
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
        // Server login succeeded but the session could not be persisted.
        setLoginError(t('storageUnavailable'));
      } else {
        const failure = parseLoginFailure(err);
        if (failure.status === 401) {
          const remaining = failure.attemptsRemaining;
          if (remaining === 0) {
            // Just got locked out
            const mins = failure.lockoutMinutes ?? 15;
            setLoginError(t('lockedOut', { minutes: mins }));
          } else if (typeof remaining === 'number' && remaining < 4) {
            // Warn only when getting close (≤ 4 remaining to avoid noise on first attempt)
            setLoginError(
              t('invalidCredentials') + ' ' +
              t('attemptsRemaining', { count: remaining })
            );
          } else {
            setLoginError(t('invalidCredentials'));
          }
        } else if (failure.status === 429) {
          // Middleware-level lockout (authRateLimit window exhausted)
          setLoginError(t('lockedOut', { minutes: 15 }));
        } else if (failure.status === undefined) {
          // No HTTP response at all: the server was unreachable (network).
          setLoginError(t('connectionFailed'));
        } else {
          // Other server-side failures belong under the database/setup banner.
          setDbError(t('loginFailed'));
        }
      }
    } finally {
      setLoading(false);
    }
  };



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
                        {businessTypeKey ? tBusinessType(businessTypeKey) : tenant.business_type ?? ''} &middot; {roleKey ? tStaff(roleKey) : tenant.role ?? ''}
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Order It Up" width={96} height={96} className="mx-auto mb-3 object-contain" />
          <p className="text-muted-foreground mt-2">{t('signInTitle')}</p>
        </div>
        {dbError && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong>{t('dbErrorPrefix')}</strong> {dbError}
          </div>
        )}
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} dir="ltr" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('passwordPlaceholder')} className="pe-10" required />
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
              {loginError && (
                <p className="text-sm text-destructive text-center">{loginError}</p>
              )}
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

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or demo instant access</span>
                </div>
              </div>

              {/* Google Sign-in Demo Placeholder */}
              <button
                type="button"
                onClick={handleGoogleDemoSignIn}
                disabled={isGoogleLoading || loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                aria-label="Continue with Google"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isGoogleLoading ? "Connecting with Google..." : "Continue with Google"}</span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wide">
                  Demo
                </span>
              </button>
              <div className="pt-4 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">
                  Don&apos;t have a store account?{' '}
                  <Link
                    href="/auth/register"
                    className="font-semibold text-primary hover:underline transition-colors"
                  >
                    Create an account / Register here
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-[11px] text-muted-foreground/80 mt-4 tracking-wide">
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
