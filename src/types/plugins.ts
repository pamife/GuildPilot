export const CHANGELOG_PLUGIN = "changelog-publisher";

export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  icon: "changelog";
  permission: "manage-server";
  configurable: boolean;
  experimental?: boolean;
}

export const plugins: readonly PluginDefinition[] = [{
  id: CHANGELOG_PLUGIN,
  name: "Changelog Publisher",
  description: "Create and publish beautiful changelog announcements directly to your Discord server using Components V2.",
  icon: "changelog",
  permission: "manage-server",
  configurable: true,
}];

export type PluginState = PluginDefinition & { enabled: boolean };
