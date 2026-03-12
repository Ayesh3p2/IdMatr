import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Point to the monorepo root where node_modules/next lives
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
