'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Package,
  Grid3X3,
  Users,
  UserCog,
  Settings,
  ChefHat,
  MessageCircle,
} from 'lucide-react';
import { useTranslations } from 'use-intl';
import { useAuthStore } from '@/store/auth';
import { usePosSettingsStore } from '@/store/pos-settings';
import { ROLE_ACCESS, hasRole } from '@shared/role-permissions';
import { cn } from '@/lib/utils';

const ALL_NAV_ITEMS = [
  { href: '/pos', labelKey: 'pos', icon: ShoppingCart, roles: ROLE_ACCESS.ownerManagerCashier, businessTypes: null },
  { href: '/orders', labelKey: 'orders', icon: ClipboardList, roles: ROLE_ACCESS.ownerManagerCashier, businessTypes: null },
  { href: '/tables', labelKey: 'tables', icon: Grid3X3, roles: ROLE_ACCESS.ownerManager, businessTypes: ['restaurant'] },
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, roles: ROLE_ACCESS.owner, businessTypes: null },
  { href: '/settings', labelKey: 'settings', icon: Settings, roles: ROLE_ACCESS.ownerManager, businessTypes: null },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { currentTenant } = useAuthStore();
  const { tablesRequired } = usePosSettingsStore();
  const t = useTranslations('nav');

  const role = currentTenant?.role || 'cashier';
  const businessType = currentTenant?.business_type || 'restaurant';

  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.href === '/tables' && !tablesRequired) return false;
    return hasRole(role, item.roles)
      && (item.businessTypes === null || item.businessTypes.includes(businessType));
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-card/95 backdrop-blur-md pb-safe shadow-[0_-1px_12px_rgba(0,0,0,0.08)]">
      {navItems.map((item) => {
        const [hrefPath, hrefQuery] = item.href.split('?');
        const isActive = !hrefQuery && (pathname === hrefPath || pathname?.startsWith(hrefPath + '/'));

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all"
          >
            <div className={cn(
              "flex items-center justify-center w-10 h-7 rounded-xl transition-all",
              isActive ? "bg-brand/15 scale-105" : "scale-100"
            )}>
              <item.icon
                className={cn(
                  "transition-all",
                  isActive ? "size-5 text-brand" : "size-5 text-muted-foreground"
                )}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
            </div>
            <span className={cn(
              "text-[10px] leading-none font-medium transition-colors",
              isActive ? "text-brand font-bold" : "text-muted-foreground"
            )}>
              {t(item.labelKey as any)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
