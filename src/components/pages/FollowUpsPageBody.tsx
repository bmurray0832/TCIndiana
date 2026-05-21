"use client";

import { useState } from "react";
import { FilterCards, type FilterCard } from "@/components/FilterCards";
import { FollowUpsTable } from "@/components/tables/FollowUpsTable";
import type { PersonWithAlert } from "@/lib/queries";

export function FollowUpsPageBody({
  people,
  centerNames,
}: {
  people: PersonWithAlert[];
  centerNames: string[];
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});

  const red = people.filter((p) => p.alertColor === "RED").length;
  const orange = people.filter((p) => p.alertColor === "ORANGE").length;
  const yellow = people.filter((p) => p.alertColor === "YELLOW").length;
  const donors = people.filter((p) => p.convertedToDonorAt).length;
  const prospects = people.length - donors;

  const cards: FilterCard[] = [
    { key: "total", label: "Total to follow up", count: people.length, filters: {} },
    { key: "red", label: "Red", count: red, filters: { alert: "RED" }, tone: "danger" },
    { key: "orange", label: "Orange", count: orange, filters: { alert: "ORANGE" }, tone: "warning" },
    { key: "yellow", label: "Yellow", count: yellow, filters: { alert: "YELLOW" }, tone: "warning" },
    { key: "donors", label: "Donors", count: donors, filters: { type: "Donor" }, tone: "info" },
    { key: "prospects", label: "Prospects", count: prospects, filters: { type: "Prospect" }, tone: "info" },
  ];

  return (
    <>
      <FilterCards cards={cards} active={filters} onPick={setFilters} />
      <FollowUpsTable
        people={people}
        centerNames={centerNames}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </>
  );
}
