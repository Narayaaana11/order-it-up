"use client";

import React, { useRef, useEffect } from "react";

interface SquaresProps {
  direction?: "diagonal" | "up" | "down" | "left" | "right";
  speed?: number;
  squareSize?: number;
  borderColor?: string;
  hoverFillColor?: string;
  backgroundColor?: string;
  className?: string;
}

export default function Squares({
  direction = "diagonal",
  speed = 0.5,
  squareSize = 44,
  borderColor = "rgba(226, 232, 240, 0.6)",
  hoverFillColor = "rgba(240, 121, 40, 0.08)",
  backgroundColor = "transparent",
  className = "",
}: SquaresProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let numCols = 0;
    let numRows = 0;
    const gridOffset = { x: 0, y: 0 };
    let hoveredSquare: { col: number; row: number } | null = null;

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      numCols = Math.ceil(width / squareSize) + 2;
      numRows = Math.ceil(height / squareSize) + 2;
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const effectiveX = mouseX - (gridOffset.x % squareSize);
      const effectiveY = mouseY - (gridOffset.y % squareSize);

      const col = Math.floor(effectiveX / squareSize);
      const row = Math.floor(effectiveY / squareSize);

      hoveredSquare = { col, row };
    };

    const handleMouseLeave = () => {
      hoveredSquare = null;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (backgroundColor && backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }

      if (direction === "right") {
        gridOffset.x = (gridOffset.x - speed) % squareSize;
      } else if (direction === "left") {
        gridOffset.x = (gridOffset.x + speed) % squareSize;
      } else if (direction === "up") {
        gridOffset.y = (gridOffset.y + speed) % squareSize;
      } else if (direction === "down") {
        gridOffset.y = (gridOffset.y - speed) % squareSize;
      } else if (direction === "diagonal") {
        gridOffset.x = (gridOffset.x - speed) % squareSize;
        gridOffset.y = (gridOffset.y - speed) % squareSize;
      }

      const startX = gridOffset.x % squareSize;
      const startY = gridOffset.y % squareSize;

      for (let i = -1; i < numCols; i++) {
        for (let j = -1; j < numRows; j++) {
          const x = i * squareSize + startX;
          const y = j * squareSize + startY;

          if (
            hoveredSquare &&
            hoveredSquare.col === i &&
            hoveredSquare.row === j
          ) {
            ctx.fillStyle = hoverFillColor;
            ctx.fillRect(x, y, squareSize, squareSize);
          }

          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, squareSize, squareSize);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [direction, speed, squareSize, borderColor, hoverFillColor, backgroundColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block pointer-events-auto ${className}`}
    />
  );
}

