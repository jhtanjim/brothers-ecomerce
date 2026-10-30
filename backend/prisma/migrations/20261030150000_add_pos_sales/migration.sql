-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('ONLINE', 'POS');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CASH';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cashReceived" DECIMAL(12,2),
ADD COLUMN     "channel" "OrderChannel" NOT NULL DEFAULT 'ONLINE';

-- CreateIndex
CREATE INDEX "orders_channel_createdAt_idx" ON "orders"("channel", "createdAt");


ALTER TABLE "orders"
  ADD CONSTRAINT "orders_cash_received_nonnegative" CHECK ("cashReceived" IS NULL OR "cashReceived" >= 0);
