import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // create-next-app turns on `cacheComponents` / `partialPrefetching`. They force a <Suspense> around
  // anything that reads the URL on dynamic routes, and this app fetches all data on the client
  // (TanStack Query), so they add constraints without any benefit. See docs/DECISIONS.md.
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
