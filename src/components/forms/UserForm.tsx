"use client";

import { useActionState, useEffect, useState } from "react";
import { Field, TextInput, Select, SubmitRow } from "@/components/forms/FormFields";
import { createUser, updateUser, type UserFormState } from "@/lib/actions/admin";
import type { OrgRole, CenterRole } from "@/generated/prisma";

type CenterOption = { id: string; name: string };
type ExistingUser = {
  id: string;
  name: string;
  email: string;
  orgRole: OrgRole;
  centerRoles: { centerId: string; role: CenterRole }[];
};

const ROLE_OPTIONS: { value: CenterRole; label: string }[] = [
  { value: "DIRECTOR", label: "Director" },
  { value: "STAFF", label: "Staff" },
  { value: "VIEWER", label: "Viewer" },
];

export function UserForm({
  centers,
  user,
  onCancel,
  onSuccess,
}: {
  centers: CenterOption[];
  user?: ExistingUser;
  onCancel: () => void;
  onSuccess?: () => void;
}) {
  const isEdit = !!user;
  const action = isEdit ? updateUser.bind(null, user.id) : createUser;
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(action, null);

  const initialRoles = new Map<string, CenterRole>();
  user?.centerRoles.forEach((r) => initialRoles.set(r.centerId, r.role));

  const [roles, setRoles] = useState<Map<string, CenterRole | "">>(() => {
    const m = new Map<string, CenterRole | "">();
    centers.forEach((c) => m.set(c.id, initialRoles.get(c.id) ?? ""));
    return m;
  });

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  const errs = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-4">
      {Array.from(roles.entries())
        .filter(([, role]) => role)
        .map(([centerId, role]) => (
          <input key={centerId} type="hidden" name="centerRoles" value={`${centerId}:${role}`} />
        ))}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="name" required error={errs.name}>
          <TextInput id="name" name="name" defaultValue={user?.name ?? ""} required />
        </Field>
        <Field label="Email" htmlFor="email" required error={errs.email}>
          <TextInput id="email" name="email" type="email" defaultValue={user?.email ?? ""} required />
        </Field>
      </div>

      <Field label="Org role" htmlFor="orgRole" required error={errs.orgRole} hint="HQ admins see and edit every center.">
        <Select id="orgRole" name="orgRole" defaultValue={user?.orgRole ?? "STAFF"} required>
          <option value="STAFF">Staff</option>
          <option value="ORG_ADMIN">HQ Admin</option>
        </Select>
      </Field>

      <div>
        <div className="mb-1 text-xs font-medium">Center access</div>
        <p className="mb-2 text-xs text-muted-foreground">
          Per-center role. Leave blank for centers this user shouldn&apos;t see.
        </p>
        <div className="rounded-md border border-border bg-background">
          <ul className="divide-y divide-border">
            {centers.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="text-sm font-medium">{c.name}</div>
                <select
                  value={roles.get(c.id) ?? ""}
                  onChange={(e) =>
                    setRoles((m) => {
                      const next = new Map(m);
                      next.set(c.id, (e.target.value as CenterRole) || "");
                      return next;
                    })
                  }
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="">— No access —</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <SubmitRow
        onCancel={onCancel}
        submitLabel={isEdit ? "Save changes" : "Add user"}
        pending={pending}
        error={state && !state.ok ? state.error : undefined}
      />
    </form>
  );
}
