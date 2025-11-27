/*
  Warnings:

  - The primary key for the `IdempotencyKey` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[key]` on the table `IdempotencyKey` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `IdempotencyKey` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_idempotencyKey_fkey";

-- AlterTable
ALTER TABLE "IdempotencyKey" DROP CONSTRAINT "IdempotencyKey_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "mirrorTransactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_mirrorTransactionId_fkey" FOREIGN KEY ("mirrorTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_idempotencyKey_fkey" FOREIGN KEY ("idempotencyKey") REFERENCES "IdempotencyKey"("key") ON DELETE CASCADE ON UPDATE CASCADE;
