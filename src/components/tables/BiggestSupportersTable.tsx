"use client";

import Link from "next/link";
import { AlertBadge } from "@/components/AlertBadge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PersonWithAlert } from "@/lib/queries";

const ALERT_OPTIONS = [
  { value: "GREEN", label: "Green" },
  { value: "YELLOW", label: "Yellow" },
  { value: "ORANGE", label: "Orange" },
  { value: "RED", label: "Red" },
];

export function BiggestSupportersTable({ top, centerNames }: { top: PersonWithAlert[]; centerNames: string[] }) {
  const centerOptions = centerNames.map((n) => ({ value: n, label: n }));

  const columns: DataTableColumn<PersonWithAlert>[] = [
    {
      key: "name",
      header: "Donor",
      accessor: (r) => `${r.firstName} ${r.lastName}`,
      sortable: true,
      cell: (r) => (
        <div>
          <Link href={`/people/${r.id}`} className="font-medium hover:text-primary">
            {r.firstName} {r.lastName}
          </Link>
          <div className="text-xs text-muted-foreground">{r.center.name}</div>
        </div>
      ),
    },
    {
      key: "lifetime",
      header: "Lifetime",
      accessor: (r) => Number(r.lifetimeAmount),
      sortable: true,
      align: "right",
      cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(Number(r.lifetimeAmount))}</span>,
    },
    {
      key: "ytd",
      header: "This year",
      accessor: (r) => Number(r.ytdAmount),
      sortable: true,
      align: "right",
      cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(Number(r.ytdAmount))}</span>,
    },
    {
      key: "lastDonation",
      header: "Last gift",
      accessor: (r) => r.lastDonationAt,
      sortable: true,
      cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.lastDonationAt)}</span>,
    },
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
      rows={top}
      columns={columns}
      searchPlaceholder="Search by donor…"
      defaultSort={{ key: "lifetime", direction: "desc" }}
      rowKey={(r) => r.id}
      emptyMessage="No donors match your filters."
    />
  );
}
