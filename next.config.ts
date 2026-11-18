import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/scope": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
