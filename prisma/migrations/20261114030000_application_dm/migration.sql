-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "applicationId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "applicationRoles" TEXT;

-- AlterTable
ALTER TABLE "AppAnswer" ADD COLUMN "position" INTEGER;

-- CreateTable
CREATE TABLE "AppDmDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "questions" TEXT NOT NULL,
    "answers" TEXT NOT NULL DEFAULT '{}',
    "step" INTEGER NOT NULL DEFAULT 0,
    "editing" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "AppDmCursor" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT,
    "followupId" TEXT,
    "sinceId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AppFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT,
    "applicationId" TEXT,
    "followupId" TEXT,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    CONSTRAINT "AppFile_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AppDmDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppFile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppFile_followupId_fkey" FOREIGN KEY ("followupId") REFERENCES "AppFollowup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppFollowup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answer" TEXT,
    "answeredAt" DATETIME,
    CONSTRAINT "AppFollowup_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "AppForm" ADD COLUMN "dmPanelTitle" TEXT;
ALTER TABLE "AppForm" ADD COLUMN "dmPanelDescription" TEXT;
ALTER TABLE "AppForm" ADD COLUMN "dmPanelChannelId" TEXT;
ALTER TABLE "AppForm" ADD COLUMN "dmPanelMessageId" TEXT;
ALTER TABLE "AppForm" ADD COLUMN "dmPanelPostedChannelId" TEXT;
ALTER TABLE "AppForm" ADD COLUMN "reviewChannelId" TEXT;
ALTER TABLE "AppForm" ADD COLUMN "statusSteps" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "AppForm" ADD COLUMN "ticketCategoryId" TEXT;
ALTER TABLE "Application" ADD COLUMN "decisionById" TEXT;
ALTER TABLE "Application" ADD COLUMN "decisionByTag" TEXT;
ALTER TABLE "Application" ADD COLUMN "decidedAt" DATETIME;
ALTER TABLE "Application" ADD COLUMN "formName" TEXT;
ALTER TABLE "Application" ADD COLUMN "reviewerRoles" TEXT;
ALTER TABLE "Application" ADD COLUMN "progressStep" TEXT;
ALTER TABLE "Application" ADD COLUMN "progressPercent" INTEGER;
ALTER TABLE "Application" ADD COLUMN "statusDmId" TEXT;
ALTER TABLE "Application" ADD COLUMN "reviewChannelId" TEXT;
ALTER TABLE "Application" ADD COLUMN "reviewMessageId" TEXT;
ALTER TABLE "Application" ADD COLUMN "reviewParts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Application" ADD COLUMN "delivery" TEXT NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE UNIQUE INDEX "AppDmDraft_userId_formId_key" ON "AppDmDraft"("userId", "formId");

-- CreateIndex
CREATE INDEX "AppFile_draftId_idx" ON "AppFile"("draftId");

-- CreateIndex
CREATE INDEX "AppFile_applicationId_idx" ON "AppFile"("applicationId");

-- CreateIndex
CREATE INDEX "AppFollowup_applicationId_idx" ON "AppFollowup"("applicationId");

-- CreateIndex
CREATE INDEX "Ticket_applicationId_idx" ON "Ticket"("applicationId");
