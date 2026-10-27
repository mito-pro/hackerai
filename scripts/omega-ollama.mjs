import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const slug = args.find((arg) => !arg.startsWith("--")) || "";

if (!slug) {
  console.error(
    "uso: npm run omega:ollama -- <slug-do-modelo>\n      (o slug e o nome da pasta em data/omega/models)"
  );
  process.exit(1);
}

const modelsDir = path.join(process.cwd(), "data", "omega", "models");
const modelDir = path.join(modelsDir, slug);

if (!fs.existsSync(modelDir)) {
  console.error(`[erro] modelo nao encontrado em ${modelDir}`);
  process.exit(1);
}

const ollama = spawnSync("ollama", ["--version"], { encoding: "utf8" });
if (ollama.error || ollama.status !== 0) {
  console.error("[erro] ollama nao encontrado no PATH.");
  process.exit(1);
}

const tag = `nexus-omega-${slug}`;
const modelfile = path.join(modelsDir, `${slug}.Modelfile`);
fs.writeFileSync(
  modelfile,
  [`FROM ${modelDir}`, "", `PARAMETER temperature 0.7`, ""].join("\n"),
  "utf8"
);

console.log(`[..] importando ${modelDir} -> ${tag}`);
const result = spawnSync("ollama", ["create", tag, "-f", modelfile], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  console.error("[erro] falha ao criar o modelo no Ollama.");
  process.exit(result.status ?? 1);
}

console.log(`[ok] modelo criado: ${tag}`);
console.log(`[ok] ele aparece no terminal para o plano NEXUS OMEGA.`);
