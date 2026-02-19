import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for OpenNext/Cloudflare Workers
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
