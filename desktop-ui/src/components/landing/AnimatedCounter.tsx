'use client';

import React, { useEffect, useRef } from 'react';

export interface AnimatedCounterProps {
  value?: number;
  target?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export default function AnimatedCounter({
  value,
  target,
  duration = 1500,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: AnimatedCounterProps) {
  const targetValue = value !== undefined ? value : (target ?? 0);
  const elementRef = useRef<HTMLSpanElement>(null);
  const hasAnimatedRef = useRef<boolean>(false);

  const formatNumber = (num: number): string => {
    return `${prefix}${num.toFixed(decimals)}${suffix}`;
  };

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const format = (num: number): string => {
      return `${prefix}${num.toFixed(decimals)}${suffix}`;
    };

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      el.textContent = format(targetValue);
      hasAnimatedRef.current = true;
      return;
    }

    if (hasAnimatedRef.current) {
      el.textContent = format(targetValue);
      return;
    }

    let rafId: number | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          let startTime: number | null = null;

          const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / Math.max(duration, 1), 1);

            // Cubic ease-out curve: 1 - (1 - progress)^3
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = targetValue * easeOut;

            if (el) {
              el.textContent = format(current);
            }

            if (progress < 1) {
              rafId = requestAnimationFrame(animate);
            } else if (el) {
              el.textContent = format(targetValue);
            }
          };

          rafId = requestAnimationFrame(animate);
          observer.disconnect();
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [targetValue, duration, prefix, suffix, decimals]);

  return (
    <span
      ref={elementRef}
      className={`tabular-nums ${className}`}
      aria-label={formatNumber(targetValue)}
    >
      {formatNumber(0)}
    </span>
  );
}
