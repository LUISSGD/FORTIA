-- CreateTable
CREATE TABLE "CashPlan" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "bankPen" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 3.45,
    "bankUpdatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "payBy" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashPlanSale" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "membershipPlanId" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "expectedOn" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashPlanSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashPlan_yearMonth_key" ON "CashPlan"("yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "CashPlanItem_planId_expenseId_key" ON "CashPlanItem"("planId", "expenseId");

-- AddForeignKey
ALTER TABLE "CashPlanItem" ADD CONSTRAINT "CashPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CashPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashPlanItem" ADD CONSTRAINT "CashPlanItem_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "MonthlyExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashPlanSale" ADD CONSTRAINT "CashPlanSale_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CashPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

