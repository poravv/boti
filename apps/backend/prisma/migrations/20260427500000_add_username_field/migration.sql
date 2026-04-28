-- Add username field for team operators (email-free login)
-- email becomes nullable; username is optional unique identifier

ALTER TABLE "User" ADD COLUMN "username" TEXT;

ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_username_idx" ON "User"("username");
