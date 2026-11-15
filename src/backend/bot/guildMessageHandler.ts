import { Client, Events, Message } from "discord.js";
import { serializeModeration } from "../services/moderationService";
import { processAutoModMessage } from "./autoModHandler";
import { handleCountingMessage } from "./countingHandler";
import { handleLevelingMessage } from "./levelingHandler";

export async function handleGuildMessage(message: Message) {
  // Application DMs have their own message listener.
  if (!message.guildId || message.author.bot || message.webhookId) return;

  let downstream: Promise<unknown> | undefined;
  await serializeModeration(`channel:${message.channelId}`, async () => {
    const deleted = await processAutoModMessage(message).catch(error => {
      console.error("[AutoMod] Could not process message:", error);
      return false;
    });
    if (deleted) return;

    // Start Counting/Leveling in gateway order without holding up the channel for their Discord feedback.
    downstream = Promise.all([handleCountingMessage(message), handleLevelingMessage(message)]);
  });
  await downstream;
}

export function setupGuildMessageHandler(client: Client) {
  client.on(Events.MessageCreate, message => {
    void handleGuildMessage(message).catch(error => console.error("[Guild Messages] Processing failed:", error));
  });
}
