import Link from "next/link";
import { LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isAuth0Configured } from "@/lib/auth0";
import { initials } from "@/lib/utils";

export async function SidebarFooter() {
  const me = await getCurrentUser();
  const auth0 = isAuth0Configured();

  if (!me) {
    return (
      <div className="border-t border-sidebar-border p-3 text-xs text-muted-foreground">
        {auth0 ? (
          <Link href="/auth/login" className="hover:text-primary">Sign in →</Link>
        ) : (
          "Dev shim — set DEV_USER_EMAIL"
        )}
      </div>
    );
  }

  const name = me.name || me.email;
  const [first = "", last = ""] = name.split(/\s+/);

  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
          {initials(first, last)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{me.name}</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {me.orgRole === "ORG_ADMIN" ? "HQ Admin" : "Staff"}
          </div>
        </div>
        {auth0 ? (
          <a
            href="/auth/logout"
            title="Sign out"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
      {!auth0 && (
        <div className="mt-2 text-[10px] text-muted-foreground">Dev shim — Auth0 not configured</div>
      )}
    </div>
  );
}
