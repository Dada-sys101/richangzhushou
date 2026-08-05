import "dotenv/config";
import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";

import { AppModule } from "./app.module.js";

const DEFAULT_API_BASE_PATH = "/api/v1";
const DEFAULT_PORT = 3000;

function parseCorsOrigins(value: string | undefined): string[] {
  return (value ?? "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    abortOnError: true,
  });

  app.setGlobalPrefix(process.env.API_BASE_PATH ?? DEFAULT_API_BASE_PATH);
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableCors({
    credentials: true,
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
  });

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port, "127.0.0.1");
}

void bootstrap();
