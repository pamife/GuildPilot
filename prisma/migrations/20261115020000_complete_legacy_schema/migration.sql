-- Complete pre-existing schema tables omitted from the original baseline.
-- IF NOT EXISTS supports installations previously synchronized with db push.
-- CreateTable
CREATE TABLE IF NOT EXISTS "ServerBackup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "guildIcon" TEXT,
    "backupName" TEXT NOT NULL,
    "backupType" TEXT NOT NULL DEFAULT 'MANUAL',
    "reason" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "channelsCount" INTEGER NOT NULL DEFAULT 0,
    "rolesCount" INTEGER NOT NULL DEFAULT 0,
    "emojisCount" INTEGER NOT NULL DEFAULT 0,
    "isBotInGuild" BOOLEAN NOT NULL DEFAULT true,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SelfRolePanel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayType" TEXT NOT NULL DEFAULT 'button',
    "layoutMode" TEXT NOT NULL DEFAULT 'components_v2',
    "multiSelect" BOOLEAN NOT NULL DEFAULT true,
    "placeholderText" TEXT DEFAULT 'Select roles...',
    "embedTitle" TEXT DEFAULT '🔔 Choose your Ping Roles',
    "embedDescription" TEXT DEFAULT 'Click a button below to receive or remove a role.',
    "embedColor" TEXT NOT NULL DEFAULT '#5865F2',
    "embedAuthorName" TEXT,
    "embedAuthorIcon" TEXT,
    "embedAuthorUrl" TEXT,
    "thumbnail" TEXT,
    "image" TEXT,
    "footer" TEXT DEFAULT 'GuildPilot Self Roles',
    "footerIcon" TEXT,
    "showTimestamp" BOOLEAN NOT NULL DEFAULT false,
    "embedFields" TEXT NOT NULL DEFAULT '[]',
    "addRoleMessage" TEXT DEFAULT '✅ Added role {role}!',
    "removeRoleMessage" TEXT DEFAULT '❌ Removed role {role}!',
    "ephemeralResponse" BOOLEAN NOT NULL DEFAULT true,
    "channelId" TEXT,
    "messageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SelfRoleOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "roleName" TEXT,
    "roleColor" TEXT,
    "label" TEXT,
    "emoji" TEXT,
    "buttonColor" TEXT NOT NULL DEFAULT 'Secondary',
    "description" TEXT,
    "showMemberCount" BOOLEAN NOT NULL DEFAULT true,
    "requiredRoles" TEXT NOT NULL DEFAULT '[]',
    "exclusiveGroup" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SelfRoleOption_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "SelfRolePanel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'components_v2',
    "channelId" TEXT,
    "messageId" TEXT,
    "content" TEXT,
    "flags" INTEGER DEFAULT 32768,
    "accentColor" TEXT DEFAULT '#5865F2',
    "spoiler" BOOLEAN NOT NULL DEFAULT false,
    "containerConfig" TEXT DEFAULT '[]',
    "embedConfig" TEXT DEFAULT '{}',
    "componentsConfig" TEXT DEFAULT '[]',
    "lastSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WelcomeSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "messageText" TEXT NOT NULL DEFAULT 'Welcome {user} to **{server}**!',
    "cardTitle" TEXT NOT NULL DEFAULT 'Welcome @{username}',
    "cardSubtitle" TEXT NOT NULL DEFAULT 'Member #{memberCount}',
    "avatarRingColor" TEXT NOT NULL DEFAULT '#00d2d3',
    "cardBgColor" TEXT NOT NULL DEFAULT '#18191c',
    "cardBorderColor" TEXT NOT NULL DEFAULT '#2b2d31',
    "cardBgImage" TEXT,
    "sendCard" BOOLEAN NOT NULL DEFAULT true,
    "sendDm" BOOLEAN NOT NULL DEFAULT false,
    "dmText" TEXT DEFAULT 'Welcome to {server}, {user}!',
    "autoRoles" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LeaveSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "messageText" TEXT NOT NULL DEFAULT '**{username}** has left the server. We will miss you!',
    "cardTitle" TEXT NOT NULL DEFAULT 'Goodbye @{username}',
    "cardSubtitle" TEXT NOT NULL DEFAULT 'Left {server} • {memberCount} members remain',
    "avatarRingColor" TEXT NOT NULL DEFAULT '#f43f5e',
    "cardBgColor" TEXT NOT NULL DEFAULT '#18191c',
    "cardBorderColor" TEXT NOT NULL DEFAULT '#2b2d31',
    "cardBgImage" TEXT,
    "sendCard" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AutoReact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channelIds" TEXT NOT NULL DEFAULT '[]',
    "emojis" TEXT NOT NULL DEFAULT '[]',
    "ignoreBots" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "discriminator" TEXT DEFAULT '0',
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "lastLoginAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WelcomeSetting_guildId_key" ON "WelcomeSetting"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LeaveSetting_guildId_key" ON "LeaveSetting"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_discordId_key" ON "User"("discordId");

