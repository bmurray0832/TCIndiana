"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { PersonForm } from "@/components/forms/PersonForm";

export function NewPersonButton({
  centers,
  variant,
}: {
  centers: { id: string; name: string }[];
  variant: "prospect" | "donor";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        New {variant}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Add ${variant}`}
        size="lg"
      >
        <PersonForm
          centers={centers}
          variant={variant}
          onCancel={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
