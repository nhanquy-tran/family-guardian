import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fg/shared"],
  async headers() {
    return [
      {
        source: "/firefox/:name(.+\\.xpi)",
        headers: [{ key: "Content-Type", value: "application/x-xpinstall" }],
      },
    ];
  },
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
