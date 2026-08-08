# Stage 7 verification status

Status: IN PROGRESS.

Scope: dependency license governance, CycloneDX SBOM generation and npm vulnerability-audit policy.

Existing baseline:

- the PoC workflow generates `THIRD_PARTY_NOTICES.md` and `dependency-license-matrix.json`;
- `npm sbom --sbom-format cyclonedx` produces `sbom.cdx.json`;
- `npm audit --json` is retained with its actual exit code;
- current artifacts are generated, but there is no explicit release policy that turns unacceptable licenses, missing metadata or vulnerability severity into a deterministic gate.

Stage 7 completion gates:

1. extract reusable dependency-governance policy and report-validation modules;
2. verify every production dependency has identifiable name, version and license metadata;
3. define an explicit allow/review/deny license policy, including unknown and multi-license expressions;
4. reject known deny-listed strong-copyleft or non-commercial licenses unless an approved exception is recorded;
5. validate the CycloneDX document structure, component identity and dependency coverage;
6. validate npm-audit JSON shape and enforce a documented severity policy without hiding its exit code;
7. support time-bounded, reasoned exceptions with owner and expiry fields;
8. ensure generated notices are deterministic and do not contain secrets or local absolute paths;
9. retain final license matrix, notices, SBOM, audit report and governance-summary evidence;
10. run final PoC and full-repository CI gates before closing the technology-selection sequence.

Restrictions:

- do not silently ignore unknown licenses or vulnerabilities;
- do not claim legal advice or universal license compatibility;
- do not modify dependency versions solely to make the report appear clean without an explicit remediation decision;
- do not merge into `main` until the final integration review.
