-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "balanceDue" DOUBLE PRECISION,
ADD COLUMN     "balanceDueDate" TIMESTAMP(3),
ADD COLUMN     "balancePaidAt" TIMESTAMP(3);

