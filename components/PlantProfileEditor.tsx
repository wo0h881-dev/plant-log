"use client";

import { PlantDialog } from "@/components/PlantDialog";
import { PlantNameEditor } from "@/components/PlantNameEditor";
import { PlantCategoryEditor } from "@/components/PlantCategoryEditor";
import { PlantWateringCycleEditor } from "@/components/PlantWateringCycleEditor";
import type { Plant } from "@/types/plant";

export type ProfileField = "name" | "category" | "cycle";
export function PlantProfileEditor({ plant, field, categories, onSaved, onClose }: { plant: Plant; field: ProfileField; categories: string[]; onSaved: (plant: Plant) => void; onClose: () => void }) {
  return <PlantDialog title={field === "name" ? "식물 이름 편집" : field === "category" ? "대분류 편집" : "관수 주기 편집"} onClose={onClose}>
    <p className="mb-5 text-sm text-[#8B929B]">{plant.name}</p>
    {field === "name" ? <PlantNameEditor plant={plant} onSaved={onSaved} initiallyEditing /> : field === "category" ? <PlantCategoryEditor plant={plant} categories={categories} onSaved={onSaved} initiallyEditing /> : <PlantWateringCycleEditor plant={plant} onSaved={onSaved} initiallyEditing />}
  </PlantDialog>;
}
