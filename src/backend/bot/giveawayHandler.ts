import { ButtonInteraction, Client, Events, MessageFlags } from "discord.js";
import { entryDeadline } from "../../types/giveaways";
import { giveawayInfo } from "./giveawayComponents";
import { expireClaims, respondToClaim, respondToPublicClaim } from "../services/giveaways/claims";
import { originalUrl, processJob, refreshAnnouncement, resultUrl } from "../services/giveaways/delivery";
import { drawInitial, publishResults } from "../services/giveaways/drawing";
import { advanceLifecycle, dueLifecycle } from "../services/giveaways/lifecycle";
import { buildSnapshot, participate, syncMemberChange } from "../services/giveaways/participants";
import { configOf, db, enabled, getGiveaway, system } from "../services/giveaways/store";
import { GiveawayInteractionError } from "../services/giveaways/validation";
import { PluginError } from "../services/pluginService";

const claimInfo = { status: true, deadline: true } as const;

async function infoTarget(interaction: ButtonInteraction, action: "info" | "dm-info", key: string) {
  const messageId = interaction.message.id;
  if (action === "dm-info") {
    if (interaction.guildId) throw new GiveawayInteractionError("Use the Info button in your direct message.");
    const winner = await db.giveawayCandidate.findFirst({
      where: { id: key, userId: interaction.user.id, announcedAt: { not: null } },
      include: { giveaway: true, claim: { select: claimInfo } },
    });
    if (!winner || !await db.giveawayJob.findFirst({
      where: { giveawayId: winner.giveawayId, kind: "DM", messageId, doneAt: { not: null } },
      select: { id: true },
    })) throw new GiveawayInteractionError("These giveaway details are unavailable.");
    return { row: winner.giveaway, claim: winner.claim };
  }
  if (!interaction.guild?.available) throw new GiveawayInteractionError("This Discord server is currently unavailable.");
  const row = await getGiveaway(interaction.guild.id, key);
  if (messageId !== row.messageId && messageId !== row.resultId && !await db.giveawayJob.findFirst({
    where: { giveawayId: row.id, kind: "RESULT", messageId, doneAt: { not: null } },
    select: { id: true },
  })) throw new GiveawayInteractionError("These giveaway details are unavailable.");
  const winner = row.resultId && await db.giveawayCandidate.findFirst({
    where: { giveawayId: row.id, userId: interaction.user.id, announcedAt: { not: null } },
    select: { claim: { select: claimInfo } },
  });
  return { row, claim: winner ? winner.claim : null };
}

async function replyWithInfo(interaction: ButtonInteraction, action: "info" | "dm-info", key: string) {
  const { row, claim } = await infoTarget(interaction, action, key);
  const config = configOf(row);
  const [count, acceptsEntries] = await Promise.all([
    db.giveawayEntry.count({ where: { giveawayId: row.id, withdrawnAt: null } }),
    row.status === "ACTIVE" && entryDeadline(row.endAt, config.rules) > new Date() && enabled(db, row.guildId),
  ]);
  await interaction.editReply(giveawayInfo(config, row, {
    count, acceptsEntries, claim,
    originalUrl: interaction.message.id === row.messageId ? null : originalUrl(row),
    resultsUrl: interaction.message.id === row.resultId ? null : resultUrl(row),
  }));
}

export function setupGiveaways(client: Client) {
  const tasks = new Set<string>();
  const run = (key: string, fn: () => Promise<unknown>) => {
    if (tasks.has(key)) return;
    tasks.add(key);
    void fn().catch(error => console.error(`[Giveaways] ${key}:`, error instanceof Error ? error.message : "Unknown error"))
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
    const now = new Date();
    run("queue existing announcement refresh", () => db.giveaway.updateMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] }, messageId: { not: null }, OR: [{ refreshAt: null }, { refreshAt: { gt: now } }] },
      data: { refreshAt: now },
    }));
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
    const match = /^gp-gw:(join|leave|claim|decline|public-claim|info|dm-info):([a-f0-9]{32})$/.exec(interaction.customId);
    if (!match) return;
    const [, action, key] = match;
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (action === "info" || action === "dm-info") {
        await replyWithInfo(interaction, action, key);
        return;
      }
      let message: string;
      if (action === "claim" || action === "decline") {
        if (interaction.guildId) throw new GiveawayInteractionError("Use the button in your direct message.");
        message = await respondToClaim(key, interaction.user, action);
      } else {
        if (!interaction.guild?.available) throw new GiveawayInteractionError("This Discord server is currently unavailable.");
        message = action === "public-claim"
          ? await respondToPublicClaim(interaction.guild.id, key, interaction.message.id, interaction.user)
          : await participate(interaction.guild, key, interaction.message.id, interaction.user, action === "join" ? "join" : "leave");
      }
      await interaction.editReply({ content: message, allowedMentions: { parse: [] } });
    } catch (error) {
      const content = error instanceof GiveawayInteractionError ? error.message : "We couldn’t complete this giveaway action.";
      if (interaction.deferred) await interaction.editReply({ content, allowedMentions: { parse: [] } }).catch(() => {});
    }
  });
}
