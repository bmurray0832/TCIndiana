"use client";

import { useState } from "react";
import { MessageSquarePlus, DollarSign, Pencil } from "lucide-react";
import { Modal } from "@/components/Modal";
import { LogContactForm } from "@/components/forms/LogContactForm";
import { AddDonationForm } from "@/components/forms/AddDonationForm";
import { PersonForm } from "@/components/forms/PersonForm";
import type { Person } from "@/generated/prisma";

export function PersonActions({
  person,
  centers,
  campaigns,
  isDonor,
}: {
  person: Person;
  centers: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
  isDonor: boolean;
}) {
  const [open, setOpen] = useState<"contact" | "donation" | "edit" | null>(null);
  const close = () => setOpen(null);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setOpen("contact")}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Log contact
      </button>
      <button
        type="button"
        onClick={() => setOpen("donation")}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        <DollarSign className="h-3.5 w-3.5" />
        Add donation
      </button>
      <button
        type="button"
        onClick={() => setOpen("edit")}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>

      <Modal
        open={open === "contact"}
        onClose={close}
        title="Log contact"
        description={`${person.firstName} ${person.lastName}`}
        size="md"
      >
        <LogContactForm personId={person.id} onSuccess={close} />
      </Modal>

      <Modal
        open={open === "donation"}
        onClose={close}
        title="Add donation"
        description={`${person.firstName} ${person.lastName}`}
        size="md"
      >
        <AddDonationForm personId={person.id} campaigns={campaigns} onSuccess={close} />
      </Modal>

      <Modal
        open={open === "edit"}
        onClose={close}
        title={`Edit ${person.firstName} ${person.lastName}`}
        size="lg"
      >
        <PersonForm
          centers={centers}
          variant={isDonor ? "donor" : "prospect"}
          person={person}
          onCancel={close}
          onSuccess={close}
        />
      </Modal>
    </div>
  );
}
