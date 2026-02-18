-- CreateTable
CREATE TABLE "kakeibo"."household" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kakeibo"."household_member" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "household_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'owner',

    CONSTRAINT "household_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kakeibo"."category" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(50),
    "color" VARCHAR(7),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "household_id" INTEGER NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kakeibo"."monthly_budget" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "closed_at" TIMESTAMP(3),
    "bank_balance" DECIMAL(10,2),
    "household_id" INTEGER NOT NULL,

    CONSTRAINT "monthly_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kakeibo"."income_entry" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "monthly_budget_id" INTEGER NOT NULL,

    CONSTRAINT "income_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kakeibo"."expense_entry" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "monthly_budget_id" INTEGER NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMP(3),
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "savings_box_id" INTEGER,
    "recurring_expense_id" INTEGER,

    CONSTRAINT "expense_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kakeibo"."recurring_expense" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "household_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "day_of_month" INTEGER,

    CONSTRAINT "recurring_expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kakeibo"."savings_box" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monthly_target" DECIMAL(10,2),
    "goal_amount" DECIMAL(10,2),
    "icon" VARCHAR(50),
    "color" VARCHAR(7),
    "household_id" INTEGER NOT NULL,

    CONSTRAINT "savings_box_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kakeibo"."savings_transaction" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" VARCHAR(255),
    "savings_box_id" INTEGER NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',

    CONSTRAINT "savings_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "household_member_household_id_user_id_key" ON "kakeibo"."household_member"("household_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_household_id_name_type_key" ON "kakeibo"."category"("household_id", "name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_budget_household_id_year_month_key" ON "kakeibo"."monthly_budget"("household_id", "year", "month");

-- AddForeignKey
ALTER TABLE "kakeibo"."household_member" ADD CONSTRAINT "household_member_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "kakeibo"."household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."household_member" ADD CONSTRAINT "household_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kakeibo"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."category" ADD CONSTRAINT "category_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "kakeibo"."household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."monthly_budget" ADD CONSTRAINT "monthly_budget_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "kakeibo"."household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."income_entry" ADD CONSTRAINT "income_entry_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "kakeibo"."category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."income_entry" ADD CONSTRAINT "income_entry_monthly_budget_id_fkey" FOREIGN KEY ("monthly_budget_id") REFERENCES "kakeibo"."monthly_budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."expense_entry" ADD CONSTRAINT "expense_entry_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "kakeibo"."category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."expense_entry" ADD CONSTRAINT "expense_entry_monthly_budget_id_fkey" FOREIGN KEY ("monthly_budget_id") REFERENCES "kakeibo"."monthly_budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."expense_entry" ADD CONSTRAINT "expense_entry_savings_box_id_fkey" FOREIGN KEY ("savings_box_id") REFERENCES "kakeibo"."savings_box"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."expense_entry" ADD CONSTRAINT "expense_entry_recurring_expense_id_fkey" FOREIGN KEY ("recurring_expense_id") REFERENCES "kakeibo"."recurring_expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."recurring_expense" ADD CONSTRAINT "recurring_expense_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "kakeibo"."category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."recurring_expense" ADD CONSTRAINT "recurring_expense_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "kakeibo"."household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."savings_box" ADD CONSTRAINT "savings_box_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "kakeibo"."household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakeibo"."savings_transaction" ADD CONSTRAINT "savings_transaction_savings_box_id_fkey" FOREIGN KEY ("savings_box_id") REFERENCES "kakeibo"."savings_box"("id") ON DELETE CASCADE ON UPDATE CASCADE;
