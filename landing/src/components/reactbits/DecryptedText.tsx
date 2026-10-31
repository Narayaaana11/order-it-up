"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface DecryptedTextProps {
  text: string;
  speed?: number; // ms per frame
  maxIterations?: number;
  characters?: string;
  className?: string;
  animateOnHover?: boolean;
}

const DEFAULT_CHARS = "ABCDEF0123456789!<>-_\\/[]{}—=+*^?#";

export default function DecryptedText({
  text,
  speed = 40,
  maxIterations = 10,
  characters = DEFAULT_CHARS,
  className = "",
  animateOnHover = false,
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isScramblingRef = useRef(false);

  const startScramble = useCallback(() => {
    if (isScramblingRef.current) return;
    isScramblingRef.current = true;

    let iteration = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";
            if (index < iteration) {
              return text[index];
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join("")
      );

      if (iteration >= text.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(text);
        isScramblingRef.current = false;
      }

      iteration += 1 / (maxIterations / text.length);
    }, speed);
  }, [text, speed, maxIterations, characters]);

  useEffect(() => {
    if (!animateOnHover) {
      const timer = setTimeout(() => {
        startScramble();
      }, 50);
      return () => {
        clearTimeout(timer);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [animateOnHover, startScramble]);

  return (
    <span
      onMouseEnter={animateOnHover ? startScramble : undefined}
      className={`font-mono select-none ${className}`}
    >
      {displayText}
    </span>
  );
}
