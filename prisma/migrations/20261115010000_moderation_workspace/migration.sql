-- CreateTable
CREATE TABLE "ModerationLease" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GeminiSettings" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelIds" TEXT NOT NULL DEFAULT '[]',
    "rules" TEXT NOT NULL DEFAULT '',
    "channelRules" TEXT NOT NULL DEFAULT '{}',
    "reviewChannelId" TEXT,
    "maxMessages" INTEGER NOT NULL DEFAULT 50,
    "maxChars" INTEGER NOT NULL DEFAULT 1000,
    "maxCalls" INTEGER NOT NULL DEFAULT 3,
    "lastSuccessAt" DATETIME,
    "nextRunAt" DATETIME,
    "error" TEXT
);

-- CreateTable
CREATE TABLE "GeminiCursor" (
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "lastSuccessAt" DATETIME,
    "error" TEXT,

    PRIMARY KEY ("guildId", "channelId")
);

-- CreateTable
CREATE TABLE "GeminiHint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "references" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Additive upgrade: preserve all existing cases, sequences, settings and indexes.
ALTER TABLE "ModerationSettings" ADD COLUMN "permissions" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "ModerationSettings" ADD COLUMN "dmDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ModerationCase" ADD COLUMN "dmStatus" TEXT NOT NULL DEFAULT 'not_requested';
ALTER TABLE "ModerationCase" ADD COLUMN "logMessageUrl" TEXT;
ALTER TABLE "ModerationCase" ADD COLUMN "result" TEXT;
ALTER TABLE "ModerationCase" ADD COLUMN "reviewId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GeminiHint_dedupeKey_key" ON "GeminiHint"("dedupeKey");

-- CreateIndex
CREATE INDEX "GeminiHint_guildId_status_createdAt_idx" ON "GeminiHint"("guildId", "status", "createdAt");
