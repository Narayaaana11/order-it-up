'use client';

import React from 'react';

export interface ShimmerBadgeProps {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  text?: string;
  className?: string;
  shimmerClassName?: string;
}

export default function ShimmerBadge({
  children,
  icon,
  text,
  className = '',
  shimmerClassName = '',
}: ShimmerBadgeProps) {
  return (
    <div
      className={`relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-orange-200/90 bg-orange-50/90 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-orange-700 shadow-xs transition-all duration-300 hover:border-orange-300 hover:shadow-[0_0_15px_rgba(240,121,40,0.25)] ${className}`}
    >
      {/* Sweeping Specular Shimmer Beam */}
      <div
        className={`pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent ${shimmerClassName}`}
        aria-hidden="true"
      />

      {/* Icon */}
      {icon && <span className="relative z-10 shrink-0">{icon}</span>}

      {/* Content */}
      <span className="relative z-10">
        {children ?? text}
      </span>
    </div>
  );
}
