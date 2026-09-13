import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plant Log",
    short_name: "Plant Log",
    description: "식물 사진, 메모, 관리 날짜를 Notion에 저장하는 모바일 기록 앱",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7F8F5",
    theme_color: "#284F2A",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
