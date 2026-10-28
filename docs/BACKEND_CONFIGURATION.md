# Local Nebius configuration

Backend source directory:
`C:\Users\Suyash Rastogi\PolicyForge\backend`

Add the real key manually to this checkout's root configuration file:
`C:\Users\Suyash Rastogi\PolicyForge\.env`

The local file is prepared with an empty key. Do not put credentials in
`.env.example`, frontend configuration, source code or chat.

```dotenv
NEBIUS_API_KEY=
NEBIUS_MODEL=nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/
REQUEST_TIMEOUT_SECONDS=30.0
MAX_RETRIES=0
```

Replace only the empty API-key value locally. The selected Nano model ID was
listed active in the [official public model catalog](https://tokenfactory.nebius.com/api/public/models_info)
on 2026-10-29. No account-specific availability or inference has been tested.
The previous code default Nemotron-4-340B ID was absent from that catalog.

## Loading and precedence

`backend/policyforge/llm.py` already uses installed `python-dotenv`.
It now resolves this checkout's root `.env` from the module's absolute path,
so starting from the root or backend directory loads the same file. It loads
at module import with `override=False`: explicitly inherited environment
variables take priority. Restart the Python backend after editing the file.

LLMClient reads `NEBIUS_API_KEY`, `NEBIUS_MODEL` and `NEBIUS_BASE_URL`.
Explicit constructor arguments take priority; existing OPENAI_* compatibility
fallbacks remain. Keep Nebius variables set when selecting Nebius. No key value
is logged by this loader. Do not enable HTTP/SDK debug logging or print `.env`.

`.gitignore` already ignores `.env` and `.env.*`, including backend copies,
while retaining the credential-free `.env.example`. Never force-add `.env`.

## Restart in PowerShell

Stop the existing Uvicorn process with Ctrl+C in its terminal. Then run:

```powershell
Set-Location 'C:\Users\Suyash Rastogi\PolicyForge'
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
& 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -m uvicorn policyforge.api:app --host 127.0.0.1 --port 8000
```

This is the existing Python 3.11 environment used for local backend verification;
no new packages are required for this configuration change. Its location is
temporary; if it is later removed, recreate the Python 3.11 environment before
running this command. A project-local virtual environment is not present.

## Integration readiness and remaining single-call controls

The existing backend compiler sends source clauses to LLMClient, validates output
using Pydantic Rule, checks source quotations and performs linting. Loading the
file or starting Uvicorn makes no inference request. Frontend live extraction
remains disabled. The current compile route can fall back to fixtures without a
key; that is not a successful live integration test.

Automatic SDK retries are disabled, and wrapper retries default to zero.
Standard pytest excludes `live` tests by default. Do not run `pytest -m live`,
the benchmark, or the compile endpoint while merely configuring credentials.

A future authorized one-call smoke test must still enforce a low output-token
cap, one clause, one provider request, `max_repairs=0`, and no retries. The
general compiler currently defaults to two repairs and has no output-token cap;
do not use its unrestricted defaults for that test. Account access and actual
extraction remain unverified until the separately authorized smoke test.

No fake API key or paid inference request was made during this preparation.
Configure the real key manually, then ask to continue.
