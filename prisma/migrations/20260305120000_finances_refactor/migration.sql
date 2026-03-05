-- AlterTable
ALTER TABLE "kakeibo"."recurring_expense" ADD COLUMN "adapter_id" INTEGER;

-- AddForeignKey
ALTER TABLE "kakeibo"."recurring_expense" ADD CONSTRAINT "recurring_expense_adapter_id_fkey" FOREIGN KEY ("adapter_id") REFERENCES "kakeibo"."adapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Delete future open monthly budgets (and cascade their expenses)
DELETE FROM "kakeibo"."monthly_budget"
WHERE "status" = 'open'
AND ("year" > EXTRACT(YEAR FROM CURRENT_DATE)
  OR ("year" = EXTRACT(YEAR FROM CURRENT_DATE) AND "month" > EXTRACT(MONTH FROM CURRENT_DATE)));
