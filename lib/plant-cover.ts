export const NOTION_COVER_HOST = "prod-files-secure.s3.us-west-2.amazonaws.com";

export function canOptimizePlantCover(src: string) {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname === NOTION_COVER_HOST && !url.port;
  } catch {
    return false;
  }
}
