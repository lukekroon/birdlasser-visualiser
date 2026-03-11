import { openDB, DBSchema } from "idb";
import { Sighting } from "@/data/types";

interface BirdLasserDB extends DBSchema {
  sightings: {
    key: string; // composite key: speciesId_date_time_lat_lon
    value: Sighting;
    indexes: {
      "by-trip": string;
      "by-species": number;
      "by-date": string;
    };
  };
}

const DB_NAME = "birdlasser-social";
const DB_VERSION = 1;

function getDB() {
  return openDB<BirdLasserDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore("sightings", { keyPath: "key" });
      store.createIndex("by-trip", "trip");
      store.createIndex("by-species", "speciesId");
      store.createIndex("by-date", "date");
    },
  });
}

function sightingKey(s: Sighting): string {
  return `${s.speciesId}_${s.date}_${s.time}_${s.latitude}_${s.longitude}`;
}

export async function addSightings(sightings: Sighting[]): Promise<{ added: number; skipped: number }> {
  const db = await getDB();
  let added = 0;
  let skipped = 0;

  const tx = db.transaction("sightings", "readwrite");
  for (const s of sightings) {
    const keyed = { ...s, key: sightingKey(s) };
    const existing = await tx.store.get(keyed.key);
    if (existing) {
      skipped++;
    } else {
      await tx.store.put(keyed);
      added++;
    }
  }
  await tx.done;

  return { added, skipped };
}

export async function getAllSightings(): Promise<Sighting[]> {
  const db = await getDB();
  return db.getAll("sightings");
}

export async function getSightingCount(): Promise<number> {
  const db = await getDB();
  return db.count("sightings");
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear("sightings");
}
