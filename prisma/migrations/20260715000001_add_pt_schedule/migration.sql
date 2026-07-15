CREATE TABLE "PersonalTrainingSlot" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PersonalTrainingSlot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PersonalTrainingSlot" ADD CONSTRAINT "PersonalTrainingSlot_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "ClientTrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
