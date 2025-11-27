import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { env } from './config/env.config';
import * as cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser.default());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('DigiWallet API')
    .setDescription(
      'API de carteira digital com operações financeiras seguras, consistentes, auditáveis e idempotentes. Suporta depósitos, transferências, reversões e consulta de histórico de transações.',
    )
    .setVersion('1.0')
    .addTag('auth', 'Autenticação e gerenciamento de tokens JWT')
    .addTag('users', 'Gerenciamento de usuários')
    .addTag('transactions', 'Operações financeiras e histórico de transações')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Token JWT de autenticação',
        in: 'header',
      },
      'JWT-auth',
    )
    .addCookieAuth('accessToken', {
      type: 'apiKey',
      in: 'cookie',
      name: 'accessToken',
      description: 'Token de acesso armazenado em cookie HttpOnly',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'DigiWallet API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(env.PORT, () => {
    Logger.log(`Server running on port ${env.PORT}`);
    Logger.log(`Environment: ${env.NODE_ENV}`);
    Logger.log(
      `Swagger documentation available at http://localhost:${env.PORT}/api/docs`,
    );
  });
}
bootstrap();
