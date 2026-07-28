"use client";

import { useEffect, useRef, useState } from "react";

interface YearCompareChipProps {
  /** Year A — the primary year. "all" means no year is selected, so comparing is impossible. */
  activeYear: string;
  /** Year B. Undefined means we are not in compare mode. */
  compareYear?: string;
  /** Years with enough species to be worth comparing, newest first. */
  comparableYears: string[];
  onSetActiveYear: (year: string) => void;
  onSetCompareYear: (year: string | undefined) => void;
}

/**
 * Entry point for year-vs-year comparison.
 *
 * Three states:
 *   idle     — a small "vs" button, shown only when a concrete year is active
 *   picking  — a popover listing candidate years for the slot being filled
 *   active   — "2026 vs 2025 ✕", where either year reopens the picker for that slot
 *
 * Deliberately a button rather than shift-clicking a year pill: a modifier-key gesture on a pill
 * is undiscoverable, and this feature is the whole point of the year pills existing.
 */
export default function YearCompareChip({
  activeYear,
  compareYear,
  comparableYears,
  onSetActiveYear,
  onSetCompareYear,
}: YearCompareChipProps) {
  // Which slot the popover is currently filling, or null when closed.
  const [picking, setPicking] = useState<"a" | "b" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the popover on outside click or Escape.
  useEffect(() => {
    if (!picking) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setPicking(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPicking(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [picking]);

  // Comparing needs two concrete years, so there is nothing to offer on the "All" filter.
  const canCompare = activeYear !== "all" && comparableYears.length >= 2;
  if (!canCompare && !compareYear) return null;

  // Never offer the year already occupying the other slot — A === B is meaningless.
  const otherYear = picking === "a" ? compareYear : activeYear;
  const candidates = comparableYears.filter((y) => y !== otherYear);

  const choose = (year: string) => {
    if (picking === "a") onSetActiveYear(year);
    else onSetCompareYear(year);
    setPicking(null);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      {compareYear === undefined ? (
        <button
          onClick={() => setPicking("b")}
          title={`Compare ${activeYear} with another year`}
          className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a] hover:text-white hover:border-[#444444] transition-all"
        >
          vs
        </button>
      ) : (
        <div className="flex items-center gap-1 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] pl-1 pr-1 py-0.5">
          <YearSlot year={activeYear} colour="#10b981" onClick={() => setPicking("a")} />
          <span className="text-xs text-[#555555]">vs</span>
          <YearSlot year={compareYear} colour="#60a5fa" onClick={() => setPicking("b")} />
          <button
            onClick={() => onSetCompareYear(undefined)}
            aria-label="Exit comparison"
            className="ml-0.5 w-5 h-5 grid place-items-center rounded-full text-[#888888] hover:text-white hover:bg-[#2a2a2a] transition-colors"
          >
            <span className="text-sm leading-none">&times;</span>
          </button>
        </div>
      )}

      {picking && (
        <div className="absolute bottom-full mb-2 left-0 z-30 bg-[#111111] border border-[#2a2a2a] rounded-xl p-2 shadow-xl min-w-[9rem]">
          <div className="px-2 pb-1.5 text-xs text-[#555555] whitespace-nowrap">
            {picking === "a" ? "Compare this year" : `Compare ${activeYear} with`}
          </div>
          <div className="flex flex-col max-h-56 overflow-y-auto">
            {candidates.map((year) => {
              const selected = picking === "a" ? year === activeYear : year === compareYear;
              return (
                <button
                  key={year}
                  onClick={() => choose(year)}
                  className={`text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    selected ? "text-white bg-[#1a1a1a]" : "text-[#888888] hover:text-white hover:bg-[#1a1a1a]"
                  }`}
                >
                  {year}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function YearSlot({ year, colour, onClick }: { year: string; colour: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 rounded-full text-sm font-medium whitespace-nowrap hover:bg-[#2a2a2a] transition-colors"
      style={{ color: colour }}
    >
      {year}
    </button>
  );
}
