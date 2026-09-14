"use client";

import { useEffect, useId, useState } from "react";
import { niceMax } from "@/components/reports/chart-primitives";

function fractionOf(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

/**
 * Semicircular analog meter (dataviz skill: "a single ratio against a limit
 * -> Meter, same-ramp track"). The colored arc sweeps from the previous
 * period's position to the current period's position on mount, so growth
 * reads as the arc advancing and decline reads as it pulling back - an
 * honest animation driven by two real, already-computed values rather than
 * a generic decoration. A static tick on the track marks the previous
 * position so both ends of the movement stay visible after it settles.
 */
export function AnimatedMeter({
  value,
  previousValue,
  max,
  accent = "var(--chart-blue)",
  size = 132,
}: {
  value: number;
  previousValue?: number;
  max?: number;
  accent?: string;
  size?: number;
}) {
  const gradientId = useId();
  const resolvedMax = max ?? niceMax(Math.max(value, previousValue ?? 0, 1) * 1.2);
  const currentFraction = fractionOf(value, resolvedMax);
  const startFraction =
    previousValue !== undefined ? fractionOf(previousValue, resolvedMax) : 0;

  const [drawnFraction, setDrawnFraction] = useState(startFraction);
  const [transitionMs] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 900
  );

  useEffect(() => {
    let frame1 = 0;
    let frame2 = 0;
    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => setDrawnFraction(currentFraction));
    });
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [currentFraction]);

  const width = size;
  const height = size * 0.62;
  const strokeWidth = size * 0.09;
  const r = width / 2 - strokeWidth;
  const cx = width / 2;
  const cy = height - strokeWidth * 0.4;
  const pathLength = Math.PI * r;
  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const tickAngleDeg = 180 - startFraction * 180;
  const tickAngleRad = (tickAngleDeg * Math.PI) / 180;
  const tickInner = r - strokeWidth * 0.75;
  const tickOuter = r + strokeWidth * 0.75;
  const tickX1 = cx + tickInner * Math.cos(tickAngleRad);
  const tickY1 = cy - tickInner * Math.sin(tickAngleRad);
  const tickX2 = cx + tickOuter * Math.cos(tickAngleRad);
  const tickY2 = cy - tickOuter * Math.sin(tickAngleRad);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`${value.toLocaleString()} of an expected ${Math.round(resolvedMax).toLocaleString()}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={accent} stopOpacity={0.55} />
          <stop offset="100%" stopColor={accent} stopOpacity={1} />
        </linearGradient>
      </defs>
      <path
        d={trackPath}
        fill="none"
        stroke="var(--chart-grid)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {previousValue !== undefined && Math.abs(startFraction - currentFraction) > 0.01 ? (
        <line
          x1={tickX1}
          y1={tickY1}
          x2={tickX2}
          y2={tickY2}
          stroke="var(--chart-ink-secondary)"
          strokeWidth={Math.max(1.5, strokeWidth * 0.18)}
          strokeLinecap="round"
          opacity={0.6}
        />
      ) : null}
      <path
        d={trackPath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={pathLength}
        strokeDashoffset={pathLength * (1 - drawnFraction)}
        style={{ transition: `stroke-dashoffset ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)` }}
      />
    </svg>
  );
}
