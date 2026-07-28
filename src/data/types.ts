export interface Sighting {
  primaryName: string;
  commonName: string;
  scientificName: string;
  englishIoc: string;
  speciesId: number;
  date: string;
  time: string;
  timezone: number;
  latitude: number;
  longitude: number;
  accuracy: string;
  altitude: number;
  seenHeard: string;
  deadAlive: string;
  count: string;
  countType: string;
  isoDate: string | null;
  dontCountLifelist: string;
  photographed: string;
  fieldsheet: string;
  trip: string;
  notes: string;
}

export interface Species {
  speciesId: number;
  commonName: string;
  scientificName: string;
  primaryName: string;
  firstSeen: string;
  lastSeen: string;
  lastSeenTime: string;
  sightingCount: number;
}

export interface Trip {
  name: string;
  date: string;
  speciesCount: number;
  sightingCount: number;
}

/** Which side of a year-vs-year comparison a species falls on. */
export type CompareBucket = "onlyA" | "onlyB" | "both";

/** A species in a comparison bucket, annotated with where and when it was seen
 *  in the year that bucket belongs to (not its all-time last sighting). */
export interface CompareSpecies extends Species {
  /** Date last seen inside the owning year, yyyy/MM/dd. */
  lastSeenInYear: string;
  /** Trip the owning year's most recent sighting came from — more legible than coordinates. */
  lastTrip: string;
  /** Sightings inside the owning year only. */
  countInYear: number;
}

export interface YearComparison {
  yearA: string;
  yearB: string;
  onlyA: CompareSpecies[];
  onlyB: CompareSpecies[];
  both: CompareSpecies[];
  /** Species totals at the same day-of-year, so an in-progress year compares honestly. */
  pace: {
    dayOfYear: number;
    countA: number;
    countB: number;
    /** True when either year is the current year, i.e. still accumulating. */
    isPartial: boolean;
  };
}
