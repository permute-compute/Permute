# Permute worker

[![npm version](https://img.shields.io/npm/v/@permute_compute/worker)](https://www.npmjs.com/package/@permute_compute/worker)

Run a **GPU provider node** on [Permute](https://permutecompute.xyz) — Robinhood Chain marketplace for inference and hourly compute.

Install the agent on your machine. It **registers** your GPU with Permute, sends **heartbeats**, and accepts **inference jobs** over WebSocket. You earn when the network routes work to you (USDG on-chain as the platform matures).

**Platform:** [https://permutecompute.xyz](https://permutecompute.xyz)  
**Source:** [github.com/permute-compute/Permute](https://github.com/permute-compute/Permute)  
**Builder API:** [API.md](./API.md)

---

## Install

```bash
npm install -g @permute_compute/worker
```

Or one-off:

```bash
npx @permute_compute/worker
```

---

## Configure

Copy `.env.example` to `.env` in the folder where you run the worker:

```bash
cp .env.example .env
```

Production defaults (no `.env` required for URL):

- `ORCHESTRATOR_URL` → `https://permutecompute.xyz`
- WebSocket → `wss://permutecompute.xyz/v1/workers/ws`

Set **`PROVIDER_WALLET`**, **`WORKER_ID`**, **`WORKER_NAME`**, GPU fields, and **Ollama** (`OLLAMA_URL` / `OLLAMA_MODEL`). See `.env.example`.

---

## Run

```bash
permute-worker
```

1. Heartbeats → listing on [Marketplace](https://permutecompute.xyz/hub/marketplace) when online.  
2. WebSocket → inference jobs when users hit the network route.

```bash
ollama pull llama3.2   # or your OLLAMA_MODEL
```

---

## Requirements

- Node.js **20+**
- [Ollama](https://ollama.com) (recommended) or compatible local chat API
- Robinhood Chain address for **`PROVIDER_WALLET`**

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Not listed | `ORCHESTRATOR_URL`, logs, firewall |
| No jobs | WebSocket / `wss://` in production |
| Inference errors | Ollama up at `OLLAMA_URL` |
| No rentals | `PROVIDER_WALLET` set |

---

## License

MIT — see [LICENSE](./LICENSE).
