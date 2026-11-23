'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'use-intl';
import { formatCurrencyForTenant } from '@/lib/countries';
import { useAuthStore } from '@/store/auth';

interface TaxLine {
  title: string;
  rate: number;
  amount: number;
}

interface Props {
  taxAmount: number;
  taxBreakdown: TaxLine[] | null | undefined;
  theme?: 'dark' | 'light';
}

export default function TaxBreakdown({ taxAmount, taxBreakdown, theme = 'dark' }: Props) {
  const t = useTranslations('pos');
  const currentTenant = useAuthStore((s) => s.currentTenant);
  const tenantCountry = currentTenant?.country;
  const tenantCurrency = currentTenant?.currency ?? 'INR';
  const [expanded, setExpanded] = useState(false);
  const breakdownArray = Array.isArray(taxBreakdown) ? taxBreakdown : [];
  const hasBreakdown = breakdownArray.length > 0;

  if (!taxAmount || taxAmount <= 0) return null;

  const fmt = (n: number) => formatCurrencyForTenant(n, tenantCountry, tenantCurrency);

  return (
    <div className="pt-1 mt-1 border-t border-border/50">
      <button
        onClick={() => hasBreakdown && setExpanded(!expanded)}
        className={`flex items-center gap-1.5 w-full text-start ${hasBreakdown ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
      >
        <span className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-slate-300'}`}>{t('tax')}</span>
        {hasBreakdown && (
          expanded
            ? <ChevronDown size={14} className={theme === 'light' ? 'text-gray-400' : 'text-slate-400'} />
            : <ChevronRight size={14} className={`rtl-flip ${theme === 'light' ? 'text-gray-400' : 'text-slate-400'}`} />
        )}
        <span className="flex-1" />
        <span className={`text-sm font-medium ${theme === 'light' ? 'text-gray-700' : 'text-slate-200'}`}>{fmt(taxAmount)}</span>
      </button>
      {expanded && hasBreakdown && (
        <div className="mt-2 space-y-1 bg-muted/30 p-2 rounded-lg">
          {breakdownArray.map((line, i) => {
            const title = line?.title || 'Tax';
            const rate = typeof line?.rate === 'number' ? line.rate : 0;
            const amount = typeof line?.amount === 'number' ? line.amount : 0;
            return (
              <div key={`${title}_${rate}_${i}`} className={`flex justify-between text-xs ${theme === 'light' ? 'text-gray-500' : 'text-slate-400'}`}>
                <span>{t('taxLine', { title, rate })}</span>
                <span>{fmt(amount)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
