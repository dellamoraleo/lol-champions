import type { NextConfig } from "next";

// Set by the GitHub Actions workflow: /<repo-name>
// Empty string in local dev so paths stay at root
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const nextConfig: NextConfig = {
  output: 'export',       // generate static files in ./out
  basePath,               // e.g. /lol-champions on GitHub Pages
  assetPrefix: basePath,  // same prefix for _next/static assets
  trailingSlash: true,    // GitHub Pages needs index.html in each folder
  images: {
    unoptimized: true,    // required for static export (no server)
  },
};

export default nextConfig;
