import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DepositDto, TransferDto, ReversalDto } from './dto';
import { Decimal } from '@prisma/client/runtime/client';
import { randomUUID } from 'node:crypto';
import {
  FinancialTransaction,
  TransactionType,
  TransactionStatus,
} from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async deposit(
    userId: string,
    dto: DepositDto,
    idempotencyKey: string,
  ): Promise<FinancialTransaction | null> {
    return this.prisma.$transaction(async (tx) => {
      const existingKey = await tx.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });

      if (existingKey) {
        return tx.financialTransaction.findUnique({
          where: { idempotencyKey },
        });
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('Usuário não encontrado');
      }

      await tx.idempotencyKey.create({
        data: {
          key: idempotencyKey,
        },
      });

      const createdTransaction = await tx.financialTransaction.create({
        data: {
          ...dto,
          toUserId: userId,
          amount: new Decimal(dto.amount),
          type: 'DEPOSIT',
          idempotencyKey,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: new Decimal(dto.amount) } },
      });

      return createdTransaction;
    });
  }

  async transfer(
    userId: string,
    dto: TransferDto,
    idempotencyKey: string,
  ): Promise<{
    main: FinancialTransaction | null;
    mirror: FinancialTransaction | null;
  } | null> {
    const { toUserId, amount, description } = dto;
    const fromUserId = userId;
    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot transfer to the same user');
    }

    return this.prisma.$transaction(async (tx) => {
      const existingKey = await tx.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
        include: {
          transaction: {
            include: { reversals: true },
          },
        },
      });

      if (existingKey?.transaction) {
        const main = existingKey.transaction;

        const mirror = await tx.financialTransaction.findFirst({
          where: { relatedTransactionId: main.id },
        });

        return { main, mirror };
      }

      const fromUser = await tx.user.findUnique({ where: { id: fromUserId } });
      const toUser = await tx.user.findUnique({ where: { id: toUserId } });

      if (!fromUser || !toUser) {
        throw new NotFoundException('User not found');
      }

      if (fromUser.balance.lessThan(amount)) {
        throw new BadRequestException('Insufficient balance');
      }

  
      await tx.idempotencyKey.create({
        data: { key: idempotencyKey },
      });

      const mainTx = await tx.financialTransaction.create({
        data: {
          fromUserId,
          toUserId,
          amount,
          description,
          type: 'TRANSFER',
          idempotencyKey,
        },
      });


      const mirrorIdempotencyKey = randomUUID();
      await tx.idempotencyKey.create({
        data: { key: mirrorIdempotencyKey },
      });

      const mirrorTx = await tx.financialTransaction.create({
        data: {
          fromUserId: null,
          toUserId: fromUserId,
          amount,
          description: `Mirror of ${mainTx.id}`,
          type: 'TRANSFER',
          relatedTransactionId: mainTx.id,
          idempotencyKey: mirrorIdempotencyKey,
        },
      });

      await tx.user.update({
        where: { id: fromUserId },
        data: { balance: { decrement: amount } },
      });

      await tx.user.update({
        where: { id: toUserId },
        data: { balance: { increment: amount } },
      });

      return { main: mainTx, mirror: mirrorTx };
    });
  }

  async reversal(
    dto: ReversalDto,
    idempotencyKey: string,
  ): Promise<FinancialTransaction | null> {
    const { relatedTransactionId, description } = dto;

    return this.prisma.$transaction(async (tx) => {
      const existingKey = await tx.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
        include: { transaction: true },
      });

      if (existingKey?.transaction) {
        return existingKey.transaction;
      }


      const originalTx = await tx.financialTransaction.findUnique({
        where: { id: relatedTransactionId },
        include: { reversals: true },
      });


      if (!originalTx) {
        throw new NotFoundException('Transação original não encontrada');
      }

      if (originalTx.type === 'REVERSAL') {
        throw new BadRequestException('Não é possível reverter uma reversão');
      }

      if (originalTx.status === 'REVERSED') {
        throw new BadRequestException('Transação já foi revertida');
      }

      if (originalTx.status === 'FAILED') {
        throw new BadRequestException(
          'Não é possível reverter transação com falha',
        );
      }

      const hasReversal = originalTx.reversals.some(
        (rev) => rev.type === 'REVERSAL'
      );
      if (hasReversal) {
        throw new BadRequestException('Transação já possui uma reversão');
      }

      await tx.idempotencyKey.create({
        data: { key: idempotencyKey },
      });


      const reversalTx = await tx.financialTransaction.create({
        data: {
          fromUserId: originalTx.toUserId,
          toUserId: originalTx.fromUserId || originalTx.toUserId,
          amount: originalTx.amount,
          type: 'REVERSAL',
          status: 'COMPLETED',
          relatedTransactionId: originalTx.id,
          description: description || `Reversão de ${originalTx.id}`,
          idempotencyKey,
        },
      });

      if (originalTx.type === 'DEPOSIT') {
        const toUser = await tx.user.findUnique({
          where: { id: originalTx.toUserId },
        });

        if (toUser && toUser.balance.lessThan(originalTx.amount)) {
          throw new BadRequestException(
            'Saldo insuficiente para reverter esta transação',
          );
        }
      } else if (originalTx.type === 'TRANSFER' && originalTx.toUserId) {
        const toUser = await tx.user.findUnique({
          where: { id: originalTx.toUserId },
        });

        if (toUser && toUser.balance.lessThan(originalTx.amount)) {
          throw new BadRequestException(
            'Saldo insuficiente para reverter esta transação',
          );
        }
      }

      if (originalTx.type === 'DEPOSIT') {
        await tx.user.update({
          where: { id: originalTx.toUserId },
          data: { balance: { decrement: originalTx.amount } },
        });
      } else if (originalTx.type === 'TRANSFER') {
        await tx.user.update({
          where: { id: originalTx.toUserId },
          data: { balance: { decrement: originalTx.amount } },
        });

        if (originalTx.fromUserId) {
          await tx.user.update({
            where: { id: originalTx.fromUserId },
            data: { balance: { increment: originalTx.amount } },
          });
        }
      }


      await tx.financialTransaction.update({
        where: { id: originalTx.id },
        data: { status: 'REVERSED' },
      });

      if (originalTx.type === 'TRANSFER') {
        const mirrorTx = await tx.financialTransaction.findFirst({
          where: {
            relatedTransactionId: originalTx.id,
            type: 'TRANSFER',
          },
        });

        if (mirrorTx) {
          await tx.financialTransaction.update({
            where: { id: mirrorTx.id },
            data: { status: 'REVERSED' },
          });
        }
      }

      return reversalTx;
    });
  }

  async getTransactionHistory(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      type?: TransactionType;
      status?: TransactionStatus;
    },
  ): Promise<FinancialTransaction[]> {
    const { limit = 50, offset = 0, type, status } = options || {};

    return this.prisma.financialTransaction.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
        ...(type && { type }),
        ...(status && { status }),
      },
      include: {
        fromUser: {
          select: { id: true, name: true, email: true },
        },
        toUser: {
          select: { id: true, name: true, email: true },
        },
        relatedTransaction: true,
        reversals: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getTransactionById(
    transactionId: string,
    requestingUserId: string,
  ): Promise<FinancialTransaction | null> {
    const transaction = await this.prisma.financialTransaction.findUnique({
      where: { id: transactionId },
      include: {
        fromUser: {
          select: { id: true, name: true, email: true },
        },
        toUser: {
          select: { id: true, name: true, email: true },
        },
        relatedTransaction: true,
        reversals: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    const isInvolved =
      transaction.fromUserId === requestingUserId ||
      transaction.toUserId === requestingUserId;

    if (!isInvolved) {
      throw new ForbiddenException('Acesso negado a esta transação');
    }

    return transaction;
  }
}
