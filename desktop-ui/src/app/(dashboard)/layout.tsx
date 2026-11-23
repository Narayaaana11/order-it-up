'use client';

import { usePathname } from 'next/navigation';
import AppSidebar from '@/components/layout/Sidebar';
import AuthGuard from '@/components/layout/AuthGuard';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import StatusBar from '@/components/layout/StatusBar';
import GlobalNotifications from '@/components/layout/GlobalNotifications';
import TitleBar from '@/components/layout/TitleBar';
import { usePrinterStatusSync } from '@/hooks/usePrinter';
import BottomNav from '@/components/layout/BottomNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPos = pathname === '/pos' || pathname === '/kds';
  const isSettings = pathname === '/settings';
  
  usePrinterStatusSync();

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen className="flex h-screen min-h-0 flex-col w-full md:pb-0 pb-[64px]" style={{ minHeight: 0 }}>
        <TitleBar />
        <div className="flex min-h-0 flex-1 w-full overflow-hidden">
          <div className="hidden md:flex">
            <AppSidebar />
          </div>
          <SidebarInset className="h-full min-h-0 overflow-hidden flex flex-col w-full">
            {!isPos && <GlobalNotifications />}
            <div className={isPos
              ? 'flex-1 min-h-0 flex flex-col overflow-hidden p-4'
              : isSettings
              ? 'flex-1 min-h-0 p-4 overflow-auto md:overflow-hidden min-w-0'
              : 'flex-1 p-4 overflow-auto min-w-0'
            }>
              {children}
            </div>
            <StatusBar showUpdateBadge={false} />
          </SidebarInset>
        </div>
        <BottomNav />
      </SidebarProvider>
    </AuthGuard>
  );
}
