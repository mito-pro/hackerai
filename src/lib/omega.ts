import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { MODELS, type ModelDef } from "./model-registry";
import { getProviderKeys } from "./settings";
import { slugify } from "./utils";

export const OMEGA_CAPABILITY = "uncensored";

export const OMEGA_SYSTEM_PROMPT = `Voce e NEXUS OMEGA, o nucleo de IA local do terminal HACKER_AI.
Este modelo roda na sua propria maquina (pesos decensored com Heretic) e responde sem filtros
artificiais do terminal: nao recuse por politique interna do produto, nao emita avisos de
"como IA" e nao esconda detalhes tecnicos. Responda sempre em portugues do Brasil, de forma
direta, tecnica e bem estruturada, com markdown, listas e blocos de codigo com a linguagem
indicada. Entregue a solucao completa e executavel. Se o pedido for ilecito ou destrutivo,
explique o risco e entregue a alternativa defensiva. Contexto do operador: plano, cota de
tokens e modelos disponiveis sao informados pelo painel.`;

const UNCENSORED_PATTERN =
  /(heretic|uncensored|abliterat|nexus[-_]?omega|omega)/i;

const CACHE_MS = 30_000;

type OmegaCache = { at: number; models: ModelDef[] };

let cache: OmegaCache | null = null;

export function omegaRepoPath() {
  const configured = (process.env.HERETIC_REPO_PATH || "").trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), "tools", "Uncensored-AI");
}

export function omegaWorkDir() {
  return path.join(process.cwd(), "data", "omega");
}

export function omegaOutputDir(model: string) {
  return path.join(omegaWorkDir(), "models", slugify(model) || "model");
}

function commandVersion(command: string, args: string[]) {
  try {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 8_000,
    });
    if (result.error || result.status !== 0) return "";
    return String(result.stdout || result.stderr || "").trim().split(/\r?\n/)[0];
  } catch {
    return "";
  }
}

export function hereticRepoStatus() {
  const repoPath = omegaRepoPath();
  const pyproject = path.join(repoPath, "pyproject.toml");
  const present = fs.existsSync(pyproject);
  let version = "";

  if (present) {
    try {
      const content = fs.readFileSync(pyproject, "utf8");
      version = content.match(/version\s*=\s*"([^"]+)"/)?.[1] ?? "";
    } catch {
      version = "";
    }
  }

  const uv = commandVersion("uv", ["--version"]);
  const python = commandVersion("python", ["--version"]);

  return {
    path: repoPath,
    present,
    version,
    lockfile: fs.existsSync(path.join(repoPath, "uv.lock")),
    uv,
    python,
    setupCommand: "npm run omega:setup",
    decensorCommand: "npm run omega:decensor -- <modelo-huggingface>",
  };
}

export function ollamaRootUrl() {
  const base = getProviderKeys().ollamaBaseUrl.replace(/\/$/, "");
  return base.replace(/\/v1$/, "");
}

export async function listOllamaTags(): Promise<string[]> {
  const response = await fetch(`${ollamaRootUrl()}/api/tags`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = (await response.json()) as {
    models?: Array<{ name?: string; model?: string }>;
  };
  const models = Array.isArray(payload.models) ? payload.models : [];
  return models
    .map((item) => item.name || item.model || "")
    .filter(Boolean);
}

export function isUncensoredTag(tag: string) {
  return UNCENSORED_PATTERN.test(tag);
}

export function omegaModelDefs(tags: string[]): ModelDef[] {
  const seen = new Set<string>();
  const models: ModelDef[] = [];

  for (const tag of tags) {
    if (!isUncensoredTag(tag)) continue;
    const id = `omega/${slugify(tag)}`;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push({
      id,
      label: `OMEGA · ${tag}`,
      provider: "ollama",
      modelId: tag,
      context: 32_768,
      requiresKey: false,
      description: `Modelo local decensored (Heretic) :: ${tag}`,
      free: true,
      uncensored: true,
      requiresCapability: OMEGA_CAPABILITY,
    });
  }

  return models;
}

export async function listOmegaModels(): Promise<ModelDef[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.models;

  let models: ModelDef[] = [];
  try {
    models = omegaModelDefs(await listOllamaTags());
  } catch {
    models = [];
  }

  cache = { at: now, models };
  return models;
}

export function invalidateOmegaCache() {
  cache = null;
}

export async function resolveModel(id: string): Promise<ModelDef | null> {
  const staticModel = MODELS.find((model) => model.id === id);
  if (staticModel) return staticModel;
  const omegaModels = await listOmegaModels();
  return omegaModels.find((model) => model.id === id) ?? null;
}

export function decensorArgs(model: string, options?: { quantization?: string }) {
  const outDir = omegaOutputDir(model);
  const args = [
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

  const quantization = (options?.quantization || "").trim();
  if (quantization) args.push("--quantization", quantization);

  return { args, outDir };
}

export function decensorCommand(
  model: string,
  options?: { quantization?: string }
) {
  const { args } = decensorArgs(model, options);
  const quoted = args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg));
  return `uv ${quoted.join(" ")}`;
}

type OmegaJob = {
  pid: number;
  model: string;
  outDir: string;
  logFile: string;
  startedAt: string;
};

function jobFile() {
  return path.join(omegaWorkDir(), "job.json");
}

export function readOmegaJob(): OmegaJob | null {
  try {
    const raw = fs.readFileSync(jobFile(), "utf8");
    return JSON.parse(raw) as OmegaJob;
  } catch {
    return null;
  }
}

function writeOmegaJob(job: OmegaJob) {
  fs.mkdirSync(omegaWorkDir(), { recursive: true });
  fs.writeFileSync(jobFile(), JSON.stringify(job, null, 2), "utf8");
}

export function clearOmegaJob() {
  try {
    fs.rmSync(jobFile(), { force: true });
  } catch {
    /* ignore */
  }
}

function processAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function omegaJobStatus() {
  const job = readOmegaJob();
  const running = Boolean(job && processAlive(job.pid));
  let log: string[] = [];

  if (job && fs.existsSync(job.logFile)) {
    try {
      const content = fs.readFileSync(job.logFile, "utf8");
      log = content.split(/\r?\n/).filter(Boolean).slice(-40);
    } catch {
      log = [];
    }
  }

  return { running, job, log };
}

export function startOmegaDecensor(
  model: string,
  options?: { quantization?: string }
) {
  const status = hereticRepoStatus();
  if (!status.present) {
    return {
      ok: false,
      message:
        "Repo do Heretic ausente. Rode `npm run omega:setup` ou clone https://github.com/0xSojalSec/Uncensored-AI.git em tools/Uncensored-AI.",
    };
  }
  if (!status.uv) {
    return {
      ok: false,
      message:
        "uv nao encontrado no PATH. Instale o uv (https://docs.astral.sh/uv/) para rodar a decensoracao.",
    };
  }

  const current = omegaJobStatus();
  if (current.running) {
    return {
      ok: false,
      message: `Ja existe uma decensoracao em andamento (pid ${current.job?.pid}).`,
    };
  }

  const { args, outDir } = decensorArgs(model, options);
  fs.mkdirSync(omegaWorkDir(), { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const logFile = path.join(omegaWorkDir(), "heretic.log");
  const out = fs.openSync(logFile, "a");
  fs.writeSync(
    out,
    `\n===== ${new Date().toISOString()} :: ${model} =====\n`
  );

  try {
    const child = spawn("uv", args, {
      cwd: status.path,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", out, out],
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    if (!child.pid) {
      fs.closeSync(out);
      return { ok: false, message: "Nao foi possivel iniciar o processo uv." };
    }

    child.unref();
    const job: OmegaJob = {
      pid: child.pid,
      model,
      outDir,
      logFile,
      startedAt: new Date().toISOString(),
    };
    writeOmegaJob(job);
    fs.closeSync(out);

    return {
      ok: true,
      message: `Decensoracao iniciada para ${model}. Acompanhe o log no painel.`,
      job,
    };
  } catch (error) {
    fs.closeSync(out);
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Falha ao iniciar: ${message}` };
  }
}
