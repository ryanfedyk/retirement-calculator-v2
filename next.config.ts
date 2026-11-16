import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @resvg/resvg-js is a native addon (loads a .node binary) used server-side to
  // rasterize the daily brief's Monte Carlo chart. Keep it out of the bundle so
  // Next/Turbopack doesn't try to pack the native binding — it's require()d at
  // runtime instead.
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
