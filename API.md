# Permute public API (beta)

**Base URL (production):** `https://permutecompute.xyz`

**Auth:** `Authorization: Bearer permute_sk_…` (create in [Hub → Developers](https://permutecompute.xyz/hub/developers)).

---

## Chat (OpenAI-compatible)

```bash
curl -s "https://permutecompute.xyz/api/chat/completions" \
  -H "Authorization: Bearer $PERMUTE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-lite","messages":[{"role":"user","content":"Hello"}]}'
```

Response includes `net.routing.source` and `net.job_id`.

---

## Compute

```bash
# list_gpus
curl -s "https://permutecompute.xyz/api/v1/compute/gpus"

# submit_job
curl -s "https://permutecompute.xyz/api/v1/compute/jobs" \
  -H "Authorization: Bearer $PERMUTE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"inference","model":"qwen-lite","messages":[{"role":"user","content":"Hello"}]}'

# job_status / receipt / cancel — see paths under /api/v1/compute/jobs/:id
```

---

## Providers

Install the worker from npm (`@permute_compute/worker`) or this repo — see [README.md](./README.md).  
Heartbeats and job delivery use `ORCHESTRATOR_URL` / WebSocket (defaults to **permutecompute.xyz**).

---

## Metrics

```bash
curl -s "https://permutecompute.xyz/api/metrics"
```
