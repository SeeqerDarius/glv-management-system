import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./prisma/prod-ca-2021.crt"],
  },
};

export default nextConfig;
