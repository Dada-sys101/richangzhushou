# Stage 2 — Local Encryption PoC

Status: final verification pending.

Implementation:

- `lib/local-crypto.mjs`
- `tests/02-local-encryption.test.mjs`
- command: `npm run test:local-encryption`

Acceptance report:

- `../../docs/33-v15-stage2-local-encryption-poc-report.md`

Frozen candidate:

- Web Crypto AES-256-GCM
- non-extractable per-user/per-device/versioned `CryptoKey`
- IndexedDB structured-clone persistence
- AAD binding for user and record identity
- explicit logout erases the active account's key and ciphertext
- temporary session loss retains encrypted data for offline mode

This file exists to archive the stage boundary and trigger final CI/PoC verification after formatting review.
