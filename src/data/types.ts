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
