"use client";

import React from "react";

interface StarBorderProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  className?: string;
  color?: string;
  speed?: string;
  thickness?: number;
  children: React.ReactNode;
}

export default function StarBorder({
  as: Component = "div",
  className = "",
  color = "#F07928",
  speed = "5s",
  thickness = 2,
  children,
  style,
  ...rest
}: StarBorderProps) {
  return (
    <Component
      className={`star-border-container ${className}`}
      style={{
        padding: `${thickness}px`,
        ...style,
      }}
      {...rest}
    >
      <div
        className="star-border-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 18%)`,
          animationDuration: speed,
        }}
      />
      <div
        className="star-border-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 18%)`,
          animationDuration: speed,
        }}
      />
      <div className="star-border-content">{children}</div>
    </Component>
  );
}
