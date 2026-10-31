"use client";

import React, { useState, useEffect, useRef } from "react";

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
  blurAmount = 4,
  borderColor = "#F07928",
  glowColor = "rgba(240, 121, 40, 0.4)",
  animationDuration = 0.4,
  pauseBetweenAnimations = 1.5,
  className = "",
}: TrueFocusProps) {
  const words = sentence.split(" ");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [focusRect, setFocusRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (manualMode) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, (animationDuration + pauseBetweenAnimations) * 1000);

    return () => clearInterval(interval);
  }, [manualMode, words.length, animationDuration, pauseBetweenAnimations]);

  useEffect(() => {
    const activeEl = wordRefs.current[currentIndex];
    const container = containerRef.current;
    if (!activeEl || !container) return;

    const containerRect = container.getBoundingClientRect();
    const wordRect = activeEl.getBoundingClientRect();

    setFocusRect({
      x: wordRect.left - containerRect.left - 6,
      y: wordRect.top - containerRect.top - 4,
      width: wordRect.width + 12,
      height: wordRect.height + 8,
    });
  }, [currentIndex]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex flex-wrap items-center gap-x-3 gap-y-2 select-none ${className}`}
    >
      {/* Animated Focus Box Bracket Frame */}
      <div
        className="pointer-events-none absolute transition-all ease-out z-10"
        style={{
          transform: `translate3d(${focusRect.x}px, ${focusRect.y}px, 0)`,
          width: `${focusRect.width}px`,
          height: `${focusRect.height}px`,
          transitionDuration: `${animationDuration}s`,
          border: `2px solid ${borderColor}`,
          borderRadius: "8px",
          boxShadow: `0 0 15px ${glowColor}`,
          opacity: focusRect.width > 0 ? 1 : 0,
        }}
      >
        <span
          className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2"
          style={{ borderColor }}
        />
        <span
          className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2"
          style={{ borderColor }}
        />
        <span
          className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2"
          style={{ borderColor }}
        />
        <span
          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2"
          style={{ borderColor }}
        />
      </div>

      {words.map((word, index) => {
        const isCurrent = index === currentIndex;
        return (
          <span
            key={index}
            ref={(el) => {
              wordRefs.current[index] = el;
            }}
            onMouseEnter={manualMode ? () => setCurrentIndex(index) : undefined}
            className="cursor-pointer font-bold text-lg sm:text-2xl transition-all duration-300"
            style={{
              filter: isCurrent ? "blur(0px)" : `blur(${blurAmount}px)`,
              opacity: isCurrent ? 1 : 0.45,
              color: isCurrent ? "#F07928" : "#475569",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

