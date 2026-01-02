-- AlterTable
ALTER TABLE "Book" ADD COLUMN "fileHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Book_fileHash_key" ON "Book"("fileHash");
