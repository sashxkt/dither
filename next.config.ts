import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The clips are the bulk of the page's weight and they change only
        // when one is replaced. A week of cache with a month of revalidation
        // behind it means a repeat visit pays for none of them, and a swapped
        // clip still lands within the week rather than never.
        source: "/bg/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=2592000",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
