# Stage 5 verification status

Status: IN PROGRESS.

Scope: Web Push server-side request generation, subscription lifecycle and manual platform delivery checklist.

Existing baseline:

- the current test generates VAPID keys and encrypted Web Push request details without network delivery;
- the current platform matrix records iPhone, Android Chrome and desktop prerequisites;
- reminders remain queryable in-app, so Push is a best-effort delivery channel rather than the source of truth.

Stage 5 completion gates:

1. extract reusable Web Push configuration, validation and request-generation modules from test-only code;
2. validate VAPID subject/public/private configuration without storing secrets in the repository;
3. validate subscription endpoint, `p256dh` and `auth` inputs with stable error codes;
4. validate payload size, TTL, urgency, topic and deep-link safety boundaries;
5. define delivery states and endpoint lifecycle handling for success, expired subscriptions, rate limits and transient failures;
6. define bounded retry/backoff behavior and idempotency boundaries;
7. ensure send attempts and delivery results pass through a repository/audit interface;
8. retain automated request-generation and failure-classification evidence;
9. keep physical iPhone/Android/desktop delivery as an explicit manual gate unless real endpoints are supplied and permission is granted.

Restrictions:

- do not commit VAPID private keys or real push subscriptions;
- do not send notifications to real endpoints during the isolated PoC;
- do not treat request generation as proof of physical-device delivery;
- do not make Push the source of truth for reminders;
- do not merge into `main` until a later integration gate.
