import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@arrowfin/contracts"],
  poweredByHeader: false,
};
export default config;
