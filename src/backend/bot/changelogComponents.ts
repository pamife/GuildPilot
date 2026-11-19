import {
  ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageCreateOptions,
  MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder,
} from "discord.js";
import {
  ChangelogContent, changelogDate, changelogHeading, changelogPublishError, changelogSectionText, discordText,
} from "../../types/changelog";
import { PluginError } from "../services/pluginService";

export function buildChangelogAnnouncement(content: ChangelogContent, date: Date): MessageCreateOptions {
  const error = changelogPublishError(content);
  if (error) throw new PluginError(400, error);

  const container = new ContainerBuilder().setAccentColor(Number.parseInt(content.color.slice(1), 16));
  const addText = (value: string) => container.addTextDisplayComponents(new TextDisplayBuilder().setContent(value));
  const addSeparator = () => container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  addText(`# ${discordText(changelogHeading(content))}`);
  if (content.intro) addText(discordText(content.intro));
  if (content.banner) container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(content.banner)),
  );
  addSeparator();
  for (const section of content.sections) addText(changelogSectionText(section));
  addSeparator();
  addText([changelogDate(content.language, date), discordText(content.footer)].filter(Boolean).map((line) => `-# ${line}`).join("\n"));

  // Count the container as well as its children against Discord's message-wide limit.
  if (container.components.length + 1 > 40) throw new PluginError(400, "Der Changelog überschreitet Discords Limit von 40 Komponenten.");
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container.toJSON()],
    allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
  };
}

export function buildChangelogPing(roleId: string): MessageCreateOptions {
  return {
    content: `<@&${roleId}>`,
    allowedMentions: { parse: [], users: [], roles: [roleId], repliedUser: false },
  };
}
