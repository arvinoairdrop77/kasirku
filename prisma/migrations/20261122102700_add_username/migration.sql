ALTER TABLE "User" ADD COLUMN "username" TEXT;

DO $$
DECLARE
  user_row RECORD;
  candidate TEXT;
  suffix INTEGER;
BEGIN
  FOR user_row IN
    SELECT "id", split_part("email", '@', 1) AS base_username
    FROM "User"
    ORDER BY "id"
  LOOP
    candidate := user_row.base_username;
    suffix := 1;

    WHILE EXISTS (
      SELECT 1 FROM "User" WHERE "username" = candidate
    ) LOOP
      candidate := user_row.base_username || '_' || suffix;
      suffix := suffix + 1;
    END LOOP;

    UPDATE "User"
    SET "username" = candidate
    WHERE "id" = user_row."id";
  END LOOP;
END $$;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
