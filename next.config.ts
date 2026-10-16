import type { NextConfig } from "next";
import { NOTION_COVER_HOST } from "./lib/plant-cover";

const nextConfig: NextConfig = {
  images: {
    imageSizes: [32, 48, 64, 96, 128, 144, 256, 384],
    remotePatterns: [{ protocol: "https", hostname: NOTION_COVER_HOST, port: "", pathname: "/**" }],
  },
};

export default nextConfig;
