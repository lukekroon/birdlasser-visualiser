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

export function getCumulativeData(sightings: Sighting[]): { date: string; count: number }[] {
  const seenSpecies = new Set<number>();
  const sorted = [...sightings].sort((a, b) => {
    const da = a.isoDate || a.date;
    const db = b.isoDate || b.date;
    return da.localeCompare(db);
  });

  const points: { date: string; count: number }[] = [];
  for (const s of sorted) {
    if (s.dontCountLifelist === "Y") continue;
    const wasNew = !seenSpecies.has(s.speciesId);
    seenSpecies.add(s.speciesId);
    if (wasNew) {
      points.push({ date: s.date, count: seenSpecies.size });
    }
  }
  return points;
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
