import type { NextConfig } from "next";
import path from "node:path";

const vercel = process.env.VERCEL === "1" || process.env.APERTE_PLAY_TARGET === "vercel";
const nextConfig: NextConfig = vercel ? {
  distDir: ".next-vercel",
  typescript: {tsconfigPath: "tsconfig.vercel.json"},
  env: {NEXT_PUBLIC_APERTE_PLAY_HOSTING: "vercel"},
  async redirects() {
    return ["/signin-with-chatgpt", "/signout-with-chatgpt"].map(source => ({
      source, destination: "/area-do-cliente", permanent: false,
    }));
  },
  webpack(config, {webpack}) {
    // D1 belongs to the local/Sites demonstration, not to Vercel's Node runtime.
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(
      /(^|[/\\])platform-env(?:\.ts)?$/,
      path.resolve("lib/vercel-env.ts"),
    ));
    return config;
  },
} : {};

export default nextConfig;
