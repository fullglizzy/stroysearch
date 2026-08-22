import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone-сборка для прода: минимальный образ без node_modules
  // (деплой = .next/standalone + .next/static + public/)
  output: "standalone",
};

export default nextConfig;
