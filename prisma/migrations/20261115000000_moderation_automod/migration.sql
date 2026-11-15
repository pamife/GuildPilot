-- CreateTable
CREATE TABLE "ModerationSettings" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "logChannelId" TEXT,
    "reviewRoleIds" TEXT NOT NULL DEFAULT '[]',
    "timeoutRoleIds" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "AutoModSettings" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "rules" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ModerationCaseSequence" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "lastNumber" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "ModerationCase" (
    "guildId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "moderatorId" TEXT,
    "ruleIds" TEXT,
    "durationSeconds" INTEGER,
    "timeoutUntil" DATETIME,
    "reversesCaseNumber" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("guildId", "number")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModerationCase_sourceId_key" ON "ModerationCase"("sourceId");

-- CreateIndex
CREATE INDEX "ModerationCase_guildId_targetId_number_idx" ON "ModerationCase"("guildId", "targetId", "number");
