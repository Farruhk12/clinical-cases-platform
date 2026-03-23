import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const repoRoot = __dirname;
  const env = loadEnv(mode, repoRoot, "");
  const apiPort =
    process.env.VITE_DEV_API_PORT ||
    env.PORT ||
    process.env.PORT ||
    "3001";

  return {
    plugins: [react()],
    root: "client",
    publicDir: "public",
    build: {
      outDir: "../dist",
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client/src"),
        "~lib": path.resolve(__dirname, "src/lib"),
        "~types": path.resolve(__dirname, "src/types"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
