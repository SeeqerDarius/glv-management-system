"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  o: number;
};

export function SidebarAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;

    if (!canvasElement) {
      return;
    }

    const parentElement = canvasElement.parentElement;
    const context = canvasElement.getContext("2d");

    if (!parentElement || !context) {
      return;
    }

    const canvas = canvasElement;
    const parent = parentElement;
    const ctx = context;
    let animationId = 0;
    let width = 1;
    let height = 1;
    let particles: Particle[] = [];
    const pointer = { x: -999, y: -999 };

    function resize() {
      const rect = parent.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function seedParticles() {
      const density = width < 280 ? 19000 : 15000;
      const count = Math.min(64, Math.max(14, Math.floor((width * height) / density)));

      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.2 + 0.5,
        o: Math.random() * 0.28 + 0.12,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0) particle.x = width;
        if (particle.x > width) particle.x = 0;
        if (particle.y < 0) particle.y = height;
        if (particle.y > height) particle.y = 0;

        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0 && distance < 70) {
          particle.x += (dx / distance) * 0.75;
          particle.y += (dy / distance) * 0.75;
        }

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(184,237,78,${particle.o})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 86) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(184,237,78,${0.08 * (1 - distance / 86)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    }

    function handlePointerLeave() {
      pointer.x = -999;
      pointer.y = -999;
    }

    function handleResize() {
      resize();
      seedParticles();
    }

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(handleResize);

    resize();
    seedParticles();
    draw();

    resizeObserver?.observe(parent);
    parent.addEventListener("pointermove", handlePointerMove);
    parent.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      parent.removeEventListener("pointermove", handlePointerMove);
      parent.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <div aria-hidden className="glv-sidebar-animation">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="glv-sidebar-grid" />
      <div className="glv-sidebar-scan" />
      <div className="glv-sidebar-glow glv-sidebar-glow-top" />
      <div className="glv-sidebar-glow glv-sidebar-glow-bottom" />
    </div>
  );
}
