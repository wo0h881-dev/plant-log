export type Plant = {
  id: string;
  category: string;
  name: string;
};

export type PlantLogPayload = {
  plantName: string;
  note: string;
  createdAt: string;
};

export type SaveState = "idle" | "saving" | "success" | "error";
