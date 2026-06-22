CREATE TABLE "Debt" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "creditor"       TEXT,
  "totalAmount"    DOUBLE PRECISION NOT NULL,
  "currency"       TEXT NOT NULL DEFAULT 'PEN',
  "monthlyPayment" DOUBLE PRECISION,
  "startDate"      TIMESTAMP(3),
  "dueDate"        TIMESTAMP(3),
  "notes"          TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DebtPayment" (
  "id"        TEXT NOT NULL,
  "debtId"    TEXT NOT NULL,
  "amount"    DOUBLE PRECISION NOT NULL,
  "currency"  TEXT NOT NULL DEFAULT 'PEN',
  "notes"     TEXT,
  "date"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
