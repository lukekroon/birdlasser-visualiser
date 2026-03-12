"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { getSpeciesList, getTrips, getChartData, filterSightings } from "@/data";
import { Sighting } from "@/data/types";
import { getAllSightings, getSightingCount, clearAllData } from "@/lib/db";
import { MapTileStyle } from "@/components/MapView";
import FloatingPanel from "@/components/FloatingPanel";
import SidePanel from "@/components/SidePanel";
import PillFilters from "@/components/PillFilters";
import CumulativeChart from "@/components/CumulativeChart";
import CommandPalette from "@/components/CommandPalette";
import ImportView from "@/components/ImportView";
import BottomSheet from "@/components/BottomSheet";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number | undefined>();
  const [activeFilter, setActiveFilter] = useState("all");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [sideTab, setSideTab] = useState<"species" | "trips">("species");
  const [selectedTrip, setSelectedTrip] = useState<string | undefined>();
  const [tileStyle, setTileStyle] = useState<MapTileStyle>("satellite");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const count = await getSightingCount();
    if (count > 0) {
      const data = await getAllSightings();
      setSightings(data);
      setHasData(true);
    } else {
      setHasData(false);
    }
    setLoading(false);
  }, []);

  // Load sightings from IndexedDB on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  const species = useMemo(() => getSpeciesList(sightings), [sightings]);
  const trips = useMemo(() => getTrips(sightings), [sightings]);
  const chartData = useMemo(() => getChartData(sightings, activeFilter), [sightings, activeFilter]);

  // Map of speciesId → lifer number (e.g. species #142 on your life list)
  const liferMap = useMemo(() => {
    const map = new Map<number, number>();
    const sorted = [...sightings].sort((a, b) => {
      const da = a.isoDate || a.date;
      const db = b.isoDate || b.date;
      return da.localeCompare(db);
    });
    let count = 0;
    for (const s of sorted) {
      if (s.dontCountLifelist === "Y") continue;
      if (!map.has(s.speciesId)) {
        count++;
        map.set(s.speciesId, count);
      }
    }
    return map;
  }, [sightings]);

  const years = useMemo(() => {
    const yrs = new Set(sightings.map((s) => s.date.slice(0, 4)));
    return Array.from(yrs).sort().reverse();
  }, [sightings]);

  const filters = useMemo(
    () => [
      { label: "All", value: "all" },
      ...years.map((y) => ({ label: y, value: y })),
    ],
    [years]
  );

  const filteredSightings = useMemo(() => {
    const opts: Parameters<typeof filterSightings>[1] = {};
    if (activeFilter !== "all") opts.year = activeFilter;
    if (selectedTrip) opts.trip = selectedTrip;
    if (selectedSpeciesId !== undefined) opts.speciesId = selectedSpeciesId;
    return filterSightings(sightings, opts);
  }, [sightings, activeFilter, selectedTrip, selectedSpeciesId]);

  const handleSpeciesClick = useCallback((speciesId: number) => {
    setSelectedSpeciesId((prev) => (prev === speciesId ? undefined : speciesId));
    setSelectedTrip(undefined);
  }, []);

  const handleTripClick = useCallback((tripName: string) => {
    setSelectedTrip((prev) => (prev === tripName ? undefined : tripName));
    setSelectedSpeciesId(undefined);
  }, []);

  const handleSightingClick = useCallback((sighting: Sighting) => {
    setSelectedSpeciesId(sighting.speciesId);
    setSelectedTrip(undefined);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedSpeciesId(undefined);
    setSelectedTrip(undefined);
    setActiveFilter("all");
  }, []);

  const handleClearData = useCallback(async () => {
    await clearAllData();
    setSightings([]);
    setHasData(false);
  }, []);

  const filteredSpecies = useMemo(() => {
    if (activeFilter === "all" && !selectedTrip) return species;
    const filtered = filterSightings(sightings, {
      year: activeFilter !== "all" ? activeFilter : undefined,
      trip: selectedTrip,
    });
    const speciesMap = new Map<number, { count: number }>();
    for (const s of filtered) {
      const existing = speciesMap.get(s.speciesId);
      if (!existing) speciesMap.set(s.speciesId, { count: 1 });
      else existing.count++;
    }
    return species
      .filter((sp) => speciesMap.has(sp.speciesId))
      .map((sp) => ({ ...sp, sightingCount: speciesMap.get(sp.speciesId)!.count }));
  }, [species, sightings, activeFilter, selectedTrip]);

  // Loading state
  if (loading) {
    return (
      <main className="w-screen h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-[#888888]">Loading...</p>
      </main>
    );
  }

  // Empty state — show import
  if (!hasData) {
    return <ImportView onImportComplete={loadData} />;
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0a0a0a]">
      <MapView
        sightings={filteredSightings}
        showHeatmap={showHeatmap}
        selectedSpeciesId={selectedSpeciesId}
        onSightingClick={handleSightingClick}
        tileStyle={tileStyle}
        liferMap={liferMap}
      />

      {/* Top bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <FloatingPanel
          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:border-[#444444] transition-colors"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <svg className="w-4 h-4 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm text-[#888888]">Search species...</span>
          <kbd className="hidden md:inline text-xs text-[#888888] bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-0.5 ml-8">
            Ctrl K
          </kbd>
        </FloatingPanel>
      </div>

      {/* Side panel — desktop only */}
      <div className="hidden md:block">
        <SidePanel
          species={filteredSpecies}
          trips={trips}
          totalSightings={filteredSightings.length}
          selectedSpeciesId={selectedSpeciesId}
          onSpeciesClick={handleSpeciesClick}
          onTripClick={handleTripClick}
          activeTab={sideTab}
          onTabChange={setSideTab}
        />
      </div>

      {/* Bottom bar — desktop only */}
      <div className="hidden md:block absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <FloatingPanel className="flex items-center gap-3 px-4 py-2.5">
          <PillFilters
            filters={filters}
            activeFilter={activeFilter}
            onFilterChange={(v) => {
              setActiveFilter(v);
              setSelectedTrip(undefined);
              setSelectedSpeciesId(undefined);
            }}
          />

          <div className="w-px h-6 bg-[#2a2a2a]" />

          {(["satellite", "topo", "dark"] as MapTileStyle[]).map((style) => (
            <button
              key={style}
              onClick={() => setTileStyle(style)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${
                tileStyle === style
                  ? "bg-white/90 text-black"
                  : "bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a] hover:text-white"
              }`}
            >
              {style === "satellite" ? "Satellite" : style === "topo" ? "Topo" : "Dark"}
            </button>
          ))}

          <div className="w-px h-6 bg-[#2a2a2a]" />

          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              showHeatmap
                ? "bg-[#10b981] text-black"
                : "bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a] hover:text-white"
            }`}
          >
            Heatmap
          </button>

          <button
            onClick={() => setShowChart(!showChart)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              showChart
                ? "bg-[#10b981] text-black"
                : "bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a] hover:text-white"
            }`}
          >
            Chart
          </button>

          <div className="w-px h-6 bg-[#2a2a2a]" />

          {/* Import more / Clear data */}
          <button
            onClick={() => setHasData(false)}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a] hover:text-white transition-all"
            title="Import more trips"
          >
            <span className="flex items-center gap-1"><span className="text-base leading-none">+</span> Import</span>
          </button>
        </FloatingPanel>
      </div>

      {/* Active filter indicator */}
      {(selectedSpeciesId !== undefined || selectedTrip) && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <FloatingPanel className="flex items-center gap-2 px-3 py-2">
            <span className="text-sm text-white">
              {selectedSpeciesId !== undefined
                ? species.find((s) => s.speciesId === selectedSpeciesId)?.commonName
                : selectedTrip}
            </span>
            <button
              onClick={clearFilters}
              className="text-[#888888] hover:text-white text-sm ml-1"
            >
              &times;
            </button>
          </FloatingPanel>
        </div>
      )}

      {/* Bottom sheet — mobile only */}
      <BottomSheet
        species={filteredSpecies}
        trips={trips}
        totalSightings={filteredSightings.length}
        selectedSpeciesId={selectedSpeciesId}
        onSpeciesClick={handleSpeciesClick}
        onTripClick={handleTripClick}
        activeTab={sideTab}
        onTabChange={setSideTab}
        filters={filters}
        activeFilter={activeFilter}
        onFilterChange={(v) => {
          setActiveFilter(v);
          setSelectedTrip(undefined);
          setSelectedSpeciesId(undefined);
        }}
        tileStyle={tileStyle}
        onTileStyleChange={setTileStyle}
        showHeatmap={showHeatmap}
        onToggleHeatmap={() => setShowHeatmap((v) => !v)}
        showChart={showChart}
        onToggleChart={() => setShowChart((v) => !v)}
        onImportMore={() => setHasData(false)}
        collapseWhenTrue={showChart}
      />

      <CumulativeChart
        data={chartData}
        activeFilter={activeFilter}
        visible={showChart}
        onClose={() => setShowChart(false)}
      />

      <CommandPalette
        species={species}
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectSpecies={handleSpeciesClick}
        onToggleHeatmap={() => setShowHeatmap((v) => !v)}
        onToggleChart={() => setShowChart((v) => !v)}
        onClearFilters={clearFilters}
        onImportMore={() => setHasData(false)}
        onClearData={handleClearData}
      />
    </main>
  );
}
