"use client";

import { useMemo, useState } from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  /** Returns a comparable value for sorting and a string-coercible value
   *  for searching/filtering. Pass null for non-sortable/searchable cells
   *  (e.g. an action button column). */
  accessor: (row: T) => string | number | boolean | Date | null | undefined;
  /** Custom cell renderer. Defaults to printing the accessor value. */
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  /** When set, an inline dropdown filter is rendered above the column. */
  filter?: { kind: "select"; options: { value: string; label: string }[] };
  align?: "left" | "right";
  className?: string;
  /** Hide from sort/filter UI but still render. */
  headerClassName?: string;
};

type Props<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  /** Which columns to include in the global search. Defaults to all. */
  searchKeys?: string[];
  searchPlaceholder?: string;
  defaultSort?: { key: string; direction: SortDirection };
  emptyMessage?: string;
  rowKey: (row: T) => string;
};

function compare(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function DataTable<T>({
  rows,
  columns,
  searchKeys,
  searchPlaceholder = "Search…",
  defaultSort,
  emptyMessage = "No rows.",
  rowKey,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(defaultSort ?? null);

  const searchSet = searchKeys ?? columns.map((c) => c.key);
  const filterableCols = columns.filter((c) => c.filter?.kind === "select");
  const hasFilters = filterableCols.length > 0 || query !== "" || Object.keys(filters).some((k) => filters[k]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (q) {
        const haystack = searchSet
          .map((key) => {
            const col = columns.find((c) => c.key === key);
            if (!col) return "";
            const v = col.accessor(row);
            return v === null || v === undefined ? "" : String(v).toLowerCase();
          })
          .join(" ");
        if (!haystack.includes(q)) return false;
      }
      for (const [k, v] of Object.entries(filters)) {
        if (!v) continue;
        const col = columns.find((c) => c.key === k);
        if (!col) continue;
        const cellValue = col.accessor(row);
        if (cellValue === null || cellValue === undefined) return false;
        if (String(cellValue) !== v) return false;
      }
      return true;
    });
  }, [rows, query, filters, searchSet, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => sign * compare(col.accessor(a), col.accessor(b)));
  }, [filtered, sort, columns]);

  function toggleSort(key: string, sortable: boolean) {
    if (!sortable) return;
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  function clear() {
    setQuery("");
    setFilters({});
  }

  return (
    <div>
      {(searchKeys === undefined || searchKeys.length > 0 || filterableCols.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          {filterableCols.map((c) => (
            <select
              key={c.key}
              value={filters[c.key] ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, [c.key]: e.target.value }))}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">{c.header}: any</option>
              {c.filter && c.filter.kind === "select" &&
                c.filter.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </select>
          ))}
          {hasFilters && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
          <div className="ml-auto text-xs text-muted-foreground tabular-nums">
            {sorted.length} of {rows.length}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {columns.map((c) => {
                  const isActive = sort?.key === c.key;
                  const sortable = c.sortable !== false && c.accessor != null;
                  return (
                    <th
                      key={c.key}
                      className={cn(
                        "px-4 py-2.5 font-medium",
                        c.align === "right" && "text-right",
                        c.headerClassName,
                      )}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key, true)}
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-foreground",
                            isActive && "text-foreground",
                          )}
                        >
                          {c.header}
                          {!isActive && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                          {isActive && sort?.direction === "asc" && <ArrowUp className="h-3 w-3" />}
                          {isActive && sort?.direction === "desc" && <ArrowDown className="h-3 w-3" />}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={rowKey(row)} className="hover:bg-muted/30">
                    {columns.map((c) => {
                      const v = c.accessor(row);
                      return (
                        <td
                          key={c.key}
                          className={cn("px-4 py-2", c.align === "right" && "text-right", c.className)}
                        >
                          {c.cell ? c.cell(row) : v === null || v === undefined ? "—" : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
