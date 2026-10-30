-- AlterTable
ALTER TABLE "users" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "storeId" TEXT;

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE INDEX "users_storeId_idx" ON "users"("storeId");

-- CreateIndex
CREATE INDEX "categories_storeId_idx" ON "categories"("storeId");

-- CreateIndex
CREATE INDEX "products_storeId_idx" ON "products"("storeId");

-- CreateIndex
CREATE INDEX "orders_storeId_idx" ON "orders"("storeId");

-- CreateIndex
CREATE INDEX "payment_transactions_storeId_idx" ON "payment_transactions"("storeId");

-- CreateIndex
CREATE INDEX "coupons_storeId_idx" ON "coupons"("storeId");

-- CreateIndex
CREATE INDEX "activity_logs_storeId_idx" ON "activity_logs"("storeId");

-- CreateIndex
CREATE INDEX "settings_storeId_idx" ON "settings"("storeId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: every existing row belongs to the first store (Geton).
-- Inserted only when there is data to own, so an empty database stays empty.
INSERT INTO "stores" ("id", "slug", "name", "status", "updatedAt")
SELECT 'store_geton', 'geton', 'Geton', 'ACTIVE', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "users") OR EXISTS (SELECT 1 FROM "products")
   OR EXISTS (SELECT 1 FROM "categories") OR EXISTS (SELECT 1 FROM "settings") OR EXISTS (SELECT 1 FROM "coupons");

UPDATE "users" SET "storeId" = 'store_geton';
UPDATE "categories" SET "storeId" = 'store_geton';
UPDATE "products" SET "storeId" = 'store_geton';
UPDATE "orders" SET "storeId" = 'store_geton';
UPDATE "payment_transactions" SET "storeId" = 'store_geton';
UPDATE "coupons" SET "storeId" = 'store_geton';
UPDATE "activity_logs" SET "storeId" = 'store_geton';
UPDATE "settings" SET "storeId" = 'store_geton';
