# Daily Assistant V2 v1.5 Technology Selection PoCs

This directory is intentionally isolated from the production workspaces. It validates technical choices before dependencies or schemas are introduced into the main application.

Execution order:

1. RRULE comparison
2. Local encryption
3. IndexedDB migration
4. CSV/XLSX import
5. Web Push server-side request generation and manual platform checklist
6. AI Adapter with capability probing and failover
7. License, SBOM, and npm audit generation

## Run locally

Requires Node 24, npm 11, and Python 3 with `openpyxl`.

```bash
cd pocs/v15-tech-selection
npm install
python -m pip install openpyxl==3.1.5
python scripts/generate-fixtures.py
npm run poc
npm audit --json > results/npm-audit.json || true
npm sbom --sbom-format cyclonedx > results/sbom.cdx.json
```

## Truthfulness boundary

Automated CI can validate recurrence semantics, encryption primitives, IndexedDB rollback, parser correctness/performance, Push request encryption, Adapter failover, SBOM, and audit output. It cannot claim successful delivery to a physical iPhone/Android device, cannot call paid AI providers without secrets, and cannot validate private WeChat/Alipay exports not supplied to the repository. Those remain explicit manual gates.
