import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFiles() {
  const paths = [
    path.join(process.cwd(), ".env"),
    path.join(__dirname, "..", ".env"),
  ];
  const monorepoEnv = path.join(__dirname, "..", "..", "..", ".env");
  if (existsSync(monorepoEnv)) paths.push(monorepoEnv);
  for (const p of paths) {
    if (existsSync(p)) loadEnv({ path: p });
  }
}

loadEnvFiles();

const PRODUCTION_ORCHESTRATOR = "https://permutecompute.xyz";
const PRODUCTION_WS = "wss://permutecompute.xyz/v1/workers/ws";

const ORCHESTRATOR_URL = (process.env.ORCHESTRATOR_URL ?? PRODUCTION_ORCHESTRATOR).replace(/\/$/, "");

function resolveWsUrl(): string {
  const explicit = process.env.ORCHESTRATOR_WS_URL?.trim();
  if (explicit) return explicit;
  if (ORCHESTRATOR_URL.includes("127.0.0.1") || ORCHESTRATOR_URL.includes("localhost")) {
    return `ws://127.0.0.1:${process.env.WORKER_WS_PORT ?? "8788"}/v1/workers/ws`;
  }
  if (ORCHESTRATOR_URL.startsWith("https://")) {
    return `${ORCHESTRATOR_URL.replace(/^https:/, "wss:")}/v1/workers/ws`;
  }
  return PRODUCTION_WS;
}

const WS_URL = resolveWsUrl();
const WORKER_ID = process.env.WORKER_ID?.trim() || randomUUID();
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS ?? 30_000);
const OLLAMA_URL = (process.env.OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const ALLOW_STUB =
  process.env.ALLOW_INFERENCE_STUB === "true" || process.env.ALLOW_INFERENCE_STUB === "1";

let inferenceReady = false;
let inferenceBackend: "ollama" | "stub" | "none" = "none";
let ollamaProbeLogged = false;

function envNum(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function probeOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      if (!ollamaProbeLogged) {
        console.error(`[permute-worker] Ollama unreachable at ${OLLAMA_URL} (HTTP ${res.status})`);
        ollamaProbeLogged = true;
      }
      return false;
    }
    inferenceBackend = "ollama";
    if (!ollamaProbeLogged) {
      console.log(`[permute-worker] Ollama OK at ${OLLAMA_URL}`);
      ollamaProbeLogged = true;
    }
    return true;
  } catch (e) {
    if (!ollamaProbeLogged) {
      console.error(
        `[permute-worker] Ollama not running at ${OLLAMA_URL} — install/start Ollama or set ALLOW_INFERENCE_STUB=true for dev echo only`,
        e instanceof Error ? e.message : e,
      );
      ollamaProbeLogged = true;
    }
    return false;
  }
}

async function refreshInferenceState() {
  const ollamaOk = await probeOllama();
  if (ollamaOk) {
    inferenceReady = true;
    inferenceBackend = "ollama";
    return;
  }
  if (ALLOW_STUB) {
    inferenceReady = true;
    inferenceBackend = "stub";
    console.warn("[permute-worker] ALLOW_INFERENCE_STUB=true — echo stub enabled (not real GPU inference)");
    return;
  }
  inferenceReady = false;
  inferenceBackend = "none";
}

function payload() {
  const modelsRaw = process.env.MODELS ?? "qwen-lite";
  const models = modelsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    id: WORKER_ID,
    name: process.env.WORKER_NAME?.trim() || `worker-${WORKER_ID.slice(0, 8)}`,
    wallet: process.env.PROVIDER_WALLET?.trim(),
    region: process.env.REGION?.trim() || "unknown",
    gpu_model: process.env.GPU_MODEL?.trim() || "GPU",
    vram_gb: envNum("VRAM_GB", 24),
    tps_estimate: envNum("TPS_ESTIMATE", 80),
    price_usdg_per_hr: Number(process.env.PRICE_USDG_PER_HR ?? "0.25") || 0.25,
    models,
    inference_ready: inferenceReady,
  };
}

async function registerHttp() {
  await refreshInferenceState();
  const body = payload();
  const res = await fetch(`${ORCHESTRATOR_URL}/v1/workers/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`register ${res.status}: ${text}`);
  }
  console.log(
    `[permute-worker] heartbeat id=${body.id.slice(0, 8)}… name=${body.name} region=${body.region} inference=${inferenceBackend} ready=${inferenceReady}`,
  );
}

type ChatMessage = { role: string; content: string };

async function runInference(model: string, messages: ChatMessage[]) {
  const ollamaModel = process.env.OLLAMA_MODEL?.trim() || model;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: ollamaModel, messages, stream: false }),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        message?: { content?: string };
        eval_count?: number;
        prompt_eval_count?: number;
      };
      const content = data.message?.content ?? "";
      if (content.trim()) {
        const completion = data.eval_count ?? Math.ceil(content.length / 4);
        const prompt = data.prompt_eval_count ?? 0;
        return {
          content,
          usage: {
            prompt_tokens: prompt,
            completion_tokens: completion,
            total_tokens: prompt + completion,
          },
        };
      }
      console.error(`[permute-worker] Ollama returned empty content for model ${ollamaModel}`);
    } else {
      const errText = await res.text().catch(() => "");
      console.error(`[permute-worker] Ollama chat failed HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }
  } catch (e) {
    console.error("[permute-worker] Ollama request error:", e instanceof Error ? e.message : e);
  }

  if (ALLOW_STUB) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const content = `[stub:${WORKER_ID}] echo: ${lastUser.slice(0, 2000)}`;
    const completion = Math.ceil(content.length / 4);
    return {
      content,
      usage: { prompt_tokens: 0, completion_tokens: completion, total_tokens: completion },
    };
  }

  throw new Error(
    `No inference engine (Ollama down at ${OLLAMA_URL}). Install Ollama or set ALLOW_INFERENCE_STUB=true for dev only.`,
  );
}

function connectWs() {
  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    void (async () => {
      await refreshInferenceState();
      const p = payload();
      console.log(`[permute-worker] ws connected ${WS_URL}`);
      ws.send(
        JSON.stringify({
          type: "register",
          id: p.id,
          name: p.name,
          models: p.models,
          wallet: p.wallet,
          region: p.region,
          gpu_model: p.gpu_model,
          vram_gb: p.vram_gb,
          tps_estimate: p.tps_estimate,
          price_usdg_per_hr: p.price_usdg_per_hr,
          inference_ready: p.inference_ready,
        }),
      );
    })();
  });

  ws.on("message", (raw: WebSocket.RawData) => {
    void (async () => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type?: string;
          job_id?: string;
          model?: string;
          messages?: ChatMessage[];
        };
        if (msg.type !== "job" || !msg.job_id || !msg.model || !msg.messages) return;

        try {
          const result = await runInference(msg.model, msg.messages);
          ws.send(
            JSON.stringify({
              type: "job_result",
              job_id: msg.job_id,
              content: result.content,
              usage: result.usage,
            }),
          );
        } catch (e) {
          ws.send(
            JSON.stringify({
              type: "job_result",
              job_id: msg.job_id,
              error: e instanceof Error ? e.message : "inference failed",
            }),
          );
        }
      } catch {
        /* ignore */
      }
    })();
  });

  ws.on("close", () => {
    console.warn("[permute-worker] ws closed; reconnect in 3s");
    setTimeout(connectWs, 3000);
  });

  ws.on("error", (e: Error) => {
    console.error("[permute-worker] ws error", e.message);
  });
}

export async function startWorker() {
  await refreshInferenceState();
  const p = payload();
  console.log(`[permute-worker] orchestrator=${ORCHESTRATOR_URL} ws=${WS_URL}`);
  console.log(
    `[permute-worker] id=${p.id} name=${p.name} region=${p.region} gpu=${p.gpu_model} wallet=${p.wallet ?? "(unset)"}`,
  );
  if (!p.wallet) {
    console.warn("[permute-worker] PROVIDER_WALLET unset — GPU rentals disabled in Hub");
  }
  if (!process.env.WORKER_ID?.trim()) {
    console.warn(
      "[permute-worker] WORKER_ID unset — a new UUID is used each run (duplicate marketplace rows). Set WORKER_ID in .env",
    );
  }
  await registerHttp();
  setInterval(() => {
    registerHttp().catch((e) => console.error("[permute-worker] heartbeat failed", e));
  }, HEARTBEAT_MS);
  connectWs();
}
