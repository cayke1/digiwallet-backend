import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionsService } from './transactions.service';

@Module({
    imports: [PrismaModule],
    controllers: [TransactionsController],
    providers: [TransactionsService],
})
export class TransactionsModule {}
