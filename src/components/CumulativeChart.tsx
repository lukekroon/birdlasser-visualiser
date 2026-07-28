"use client";

import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
import { ChartData, ComparisonChartData } from "@/data";
import FloatingPanel from "./FloatingPanel";

Chart.register(...registerables);

/** Year A keeps the app's existing green. Year B is blue rather than amber: the map's marker
 *  clusters already own amber, and green/amber is a poor pair for colour-blind viewers. */
const COLOUR_A = "#10b981";
const COLOUR_B = "#60a5fa";

const TOOLTIP_STYLE = {
  backgroundColor: "#111111",
  borderColor: "#2a2a2a",
  borderWidth: 1,
  titleColor: "#ffffff",
  bodyColor: "#888888",
  cornerRadius: 8,
  padding: 10,
};

interface CumulativeChartProps {
  data: ChartData;
  activeFilter: string;
  visible: boolean;
  onClose: () => void;
  /** When set, the panel switches to two-year overlay mode. */
  comparison?: ComparisonChartData;
}

export default function CumulativeChart({ data, activeFilter, visible, onClose, comparison }: CumulativeChartProps) {
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

    // --- Two-year comparison mode -----------------------------------------
    if (comparison) {
      const markerTime = new Date(comparison.pace.canonicalDate).getTime();
      const showMarker = comparison.pace.isPartial;

      // Vertical "today" line. Drawn by a local inline plugin rather than
      // chartjs-plugin-annotation — one small canvas op is not worth a dependency.
      const todayMarker = {
        id: "todayMarker",
        afterDatasetsDraw(chart: Chart) {
          if (!showMarker) return;
          const x = chart.scales.x?.getPixelForValue(markerTime);
          if (x === undefined || !Number.isFinite(x)) return;
          const { top, bottom } = chart.chartArea;
          const ctx = chart.ctx;
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = "#555555";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, top);
          ctx.lineTo(x, bottom);
          ctx.stroke();
          ctx.restore();
        },
      };

      // Past today, year B's curve continues where year A has no data yet. Dashing that tail
      // makes "this part of the year hasn't happened for A" obvious without a caption.
      const dashFuture = showMarker
        ? {
            segment: {
              borderDash: (ctx: { p1: { parsed: { x: number } } }) =>
                ctx.p1.parsed.x > markerTime ? [6, 4] : [],
            },
          }
        : {};

      lineChartRef.current = new Chart(lineCanvasRef.current, {
        type: "line",
        data: {
          datasets: [
            {
              label: `${comparison.yearA} (${comparison.totalA})`,
              data: comparison.cumulativeA.map((d) => ({ x: d.x, y: d.y })),
              borderColor: COLOUR_A,
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 2,
            },
            {
              label: `${comparison.yearB} (${comparison.totalB})`,
              data: comparison.cumulativeB.map((d) => ({ x: d.x, y: d.y })),
              borderColor: COLOUR_B,
              backgroundColor: "rgba(96, 165, 250, 0.06)",
              fill: false,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 2,
              ...dashFuture,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            // Two series now, so the legend has to earn its place back.
            legend: {
              display: true,
              position: "top",
              align: "end",
              labels: { color: "#888888", boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } },
            },
            tooltip: {
              ...TOOLTIP_STYLE,
              callbacks: {
                // The x values live in a synthetic year, so only day and month are meaningful.
                title: (items) =>
                  items.length
                    ? new Date((items[0].raw as { x: string }).x).toLocaleDateString("en", {
                        day: "numeric",
                        month: "short",
                      })
                    : "",
                label: (item) => `${item.dataset.label?.split(" ")[0]}: ${(item.raw as { y: number }).y} species`,
              },
            },
          },
          scales: {
            x: {
              type: "time",
              time: { unit: "month", displayFormats: { month: "MMM" } },
              ticks: { color: "#888888", maxTicksLimit: 12, font: { size: 11 } },
              grid: { color: "#1a1a1a" },
            },
            y: {
              ticks: { color: "#888888", font: { size: 11 } },
              grid: { color: "#1a1a1a" },
              beginAtZero: true,
            },
          },
        },
        plugins: [todayMarker],
      });

      barChartRef.current = new Chart(barCanvasRef.current, {
        type: "bar",
        data: {
          labels: comparison.monthLabels,
          datasets: [
            {
              label: comparison.yearA,
              data: comparison.barsA,
              backgroundColor: "rgba(16, 185, 129, 0.55)",
              borderColor: COLOUR_A,
              borderWidth: 1,
              borderRadius: 3,
            },
            {
              label: comparison.yearB,
              data: comparison.barsB,
              backgroundColor: "rgba(96, 165, 250, 0.45)",
              borderColor: COLOUR_B,
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
            tooltip: { ...TOOLTIP_STYLE, callbacks: { label: (item) => `${item.dataset.label}: ${item.raw} new` } },
          },
          scales: {
            // Grouped, never stacked: the two years share most of their species, so a stacked
            // bar would read as a total that double-counts.
            x: { stacked: false, ticks: { color: "#888888", font: { size: 11 } }, grid: { color: "#1a1a1a" } },
            y: { stacked: false, ticks: { color: "#888888", font: { size: 11 } }, grid: { color: "#1a1a1a" }, beginAtZero: true },
          },
        },
      });

      return () => {
        lineChartRef.current?.destroy();
        lineChartRef.current = null;
        barChartRef.current?.destroy();
        barChartRef.current = null;
      };
    }

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
  }, [visible, data, activeFilter, comparison]);

  if (!visible) return null;

  const isYearMode = activeFilter !== "all";

  return (
    <FloatingPanel className="absolute bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-[600px] z-20 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">
          {comparison ? (
            <>
              <span style={{ color: COLOUR_A }}>{comparison.yearA}</span>
              <span className="text-[#555555]"> vs </span>
              <span style={{ color: COLOUR_B }}>{comparison.yearB}</span>
              {comparison.pace.isPartial && (
                <span className="ml-2 font-normal text-xs text-[#888888]">
                  {comparison.pace.countA} vs {comparison.pace.countB} at today&apos;s date
                </span>
              )}
            </>
          ) : isYearMode ? (
            `${activeFilter} Year List`
          ) : (
            "Life List Growth"
          )}
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
          {comparison || isYearMode ? "New birds per month" : "Lifers per year"}
        </span>
        <div className="flex-1 h-px bg-[#2a2a2a]" />
        {comparison && (
          <span className="flex items-center gap-3 text-xs text-[#888888] whitespace-nowrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOUR_A }} />
              {comparison.yearA}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOUR_B }} />
              {comparison.yearB}
            </span>
          </span>
        )}
      </div>
      <div className="h-28 md:h-36">
        <canvas ref={barCanvasRef} />
      </div>
    </FloatingPanel>
  );
}
