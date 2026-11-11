import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build, which is what the Docker image runs.
  output: "standalone",

  // Baseline browser protections for every page. No strict Content-Security-
  // Policy yet: Next.js needs per-request nonces for its inline scripts, which
  // is its own piece of work. frame-ancestors stops other sites embedding the
  // app (clickjacking); the rest stop content sniffing and referrer leaks and
  // switch off browser features the app never uses.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
