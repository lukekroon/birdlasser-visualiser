"use client";

import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
import FloatingPanel from "./FloatingPanel";

Chart.register(...registerables);

interface CumulativeChartProps {
  data: { date: string; count: number }[];
  visible: boolean;
  onClose: () => void;
}

export default function CumulativeChart({ data, visible, onClose }: CumulativeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<Chart<any> | null>(null);

  useEffect(() => {
    if (!visible || !canvasRef.current || data.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Convert "2026/03/07" → "2026-03-07" for proper date parsing
    const points = data.map((d) => ({
      x: d.date.replace(/\//g, "-"),
      y: d.count,
    }));

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        datasets: [
          {
            label: "Life List",
            data: points,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 1,
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
                if (items.length > 0) {
                  const raw = items[0].raw as { x: string; y: number };
                  return raw.x;
                }
                return "";
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
              unit: "month",
              displayFormats: {
                month: "MMM yyyy",
              },
              tooltipFormat: "dd MMM yyyy",
            },
            ticks: { color: "#888888", maxTicksLimit: 8, font: { size: 11 } },
            grid: { color: "#1a1a1a" },
          },
          y: {
            display: true,
            ticks: { color: "#888888", font: { size: 11 } },
            grid: { color: "#1a1a1a" },
            beginAtZero: true,
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [visible, data]);

  if (!visible) return null;

  return (
    <FloatingPanel className="absolute bottom-20 right-4 z-20 w-96 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Life List Growth</h3>
        <button
          onClick={onClose}
          className="text-[#888888] hover:text-white text-lg leading-none"
        >
          &times;
        </button>
      </div>
      <div className="h-48">
        <canvas ref={canvasRef} />
      </div>
    </FloatingPanel>
  );
}
