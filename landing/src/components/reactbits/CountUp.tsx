"use client";

import React, { useEffect, useRef, useState } from "react";

interface CountUpProps {
  to: number;
  from?: number;
  duration?: number; // seconds
  delay?: number; // seconds
  decimals?: number;
  separator?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  startWhen?: boolean;
}

export default function CountUp({
  to,
  from = 0,
  duration = 2,
  delay = 0,
  decimals = 0,
  separator = ",",
  prefix = "",
  suffix = "",
  className = "",
  startWhen = true,
}: CountUpProps) {
  const [value, setValue] = useState(from);
  const ref = useRef<HTMLSpanElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const animatedRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (ref.current) observer.unobserve(ref.current);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView || !startWhen || animatedRef.current) return;
    animatedRef.current = true;

    let startTimestamp: number | null = null;
    let frameId: number;

    const timeoutId = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = (timestamp - startTimestamp) / 1000;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out expo
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = from + (to - from) * easeProgress;
        setValue(current);

        if (progress < 1) {
          frameId = requestAnimationFrame(step);
        } else {
          setValue(to);
        }
      };

      frameId = requestAnimationFrame(step);
    }, delay * 1000);

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(frameId);
    };
  }, [isInView, startWhen, from, to, duration, delay]);

  const formattedNumber = (() => {
    const fixed = value.toFixed(decimals);
    if (!separator) return fixed;
    const parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return parts.join(".");
  })();

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formattedNumber}
      {suffix}
    </span>
  );
}

