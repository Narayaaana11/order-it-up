"use client";

import React, { useEffect, useRef, useState } from "react";

interface BlurTextProps {
  text: string;
  delay?: number; // ms per word
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  onAnimationComplete?: () => void;
}

export default function BlurText({
  text = "",
  delay = 50,
  className = "",
  animateBy = "words",
  direction = "top",
  onAnimationComplete,
}: BlurTextProps) {
  const elements = animateBy === "words" ? text.split(" ") : text.split("");
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      { threshold: 0.15 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (inView && onAnimationComplete) {
      const totalTime = elements.length * delay + 700;
      const timer = setTimeout(onAnimationComplete, totalTime);
      return () => clearTimeout(timer);
    }
  }, [inView, elements.length, delay, onAnimationComplete]);

  return (
    <span ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {elements.map((element, index) => {
        const wordDelay = index * delay;
        const translateY = direction === "top" ? "-20px" : "20px";

        return (
          <span
            key={index}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              filter: inView ? "blur(0px)" : "blur(12px)",
              opacity: inView ? 1 : 0,
              transform: inView ? "translate3d(0, 0, 0)" : `translate3d(0, ${translateY}, 0)`,
              transition: `filter 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) ${wordDelay}ms, opacity 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) ${wordDelay}ms, transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) ${wordDelay}ms`,
            }}
          >
            {element === " " ? "\u00A0" : element}
            {animateBy === "words" && index < elements.length - 1 && "\u00A0"}
          </span>
        );
      })}
    </span>
  );
}

