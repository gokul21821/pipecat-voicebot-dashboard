import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    const broker = process.env.SESSION_BROKER_URL || "http://localhost:3000";
    return [
      { source: "/start", destination: `${broker}/start` },
      { source: "/api/start", destination: `${broker}/api/start` },
    ];
  },
};

export default nextConfig;
