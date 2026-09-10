'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ChevronRight, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'use-intl';
import api from '@/lib/api';

export default function GlobalNotifications() {
  const tCustomers = useTranslations('customers');
  const tCommon = useTranslations('common');
  const [invalidPhonesCount, setInvalidPhonesCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  // Offline detection
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Customer alerts
  useEffect(() => {
    const fetchAlerts = () => {
      api.get('/customers/alerts')
        .then(res => {
          setInvalidPhonesCount(res.data?.invalidPhonesCount || 0);
        })
        .catch(err => {
          console.warn('[Notifications] Failed to fetch customer alerts:', err?.message);
        });
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Offline banner — shown when network is lost */}
      {!isOnline && (
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between shrink-0 z-50 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <WifiOff className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">You&apos;re offline</p>
              <p className="text-xs text-white/60 leading-tight">Orders will be saved and sync when you reconnect</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold bg-amber-400/10 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Offline Mode
          </span>
        </div>
      )}

      {/* Invalid phones alert */}
      {invalidPhonesCount > 0 && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-500 w-5 h-5 shrink-0" />
            <p className="text-sm text-red-800 font-medium">
              {tCustomers('invalidPhoneCount', { count: invalidPhonesCount })}
            </p>
            <Link
              href="/customers?filter=invalid_phones"
              className="text-sm text-red-600 hover:text-red-700 font-bold flex items-center underline underline-offset-2"
            >
              {tCommon('reviewFix')} <ChevronRight className="w-4 h-4 ms-0.5 rtl-flip" />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
