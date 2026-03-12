import { Sighting, Species, Trip } from "./types";

export function getSpeciesList(sightings: Sighting[]): Species[] {
  const speciesMap = new Map<number, Species>();

  for (const s of sightings) {
    const existing = speciesMap.get(s.speciesId);
    if (!existing) {
      speciesMap.set(s.speciesId, {
        speciesId: s.speciesId,
        commonName: s.commonName,
        scientificName: s.scientificName,
        primaryName: s.primaryName,
        firstSeen: s.date,
        lastSeen: s.date,
        lastSeenTime: s.time,
        sightingCount: 1,
      });
    } else {
      existing.sightingCount++;
      if (s.date < existing.firstSeen) {
        existing.firstSeen = s.date;
      }
      if (s.date > existing.lastSeen || (s.date === existing.lastSeen && s.time > existing.lastSeenTime)) {
        existing.lastSeen = s.date;
        existing.lastSeenTime = s.time;
      }
    }
  }

  return Array.from(speciesMap.values()).sort((a, b) => {
    const cmp = b.lastSeen.localeCompare(a.lastSeen);
    if (cmp !== 0) return cmp;
    return b.lastSeenTime.localeCompare(a.lastSeenTime);
  });
}

export function getTrips(sightings: Sighting[]): Trip[] {
  const tripMap = new Map<string, { species: Set<number>; count: number; date: string }>();

  for (const s of sightings) {
    if (!s.trip) continue;
    const existing = tripMap.get(s.trip);
    if (!existing) {
      tripMap.set(s.trip, { species: new Set([s.speciesId]), count: 1, date: s.date });
    } else {
      existing.species.add(s.speciesId);
      existing.count++;
      if (s.date < existing.date) existing.date = s.date;
    }
  }

  return Array.from(tripMap.entries())
    .map(([name, data]) => ({
      name,
      date: data.date,
      speciesCount: data.species.size,
      sightingCount: data.count,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface ChartData {
  cumulative: { date: string; count: number }[];
  bars: { period: string; count: number; label: string }[];
}

export function getChartData(sightings: Sighting[], activeFilter: string): ChartData {
  const sorted = [...sightings].sort((a, b) => {
    const da = a.isoDate || a.date;
    const db = b.isoDate || b.date;
    return da.localeCompare(db);
  });

  if (activeFilter === "all") {
    // Global life list: cumulative lifers over all time, bars = lifers added per year
    const seenSpecies = new Set<number>();
    const cumulative: { date: string; count: number }[] = [];
    const lifersByYear = new Map<string, number>();

    for (const s of sorted) {
      if (s.dontCountLifelist === "Y") continue;
      if (!seenSpecies.has(s.speciesId)) {
        seenSpecies.add(s.speciesId);
        cumulative.push({ date: s.date, count: seenSpecies.size });
        const year = s.date.slice(0, 4);
        lifersByYear.set(year, (lifersByYear.get(year) || 0) + 1);
      }
    }

    const bars = Array.from(lifersByYear.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, count]) => ({ period: year, count, label: year }));

    return { cumulative, bars };
  } else {
    // Year list: cumulative new species seen in this year, bars = new species per month
    const year = activeFilter;
    const seenThisYear = new Set<number>();
    const cumulative: { date: string; count: number }[] = [];
    const newByMonth = new Map<string, number>();

    for (const s of sorted) {
      const dateStr = s.date.replace(/\//g, "-");
      if (dateStr.slice(0, 4) !== year) continue;
      if (!seenThisYear.has(s.speciesId)) {
        seenThisYear.add(s.speciesId);
        cumulative.push({ date: s.date, count: seenThisYear.size });
        const month = dateStr.slice(0, 7); // "2025-03"
        newByMonth.set(month, (newByMonth.get(month) || 0) + 1);
      }
    }

    const bars = Array.from(newByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => {
        const monthNum = parseInt(month.slice(5, 7));
        const label = new Date(2000, monthNum - 1, 1).toLocaleString("en", { month: "short" });
        return { period: month, count, label };
      });

    return { cumulative, bars };
  }
}

export function filterSightings(
  sightings: Sighting[],
  filters: { year?: string; trip?: string; speciesId?: number }
): Sighting[] {
  return sightings.filter((s) => {
    if (filters.year && !s.date.startsWith(filters.year)) return false;
    if (filters.trip && s.trip !== filters.trip) return false;
    if (filters.speciesId !== undefined && s.speciesId !== filters.speciesId) return false;
    return true;
  });
}
