-- AlterTable
ALTER TABLE "CoachingPayment" ADD COLUMN     "mpPaymentId" TEXT,
ADD COLUMN     "mpPreferenceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CoachingPayment_mpPaymentId_key" ON "CoachingPayment"("mpPaymentId");
