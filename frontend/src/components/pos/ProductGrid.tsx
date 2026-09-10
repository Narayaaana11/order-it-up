'use client';

import { useMemo } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import type { Category, Product } from '@/lib/types';
import { useCartStore } from '@/store/cart';
import { usePosSettingsStore } from '@/store/pos-settings';
import { nameToColor } from '@/lib/image-utils';
import TagBadge from './DietaryBadge';
import api from '@/lib/api';
import { useTranslations } from 'use-intl';
import { parseDbTimestamp, cn } from '@/lib/utils';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { resolveScannedProduct } from '@/lib/scale-barcode';

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; activeBg: string; activeText: string }> = {
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', activeBg: 'bg-red-500', activeText: 'text-white' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', activeBg: 'bg-orange-500', activeText: 'text-white' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', activeBg: 'bg-amber-500', activeText: 'text-white' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', activeBg: 'bg-yellow-500', activeText: 'text-white' },
  lime: { bg: 'bg-lime-50', text: 'text-lime-700', border: 'border-lime-200', activeBg: 'bg-lime-500', activeText: 'text-white' },
  green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', activeBg: 'bg-green-500', activeText: 'text-white' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', activeBg: 'bg-emerald-500', activeText: 'text-white' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', activeBg: 'bg-teal-500', activeText: 'text-white' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', activeBg: 'bg-cyan-500', activeText: 'text-white' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', activeBg: 'bg-sky-500', activeText: 'text-white' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', activeBg: 'bg-blue-500', activeText: 'text-white' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', activeBg: 'bg-indigo-500', activeText: 'text-white' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', activeBg: 'bg-violet-500', activeText: 'text-white' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', activeBg: 'bg-purple-500', activeText: 'text-white' },
  fuchsia: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200', activeBg: 'bg-fuchsia-500', activeText: 'text-white' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', activeBg: 'bg-pink-500', activeText: 'text-white' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', activeBg: 'bg-rose-500', activeText: 'text-white' },
};

function getCategoryColorClasses(color: string | null | undefined) {
  if (!color) return null;
  return CATEGORY_COLORS[color.toLowerCase()] || null;
}

interface Props {
  categories: Category[];
  products: Product[];
  selectedCategory: string | null;
  setSelectedCategory: (id: string | null) => void;
  search: string;
  setSearch: (s: string) => void;
  currency: string;
  onProductClick: (product: Product) => void;
  sidebarOpen?: boolean;
}

export default function ProductGrid({
  categories, products, selectedCategory, setSelectedCategory,
  search, onProductClick, sidebarOpen = true,
}: Props) {
  const cart = useCartStore();
  const { showProductImages } = usePosSettingsStore();
  const t = useTranslations('pos');
  const fmt = useFormatCurrency();
  const cartQuantities = useMemo(() => {
    const quantities = new Map<Product['id'], number>();
    for (const item of cart.items) {
      quantities.set(item.product.id, (quantities.get(item.product.id) || 0) + item.quantity);
    }
    return quantities;
  }, [cart.items]);

  const filtered = products.filter((p) => {
    const matchCat = !selectedCategory || p.category_id === selectedCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div data-testid="pos-product-grid" className="flex-1 flex min-w-0 h-full overflow-hidden bg-background">
      
      {/* Left Sidebar: Categories */}
      <div className="w-24 md:w-32 lg:w-48 shrink-0 border-r border-border h-full overflow-y-auto bg-card hide-scrollbar flex flex-col gap-2 p-3">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            "w-full px-3 py-3 rounded-xl text-sm font-semibold transition-all text-start leading-tight",
            !selectedCategory 
              ? "bg-brand text-white shadow-md shadow-brand/20" 
              : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {t('allCategories')}
        </button>
        
        {categories.filter((cat) => cat.id != null).map((cat) => {
          const colorClasses = getCategoryColorClasses(cat.color);
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "w-full px-3 py-3 rounded-xl text-sm font-semibold transition-all text-start leading-tight",
                isSelected
                  ? colorClasses
                    ? `${colorClasses.activeBg} ${colorClasses.activeText} shadow-md`
                    : 'bg-brand text-white shadow-md shadow-brand/20'
                  : colorClasses
                    ? `${colorClasses.bg} ${colorClasses.text} hover:opacity-80`
                    : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Right Area: Products */}
      <div className="flex-1 overflow-y-auto p-4 bg-muted/20">
        <div className={`grid gap-3 ${
          sidebarOpen 
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' 
            : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5'
        }`}>
          {filtered.map((product) => {
            const inCartQty = cartQuantities.get(product.id) || 0;
            
            return (
              <button
                key={product.id}
                data-testid="pos-product-card"
                type="button"
                onClick={() => onProductClick(product)}
                className="min-h-[140px] bg-card rounded-2xl p-3 border border-border/60 hover:border-brand/40 active:border-brand active:bg-brand/5 active:scale-[0.98] hover:shadow-lg hover:shadow-brand/5 transition-all text-start relative cursor-pointer overflow-hidden touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand flex flex-col group"
              >
                {!!product.track_inventory && (
                  <>
                    {product.stock_quantity <= 0 ? (
                      <span className="absolute top-2 start-2 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm border border-red-200 pointer-events-none">
                        {t('outOfStock')}
                      </span>
                    ) : product.stock_quantity <= (product.low_stock_threshold || 0) ? (
                      <span className="absolute top-2 start-2 bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm border border-orange-200 pointer-events-none">
                        {t('lowStock')}
                      </span>
                    ) : null}
                  </>
                )}
                {inCartQty > 0 && (
                  <span className="absolute top-0 end-0 bg-brand text-white text-xs w-7 h-7 rounded-es-2xl flex items-center justify-center font-bold z-10 shadow-sm">
                    {inCartQty}
                  </span>
                )}

                {showProductImages && (
                  <div className="w-full aspect-[4/3] rounded-xl mb-3 relative overflow-hidden bg-muted/50">
                    {/* Always-visible background tile — no flash when image loads */}
                    <div
                      className="absolute inset-0 flex items-center justify-center transition-transform group-hover:scale-105"
                      style={{ backgroundColor: nameToColor(product.name) }}
                    >
                      <span className="text-2xl font-bold text-white/80">
                        {product.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>

                    {/* Image overlays the tile when available */}
                    {product.has_image && (
                      <img
                        src={`${api.defaults.baseURL}/products/${product.id}/image?t=${product.updated_at ? parseDbTimestamp(product.updated_at).getTime() : 0}`}
                        alt={product.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}

                    {product.tags && product.tags.length > 0 && (
                      <span className="absolute bottom-2 end-2 z-10">
                        <TagBadge tag={product.tags[0]} />
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-auto w-full">
                  <h3 className="font-semibold text-foreground text-sm line-clamp-2 leading-tight mb-1.5">{product.name}</h3>
                  <div className="flex items-center justify-between w-full">
                    <p className="text-brand font-bold text-base">
                      {fmt(Number(product.price))}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {!showProductImages && product.tags && product.tags.length > 0 && (
                        <TagBadge tag={product.tags[0]} />
                      )}
                      {product.addon_groups && product.addon_groups.length > 0 && (
                        <span
                          className="touch-target -me-2 -my-2 rounded-lg text-muted-foreground/60"
                          title={t('customisable')}
                          aria-label={t('customisable')}
                        >
                          <SlidersHorizontal size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
