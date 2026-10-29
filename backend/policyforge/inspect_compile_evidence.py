"""Read-only CLI entry point; does not initialize a provider client."""
from policyforge.compile_evidence import main


if __name__ == "__main__":
    raise SystemExit(main())
