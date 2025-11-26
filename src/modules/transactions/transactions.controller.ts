import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Query,
  Param,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { type Request } from 'express';
import {
  depositSchema,
  type DepositDto,
  reversalSchema,
  type ReversalDto,
  transferSchema,
  type TransferDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  FinancialTransaction,
  TransactionType,
  TransactionStatus,
} from '@prisma/client';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Post('/deposit')

  deposit(
    @CurrentUser() user: any,
    @Req() request: Request,
    @Body(new ZodValidationPipe(depositSchema)) depositDto: DepositDto,
  ) {
    return this.transactionsService.deposit(
      user.id,
      depositDto,
      request.headers['idempotency-key'] as string,
    );
  }

  @Post('/transfer')
  async transfer(
    @CurrentUser() user: any,
    @Req() request: Request,
    @Body(new ZodValidationPipe(transferSchema)) transferDto: TransferDto,
  ) {
    return this.transactionsService.transfer(
      user.id,
      transferDto,
      request.headers['idempotency-key'] as string,
    );
  }

  @Post('/reversal')
  async reversal(
    @Req() request: Request,
    @Body(new ZodValidationPipe(reversalSchema)) reversalDto: ReversalDto,
  ) {
    return this.transactionsService.reversal(
      reversalDto,
      request.headers['idempotency-key'] as string,
    );
  }

  @Get('/history')
  async getHistory(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('type') type?: TransactionType,
    @Query('status') status?: TransactionStatus,
  ): Promise<FinancialTransaction[]> {
    return this.transactionsService.getTransactionHistory(user.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      type,
      status,
    });
  }

  @Get('/:id')
  async getTransaction(@Param('id') id: string, @CurrentUser() user: any) {
    return this.transactionsService.getTransactionById(id, user.id);
  }
}
