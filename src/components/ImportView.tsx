"use client";

import { useState, useCallback, useRef } from "react";
import { parseBirdLasserCSV, tripNameFromFilename } from "@/lib/csv-parser";
import { addSightings } from "@/lib/db";
import FloatingPanel from "./FloatingPanel";

interface ImportViewProps {
  onImportComplete: () => void;
}

export default function ImportView({ onImportComplete }: ImportViewProps) {
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const csvFiles = Array.from(files).filter(f => f.name.endsWith(".csv"));
    if (csvFiles.length === 0) {
      setStatus("No CSV files found. Please upload BirdLasser CSV exports.");
      return;
    }

    setImporting(true);
    setStatus(`Importing ${csvFiles.length} file${csvFiles.length > 1 ? "s" : ""}...`);

    let totalAdded = 0;
    let totalSkipped = 0;

    for (const file of csvFiles) {
      const text = await file.text();
      const tripName = tripNameFromFilename(file.name);
      const sightings = parseBirdLasserCSV(text, tripName);
      const { added, skipped } = await addSightings(sightings);
      totalAdded += added;
      totalSkipped += skipped;
    }

    setImporting(false);
    setStatus(`Imported ${totalAdded} sightings${totalSkipped > 0 ? ` (${totalSkipped} duplicates skipped)` : ""}`);

    // Short delay to show the result, then switch to map
    setTimeout(() => onImportComplete(), 800);
  }, [onImportComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return (
    <main className="w-screen h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="max-w-xl w-full px-6">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-white mb-2">BirdLasser Social</h1>
          <p className="text-[#888888]">Visualize and explore your BirdLasser sightings</p>
        </div>

        {/* Drop zone */}
        <FloatingPanel className="p-8">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-[#10b981] bg-[#10b981]/5"
                : "border-[#2a2a2a] hover:border-[#444444]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />

            <svg className="w-12 h-12 mx-auto mb-4 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>

            {importing ? (
              <p className="text-[#10b981] font-medium">{status}</p>
            ) : status ? (
              <p className="text-[#10b981] font-medium">{status}</p>
            ) : (
              <>
                <p className="text-white font-medium mb-1">
                  Drop BirdLasser CSV files here
                </p>
                <p className="text-sm text-[#888888]">
                  or click to browse — you can upload multiple trips at once
                </p>
              </>
            )}
          </div>
        </FloatingPanel>

        {/* Instructions */}
        <FloatingPanel className="mt-4 p-6">
          <h3 className="text-sm font-semibold text-white mb-3">How to export from BirdLasser</h3>
          <ol className="space-y-2.5 text-sm text-[#888888]">
            <li className="flex gap-3">
              <span className="text-[#10b981] font-semibold shrink-0">1.</span>
              <span>Open BirdLasser on your phone</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#10b981] font-semibold shrink-0">2.</span>
              <span>Go to <strong className="text-white">Trip Cards</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#10b981] font-semibold shrink-0">3.</span>
              <span>Click on the <strong className="text-white">...</strong> icon next to the trip card</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#10b981] font-semibold shrink-0">4.</span>
              <span>Select <strong className="text-white">Export CSV trip card</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#10b981] font-semibold shrink-0">5.</span>
              <span>Email it to yourself</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#10b981] font-semibold shrink-0">6.</span>
              <span>Download it on your computer</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#10b981] font-semibold shrink-0">7.</span>
              <span>Upload it here</span>
            </li>
          </ol>
          <p className="text-xs text-[#555555] mt-4">
            Tip: You can upload multiple at a time. Duplicate sightings will be ignored. All data is stored locally on your browser — if you clear browser data you will have to import again.
          </p>
        </FloatingPanel>
      </div>
    </main>
  );
}
