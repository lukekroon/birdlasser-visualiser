"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Species, Trip } from "@/data/types";
import { MapTileStyle } from "@/components/MapView";
import PillFilters from "./PillFilters";

type SnapState = "collapsed" | "half" | "full";

const COLLAPSED_H = 72;

function getSnapPx(snap: SnapState): number {
  if (snap === "collapsed") return COLLAPSED_H;
  if (typeof window === "undefined") return COLLAPSED_H;
  if (snap === "half") return Math.round(window.innerHeight * 0.45);
  return Math.round(window.innerHeight * 0.88);
}

interface BottomSheetProps {
  species: Species[];
  trips: Trip[];
  totalSightings: number;
  selectedSpeciesId?: number;
  onSpeciesClick: (id: number) => void;
  onTripClick: (name: string) => void;
  activeTab: "species" | "trips";
  onTabChange: (tab: "species" | "trips") => void;
  filters: { label: string; value: string }[];
  activeFilter: string;
  onFilterChange: (v: string) => void;
  tileStyle: MapTileStyle;
  onTileStyleChange: (s: MapTileStyle) => void;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  showChart: boolean;
  onToggleChart: () => void;
  onImportMore: () => void;
  collapseWhenTrue?: boolean;
}

function SpeciesList({
  species,
  selectedSpeciesId,
  onSpeciesClick,
}: {
  species: Species[];
  selectedSpeciesId?: number;
  onSpeciesClick: (id: number) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: species.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="overflow-y-auto flex-1">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((row) => {
          const sp = species[row.index];
          return (
            <button
              key={sp.speciesId}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${row.size}px`,
                transform: `translateY(${row.start}px)`,
              }}
              onClick={() => onSpeciesClick(sp.speciesId)}
              className={`text-left px-4 py-2.5 border-b border-[#1a1a1a] transition-colors hover:bg-[#1a1a1a] ${
                selectedSpeciesId === sp.speciesId ? "bg-[#1a1a1a]" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{sp.commonName}</div>
                  <div className="text-xs text-[#888888] truncate italic">{sp.scientificName}</div>
                </div>
                <div className="ml-2 shrink-0 text-right">
                  <div className="text-xs text-[#888888]">{sp.lastSeen}</div>
                  <div className="text-xs text-[#555555]">{sp.lastSeenTime?.slice(0, 5)} &middot; {sp.sightingCount}x</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TripList({
  trips,
  onTripClick,
}: {
  trips: Trip[];
  onTripClick: (name: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: trips.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="overflow-y-auto flex-1">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((row) => {
          const trip = trips[row.index];
          return (
            <button
              key={trip.name}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${row.size}px`,
                transform: `translateY(${row.start}px)`,
              }}
              onClick={() => onTripClick(trip.name)}
              className="text-left px-4 py-3 border-b border-[#1a1a1a] transition-colors hover:bg-[#1a1a1a]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{trip.name}</div>
                  <div className="text-xs text-[#888888]">{trip.date}</div>
                </div>
                <div className="text-sm text-[#10b981]">{trip.speciesCount} sp</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BottomSheet({
  species,
  trips,
  totalSightings,
  selectedSpeciesId,
  onSpeciesClick,
  onTripClick,
  activeTab,
  onTabChange,
  filters,
  activeFilter,
  onFilterChange,
  tileStyle,
  onTileStyleChange,
  showHeatmap,
  onToggleHeatmap,
  showChart,
  onToggleChart,
  onImportMore,
  collapseWhenTrue,
}: BottomSheetProps) {
  const [snap, setSnap] = useState<SnapState>("collapsed");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (collapseWhenTrue) setSnap("collapsed");
  }, [collapseWhenTrue]);
  const [isDragging, setIsDragging] = useState(false);
  const [liveH, setLiveH] = useState(COLLAPSED_H);

  const dragStartY = useRef(0);
  const dragStartH = useRef(COLLAPSED_H);
  const velocityRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTRef = useRef(0);

  const displayH = isDragging ? liveH : getSnapPx(snap);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const h = getSnapPx(snap);
      dragStartY.current = e.clientY;
      dragStartH.current = h;
      lastYRef.current = e.clientY;
      lastTRef.current = e.timeStamp;
      velocityRef.current = 0;
      setLiveH(h);
      setIsDragging(true);
    },
    [snap]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const dy = dragStartY.current - e.clientY;
      const newH = Math.max(COLLAPSED_H, Math.min(window.innerHeight * 0.94, dragStartH.current + dy));
      const dt = e.timeStamp - lastTRef.current;
      if (dt > 0) {
        velocityRef.current = (lastYRef.current - e.clientY) / dt;
      }
      lastYRef.current = e.clientY;
      lastTRef.current = e.timeStamp;
      setLiveH(newH);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      setIsDragging(false);

      const totalDrag = Math.abs(dragStartY.current - e.clientY);

      // Tap (no significant drag) — cycle snap states
      if (totalDrag < 8) {
        setSnap((prev) => (prev === "collapsed" ? "half" : prev === "half" ? "full" : "collapsed"));
        return;
      }

      const h = liveH;
      const wh = window.innerHeight;
      const halfH = wh * 0.45;
      const fullH = wh * 0.88;
      const v = velocityRef.current;

      let next: SnapState;
      if (v > 0.5) {
        next = snap === "collapsed" ? "half" : "full";
      } else if (v < -0.5) {
        next = snap === "full" ? "half" : "collapsed";
      } else {
        const dC = Math.abs(h - COLLAPSED_H);
        const dH = Math.abs(h - halfH);
        const dF = Math.abs(h - fullH);
        const m = Math.min(dC, dH, dF);
        next = m === dC ? "collapsed" : m === dH ? "half" : "full";
      }
      setSnap(next);
    },
    [isDragging, liveH, snap]
  );

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 md:hidden"
      style={{
        height: displayH,
        transition: isDragging ? "none" : "height 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      <div className="bg-[#111111] border-t border-l border-r border-[#2a2a2a] rounded-t-2xl h-full flex flex-col overflow-hidden">

        {/* Drag handle */}
        <div
          className="flex-shrink-0 px-4 pt-3 pb-2 touch-none select-none cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="flex justify-center mb-2.5">
            <div className="w-10 h-1 rounded-full bg-[#3a3a3a]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[#10b981] font-semibold text-xl">{species.length}</span>
            <span className="text-[#888888] text-sm">sp</span>
            <span className="text-white font-semibold text-xl">{totalSightings}</span>
            <span className="text-[#888888] text-sm">sightings</span>
            <span className="text-white font-semibold text-xl">{trips.length}</span>
            <span className="text-[#888888] text-sm">trips</span>
          </div>
        </div>

        {/* Content — overflow-hidden on parent clips this when collapsed */}
        <div className="flex flex-col flex-1 min-h-0 border-t border-[#2a2a2a]">

          {/* Controls row */}
          <div className="flex-shrink-0 px-3 py-2.5 border-b border-[#2a2a2a] flex items-center gap-2 overflow-x-auto no-scrollbar">
            {(["satellite", "topo", "dark"] as MapTileStyle[]).map((style) => (
              <button
                key={style}
                onClick={() => onTileStyleChange(style)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all capitalize whitespace-nowrap ${
                  tileStyle === style
                    ? "bg-white/90 text-black"
                    : "bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a]"
                }`}
              >
                {style === "satellite" ? "Satellite" : style === "topo" ? "Topo" : "Dark"}
              </button>
            ))}
            <div className="w-px h-5 bg-[#2a2a2a] flex-shrink-0" />
            <button
              onClick={onToggleHeatmap}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                showHeatmap ? "bg-[#10b981] text-black" : "bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a]"
              }`}
            >
              Heatmap
            </button>
            <button
              onClick={onToggleChart}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                showChart ? "bg-[#10b981] text-black" : "bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a]"
              }`}
            >
              Chart
            </button>
            <div className="w-px h-5 bg-[#2a2a2a] flex-shrink-0" />
            <button
              onClick={onImportMore}
              className="px-3 py-1.5 rounded-full text-sm font-medium bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a] whitespace-nowrap"
            >
              + Import
            </button>
          </div>

          {/* Year filters */}
          <div className="flex-shrink-0 px-3 py-2.5 border-b border-[#2a2a2a]">
            <PillFilters filters={filters} activeFilter={activeFilter} onFilterChange={onFilterChange} />
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-[#2a2a2a] flex-shrink-0">
            <button
              onClick={() => onTabChange("species")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "species"
                  ? "text-[#10b981] border-b-2 border-[#10b981]"
                  : "text-[#888888]"
              }`}
            >
              Species
            </button>
            <button
              onClick={() => onTabChange("trips")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "trips"
                  ? "text-[#10b981] border-b-2 border-[#10b981]"
                  : "text-[#888888]"
              }`}
            >
              Trips
            </button>
          </div>

          {/* Virtualized list */}
          {activeTab === "species" ? (
            <SpeciesList
              species={species}
              selectedSpeciesId={selectedSpeciesId}
              onSpeciesClick={onSpeciesClick}
            />
          ) : (
            <TripList trips={trips} onTripClick={onTripClick} />
          )}
        </div>
      </div>
    </div>
  );
}
