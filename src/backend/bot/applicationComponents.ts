import {
  ActionRowBuilder, ButtonBuilder, ContainerBuilder, MessageFlags, MessagePayload, MessageTarget,
  StringSelectMenuBuilder, TextDisplayBuilder,
} from "discord.js";

const noMentions = { parse: [] as [], repliedUser: false };

export type ApplicationActionRow = ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;

export function applicationMessage(body: string | ContainerBuilder, rows: ApplicationActionRow[] = []) {
  const container = typeof body === "string"
    ? new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
    : body;
  container.addActionRowComponents(rows);
  return { flags: MessageFlags.IsComponentsV2 as const, components: [container], allowedMentions: noMentions };
}

class ComponentsV2Edit extends MessagePayload {
  override resolveBody() {
    super.resolveBody();
    // discord.js serializes a null content option to "". Discord requires null when migrating a legacy message.
    Object.assign(this.body!, { content: null });
    return this;
  }
}

export function applicationMessageEdit(target: MessageTarget, body: Parameters<typeof applicationMessage>[0], rows?: ApplicationActionRow[]) {
  return new ComponentsV2Edit(target, { ...applicationMessage(body, rows), embeds: [] });
}
