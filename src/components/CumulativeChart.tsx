"use client";

import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
import { ChartData } from "@/data";
import FloatingPanel from "./FloatingPanel";

Chart.register(...registerables);

interface CumulativeChartProps {
  data: ChartData;
  activeFilter: string;
  visible: boolean;
  onClose: () => void;
}

export default function CumulativeChart({ data, activeFilter, visible, onClose }: CumulativeChartProps) {
  const lineCanvasRef = useRef<HTMLCanvasElement>(null);
  const barCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineChartRef = useRef<Chart<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const barChartRef = useRef<Chart<any> | null>(null);

  useEffect(() => {
    if (!visible || !lineCanvasRef.current || !barCanvasRef.current) return;

    lineChartRef.current?.destroy();
    barChartRef.current?.destroy();

    if (data.cumulative.length === 0) return;

    const isYearMode = activeFilter !== "all";

    // --- Cumulative line chart ---
    const linePoints = data.cumulative.map((d) => ({
      x: d.date.replace(/\//g, "-"),
      y: d.count,
    }));

    lineChartRef.current = new Chart(lineCanvasRef.current, {
      type: "line",
      data: {
        datasets: [
          {
            label: isYearMode ? `${activeFilter} Year List` : "Life List",
            data: linePoints,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBackgroundColor: "#10b981",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#111111",
            borderColor: "#2a2a2a",
            borderWidth: 1,
            titleColor: "#ffffff",
            bodyColor: "#888888",
            cornerRadius: 8,
            padding: 10,
            callbacks: {
              title: (items) => {
                if (!items.length) return "";
                const raw = items[0].raw as { x: string; y: number };
                return raw.x;
              },
              label: (item) => {
                const raw = item.raw as { x: string; y: number };
                return `${raw.y} species`;
              },
            },
          },
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit: isYearMode ? "month" : "year",
              displayFormats: { month: "MMM", year: "yyyy" },
              tooltipFormat: "dd MMM yyyy",
            },
            ticks: { color: "#888888", maxTicksLimit: isYearMode ? 12 : 8, font: { size: 11 } },
            grid: { color: "#1a1a1a" },
          },
          y: {
            ticks: { color: "#888888", font: { size: 11 } },
            grid: { color: "#1a1a1a" },
            beginAtZero: !isYearMode,
          },
        },
      },
    });

    // --- Bar chart ---
    if (data.bars.length > 0) {
      barChartRef.current = new Chart(barCanvasRef.current, {
        type: "bar",
        data: {
          labels: data.bars.map((b) => b.label),
          datasets: [
            {
              label: isYearMode ? "New birds" : "Lifers",
              data: data.bars.map((b) => b.count),
              backgroundColor: "rgba(16, 185, 129, 0.55)",
              borderColor: "#10b981",
              borderWidth: 1,
              borderRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#111111",
              borderColor: "#2a2a2a",
              borderWidth: 1,
              titleColor: "#ffffff",
              bodyColor: "#888888",
              cornerRadius: 8,
              padding: 10,
              callbacks: {
                label: (item) => `${item.raw} new species`,
              },
            },
          },
          scales: {
            x: {
              ticks: { color: "#888888", font: { size: 11 } },
              grid: { color: "#1a1a1a" },
            },
            y: {
              ticks: { color: "#888888", font: { size: 11 } },
              grid: { color: "#1a1a1a" },
              beginAtZero: true,
            },
          },
        },
      });
    }

    return () => {
      lineChartRef.current?.destroy();
      lineChartRef.current = null;
      barChartRef.current?.destroy();
      barChartRef.current = null;
    };
  }, [visible, data, activeFilter]);

  if (!visible) return null;

  const isYearMode = activeFilter !== "all";

  return (
    <FloatingPanel className="absolute bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-[600px] z-20 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">
          {isYearMode ? `${activeFilter} Year List` : "Life List Growth"}
        </h3>
        <button onClick={onClose} className="text-[#888888] hover:text-white text-lg leading-none">
          &times;
        </button>
      </div>

      {/* Cumulative line */}
      <div className="h-36 md:h-48">
        <canvas ref={lineCanvasRef} />
      </div>

      {/* Bar section */}
      <div className="flex items-center gap-2 mt-4 mb-2">
        <span className="text-xs text-[#888888] whitespace-nowrap">
          {isYearMode ? "New birds per month" : "Lifers per year"}
        </span>
        <div className="flex-1 h-px bg-[#2a2a2a]" />
      </div>
      <div className="h-28 md:h-36">
        <canvas ref={barCanvasRef} />
      </div>
    </FloatingPanel>
  );
}
