import { GET as listPlants } from "@/app/api/plants/route";
import type { Plant } from "@/types/plant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let response: Response = await listPlants();
  let data = await response.json();
  // Local previews have no Notion credentials; read the existing public app instead.
  if (data.source !== "notion" && process.env.NODE_ENV === "development") {
    try {
      response = await fetch("https://plant-log.wo0h881.workers.dev/api/plants", {
        cache: "no-store", signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error("Plant list unavailable");
      data = await response.json();
    } catch { return Response.json({ plants: [], source: "unavailable" }, { status: 503 }); }
  }
  if (data.source !== "notion" || !Array.isArray(data.plants)) {
    return Response.json({ plants: [], source: "unavailable" }, { status: 503 });
  }
  const fullProfile = new URL(request.url).searchParams.get("full") === "1";
  return Response.json({ source: "notion", plants: fullProfile ? data.plants : data.plants.map((plant: Plant) => ({
    id: plant.id, name: plant.name, category: plant.category,
    ...(plant.coverPhotoUrl ? { coverPhotoUrl: plant.coverPhotoUrl } : {}),
  })) }, { headers: { "Cache-Control": "no-store" } });
}
