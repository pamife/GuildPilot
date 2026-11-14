import { mkdir, rename, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { Attachment } from "discord.js";

const directory = path.resolve(process.cwd(), "transcripts", "application-files");

export function applicationFilePath(id: string) {
  if (!/^\d{16,22}$/.test(id)) throw new Error("Invalid attachment ID.");
  return path.join(directory, id);
}

export async function storeApplicationFiles(attachments: Iterable<Attachment>) {
  const stored: { id: string; name: string; size: number }[] = [];
  try {
    for (const attachment of attachments) {
      const dest = applicationFilePath(attachment.id);
      const temp = `${dest}.${randomUUID()}.tmp`;
      try {
        const url = new URL(attachment.url);
        if (url.protocol !== "https:" || !["cdn.discordapp.com", "media.discordapp.net"].includes(url.hostname)) {
          throw new Error("Invalid Discord attachment URL.");
        }
        const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60_000) });
        if (!response.ok || !response.body) throw new Error("Discord attachment is unavailable.");
        await mkdir(directory, { recursive: true, mode: 0o700 });
        let size = 0;
        const checkSize = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            size += chunk.length;
            callback(size > attachment.size ? new Error("Attachment size exceeded.") : null, chunk);
          },
        });
        await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), checkSize,
          createWriteStream(temp, { flags: "wx", mode: 0o600 }));
        if (size !== attachment.size) throw new Error("Attachment was incomplete.");
        await rename(temp, dest);
        stored.push({ id: attachment.id, name: attachment.name, size });
      } finally {
        await rm(temp, { force: true }).catch(() => undefined);
      }
    }
    return stored;
  } catch (error) {
    await removeApplicationFiles(stored);
    throw error;
  }
}

export async function removeApplicationFiles(files: { id: string }[]) {
  await Promise.all(files.map(file => rm(applicationFilePath(file.id), { force: true }).catch(error => {
    console.warn("[Applications] Could not remove attachment", file.id, error);
  })));
}
