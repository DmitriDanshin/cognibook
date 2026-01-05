-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "coverPath" TEXT,
    "filePath" TEXT,
    "fileHash" TEXT,
    "fileSize" INTEGER,
    "sourceType" TEXT NOT NULL DEFAULT 'file',
    "youtubeVideoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Book" ("author", "coverPath", "createdAt", "fileHash", "filePath", "fileSize", "id", "title", "updatedAt", "userId") SELECT "author", "coverPath", "createdAt", "fileHash", "filePath", "fileSize", "id", "title", "updatedAt", "userId" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE UNIQUE INDEX "Book_filePath_key" ON "Book"("filePath");
CREATE UNIQUE INDEX "Book_fileHash_userId_key" ON "Book"("fileHash", "userId");
CREATE UNIQUE INDEX "Book_youtubeVideoId_userId_key" ON "Book"("youtubeVideoId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
