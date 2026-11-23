'use client';

import AuthGuard from '@/components/layout/AuthGuard';

/**
 * The waiter floor-station runs full screen on a phone or tablet; it shares the
 * POS catalog and cart components but not the desktop dashboard chrome.
 */
export default function TabletWaiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="h-screen min-h-0 w-full overflow-hidden bg-background">
        {children}
      </div>
    </AuthGuard>
  );
}
