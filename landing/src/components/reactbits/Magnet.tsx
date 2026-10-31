"use client";

import React, { useRef, useState } from "react";

interface MagnetProps {
  children: React.ReactNode;
  padding?: number;
  magnetStrength?: number;
  disabled?: boolean;
  className?: string;
}

export default function Magnet({
  children,
  padding = 40,
  magnetStrength = 2.5,
  disabled = false,
  className = "",
}: MagnetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !containerRef.current) return;
    const { left, top, width, height } = containerRef.current.getBoundingClientRect();

    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const distFromCenterX = e.clientX - centerX;
    const distFromCenterY = e.clientY - centerY;

    if (
      Math.abs(distFromCenterX) <= width / 2 + padding &&
      Math.abs(distFromCenterY) <= height / 2 + padding
    ) {
      setPosition({
        x: distFromCenterX / magnetStrength,
        y: distFromCenterY / magnetStrength,
      });
    } else {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`inline-block ${className}`}
    >
      <div
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition: "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

