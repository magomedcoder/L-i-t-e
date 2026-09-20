import { defineConfig } from "vite"

export default defineConfig({
  root: ".",
  publicDir: false,
  server: {
    open: false,
  },
  build: {
    outDir: "dist",
    target: "esnext",
  },
})
