CREATE TABLE "GuildPlugin" (
    "guildId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY ("guildId", "pluginId")
);

CREATE TABLE "GuildChangelog" (
    "guildId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    "channelId" TEXT,
    "channelName" TEXT,
    "messageId" TEXT,
    "pingMessageId" TEXT,
    "publishedAt" DATETIME,
    "publisherId" TEXT,
    "publisherName" TEXT,
    PRIMARY KEY ("guildId", "id")
);

CREATE INDEX "GuildChangelog_guildId_status_updatedAt_idx" ON "GuildChangelog"("guildId", "status", "updatedAt");
