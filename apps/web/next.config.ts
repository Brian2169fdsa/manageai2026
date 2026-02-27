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
    // pdf-parse v2 depends on @napi-rs/canvas (native binary) and pdfjs-dist
    // worker — both must be loaded from node_modules at runtime, not bundled
    'pdf-parse',
    'pdfjs-dist',
    '@napi-rs/canvas',
  ],
};

export default nextConfig;
