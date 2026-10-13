import { defineConfig } from "vite"
import { lanSignalPlugin } from "./vite-plugin-lan-signal.ts"

export default defineConfig({
  root: ".",
  publicDir: false,
  plugins: [lanSignalPlugin()],
  server: {
    host: true,
    open: false,
  },
  preview: {
    host: true,
  },
  build: {
    outDir: "dist",
    target: "esnext",
  },
})
