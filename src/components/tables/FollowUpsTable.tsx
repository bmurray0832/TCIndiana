"use client";

import Link from "next/link";
import { AlertBadge } from "@/components/AlertBadge";
import { FollowUpRowActions } from "@/components/FollowUpRowActions";
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

const dialable = (phone: string) => phone.replace(/[^+\d]/g, "");

export function FollowUpsTable({
  people,
  centerNames,
  campaignsByCenter,
  filters,
  onFiltersChange,
}: {
  people: PersonWithAlert[];
  centerNames: string[];
  /** Active campaigns the current user can attribute donations to,
   *  keyed by `centerId`. `"_org"` holds org-wide (centerId=null) campaigns. */
  campaignsByCenter: Record<string, { id: string; name: string }[]>;
  filters?: Record<string, string>;
  onFiltersChange?: (filters: Record<string, string>) => void;
}) {
  const centerOptions = centerNames.map((n) => ({ value: n, label: n }));

  const campaignsFor = (person: PersonWithAlert) => [
    ...(campaignsByCenter["_org"] ?? []),
    ...(campaignsByCenter[person.centerId] ?? []),
  ];

  const columns: DataTableColumn<PersonWithAlert>[] = [
    {
      key: "name",
      header: "Name",
      accessor: (r) => `${r.firstName} ${r.lastName}`,
      sortable: true,
      cell: (r) => (
        <Link
          href={`/people/${r.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-medium hover:text-primary"
        >
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
      cell: (r) => <FollowUpRowActions person={r} campaigns={campaignsFor(r)} />,
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
      filters={filters}
      onFiltersChange={onFiltersChange}
      expandedContent={(r) => <PersonCard person={r} />}
    />
  );
}

function PersonCard({ person }: { person: PersonWithAlert }) {
  const phone = person.phone?.trim();
  const email = person.email?.trim();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Phone">
        {phone ? (
          <div className="flex items-center gap-2">
            <a href={`tel:${dialable(phone)}`} className="font-medium text-primary hover:underline">
              {phone}
            </a>
            <a
              href={`sms:${dialable(phone)}`}
              className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-muted"
            >
              Text
            </a>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </Field>
      <Field label="Email">
        {email ? (
          <a href={`mailto:${email}`} className="font-medium text-primary hover:underline">
            {email}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </Field>
      <Field label="Preferred">
        <span>{person.preferredContact?.replace(/_/g, "-").toLowerCase() ?? "—"}</span>
      </Field>
      <div className="sm:col-span-3">
        <Field label="Notes">
          {person.notes ? (
            <p className="whitespace-pre-wrap text-sm">{person.notes}</p>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Field>
      </div>
      <div className="sm:col-span-3 text-xs text-muted-foreground">
        Open the full card →{" "}
        <Link
          href={`/people/${person.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-primary hover:underline"
        >
          {person.firstName} {person.lastName}
        </Link>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
