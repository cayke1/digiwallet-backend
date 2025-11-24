import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { env } from './config/env.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(env.PORT, () => {
    Logger.log(`Port: ${env.PORT}`)
  });
}
bootstrap();
