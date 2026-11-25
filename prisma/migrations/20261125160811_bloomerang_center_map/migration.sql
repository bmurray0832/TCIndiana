-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "bloomerang_center_field" TEXT;

-- CreateTable
CREATE TABLE "bloomerang_center_maps" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "center_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bloomerang_center_maps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bloomerang_center_maps_organization_id_value_key" ON "bloomerang_center_maps"("organization_id", "value");

-- AddForeignKey
ALTER TABLE "bloomerang_center_maps" ADD CONSTRAINT "bloomerang_center_maps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloomerang_center_maps" ADD CONSTRAINT "bloomerang_center_maps_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
