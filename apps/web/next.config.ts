import path from "node:path";
import type { NextConfig } from "next";

/**
 * Static export (plan §29.2): the pilot runs fully in the browser (shared
 * engine + local security scan), so the app ships as static files to
 * Cloudflare Pages free tier — no server, no cold starts. The developer API is
 * a separate Cloudflare Worker (services/api) using the same @intruva/engine;
 * point the web app at it with NEXT_PUBLIC_INTRUVA_API_URL if ever needed.
 */
const nextConfig: NextConfig = {
  output: "export",
  // The shared engine ships TypeScript source; let Next compile it.
  transpilePackages: ["@intruva/engine"],
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    // Monorepo: resolve workspace packages from the repository root.
    root: path.resolve(__dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
