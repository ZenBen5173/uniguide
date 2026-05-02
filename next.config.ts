import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [],
  },
  // Node-only packages webpack mangles when bundled — leave them external so
  // the runtime resolves them from node_modules at request time.
  //   - pdf-parse: top-level test-fixture I/O throws during bundle
  //   - pdfkit:    minification renames `function PDFDocument()` constructor
  //                → "TypeError: w is not a constructor" on
  //                /api/letters/[id]/pdf in production
  //   - mammoth:   docx parser, similar Node-only deps as pdf-parse
  serverExternalPackages: ["pdf-parse", "pdfkit", "mammoth"],
};

export default nextConfig;
