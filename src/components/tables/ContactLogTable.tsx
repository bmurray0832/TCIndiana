"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { formatDate } from "@/lib/utils";

export type ContactRow = {
  id: string;
  date: Date;
  contactType: string;
  outcome: string;
  notes: string | null;
  person: { id: string; firstName: string; lastName: string };
  staff: { name: string } | null;
};

const TYPE_OPTIONS = [
  { value: "PHONE_CALL", label: "Phone call" },
  { value: "EMAIL", label: "Email" },
  { value: "IN_PERSON_MEETING", label: "In-person meeting" },
  { value: "EVENT", label: "Event" },
  { value: "MAIL", label: "Mail" },
  { value: "TEXT_MESSAGE", label: "Text" },
  { value: "ONLINE", label: "Online" },
];

const OUTCOME_OPTIONS = [
  { value: "MADE_DONATION", label: "Made donation" },
  { value: "SCHEDULED_FOLLOW_UP", label: "Scheduled follow-up" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "LEFT_MESSAGE", label: "Left message" },
  { value: "INFORMATION_SENT", label: "Information sent" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "OTHER", label: "Other" },
];

export function ContactLogTable({
  contacts,
  filters,
  onFiltersChange,
}: {
  contacts: ContactRow[];
  filters?: Record<string, string>;
  onFiltersChange?: (filters: Record<string, string>) => void;
}) {
  const columns: DataTableColumn<ContactRow>[] = [
    {
      key: "date",
      header: "Date",
      accessor: (r) => r.date,
      sortable: true,
      cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.date)}</span>,
    },
    {
      key: "person",
      header: "Person",
      accessor: (r) => `${r.person.firstName} ${r.person.lastName}`,
      sortable: true,
      cell: (r) => (
        <Link href={`/people/${r.person.id}`} className="font-medium hover:text-primary">
          {r.person.firstName} {r.person.lastName}
        </Link>
      ),
    },
    {
      key: "contactType",
      header: "Type",
      accessor: (r) => r.contactType,
      sortable: true,
      filter: { kind: "select", options: TYPE_OPTIONS },
      cell: (r) => <span className="text-xs">{r.contactType.replace(/_/g, " ").toLowerCase()}</span>,
    },
    {
      key: "outcome",
      header: "Outcome",
      accessor: (r) => r.outcome,
      sortable: true,
      filter: { kind: "select", options: OUTCOME_OPTIONS },
      cell: (r) => <span className="text-xs">{r.outcome.replace(/_/g, " ").toLowerCase()}</span>,
    },
    {
      key: "staff",
      header: "Staff",
      accessor: (r) => r.staff?.name ?? "",
      sortable: true,
      cell: (r) => <span className="text-xs text-muted-foreground">{r.staff?.name ?? "—"}</span>,
    },
    {
      key: "notes",
      header: "Notes",
      accessor: (r) => r.notes ?? "",
      sortable: false,
      cell: (r) => <span className="text-xs text-muted-foreground line-clamp-1">{r.notes ?? "—"}</span>,
    },
  ];

  return (
    <DataTable
      rows={contacts}
      columns={columns}
      searchPlaceholder="Search by person, notes, staff…"
      defaultSort={{ key: "date", direction: "desc" }}
      rowKey={(r) => r.id}
      emptyMessage="No contacts match your filters."
      filters={filters}
      onFiltersChange={onFiltersChange}
    />
  );
}
