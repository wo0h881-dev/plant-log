export type Plant = {
  id: string;
  category: string;
  name: string;
  wateringCycleDays?: number;
  lastWateredAt?: string;
  daysSinceWatered?: number;
  isWateringDue?: boolean;
  wateringAlert?: string;
  currentLightName?: string;
  currentLightWatt?: number;
  currentSoils?: string[];
  currentPot?: string;
  lastSettingChangedAt?: string;
};

export type PlantLogPayload = {
  plantName: string;
  note: string;
  createdAt: string;
};

export type SaveState = "idle" | "saving" | "success" | "error";
