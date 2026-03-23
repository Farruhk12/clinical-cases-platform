-- Однократно для уже существующей БД, где у "User" ещё колонка email.
-- Если колонка уже называется login — пропустите этот файл или выполните только безопасные шаги.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'email'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'login'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "email" TO "login";
  END IF;
END $$;

DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_login_key" ON "User"("login");
