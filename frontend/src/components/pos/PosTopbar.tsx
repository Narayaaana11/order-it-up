'use client';

import PrinterStatus from './PrinterStatus';
import CustomerSearch from './CustomerSearch';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { usePosSettingsStore } from '@/store/pos-settings';
import { LayoutGrid, Maximize2, Minimize2, Search, UtensilsCrossed, Package, Truck, Globe } from 'lucide-react';
import type { Table } from '@/lib/types';
import { useTranslations } from 'use-intl';
import { cn } from '@/lib/utils';

interface Props {
  tables: Table[];
  onShowTablePicker: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  search: string;
  setSearch: (s: string) => void;
  onSearchEnter: (search: string) => void;
}

const orderTypeIcons = {
  dine_in: UtensilsCrossed,
  takeaway: Package,
  delivery: Truck,
  online: Globe,
};

export default function PosTopbar({ tables, onShowTablePicker, fullscreen, onToggleFullscreen, search, setSearch, onSearchEnter }: Props) {
  const cart = useCartStore();
  const { currentTenant } = useAuthStore();
  const tablesRequired = usePosSettingsStore((s) => s.tablesRequired);
  const t = useTranslations('pos');
  const isRestaurant = (currentTenant?.business_type ?? 'restaurant') === 'restaurant';
  const showTableBtn = isRestaurant && cart.orderType === 'dine_in' && tablesRequired;

  return (
    <div className="flex items-center gap-3 border-b bg-card shrink-0 px-4 py-2.5 shadow-sm z-10 relative">
      
      {/* Order Types */}
      <div className="flex gap-1 bg-muted/60 p-1 rounded-xl shrink-0">
        {(['dine_in', 'takeaway', 'delivery', 'online'] as const)
          .filter((type) => isRestaurant || type !== 'dine_in')
          .map((type) => {
            const Icon = orderTypeIcons[type];
            const label = type === 'dine_in' ? t('orderTypeDineIn') : type === 'takeaway' ? t('orderTypeTakeaway') : type === 'delivery' ? t('orderTypeDelivery') : t('orderTypeOnline');
            const isActive = cart.orderType === type;
            return (
              <button
                key={type}
                onClick={() => cart.setOrderType(type)}
                className={cn(
                  "touch-target flex items-center gap-1.5 px-3 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-background text-brand shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Icon size={16} />
                <span className="hidden xl:inline">{label}</span>
              </button>
            );
          })}
      </div>

      {/* Select Table */}
      {showTableBtn && (
        <button
          onClick={onShowTablePicker}
          className={cn(
            "touch-target shrink-0 gap-1.5 px-3 text-sm rounded-lg border font-bold transition-all whitespace-nowrap shadow-sm",
            cart.tableId
              ? "bg-brand text-primary-foreground border-brand hover:brightness-110"
              : "bg-amber-100/50 border-amber-300 text-amber-800 hover:bg-amber-100"
          )}
        >
          <LayoutGrid size={16} />
          {cart.tableId
            ? t('tableLabel', { name: tables.find(t => t.id === cart.tableId)?.name || cart.tableId })
            : t('selectTable')}
        </button>
      )}

      {/* Search */}
      <div className="relative flex-1 max-w-sm ms-auto">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearchEnter(search);
          }}
          placeholder={t('searchProducts')}
          className="w-full ps-9 pe-4 py-2 bg-muted/50 border-transparent focus:bg-background border rounded-xl focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all text-sm h-10"
        />
      </div>

      <div className="w-48 shrink-0">
        <CustomerSearch variant="topbar" />
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <PrinterStatus />
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="touch-target shrink-0 rounded-lg border border-border bg-card px-3 text-muted-foreground transition-colors hover:bg-muted active:bg-muted h-10"
          title={fullscreen ? t('exitFullscreen') : t('enterFullscreen')}
          aria-label={fullscreen ? t('exitFullscreen') : t('enterFullscreen')}
        >
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
}
