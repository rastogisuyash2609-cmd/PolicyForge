# Phase 9D — managed hosting preparation, not deployed

The owner changed scope to preparation only and will deploy personally.
[DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) is the authoritative manual runbook.
No account access, cloud resources, purchase, deployment, push, merge or inference
occurred. Root .env remains unchanged and live AI stays OFF.

Render remains the proposed fastest approach: static Next.js plus one paid
FastAPI worker and a private 1 GB disk, about $7.25/month before tax/overages.
The guide links current official sources and covers account steps, GitHub access,
license decisions, exact configuration, judging, acceptance checks and rollback.

Both services retain the repository root. Frontend build is
`cd frontend && npm ci && npm run build`, publish `frontend/out`, because the
landing page imports data/novacart outside frontend. Backend needs data/benchmark.
Static export is opt-in; normal Next.js server behavior remains available.

Opt-in public demo mode blocks all compilation before SDK execution and adds
workload, rate and concurrency limits. It is an inference-free judging release,
not anonymous paid AI. Persistent receipts are not durable quotas. Public demo
mode stays ON, live mode OFF, and provider/workspace credentials are omitted.

A previous static build experiment used .next internally despite a custom export
directory. The normal loopback production build was restored; only the frontend
restarted. Final static checks use a disposable source copy with repository data
and preserve the running frontend. No active browser rules were edited.

See PHASE9D_PREPARATION.md and release_preflight_2026-10-29 for final evidence.
Native Linux runtime, actual public URLs and all owner release actions remain
pending. ADV-01 stays UNCONFIRMED; no live test was repeated.
