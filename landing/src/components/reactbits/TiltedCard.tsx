"use client";

import React, { useRef, useState } from "react";

interface TiltedCardProps {
  children: React.ReactNode;
  className?: string;
  maxAngle?: number; // max tilt degrees
  perspective?: number; // px
  scaleOnHover?: number;
  showGlare?: boolean;
}

export default function TiltedCard({
  children,
  className = "",
  maxAngle = 10,
  perspective = 1000,
  scaleOnHover = 1.02,
  showGlare = true,
}: TiltedCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * maxAngle;
    const rotY = ((x - centerX) / centerX) * maxAngle;

    setRotateX(rotX);
    setRotateY(rotY);

    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setGlarePos({ x: glareX, y: glareY, opacity: 0.35 });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: `${perspective}px`,
      }}
      className={`relative ${className}`}
    >
      <div
        className="w-full h-full relative transition-all duration-200 ease-out will-change-transform rounded-2xl"
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${
            isHovered ? scaleOnHover : 1
          }, ${isHovered ? scaleOnHover : 1}, 1)`,
          transformStyle: "preserve-3d",
        }}
      >
        {children}

        {showGlare && (
          <div
            className="pointer-events-none absolute inset-0 z-30 rounded-2xl transition-opacity duration-300"
            style={{
              opacity: glarePos.opacity,
              background: `radial-gradient(circle 320px at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.4), transparent 60%)`,
            }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

