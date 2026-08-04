import fs from "fs";
import path from "path";
import { TextChannel, Collection, Message } from "discord.js";

const TRANSCRIPTS_DIR = path.join(process.cwd(), "transcripts");

function ensureTranscriptsDir() {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  }
}

export function getTranscriptFilePath(identifier: string, secondaryIdentifier?: string): string {
  ensureTranscriptsDir();
  const pathById = path.join(TRANSCRIPTS_DIR, `ticket-${identifier}.html`);
  if (fs.existsSync(pathById)) return pathById;

  if (secondaryIdentifier) {
    const pathBySec = path.join(TRANSCRIPTS_DIR, `ticket-${secondaryIdentifier}.html`);
    if (fs.existsSync(pathBySec)) return pathBySec;
  }

  // Fallback wildcard search in TRANSCRIPTS_DIR
  try {
    const files = fs.readdirSync(TRANSCRIPTS_DIR);
    const match = files.find(
      (f) =>
        f.endsWith(".html") &&
        (f.includes(identifier) || (secondaryIdentifier && f.includes(secondaryIdentifier)))
    );
    if (match) {
      return path.join(TRANSCRIPTS_DIR, match);
    }
  } catch (e) {}

  return pathById;
}

function formatDiscordText(text: string, guild?: any): string {
  if (!text) return "";

  // 1. Escape HTML special characters
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Resolve User Mentions: &lt;@!?([0-9]+)&gt;
  escaped = escaped.replace(/&lt;@!?([0-9]+)&gt;/g, (match, userId) => {
    if (guild) {
      const member = guild.members?.cache?.get(userId);
      if (member) return `<span class="mention">@${member.displayName || member.user.username}</span>`;
      const user = guild.client?.users?.cache?.get(userId);
      if (user) return `<span class="mention">@${user.username}</span>`;
    }
    return `<span class="mention">@User</span>`;
  });

  // 3. Resolve Role Mentions: &lt;@&amp;([0-9]+)&gt;
  escaped = escaped.replace(/&lt;@&amp;([0-9]+)&gt;/g, (match, roleId) => {
    if (guild) {
      const role = guild.roles?.cache?.get(roleId);
      if (role) {
        const colorStyle = role.hexColor && role.hexColor !== "#000000" ? `style="color: ${role.hexColor}; background-color: ${role.hexColor}20;"` : "";
        return `<span class="mention role-mention" ${colorStyle}>@${role.name}</span>`;
      }
    }
    return `<span class="mention role-mention">@Role</span>`;
  });

  // 4. Resolve Channel Mentions: &lt;#([0-9]+)&gt;
  escaped = escaped.replace(/&lt;#([0-9]+)&gt;/g, (match, channelId) => {
    if (guild) {
      const ch = guild.channels?.cache?.get(channelId);
      if (ch) return `<span class="mention channel-mention">#${ch.name}</span>`;
    }
    return `<span class="mention channel-mention">#channel</span>`;
  });

  // 5. Code blocks ```lang\ncode```
  escaped = escaped.replace(/```(?:[a-z0-9_-]+)?\n?([\s\S]*?)```/gi, (match, code) => {
    return `<pre><code>${code}</code></pre>`;
  });

  // 6. Inline code `code`
  escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 7. Bold **text**
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // 8. Underline __text__
  escaped = escaped.replace(/__([^_]+)__/g, "<u>$1</u>");

  // 9. Italic *text* or _text_
  escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  escaped = escaped.replace(/_([^_]+)_/g, "<em>$1</em>");

  // 10. Strikethrough ~~text~~
  escaped = escaped.replace(/~~([^~]+)~~/g, "<s>$1</s>");

  // 11. Newlines
  escaped = escaped.replace(/\n/g, "<br/>");

  return escaped;
}

export async function generateHtmlTranscript(
  channel: TextChannel,
  ticketInfo: { number: number; creatorTag: string; category?: string },
  customId?: string
): Promise<string> {
  ensureTranscriptsDir();

  // Fetch all messages in the channel (up to 500)
  let allMessages: Message[] = [];
  let lastId: string | undefined = undefined;

  while (allMessages.length < 500) {
    const fetched: Collection<string, Message> = await channel.messages.fetch({
      limit: 100,
      before: lastId,
    });
    if (fetched.size === 0) break;
    const array = Array.from(fetched.values());
    allMessages.push(...array);
    lastId = array[array.length - 1].id;
  }

  // Sort messages chronologically
  allMessages.reverse();

  const guildName = channel.guild ? channel.guild.name : "Discord Server";
  const guildIcon = channel.guild ? channel.guild.iconURL() || "" : "";
  const channelName = channel.name;
  const generatedAt = new Date().toLocaleString();

  let messagesHtml = "";

  for (const msg of allMessages) {
    const member = channel.guild?.members?.cache?.get(msg.author.id);
    const authorName = member?.displayName || msg.author.globalName || msg.author.username;
    const avatar = msg.author.displayAvatarURL({ extension: "png", size: 64 });
    const timestamp = msg.createdAt.toLocaleString();
    const isBot = msg.author.bot;

    let contentHtml = formatDiscordText(msg.content, channel.guild);

    // Format attachments
    let attachmentsHtml = "";
    if (msg.attachments.size > 0) {
      msg.attachments.forEach((att) => {
        const isImage = att.contentType?.startsWith("image/");
        if (isImage) {
          attachmentsHtml += `
            <div class="transcript-attachment">
              <a href="${att.url}" target="_blank">
                <img src="${att.url}" alt="${att.name}" style="max-width: 320px; max-height: 240px; border-radius: 8px; margin-top: 6px;" />
              </a>
            </div>`;
        } else {
          attachmentsHtml += `
            <div class="transcript-attachment" style="margin-top: 6px;">
              <a href="${att.url}" target="_blank" style="color: #00a8fc; text-decoration: underline;">
                📎 ${att.name} (${Math.round(att.size / 1024)} KB)
              </a>
            </div>`;
        }
      });
    }

    // Format embeds
    let embedsHtml = "";
    if (msg.embeds.length > 0) {
      msg.embeds.forEach((embed) => {
        const colorHex = embed.hexColor || "#5865F2";
        embedsHtml += `
          <div class="transcript-embed" style="border-left: 4px solid ${colorHex}; background: #2b2d31; padding: 12px; border-radius: 6px; margin-top: 8px; max-width: 520px;">
            ${embed.title ? `<div style="font-weight: bold; color: #fff; margin-bottom: 4px;">${formatDiscordText(embed.title, channel.guild)}</div>` : ""}
            ${embed.description ? `<div style="color: #dbdee1; font-size: 13px;">${formatDiscordText(embed.description, channel.guild)}</div>` : ""}
            ${
              embed.fields && embed.fields.length > 0
                ? `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-top: 8px;">
                    ${embed.fields
                      .map(
                        (f) =>
                          `<div><div style="font-size: 11px; font-weight: bold; color: #b5bac1;">${formatDiscordText(f.name, channel.guild)}</div><div style="font-size: 13px; color: #dbdee1;">${formatDiscordText(f.value, channel.guild)}</div></div>`
                      )
                      .join("")}
                   </div>`
                : ""
            }
          </div>`;
      });
    }

    // If contentHtml is empty on a non-bot message, Discord stripped message content due to missing Intent
    if (!contentHtml && !attachmentsHtml && !embedsHtml) {
      if (!isBot) {
        contentHtml = `<span style="color: #f87171; font-style: italic; font-size: 12px; background: rgba(248, 113, 113, 0.1); padding: 3px 8px; border-radius: 4px; display: inline-block;">⚠️ Message text hidden — Enable 'MESSAGE CONTENT INTENT' in Discord Developer Portal</span>`;
      } else {
        continue;
      }
    }

    messagesHtml += `
      <div class="transcript-message">
        <img class="avatar" src="${avatar}" alt="${authorName}" />
        <div class="message-body">
          <div class="message-header">
            <span class="username">${authorName}</span>
            ${isBot ? `<span class="bot-badge">BOT</span>` : ""}
            <span class="timestamp">${timestamp}</span>
          </div>
          ${contentHtml ? `<div class="message-content">${contentHtml}</div>` : ""}
          ${attachmentsHtml}
          ${embedsHtml}
        </div>
      </div>`;
  }

  const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Transcript - ${channelName}</title>
  <style>
    body {
      background-color: #313338;
      color: #dbdee1;
      font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
    }
    .header {
      background-color: #1e1f22;
      padding: 20px 30px;
      border-bottom: 1px solid #2b2d31;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-info {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .guild-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #5865f2;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: #fff;
    }
    .title {
      font-size: 20px;
      font-weight: bold;
      color: #f2f3f5;
    }
    .subtitle {
      font-size: 12px;
      color: #949ba4;
      margin-top: 2px;
    }
    .container {
      padding: 20px 30px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .transcript-message {
      display: flex;
      gap: 16px;
      margin-bottom: 18px;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .transcript-message:hover {
      background-color: #2e3035;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .message-body {
      flex: 1;
      min-width: 0;
    }
    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .username {
      font-weight: 600;
      color: #f2f3f5;
      font-size: 15px;
    }
    .bot-badge {
      background-color: #5865f2;
      color: #ffffff;
      font-size: 10px;
      font-weight: bold;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .timestamp {
      font-size: 11px;
      color: #949ba4;
    }
    .message-content {
      font-size: 14px;
      line-height: 1.375;
      color: #dbdee1;
      word-break: break-word;
    }
    .mention {
      background-color: rgba(88, 101, 242, 0.15);
      color: #c9cdfb;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
      display: inline-block;
      font-size: 13px;
    }
    .role-mention {
      background-color: rgba(88, 101, 242, 0.2);
      font-weight: 600;
    }
    .channel-mention {
      background-color: rgba(88, 101, 242, 0.15);
      color: #c9cdfb;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    code {
      background-color: #1e1f22;
      color: #dbdee1;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: Consolas, 'Andale Mono WT', 'Andale Mono', 'Lucida Console', Monaco, monospace;
      font-size: 13px;
    }
    pre {
      background-color: #1e1f22;
      border: 1px solid #2b2d31;
      padding: 10px 14px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: Consolas, 'Andale Mono WT', 'Andale Mono', 'Lucida Console', Monaco, monospace;
      color: #dbdee1;
      font-size: 13px;
      margin: 6px 0;
    }
    pre code {
      background: none;
      padding: 0;
    }
    strong {
      font-weight: 700;
      color: #f2f3f5;
    }
    em {
      font-style: italic;
    }
    u {
      text-decoration: underline;
    }
    s {
      text-decoration: line-through;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #35373c;
      text-align: center;
      font-size: 12px;
      color: #949ba4;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-info">
      ${
        guildIcon
          ? `<img src="${guildIcon}" class="guild-icon" alt="Guild Icon" />`
          : `<div class="guild-icon">${guildName.substring(0, 2).toUpperCase()}</div>`
      }
      <div>
        <div class="title">Ticket #${ticketInfo.number} (${channelName})</div>
        <div class="subtitle">Creator: ${ticketInfo.creatorTag} • Server: ${guildName}</div>
      </div>
    </div>
    <div style="text-align: right; font-size: 12px; color: #949ba4;">
      <div>Generated: ${generatedAt}</div>
      <div>Messages: ${allMessages.length}</div>
    </div>
  </div>

  <div class="container">
    ${messagesHtml || `<div style="text-align:center; padding: 40px; color: #949ba4;">No messages recorded in this ticket.</div>`}

    <div class="footer">
      Generated by TheGodGen Ticket Engine • ${guildName}
    </div>
  </div>
</body>
</html>`;

  const primaryId = customId || channel.id;
  const filePath = path.join(TRANSCRIPTS_DIR, `ticket-${primaryId}.html`);
  fs.writeFileSync(filePath, htmlDocument, "utf-8");

  // Save copy under channel.id if customId was provided and different
  if (customId && customId !== channel.id) {
    const channelPath = path.join(TRANSCRIPTS_DIR, `ticket-${channel.id}.html`);
    try {
      fs.writeFileSync(channelPath, htmlDocument, "utf-8");
    } catch (e) {}
  }

  return filePath;
}

export async function generateApplicationHtmlTranscript(
  app: any,
  channel?: TextChannel | null
): Promise<string> {
  ensureTranscriptsDir();

  const generatedAt = new Date().toLocaleString();
  const guildName = channel?.guild?.name || "Discord Server";
  const guildIcon = channel?.guild?.iconURL() || "";
  const statusColorMap: Record<string, string> = {
    PENDING: "#eab308",
    UNDER_REVIEW: "#3b82f6",
    CLAIMED: "#8b5cf6",
    ACCEPTED: "#22c55e",
    DENIED: "#ef4444",
    WAITLISTED: "#f97316",
    CLOSED: "#6b7280",
  };

  const statusColor = statusColorMap[app.status] || "#5865F2";

  // Build Answers HTML
  let answersHtml = "";
  if (app.answers && app.answers.length > 0) {
    answersHtml = app.answers
      .map(
        (ans: any, idx: number) => `
        <div style="background: #1e1f22; border: 1px solid #2b2d31; border-radius: 8px; padding: 14px; margin-bottom: 10px;">
          <div style="font-[11px]; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #5865F2; margin-bottom: 4px;">
            Question ${idx + 1}: ${ans.questionLabel}
          </div>
          <div style="font-size: 14px; color: #f2f3f5; white-space: pre-wrap; word-break: break-word;">${formatDiscordText(ans.value, channel?.guild)}</div>
        </div>`
      )
      .join("");
  } else {
    answersHtml = `<div style="color: #949ba4; font-style: italic;">No answers recorded.</div>`;
  }

  // Build Notes HTML
  let notesHtml = "";
  if (app.notes && app.notes.length > 0) {
    notesHtml = app.notes
      .map(
        (n: any) => `
        <div style="background: #1e1f22; border-left: 3px solid #8b5cf6; border-radius: 6px; padding: 10px 14px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 12px; font-weight: bold; color: #c084fc;">📌 ${n.authorTag}</span>
            <span style="font-size: 10px; color: #949ba4;">${new Date(n.createdAt).toLocaleString()}</span>
          </div>
          <div style="font-size: 13px; color: #dbdee1;">${formatDiscordText(n.content, channel?.guild)}</div>
        </div>`
      )
      .join("");
  } else {
    notesHtml = `<div style="color: #949ba4; font-size: 12px; font-style: italic;">No reviewer notes recorded.</div>`;
  }

  // Build History Timeline HTML
  let historyHtml = "";
  if (app.history && app.history.length > 0) {
    historyHtml = app.history
      .map(
        (h: any) => `
        <div style="display: flex; gap: 12px; font-size: 12px; color: #dbdee1; padding: 6px 0; border-bottom: 1px solid #2b2d31;">
          <span style="color: #949ba4; width: 140px; shrink: 0;">${new Date(h.timestamp).toLocaleString()}</span>
          <span style="font-weight: bold; color: #a855f7;">${h.status}</span>
          <span>by ${h.actorTag}</span>
          ${h.details ? `<span style="color: #949ba4;">(${h.details})</span>` : ""}
        </div>`
      )
      .join("");
  }

  // Build Channel Messages HTML if channel exists
  let channelMessagesHtml = "";
  if (channel && channel.isTextBased()) {
    try {
      const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
      if (messages && messages.size > 0) {
        const sortedMsgs = Array.from(messages.values()).reverse();
        channelMessagesHtml = sortedMsgs
          .map((msg) => {
            const author = msg.author.globalName || msg.author.username;
            const isBot = msg.author.bot;
            const content = formatDiscordText(msg.content, channel.guild);
            return `
              <div class="transcript-message">
                <img class="avatar" src="${msg.author.displayAvatarURL({ extension: "png" })}" alt="${author}" />
                <div class="message-body">
                  <div class="message-header">
                    <span class="username">${author}</span>
                    ${isBot ? `<span class="bot-badge">BOT</span>` : ""}
                    <span class="timestamp">${msg.createdAt.toLocaleString()}</span>
                  </div>
                  <div class="message-content">${content || "<em>No text content</em>"}</div>
                </div>
              </div>`;
          })
          .join("");
      }
    } catch (e) {}
  }

  const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Application #${app.appNumber} Transcript - ${app.userTag}</title>
  <style>
    body {
      background-color: #313338;
      color: #dbdee1;
      font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
    }
    .header {
      background-color: #1e1f22;
      padding: 24px 32px;
      border-bottom: 1px solid #2b2d31;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .status-badge {
      background-color: ${statusColor};
      color: #ffffff;
      font-weight: 800;
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .container {
      padding: 24px 32px;
      max-width: 1050px;
      margin: 0 auto;
    }
    .card {
      background-color: #2b2d31;
      border: 1px solid #35373c;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .card-title {
      font-size: 16px;
      font-weight: 700;
      color: #f2f3f5;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
      background: #1e1f22;
      padding: 14px;
      border-radius: 8px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 11px;
      color: #949ba4;
      text-transform: uppercase;
      font-weight: 700;
    }
    .meta-value {
      font-size: 13px;
      color: #ffffff;
      font-weight: 600;
      margin-top: 2px;
    }
    .transcript-message {
      display: flex;
      gap: 14px;
      margin-bottom: 14px;
      padding: 6px;
      border-radius: 6px;
    }
    .avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      object-fit: cover;
    }
    .message-body { flex: 1; }
    .message-header { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
    .username { font-weight: 600; color: #f2f3f5; font-size: 14px; }
    .bot-badge { background: #5865f2; color: #fff; font-size: 10px; font-weight: bold; padding: 1px 4px; border-radius: 3px; }
    .timestamp { font-size: 11px; color: #949ba4; }
    .message-content { font-size: 14px; color: #dbdee1; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; align-items: center; gap: 16px;">
      ${guildIcon ? `<img src="${guildIcon}" style="width: 48px; height: 48px; border-radius: 50%;" />` : ""}
      <div>
        <div style="font-size: 20px; font-weight: 800; color: #fff;">Application #${app.appNumber} — ${app.form?.name || "General Form"}</div>
        <div style="font-size: 12px; color: #949ba4; margin-top: 4px;">Applicant: ${app.userTag} (${app.userId}) • Server: ${guildName}</div>
      </div>
    </div>
    <div>
      <span class="status-badge">${app.status}</span>
    </div>
  </div>

  <div class="container">
    <div class="card">
      <div class="card-title">👤 Applicant Information</div>
      <div class="meta-grid">
        <div class="meta-item"><span class="meta-label">User Tag</span><span class="meta-value">${app.userTag}</span></div>
        <div class="meta-item"><span class="meta-label">User ID</span><span class="meta-value">${app.userId}</span></div>
        <div class="meta-item"><span class="meta-label">Account Created</span><span class="meta-value">${app.accountAge || "N/A"}</span></div>
        <div class="meta-item"><span class="meta-label">Server Joined</span><span class="meta-value">${app.joinDate || "N/A"}</span></div>
        <div class="meta-item"><span class="meta-label">Submitted At</span><span class="meta-value">${new Date(app.submittedAt).toLocaleString()}</span></div>
        <div class="meta-item"><span class="meta-label">Claimed By</span><span class="meta-value">${app.claimedByTag || "Unclaimed"}</span></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">📋 Submitted Question Answers</div>
      ${answersHtml}
    </div>

    <div class="card">
      <div class="card-title">📝 Reviewer Notes & Decision</div>
      ${app.decisionReason ? `<div style="background: #18191c; border-left: 4px solid ${statusColor}; padding: 12px; border-radius: 6px; margin-bottom: 12px; font-size: 13px;"><strong>Decision Reason:</strong> ${app.decisionReason}</div>` : ""}
      ${notesHtml}
    </div>

    <div class="card">
      <div class="card-title">⏳ Status Audit History</div>
      ${historyHtml || `<div style="color: #949ba4; font-size: 12px;">No history recorded.</div>`}
    </div>

    ${
      channelMessagesHtml
        ? `<div class="card">
            <div class="card-title">💬 Channel Messages Transcript</div>
            ${channelMessagesHtml}
          </div>`
        : ""
    }

    <div style="text-align: center; font-size: 12px; color: #949ba4; padding-top: 20px; border-top: 1px solid #35373c;">
      Generated by GuildPilot Applications Engine • ${generatedAt}
    </div>
  </div>
</body>
</html>`;

  const filePath = path.join(TRANSCRIPTS_DIR, `application-${app.id}.html`);
  fs.writeFileSync(filePath, htmlDocument, "utf-8");
  return filePath;
}

