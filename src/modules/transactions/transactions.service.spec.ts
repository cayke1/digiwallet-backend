import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
    financialTransaction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    idempotencyKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deposit', () => {
    it('deve criar uma transação de depósito e atualizar o saldo', async () => {
      const depositDto = {
        amount: '100.00',
      };
      const idempotencyKey = 'test-key-123456789012345678';

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        balance: Decimal(0),
      });
      mockPrismaService.financialTransaction.create.mockResolvedValue({
        id: 'tx-1',
        toUserId: 'user-1',
        amount: new Decimal(100),
        type: 'DEPOSIT',
        status: 'COMPLETED',
        idempotencyKey,
      });

      const result = await service.deposit('user-1', depositDto, idempotencyKey);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(mockPrismaService.financialTransaction.create).toHaveBeenCalled();
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { balance: { increment: expect.any(Decimal) } },
      });
      expect(result!.id).toBe('tx-1');
    });

    it('deve respeitar idempotência', async () => {
      const depositDto = {
        amount: '100.00',
      };
      const idempotencyKey = 'test-key-123456789012345678';

      const existingTx = {
        id: 'tx-1',
        toUserId: 'user-1',
        amount: new Decimal(100),
        type: 'DEPOSIT',
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        key: idempotencyKey,
      });
      mockPrismaService.financialTransaction.findUnique.mockResolvedValue(existingTx);

      const result = await service.deposit('user-1',depositDto, idempotencyKey);

      expect(result).toEqual(existingTx);
      expect(mockPrismaService.financialTransaction.create).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException se o usuário não existir', async () => {
      const depositDto = {
        amount: '100.00',
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.deposit('user-1', depositDto, 'key-12345678901234567890'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('transfer', () => {
    it('deve criar transferência e atualizar saldos de ambos usuários', async () => {
      const transferDto = {
        fromUserId: 'user-1',
        toUserId: 'user-2',
        amount: '50.00',
      };
      const idempotencyKey = 'test-key-123456789012345678';

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          balance: new Decimal(100),
        })
        .mockResolvedValueOnce({
          id: 'user-2',
          balance: new Decimal(0),
        });

      mockPrismaService.financialTransaction.create
        .mockResolvedValueOnce({
          id: 'tx-main',
          fromUserId: 'user-1',
          toUserId: 'user-2',
          amount: new Decimal(50),
          type: 'TRANSFER',
        })
        .mockResolvedValueOnce({
          id: 'tx-mirror',
          fromUserId: null,
          toUserId: 'user-1',
          amount: new Decimal(50),
          type: 'TRANSFER',
          mirrorTransactionId: 'tx-main',
        });

      const result = await service.transfer('user-1',transferDto, idempotencyKey);

      expect(result!.main!.id).toBe('tx-main');
      expect(result!.mirror!.id).toBe('tx-mirror');
      expect(mockPrismaService.user.update).toHaveBeenCalledTimes(2);
    });

    it('deve lançar BadRequestException se tentar transferir para o mesmo usuário', async () => {
      const transferDto = {
        toUserId: 'user-1',
        amount: '50.00',
      };

      await expect(
        service.transfer('user-1',transferDto, 'key-12345678901234567890'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException se saldo insuficiente', async () => {
      const transferDto = {
        toUserId: 'user-2',
        amount: '150.00',
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          balance: new Decimal(100),
        })
        .mockResolvedValueOnce({
          id: 'user-2',
          balance: new Decimal(0),
        });

      await expect(
        service.transfer('user-1',transferDto, 'key-12345678901234567890'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve respeitar idempotência na transferência', async () => {
      const transferDto = {
        toUserId: 'user-2',
        amount: '50.00',
      };
      const idempotencyKey = 'test-key-123456789012345678';

      const existingMain = {
        id: 'tx-main',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        amount: new Decimal(50),
        type: 'TRANSFER',
      };

      const existingMirror = {
        id: 'tx-mirror',
        mirrorTransactionId: 'tx-main',
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        key: idempotencyKey,
        transaction: existingMain,
      });
      mockPrismaService.financialTransaction.findFirst.mockResolvedValue(
        existingMirror,
      );

      const result = await service.transfer('user-1',transferDto, idempotencyKey);

      expect(result!.main).toEqual(existingMain);
      expect(result!.mirror).toEqual(existingMirror);
      expect(mockPrismaService.financialTransaction.create).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException se um dos usuários não existir', async () => {
      const transferDto = {
        toUserId: 'user-999',
        amount: '50.00',
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          balance: new Decimal(100),
        })
        .mockResolvedValueOnce(null);

      await expect(
        service.transfer('user-1',transferDto, 'key-12345678901234567890'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reversal', () => {
    it('deve reverter um depósito e decrementar saldo', async () => {
      const reversalDto = {
        relatedTransactionId: 'tx-deposit',
      };
      const idempotencyKey = 'test-key-123456789012345678';

      const originalTx = {
        id: 'tx-deposit',
        toUserId: 'user-1',
        amount: new Decimal(100),
        type: 'DEPOSIT',
        status: 'COMPLETED',
        reversals: [],
        mirrorOf: [],
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.financialTransaction.findUnique.mockResolvedValue(originalTx);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        balance: new Decimal(100),
      });
      mockPrismaService.financialTransaction.create.mockResolvedValue({
        id: 'tx-reversal',
        type: 'REVERSAL',
        relatedTransactionId: 'tx-deposit',
      });

      const result = await service.reversal(reversalDto, idempotencyKey);

      expect(result!.type).toBe('REVERSAL');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { balance: { decrement: originalTx.amount } },
      });
      expect(mockPrismaService.financialTransaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-deposit' },
        data: { status: 'REVERSED' },
      });
    });

    it('deve reverter uma transferência e restaurar saldos', async () => {
      const reversalDto = {
        relatedTransactionId: 'tx-transfer',
      };
      const idempotencyKey = 'test-key-123456789012345678';

      const originalTx = {
        id: 'tx-transfer',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        amount: new Decimal(50),
        type: 'TRANSFER',
        status: 'COMPLETED',
        reversals: [],
        mirrorOf: [],
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.financialTransaction.findUnique.mockResolvedValue(originalTx);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-2',
        balance: new Decimal(50),
      });
      mockPrismaService.financialTransaction.create.mockResolvedValue({
        id: 'tx-reversal',
        type: 'REVERSAL',
      });
      mockPrismaService.financialTransaction.findFirst.mockResolvedValue({
        id: 'tx-mirror',
        mirrorTransactionId: 'tx-transfer',
      });

      await service.reversal(reversalDto, idempotencyKey);

      expect(mockPrismaService.user.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.financialTransaction.update).toHaveBeenCalledTimes(2);
    });

    it('deve lançar NotFoundException se transação original não existir', async () => {
      const reversalDto = {
        relatedTransactionId: 'tx-999',
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.financialTransaction.findUnique.mockResolvedValue(null);

      await expect(
        service.reversal(reversalDto, 'key-12345678901234567890'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar BadRequestException se tentar reverter uma reversão', async () => {
      const reversalDto = {
        relatedTransactionId: 'tx-reversal',
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.financialTransaction.findUnique.mockResolvedValue({
        id: 'tx-reversal',
        type: 'REVERSAL',
        reversals: [],
        mirrorOf: [],
      });

      await expect(
        service.reversal(reversalDto, 'key-12345678901234567890'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException se transação já foi revertida', async () => {
      const reversalDto = {
        relatedTransactionId: 'tx-1',
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.financialTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        type: 'DEPOSIT',
        status: 'REVERSED',
        reversals: [],
        mirrorOf: [],
      });

      await expect(
        service.reversal(reversalDto, 'key-12345678901234567890'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException se saldo insuficiente para reverter', async () => {
      const reversalDto = {
        relatedTransactionId: 'tx-deposit',
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.financialTransaction.findUnique.mockResolvedValue({
        id: 'tx-deposit',
        toUserId: 'user-1',
        amount: new Decimal(100),
        type: 'DEPOSIT',
        status: 'COMPLETED',
        reversals: [],
        mirrorOf: [],
      });
      mockPrismaService.financialTransaction.create.mockResolvedValue({
        id: 'tx-reversal',
        type: 'REVERSAL',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        balance: new Decimal(50),
      });

      await expect(
        service.reversal(reversalDto, 'key-12345678901234567890'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve respeitar idempotência na reversão', async () => {
      const reversalDto = {
        relatedTransactionId: 'tx-1',
      };
      const idempotencyKey = 'test-key-123456789012345678';

      const existingReversal = {
        id: 'tx-reversal',
        type: 'REVERSAL',
        relatedTransactionId: 'tx-1',
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        key: idempotencyKey,
        transaction: existingReversal,
      });

      const result = await service.reversal(reversalDto, idempotencyKey);

      expect(result).toEqual(existingReversal);
      expect(mockPrismaService.financialTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('getTransactionHistory', () => {
    it('deve retornar histórico de transações do usuário', async () => {
      const userId = 'user-1';
      const transactions = [
        {
          id: 'tx-1',
          fromUserId: 'user-1',
          toUserId: 'user-2',
          amount: new Decimal(100),
        },
        {
          id: 'tx-2',
          fromUserId: 'user-2',
          toUserId: 'user-1',
          amount: new Decimal(50),
        },
      ];

      mockPrismaService.financialTransaction.findMany.mockResolvedValue(transactions);

      const result = await service.getTransactionHistory(userId);

      expect(result).toEqual(transactions);
      expect(mockPrismaService.financialTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ fromUserId: userId }, { toUserId: userId }],
          }),
        }),
      );
    });

    it('deve filtrar por tipo de transação', async () => {
      const userId = 'user-1';

      mockPrismaService.financialTransaction.findMany.mockResolvedValue([]);

      await service.getTransactionHistory(userId, { type: 'DEPOSIT' });

      expect(mockPrismaService.financialTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'DEPOSIT',
          }),
        }),
      );
    });

    it('deve respeitar limite e offset', async () => {
      const userId = 'user-1';

      mockPrismaService.financialTransaction.findMany.mockResolvedValue([]);

      await service.getTransactionHistory(userId, {
        limit: 10,
        offset: 5,
      });

      expect(mockPrismaService.financialTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        }),
      );
    });
  });

  describe('getTransactionById', () => {
    it('deve retornar detalhes da transação se usuário está envolvido', async () => {
      const transactionId = 'tx-1';
      const userId = 'user-1';

      const transaction = {
        id: 'tx-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        amount: new Decimal(100),
      };

      mockPrismaService.financialTransaction.findUnique.mockResolvedValue(transaction);

      const result = await service.getTransactionById(transactionId, userId);

      expect(result).toEqual(transaction);
    });

    it('deve lançar NotFoundException se transação não existir', async () => {
      mockPrismaService.financialTransaction.findUnique.mockResolvedValue(null);

      await expect(
        service.getTransactionById('tx-999', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ForbiddenException se usuário não está envolvido', async () => {
      const transaction = {
        id: 'tx-1',
        fromUserId: 'user-2',
        toUserId: 'user-3',
        amount: new Decimal(100),
      };

      mockPrismaService.financialTransaction.findUnique.mockResolvedValue(transaction);

      await expect(
        service.getTransactionById('tx-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
