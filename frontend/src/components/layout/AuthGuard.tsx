'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'use-intl';
import { useAuthStore } from '@/store/auth';
import api, { isElectronEnvironment } from '@/lib/api';
import { showPrintLanguageLoadErrorsToast } from '@/lib/printer/warnings-toast';
import { getRoleDefaultRoute, type UserRoleInfo } from '@/lib/role-routing';

export function getLandingPage(): string {
  const isElectron = isElectronEnvironment();
  if (typeof window !== 'undefined') {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const u: UserRoleInfo = JSON.parse(storedUser);
        return getRoleDefaultRoute(u, isElectron);
      }
    } catch {}
  }
  return getRoleDefaultRoute(null, isElectron);
}

const PUBLIC_PATHS = [
  '/',
  '/kds',
  '/kds-standalone',
  '/server-standalone',
  '/auth/login',
  '/auth/register',
  '/auth/recover',
  '/setup',
  '/qr',
  '/menu',
  '/cloud-portal',
];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common');
  const { user, currentTenant, loading, loadFromStorage } = useAuthStore();
  const printLanguageLoadErrors = useAuthStore((s) => s.printLanguageLoadErrors);
  const router = useRouter();
  const pathname = usePathname();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(() => {
    // In web / Cloudflare deployment, there is no desktop SQLite setup wizard
    if (typeof window !== 'undefined' && !isElectronEnvironment()) {
      return false;
    }
    return null;
  });

  const isRootPath = pathname === '/';
  const isPublicPath = isRootPath || PUBLIC_PATHS.some(p => p !== '/' && (pathname === p || pathname?.startsWith(p + '/')));
  const isSetupPath = pathname === '/setup' || pathname?.startsWith('/setup/');
  const isStandalonePath = pathname?.startsWith('/kds') || pathname?.startsWith('/server-standalone');

  useEffect(() => {
    // Standalone KDS and Server App pages manage their own auth sessions;
    // skip loading shared POS auth store to avoid clearing their tokens.
    if (isStandalonePath) return;
    loadFromStorage();
  }, [isStandalonePath, loadFromStorage]);

  useEffect(() => {
    showPrintLanguageLoadErrorsToast(printLanguageLoadErrors);
  }, [printLanguageLoadErrors]);

  // Single effect: determine where to redirect after auth state + setup status are known
  useEffect(() => {
    if (loading) return; // wait for auth state to load

    // If we don't know setup status yet, fetch it (desktop only)
    if (!isStandalonePath && needsSetup === null && isElectronEnvironment()) {
      const controller = new AbortController();
      let active = true;
      api.get('/auth/setup/status', { signal: controller.signal })
        .then(({ data }) => {
          if (active) setNeedsSetup(Boolean(data?.needsSetup));
        })
        .catch((err) => {
          if (!active || (err instanceof Error && (err.name === 'CanceledError' || err.name === 'AbortError'))) return;
          console.error('[AuthGuard] Failed to check setup status:', err);
          // Fail closed: do not allow normal app routes when setup state is unknown.
          setNeedsSetup(true);
        });
      return () => {
        active = false;
        controller.abort();
      };
    }

    if (needsSetup && !isSetupPath && isElectronEnvironment()) {
      router.push('/setup');
      return;
    }

    if (isPublicPath) return; // don't redirect from public paths

    // Auth loaded + setup status known + not on public path
    if (!user) {
      router.push('/auth/login');
    } else if (!currentTenant && isElectronEnvironment()) {
      router.push('/auth/login?select_tenant=true');
    }
  }, [loading, user, currentTenant, isPublicPath, isSetupPath, isStandalonePath, needsSetup, router]);

  if (isStandalonePath || isSetupPath || isPublicPath) {
    return <>{children}</>;
  }

  if (loading || (isElectronEnvironment() && (needsSetup === null || needsSetup === true))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">{t('loadingScreen')}</p>
        </div>
      </div>
    );
  }

  if (!user || (!currentTenant && isElectronEnvironment())) return null;

  return <>{children}</>;
}
