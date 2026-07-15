CREATE TABLE "MonthlyExpense" (
  "id" TEXT NOT NULL,
  "concept" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PEN',
  "amount" DOUBLE PRECISION NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlyExpense_pkey" PRIMARY KEY ("id")
);
