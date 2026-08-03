import fs from "fs";
import path from "path";
import { TextChannel, Collection, Message } from "discord.js";

const TRANSCRIPTS_DIR = path.join(process.cwd(), "transcripts");

function ensureTranscriptsDir() {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  }
}

export function getTranscriptFilePath(ticketId: string): string {
  ensureTranscriptsDir();
  return path.join(TRANSCRIPTS_DIR, `ticket-${ticketId}.html`);
}

export async function generateHtmlTranscript(
  channel: TextChannel,
  ticketInfo: { number: number; creatorTag: string; category?: string }
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
    const avatar = msg.author.displayAvatarURL({ extension: "png", size: 64 });
    const timestamp = msg.createdAt.toLocaleString();
    const isBot = msg.author.bot;

    let contentHtml = msg.content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");

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
            ${embed.title ? `<div style="font-weight: bold; color: #fff; margin-bottom: 4px;">${embed.title}</div>` : ""}
            ${embed.description ? `<div style="color: #dbdee1; font-size: 13px;">${embed.description.replace(/\n/g, "<br/>")}</div>` : ""}
            ${
              embed.fields && embed.fields.length > 0
                ? `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-top: 8px;">
                    ${embed.fields
                      .map(
                        (f) =>
                          `<div><div style="font-size: 11px; font-weight: bold; color: #b5bac1;">${f.name}</div><div style="font-size: 13px; color: #dbdee1;">${f.value}</div></div>`
                      )
                      .join("")}
                   </div>`
                : ""
            }
          </div>`;
      });
    }

    messagesHtml += `
      <div class="transcript-message">
        <img class="avatar" src="${avatar}" alt="${msg.author.username}" />
        <div class="message-body">
          <div class="message-header">
            <span class="username">${msg.author.username}</span>
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
      Generated by GuildPilot Ticket Engine • ${guildName}
    </div>
  </div>
</body>
</html>`;

  const filePath = getTranscriptFilePath(channel.id);
  fs.writeFileSync(filePath, htmlDocument, "utf-8");
  return filePath;
}
