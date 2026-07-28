"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CompareBucket, CompareSpecies, YearComparison } from "@/data/types";

export type CompareScope = "bucketYear" | "allTime";

interface CompareListProps {
  comparison: YearComparison;
  selectedSpeciesId?: number;
  onSpeciesClick: (speciesId: number) => void;
  /** Bucket currently projected onto the map, if any. */
  activeBucket?: CompareBucket;
  onBucketChange: (bucket: CompareBucket | undefined) => void;
  scope: CompareScope;
  onScopeChange: (scope: CompareScope) => void;
}

/** Row in the flattened, virtualised list. Headers and species share one scroll container so
 *  a 300-row bucket stays cheap. */
type Row =
  | { kind: "header"; bucket: CompareBucket; title: string; hint: string; count: number }
  | { kind: "species"; species: CompareSpecies };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** yyyy/MM/dd → "14 Mar". The year is implied by the bucket, so showing it again is noise. */
function shortDate(date: string): string {
  const [, month, day] = date.split("/");
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthName}`;
}

export default function CompareList({
  comparison,
  selectedSpeciesId,
  onSpeciesClick,
  activeBucket,
  onBucketChange,
  scope,
  onScopeChange,
}: CompareListProps) {
  const { yearA, yearB, onlyA, onlyB, both, pace } = comparison;

  // "Only B" is the actionable bucket when A is the year in progress — those are the birds still
  // to find — so it starts open along with "only A".
  const [expanded, setExpanded] = useState<Record<CompareBucket, boolean>>({
    onlyA: true,
    onlyB: true,
    both: false,
  });

  const rows = useMemo<Row[]>(() => {
    const buckets: { bucket: CompareBucket; title: string; hint: string; items: CompareSpecies[] }[] = [
      { bucket: "onlyA", title: `Only ${yearA}`, hint: `not seen in ${yearB}`, items: onlyA },
      { bucket: "onlyB", title: `Only ${yearB}`, hint: `not seen in ${yearA}`, items: onlyB },
      { bucket: "both", title: "In both", hint: `${yearA} and ${yearB}`, items: both },
    ];
    const out: Row[] = [];
    for (const b of buckets) {
      out.push({ kind: "header", bucket: b.bucket, title: b.title, hint: b.hint, count: b.items.length });
      if (expanded[b.bucket]) for (const species of b.items) out.push({ kind: "species", species });
    }
    return out;
  }, [yearA, yearB, onlyA, onlyB, both, expanded]);

  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (rows[index].kind === "header" ? 62 : 52),
    overscan: 12,
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Pace readout — the honest comparison when one year is still running. */}
      <div className="px-4 py-2.5 border-b border-[#2a2a2a] text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#888888]">
            {pace.isPartial ? "Same point last year" : "Full year"}
          </span>
          <span className="tabular-nums">
            <span style={{ color: "#10b981" }}>{pace.countA}</span>
            <span className="text-[#555555]"> vs </span>
            <span style={{ color: "#60a5fa" }}>{pace.countB}</span>
            {pace.countA !== pace.countB && (
              <span className={pace.countA > pace.countB ? "text-[#10b981] ml-1.5" : "text-[#f87171] ml-1.5"}>
                {pace.countA > pace.countB ? "+" : ""}
                {pace.countA - pace.countB}
              </span>
            )}
          </span>
        </div>
        {pace.isPartial && (
          <div className="text-[#555555] mt-0.5">
            species by day {pace.dayOfYear} of each year
          </div>
        )}
      </div>

      {/* Map scope — only meaningful once a bucket is on the map. */}
      {activeBucket && (
        <div className="px-4 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
          <span className="text-xs text-[#888888] shrink-0">Map shows</span>
          <div className="flex gap-1 ml-auto">
            {(
              [
                { value: "bucketYear" as CompareScope, label: "That year" },
                { value: "allTime" as CompareScope, label: "All time" },
              ]
            ).map((option) => (
              <button
                key={option.value}
                onClick={() => onScopeChange(option.value)}
                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  scope === option.value
                    ? "bg-[#2a2a2a] text-white"
                    : "text-[#888888] hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={parentRef} className="overflow-y-auto flex-1">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const style = {
              position: "absolute" as const,
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            };

            if (row.kind === "header") {
              const isOpen = expanded[row.bucket];
              const isOnMap = activeBucket === row.bucket;
              return (
                <div
                  key={`h-${row.bucket}`}
                  style={style}
                  className="px-4 py-2 bg-[#141414] border-y border-[#2a2a2a] flex items-center gap-2"
                >
                  <button
                    onClick={() => setExpanded((prev) => ({ ...prev, [row.bucket]: !prev[row.bucket] }))}
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left group"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className={`shrink-0 text-[#555555] group-hover:text-white transition-transform ${isOpen ? "rotate-90" : ""}`}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <span className="min-w-0">
                      <span className="text-sm font-medium text-white">{row.title}</span>
                      <span className="text-xs text-[#555555] ml-1.5">{row.hint}</span>
                    </span>
                  </button>
                  <span className="text-sm text-[#888888] tabular-nums shrink-0">{row.count}</span>
                  {row.count > 0 && (
                    <button
                      onClick={() => onBucketChange(isOnMap ? undefined : row.bucket)}
                      title={isOnMap ? "Clear from map" : `Show all ${row.count} on the map`}
                      className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        isOnMap
                          ? "bg-[#10b981] text-black"
                          : "bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a] hover:text-white"
                      }`}
                    >
                      {isOnMap ? "On map" : "Map"}
                    </button>
                  )}
                </div>
              );
            }

            const sp = row.species;
            return (
              <button
                key={`s-${sp.speciesId}-${sp.lastSeenInYear}`}
                style={style}
                onClick={() => onSpeciesClick(sp.speciesId)}
                className={`text-left px-4 py-2 border-b border-[#1a1a1a] transition-colors hover:bg-[#1a1a1a] ${
                  selectedSpeciesId === sp.speciesId ? "bg-[#1a1a1a]" : ""
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate">{sp.commonName}</div>
                    <div className="text-xs text-[#888888] truncate">
                      {sp.lastTrip}
                      <span className="text-[#555555]"> &middot; {shortDate(sp.lastSeenInYear)}</span>
                    </div>
                  </div>
                  {/* The list is sorted on this, so it is always shown — a hidden sort key makes
                      the ordering look arbitrary. Higher count = commoner bird = easier to get. */}
                  <div className="shrink-0 text-xs tabular-nums text-[#888888]">{sp.countInYear}x</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
