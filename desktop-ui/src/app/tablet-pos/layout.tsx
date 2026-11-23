'use client';

import AuthGuard from '@/components/layout/AuthGuard';

/**
 * The tablet POS is a full-screen operational surface. It deliberately skips the
 * desktop dashboard chrome (sidebar, title bar, status bar, bottom navigation)
 * so the packaged Android app behaves like a dedicated POS terminal.
 */
export default function TabletPosLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="h-screen min-h-0 w-full overflow-hidden bg-background">
        {children}
      </div>
    </AuthGuard>
  );
}
