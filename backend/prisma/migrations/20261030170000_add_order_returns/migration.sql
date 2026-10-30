-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "exchangeCredit" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "order_returns" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    "refundMethod" "PaymentMethod",
    "restocked" BOOLEAN NOT NULL,
    "exchangeOrderId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "order_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_returns_returnNumber_key" ON "order_returns"("returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "order_returns_exchangeOrderId_key" ON "order_returns"("exchangeOrderId");

-- CreateIndex
CREATE INDEX "order_returns_orderId_idx" ON "order_returns"("orderId");

-- CreateIndex
CREATE INDEX "order_returns_createdAt_idx" ON "order_returns"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_returns_adminId_idempotencyKey_key" ON "order_returns"("adminId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "order_return_items_returnId_idx" ON "order_return_items"("returnId");

-- CreateIndex
CREATE INDEX "order_return_items_orderItemId_idx" ON "order_return_items"("orderItemId");

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_exchangeOrderId_fkey" FOREIGN KEY ("exchangeOrderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "order_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "orders"
  ADD CONSTRAINT "orders_exchange_credit_nonnegative" CHECK ("exchangeCredit" >= 0);
ALTER TABLE "order_returns"
  ADD CONSTRAINT "order_returns_amount_nonnegative" CHECK ("refundAmount" >= 0);
ALTER TABLE "order_return_items"
  ADD CONSTRAINT "order_return_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_return_items_amount_nonnegative" CHECK ("amount" >= 0);
