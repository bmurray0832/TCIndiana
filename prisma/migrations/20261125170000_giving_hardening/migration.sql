-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "stripe_payment_intent_id" TEXT;

-- CreateTable
CREATE TABLE "portal_login_tokens" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portal_login_tokens_person_id_created_at_idx" ON "portal_login_tokens"("person_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "donations_stripe_payment_intent_id_key" ON "donations"("stripe_payment_intent_id");

-- AddForeignKey
ALTER TABLE "portal_login_tokens" ADD CONSTRAINT "portal_login_tokens_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

