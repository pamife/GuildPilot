-- CreateTable
CREATE TABLE "Giveaway" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "config" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "messageId" TEXT,
    "resultId" TEXT,
    "publication" INTEGER NOT NULL DEFAULT 0,
    "publishedRound" INTEGER NOT NULL DEFAULT 0,
    "refreshAt" DATETIME,
    "nextWorkAt" DATETIME,
    "error" TEXT,
    "seed" TEXT NOT NULL,
    "commitment" TEXT NOT NULL,
    "snapshotHash" TEXT,
    "snapshotAt" DATETIME,
    "poolHash" TEXT,
    "shortageAccepted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "giveawayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatar" TEXT,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" DATETIME,
    "exclusion" TEXT,
    "joinVerification" TEXT NOT NULL,
    "verification" TEXT NOT NULL,
    "eligibility" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "membership" TEXT NOT NULL,
    "requiredCheck" TEXT NOT NULL,
    "accountCheck" TEXT NOT NULL,
    "riskDecision" TEXT,
    "snapshot" TEXT,
    "snapshotStatus" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("giveawayId", "userId"),
    CONSTRAINT "GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GiveawayAttempt" (
    "giveawayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("giveawayId", "userId"),
    CONSTRAINT "GiveawayAttempt_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GiveawayDraw" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giveawayId" TEXT NOT NULL,
    "drawIndex" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "poolHash" TEXT NOT NULL,
    "poolSize" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    CONSTRAINT "GiveawayDraw_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GiveawayCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giveawayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verification" TEXT NOT NULL,
    "reason" TEXT,
    "policy" TEXT,
    "replacesId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "announcedAt" DATETIME,
    CONSTRAINT "GiveawayCandidate_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GiveawayCandidate_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "GiveawayDraw" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GiveawayClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deadline" DATETIME NOT NULL,
    "claimedAt" DATETIME,
    "fulfilledAt" DATETIME,
    "notes" TEXT,
    CONSTRAINT "GiveawayClaim_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "GiveawayCandidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GiveawayTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GiveawayAudit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "giveawayId" TEXT,
    "event" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GiveawayJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "giveawayId" TEXT,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSendAt" DATETIME,
    "lockUntil" DATETIME,
    "lockToken" TEXT,
    "tries" INTEGER NOT NULL DEFAULT 0,
    "doneAt" DATETIME,
    "messageId" TEXT,
    "error" TEXT
);

-- CreateIndex
CREATE INDEX "Giveaway_guildId_status_createdAt_idx" ON "Giveaway"("guildId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Giveaway_status_startAt_idx" ON "Giveaway"("status", "startAt");

-- CreateIndex
CREATE INDEX "Giveaway_status_endAt_idx" ON "Giveaway"("status", "endAt");

-- CreateIndex
CREATE INDEX "Giveaway_nextWorkAt_idx" ON "Giveaway"("nextWorkAt");

-- CreateIndex
CREATE INDEX "Giveaway_refreshAt_idx" ON "Giveaway"("refreshAt");

-- CreateIndex
CREATE INDEX "GiveawayEntry_giveawayId_withdrawnAt_enteredAt_idx" ON "GiveawayEntry"("giveawayId", "withdrawnAt", "enteredAt");

-- CreateIndex
CREATE INDEX "GiveawayEntry_giveawayId_eligibility_withdrawnAt_idx" ON "GiveawayEntry"("giveawayId", "eligibility", "withdrawnAt");

-- CreateIndex
CREATE INDEX "GiveawayEntry_giveawayId_snapshotStatus_idx" ON "GiveawayEntry"("giveawayId", "snapshotStatus");

-- CreateIndex
CREATE INDEX "GiveawayEntry_userId_idx" ON "GiveawayEntry"("userId");

-- CreateIndex
CREATE INDEX "GiveawayEntry_enteredAt_idx" ON "GiveawayEntry"("enteredAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayDraw_giveawayId_drawIndex_key" ON "GiveawayDraw"("giveawayId", "drawIndex");

-- CreateIndex
CREATE INDEX "GiveawayCandidate_giveawayId_slot_status_idx" ON "GiveawayCandidate"("giveawayId", "slot", "status");

-- CreateIndex
CREATE INDEX "GiveawayCandidate_userId_policy_idx" ON "GiveawayCandidate"("userId", "policy");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayCandidate_giveawayId_userId_key" ON "GiveawayCandidate"("giveawayId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayClaim_candidateId_key" ON "GiveawayClaim"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayClaim_token_key" ON "GiveawayClaim"("token");

-- CreateIndex
CREATE INDEX "GiveawayClaim_status_deadline_idx" ON "GiveawayClaim"("status", "deadline");

-- CreateIndex
CREATE INDEX "GiveawayClaim_guildId_status_idx" ON "GiveawayClaim"("guildId", "status");

-- CreateIndex
CREATE INDEX "GiveawayTemplate_guildId_updatedAt_idx" ON "GiveawayTemplate"("guildId", "updatedAt");

-- CreateIndex
CREATE INDEX "GiveawayAudit_guildId_id_idx" ON "GiveawayAudit"("guildId", "id");

-- CreateIndex
CREATE INDEX "GiveawayAudit_guildId_giveawayId_id_idx" ON "GiveawayAudit"("guildId", "giveawayId", "id");

-- CreateIndex
CREATE INDEX "GiveawayAudit_guildId_event_id_idx" ON "GiveawayAudit"("guildId", "event", "id");

-- CreateIndex
CREATE INDEX "GiveawayJob_doneAt_runAt_idx" ON "GiveawayJob"("doneAt", "runAt");

-- CreateIndex
CREATE INDEX "GiveawayJob_giveawayId_doneAt_idx" ON "GiveawayJob"("giveawayId", "doneAt");
