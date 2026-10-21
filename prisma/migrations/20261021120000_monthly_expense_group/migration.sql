-- AlterTable
ALTER TABLE "MonthlyExpense" ADD COLUMN     "category" TEXT;
ALTER TABLE "MonthlyExpense" ADD COLUMN     "sortOrder" INTEGER;
ALTER TABLE "MonthlyExpense" ADD COLUMN     "exchangeRate" DOUBLE PRECISION;
