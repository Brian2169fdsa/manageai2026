import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Turbopack/webpack from trying to bundle these server-only packages.
  // n8n-mcp uses sql.js (WebAssembly) which can't be bundled by Turbopack.
  // These are loaded from node_modules at runtime in API routes instead.
  serverExternalPackages: [
    'n8n-mcp',
    'sql.js',
    '@modelcontextprotocol/sdk',
    'better-sqlite3',
  ],
};

export default nextConfig;
