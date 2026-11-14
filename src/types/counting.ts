export interface CountingStats {
  channelId: string | null;
  nextNumber: string;
  record: string;
  saveStatus: "available" | "charged" | "used";
  relayProgress: number;
}
