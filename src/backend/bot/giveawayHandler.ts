import { Client, Events, MessageFlags } from "discord.js";
import { expireClaims, respondToClaim, respondToPublicClaim } from "../services/giveaways/claims";
import { processJob, refreshAnnouncement } from "../services/giveaways/delivery";
import { drawInitial, publishResults } from "../services/giveaways/drawing";
import { advanceLifecycle, dueLifecycle } from "../services/giveaways/lifecycle";
import { buildSnapshot, participate, syncMemberChange } from "../services/giveaways/participants";
import { configOf, db, system } from "../services/giveaways/store";
import { PluginError } from "../services/pluginService";

export function setupGiveaways(client: Client) {
  const tasks = new Set<string>();
  const run = (key: string, fn: () => Promise<unknown>) => {
    if (tasks.has(key)) return;
    tasks.add(key);
    void fn().catch(error => console.error(`[Giveaways] ${key}:`, error instanceof Error ? error.message : "Unbekannter Fehler"))
      .finally(() => tasks.delete(key));
  };

  function tick() {
    if (!client.isReady()) return;
    run("lifecycle", async () => {
      for (const row of await dueLifecycle()) await advanceLifecycle(row);
      await expireClaims();
    });
    run("review", async () => {
      const rows = await db.giveaway.findMany({ where: { nextWorkAt: { lte: new Date() } }, orderBy: { nextWorkAt: "asc" }, take: 8 });
      await Promise.allSettled(rows.map(async row => {
        const guild = client.guilds.cache.get(row.guildId);
        if (!guild?.available) {
          await db.giveaway.updateMany({ where: { id: row.id, revision: row.revision }, data: { nextWorkAt: new Date(Date.now() + 60_000) } });
          return;
        }
        try {
          if (row.status === "ENDED") {
            await buildSnapshot(guild, row);
          } else if (row.status === "DRAW_PENDING" && configOf(row).autoFinalize) {
            await drawInitial(row.guildId, row.id, system, row.revision);
          } else if (row.status === "WINNER_REVIEW" && configOf(row).autoFinalize) {
            await publishResults(guild, row.id, system, row.revision);
          }
          await db.giveaway.updateMany({
            where: { id: row.id, nextWorkAt: row.nextWorkAt, status: row.status },
            data: { nextWorkAt: row.status === "ENDED" ? new Date() : null },
          });
        } catch (error) {
          if (!(error instanceof PluginError && error.status === 409)) console.warn("[Giveaways] Verification worker will retry", error);
          await db.giveaway.updateMany({
            where: { id: row.id, revision: row.revision }, data: { nextWorkAt: new Date(Date.now() + 15_000) },
          });
        }
      }));
    });
    run("delivery", async () => {
      const available = 10 - [...tasks].filter(key => key.startsWith("job-")).length;
      if (available <= 0) return;
      const now = new Date();
      const jobs = await db.giveawayJob.findMany({
        where: { doneAt: null, runAt: { lte: now }, OR: [{ lockUntil: null }, { lockUntil: { lt: now } }] },
        select: { id: true }, orderBy: { runAt: "asc" }, take: available,
      });
      for (const { id } of jobs) run(`job-${id}`, () => processJob(client, id));
    });
    run("announcement refresh", async () => {
      const rows = await db.giveaway.findMany({
        where: { refreshAt: { lte: new Date() }, messageId: { not: null } }, orderBy: { refreshAt: "asc" }, take: 10,
      });
      for (const row of rows) {
        const guild = client.guilds.cache.get(row.guildId);
        if (guild?.available) run(`refresh-${row.id}`, () => refreshAnnouncement(guild, row));
        else await db.giveaway.updateMany({ where: { id: row.id, refreshAt: row.refreshAt }, data: { refreshAt: new Date(Date.now() + 60_000) } });
      }
    });
  }

  client.once(Events.ClientReady, () => {
    tick();
    const timer = setInterval(tick, 4_000);
    timer.unref();
  });

  const sync = (guildId: string, userId: string, member: Parameters<typeof syncMemberChange>[2]) => {
    void syncMemberChange(guildId, userId, member).catch(error => console.warn("[Giveaways] Could not sync member change:", error));
  };
  client.on(Events.GuildMemberAdd, member => sync(member.guild.id, member.id, member));
  client.on(Events.GuildMemberRemove, member => sync(member.guild.id, member.id, "LEFT"));
  client.on(Events.GuildMemberUpdate, (before, after) => {
    if (before.displayName !== after.displayName || before.user?.avatar !== after.user.avatar ||
      before.roles.cache.size !== after.roles.cache.size || after.roles.cache.some(role => !before.roles.cache.has(role.id))) {
      sync(after.guild.id, after.id, after);
    }
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() || !interaction.customId.startsWith("gp-gw:")) return;
    const match = /^gp-gw:(join|leave|claim|decline|public-claim):([a-f0-9]{32})$/.exec(interaction.customId);
    if (!match) return;
    const [, action, key] = match;
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let message: string;
      if (action === "claim" || action === "decline") {
        if (interaction.guildId) throw new PluginError(400, "Verwende den Button in deiner Direktnachricht.");
        message = await respondToClaim(key, interaction.user, action);
      } else {
        if (!interaction.guild?.available) throw new PluginError(503, "Der Discord-Server ist gerade nicht erreichbar.");
        message = action === "public-claim"
          ? await respondToPublicClaim(interaction.guild.id, key, interaction.message.id, interaction.user)
          : await participate(interaction.guild, key, interaction.message.id, interaction.user, action === "join" ? "join" : "leave");
      }
      await interaction.editReply({ content: message, allowedMentions: { parse: [] } });
    } catch (error) {
      const content = error instanceof PluginError && error.status !== 404 ? error.message : "Diese Giveaway-Aktion konnte nicht abgeschlossen werden.";
      if (interaction.deferred) await interaction.editReply({ content, allowedMentions: { parse: [] } }).catch(() => {});
    }
  });
}
