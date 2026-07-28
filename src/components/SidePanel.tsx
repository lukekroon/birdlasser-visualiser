"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CompareBucket, Species, Trip, YearComparison } from "@/data/types";
import FloatingPanel from "./FloatingPanel";
import CompareList, { CompareScope } from "./CompareList";

export type SideTab = "species" | "trips" | "compare";

interface SidePanelProps {
  species: Species[];
  trips: Trip[];
  totalSightings: number;
  selectedSpeciesId?: number;
  onSpeciesClick: (speciesId: number) => void;
  onTripClick: (tripName: string) => void;
  activeTab: SideTab;
  onTabChange: (tab: SideTab) => void;
  /** Present only while two years are being compared. */
  comparison?: YearComparison;
  activeBucket?: CompareBucket;
  onBucketChange: (bucket: CompareBucket | undefined) => void;
  compareScope: CompareScope;
  onCompareScopeChange: (scope: CompareScope) => void;
}

function SpeciesList({
  species,
  selectedSpeciesId,
  onSpeciesClick,
}: {
  species: Species[];
  selectedSpeciesId?: number;
  onSpeciesClick: (speciesId: number) => void;
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
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const sp = species[virtualRow.index];
          return (
            <button
              key={sp.speciesId}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onClick={() => onSpeciesClick(sp.speciesId)}
              className={`text-left px-4 py-2.5 border-b border-[#1a1a1a] transition-colors hover:bg-[#1a1a1a] ${
                selectedSpeciesId === sp.speciesId ? "bg-[#1a1a1a]" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">
                    {sp.commonName}
                  </div>
                  <div className="text-xs text-[#888888] truncate italic">
                    {sp.scientificName}
                  </div>
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
  onTripClick: (tripName: string) => void;
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
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const trip = trips[virtualRow.index];
          return (
            <button
              key={trip.name}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onClick={() => onTripClick(trip.name)}
              className="text-left px-4 py-3 border-b border-[#1a1a1a] transition-colors hover:bg-[#1a1a1a]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">
                    {trip.name}
                  </div>
                  <div className="text-xs text-[#888888]">{trip.date}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-[#10b981]">{trip.speciesCount} sp</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SidePanel({
  species,
  trips,
  totalSightings,
  selectedSpeciesId,
  onSpeciesClick,
  onTripClick,
  activeTab,
  onTabChange,
  comparison,
  activeBucket,
  onBucketChange,
  compareScope,
  onCompareScopeChange,
}: SidePanelProps) {
  // The Compare tab only exists while a comparison is active; fall back to Species so the panel
  // never renders an empty body if the comparison is cleared while that tab is open.
  const tab: SideTab = activeTab === "compare" && !comparison ? "species" : activeTab;
  return (
    <FloatingPanel className="absolute top-20 left-4 z-20 w-80 max-h-[calc(100vh-120px)] flex flex-col">
      {/* Stats header */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-baseline gap-3">
          <div>
            <span className="text-2xl font-semibold text-[#10b981]">{species.length}</span>
            <span className="text-sm text-[#888888] ml-1.5">species</span>
          </div>
          <div>
            <span className="text-2xl font-semibold text-white">{totalSightings}</span>
            <span className="text-sm text-[#888888] ml-1.5">sightings</span>
          </div>
          <div>
            <span className="text-2xl font-semibold text-white">{trips.length}</span>
            <span className="text-sm text-[#888888] ml-1.5">trips</span>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-[#2a2a2a]">
        <button
          onClick={() => onTabChange("species")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === "species"
              ? "text-[#10b981] border-b-2 border-[#10b981]"
              : "text-[#888888] hover:text-white"
          }`}
        >
          Species
        </button>
        <button
          onClick={() => onTabChange("trips")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === "trips"
              ? "text-[#10b981] border-b-2 border-[#10b981]"
              : "text-[#888888] hover:text-white"
          }`}
        >
          Trips
        </button>
        {comparison && (
          <button
            onClick={() => onTabChange("compare")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === "compare"
                ? "text-[#10b981] border-b-2 border-[#10b981]"
                : "text-[#888888] hover:text-white"
            }`}
          >
            Compare
          </button>
        )}
      </div>

      {/* Virtualized list */}
      {tab === "compare" && comparison ? (
        <CompareList
          comparison={comparison}
          selectedSpeciesId={selectedSpeciesId}
          onSpeciesClick={onSpeciesClick}
          activeBucket={activeBucket}
          onBucketChange={onBucketChange}
          scope={compareScope}
          onScopeChange={onCompareScopeChange}
        />
      ) : tab === "species" ? (
        <SpeciesList
          species={species}
          selectedSpeciesId={selectedSpeciesId}
          onSpeciesClick={onSpeciesClick}
        />
      ) : (
        <TripList trips={trips} onTripClick={onTripClick} />
      )}
    </FloatingPanel>
  );
}
