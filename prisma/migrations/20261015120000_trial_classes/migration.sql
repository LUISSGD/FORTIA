-- CreateTable
CREATE TABLE "TrialClass" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "dni" TEXT,
    "goal" TEXT,
    "notes" TEXT,
    "trialDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "trainer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "clientId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialClass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrialClass_trialDate_idx" ON "TrialClass"("trialDate");

-- AddForeignKey
ALTER TABLE "TrialClass" ADD CONSTRAINT "TrialClass_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

