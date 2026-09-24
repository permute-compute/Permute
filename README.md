# Permute public API (beta)

Base URL: your Hub origin (local dev default `http://localhost:3001`, or set `NEXT_PUBLIC_APP_URL`) or orchestrator directly (`ORCHESTRATOR_URL`).

**Auth:** `Authorization: Bearer permute_sk_…` (create in Hub → Developers). Legacy keys `net_sk_…` still work.  
Hub Chat UI uses wallet + `X-Wallet-Address`; **server integrations should use Bearer**.

---

## Chat (OpenAI-compatible)

```bash
curl -s "$BASE/api/chat/completions" \
  -H "Authorization: Bearer $PERMUTE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-lite","messages":[{"role":"user","content":"Hello"}]}'
```

Response includes `net.routing.source` (e.g. `fallback:groq:…`) and `net.job_id`.

---

## Compute API

### `list_gpus`

```bash
curl -s "$BASE/api/v1/compute/gpus"
```

### `submit_job` (inference)

```bash
curl -s "$BASE/api/v1/compute/jobs" \
  -H "Authorization: Bearer $PERMUTE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"inference","model":"qwen-lite","messages":[{"role":"user","content":"Hello"}]}'
```

### `job_status`

```bash
curl -s "$BASE/api/v1/compute/jobs/$JOB_ID" \
  -H "Authorization: Bearer $PERMUTE_API_KEY"
```

### `cancel_job`

```bash
curl -s -X POST "$BASE/api/v1/compute/jobs/$JOB_ID/cancel" \
  -H "Authorization: Bearer $PERMUTE_API_KEY"
```

### `get_receipt`

```bash
curl -s "$BASE/api/v1/compute/jobs/$JOB_ID/receipt" \
  -H "Authorization: Bearer $PERMUTE_API_KEY"
```

### `rent_gpu` (on-chain escrow + API confirm)

1. Call `GpuRentalEscrow.openRental(rentalId, provider, amount, endsAt)` on Robinhood Chain (USDG `approve` first).  
   `rentalId = keccak256("permute-rental-" || rental_uuid)`.
2. POST confirmation:

```bash
curl -s -X POST "$BASE/api/v1/compute/rentals" \
  -H "Authorization: Bearer $PERMUTE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"gpu_id":"YOUR_GPU_ID","hours":1,"rental_id":"YOUR_RENTAL_UUID","tx_hash":"0x…"}'
```

Orchestrator verifies the `RentalOpened` event, records an active rental, and returns `rental_id` + `job_id`. After `endsAt`, the settler calls `finalizeRental` to pay provider + treasury.

### List your rentals (Hub: Marketplace / Account)

```bash
curl -s "$BASE/api/v1/compute/rentals" \
  -H "X-Wallet-Address: 0xYourWallet"
```

Returns `rental_id`, `gpu_id`, `on_chain_rental_id`, `open_tx_hash`, `ends_at`, and `status` for the connected wallet.

---

## Provider worker (list on marketplace)

```bash
cd services/worker
cp .env.example .env
# fill WORKER_ID, WORKER_NAME, GPU_MODEL, …
npm install && npm run start
```

Or register once:

```bash
curl -s -X POST "$BASE/api/workers/register" \
  -H "Content-Type: application/json" \
  -d '{
    "id":"unique-worker-uuid",
    "name":"friend-4090",
    "wallet":"0x…",
    "region":"us-east",
    "gpu_model":"RTX 4090",
    "vram_gb":24,
    "tps_estimate":100,
    "price_usdg_per_hr":0.28,
    "models":["qwen-lite"]
  }'
```

Heartbeats required every ~90s — use the worker agent.

---

## Metrics

```bash
curl -s "$BASE/api/metrics"
```

Live when orchestrator is up (`source: orchestrator`).
