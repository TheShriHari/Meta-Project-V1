import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static-only build: no backend, no runtime network calls. Base path is configurable for
// sub-path hosting (e.g. HPSIM_BASE=/hpsim/); default './' works from any static location.
const rawBase = process.env.HPSIM_BASE;
const base = rawBase ? (rawBase.endsWith("/") ? rawBase : `${rawBase}/`) : "./";

export default defineConfig({
  base,
  plugins: [react()],
});
