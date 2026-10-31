"use client";

import React, { useState, useEffect } from "react";

interface RotatingTextProps {
  texts: string[];
  interval?: number; // ms
  className?: string;
  wordClassName?: string;
}

export default function RotatingText({
  texts,
  interval = 3000,
  className = "",
  wordClassName = "",
}: RotatingTextProps) {
  const [index, setIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (texts.length <= 1) return;

    const timer = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % texts.length);
        setIsAnimating(false);
      }, 350); // halfway transition time
    }, interval);

    return () => clearInterval(timer);
  }, [texts.length, interval]);

  return (
    <span
      className={`inline-block relative overflow-hidden align-middle transition-all duration-300 ${className}`}
    >
      <span
        className={`inline-block transition-all duration-300 transform ${
          isAnimating
            ? "-translate-y-full opacity-0 filter blur-xs"
            : "translate-y-0 opacity-100 filter blur-0"
        } ${wordClassName}`}
      >
        {texts[index]}
      </span>
    </span>
  );
}

