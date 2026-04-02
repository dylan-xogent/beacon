import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "static-cdn.jtvnw.net" },
    ],
  },
  transpilePackages: ["@beacon/db"],
};

export default nextConfig;
