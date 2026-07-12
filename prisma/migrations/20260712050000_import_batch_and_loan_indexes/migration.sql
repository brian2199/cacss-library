-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'COMPLETED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_fileHash_idx" ON "ImportBatch"("fileHash");

-- CreateIndex
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

-- CreateIndex
CREATE INDEX "Loan_itemCopyId_status_idx" ON "Loan"("itemCopyId", "status");

-- CreateIndex
CREATE INDEX "Loan_memberProfileId_status_idx" ON "Loan"("memberProfileId", "status");

-- CreateIndex
CREATE INDEX "Loan_dueDate_status_idx" ON "Loan"("dueDate", "status");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
