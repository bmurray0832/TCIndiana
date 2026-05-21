"use client";

import { useState } from "react";
import { FilterCards, type FilterCard } from "@/components/FilterCards";
import { PeopleDataTable } from "@/components/tables/PeopleDataTable";
import type { PersonWithAlert } from "@/lib/queries";
import { formatCurrency } from "@/lib/utils";

export function DonorsPageBody({
  people,
  centerNames,
}: {
  people: PersonWithAlert[];
  centerNames: string[];
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});

  const active = people.filter((p) => p.donorStatus === "ACTIVE").length;
  const lapsed = people.filter((p) => p.donorStatus === "LAPSED").length;
  const major = people.filter((p) => p.donorStatus === "MAJOR_DONOR").length;
  const needAttention = people.filter((p) => p.alertColor === "RED" || p.alertColor === "ORANGE").length;
  const totalLifetime = people.reduce((s, p) => s + Number(p.lifetimeAmount), 0);

  const cards: FilterCard[] = [
    { key: "total", label: "Total donors", count: people.length, filters: {} },
    { key: "major", label: "Major donors", count: major, filters: { donorStatus: "MAJOR_DONOR" }, tone: "info" },
    { key: "active", label: "Active", count: active, filters: { donorStatus: "ACTIVE" }, tone: "good" },
    { key: "lapsed", label: "Lapsed", count: lapsed, filters: { donorStatus: "LAPSED" }, tone: "warning" },
    { key: "need-attention", label: "Need attention", count: needAttention, filters: { alert: "RED,ORANGE" }, tone: "danger" },
    { key: "lifetime", label: "Lifetime giving", count: formatCurrency(totalLifetime), filters: {} },
  ];

  return (
    <>
      <FilterCards cards={cards} active={filters} onPick={setFilters} />
      <PeopleDataTable
        people={people}
        variant="donor"
        centerNames={centerNames}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </>
  );
}
