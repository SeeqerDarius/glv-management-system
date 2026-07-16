"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

type Position = {
  x: number;
  y: number;
};

type DragHandleProps = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
};

type DraggableFloatingProps = {
  children: (props: {
    dragHandleProps: DragHandleProps;
    isDragging: boolean;
  }) => ReactNode;
  defaultPlacement: "bottom-left" | "bottom-right";
  storageKey: string;
  className?: string;
};

const viewportPadding = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function defaultPosition(placement: DraggableFloatingProps["defaultPlacement"]) {
  const buttonSize = 56;
  const x =
    placement === "bottom-left"
      ? 16
      : window.innerWidth - buttonSize - 16;
  const y = window.innerHeight - buttonSize - 16;

  return {
    x: clamp(x, viewportPadding, Math.max(viewportPadding, window.innerWidth - buttonSize - viewportPadding)),
    y: clamp(y, viewportPadding, Math.max(viewportPadding, window.innerHeight - buttonSize - viewportPadding)),
  };
}

export function DraggableFloating({
  children,
  defaultPlacement,
  storageKey,
  className,
}: DraggableFloatingProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function clampPosition(next: Position) {
    const width = containerRef.current?.offsetWidth ?? 56;
    const height = containerRef.current?.offsetHeight ?? 56;
    const maxX = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
    const maxY = Math.max(viewportPadding, window.innerHeight - height - viewportPadding);

    return {
      x: clamp(next.x, viewportPadding, maxX),
      y: clamp(next.y, viewportPadding, maxY),
    };
  }

  useEffect(() => {
    let nextPosition: Position | null = null;

    try {
      const stored = window.localStorage.getItem(storageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      if (
        parsed &&
        typeof parsed.x === "number" &&
        typeof parsed.y === "number"
      ) {
        nextPosition = parsed;
      }
    } catch {
      nextPosition = null;
    }

    const frame = window.requestAnimationFrame(() => {
      setPosition(clampPosition(nextPosition ?? defaultPosition(defaultPlacement)));
    });

    function handleResize() {
      setPosition((current) =>
        current ? clampPosition(current) : defaultPosition(defaultPlacement)
      );
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, [defaultPlacement, storageKey]);

  useEffect(() => {
    if (!position) return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(position));
    } catch {
      // Position memory is helpful, not required.
    }
  }, [position, storageKey]);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (!position || event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };
    setIsDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      drag.moved = true;
    }

    setPosition(
      clampPosition({
        x: drag.originX + deltaX,
        y: drag.originY + deltaY,
      })
    );
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    dragRef.current = null;
    setIsDragging(false);
  }

  const style: CSSProperties = position
    ? {
        left: position.x,
        top: position.y,
      }
    : {
        visibility: "hidden",
      };

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {/* eslint-disable-next-line react-hooks/refs */}
      {children({ dragHandleProps: { onPointerDown }, isDragging })}
    </div>
  );
}
