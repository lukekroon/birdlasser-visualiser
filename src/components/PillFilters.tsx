"use client";

interface PillFiltersProps {
  filters: { label: string; value: string }[];
  activeFilter: string;
  onFilterChange: (value: string) => void;
}

export default function PillFilters({ filters, activeFilter, onFilterChange }: PillFiltersProps) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onFilterChange(f.value)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            activeFilter === f.value
              ? "bg-[#10b981] text-black"
              : "bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a] hover:text-white hover:border-[#444444]"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
