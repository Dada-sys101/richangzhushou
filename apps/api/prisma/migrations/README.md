# Prisma migrations

WP1 establishes the MySQL datasource and shared enums only. It deliberately adds no
business tables, so the offline `prisma migrate diff --from-empty --to-schema ...`
result is empty. WP2 must create the first schema migration together with its models,
rollback notes, and concurrency tests.

To verify migrations against a real empty MySQL 8 database, create an untracked
`apps/api/.env` from `.env.example`, provision a local disposable database, and run:

```powershell
npm run prisma:migrate:deploy --workspace @daily-assistant/api
```

No production or shared database URL belongs in this repository.
