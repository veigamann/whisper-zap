-- CreateTable
CREATE TABLE "WhitelistedJID" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jid" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "GlobalSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ChatSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatJid" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistedJID_jid_key" ON "WhitelistedJID"("jid");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalSetting_key_key" ON "GlobalSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSetting_chatJid_key_key" ON "ChatSetting"("chatJid", "key");
