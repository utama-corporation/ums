-- LoginAttempt: the recorded identifier is now a username, not necessarily an email.
ALTER TABLE "LoginAttempt" RENAME COLUMN "email" TO "username";

-- User: add username as the login identifier, backfilled from the existing email's
-- local-part for pre-existing rows, then enforced as required + unique.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
UPDATE "User" SET "username" = split_part("email", '@', 1) WHERE "username" IS NULL;
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
