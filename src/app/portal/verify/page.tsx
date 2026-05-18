import Link from "next/link";
import { redirect } from "next/navigation";
import { readMagicLinkToken, setPortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PortalVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) return badLink();

  const parsed = readMagicLinkToken(token);
  if (!parsed) return badLink();

  const person = await prisma.person.findUnique({ where: { id: parsed.personId } });
  if (!person) return badLink();

  await setPortalSession(person.id);
  redirect("/portal");
}

function badLink() {
  return (
    <div className="text-center">
      <h1 className="text-xl font-bold">That link expired</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Magic links last for an hour. Request a fresh one and try again.
      </p>
      <Link
        href="/portal/request"
        className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Request a new link
      </Link>
    </div>
  );
}
