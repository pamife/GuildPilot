import { PrismaClient } from "@prisma/client";
import { plugins } from "../../types/plugins";

export const pluginDb = new PrismaClient();

export function getGuildPlugin(guildId: string, pluginId: string) {
  return pluginDb.guildPlugin.findUnique({ where: { guildId_pluginId: { guildId, pluginId } } });
}

export async function listGuildPlugins(guildId: string) {
  const rows = await pluginDb.guildPlugin.findMany({ where: { guildId } });
  const enabled = new Set(rows.filter((row) => row.enabled).map((row) => row.pluginId));
  return plugins.map((plugin) => ({ ...plugin, enabled: enabled.has(plugin.id) }));
}

export function saveGuildPlugin(guildId: string, pluginId: string, change: { enabled?: boolean; config?: string }) {
  return pluginDb.guildPlugin.upsert({
    where: { guildId_pluginId: { guildId, pluginId } },
    create: { guildId, pluginId, ...change },
    update: change,
  });
}

export class PluginError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
