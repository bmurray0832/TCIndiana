-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "import_key" TEXT;

-- AlterTable
ALTER TABLE "people" ADD COLUMN     "city" TEXT,
ADD COLUMN     "do_not_mail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "street" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "donations_import_key_key" ON "donations"("import_key");

