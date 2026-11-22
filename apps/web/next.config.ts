import type { NextConfig } from "next";

/**
 * Static export (plan §29.2): the pilot runs fully in the browser (demo engine
 * + local security scan), so the app ships as static files to Cloudflare Pages
 * free tier — no server, no cold starts. When the FastAPI service lands it is a
 * separate origin set via NEXT_PUBLIC_INTRUVA_API_URL; this config stays static.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
