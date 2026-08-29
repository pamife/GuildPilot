export type TicketActionType =
  | "CREATE_TICKET"
  | "CLOSE_TICKET"
  | "CLAIM_TICKET"
  | "REOPEN_TICKET"
  | "DELETE_TICKET"
  | "ADD_USER"
  | "REMOVE_USER"
  | "TRANSCRIPT"
  | "EPHEMERAL_REPLY"
  | "LINK"
  | "CUSTOM_ID";

export type ButtonStyleType = "Primary" | "Secondary" | "Success" | "Danger" | "Link";

export interface IntakeQuestionItem {
  id: string;
  label: string;
  placeholder?: string;
  style: "short" | "paragraph";
  required: boolean;
  minLength?: number;
  maxLength?: number;
}

export interface TicketTypeConfig {
  id: string;
  name: string;
  label: string;
  emoji?: string;
  description?: string;
  categoryId?: string;
  namingFormat?: string; // e.g. "ticket-{username}", "tech-{username}", "bug-{number}"
  supportRoles?: string[];
  additionalRoles?: string[];
  questions?: IntakeQuestionItem[];
  autoCloseEnabled?: boolean;
  autoCloseHours?: number;
  maxTicketsPerUser?: number;
  welcomeTitle?: string;
  welcomeDescription?: string;
  welcomeColor?: string;
  welcomeThumbnail?: string;
  welcomeImage?: string;
  welcomeFooter?: string;
}

export interface ButtonComponentItem {
  id: string;
  style: ButtonStyleType | number;
  label: string;
  emoji?: string;
  url?: string;
  customId?: string;
  disabled?: boolean;
  actionType?: TicketActionType;
  ticketTypeId?: string;
  ephemeralText?: string;
}

export interface SelectOptionItem {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  default?: boolean;
  actionType?: TicketActionType;
  ticketTypeId?: string;
  ephemeralText?: string;
}

export interface SelectMenuComponentItem {
  id: string;
  type: "string_select" | "user_select" | "role_select" | "channel_select" | "mentionable_select";
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
  channelTypes?: number[];
  options?: SelectOptionItem[];
  actionType?: TicketActionType;
  ticketTypeId?: string;
}

export interface TextDisplayComponentItem {
  id: string;
  type: "text";
  content: string;
}

export interface SeparatorComponentItem {
  id: string;
  type: "separator";
  divider?: boolean;
  spacing?: number;
}

export interface MediaGalleryComponentItem {
  id: string;
  type: "media_gallery";
  items: Array<{
    url: string;
    description?: string;
    spoiler?: boolean;
  }>;
}

export interface SectionComponentItem {
  id: string;
  type: "section";
  content?: string;
  accessory?: {
    type: "thumbnail" | "button";
    url?: string;
    spoiler?: boolean;
    style?: ButtonStyleType | number;
    label?: string;
    emoji?: string;
    customId?: string;
    disabled?: boolean;
    actionType?: TicketActionType;
    ticketTypeId?: string;
    ephemeralText?: string;
  };
}

export interface ActionRowComponentItem {
  id: string;
  type: "action_row";
  rowType?: "buttons" | "select";
  buttons?: ButtonComponentItem[];
  selectMenu?: SelectMenuComponentItem;
}

export type TicketPanelComponentItem =
  | TextDisplayComponentItem
  | SeparatorComponentItem
  | MediaGalleryComponentItem
  | SectionComponentItem
  | ActionRowComponentItem;

export interface TicketPanelData {
  id?: string;
  guildId: string;
  name: string;
  description?: string | null;
  layoutMode: "components_v2" | "embed";
  channelId?: string | null;
  messageId?: string | null;
  accentColor?: string | null;
  spoiler?: boolean;
  containerConfig: TicketPanelComponentItem[];
  ticketTypesConfig: TicketTypeConfig[];

  // Legacy fields (for fallback and conversion)
  embedTitle?: string | null;
  embedDescription?: string | null;
  embedColor?: string;
  thumbnail?: string | null;
  image?: string | null;
  footer?: string | null;
  welcomeTitle?: string | null;
  welcomeDescription?: string | null;
  welcomeColor?: string;
  welcomeThumbnail?: string | null;
  welcomeImage?: string | null;
  welcomeFooter?: string | null;
  reasons?: any;
  questions?: any;
  categoryId?: string | null;
  buttonText?: string;
  buttonEmoji?: string | null;
  buttonColor?: string;
  allowedRoles?: any;
  supportRoles?: any;
  maxOpenTickets?: number;
  autoCloseHours?: number;
  transcriptEnabled?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
