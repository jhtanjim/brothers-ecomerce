-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'SALARY', 'UTILITIES', 'TRANSPORT', 'SUPPLIES', 'MARKETING', 'OTHER', 'SUPPLIER_PAYMENT');

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidFromDrawer" BOOLEAN NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_days" (
    "day" VARCHAR(10) NOT NULL,
    "openingCash" DECIMAL(12,2),
    "countedCash" DECIMAL(12,2),
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_days_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "expenses_day_idx" ON "expenses"("day");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_days" ADD CONSTRAINT "cash_days_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "cash_days"
  ADD CONSTRAINT "cash_days_amounts_nonnegative" CHECK (
    ("openingCash" IS NULL OR "openingCash" >= 0) AND ("countedCash" IS NULL OR "countedCash" >= 0)
  );
