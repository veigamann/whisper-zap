/*
  Warnings:

  - You are about to drop the `WhitelistedJID` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `chatJid` on the `ChatSetting` table. All the data in the column will be lost.
  - Added the required column `chatId` to the `ChatSetting` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "WhitelistedJID_jid_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "WhitelistedJID";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "WhitelistedUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);
INSERT INTO "new_ChatSetting" ("id", "key", "value") SELECT "id", "key", "value" FROM "ChatSetting";
DROP TABLE "ChatSetting";
ALTER TABLE "new_ChatSetting" RENAME TO "ChatSetting";
CREATE UNIQUE INDEX "ChatSetting_chatId_key_key" ON "ChatSetting"("chatId", "key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistedUser_userId_key" ON "WhitelistedUser"("userId");
