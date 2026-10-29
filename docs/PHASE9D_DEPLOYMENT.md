# Proposed Phase 9D: restricted Linux deployment runbook

**Prepared only. Do not execute without explicit deployment authorization.** No
host, domain, IP list, cloud purchase, push or deployment has been approved by this
document. Linux commands/configuration below were reviewed, not executed on this
Windows host. Linux validation is a release gate, not a claimed result.

## Recommended first release

Fastest safe option for the current architecture: one small Linux VM, one Next.js
production process and one FastAPI worker, both on loopback, behind Caddy TLS with
approved owner/judge IP allowlisting across all routes. Initially deploy with
live AI disabled and **no provider/workspace credentials on the host**. Demo/manual
rules and deterministic analysis remain usable. No database migration or frontend
rewrite is required. Use an identity-aware proxy instead if judge IPs are unstable;
do not simply remove access restrictions or expose FastAPI directly.

This recommendation is an inference from the current single-worker architecture
and restricted-demo requirements. Alternatives such as separate managed web
services introduce two origins and independent ingress/access configuration.
No cloud price, free-tier entitlement or future credit balance is assumed.

The runtime guidance follows official [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting),
[FastAPI deployment](https://fastapi.tiangolo.com/deployment/docker/),
[Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy),
[IP matching](https://caddyserver.com/docs/caddyfile/matchers#remote-ip),
[body limits](https://caddyserver.com/docs/caddyfile/directives/request_body) and
[automatic HTTPS](https://caddyserver.com/docs/automatic-https) documentation.

## 1. Required owner decisions and host prerequisites

Before Phase 9D, approve the release commit, hosting account/VM, domain and allowed
operator/judge CIDRs. Confirm spending/credit validity separately if future live AI
is desired; the historical $29.50 account balance is not a software-enforced reserve.

Use a maintained Linux distribution with Python 3.11 + venv, a currently patched
Node.js 22 LTS installation at /usr/local/bin/node, npm, Caddy and systemd. Install
runtimes only from official vendor/distribution sources. Patch the OS and runtime
at provisioning; application npm/pip audits do not audit the OS, Node binary or
Caddy. Debian 12 provides Python 3.11; another distribution needs that exact Python
runtime installed explicitly. Do not substitute Python 3.13 for release validation.
If Node is installed elsewhere, adjust the explicit frontend ExecStart path below.

Prepare a dedicated unprivileged service user and source directory:

```sh
sudo useradd --system --create-home --home-dir /srv/policyforge --shell /usr/sbin/nologin policyforge
sudo install -d -o policyforge -g policyforge /srv/policyforge
sudo install -d -o root -g root -m 700 /etc/policyforge
```

After approval, transfer an archive of the reviewed Git commit to this directory.
Create it with `git archive --format=tar --output=policyforge-release.tar HEAD` from the reviewed checkout, not a
zip of the working directory. This excludes the ignored root .env, node_modules,
build outputs and untracked .agents. Inspect the archive before transferring.
Do not copy the developer's .env, provider key or workspace code. Extract as the
service user into /srv/policyforge. No transfer or archive creation occurred in 9C.

## 2. Linux verification before enabling ingress

Run the following as the service user from /srv/policyforge (use a shell session
with HOME belonging to the service user). Replace the documentation-only domain
with the actual approved domain; do not publish the example domain/CIDRs below.

```sh
cd /srv/policyforge
python3.11 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt
export PYTHONPATH=/srv/policyforge/backend
export POLICYFORGE_ENABLE_LIVE_AI=false
export POLICYFORGE_AI_REQUEST_BUDGET=1
.venv/bin/python -m pytest tests -q

cd /srv/policyforge/frontend
npm ci
npm test
npm run typecheck
npm run lint
npm audit
npm audit --omit=dev
NEXT_PUBLIC_API_URL=https://policyforge.example.com npm run build
```

Next.js now selects optional native SWC for Linux instead of requiring the Windows
binary. Do not use --omit=optional or remove the lockfile. Check the installed
@next/swc-linux package matches Next 15.5.28. Stop on any install, wheel, native
library, audit, type, lint or build failure; Windows success does not waive it.

Install pip-audit in a separate temporary audit venv and scan the actual release
site-packages, including Linux-specific transitive dependencies:

```sh
cd /srv/policyforge
python3.11 -m venv /tmp/policyforge-audit
/tmp/policyforge-audit/bin/python -m pip install pip-audit
/tmp/policyforge-audit/bin/python -m pip_audit --path /srv/policyforge/.venv/lib/python3.11/site-packages
.venv/bin/python -m pip check
```

Record the resolved package inventory and audit date for the release; direct pins
in requirements files do not freeze all Linux transitive versions. These commands
contact package registries/advisory services, not Nebius inference.

## 3. Backend environment and single-worker service

Create /etc/policyforge/backend.env as root with mode 600. It contains only these
initial non-secret deployment settings; the service manager reads it for the user:

```dotenv
POLICYFORGE_ENABLE_LIVE_AI=false
POLICYFORGE_AI_REQUEST_BUDGET=1
POLICYFORGE_CORS_ORIGINS=https://policyforge.example.com
MAX_RETRIES=0
REQUEST_TIMEOUT_SECONDS=30.0
```

Omit NEBIUS_API_KEY and POLICYFORGE_COMPILE_TOKEN for this initial deterministic
demo. If separately authorized later, install secrets through the host secret
manager or this protected backend-only environment file. Required model/endpoint:
nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B and https://api.tokenfactory.nebius.com/v1/.
Never put secrets in Next.js environment variables, images, Git or command arguments.

Save /etc/systemd/system/policyforge-api.service:

```ini
[Unit]
Description=PolicyForge FastAPI (live AI disabled)
After=network.target

[Service]
User=policyforge
Group=policyforge
WorkingDirectory=/srv/policyforge
Environment=PYTHONPATH=/srv/policyforge/backend
EnvironmentFile=/etc/policyforge/backend.env
ExecStart=/srv/policyforge/.venv/bin/python -m uvicorn policyforge.api:app --host 127.0.0.1 --port 8000 --workers 1 --limit-concurrency 8 --backlog 32 --timeout-keep-alive 5
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

No reload or multiple workers. The restart policy is safe for this live-OFF demo.
It must NOT be treated as a paid-session quota: crashes/restarts reset in-memory
budgets. For a later authorized one-attempt live session, disable automatic restart
or implement persistent shared quotas before enabling it.

## 4. Frontend production service

Save /etc/systemd/system/policyforge-web.service:

```ini
[Unit]
Description=PolicyForge Next.js production
After=network.target policyforge-api.service

[Service]
User=policyforge
Group=policyforge
WorkingDirectory=/srv/policyforge/frontend
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/node /srv/policyforge/frontend/node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

NEXT_PUBLIC_API_URL was embedded at build time. It is the public site origin,
without /api; existing client methods append /api endpoints. The proxy below
preserves that prefix. Changing domain/API origin requires a new frontend build.

After the owner approves starting the release services:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now policyforge-api policyforge-web
curl --fail http://127.0.0.1:8000/api/health
curl --fail --output /dev/null http://127.0.0.1:3000/workspace/analyze
```

Run the local API regression from frontend/ with
`POLICYFORGE_TEST_API=http://127.0.0.1:8000 npm run test:integration`.
It must pass without provider credentials. Verify an unauthenticated POST with
body {"live":true} returns 503/live_disabled before provider initialization.
Inspect sanitized status/code only; never dump environments or credential headers.

## 5. TLS, restricted ingress and same-origin routing

Point the approved domain's A/AAAA records directly at the host. Configure the VM
firewall/security group to expose only SSH to administrators and Caddy's 80/443;
never expose ports 3000, 8000 or Caddy's admin port. Port 80/443 must satisfy ACME
validation requirements. Do not put a CDN in front of this initial remote_ip
configuration: otherwise every visitor may appear as a proxy IP. Trusted-proxy
and client-IP handling must be reviewed before changing that topology.

Replace domain and both example CIDRs in /etc/caddy/Caddyfile with the approved
values. All application routes, including deterministic APIs, are restricted:

```caddyfile
policyforge.example.com {
    @blocked not remote_ip 203.0.113.10/32 198.51.100.20/32
    respond @blocked "Restricted PolicyForge demo" 403

    request_body {
        max_size 1MB
    }

    handle /api/* {
        reverse_proxy 127.0.0.1:8000 {
            transport http {
                dial_timeout 5s
                response_header_timeout 65s
            }
        }
    }
    handle {
        reverse_proxy 127.0.0.1:3000
    }
}
```

The backend additionally enforces a 16 KiB compile body limit and 1 MB for other
POST bodies. Uvicorn bounds concurrent HTTP work; the proxy bounds body sizes and
upstream connection/header waiting. This recipe relies on trusted allowlisted
users, not an anonymous public rate-limit service. Caddy core is not being claimed
to provide a general per-IP request-rate limiter. Before unrestricted public access,
add gateway request-rate limits for ALL routes and explicit CPU/scenario limits.
Do not install an unreviewed Caddy module as a shortcut.

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

From an allowlisted client, verify valid HTTPS (no certificate-warning bypass),
`https://policyforge.example.com/api/health` = 200, and Analyze fixture loading,
manual/demo activation, simulation, stress, What-if and report downloads. From an
unlisted client, require 403 for the site AND API. Confirm that direct 3000/8000
connections from outside fail. Reject wildcard CORS and check an untrusted Origin
does not receive Access-Control-Allow-Origin. CORS is not authentication.

## 6. Public live AI prerequisites and rollback

Restricted live-OFF demonstration is the initial target. For public paid judging,
choose an operator-only bounded window with account-side spending controls, or add
durable atomic quotas/idempotency (for example PostgreSQL/Redis), per-user identity,
per-user and account request limits, gateway abuse limits and an auditable usage
ledger. Reserve request allowance before provider dispatch and do not refund it
automatically after timeout. Keep unknown usage unknown. A process-local budget
does not reserve $20.50 or account for teammate/external usage. No such persistent
quota system was implemented or claimed in Phase 9C.

Do not use the legacy LLM benchmark baseline on the host. It is now default-OFF
and requires --live-baseline plus live environment opt-in, but it does not use the
API's session quota. Never run it to validate deployment or reconstruct Phase 9B
billing. Health and deterministic verification need no inference.

On failure, keep live mode false, stop the two application services, restore the
previous reviewed source/build and restart only after local health checks pass.
Do not attempt live fallback inference. Keep the proxy allowlist in place. Review
sanitized status/errors instead of sharing full logs. No release actions in this
runbook were executed by Phase 9C.
