/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `idempotencyKey` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "idempotencyKey" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotencyKey_key" ON "transactions"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_idempotencyKey_fkey" FOREIGN KEY ("idempotencyKey") REFERENCES "IdempotencyKey"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
