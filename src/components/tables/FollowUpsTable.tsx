"use client";

import Link from "next/link";
import { AlertBadge } from "@/components/AlertBadge";
import { SnoozeMenu } from "@/components/SnoozeMenu";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PersonWithAlert } from "@/lib/queries";

const ALERT_OPTIONS = [
  { value: "RED", label: "Red" },
  { value: "ORANGE", label: "Orange" },
  { value: "YELLOW", label: "Yellow" },
];

const TYPE_OPTIONS = [
  { value: "Donor", label: "Donor" },
  { value: "Prospect", label: "Prospect" },
];

export function FollowUpsTable({ people, centerNames }: { people: PersonWithAlert[]; centerNames: string[] }) {
  const centerOptions = centerNames.map((n) => ({ value: n, label: n }));

  const columns: DataTableColumn<PersonWithAlert>[] = [
    {
      key: "name",
      header: "Name",
      accessor: (r) => `${r.firstName} ${r.lastName}`,
      sortable: true,
      cell: (r) => (
        <Link href={`/people/${r.id}`} className="font-medium hover:text-primary">
          {r.firstName} {r.lastName}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      accessor: (r) => (r.convertedToDonorAt ? "Donor" : "Prospect"),
      sortable: true,
      filter: { kind: "select", options: TYPE_OPTIONS },
      cell: (r) => <span className="text-xs">{r.convertedToDonorAt ? "Donor" : "Prospect"}</span>,
    },
    {
      key: "lastContact",
      header: "Last contact",
      accessor: (r) => r.lastContactAt,
      sortable: true,
      cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.lastContactAt)}</span>,
    },
    {
      key: "daysOut",
      header: "Days out",
      accessor: (r) => r.daysSinceContact ?? Number.MAX_SAFE_INTEGER,
      sortable: true,
      align: "right",
      cell: (r) => <span className="tabular-nums text-xs">{r.daysSinceContact ?? "—"}</span>,
    },
    {
      key: "lifetime",
      header: "Lifetime",
      accessor: (r) => Number(r.lifetimeAmount),
      sortable: true,
      align: "right",
      cell: (r) =>
        r.convertedToDonorAt ? (
          <span className="tabular-nums">{formatCurrency(Number(r.lifetimeAmount))}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
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
    {
      key: "actions",
      header: "",
      accessor: () => null,
      sortable: false,
      align: "right",
      cell: (r) => <SnoozeMenu personId={r.id} snoozedUntil={r.snoozedUntil} />,
    },
  ];

  return (
    <DataTable
      rows={people}
      columns={columns}
      searchPlaceholder="Search by name…"
      defaultSort={{ key: "alert", direction: "desc" }}
      rowKey={(r) => r.id}
      emptyMessage="Empty queue — everybody is current. 🎉"
    />
  );
}
