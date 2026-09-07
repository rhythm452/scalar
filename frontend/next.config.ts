import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Dev-only: production routes /api/* through the Cloudflare Worker proxy.
    if (process.env.NODE_ENV === "development") {
      return [
        { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" },
      ];
    }
    return [];
  },
};

export default nextConfig;
