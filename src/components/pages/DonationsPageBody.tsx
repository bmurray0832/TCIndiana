"use client";

import { useState } from "react";
import { FilterCards, type FilterCard } from "@/components/FilterCards";
import { DonationsTable, type DonationRow } from "@/components/tables/DonationsTable";
import { formatCurrency } from "@/lib/utils";

export function DonationsPageBody({
  donations,
  campaigns,
}: {
  donations: DonationRow[];
  campaigns: string[];
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});

  const total = donations.reduce((s, d) => s + Number(d.amount), 0);
  const ytdTotal = donations
    .filter((d) => new Date(d.date).getFullYear() === new Date().getFullYear())
    .reduce((s, d) => s + Number(d.amount), 0);
  const notThanked = donations.filter((d) => !d.thankYouSent).length;
  const noReceipt = donations.filter((d) => !d.receiptSent).length;
  const recurring = donations.filter((d) => d.paymentMethod === "ONLINE").length;

  const cards: FilterCard[] = [
    { key: "total-amount", label: "Total shown", count: formatCurrency(total), filters: {} },
    { key: "ytd-amount", label: "This year", count: formatCurrency(ytdTotal), filters: {} },
    { key: "all", label: "All gifts", count: donations.length, filters: {} },
    { key: "not-thanked", label: "Thank-you pending", count: notThanked, filters: { thankYouSent: "no" }, tone: "warning" },
    { key: "no-receipt", label: "Receipt pending", count: noReceipt, filters: { receiptSent: "no" }, tone: "danger" },
    { key: "online", label: "Online gifts", count: recurring, filters: { paymentMethod: "ONLINE" }, tone: "info" },
  ];

  return (
    <>
      <FilterCards cards={cards} active={filters} onPick={setFilters} />
      <DonationsTable
        donations={donations}
        campaigns={campaigns}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </>
  );
}
