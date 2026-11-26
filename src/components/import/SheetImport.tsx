"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import readXlsxFile from "read-excel-file/browser";
import { AlertTriangle, Check, Upload } from "lucide-react";
import { Select } from "@/components/forms/FormFields";
import { importDonationSheet, type SheetImportResult } from "@/lib/actions/import-sheet";
import { groupDonors, parseWorkbook, type ParsedWorkbook, type RawSheet } from "@/lib/import/sheet";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
type Done = Extract<SheetImportResult, { ok: true }>;

export function SheetImport({ centers }: { centers: { id: string; name: string }[] }) {
  const [centerId, setCenterId] = useState(centers.length === 1 ? centers[0].id : "");
  const [filename, setFilename] = useState("");
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [check, setCheck] = useState<Done | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File) {
    setError(null);
    setParsed(null);
    setCheck(null);
    setDone(null);
    setFilename(file.name);
    if (!/\.xlsx$/i.test(file.name)) {
      setError("Choose an Excel file ending in .xlsx. If you have a .xls or .csv, open it in Excel and save it as .xlsx.");
      return;
    }
    try {
      const sheets = (await readXlsxFile(file)) as unknown as RawSheet[];
      const wb = parseWorkbook(sheets);
      if (wb.gifts.length === 0) {
        setError(wb.problems[0]?.message ?? "No gifts found. Each tab needs Date, Name and Amount columns.");
        return;
      }
      setParsed(wb);
    } catch {
      setError("That file couldn't be opened. Make sure it's an Excel .xlsx file and isn't password-protected.");
    }
  }

  function run(dryRun: boolean) {
    if (!parsed) return;
    setError(null);
    startTransition(async () => {
      const res = await importDonationSheet({ centerId, filename, gifts: parsed.gifts, dryRun });
      if (!res.ok) setError(res.error);
      else if (dryRun) setCheck(res);
      else setDone(res);
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-green-900 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Check className="h-5 w-5" /> Import complete
        </div>
        <p className="mt-2 text-sm">
          {done.giftsNew} {done.giftsNew === 1 ? "gift" : "gifts"} added ({money(done.total)}), {done.donorsNew} new{" "}
          {done.donorsNew === 1 ? "donor" : "donors"} created, {done.donorsMatched} matched to people already here.
          {done.giftsAlreadyLoaded > 0 && ` ${done.giftsAlreadyLoaded} were already loaded and left alone.`}
        </p>
        <div className="mt-4 flex gap-3 text-sm">
          <Link href="/reports/year-end" className="font-medium underline">
            See Year-End Giving
          </Link>
          <Link href="/donors" className="font-medium underline">
            See donors
          </Link>
        </div>
      </div>
    );
  }

  const donors = parsed ? groupDonors(parsed.gifts).length : 0;
  const total = parsed ? parsed.sheets.reduce((s, t) => s + t.total, 0) : 0;
  const mismatched = parsed?.sheets.filter((t) => t.statedTotal !== null && Math.abs(t.statedTotal - t.total) > 0.005) ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Center these gifts belong to</span>
          <Select
            value={centerId}
            onChange={(e) => {
              setCenterId(e.target.value);
              setCheck(null);
            }}
          >
            <option value="" disabled>
              Choose a center
            </option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Spreadsheet (.xlsx)</span>
          <span className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-2 text-sm hover:bg-muted">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{filename || "Choose a file"}</span>
            <input
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </span>
        </label>
      </div>

      {parsed && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Tab</th>
                  <th className="px-4 py-2.5 text-right font-medium">Gifts</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Matches the tab&rsquo;s own total?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsed.sheets.map((t) => {
                  const ok = t.statedTotal !== null && Math.abs(t.statedTotal - t.total) <= 0.005;
                  return (
                    <tr key={t.sheet}>
                      <td className="px-4 py-2 font-medium">{t.sheet}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{t.gifts}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(t.total)}</td>
                      <td className="px-4 py-2 text-xs">
                        {t.statedTotal === null ? (
                          <span className="text-muted-foreground">No totals row to compare</span>
                        ) : ok ? (
                          <span className="text-green-700 dark:text-green-400">Yes</span>
                        ) : (
                          <span className="font-medium text-red-700 dark:text-red-400">
                            No — the tab says {money(t.statedTotal)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border bg-muted/30 font-semibold">
                <tr>
                  <td className="px-4 py-2">All tabs</td>
                  <td className="px-4 py-2 text-right tabular-nums">{parsed.gifts.length}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(total)}</td>
                  <td className="px-4 py-2 text-xs font-normal text-muted-foreground">{donors} donors</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {mismatched.length > 0 && (
            <p className="text-sm text-red-700 dark:text-red-400">
              {mismatched.length === 1 ? "One tab doesn't" : `${mismatched.length} tabs don't`} add up to the total written
              in the file. Check the skipped rows below before importing.
            </p>
          )}

          {parsed.problems.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-950/40 dark:text-yellow-200">
              <div className="font-medium">
                {parsed.problems.length} {parsed.problems.length === 1 ? "row" : "rows"} will be skipped
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                {parsed.problems.slice(0, 20).map((p, i) => (
                  <li key={i}>
                    {p.sheet}, row {p.row}: {p.message}
                  </li>
                ))}
                {parsed.problems.length > 20 && <li>…and {parsed.problems.length - 20} more.</li>}
              </ul>
            </div>
          )}

          {check && (
            <div className="rounded-lg border border-border bg-card p-4 text-sm">
              <div className="font-medium">If you import now</div>
              <ul className="mt-1 space-y-0.5 text-sm">
                <li>
                  {check.giftsNew} {check.giftsNew === 1 ? "gift" : "gifts"} will be added ({money(check.total)})
                  {check.giftsAlreadyLoaded > 0 && `; ${check.giftsAlreadyLoaded} are already loaded and will be left alone`}
                </li>
                <li>
                  {check.donorsNew} new {check.donorsNew === 1 ? "donor" : "donors"} will be created; {check.donorsMatched}{" "}
                  will be matched to people already in this center
                </li>
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            {!check ? (
              <button
                type="button"
                disabled={pending || !centerId}
                onClick={() => run(true)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Checking…" : "Check against the CRM"}
              </button>
            ) : (
              <button
                type="button"
                disabled={pending || check.giftsNew === 0}
                onClick={() => run(false)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Importing…" : check.giftsNew === 0 ? "Nothing new to import" : `Import ${check.giftsNew} gifts`}
              </button>
            )}
            {!centerId && <span className="text-xs text-muted-foreground">Choose a center first.</span>}
          </div>
        </>
      )}
    </div>
  );
}
