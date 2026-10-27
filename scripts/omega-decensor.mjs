import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const args = process.argv.slice(2);
const quantizationIndex = args.findIndex((arg) => arg === "--quantization");
const quantization =
  quantizationIndex >= 0 ? args[quantizationIndex + 1] || "" : "";
const model =
  args.find((arg, index) => {
    if (index === quantizationIndex || index === quantizationIndex + 1) {
      return false;
    }
    return !arg.startsWith("--");
  }) || "Qwen/Qwen3-4B-Instruct-2507";

const repoPath = path.join(process.cwd(), "tools", "Uncensored-AI");
const outDir = path.join(
  process.cwd(),
  "data",
  "omega",
  "models",
  slugify(model) || "model"
);

if (!fs.existsSync(path.join(repoPath, "pyproject.toml"))) {
  console.error(
    "[erro] repo heretic ausente. Rode `npm run omega:setup` antes."
  );
  process.exit(1);
}

const uv = spawnSync("uv", ["--version"], { encoding: "utf8", shell: false });
if (uv.error || uv.status !== 0) {
  console.error(
    "[erro] uv nao encontrado no PATH. Instale em https://docs.astral.sh/uv/."
  );
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const hereticArgs = [
  "run",
  "heretic",
  "--model",
  model,
  "--model-action",
  "save",
  "--save-directory",
  outDir,
  "--export-strategy",
  "merge",
  "--trial-index",
  "0",
  "--checkpoint-action",
  "restart",
];
if (quantization) hereticArgs.push("--quantization", quantization);

console.log(`[..] decensorando ${model}`);
console.log(`[..] saida em ${outDir}`);
console.log(`[..] uv ${hereticArgs.join(" ")}`);

const child = spawn("uv", hereticArgs, {
  cwd: repoPath,
  stdio: "inherit",
  env: { ...process.env, PYTHONUNBUFFERED: "1" },
});

child.on("exit", (code) => {
  if (code === 0) {
    console.log("");
    console.log("[ok] modelo decensored salvo.");
    console.log(
      `[ok] importe no Ollama: npm run omega:ollama -- ${slugify(model) || "model"}`
    );
  } else {
    console.error(`[erro] heretic terminou com codigo ${code}`);
  }
  process.exit(code ?? 1);
});
