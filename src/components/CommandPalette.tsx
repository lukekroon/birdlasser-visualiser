"use client";

import { useEffect, useState, useRef } from "react";
import { Species } from "@/data/types";

interface CommandPaletteProps {
  species: Species[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSpecies: (speciesId: number) => void;
  onToggleHeatmap: () => void;
  onToggleChart: () => void;
  onClearFilters: () => void;
  onClearData?: () => void;
  onImportMore?: () => void;
}

export default function CommandPalette({
  species,
  open,
  onOpenChange,
  onSelectSpecies,
  onToggleHeatmap,
  onToggleChart,
  onClearFilters,
  onClearData,
  onImportMore,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
        setQuery("");
      }
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      // Focus after a microtask to ensure DOM is ready
      Promise.resolve().then(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const filtered = query.length > 0
    ? species.filter(
        (s) =>
          s.commonName.toLowerCase().includes(query.toLowerCase()) ||
          s.scientificName.toLowerCase().includes(query.toLowerCase()) ||
          s.primaryName.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const actions = [
    { label: "Toggle heatmap", action: onToggleHeatmap },
    { label: "Toggle life list chart", action: onToggleChart },
    { label: "Clear all filters", action: onClearFilters },
    ...(onImportMore ? [{ label: "Import more trips", action: onImportMore }] : []),
    ...(onClearData ? [{ label: "Clear all data", action: onClearData }] : []),
  ];

  const showActions = query.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-[#111111] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center px-4 border-b border-[#2a2a2a]">
          <svg className="w-4 h-4 text-[#888888] mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search species or type a command..."
            className="w-full py-3.5 bg-transparent text-white text-sm outline-none placeholder-[#888888]"
          />
          <kbd className="text-xs text-[#888888] bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-0.5 ml-2">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {showActions && (
            <div className="p-2">
              <div className="px-3 py-1.5 text-xs text-[#888888] uppercase tracking-wider">
                Actions
              </div>
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => { a.action(); onOpenChange(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-white hover:bg-[#1a1a1a] transition-colors"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1.5 text-xs text-[#888888] uppercase tracking-wider">
                Species
              </div>
              {filtered.slice(0, 20).map((sp) => (
                <button
                  key={sp.speciesId}
                  onClick={() => {
                    onSelectSpecies(sp.speciesId);
                    onOpenChange(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors"
                >
                  <span className="text-sm text-white">{sp.commonName}</span>
                  <span className="text-xs text-[#888888] ml-2 italic">{sp.scientificName}</span>
                </button>
              ))}
            </div>
          )}

          {query.length > 0 && filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-[#888888]">
              No species found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
