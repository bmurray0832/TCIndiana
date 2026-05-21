"use client";

import Link from "next/link";
import { AlertBadge } from "@/components/AlertBadge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { INTEREST_TAILWIND, DONOR_STATUS_TAILWIND } from "@/lib/colors";
import type { PersonWithAlert } from "@/lib/queries";

type Variant = "donor" | "prospect";

const ALERT_OPTIONS = [
  { value: "RED", label: "Red" },
  { value: "ORANGE", label: "Orange" },
  { value: "YELLOW", label: "Yellow" },
  { value: "GREEN", label: "Green" },
];

const DONOR_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "LAPSED", label: "Lapsed" },
  { value: "MAJOR_DONOR", label: "Major donor" },
];

const INTEREST_OPTIONS = [
  { value: "HOT", label: "Hot" },
  { value: "WARM", label: "Warm" },
  { value: "COLD", label: "Cold" },
];

export function PeopleDataTable({
  people,
  variant,
  centerNames,
  filters,
  onFiltersChange,
}: {
  people: PersonWithAlert[];
  variant: Variant;
  centerNames: string[];
  filters?: Record<string, string>;
  onFiltersChange?: (filters: Record<string, string>) => void;
}) {
  const centerOptions = centerNames.map((n) => ({ value: n, label: n }));

  const columns: DataTableColumn<PersonWithAlert>[] = [
    {
      key: "name",
      header: "Name",
      accessor: (r) => `${r.firstName} ${r.lastName}`,
      sortable: true,
      cell: (r) => (
        <div>
          <Link href={`/people/${r.id}`} className="font-medium hover:text-primary">
            {r.firstName} {r.lastName}
          </Link>
          {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
        </div>
      ),
    },
    variant === "donor"
      ? {
          key: "donorStatus",
          header: "Status",
          accessor: (r) => r.donorStatus ?? "",
          sortable: true,
          filter: { kind: "select", options: DONOR_STATUS_OPTIONS },
          cell: (r) =>
            r.donorStatus ? (
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                  DONOR_STATUS_TAILWIND[r.donorStatus],
                )}
              >
                {r.donorStatus.replace("_", " ")}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            ),
        }
      : {
          key: "interestLevel",
          header: "Interest",
          accessor: (r) => r.interestLevel ?? "",
          sortable: true,
          filter: { kind: "select", options: INTEREST_OPTIONS },
          cell: (r) =>
            r.interestLevel ? (
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                  INTEREST_TAILWIND[r.interestLevel],
                )}
              >
                {r.interestLevel}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            ),
        },
    ...(variant === "donor"
      ? [
          {
            key: "lifetime",
            header: "Lifetime",
            accessor: (r: PersonWithAlert) => Number(r.lifetimeAmount),
            sortable: true,
            align: "right" as const,
            cell: (r: PersonWithAlert) => (
              <span className="tabular-nums">{formatCurrency(Number(r.lifetimeAmount))}</span>
            ),
          },
          {
            key: "yoy",
            header: "YoY",
            accessor: (r: PersonWithAlert) => Number(r.ytdAmount) - Number(r.lastYearAmount),
            sortable: true,
            align: "right" as const,
            cell: (r: PersonWithAlert) => {
              const yoy = Number(r.ytdAmount) - Number(r.lastYearAmount);
              return (
                <span
                  className={cn(
                    "tabular-nums text-xs",
                    yoy > 0 ? "text-green-600" : yoy < 0 ? "text-red-600" : "text-muted-foreground",
                  )}
                >
                  {yoy === 0 ? "—" : `${yoy > 0 ? "+" : ""}${formatCurrency(yoy)}`}
                </span>
              );
            },
          },
        ]
      : []),
    {
      key: "lastContact",
      header: "Last contact",
      accessor: (r) => r.lastContactAt,
      sortable: true,
      cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.lastContactAt)}</span>,
    },
    {
      key: "daysSince",
      header: "Days out",
      accessor: (r) => r.daysSinceContact ?? Number.MAX_SAFE_INTEGER,
      sortable: true,
      align: "right",
      cell: (r) => <span className="tabular-nums text-xs">{r.daysSinceContact ?? "—"}</span>,
    },
    {
      key: "alert",
      header: "Alert",
      accessor: (r) => r.alertColor,
      sortable: true,
      filter: { kind: "select", options: ALERT_OPTIONS },
      cell: (r) => <AlertBadge color={r.alertColor} />,
    },
    {
      key: "center",
      header: "Center",
      accessor: (r) => r.center.name,
      sortable: true,
      filter: { kind: "select", options: centerOptions },
      cell: (r) => <span className="text-xs text-muted-foreground">{r.center.name}</span>,
    },
  ];

  return (
    <DataTable
      rows={people}
      columns={columns}
      searchPlaceholder="Search by name or email…"
      defaultSort={
        variant === "donor"
          ? { key: "lifetime", direction: "desc" }
          : { key: "alert", direction: "desc" }
      }
      rowKey={(r) => r.id}
      emptyMessage={`No ${variant === "donor" ? "donors" : "prospects"} match your filters.`}
      filters={filters}
      onFiltersChange={onFiltersChange}
    />
  );
}
