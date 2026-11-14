CREATE TABLE "CountingGame" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "nextNumber" TEXT NOT NULL DEFAULT '1',
    "record" TEXT NOT NULL DEFAULT '0',
    "lastPlayerId" TEXT,
    "recentPlayers" TEXT NOT NULL DEFAULT '[]',
    "saveStatus" TEXT NOT NULL DEFAULT 'available'
);

CREATE TABLE "CountingMessage" (
    "messageId" TEXT NOT NULL PRIMARY KEY
);
