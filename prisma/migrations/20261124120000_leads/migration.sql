-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "goal" TEXT,
    "daysPerWeek" INTEGER,
    "planInterest" TEXT,
    "source" TEXT NOT NULL DEFAULT 'OTRO',
    "referredBy" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "lostReason" TEXT,
    "notes" TEXT,
    "nextContactOn" TIMESTAMP(3),
    "contactedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "consentAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "trialId" TEXT,
    "clientId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_trialId_key" ON "Lead"("trialId");

-- CreateIndex
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_trialId_fkey" FOREIGN KEY ("trialId") REFERENCES "TrialClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

