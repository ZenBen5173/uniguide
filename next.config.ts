import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [],
  },
  // pdf-parse has Node-only deps that webpack tries to bundle and fails.
  // Mark it external so the runtime resolves it from node_modules at request time.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
