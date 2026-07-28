"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PillFiltersProps {
  filters: { label: string; value: string }[];
  activeFilter: string;
  onFilterChange: (value: string) => void;
  /** Show chevron scroll buttons. Leave off for touch layouts, where swiping is natural. */
  chevrons?: boolean;
  className?: string;
}

export default function PillFilters({
  filters,
  activeFilter,
  onFilterChange,
  chevrons = true,
  className = "",
}: PillFiltersProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // 1px tolerance — sub-pixel widths otherwise leave the right arrow permanently enabled.
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // Recheck on mount, on container resize, and whenever the filter set changes.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateArrows, filters.length]);

  // Keep the selected pill visible: with 20 years it is often scrolled out of sight.
  useEffect(() => {
    const active = scrollerRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeFilter]);

  const scroll = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Page by most of a screenful, with a floor so narrow containers still advance.
    el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.8), behavior: "smooth" });
  };

  // Both arrows render together once anything overflows, so their width does not pop in and
  // out as you scroll. The exhausted direction is disabled rather than removed.
  const overflowing = canLeft || canRight;
  const showArrows = chevrons && overflowing;

  return (
    <div className={`relative flex items-center min-w-0 ${className}`}>
      {showArrows && (
        <ArrowButton direction="left" disabled={!canLeft} onClick={() => scroll(-1)} />
      )}

      <div
        ref={scrollerRef}
        onScroll={updateArrows}
        className="flex gap-2 overflow-x-auto no-scrollbar min-w-0"
      >
        {filters.map((f) => (
          <button
            key={f.value}
            data-active={activeFilter === f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeFilter === f.value
                ? "bg-[#10b981] text-black"
                : "bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a] hover:text-white hover:border-[#444444]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showArrows && (
        <ArrowButton direction="right" disabled={!canRight} onClick={() => scroll(1)} />
      )}
    </div>
  );
}

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Scroll filters left" : "Scroll filters right"}
      className={`flex-shrink-0 grid place-items-center w-7 h-7 rounded-full border transition-all ${
        direction === "left" ? "mr-1" : "ml-1"
      } ${
        disabled
          ? "border-transparent text-[#3a3a3a] cursor-default"
          : "bg-[#1a1a1a] border-[#2a2a2a] text-[#888888] hover:text-white hover:border-[#444444]"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {direction === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );
}
