"use client";

import { useState, useTransition } from "react";
import { Phone, MessageSquare, Mail, ChevronDown } from "lucide-react";
import { Modal } from "@/components/Modal";
import { SnoozeMenu } from "@/components/SnoozeMenu";
import { SendEmailForm } from "@/components/forms/SendEmailForm";
import { AddDonationForm } from "@/components/forms/AddDonationForm";
import { LogContactForm } from "@/components/forms/LogContactForm";
import { quickLogContact, type QuickOutcome } from "@/lib/actions/contacts";
import type { PersonWithAlert } from "@/lib/queries";
import { cn } from "@/lib/utils";

const QUICK_OUTCOMES: { key: QuickOutcome; label: string }[] = [
  { key: "SCHEDULED_MEETING", label: "Scheduled meeting" },
  { key: "LEFT_VOICEMAIL", label: "Left voicemail" },
  { key: "LEFT_TEXT", label: "Left text message" },
  { key: "NO_ANSWER", label: "No answer" },
  { key: "NOT_INTERESTED", label: "Not interested" },
];

const dialable = (phone: string) => phone.replace(/[^+\d]/g, "");

export function FollowUpRowActions({
  person,
  campaigns,
}: {
  person: PersonWithAlert;
  campaigns: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState<"email" | "donation" | "contact" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const close = () => setOpen(null);

  const phone = person.phone?.trim();
  const email = person.email?.trim();

  function quick(key: QuickOutcome) {
    setMenuOpen(false);
    startTransition(async () => {
      await quickLogContact(person.id, key);
    });
  }

  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {phone && (
        <a
          href={`tel:${dialable(phone)}`}
          title={`Call ${phone}`}
          className="inline-flex items-center rounded-md border border-border bg-card p-1.5 hover:bg-muted"
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
      )}
      {phone && (
        <a
          href={`sms:${dialable(phone)}`}
          title={`Text ${phone}`}
          className="inline-flex items-center rounded-md border border-border bg-card p-1.5 hover:bg-muted"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </a>
      )}
      {email && (
        <button
          type="button"
          onClick={() => setOpen("email")}
          title={`Email ${email}`}
          className="inline-flex items-center rounded-md border border-border bg-card p-1.5 hover:bg-muted"
        >
          <Mail className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-muted",
            pending && "opacity-60",
          )}
        >
          Log
          <ChevronDown className="h-3 w-3" />
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              aria-hidden
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-card shadow-lg">
              <ul className="py-1 text-xs">
                {QUICK_OUTCOMES.map((o) => (
                  <li key={o.key}>
                    <button
                      type="button"
                      onClick={() => quick(o.key)}
                      className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                    >
                      {o.label}
                    </button>
                  </li>
                ))}
                <li className="border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setOpen("donation");
                    }}
                    className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                  >
                    Made donation…
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setOpen("contact");
                    }}
                    className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                  >
                    Other…
                  </button>
                </li>
              </ul>
            </div>
          </>
        )}
      </div>

      <SnoozeMenu personId={person.id} snoozedUntil={person.snoozedUntil} />

      <Modal
        open={open === "email"}
        onClose={close}
        title="Send email"
        description={email ? `to ${email}` : ""}
        size="lg"
      >
        {email && (
          <SendEmailForm
            personId={person.id}
            to={email}
            defaultSubject={`Following up — ${person.firstName} ${person.lastName}`}
            onSuccess={close}
          />
        )}
      </Modal>

      <Modal
        open={open === "donation"}
        onClose={close}
        title="Add donation"
        description={`${person.firstName} ${person.lastName}`}
        size="md"
      >
        <AddDonationForm
          personId={person.id}
          campaigns={campaigns}
          onSuccess={close}
        />
      </Modal>

      <Modal
        open={open === "contact"}
        onClose={close}
        title="Log contact"
        description={`${person.firstName} ${person.lastName}`}
        size="md"
      >
        <LogContactForm personId={person.id} onSuccess={close} />
      </Modal>
    </div>
  );
}
