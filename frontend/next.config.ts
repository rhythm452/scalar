import type { NextConfig } from "next";

// No rewrites() needed: frontend/src/middleware.ts already proxies /api/* to
// API_ORIGIN in every environment (dev and deployed alike). Middleware runs
// before next.config rewrites are ever considered, so a rewrite here would be
// dead code (docs/DECISIONS.md ADR-020).
const nextConfig: NextConfig = {};

export default nextConfig;
