-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "prevMembershipPlanId" TEXT,
ADD COLUMN "prevMembershipStart" TIMESTAMP(3),
ADD COLUMN "prevMembershipEnd" TIMESTAMP(3),
ADD COLUMN "membershipApplied" BOOLEAN NOT NULL DEFAULT false;
