"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  getSpeciesList,
  getTrips,
  getChartData,
  filterSightings,
  compareYears,
  getComparableYears,
  getComparisonChartData,
} from "@/data";
import { CompareBucket, Sighting } from "@/data/types";
import { getAllSightings, getSightingCount, clearAllData } from "@/lib/db";
import { MapTileStyle } from "@/components/MapView";
import FloatingPanel from "@/components/FloatingPanel";
import SidePanel, { SideTab } from "@/components/SidePanel";
import { CompareScope } from "@/components/CompareList";
import YearCompareChip from "@/components/YearCompareChip";
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
  const [sideTab, setSideTab] = useState<SideTab>("species");
  const [selectedTrip, setSelectedTrip] = useState<string | undefined>();
  const [tileStyle, setTileStyle] = useState<MapTileStyle>("satellite");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Year-vs-year comparison. `compareYear` being set is the single source of truth for
  // "am I in compare mode"; activeFilter continues to hold year A, so the existing filter
  // path is untouched.
  const [compareYear, setCompareYear] = useState<string | undefined>();
  const [compareBucket, setCompareBucket] = useState<CompareBucket | undefined>();
  const [compareScope, setCompareScope] = useState<CompareScope>("bucketYear");

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  // Full species list, kept unfiltered so the command palette can search everything.
  // The panel's own list is `filteredSpecies`, derived from the current scope below.
  const species = useMemo(() => getSpeciesList(sightings), [sightings]);
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

  const comparableYears = useMemo(() => getComparableYears(sightings), [sightings]);

  const comparison = useMemo(() => {
    if (!compareYear || activeFilter === "all" || compareYear === activeFilter) return undefined;
    return compareYears(sightings, activeFilter, compareYear);
  }, [sightings, activeFilter, compareYear]);

  const comparisonChart = useMemo(() => {
    if (!compareYear || activeFilter === "all" || compareYear === activeFilter) return undefined;
    return getComparisonChartData(sightings, activeFilter, compareYear);
  }, [sightings, activeFilter, compareYear]);

  /** The species in the bucket currently projected onto the map, plus which years own it. */
  const bucketFilter = useMemo(() => {
    if (!comparison || !compareBucket) return undefined;
    const speciesIds = new Set(comparison[compareBucket].map((sp) => sp.speciesId));
    if (speciesIds.size === 0) return undefined;
    // Scope to the year the bucket belongs to: "where did I see this bird last year" is the
    // trip-planning question, and all-time sightings would blur it with other years.
    const years =
      compareBucket === "onlyA"
        ? [comparison.yearA]
        : compareBucket === "onlyB"
          ? [comparison.yearB]
          : [comparison.yearA, comparison.yearB];
    return { speciesIds, years };
  }, [comparison, compareBucket]);

  const filteredSightings = useMemo(() => {
    const opts: Parameters<typeof filterSightings>[1] = {};
    if (bucketFilter) {
      // A bucket takes over the map: its own species set, and its own years unless widened.
      opts.speciesIds = bucketFilter.speciesIds;
      if (compareScope === "bucketYear") opts.years = bucketFilter.years;
      // Clicking a single species inside the bucket narrows further.
      if (selectedSpeciesId !== undefined) opts.speciesId = selectedSpeciesId;
      return filterSightings(sightings, opts);
    }
    if (activeFilter !== "all") opts.year = activeFilter;
    if (selectedTrip) opts.trip = selectedTrip;
    if (selectedSpeciesId !== undefined) opts.speciesId = selectedSpeciesId;
    return filterSightings(sightings, opts);
  }, [sightings, activeFilter, selectedTrip, selectedSpeciesId, bucketFilter, compareScope]);

  /** Leaving compare mode must not leave a bucket filtering the map invisibly. */
  const handleSetCompareYear = useCallback((year: string | undefined) => {
    setCompareYear(year);
    if (year === undefined) {
      setCompareBucket(undefined);
      setSideTab((tab) => (tab === "compare" ? "species" : tab));
    } else {
      setSideTab("compare");
    }
  }, []);

  const handleBucketChange = useCallback((bucket: CompareBucket | undefined) => {
    setCompareBucket(bucket);
    // A bucket is a set of species; a single-species selection would silently mask it.
    setSelectedSpeciesId(undefined);
    setSelectedTrip(undefined);
  }, []);

  /** "Compare 2026 vs 2025" in the palette: the active year against the next one down.
   *  Falls back to the two newest comparable years when the All filter is active. */
  const compareSuggestion = useMemo(() => {
    if (comparison || comparableYears.length < 2) return undefined;
    const a = activeFilter !== "all" && comparableYears.includes(activeFilter) ? activeFilter : comparableYears[0];
    const b = comparableYears.find((y) => y < a) ?? comparableYears.find((y) => y !== a);
    if (!b) return undefined;
    return {
      a,
      b,
      action: () => {
        setActiveFilter(a);
        setSelectedTrip(undefined);
        setSelectedSpeciesId(undefined);
        setCompareYear(b);
        setSideTab("compare");
      },
    };
  }, [comparison, comparableYears, activeFilter]);

  const handleFilterChange = useCallback((value: string) => {
    setActiveFilter(value);
    setSelectedTrip(undefined);
    setSelectedSpeciesId(undefined);
    // "All" has no year to compare, and A === B is meaningless — drop out of compare mode
    // rather than rendering an empty comparison.
    setCompareYear((current) => {
      if (current === undefined) return undefined;
      if (value === "all" || value === current) {
        setCompareBucket(undefined);
        setSideTab((tab) => (tab === "compare" ? "species" : tab));
        return undefined;
      }
      return current;
    });
  }, []);

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

  /**
   * The scope the side panel describes: the year (or comparison bucket) currently in view,
   * but NOT the single-species or single-trip selection. Those select *within* the scope, so
   * folding them in here would collapse the very lists you are browsing to one row.
   *
   * Both the species list and the trip list derive from this, which is what keeps the header
   * counts consistent with each other.
   */
  const panelSightings = useMemo(() => {
    if (bucketFilter) {
      return filterSightings(sightings, {
        speciesIds: bucketFilter.speciesIds,
        ...(compareScope === "bucketYear" ? { years: bucketFilter.years } : {}),
      });
    }
    if (activeFilter === "all") return sightings;
    return filterSightings(sightings, { year: activeFilter });
  }, [sightings, activeFilter, bucketFilter, compareScope]);

  const filteredSpecies = useMemo(() => {
    if (panelSightings === sightings && !selectedTrip) return species;
    // Picking a trip narrows the species list to that trip — useful, and unlike the trip list
    // there is no self-reference problem.
    const filtered = selectedTrip
      ? filterSightings(panelSightings, { trip: selectedTrip })
      : panelSightings;
    const speciesMap = new Map<number, { count: number }>();
    for (const s of filtered) {
      const existing = speciesMap.get(s.speciesId);
      if (!existing) speciesMap.set(s.speciesId, { count: 1 });
      else existing.count++;
    }
    return species
      .filter((sp) => speciesMap.has(sp.speciesId))
      .map((sp) => ({ ...sp, sightingCount: speciesMap.get(sp.speciesId)!.count }));
  }, [species, sightings, panelSightings, selectedTrip]);

  /**
   * Trips within the current scope. Deliberately NOT narrowed by `selectedTrip`: doing so
   * would leave exactly one row and make it impossible to click a different trip.
   *
   * Trips that straddle New Year (11 of mine, e.g. "Mosselbaai 2025-12") correctly appear
   * under both years, with counts scoped to the year in view.
   */
  const filteredTrips = useMemo(() => getTrips(panelSightings), [panelSightings]);

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
          trips={filteredTrips}
          totalSightings={filteredSightings.length}
          selectedSpeciesId={selectedSpeciesId}
          onSpeciesClick={handleSpeciesClick}
          onTripClick={handleTripClick}
          activeTab={sideTab}
          onTabChange={setSideTab}
          comparison={comparison}
          activeBucket={compareBucket}
          onBucketChange={handleBucketChange}
          compareScope={compareScope}
          onCompareScopeChange={setCompareScope}
        />
      </div>

      {/* Bottom bar — desktop only */}
      <div className="hidden md:block absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100vw-2rem)]">
        <FloatingPanel className="flex items-center gap-3 px-4 py-2.5">
          {/* Years scroll inside their own track; everything after this is shrink-0 so the
              map/heatmap/chart/import actions stay reachable no matter how many years exist.
              While comparing, the pill track collapses into the chip and hands its space back. */}
          <YearCompareChip
            activeYear={activeFilter}
            compareYear={compareYear}
            comparableYears={comparableYears}
            onSetActiveYear={handleFilterChange}
            onSetCompareYear={handleSetCompareYear}
          />

          {!comparison && (
            <PillFilters
              className="flex-1"
              filters={filters}
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
            />
          )}

          <div className="w-px h-6 bg-[#2a2a2a] shrink-0" />

          {(["satellite", "topo", "dark"] as MapTileStyle[]).map((style) => (
            <button
              key={style}
              onClick={() => setTileStyle(style)}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${
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
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              showHeatmap
                ? "bg-[#10b981] text-black"
                : "bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a] hover:text-white"
            }`}
          >
            Heatmap
          </button>

          <button
            onClick={() => setShowChart(!showChart)}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
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
            className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a] hover:text-white transition-all"
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
        trips={filteredTrips}
        totalSightings={filteredSightings.length}
        selectedSpeciesId={selectedSpeciesId}
        onSpeciesClick={handleSpeciesClick}
        onTripClick={handleTripClick}
        activeTab={sideTab}
        onTabChange={setSideTab}
        filters={filters}
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        comparison={comparison}
        compareYear={compareYear}
        comparableYears={comparableYears}
        onSetCompareYear={handleSetCompareYear}
        activeBucket={compareBucket}
        onBucketChange={handleBucketChange}
        compareScope={compareScope}
        onCompareScopeChange={setCompareScope}
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
        comparison={comparisonChart}
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
        compareSuggestion={compareSuggestion}
      />
    </main>
  );
}
