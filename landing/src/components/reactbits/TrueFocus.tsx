"use client";

import React, { useState, useEffect } from "react";

interface TrueFocusProps {
  sentence: string;
  manualMode?: boolean;
  blurAmount?: number;
  borderColor?: string;
  glowColor?: string;
  animationDuration?: number;
  pauseBetweenAnimations?: number;
  className?: string;
}

export default function TrueFocus({
  sentence = "Offline First Architecture Zero Cloud Lockin Instant Printing",
  manualMode = false,
  blurAmount = 0,
  borderColor = "#F07928",
  glowColor = "rgba(240, 121, 40, 0.35)",
  animationDuration = 0.3,
  pauseBetweenAnimations = 2.2,
  className = "",
}: TrueFocusProps) {
  const words = sentence.split(" ");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (manualMode) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, (animationDuration + pauseBetweenAnimations) * 1000);

    return () => clearInterval(interval);
  }, [manualMode, words.length, animationDuration, pauseBetweenAnimations]);

  return (
    <div
      className={`inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 select-none ${className}`}
    >
      {words.map((word, index) => {
        const isCurrent = index === currentIndex;
        return (
          <span
            key={index}
            onMouseEnter={manualMode ? () => setCurrentIndex(index) : undefined}
            className={`relative inline-flex items-center px-2.5 py-1 rounded-lg font-bold text-sm sm:text-base md:text-lg transition-all duration-300 cursor-pointer ${
              isCurrent
                ? "text-orange-600 bg-orange-50/90 shadow-xs"
                : "text-slate-600 hover:text-slate-900 bg-transparent opacity-80"
            }`}
            style={{
              boxShadow: isCurrent ? `0 0 16px ${glowColor}` : "none",
              filter: !isCurrent && blurAmount > 0 ? `blur(${blurAmount}px)` : "none",
            }}
          >
            {/* Corner brackets directly framed on the active word */}
            {isCurrent && (
              <>
                <span
                  className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 rounded-tl-xs"
                  style={{ borderColor }}
                />
                <span
                  className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 rounded-tr-xs"
                  style={{ borderColor }}
                />
                <span
                  className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 rounded-bl-xs"
                  style={{ borderColor }}
                />
                <span
                  className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 rounded-br-xs"
                  style={{ borderColor }}
                />
              </>
            )}
            <span>{word}</span>
          </span>
        );
      })}
    </div>
  );
}
