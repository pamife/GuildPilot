import {
  TicketPanelData,
  TicketPanelComponentItem,
  TicketTypeConfig,
  ButtonComponentItem,
  SelectMenuComponentItem,
  SelectOptionItem,
  IntakeQuestionItem,
  ButtonStyleType,
  TicketActionType,
} from "@/types/ticketComponentTypes";

export interface Channel {
  id: string;
  name: string;
  type: number;
}

export interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
}

export const PRESET_COLORS = [
  { name: "Discord Blurple", hex: "#5865F2" },
  { name: "Emerald Green", hex: "#23A55A" },
  { name: "Crimson Red", hex: "#F23F43" },
  { name: "Amber Gold", hex: "#F0B232" },
  { name: "Deep Violet", hex: "#9B59B6" },
  { name: "Cyan Teal", hex: "#1ABC9C" },
  { name: "Neutral Dark (Invisible Border)", hex: "#242429" },
  { name: "OLED Dark", hex: "#111214" },
];
