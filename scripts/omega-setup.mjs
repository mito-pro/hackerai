import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO_URL = "https://github.com/0xSojalSec/Uncensored-AI.git";
const repoPath = path.join(
  process.cwd(),
  "tools",
  "Uncensored-AI"
);

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
}

if (fs.existsSync(path.join(repoPath, "pyproject.toml"))) {
  console.log(`[ok] repo heretic ja clonado em ${repoPath}`);
} else {
  fs.mkdirSync(path.dirname(repoPath), { recursive: true });
  console.log(`[..] clonando ${REPO_URL} -> ${repoPath}`);
  const result = run("git", ["clone", "--depth", "1", REPO_URL, repoPath]);
  if (result.status !== 0) {
    console.error("[erro] falha no clone. Verifique o git e a rede.");
    process.exit(1);
  }
  console.log("[ok] repo clonado");
}

const uv = spawnSync("uv", ["--version"], { encoding: "utf8", shell: false });
if (uv.error || uv.status !== 0) {
  console.log(
    "[aviso] uv nao encontrado no PATH. Instale em https://docs.astral.sh/uv/ para rodar a decensoracao."
  );
} else {
  console.log(`[ok] ${String(uv.stdout).trim()}`);
}

console.log("");
console.log(" proximos passos:");
console.log("   npm run omega:decensor -- Qwen/Qwen3-4B-Instruct-2507");
console.log("   npm run omega:ollama -- qwen-qwen3-4b-instruct-2507");
