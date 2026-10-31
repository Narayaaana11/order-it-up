"use client";

import React from "react";

interface InfiniteScrollProps {
  children: React.ReactNode;
  speed?: number; // duration in seconds
  direction?: "left" | "right";
  pauseOnHover?: boolean;
  className?: string;
}

export default function InfiniteScroll({
  children,
  speed = 30,
  direction = "left",
  pauseOnHover = true,
  className = "",
}: InfiniteScrollProps) {
  return (
    <div
      className={`relative overflow-hidden w-full flex ${
        pauseOnHover ? "group" : ""
      } ${className}`}
    >
      <div
        className={`flex shrink-0 items-center gap-6 ${
          direction === "left" ? "animate-marquee-left" : "animate-marquee-right"
        } ${pauseOnHover ? "group-hover:[animation-play-state:paused]" : ""}`}
        style={{ animationDuration: `${speed}s` }}
      >
        {children}
      </div>
      <div
        className={`flex shrink-0 items-center gap-6 ${
          direction === "left" ? "animate-marquee-left" : "animate-marquee-right"
        } ${pauseOnHover ? "group-hover:[animation-play-state:paused]" : ""}`}
        style={{ animationDuration: `${speed}s` }}
        aria-hidden="true"
      >
        {children}
      </div>
    </div>
  );
}

