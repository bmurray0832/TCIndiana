"use client";

import { useState } from "react";
import { FilterCards, type FilterCard } from "@/components/FilterCards";
import { ContactLogTable, type ContactRow } from "@/components/tables/ContactLogTable";

export function ContactsPageBody({ contacts }: { contacts: ContactRow[] }) {
  const [filters, setFilters] = useState<Record<string, string>>({});

  const phoneCalls = contacts.filter((c) => c.contactType === "PHONE_CALL").length;
  const emails = contacts.filter((c) => c.contactType === "EMAIL").length;
  const meetings = contacts.filter((c) => c.contactType === "IN_PERSON_MEETING").length;
  const followUpsScheduled = contacts.filter((c) => c.outcome === "SCHEDULED_FOLLOW_UP").length;
  const madeDonation = contacts.filter((c) => c.outcome === "MADE_DONATION").length;
  const noAnswer = contacts.filter((c) => c.outcome === "NO_ANSWER" || c.outcome === "LEFT_MESSAGE").length;

  const cards: FilterCard[] = [
    { key: "all", label: "All contacts", count: contacts.length, filters: {} },
    { key: "calls", label: "Phone calls", count: phoneCalls, filters: { contactType: "PHONE_CALL" }, tone: "info" },
    { key: "emails", label: "Emails", count: emails, filters: { contactType: "EMAIL" }, tone: "info" },
    { key: "meetings", label: "Meetings", count: meetings, filters: { contactType: "IN_PERSON_MEETING" }, tone: "info" },
    { key: "follow-ups-scheduled", label: "Follow-ups scheduled", count: followUpsScheduled, filters: { outcome: "SCHEDULED_FOLLOW_UP" }, tone: "warning" },
    { key: "donations", label: "Made a gift", count: madeDonation, filters: { outcome: "MADE_DONATION" }, tone: "good" },
    { key: "no-answer", label: "No answer / VM", count: noAnswer, filters: { outcome: "NO_ANSWER,LEFT_MESSAGE" }, tone: "danger" },
  ];

  return (
    <>
      <FilterCards cards={cards} active={filters} onPick={setFilters} />
      <ContactLogTable contacts={contacts} filters={filters} onFiltersChange={setFilters} />
    </>
  );
}
