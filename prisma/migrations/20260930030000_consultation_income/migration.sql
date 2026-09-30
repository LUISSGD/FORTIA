-- AlterTable
ALTER TABLE "NutritionConsultation" ADD COLUMN "incomeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NutritionConsultation_incomeId_key" ON "NutritionConsultation"("incomeId");
