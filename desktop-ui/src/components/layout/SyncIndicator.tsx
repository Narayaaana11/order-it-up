'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SyncIndicator() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium animate-in fade-in zoom-in duration-300",
        "bg-destructive/10 text-destructive border border-destructive/20 shadow-sm"
      )}
      title="Offline mode. Orders are saved locally and will sync when reconnected."
    >
      <WifiOff className="size-3.5" />
      <span>Offline</span>
    </div>
  );
}
