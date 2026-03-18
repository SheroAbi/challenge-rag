import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {}, // Silence the Next.js 16 error when using a custom webpack config
};

export default nextConfig;
