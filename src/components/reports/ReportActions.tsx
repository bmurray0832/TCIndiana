"use client";

import { Download, Printer } from "lucide-react";
import { toCsv, type CsvRow } from "@/lib/csv";

/** Standard report toolbar: CSV download + print. Server pages pass the
 *  already-computed table rows; the CSV is assembled in the browser so
 *  no extra route or query is needed. */
export function ReportActions({ rows, filename }: { rows: CsvRow[]; filename: string }) {
  function download() {
    const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted print:hidden";

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={download} disabled={rows.length === 0} className={`${btn} disabled:opacity-50`}>
        <Download className="h-3.5 w-3.5" />
        CSV
      </button>
      <button type="button" onClick={() => window.print()} className={`hidden md:inline-flex ${btn}`}>
        <Printer className="h-3.5 w-3.5" />
        Print
      </button>
    </div>
  );
}
