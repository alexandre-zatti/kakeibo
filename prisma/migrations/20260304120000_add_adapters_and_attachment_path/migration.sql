-- AlterTable: Add attachment_path to expense_entry
ALTER TABLE "kakeibo"."expense_entry" ADD COLUMN IF NOT EXISTS "attachment_path" VARCHAR(500);

-- CreateTable
CREATE TABLE IF NOT EXISTS "kakeibo"."adapter" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "module_key" VARCHAR(100) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "household_id" INTEGER NOT NULL,

    CONSTRAINT "adapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "kakeibo"."adapter_run" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "completed_at" TIMESTAMP(3),
    "household_id" INTEGER NOT NULL,
    "monthly_budget_id" INTEGER NOT NULL,

    CONSTRAINT "adapter_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "kakeibo"."adapter_run_log" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "attachment_path" VARCHAR(500),
    "completed_at" TIMESTAMP(3),
    "adapter_run_id" INTEGER NOT NULL,
    "adapter_id" INTEGER NOT NULL,
    "expense_entry_id" INTEGER,

    CONSTRAINT "adapter_run_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "adapter_household_id_name_key" ON "kakeibo"."adapter"("household_id", "name");

-- AddForeignKey (idempotent using DO blocks)
DO $$ BEGIN
  ALTER TABLE "kakeibo"."adapter" ADD CONSTRAINT "adapter_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "kakeibo"."household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "kakeibo"."adapter_run" ADD CONSTRAINT "adapter_run_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "kakeibo"."household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "kakeibo"."adapter_run" ADD CONSTRAINT "adapter_run_monthly_budget_id_fkey" FOREIGN KEY ("monthly_budget_id") REFERENCES "kakeibo"."monthly_budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "kakeibo"."adapter_run_log" ADD CONSTRAINT "adapter_run_log_adapter_run_id_fkey" FOREIGN KEY ("adapter_run_id") REFERENCES "kakeibo"."adapter_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "kakeibo"."adapter_run_log" ADD CONSTRAINT "adapter_run_log_adapter_id_fkey" FOREIGN KEY ("adapter_id") REFERENCES "kakeibo"."adapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "kakeibo"."adapter_run_log" ADD CONSTRAINT "adapter_run_log_expense_entry_id_fkey" FOREIGN KEY ("expense_entry_id") REFERENCES "kakeibo"."expense_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
