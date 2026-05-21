"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { formatCurrency, formatDate } from "@/lib/utils";

export type DonationRow = {
  id: string;
  date: Date;
  amount: string | number | { toString(): string };
  paymentMethod: string;
  receiptSent: boolean;
  thankYouSent: boolean;
  person: { id: string; firstName: string; lastName: string };
  campaign: { name: string } | null;
};

const PAYMENT_OPTIONS = [
  { value: "CHECK", label: "Check" },
  { value: "CREDIT_CARD", label: "Credit card" },
  { value: "CASH", label: "Cash" },
  { value: "ONLINE", label: "Online" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
];

export function DonationsTable({ donations, campaigns }: { donations: DonationRow[]; campaigns: string[] }) {
  const campaignOptions = [
    { value: "", label: "—" },
    ...campaigns.map((c) => ({ value: c, label: c })),
  ];

  const columns: DataTableColumn<DonationRow>[] = [
    {
      key: "date",
      header: "Date",
      accessor: (r) => r.date,
      sortable: true,
      cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.date)}</span>,
    },
    {
      key: "person",
      header: "Donor",
      accessor: (r) => `${r.person.firstName} ${r.person.lastName}`,
      sortable: true,
      cell: (r) => (
        <Link href={`/people/${r.person.id}`} className="font-medium hover:text-primary">
          {r.person.firstName} {r.person.lastName}
        </Link>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      accessor: (r) => Number(r.amount),
      sortable: true,
      align: "right",
      cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(Number(r.amount))}</span>,
    },
    {
      key: "campaign",
      header: "Campaign",
      accessor: (r) => r.campaign?.name ?? "",
      sortable: true,
      filter: { kind: "select", options: campaignOptions },
      cell: (r) => <span className="text-xs">{r.campaign?.name ?? "—"}</span>,
    },
    {
      key: "paymentMethod",
      header: "Payment",
      accessor: (r) => r.paymentMethod,
      sortable: true,
      filter: { kind: "select", options: PAYMENT_OPTIONS },
      cell: (r) => <span className="text-xs">{r.paymentMethod.replace(/_/g, " ").toLowerCase()}</span>,
    },
    {
      key: "receiptSent",
      header: "Receipt",
      accessor: (r) => (r.receiptSent ? "yes" : "no"),
      sortable: true,
      filter: { kind: "select", options: [{ value: "yes", label: "Sent" }, { value: "no", label: "Not sent" }] },
      cell: (r) => <span className="text-xs">{r.receiptSent ? "✓" : "—"}</span>,
    },
    {
      key: "thankYouSent",
      header: "Thank you",
      accessor: (r) => (r.thankYouSent ? "yes" : "no"),
      sortable: true,
      filter: { kind: "select", options: [{ value: "yes", label: "Sent" }, { value: "no", label: "Not sent" }] },
      cell: (r) => <span className="text-xs">{r.thankYouSent ? "✓" : "—"}</span>,
    },
  ];

  return (
    <DataTable
      rows={donations}
      columns={columns}
      searchPlaceholder="Search by donor or campaign…"
      defaultSort={{ key: "date", direction: "desc" }}
      rowKey={(r) => r.id}
      emptyMessage="No donations match your filters."
    />
  );
}
