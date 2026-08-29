export type Plant = {
  id: string;
  category: string;
  name: string;
  wateringCycleDays?: number;
  lastWateredAt?: string;
  daysSinceWatered?: number;
  isWateringDue?: boolean;
  wateringAlert?: string;
};

export type PlantLogPayload = {
  plantName: string;
  note: string;
  createdAt: string;
};

export type SaveState = "idle" | "saving" | "success" | "error";
