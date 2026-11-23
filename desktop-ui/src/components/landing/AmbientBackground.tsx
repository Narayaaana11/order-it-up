'use client';

import React, { useRef, useEffect } from 'react';

export interface AmbientBackgroundProps {
  children?: React.ReactNode;
  showSpotlight?: boolean;
  className?: string;
}

export default function AmbientBackground({
  children,
  showSpotlight = true,
  className = '',
}: AmbientBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSpotlight) return;

    const container = containerRef.current;
    if (!container) return;

    // Skip dynamic tracking if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        container.style.setProperty('--spotlight-x', `${x}px`);
        container.style.setProperty('--spotlight-y', `${y}px`);
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [showSpotlight]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={
        {
          '--spotlight-x': '50%',
          '--spotlight-y': '20%',
        } as React.CSSProperties
      }
    >
      {/* 1. Subtle Dot Matrix Grid with Radial Elliptical Fade Mask */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)] opacity-60"
        aria-hidden="true"
      />

      {/* 2. Interactive Spotlight Glow following cursor via CSS variables */}
      {showSpotlight && (
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(650px circle at var(--spotlight-x, 50%) var(--spotlight-y, 20%), rgba(240, 121, 40, 0.08), transparent 45%)',
          }}
          aria-hidden="true"
        />
      )}

      {/* 3. Soft Gradient Mesh Orbs */}
      <div
        className="pointer-events-none absolute -top-40 left-1/4 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-br from-orange-400/15 to-amber-300/10 blur-[130px] rounded-full animate-float-slow"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 -right-20 w-[450px] h-[450px] bg-gradient-to-bl from-amber-400/10 to-orange-500/10 blur-[140px] rounded-full animate-float-reverse"
        aria-hidden="true"
      />

      {/* Main Section Content */}
      {children ? <div className="relative z-10 w-full">{children}</div> : null}
    </div>
  );
}
