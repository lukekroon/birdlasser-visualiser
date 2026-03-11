import Papa from "papaparse";
import { Sighting } from "@/data/types";

/** Extract a human-readable trip name from a BirdLasser CSV filename.
 *  e.g. "BirdLasser_Zaagkuildrift 03 20363834536643421602474.csv" → "Zaagkuildrift 03"
 */
export function tripNameFromFilename(filename: string): string {
  // Strip extension
  let name = filename.replace(/\.csv$/i, "");
  // Strip "BirdLasser_" prefix
  name = name.replace(/^BirdLasser_/i, "");
  // Strip trailing numeric ID (long number at the end)
  name = name.replace(/\s+\d{10,}$/, "");
  return name.trim() || filename;
}

export function parseBirdLasserCSV(csvText: string, tripName: string): Sighting[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const sightings: Sighting[] = [];

  for (const row of result.data as Record<string, string>[]) {
    const lat = parseFloat(row["Latitude"]);
    const lon = parseFloat(row["Longitude"]);

    sightings.push({
      primaryName: row["Primary language"] || "",
      commonName: row["Secondary language"] || "",
      scientificName: row["Tertiary language"] || "",
      englishIoc: row["English IOC"] || "",
      speciesId: parseInt(row["ID"] || "0", 10),
      date: row["Date"] || "",
      time: row["Time"] || "",
      timezone: parseInt(row["Timezone"] || "0", 10),
      latitude: isNaN(lat) ? 0 : lat,
      longitude: isNaN(lon) ? 0 : lon,
      accuracy: row["Accuracy"] || "",
      altitude: parseInt(row["Altitude"] || "0", 10),
      seenHeard: row["Seen/Heard"] || "",
      deadAlive: row["Dead/Alive"] || "",
      count: row["Count"] || "",
      countType: row["Count type"] || "",
      isoDate: row["ISO date"] || null,
      dontCountLifelist: row["Don't count towards lifelist"] || "N",
      photographed: row["Photographed"] || "N",
      fieldsheet: row["Fieldsheet"] || "",
      trip: tripName,
      notes: row["Notes"] || "",
    });
  }

  return sightings;
}
