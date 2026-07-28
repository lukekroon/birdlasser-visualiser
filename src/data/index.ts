import { Sighting, Species, Trip, CompareSpecies, YearComparison } from "./types";

/** Years with fewer species than this are excluded from year-vs-year comparison.
 *  My data has 12 backdated stub years holding 1–34 species each (historical lists imported
 *  long after the fact). They are legitimate records but meaningless as comparison operands,
 *  and offering them just clutters the picker. The threshold leaves 2020–2026. */
export const COMPARABLE_YEAR_MIN_SPECIES = 50;

/** A species id of 0 means the CSV `ID` column was missing and parseInt fell back to "0".
 *  Every current row has a real id, but a set-difference would silently merge all such rows
 *  into one phantom species, so comparison code skips them explicitly. */
function isRealSpecies(speciesId: number): boolean {
  return Number.isFinite(speciesId) && speciesId > 0;
}

/** A sighting counts toward a year list unless it is flagged not to count.
 *  getChartData's life-list branch has always honoured this flag; its year branch did not.
 *  Applying it consistently here. No visible change on current data (zero flagged rows). */
function countsTowardList(s: Sighting): boolean {
  return s.dontCountLifelist !== "Y" && isRealSpecies(s.speciesId);
}

/** 1-based day of the year for a yyyy/MM/dd date. */
function dayOfYear(date: string): number {
  const [y, m, d] = date.split("/").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

/** Project a yyyy/MM/dd date onto one canonical year so two years' curves overlay on a
 *  single time axis. Without this the series sit side by side in absolute time and the
 *  "overlay" shows nothing. 2004 is used because it is a leap year, so 29 Feb is
 *  representable and no date has to be shifted. */
function canonicalDate(date: string): string {
  const [, month, day] = date.split("/");
  return `2004-${month}-${day}`;
}

/** Sort helper: chronological by best available timestamp. */
function byTime(a: Sighting, b: Sighting): number {
  return (a.isoDate || a.date).localeCompare(b.isoDate || b.date);
}

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
      if (!countsTowardList(s)) continue;
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
      if (!countsTowardList(s)) continue;
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

/** Years that hold enough species to be worth comparing, newest first. */
export function getComparableYears(sightings: Sighting[]): string[] {
  const speciesByYear = new Map<string, Set<number>>();
  for (const s of sightings) {
    if (!countsTowardList(s)) continue;
    const year = s.date.slice(0, 4);
    if (!speciesByYear.has(year)) speciesByYear.set(year, new Set());
    speciesByYear.get(year)!.add(s.speciesId);
  }
  return Array.from(speciesByYear.entries())
    .filter(([, set]) => set.size >= COMPARABLE_YEAR_MIN_SPECIES)
    .map(([year]) => year)
    .sort()
    .reverse();
}

/**
 * Split two years' species into three buckets: only-A, only-B, and seen in both.
 *
 * Each bucket entry is annotated with the trip and date from the year that bucket belongs to,
 * so "African Finfoot — Kruger – Pafuri 2025-09 · 14 Mar" tells me where to go back to. For the
 * shared bucket, year A is the reference.
 */
export function compareYears(
  sightings: Sighting[],
  yearA: string,
  yearB: string
): YearComparison {
  // Per year: speciesId -> the year-scoped facts we display.
  // `first` is when the species joined that year's list (needed for the pace count);
  // `last` is the most recent encounter (what the list row shows).
  type YearEntry = { first: Sighting; last: Sighting; count: number };
  const perYear = new Map<string, Map<number, YearEntry>>([
    [yearA, new Map()],
    [yearB, new Map()],
  ]);

  for (const s of sightings) {
    if (!countsTowardList(s)) continue;
    const bucket = perYear.get(s.date.slice(0, 4));
    if (!bucket) continue;
    const existing = bucket.get(s.speciesId);
    if (!existing) {
      bucket.set(s.speciesId, { first: s, last: s, count: 1 });
    } else {
      existing.count += 1;
      if (byTime(existing.last, s) < 0) existing.last = s;
      if (byTime(s, existing.first) < 0) existing.first = s;
    }
  }

  const inA = perYear.get(yearA)!;
  const inB = perYear.get(yearB)!;

  // Global species metadata (names) comes from the full list so buckets show proper names.
  const meta = new Map(getSpeciesList(sightings).map((sp) => [sp.speciesId, sp]));

  const build = (speciesId: number, source: Map<number, YearEntry>): CompareSpecies | null => {
    const entry = source.get(speciesId);
    const base = meta.get(speciesId);
    if (!entry || !base) return null;
    return {
      ...base,
      lastSeenInYear: entry.last.date,
      lastTrip: entry.last.trip,
      countInYear: entry.count,
    };
  };

  // Most-seen first. Frequency inside the year is the best proxy for how gettable a bird is:
  // one I logged 20 times last year but not this year is a common species I am simply missing,
  // while a single sighting is probably a one-off rarity I cannot plan around. Sorting this way
  // puts the closeable gaps at the top and pushes the luck-dependent tail down.
  // Ties break on recency, then name, so the order is stable across renders.
  const byFrequency = (a: CompareSpecies, b: CompareSpecies) =>
    b.countInYear - a.countInYear ||
    b.lastSeenInYear.localeCompare(a.lastSeenInYear) ||
    a.commonName.localeCompare(b.commonName);

  const onlyA: CompareSpecies[] = [];
  const both: CompareSpecies[] = [];
  for (const speciesId of inA.keys()) {
    const built = build(speciesId, inA);
    if (!built) continue;
    (inB.has(speciesId) ? both : onlyA).push(built);
  }

  const onlyB: CompareSpecies[] = [];
  for (const speciesId of inB.keys()) {
    if (inA.has(speciesId)) continue;
    const built = build(speciesId, inB);
    if (built) onlyB.push(built);
  }

  // Pace: how many species each year held by this point in the calendar. Comparing a
  // part-finished year against a complete one on final totals is misleading.
  const now = new Date();
  const today = dayOfYear(
    `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`
  );
  const countBy = (source: Map<number, YearEntry>) => {
    let count = 0;
    for (const [, entry] of source) {
      // `first`, not `last`: a species first seen in January counts toward the July pace even
      // if I saw it again in December.
      if (dayOfYear(entry.first.date) <= today) count += 1;
    }
    return count;
  };
  const currentYear = String(now.getFullYear());

  return {
    yearA,
    yearB,
    onlyA: onlyA.sort(byFrequency),
    onlyB: onlyB.sort(byFrequency),
    // `both` is built from year A, so its counts are year A's.
    both: both.sort(byFrequency),
    pace: {
      dayOfYear: today,
      countA: countBy(inA),
      countB: countBy(inB),
      isPartial: yearA === currentYear || yearB === currentYear,
    },
  };
}

export interface ComparisonChartData {
  yearA: string;
  yearB: string;
  /** Cumulative species, x projected onto one canonical year so the curves overlay. */
  cumulativeA: { x: string; y: number }[];
  cumulativeB: { x: string; y: number }[];
  /** New species per calendar month, 12 entries each. */
  barsA: number[];
  barsB: number[];
  monthLabels: string[];
  totalA: number;
  totalB: number;
  /** Day-of-year to mark on the axis, and each year's count at that point. */
  pace: { canonicalDate: string; countA: number; countB: number; isPartial: boolean };
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Two cumulative year-list curves on a shared day-of-year axis, plus grouped monthly counts.
 *
 * Bars are per-month counts of species new to that year — deliberately NOT stacked anywhere
 * downstream, because the two years share most of their species and summing double-counts.
 */
export function getComparisonChartData(
  sightings: Sighting[],
  yearA: string,
  yearB: string
): ComparisonChartData {
  const sorted = [...sightings].sort(byTime);

  const seriesFor = (year: string) => {
    const seen = new Set<number>();
    const cumulative: { x: string; y: number }[] = [];
    const bars = new Array(12).fill(0) as number[];
    let atToday = 0;
    const now = new Date();
    const todayDoY = dayOfYear(
      `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`
    );

    for (const s of sorted) {
      if (s.date.slice(0, 4) !== year) continue;
      if (!countsTowardList(s)) continue;
      if (seen.has(s.speciesId)) continue;
      seen.add(s.speciesId);
      cumulative.push({ x: canonicalDate(s.date), y: seen.size });
      bars[Number(s.date.slice(5, 7)) - 1] += 1;
      if (dayOfYear(s.date) <= todayDoY) atToday = seen.size;
    }
    return { cumulative, bars, total: seen.size, atToday };
  };

  const a = seriesFor(yearA);
  const b = seriesFor(yearB);

  const now = new Date();
  const currentYear = String(now.getFullYear());
  const marker = `2004-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return {
    yearA,
    yearB,
    cumulativeA: a.cumulative,
    cumulativeB: b.cumulative,
    barsA: a.bars,
    barsB: b.bars,
    monthLabels: MONTH_LABELS,
    totalA: a.total,
    totalB: b.total,
    pace: {
      canonicalDate: marker,
      countA: a.atToday,
      countB: b.atToday,
      isPartial: yearA === currentYear || yearB === currentYear,
    },
  };
}

export function filterSightings(
  sightings: Sighting[],
  filters: {
    year?: string;
    /** Any of these years. Used by the "seen in both years" comparison bucket. */
    years?: string[];
    trip?: string;
    speciesId?: number;
    /** Restrict to a set of species. Used to put a comparison bucket on the map. */
    speciesIds?: Set<number>;
  }
): Sighting[] {
  return sightings.filter((s) => {
    if (filters.year && !s.date.startsWith(filters.year)) return false;
    if (filters.years && !filters.years.some((y) => s.date.startsWith(y))) return false;
    if (filters.trip && s.trip !== filters.trip) return false;
    if (filters.speciesId !== undefined && s.speciesId !== filters.speciesId) return false;
    if (filters.speciesIds && !filters.speciesIds.has(s.speciesId)) return false;
    return true;
  });
}
