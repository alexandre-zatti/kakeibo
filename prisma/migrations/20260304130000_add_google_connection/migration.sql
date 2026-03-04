-- CreateTable
CREATE TABLE IF NOT EXISTS "kakeibo"."google_connection" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "household_id" INTEGER NOT NULL,

    CONSTRAINT "google_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "google_connection_household_id_key" ON "kakeibo"."google_connection"("household_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "kakeibo"."google_connection" ADD CONSTRAINT "google_connection_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "kakeibo"."household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
