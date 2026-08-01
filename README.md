# 🛸 GuildPilot

**GuildPilot** is a personal, local-only Discord server management bot and modern web dashboard built with Node.js, TypeScript, Discord.js v14, Express, Next.js, React, Tailwind CSS, SQLite (Prisma ORM), and Socket.IO.

Designed as a lightweight, powerful Discord server structure editor that runs completely on your local computer.

---

## 🌟 Key Features

- **OAuth2 Discord Login & Single Owner Security**:
  - Restricts dashboard access strictly to your personal Discord account (`ALLOWED_USER_ID`).
  - No public registration, multi-user bloat, or cloud hosting required.
- **📊 Overview**:
  - Real-time connected server metrics (member count, channel count, role count, emojis, stickers, active invites).
  - Bot runtime diagnostics (uptime, gateway ping, connection state).
- **💬 Channel Manager**:
  - Create Text, Voice, Category, and Forum channels.
  - Modify topic, NSFW status, slowmode cooldowns, parent category, and position.
  - Duplicate or delete channels instantly.
- **📁 Category Manager**:
  - Create, rename, or delete categories.
  - Move channels seamlessly between categories.
- **🎭 Role Manager**:
  - Create roles with custom hex colors, hoist options, and mentionable toggles.
  - Interactive permissions matrix bitfield editor (Administrator, Manage Channels, Manage Roles, Send Messages, etc.).
  - Drag-and-drop / single-click role hierarchy reordering.
- **⚙️ Server Settings**:
  - Edit server name, icon URL, and description.
  - Configure Verification Levels (None to Very High), Default Notification levels, AFK voice channels, and AFK timeouts.
- **😄 Emoji & Sticker Manager**:
  - Upload custom emojis (Base64 file upload or image URL) and stickers (PNG/APNG attachments).
  - Rename emojis and delete custom assets.
- **🔗 Invite Manager**:
  - Generate custom invite links with configurable expiration (30m to Never), max uses, and temporary membership flags.
  - One-click invite link copying and instant link revoking.
- **📐 Templates & Layout Library**:
  - Save current server layout (channels, categories, roles) as reusable JSON templates into local SQLite.
  - Apply layout templates to recreate server structures effortlessly.
  - Quick duplicator for individual channels or whole categories.
- **⚡ Utilities & Bulk Operations**:
  - Universal real-time search across channels, roles, and emojis.
  - Bulk channel creator (multiline text input).
  - Bulk channel batch renaming (pattern search & replace).
- **⚡ Real-Time Socket.IO Updates**:
  - Instant live dashboard updates whenever channels, roles, or server settings change on Discord.

---

## 🚫 Intentionally Excluded Features
As per design specifications, GuildPilot excludes moderation features (kick/ban/mute/warn/automod) and community bloat (economy, tickets, leveling, reaction roles, music, fun commands) to focus purely on server structure editing.

---

## 🚀 Quick Start Guide

### 1. Requirements
- Node.js (v18 or higher)
- npm / pnpm / yarn

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your credentials from the [Discord Developer Portal](https://discord.com/developers/applications):

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:3001/api/auth/callback
ALLOWED_USER_ID=your_discord_user_id
JWT_SECRET=your_secret_key
DATABASE_URL="file:./dev.db"
```

### 3. Initialize Database
Initialize the SQLite database schema via Prisma:
```bash
npx prisma db push
```

### 4. Run GuildPilot Locally
Start both the Express+Discord.js backend (port 3001) and Next.js frontend (port 3000) concurrently:
```bash
npm run dev
```

Open your browser at [http://localhost:3000](http://localhost:3000).

---

## 🛠️ Tech Stack

- **Core & Runtime**: Node.js, TypeScript
- **Discord Integration**: Discord.js v14
- **Backend API & Realtime**: Express.js, Socket.IO
- **Database**: SQLite, Prisma ORM
- **Frontend App**: Next.js 14, React 18, Tailwind CSS, Lucide Icons, Framer Motion

---

## 📜 License
MIT License - Personal Use
