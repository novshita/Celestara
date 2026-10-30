import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build, which is what the Docker image runs.
  output: "standalone",
};

export default nextConfig;
