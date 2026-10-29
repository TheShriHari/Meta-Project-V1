import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static-only build: no backend, no runtime network calls. Base path is configurable for
// sub-path hosting (e.g. HPSIM_BASE=/hpsim/); default './' works from any static location.
export default defineConfig({
  base: process.env.HPSIM_BASE ?? "./",
  plugins: [react()],
});
