import { Prisma } from "@/generated/prisma";

/** Recompute cached aggregates on Person after any Contact or Donation
 *  write. Called from server actions inside the same transaction.
 *
 *  Also handles the prospect → donor conversion: as soon as a person
 *  has any donation, `convertedToDonorAt` is set to the earliest
 *  donation date and `donorStatus` defaults to ACTIVE (if not already
 *  set). Interest level is cleared on conversion. */
export async function recomputePerson(
  tx: Prisma.TransactionClient,
  personId: string,
) {
  const person = await tx.person.findUnique({ where: { id: personId } });
  if (!person) return;

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);

  const allDonations = await tx.donation.findMany({
    where: { personId },
    orderBy: { date: "asc" },
    select: { date: true, amount: true },
  });

  let lifetime = 0;
  let ytd = 0;
  let lastYear = 0;
  let lastDonationAt: Date | null = null;
  let firstDonationAt: Date | null = null;
  for (const d of allDonations) {
    const amt = Number(d.amount);
    lifetime += amt;
    if (d.date >= yearStart) ytd += amt;
    else if (d.date >= lastYearStart) lastYear += amt;
    if (!firstDonationAt || d.date < firstDonationAt) firstDonationAt = d.date;
    if (!lastDonationAt || d.date > lastDonationAt) lastDonationAt = d.date;
  }

  const latestContact = await tx.contact.findFirst({
    where: { personId },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  const becameDonor = firstDonationAt && !person.convertedToDonorAt;

  await tx.person.update({
    where: { id: personId },
    data: {
      lifetimeAmount: new Prisma.Decimal(lifetime),
      ytdAmount: new Prisma.Decimal(ytd),
      lastYearAmount: new Prisma.Decimal(lastYear),
      lastDonationAt,
      lastContactAt: latestContact?.date ?? person.lastContactAt,
      convertedToDonorAt:
        person.convertedToDonorAt ?? (firstDonationAt ? firstDonationAt : null),
      donorStatus:
        becameDonor && !person.donorStatus ? "ACTIVE" : person.donorStatus,
      interestLevel: becameDonor ? null : person.interestLevel,
    },
  });
}
