# Security and private reporting

The supported release is the current reviewed source on the release branch.
Dependency audit results are dated snapshots, not a guarantee against future issues.
Report suspected vulnerabilities privately to the repository owner through GitHub's
private vulnerability reporting feature if enabled, or an established private
owner contact. Do not place credentials, policy documents or exploit details in a
public issue. No security contact address has been invented for this project.

Production public demo requirements:

- `POLICYFORGE_PUBLIC_DEMO=true`, `POLICYFORGE_ENABLE_LIVE_AI=false`.
- Omit provider and workspace credentials; never publish the local root `.env`.
- HTTPS frontend/API, exact CORS allowlist, one backend worker and instance.
- Keep application rate, concurrency and workload limits enabled.
- Keep evidence on private persistent storage; never serve receipts as static files.
- No live compilation for anonymous judges. Public mode blocks even mock compilation.
- Process budgets and rate limits reset on restart. They are not durable account quotas.

An operator-only live demonstration needs a separate reviewed access decision,
workspace authorization and restricted network access, plus durable quotas before
multiple instances/users. No deployment guide authorizes a paid request. See
[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for acceptance checks and rollback.
