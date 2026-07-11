import { config } from 'dotenv';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

config({ path: join(__dirname, '..', '.env') });

function corsOrigins(): string[] {
  return (process.env['CORS_ORIGINS'] ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Baseline security headers without pulling in an extra dependency. */
function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.removeHeader('X-Powered-By');
  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.enableCors({ origin: corsOrigins(), credentials: true });
  app.setGlobalPrefix('api');
  app.use(securityHeaders);
  // Generated artifacts (feature/steps/page-object sources) arrive as JSON.
  app.use(json({ limit: process.env['BODY_LIMIT'] ?? '5mb' }));
  app.use(urlencoded({ extended: true, limit: process.env['BODY_LIMIT'] ?? '5mb' }));
  // Let OnModuleDestroy hooks run (kills recorder browsers, stops schedules).
  app.enableShutdownHooks();

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
  logger.log(
    `API listening on :${port} — recorder=${process.env['CODEGEN_RECORDER'] ?? 'local'}, db=${process.env['DB_PROVIDER'] ?? 'prisma'}`,
  );
}

void bootstrap();
