import type { NextConfig } from "next";

// /start and /api/start are now handled by the Route Handler at
// app/api/start/route.ts, which injects the BROKER_AUTH_SECRET server-side.
// The rewrites have been removed so the secret is never exposed to the browser.
const nextConfig: NextConfig = {
  reactStrictMode: false,
};

export default nextConfig;
