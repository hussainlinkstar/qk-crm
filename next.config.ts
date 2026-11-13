import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    instantInsights: {
      // Every workspace page renders from browser storage, so implicit instant-navigation
      // validation can never pass. Validate only segments that opt in with `instant`.
      validationLevel: "manual-warning",
    },
  },
};

export default nextConfig;
