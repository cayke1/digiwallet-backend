import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { env } from './config/env.config';
import * as cookieParser from 'cookie-parser';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser.default());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  await app.listen(env.PORT, () => {
    Logger.log(`Server running on port ${env.PORT}`);
    Logger.log(`Environment: ${env.NODE_ENV}`);
  });
}
bootstrap();
