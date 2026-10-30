-- DropIndex
DROP INDEX "cart_items_cartId_productId_key";

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "variantId" TEXT,
ADD COLUMN     "variantKey" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "color" TEXT,
ADD COLUMN     "size" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "bestSeller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "material" VARCHAR(120),
ADD COLUMN     "newArrival" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" VARCHAR(20) NOT NULL DEFAULT '',
    "color" VARCHAR(40) NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_size_idx" ON "product_variants"("size");

-- CreateIndex
CREATE INDEX "product_variants_color_idx" ON "product_variants"("color");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_size_color_key" ON "product_variants"("productId", "size", "color");

-- CreateIndex
CREATE INDEX "cart_items_variantId_idx" ON "cart_items"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_productId_variantKey_key" ON "cart_items"("cartId", "productId", "variantKey");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");

-- CreateIndex
CREATE INDEX "products_status_newArrival_idx" ON "products"("status", "newArrival");

-- CreateIndex
CREATE INDEX "products_status_bestSeller_idx" ON "products"("status", "bestSeller");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Safety net, like the other stock columns.
ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_stock_nonnegative" CHECK ("stockQuantity" >= 0);
