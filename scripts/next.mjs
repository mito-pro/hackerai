import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const heapMb = Number(process.env.NEXUS_HEAP_MB || 4096);
const heapFlag = `--max-old-space-size=${Number.isFinite(heapMb) ? heapMb : 4096}`;
const nodeOptions = [process.env.NODE_OPTIONS, heapFlag]
  .filter(Boolean)
  .join(" ")
  .trim();

const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
