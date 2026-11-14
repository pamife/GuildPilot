CREATE TABLE "LevelingSettings" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "minXp" INTEGER NOT NULL DEFAULT 15,
    "maxXp" INTEGER NOT NULL DEFAULT 25,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 60,
    "excludedChannelIds" TEXT NOT NULL DEFAULT '[]',
    "excludeRelay" BOOLEAN NOT NULL DEFAULT true,
    "announce" BOOLEAN NOT NULL DEFAULT false,
    "announcementId" TEXT,
    "rewards" TEXT NOT NULL DEFAULT '[]',
    "highestOnly" BOOLEAN NOT NULL DEFAULT false,
    "prestigeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "prestigeLevel" INTEGER NOT NULL DEFAULT 50
);

CREATE TABLE "LevelingMember" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "prestige" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "lastAwardAt" DATETIME,
    PRIMARY KEY ("guildId", "userId")
);
CREATE INDEX "LevelingMember_guildId_xp_userId_idx" ON "LevelingMember"("guildId", "xp", "userId");
CREATE INDEX "LevelingMember_guildId_prestige_userId_idx" ON "LevelingMember"("guildId", "prestige", "userId");

CREATE TABLE "LevelingMessage" (
    "messageId" TEXT NOT NULL PRIMARY KEY
);
