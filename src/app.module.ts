import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { TransactionsMiddleware } from './middlewares/transactions.middleware';
import { TransactionsController } from './modules/transactions/transactions.controller';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, TransactionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TransactionsMiddleware)
      .forRoutes(TransactionsController);
  }
}
