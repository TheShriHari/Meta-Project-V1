import { execSync } from "node:child_process";

process.env.HPSIM_BASE = "/hpsim/";
execSync("tsc && vite build", { stdio: "inherit", env: process.env });
