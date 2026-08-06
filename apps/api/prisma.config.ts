import "dotenv/config";

import { defineConfig } from "prisma/config";

const localValidationUrl =
  "mysql://daily_assistant:local-validation-only@127.0.0.1:3306/daily_assistant";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? localValidationUrl,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
