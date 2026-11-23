'use client';

import { useDroppable } from '@dnd-kit/react';
import { ReactNode } from 'react';
import { useTranslations } from 'use-intl';
import { STATUS_CONFIG, type KitchenStatus } from '@/hooks/useKdsConnection';

export interface KdsColumnProps {
  status: KitchenStatus;
  count: number;
  children: ReactNode;
}

export function KdsColumn({ status, count, children }: KdsColumnProps) {
  const t = useTranslations('kds');
  const config = STATUS_CONFIG[status];
  const statusLabel = t(config.labelKey);

  const { ref, isDropTarget } = useDroppable({
    id: `column-${status}`,
    data: { status },
  });

  const headerColorMap: Record<string, string> = {
    pending:   'bg-orange-500 border-orange-500 text-white',
    preparing: 'bg-blue-600 border-blue-600 text-white',
    ready:     'bg-emerald-500 border-emerald-500 text-white',
    served:    'bg-gray-500 border-gray-500 text-white',
  };
  const headerColor = headerColorMap[status] ?? 'bg-muted border-border text-foreground';

  return (
    <div className="flex-1 min-w-[280px] flex flex-col">
      {/* Column header — large, bold, colour-coded for distant readability */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl border-2 ${headerColor}`}>
        <span className="text-xl font-black tracking-wide uppercase">{statusLabel}</span>
        <span className={`text-lg font-extrabold tabular-nums px-2.5 py-0.5 rounded-full bg-white/20`}>
          {count}
        </span>
      </div>

      <div
        ref={ref}
        className={`flex-1 border-2 ${config.border} border-t-0 rounded-b-xl p-2 space-y-2.5 overflow-y-auto transition-colors ${
          isDropTarget ? 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-400 ring-inset' : 'bg-muted/30'
        }`}
        style={{ minHeight: '60vh', maxHeight: 'calc(100vh - 200px)' }}
      >
        {children}
        {count === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50 text-sm gap-1">
            <span className="text-3xl">✓</span>
            <span>{t('emptyColumn')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
