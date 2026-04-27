-- Make passwordHash nullable to support Firebase-only users (no local password)
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
