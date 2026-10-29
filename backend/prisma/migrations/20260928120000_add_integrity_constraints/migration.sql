-- ---------------------------------------------------------------------------
-- Phase 2 extras: things Prisma cannot express in schema.prisma.
-- Append this block to the END of the generated migration.sql.
-- (CREATE EXTENSION pg_trgm goes at the very TOP of migration.sql.)
-- ---------------------------------------------------------------------------

-- Payment transaction IDs: unique per method, but a REJECTED one may be reused
-- (customer can resubmit a corrected ID).
CREATE UNIQUE INDEX "payment_transactions_method_transactionId_active_key"
  ON "payment_transactions" ("method", "transactionId")
  WHERE "status" <> 'REJECTED';

-- At most one primary image per product.
CREATE UNIQUE INDEX "product_images_one_primary_per_product_key"
  ON "product_images" ("productId")
  WHERE "isPrimary" = true;

-- Data-integrity safety nets (the last line of defence against overselling / bad money values).
ALTER TABLE "products"
  ADD CONSTRAINT "products_price_nonnegative" CHECK ("price" >= 0),
  ADD CONSTRAINT "products_discount_valid" CHECK ("discountPrice" IS NULL OR ("discountPrice" >= 0 AND "discountPrice" < "price")),
  ADD CONSTRAINT "products_discount_percent_range" CHECK ("discountPercent" BETWEEN 0 AND 100),
  ADD CONSTRAINT "products_stock_nonnegative" CHECK ("stockQuantity" >= 0),
  ADD CONSTRAINT "products_low_stock_nonnegative" CHECK ("lowStockThreshold" >= 0),
  ADD CONSTRAINT "products_sold_nonnegative" CHECK ("soldCount" >= 0);

ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_amounts_nonnegative" CHECK ("unitPrice" >= 0 AND "discountAmount" >= 0 AND "totalPrice" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_nonnegative" CHECK (
    "subtotal" >= 0 AND "discountAmount" >= 0 AND "couponDiscount" >= 0
    AND "deliveryCharge" >= 0 AND "totalAmount" >= 0
  );

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_nonnegative" CHECK ("amount" >= 0),
  ADD CONSTRAINT "payments_attempt_count_nonnegative" CHECK ("attemptCount" >= 0);

ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_value_positive" CHECK ("value" > 0),
  ADD CONSTRAINT "coupons_percentage_max_100" CHECK ("type" <> 'PERCENTAGE' OR "value" <= 100),
  ADD CONSTRAINT "coupons_used_count_nonnegative" CHECK ("usedCount" >= 0);