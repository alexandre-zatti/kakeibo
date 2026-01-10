/*
  Warnings:

  - Added the required column `user_id` to the `purchase` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "kakeibo"."purchase" ADD COLUMN     "store_name" VARCHAR(255),
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "kakeibo"."purchase" ADD CONSTRAINT "purchase_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kakeibo"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
