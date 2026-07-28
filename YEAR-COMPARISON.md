# Feature plan — Year vs Year comparison

**Status:** approved and implemented. Kept as the design record.

## The goal

I bird a year list. I want to answer three questions the current app can't:

1. **Am I ahead or behind?** Overlay two years' cumulative curves and see which months carried each year.
2. **What am I missing?** List the birds I saw in year A but not year B, and vice versa.
3. **Where do I go to fix it?** Filter the map to the missing birds and see where I found them last time.

Question 3 is the one that turns this from a stats page into a trip-planning tool.

---

## Grounding: what my actual data says

Computed from the current 10,839-sighting import, so the design targets real shapes and volumes.

| Year | Species | By 28 Jul |
|---|---|---|
| 2026 | 388 (in progress) | 388 |
| 2025 | 442 | 368 |
| 2024 | 505 | 439 |
| 2023 | 452 | 394 |
| 2022 | 428 | — |
| 2021 | 424 | — |
| 2020 | 204 | — |

Everything from 2019 back is thin (34, 2, 173, 3, 1, 5, 1, 19, 4, 1, 1) — backdated historical lists,
not real birding years. **The comparison UI should not treat all 18 years as equal citizens.**

### 2025 vs 2026, the comparison I actually want right now

| | Count |
|---|---|
| Seen in both | 317 |
| **Only 2025** (missed so far in 2026) | **125** |
| **Only 2026** (new vs last year) | **71** |

317 + 125 = 442 ✓ and 317 + 71 = 388 ✓.

### New species per month

| Month | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2025 | 93 | 28 | **152** | 85 | 2 | 8 | 2 | 24 | 16 | 5 | 15 | 12 |
| 2026 | **130** | **106** | 30 | 57 | 4 | 3 | 58 | — | — | — | — | — |

This is the shape worth seeing: 2026 front-loaded hard in Jan–Feb, then March 2025's 152 (clearly a
big trip) is unmatched. Useful and immediately legible.

### Where the 125 missing birds were found in 2025

Locations are **coordinates**, not pentads. A pentad is a SABAP2 atlas grid cell — it belongs in the
`Fieldsheet` column and in atlas submissions, but it is useless for deciding where to drive. Clustered
on a ~0.1° grid (≈11 km), by how many of the 125 target species each cluster holds:

| Targets | Coordinates | Sightings | Trip |
|---|---|---|---|
| 15 | `-22.4215, 31.2133` | 15 | Kruger – Pafuri 2025-09 |
| 15 | `-25.3891, 31.7126` | 16 | Mjejane 10-2025 |
| 12 | `-46.5991, 37.5054` | 12 | Flock to Marion 2025 |
| 11 | `-22.1940, 29.2096` | 13 | Mapungubwe 08-2025 |
| 11 | `-22.6913, 31.0198` | 13 | Kruger – Pafuri 2025-09 |
| 10 | `-22.2152, 29.3931` | 10 | Mapungubwe 08-2025 |
| 9 | `-25.1618, 28.0841` | 10 | Zaagkuildrift 21-03-2025 |
| 9 | `-47.2093, 37.5281` | 9 | Flock to Marion 2025 |

**Two findings here that change the design.**

**1. A ranked "best spots" list would mislead me.** Rows 3 and 8 are at latitude −46.6 and −47.2:
Marion Island, in the sub-Antarctic. Those 21 target species are pelagic seabirds from a cruise, and
no amount of driving will get them. A text list ranked by target count puts an unrepeatable trip at
number 3. **On a map I would see instantly that they are 2,000 km out in the Southern Ocean.** This is
a strong argument that the map is the primary interface for question 3, and that any ranked list is a
secondary aid at best.

**2. The misses have a very long tail.** The 125 species are spread across **115 distinct clusters**,
and only **6 clusters hold 10 or more** targets. So a "top spots" list has a genuinely useful head of
about six entries and then ~109 near-singletons. Clustered map markers handle that distribution
gracefully; a scrolling ranked table does not.

---

## The insight that shapes the whole design

**Comparing full-year totals is misleading while a year is in progress.** 2026's 388 against 2025's
442 reads as "behind" — but at this same date in 2025 I was on **368**. I'm actually 20 ahead of last
year's pace, and 51 behind 2024's.

So the feature must compare **like for like on day-of-year**, not just final totals. This drives two
requirements:

- The chart x-axis must be **normalised to day-of-year**, or the two lines sit side by side in
  absolute time instead of overlaying. This is the core technical requirement.
- Show **both numbers**: full-year total and same-date total, clearly distinguished.

---

## UX proposal

### Entering compare mode

Add a `vs` chip to the left of the year pill track, visible only when a specific year is active
(not `All`). No modifier keys — shift-click is undiscoverable.

```
┌────────────────────────────────────────────────────────────────┐
│ [vs] │ All  2026  2025  2024  2023 … │ ‹ › │ Satellite Topo … │
└────────────────────────────────────────────────────────────────┘
       click [vs] →
┌────────────────────────────────────────────────────────────────┐
│ 2026 vs … pick a year │ All  ⟨2025⟩ ⟨2024⟩ ⟨2023⟩ …            │
└────────────────────────────────────────────────────────────────┘
       click 2025 →
┌────────────────────────────────────────────────────────────────┐
│ ⟨2026 vs 2025 ✕⟩ │ Satellite Topo Dark │ Heatmap Chart Import  │
└────────────────────────────────────────────────────────────────┘
```

While in compare mode the year pills collapse into a single `A vs B ✕` chip, which frees the space
the pill track was eating. Clicking either year in the chip reopens the picker for that slot.

**Recommendation:** only offer years with a meaningful list as compare candidates. A threshold of
~50 species drops the 12 backdated stub years and leaves 2020–2026 — seven real options.

### The overlaid chart

Extend the existing `CumulativeChart` rather than building a new panel.

```
┌─ 2026 vs 2025 ──────────────────────────────────── ✕ ─┐
│  500 ┤                                    ╭──── 2025  │
│      │                              ╭─────╯    (442)   │
│  400 ┤              ╭───────────────╯                  │
│      │        ╭─────╯   ┆                              │
│  300 ┤   ╭────╯         ┆ ← today (day 209)            │
│      │╭──╯              ┆   2026: 388  2025: 369       │
│    0 ┼─────────────────────────────────────────────    │
│      Jan  Mar  May  Jul  Sep  Nov                      │
│                                                        │
│  New species per month                                 │
│  150 ┤     ▐▌                                          │
│      │  ▐▌ ▐▌                                          │
│   50 ┤ ▟▌▐▌▐▌ ▐▌                                       │
│      Jan Feb Mar Apr May Jun Jul Aug …                 │
│      ■ 2026   ■ 2025                                   │
└────────────────────────────────────────────────────────┘
```

Decisions:

- **X axis = day-of-year.** Map both series onto one arbitrary common year so they overlay. Without
  this the "overlay" is meaningless.
- **Vertical "today" marker** at the current day-of-year, annotated with each year's count at that
  point. This is where the pace insight lives.
- **Grouped bars, never stacked.** Stacking implies a sum, which is wrong — the two years share 317
  species and adding them double-counts.
- **Colours:** year A keeps the existing green `#10b981`; year B gets blue `#60a5fa`. Avoid amber —
  the map's marker clusters already own it, and green/amber is a poor pair for colour-blind viewers.
- **Turn the legend on** in compare mode (currently hard-disabled) since there are now two series.
- The truncated year-B curve could be dashed beyond today's date, to make "this part hasn't happened
  yet for year A" visually obvious.

### The diff list

A third tab in `SidePanel`, alongside Species and Trips.

```
┌─ Species │ Trips │ Compare ─────────────┐
│  2026 vs 2025                            │
├──────────────────────────────────────────┤
│ ▾ Only 2025 — missing this year    125   │
│   [ Show all 125 on map ]                │
│   African Finfoot            2025/03/14  │
│   Pel's Fishing Owl          2025/09/02  │
│   …                                      │
├──────────────────────────────────────────┤
│ ▸ Only 2026 — new this year         71   │
├──────────────────────────────────────────┤
│ ▸ In both                          317   │
└──────────────────────────────────────────┘
```

- Three collapsible buckets with counts in the headers. "Only 2025" expanded by default — it's the
  actionable one.
- Each row shows the species name, **the trip it came from**, and **the date last seen that year**.
  The trip name is doing real work here: `Kruger – Pafuri 2025-09` immediately tells me both roughly
  where and how far, in a way `-22.4215, 31.2133` does not. Coordinates are what the map consumes;
  trip names are what a human reads. Show both, in their respective places.
- Clicking a row filters the map to that one species (reuses the existing `onSpeciesClick`).
- **`Show all N on map`** per bucket is the feature that answers question 3.
- Sort options worth having: alphabetical, or by date last seen. Default to date descending, so
  recent misses surface first.

```
│   African Finfoot                        │
│   Kruger – Pafuri 2025-09 · 14 Mar       │
```

### Map filtering — the important detail

When I show "the 125 birds I saw in 2025 but not 2026" on the map, I want **their 2025 locations**,
not their all-time locations. The question is "where was I standing when I found this bird last
year", and all-time sightings would blur that with 2021 records.

So a bucket filter is **species set + the year that bucket belongs to**:

| Bucket | Map shows |
|---|---|
| Only 2025 | 2025 sightings of those 125 species |
| Only 2026 | 2026 sightings of those 71 species |
| In both | both years' sightings of those 317 species |

Worth adding a toggle to widen a bucket to all-time — "show me everywhere I've ever seen these 125"
is a reasonable second question — but scoped-to-year is the right default.

**The map is the primary answer to question 3, not a ranked list.** The Marion Island finding above is
the reason: reachability is a spatial property, and a table of coordinates sorted by target count
actively hides it. Rendering the bucket as clustered markers means distance, direction and
plausibility are all read at a glance — the existing `leaflet.markercluster` setup already collapses
the ~109 near-singleton locations into readable groups and zooms into them, which is precisely the
behaviour this long tail needs. If a ranked list is added later it should be a companion to the map,
never the entry point.

An optional refinement once this is in use: since coordinates make distance computable, the bucket
header could show something like *"6 clusters within 500 km hold 62 of your 125 targets"*. That turns
raw reachability into a number without pretending an unreachable island is a destination.

---

## Code changes

### `src/data/index.ts`

```ts
// New
export interface YearComparison {
  yearA: string;
  yearB: string;
  onlyA: Species[];
  onlyB: Species[];
  both: Species[];
  /** Species counts at the same day-of-year, for honest in-progress comparison. */
  pace: { dayOfYear: number; countA: number; countB: number };
}

export function compareYears(sightings: Sighting[], yearA: string, yearB: string): YearComparison;

// getChartData currently returns a single series. Either add a sibling
// getComparisonChartData(sightings, yearA, yearB) returning two series with day-of-year
// normalised x values, or widen ChartData to hold an array of series.
```

Preference: a **separate `getComparisonChartData`** rather than widening `ChartData`. The existing
single-series path is used by the life-list view and works; widening its type forces changes through
`CumulativeChart` for both modes and invites regressions in the view that currently works.

### `filterSightings`

Widen the filter options with a species **set** and a year set:

```ts
filterSightings(sightings, {
  year?: string;
  years?: string[];        // new — for the "in both" bucket
  speciesIds?: Set<number>; // new — bucket filtering
  trip?: string;
  speciesId?: number;
})
```

### `src/app/page.tsx`

New state:

```ts
const [compareYear, setCompareYear] = useState<string | undefined>();
const [compareBucket, setCompareBucket] = useState<"onlyA" | "onlyB" | "both" | undefined>();
const [compareScope, setCompareScope] = useState<"bucketYear" | "allTime">("bucketYear");
```

`compareYear !== undefined` is the single source of truth for "am I in compare mode". `activeFilter`
keeps holding year A, so nothing about the existing filter path changes.

### Component changes

| File | Change |
|---|---|
| `PillFilters.tsx` | The `vs` chip and the collapsed `A vs B ✕` state. Possibly a new sibling component instead, to keep `PillFilters` generic — it was just refactored for chevron scrolling and is currently clean. |
| `CumulativeChart.tsx` | Second dataset on both charts, legend on, day-of-year axis, today marker. |
| `SidePanel.tsx` | Third tab; `activeTab` type widens to `"species" \| "trips" \| "compare"`. New `CompareList` sub-component (virtualise it — 317 rows in the "both" bucket). |
| `BottomSheet.tsx` | Mobile equivalent of both. Lower priority. |
| `MapView.tsx` | No prop changes needed — it already renders whatever `sightings` it is handed. Optional phase 2: colour markers by bucket. |
| `CommandPalette.tsx` | Worth adding a `Compare 2026 vs 2025` action. |

---

## Gotchas found while reading the code

1. **`getChartData` is inconsistent about `dontCountLifelist`.** Life-list mode skips rows where
   `dontCountLifelist === "Y"`; year mode does not. My data currently has **zero** such rows, so
   nothing is visibly wrong, but a year list should arguably honour the same flag. Decide the rule
   before adding a second year-based code path, or the inconsistency gets duplicated.

2. **Species identity is `speciesId`, and id `0` is real in my data — CONFIRMED, not theoretical.**
   BirdLasser has an `Unidentified` placeholder species with `sabap2: 0`, and I have **10 such
   records** (5 in 2025, 2 in 2024, 2 in 2022, 1 in 2019). Without a guard it becomes a phantom
   species in every bucket and inflates year-list totals by one. `compareYears` therefore skips
   `speciesId <= 0`, which is why the real 2025 list is **442, not 443**, and the only-2025 bucket is
   **125, not 126**.

   Follow-up worth doing separately: `getSpeciesList` and the lifer numbering in `page.tsx` do *not*
   apply this guard, so `Unidentified` currently occupies a slot in the Species tab and consumes a
   lifer number. The headline species count is therefore one too high. Out of scope here.

3. **Partial-year asymmetry is the whole point, not a bug.** Resist any urge to "fix" 2026 looking
   short. Just label it clearly and give the same-date number.

4. **The backdated stub years are noise.** 2000, 2001, 2004… have 1–19 species. They are legitimate
   historical records but meaningless as comparison operands. Filter the candidate list.

5. **Guard against A === B.** Selecting the same year twice should be impossible, not merely odd.

6. **`getTrips` is computed from all sightings, not filtered ones**, while `species` uses
   `filteredSpecies`. Not a bug for this feature, but don't assume the panel props are uniformly
   filter-aware.

7. **Performance is a non-issue.** 692 species, 10,839 sightings, and set differences on a few
   hundred ids. Plain `useMemo` is sufficient; no virtualisation needed beyond the existing list
   pattern, and no need for web workers or indexes.

---

## Phasing

**Phase 1 — the numbers.** `compareYears()`, the Compare tab with three buckets and counts, click a
row to filter one species. Delivers question 2 with no chart work.

**Phase 2 — the map.** `Show all N on map`, bucket-scoped year filtering, the all-time toggle.
Delivers question 3, the highest-value part.

**Phase 3 — the chart.** Overlaid cumulative lines with day-of-year normalisation, grouped monthly
bars, today marker, pace readout. Delivers question 1 and is the most fiddly, hence last.

**Phase 4 — polish.** Mobile `BottomSheet` parity, command-palette action, marker colouring by
bucket, URL-encodable state (`?a=2026&b=2025`) which also sets up the project's Phase 3 sharing goal.

---

## Open questions

1. **Is a species-count threshold the right way to hide stub years,** or would you rather see all 18
   and pick freely?
2. **More than two years at once?** Three overlaid curves is legible; the diff list is not — three
   years gives 7 buckets instead of 3. I'd cap at two and revisit.
3. **Should the year list honour `dontCountLifelist`?** See gotcha 1.
4. **Is "date last seen in that year" the right secondary line** in the diff rows, or would "number
   of sightings" be more useful for planning? I have assumed trip name + date, since the trip name
   conveys location better than raw coordinates in a narrow list.
5. **Should the bucket map filter replace the year filter or stack with it?** I've assumed replace —
   picking a bucket takes over the map — but stacking could be confusing either way.
