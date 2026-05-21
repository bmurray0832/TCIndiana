"use client";

import { useState } from "react";
import { FilterCards, type FilterCard } from "@/components/FilterCards";
import { PeopleDataTable } from "@/components/tables/PeopleDataTable";
import type { PersonWithAlert } from "@/lib/queries";

export function ProspectsPageBody({
  people,
  centerNames,
}: {
  people: PersonWithAlert[];
  centerNames: string[];
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});

  const hot = people.filter((p) => p.interestLevel === "HOT").length;
  const warm = people.filter((p) => p.interestLevel === "WARM").length;
  const cold = people.filter((p) => p.interestLevel === "COLD").length;
  const goingCold = people.filter((p) => p.alertColor === "RED" || p.alertColor === "ORANGE").length;

  const cards: FilterCard[] = [
    { key: "total", label: "Total prospects", count: people.length, filters: {} },
    { key: "hot", label: "Hot", count: hot, filters: { interestLevel: "HOT" }, tone: "hot" },
    { key: "warm", label: "Warm", count: warm, filters: { interestLevel: "WARM" }, tone: "warm" },
    { key: "cold", label: "Cold", count: cold, filters: { interestLevel: "COLD" }, tone: "cold" },
    { key: "going-cold", label: "Going cold", count: goingCold, filters: { alert: "RED,ORANGE" }, tone: "danger" },
  ];

  return (
    <>
      <FilterCards cards={cards} active={filters} onPick={setFilters} />
      <PeopleDataTable
        people={people}
        variant="prospect"
        centerNames={centerNames}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </>
  );
}
