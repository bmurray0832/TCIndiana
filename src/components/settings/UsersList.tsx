"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { UserForm } from "@/components/forms/UserForm";
import { setUserActive } from "@/lib/actions/admin";
import type { OrgRole, CenterRole } from "@/generated/prisma";

type UserRow = {
  id: string;
  name: string;
  email: string;
  orgRole: OrgRole;
  active: boolean;
  centerRoles: { centerId: string; role: CenterRole; center: { name: string } }[];
};

export function UsersList({
  users,
  centers,
  meId,
}: {
  users: UserRow[];
  centers: { id: string; name: string }[];
  meId: string;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleActive(u: UserRow) {
    startTransition(async () => {
      await setUserActive(u.id, !u.active);
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add user
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Org role</th>
              <th className="px-4 py-2.5 font-medium">Centers</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{u.name}</td>
                <td className="px-4 py-2 text-xs">{u.email}</td>
                <td className="px-4 py-2 text-xs">{u.orgRole === "ORG_ADMIN" ? "HQ Admin" : "Staff"}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {u.centerRoles.length === 0
                    ? u.orgRole === "ORG_ADMIN"
                      ? "all"
                      : "—"
                    : u.centerRoles.map((r) => `${r.center.name} (${r.role.toLowerCase()})`).join(", ")}
                </td>
                <td className="px-4 py-2 text-xs">
                  {u.active ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-muted-foreground">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(u)}
                    className="mr-2 text-xs font-medium text-primary hover:underline"
                  >
                    Edit
                  </button>
                  {u.id !== meId && (
                    <button
                      type="button"
                      onClick={() => toggleActive(u)}
                      disabled={pending}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {u.active ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add user" size="lg">
        <UserForm centers={centers} onCancel={() => setAdding(false)} onSuccess={() => setAdding(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""} size="lg">
        {editing && (
          <UserForm centers={centers} user={editing} onCancel={() => setEditing(null)} onSuccess={() => setEditing(null)} />
        )}
      </Modal>
    </>
  );
}
