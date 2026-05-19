-- CreateEnum
CREATE TYPE "org_role" AS ENUM ('ORG_ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "center_role" AS ENUM ('DIRECTOR', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "preferred_contact" AS ENUM ('EMAIL', 'PHONE', 'MAIL', 'IN_PERSON', 'TEXT');

-- CreateEnum
CREATE TYPE "prospect_source" AS ENUM ('EVENT', 'REFERRAL', 'WALK_IN', 'ONLINE', 'SOCIAL_MEDIA', 'EMAIL_CAMPAIGN', 'ANNUAL_GALA', 'COMMUNITY_EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "interest_level" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "donor_status" AS ENUM ('ACTIVE', 'LAPSED', 'MAJOR_DONOR');

-- CreateEnum
CREATE TYPE "giving_frequency" AS ENUM ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'IRREGULAR');

-- CreateEnum
CREATE TYPE "contact_type" AS ENUM ('PHONE_CALL', 'EMAIL', 'IN_PERSON_MEETING', 'EVENT', 'MAIL', 'TEXT_MESSAGE', 'ONLINE');

-- CreateEnum
CREATE TYPE "contact_outcome" AS ENUM ('MADE_DONATION', 'SCHEDULED_FOLLOW_UP', 'NO_ANSWER', 'LEFT_MESSAGE', 'NOT_INTERESTED', 'INFORMATION_SENT', 'OTHER');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CHECK', 'CREDIT_CARD', 'CASH', 'ONLINE', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "donation_source" AS ENUM ('MANUAL', 'STRIPE', 'IMPORTED');

-- CreateEnum
CREATE TYPE "alert_color" AS ENUM ('GREEN', 'YELLOW', 'ORANGE', 'RED');

-- CreateEnum
CREATE TYPE "follow_up_status" AS ENUM ('OPEN', 'SNOOZED', 'DONE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "import_kind" AS ENUM ('CONSTITUENTS', 'TRANSACTIONS', 'INTERACTIONS');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "default_alert_thresholds" JSONB NOT NULL DEFAULT '{"donor":{"yellow":90,"orange":180,"red":365},"prospect":{"yellow":14,"orange":30,"red":60}}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "donation_page_slug" TEXT,
    "brand_color" TEXT,
    "brand_logo_url" TEXT,
    "address" TEXT,
    "alert_thresholds" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "auth0_sub" TEXT,
    "org_role" "org_role" NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ms_graph_tokens" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_center_roles" (
    "user_id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "role" "center_role" NOT NULL,

    CONSTRAINT "user_center_roles_pkey" PRIMARY KEY ("user_id","center_id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "organization" TEXT,
    "preferred_contact" "preferred_contact",
    "source" "prospect_source",
    "interest_level" "interest_level",
    "donor_status" "donor_status",
    "giving_frequency" "giving_frequency",
    "next_step" TEXT,
    "notes" TEXT,
    "date_added" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_contact_at" TIMESTAMP(3),
    "last_donation_at" TIMESTAMP(3),
    "converted_to_donor_at" TIMESTAMP(3),
    "snoozed_until" TIMESTAMP(3),
    "lifetime_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ytd_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "last_year_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bloomerang_id" TEXT,
    "stripe_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "contact_type" "contact_type" NOT NULL,
    "staff_user_id" TEXT,
    "outcome" "contact_outcome" NOT NULL,
    "notes" TEXT,
    "next_follow_up_at" TIMESTAMP(3),
    "donation_id" TEXT,
    "bloomerang_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "source" "donation_source" NOT NULL DEFAULT 'MANUAL',
    "campaign_id" TEXT,
    "receipt_sent" BOOLEAN NOT NULL DEFAULT false,
    "thank_you_sent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "stripe_charge_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_fees_cents" INTEGER,
    "donor_covered_fees" BOOLEAN NOT NULL DEFAULT false,
    "bloomerang_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "center_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "goal_amount" DECIMAL(12,2),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "due_at" TIMESTAMP(3),
    "alert_color" "alert_color" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "status" "follow_up_status" NOT NULL DEFAULT 'OPEN',
    "snoozed_until" TIMESTAMP(3),
    "assigned_staff_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloomerang_imports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "kind" "import_kind" NOT NULL,
    "filename" TEXT,
    "center_id" TEXT,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "error_rows" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloomerang_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "diff" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "centers_slug_key" ON "centers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "centers_donation_page_slug_key" ON "centers"("donation_page_slug");

-- CreateIndex
CREATE INDEX "centers_organization_id_idx" ON "centers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth0_sub_key" ON "users"("auth0_sub");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "people_bloomerang_id_key" ON "people"("bloomerang_id");

-- CreateIndex
CREATE UNIQUE INDEX "people_stripe_customer_id_key" ON "people"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "people_center_id_idx" ON "people"("center_id");

-- CreateIndex
CREATE INDEX "people_center_id_converted_to_donor_at_idx" ON "people"("center_id", "converted_to_donor_at");

-- CreateIndex
CREATE INDEX "people_center_id_last_contact_at_idx" ON "people"("center_id", "last_contact_at");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_donation_id_key" ON "contacts"("donation_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_bloomerang_id_key" ON "contacts"("bloomerang_id");

-- CreateIndex
CREATE INDEX "contacts_person_id_date_idx" ON "contacts"("person_id", "date");

-- CreateIndex
CREATE INDEX "contacts_center_id_date_idx" ON "contacts"("center_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "donations_stripe_charge_id_key" ON "donations"("stripe_charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "donations_bloomerang_id_key" ON "donations"("bloomerang_id");

-- CreateIndex
CREATE INDEX "donations_person_id_date_idx" ON "donations"("person_id", "date");

-- CreateIndex
CREATE INDEX "donations_center_id_date_idx" ON "donations"("center_id", "date");

-- CreateIndex
CREATE INDEX "donations_campaign_id_idx" ON "donations"("campaign_id");

-- CreateIndex
CREATE INDEX "campaigns_organization_id_idx" ON "campaigns"("organization_id");

-- CreateIndex
CREATE INDEX "follow_ups_center_id_status_priority_idx" ON "follow_ups"("center_id", "status", "priority");

-- CreateIndex
CREATE INDEX "follow_ups_person_id_idx" ON "follow_ups"("person_id");

-- CreateIndex
CREATE INDEX "bloomerang_imports_organization_id_created_at_idx" ON "bloomerang_imports"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_organization_id_created_at_idx" ON "audit_log"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "centers" ADD CONSTRAINT "centers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_center_roles" ADD CONSTRAINT "user_center_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_center_roles" ADD CONSTRAINT "user_center_roles_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloomerang_imports" ADD CONSTRAINT "bloomerang_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloomerang_imports" ADD CONSTRAINT "bloomerang_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
