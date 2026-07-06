import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { getAuth0Client, isAuth0Configured } from "@/lib/auth0";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // If Auth0 is wired, a signed-in user with no DB row gets the
  // "access-pending" page. If they aren't signed in at all, kick them
  // to /login. In dev mode (Auth0 unset) we fall through to the dev shim.
  if (isAuth0Configured()) {
    const auth0 = getAuth0Client();
    const session = await auth0?.getSession();
    if (!session?.user) redirect("/login");
    const me = await getCurrentUser();
    if (!me) redirect("/access-pending");
  } else if (process.env.NODE_ENV === "production") {
    // Misconfigured production (Auth0 vars missing or typo'd): fail
    // loudly at /login instead of serving an empty authed shell.
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
