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
  lastRepottedAt?: string;
};

export type PlantLogPayload = {
  plantName: string;
  note: string;
  createdAt: string;
};

export type SaveState = "idle" | "saving" | "success" | "error";

export type PlantObservationSummary = {
  id: string;
  date?: string;
  note: string;
  tags: string[];
  url?: string;
};
