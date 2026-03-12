"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { Sighting } from "@/data/types";

// Fix default marker icons for Leaflet in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type MapTileStyle = "satellite" | "dark" | "topo";

const TILE_CONFIGS: Record<MapTileStyle, { url: string; attribution: string; maxZoom: number; subdomains?: string }> = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 17,
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 17,
    subdomains: "abcd",
  },
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 17,
  },
};

interface MapViewProps {
  sightings: Sighting[];
  showHeatmap: boolean;
  onSightingClick?: (sighting: Sighting) => void;
  selectedSpeciesId?: number;
  tileStyle: MapTileStyle;
  liferMap?: Map<number, number>; // speciesId → lifer number
}

export default function MapView({
  sightings,
  showHeatmap,
  onSightingClick,
  selectedSpeciesId,
  tileStyle,
  liferMap,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const prevSightingsRef = useRef<Sighting[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      maxZoom: 17,
    }).setView([-25.17, 28.1], 12);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const cfg = TILE_CONFIGS[tileStyle];
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains || "abc",
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch tile layer when tileStyle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const cfg = TILE_CONFIGS[tileStyle];
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains || "abc",
    }).addTo(map);
  }, [tileStyle]);

  // Update markers when sightings or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean up previous layers
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (showHeatmap) {
      // Dynamic import for leaflet.heat
      import("leaflet").then(() => {
        // @ts-expect-error leaflet.heat adds L.heatLayer
        if (typeof L.heatLayer === "undefined") {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
          script.onload = () => addHeatLayer(map, sightings);
          document.head.appendChild(script);
        } else {
          addHeatLayer(map, sightings);
        }
      });
    } else {
      // Pre-compute which sightings are lifers (first time this species was seen)
      const seenSpecies = new Set<number>();
      const sortedForLifers = [...sightings].sort((a, b) => {
        const da = a.isoDate || a.date;
        const db = b.isoDate || b.date;
        return da.localeCompare(db);
      });
      const liferSightingKeys = new Set<string>();
      for (const s of sortedForLifers) {
        if (!seenSpecies.has(s.speciesId)) {
          seenSpecies.add(s.speciesId);
          liferSightingKeys.add(`${s.speciesId}_${s.date}_${s.time}_${s.latitude}_${s.longitude}`);
        }
      }

      const cluster = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        iconCreateFunction: (clusterObj) => {
          const count = clusterObj.getChildCount();
          const hasLifer = clusterObj.getAllChildMarkers().some(
            (m) => (m as unknown as { options: { isLifer?: boolean } }).options.isLifer
          );
          let size = "small";
          let px = 36;
          if (count > 100) { size = "large"; px = 48; }
          else if (count > 10) { size = "medium"; px = 42; }

          const colorClass = hasLifer ? "gold" : size;
          return L.divIcon({
            html: `<div class="cluster-${colorClass}">${count}</div>`,
            className: "marker-cluster",
            iconSize: L.point(px, px),
          });
        },
      });

      for (const s of sightings) {
        if (!s.latitude || !s.longitude) continue;
        const isSelected = selectedSpeciesId === undefined || s.speciesId === selectedSpeciesId;
        const sKey = `${s.speciesId}_${s.date}_${s.time}_${s.latitude}_${s.longitude}`;
        const isLifer = liferSightingKeys.has(sKey);
        const liferNum = liferMap?.get(s.speciesId);

        let fillColor: string;
        let strokeColor: string;
        if (!isSelected) {
          fillColor = "#444444";
          strokeColor = "#333333";
        } else if (isLifer) {
          fillColor = "#f59e0b";
          strokeColor = "#f59e0b";
        } else {
          fillColor = "#10b981";
          strokeColor = "#10b981";
        }

        const marker = L.circleMarker([s.latitude, s.longitude], {
          radius: isSelected ? 6 : 3,
          fillColor,
          color: strokeColor,
          weight: 1,
          opacity: isSelected ? 1 : 0.3,
          fillOpacity: isSelected ? 0.8 : 0.2,
          isLifer,
        } as L.CircleMarkerOptions & { isLifer: boolean });

        const liferTag = isLifer && liferNum ? `<br/><span style="color:#f59e0b;font-weight:600">Lifer #${liferNum}</span>` : "";
        marker.bindTooltip(
          `<strong>${s.commonName}</strong><br/><em>${s.scientificName}</em><br/>${s.date} ${s.time}<br/>${s.trip}${liferTag}`,
          { className: "dark-tooltip" }
        );

        if (onSightingClick) {
          marker.on("click", () => onSightingClick(s));
        }

        cluster.addLayer(marker);
      }

      cluster.on("clusterclick", (e: L.LeafletEvent) => {
        const clusterLayer = (e as unknown as { layer: L.MarkerCluster }).layer;
        const count = clusterLayer.getChildCount();
        if (count <= 15) {
          clusterLayer.spiderfy();
        } else {
          const clusterBounds = clusterLayer.getBounds();
          map.fitBounds(clusterBounds, { maxZoom: 15, padding: [40, 40] });
        }
      });

      map.addLayer(cluster);
      clusterGroupRef.current = cluster;
    }

    // Fit bounds only when the sightings dataset changes (not on selection/style changes)
    if (sightings !== prevSightingsRef.current && sightings.length > 0) {
      prevSightingsRef.current = sightings;
      const lats = sightings.filter(s => s.latitude).map(s => s.latitude);
      const lngs = sightings.filter(s => s.longitude).map(s => s.longitude);
      if (lats.length > 0) {
        map.fitBounds([
          [Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01],
          [Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01],
        ]);
      }
    }
  }, [sightings, showHeatmap, selectedSpeciesId, onSightingClick, liferMap]);

  function addHeatLayer(map: L.Map, data: Sighting[]) {
    const points = data
      .filter(s => s.latitude && s.longitude)
      .map(s => [s.latitude, s.longitude, 1.0] as [number, number, number]);

    // @ts-expect-error leaflet.heat
    const heat = L.heatLayer(points, {
      radius: 30,
      blur: 20,
      minOpacity: 0.5,
      max: 3,
      gradient: {
        0.2: "#059669",
        0.5: "#10b981",
        0.8: "#34d399",
        1.0: "#ecfdf5",
      },
    });
    heat.addTo(map);
    heatLayerRef.current = heat;
  }

  return (
    <>
      <style jsx global>{`
        .dark-tooltip {
          background-color: #111111 !important;
          border: 1px solid #2a2a2a !important;
          color: #ffffff !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          font-size: 13px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
        }
        .dark-tooltip::before {
          border-top-color: #2a2a2a !important;
        }
        .leaflet-tooltip-top::before {
          border-top-color: #2a2a2a !important;
        }
        .leaflet-tooltip-bottom::before {
          border-bottom-color: #2a2a2a !important;
        }
        .marker-cluster {
          background: transparent !important;
        }
        .marker-cluster div {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-weight: 600;
          font-size: 12px;
          color: #000;
        }
        .cluster-small {
          width: 36px;
          height: 36px;
          background: rgba(16, 185, 129, 0.8);
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
        }
        .cluster-medium {
          width: 42px;
          height: 42px;
          background: rgba(52, 211, 153, 0.8);
          box-shadow: 0 0 12px rgba(52, 211, 153, 0.4);
        }
        .cluster-large {
          width: 48px;
          height: 48px;
          background: rgba(167, 243, 208, 0.8);
          box-shadow: 0 0 16px rgba(167, 243, 208, 0.4);
        }
        .cluster-gold {
          width: 42px;
          height: 42px;
          background: rgba(245, 158, 11, 0.85);
          box-shadow: 0 0 14px rgba(245, 158, 11, 0.5);
        }
      `}</style>
      <div ref={containerRef} className="absolute inset-0 z-0" />
    </>
  );
}
