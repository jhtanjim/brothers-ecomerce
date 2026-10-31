-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "unitCost" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "costPrice" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "stock_purchases" (
    "id" TEXT NOT NULL,
    "purchaseNumber" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "note" TEXT,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "adminId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_purchase_items" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "stock_purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_purchases_purchaseNumber_key" ON "stock_purchases"("purchaseNumber");

-- CreateIndex
CREATE INDEX "stock_purchases_createdAt_idx" ON "stock_purchases"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stock_purchases_adminId_idempotencyKey_key" ON "stock_purchases"("adminId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "stock_purchase_items_purchaseId_idx" ON "stock_purchase_items"("purchaseId");

-- CreateIndex
CREATE INDEX "stock_purchase_items_productId_idx" ON "stock_purchase_items"("productId");

-- CreateIndex
CREATE INDEX "stock_purchase_items_variantId_idx" ON "stock_purchase_items"("variantId");

-- AddForeignKey
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_purchase_items" ADD CONSTRAINT "stock_purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "stock_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_purchase_items" ADD CONSTRAINT "stock_purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_purchase_items" ADD CONSTRAINT "stock_purchase_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "products"
  ADD CONSTRAINT "products_cost_nonnegative" CHECK ("costPrice" IS NULL OR "costPrice" >= 0);
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_cost_nonnegative" CHECK ("unitCost" IS NULL OR "unitCost" >= 0);
ALTER TABLE "stock_purchase_items"
  ADD CONSTRAINT "stock_purchase_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "stock_purchase_items_cost_nonnegative" CHECK ("unitCost" >= 0);
