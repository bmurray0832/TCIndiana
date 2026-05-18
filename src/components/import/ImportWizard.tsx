"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import Link from "next/link";
import { Upload, Check, AlertTriangle } from "lucide-react";
import { autoMap } from "@/lib/import/auto-map";
import { TARGET_FIELDS, type ImportKindLower, type Mapping, type ImportResult } from "@/lib/import/types";
import { processImport } from "@/lib/actions/import";
import { Select } from "@/components/forms/FormFields";

type Step = "upload" | "map" | "preview" | "done";

export function ImportWizard({
  kind,
  centers,
}: {
  kind: ImportKindLower;
  centers: { id: string; name: string }[];
}) {
  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [centerId, setCenterId] = useState<string>(centers[0]?.id ?? "");
  const [dryRunResult, setDryRunResult] = useState<ImportResult | null>(null);
  const [finalResult, setFinalResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const targets = TARGET_FIELDS[kind];
  const requiredMissing = useMemo(
    () => targets.filter((t) => t.required && !mapping[t.key]),
    [targets, mapping],
  );

  function onFile(file: File) {
    setError(null);
    setFilename(file.name);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const data = results.data.filter((r) => r && Object.keys(r).length > 0);
        const hdrs = results.meta.fields ?? [];
        setHeaders(hdrs);
        setRows(data);
        setMapping(autoMap(hdrs, kind));
        setStep("map");
      },
      error: (err) => setError(err.message),
    });
  }

  function runDryRun() {
    setError(null);
    startTransition(async () => {
      const res = await processImport({
        kind,
        filename,
        centerId: kind === "constituents" ? centerId : null,
        mapping,
        rows,
        dryRun: true,
      });
      if (!res.ok) setError(res.error);
      else {
        setDryRunResult(res);
        setStep("preview");
      }
    });
  }

  function commit() {
    setError(null);
    startTransition(async () => {
      const res = await processImport({
        kind,
        filename,
        centerId: kind === "constituents" ? centerId : null,
        mapping,
        rows,
        dryRun: false,
      });
      if (!res.ok) setError(res.error);
      else {
        setFinalResult(res);
        setStep("done");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Stepper step={step} />
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {step === "upload" && <UploadStep onFile={onFile} />}

      {step === "map" && (
        <MapStep
          kind={kind}
          headers={headers}
          mapping={mapping}
          onChange={setMapping}
          rowCount={rows.length}
          centers={centers}
          centerId={centerId}
          setCenterId={setCenterId}
          onBack={() => setStep("upload")}
          onNext={runDryRun}
          requiredMissing={requiredMissing}
          pending={pending}
        />
      )}

      {step === "preview" && dryRunResult && dryRunResult.ok && (
        <PreviewStep
          result={dryRunResult}
          onBack={() => setStep("map")}
          onCommit={commit}
          pending={pending}
        />
      )}

      {step === "done" && finalResult && finalResult.ok && (
        <DoneStep result={finalResult} kind={kind} />
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "1. Upload CSV" },
    { id: "map", label: "2. Map columns" },
    { id: "preview", label: "3. Dry-run preview" },
    { id: "done", label: "4. Done" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2">
          <span
            className={
              "inline-flex h-6 w-6 items-center justify-center rounded-full border " +
              (i < idx
                ? "border-primary bg-primary text-primary-foreground"
                : i === idx
                ? "border-primary text-primary"
                : "border-border text-muted-foreground")
            }
          >
            {i < idx ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <span className={i <= idx ? "font-medium" : "text-muted-foreground"}>{s.label.replace(/^\d+\.\s/, "")}</span>
          {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
        </li>
      ))}
    </ol>
  );
}

function UploadStep({ onFile }: { onFile: (f: File) => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
      <h2 className="mt-3 text-sm font-medium">Drop a CSV here, or click to choose</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Tip: export from Bloomerang &rarr; Reports &rarr; Standard Reports. CSV files only.
      </p>
      <label className="mt-4 inline-block cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
        Choose file
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
    </div>
  );
}

function MapStep({
  kind,
  headers,
  mapping,
  onChange,
  rowCount,
  centers,
  centerId,
  setCenterId,
  onBack,
  onNext,
  requiredMissing,
  pending,
}: {
  kind: ImportKindLower;
  headers: string[];
  mapping: Mapping;
  onChange: (m: Mapping) => void;
  rowCount: number;
  centers: { id: string; name: string }[];
  centerId: string;
  setCenterId: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  requiredMissing: { key: string; label: string }[];
  pending: boolean;
}) {
  const targets = TARGET_FIELDS[kind];
  const canProceed = requiredMissing.length === 0 && (kind !== "constituents" || !!centerId);
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-card p-3 text-sm">
        <strong>{rowCount}</strong> rows detected · {headers.length} columns
      </div>

      {kind === "constituents" && (
        <div className="rounded-md border border-border bg-card p-3">
          <label className="mb-1 block text-xs font-medium">Center for these people</label>
          <Select value={centerId} onChange={(e) => setCenterId(e.target.value)}>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Bloomerang doesn&apos;t track multiple centers — all rows in this file will be assigned to the
            center you pick here. You can re-assign individuals afterwards.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Target field</th>
              <th className="px-4 py-2.5 font-medium">CSV column</th>
              <th className="px-4 py-2.5 font-medium">Sample</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {targets.map((t) => (
              <tr key={t.key} className={t.required && !mapping[t.key] ? "bg-red-50/40 dark:bg-red-950/20" : undefined}>
                <td className="px-4 py-2 align-top">
                  <div className="text-sm font-medium">
                    {t.label}
                    {t.required && <span className="ml-1 text-red-500">*</span>}
                  </div>
                  {t.hint && <div className="mt-0.5 text-xs text-muted-foreground">{t.hint}</div>}
                </td>
                <td className="px-4 py-2 align-top">
                  <Select
                    value={mapping[t.key] ?? ""}
                    onChange={(e) => onChange({ ...mapping, [t.key]: e.target.value || null })}
                  >
                    <option value="">— skip —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-2 align-top text-xs text-muted-foreground">
                  {mapping[t.key] ? <SampleValue mapping={mapping[t.key]!} rowCount={rowCount} /> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {requiredMissing.length > 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-900/40 dark:bg-yellow-950/40 dark:text-yellow-200">
          Required field{requiredMissing.length > 1 ? "s" : ""} not mapped: {requiredMissing.map((r) => r.label).join(", ")}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed || pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Running dry-run…" : "Run dry-run"}
        </button>
      </div>
    </div>
  );
}

function SampleValue({ mapping, rowCount }: { mapping: string; rowCount: number }) {
  // Sample isn't needed for now — wired up later. Just confirms a mapping exists.
  return <span>column &ldquo;{mapping}&rdquo; · {rowCount} rows</span>;
}

function PreviewStep({
  result,
  onBack,
  onCommit,
  pending,
}: {
  result: Extract<ImportResult, { ok: true }>;
  onBack: () => void;
  onCommit: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Will create" value={result.created} tone="good" />
        <Stat label="Will update" value={result.updated} />
        <Stat label="Will skip" value={result.skipped} tone={result.skipped > 0 ? "warning" : "default"} />
        <Stat label="Errors" value={result.errors.length} tone={result.errors.length > 0 ? "danger" : "default"} />
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-2">
            <h3 className="text-sm font-semibold">Skipped rows ({result.errors.length})</h3>
          </header>
          <ul className="divide-y divide-border">
            {result.errors.slice(0, 20).map((err, i) => (
              <li key={i} className="px-4 py-2 text-xs">
                <span className="text-muted-foreground">Row {err.rowIndex + 1}{err.bloomerangId ? ` · ID ${err.bloomerangId}` : ""}:</span>{" "}
                {err.message}
              </li>
            ))}
            {result.errors.length > 20 && (
              <li className="px-4 py-2 text-xs text-muted-foreground">
                …and {result.errors.length - 20} more.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onCommit}
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Importing…" : `Commit ${result.created + result.updated} rows`}
        </button>
      </div>
    </div>
  );
}

function DoneStep({
  result,
  kind,
}: {
  result: Extract<ImportResult, { ok: true }>;
  kind: ImportKindLower;
}) {
  const target = kind === "constituents" ? "/donors" : kind === "transactions" ? "/donations" : "/contacts";
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200">
        <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div>
          <div className="font-medium">Import complete.</div>
          <div className="mt-1 text-xs">
            {result.created} created · {result.updated} updated · {result.skipped} skipped
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Link
          href={target}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          View imported records
        </Link>
        <Link
          href="/import"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Back to imports
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  const TONE: Record<typeof tone, string> = {
    default: "border-l-transparent",
    good: "border-l-green-600",
    warning: "border-l-yellow-500",
    danger: "border-l-red-500",
  };
  return (
    <div className={`rounded-lg border border-border bg-card p-4 border-l-4 ${TONE[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}
