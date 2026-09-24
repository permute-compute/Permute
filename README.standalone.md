# Permute worker

Run a **GPU provider node** on [Permute](https://permutecompute.xyz) — Robinhood Chain marketplace for inference and hourly compute.

Install the agent on your machine. It **registers** your GPU with Permute, sends **heartbeats**, and accepts **inference jobs** over WebSocket. You earn when the network routes work to you (USDG on-chain as the platform matures).

**Production platform:** [https://permutecompute.xyz](https://permutecompute.xyz)  
**HTTP API reference:** [API.md](./API.md) (consumer routes; providers use this worker + register flow below)

---

## Requirements

- **Node.js 20+**
- **GPU machine** (Linux/macOS; Windows via WSL is fine for dev)
- **[Ollama](https://ollama.com)** running locally (recommended), or your own OpenAI-compatible server wired to the worker
- **Robinhood Chain wallet** (`PROVIDER_WALLET`) for marketplace identity and rentals

---

## Install

```bash
npm install -g @permutecompute/worker
```

Or run without a global install:

```bash
npx @permutecompute/worker
```

*(Package name on npm may differ until first publish — check [npmjs.com](https://www.npmjs.com) for `@permutecompute/worker`.)*

---

## Configure

Create a `.env` in the directory where you run the worker (or export variables):

```bash
# Production (default)
ORCHESTRATOR_URL=https://permutecompute.xyz
ORCHESTRATOR_WS_URL=wss://permutecompute.xyz/v1/workers/ws

WORKER_ID=your-stable-uuid
WORKER_NAME=my-gpu-4090
PROVIDER_WALLET=0xYourRobinhoodChainAddress

REGION=us-east
GPU_MODEL=RTX 4090
VRAM_GB=24
TPS_ESTIMATE=100
PRICE_USDG_PER_HR=0.25
MODELS=qwen-lite

OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
HEARTBEAT_MS=30000
```

| Variable | Purpose |
|----------|---------|
| `ORCHESTRATOR_URL` | Permute backend (production: **permutecompute.xyz**) |
| `ORCHESTRATOR_WS_URL` | WebSocket for live jobs — keep HTTP + WS both up |
| `PROVIDER_WALLET` | Your provider address on Robinhood Chain (required for rentals) |
| `MODELS` | Hub model ids this node serves (e.g. `qwen-lite`) |
| `OLLAMA_*` | Local inference engine |

---

## Run

```bash
permute-worker
```

After start:

1. **HTTP heartbeats** → your GPU appears on [permutecompute.xyz/hub/marketplace](https://permutecompute.xyz/hub/marketplace) when the orchestrator is reachable.
2. **WebSocket** → you receive inference jobs when users hit the network route.

**Ollama:** `ollama pull llama3.2` (or your `OLLAMA_MODEL`) before going live.

---

## What you run today

- **Inference jobs** — chat-style `{ role, content }[]` in, text + token usage out.
- **Not yet:** arbitrary containers, SSH sessions, or custom binaries (on the roadmap).

**vLLM / other engines:** Ollama is supported out of the box. For vLLM, point a compatible HTTP chat API at the same message format (see source or open an issue).

---

## Provider economics (beta)

- Network-routed jobs pay providers in **USDG** per protocol rules.
- Optional **provider bond** on the Hub increases share when live on mainnet.
- Details and status: [permutecompute.xyz](https://permutecompute.xyz)

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Not on marketplace | `ORCHESTRATOR_URL`, firewall, heartbeat logs |
| Online but no jobs | WebSocket URL / TLS (`wss://` in prod) |
| Jobs fail | Ollama running? `OLLAMA_URL` reachable? |
| Rentals disabled | `PROVIDER_WALLET` set? |

---

## Links

- **Hub:** [https://permutecompute.xyz/hub/earn](https://permutecompute.xyz/hub/earn)
- **API (builders):** [API.md](./API.md)
- **Issues:** GitHub Issues on this repo

---

## License

See [LICENSE](./LICENSE) in this repository.
