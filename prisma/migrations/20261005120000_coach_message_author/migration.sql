-- Autor (usuario del staff) de cada mensaje del chat de coaching
ALTER TABLE "CoachMessage" ADD COLUMN IF NOT EXISTS "authorUserId" TEXT;
ALTER TABLE "CoachMessage" ADD COLUMN IF NOT EXISTS "authorName" TEXT;
