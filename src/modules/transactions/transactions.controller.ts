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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiParam,
  ApiHeader,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
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

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth('accessToken')
@ApiBearerAuth('JWT-auth')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Post('/deposit')
  @ApiOperation({
    summary: 'Realizar depósito',
    description:
      'Adiciona um valor ao saldo do usuário autenticado. Operação idempotente que requer header "idempotency-key" único (mínimo 16 caracteres). O saldo é atualizado atomicamente.',
  })
  @ApiHeader({
    name: 'idempotency-key',
    description:
      'Chave única para garantir idempotência da operação (mínimo 16 caracteres)',
    required: true,
    schema: { type: 'string', minLength: 16, example: 'deposit-' + Date.now() },
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['amount'],
      properties: {
        amount: {
          type: 'string',
          description:
            'Valor a ser depositado em formato decimal (ex: "100.00", "50.50")',
          example: '500.00',
          pattern: '^\\d+(\\.\\d{1,2})?$',
        },
        description: {
          type: 'string',
          description: 'Descrição opcional da transação',
          example: 'Depósito via PIX',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Depósito realizado com sucesso',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-v4' },
        fromUserId: { type: 'string', nullable: true, example: null },
        toUserId: { type: 'string', example: 'uuid-v4' },
        amount: { type: 'string', example: '500.00' },
        type: { type: 'string', enum: ['DEPOSIT'], example: 'DEPOSIT' },
        status: {
          type: 'string',
          enum: ['COMPLETED'],
          example: 'COMPLETED',
        },
        description: { type: 'string', example: 'Depósito via PIX' },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2025-01-15T14:30:00Z',
        },
        idempotencyKey: { type: 'string', example: 'deposit-1234567890' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou idempotency-key ausente/inválida',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'idempotency-key header is required',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflito - idempotency-key já utilizada (retorna transação existente)',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-v4' },
        message: {
          type: 'string',
          example: 'Transação já processada anteriormente',
        },
      },
    },
  })
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
  @ApiOperation({
    summary: 'Realizar transferência',
    description:
      'Transfere um valor do usuário autenticado para outro usuário. Operação atômica e idempotente que debita do remetente e credita ao destinatário. Requer header "idempotency-key" único (mínimo 16 caracteres). Cria transação espelho (mirror) para rastreabilidade.',
  })
  @ApiHeader({
    name: 'idempotency-key',
    description: 'Chave única para garantir idempotência (mínimo 16 caracteres)',
    required: true,
    schema: {
      type: 'string',
      minLength: 16,
      example: 'transfer-' + Date.now(),
    },
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['toUserId', 'amount'],
      properties: {
        toUserId: {
          type: 'string',
          description: 'ID do usuário destinatário',
          example: 'uuid-destinatario',
        },
        amount: {
          type: 'string',
          description:
            'Valor a ser transferido em formato decimal (ex: "100.00")',
          example: '250.00',
          pattern: '^\\d+(\\.\\d{1,2})?$',
        },
        description: {
          type: 'string',
          description: 'Descrição opcional da transferência',
          example: 'Pagamento de aluguel',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Transferência realizada com sucesso',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-v4' },
        fromUserId: { type: 'string', example: 'uuid-remetente' },
        toUserId: { type: 'string', example: 'uuid-destinatario' },
        amount: { type: 'string', example: '250.00' },
        type: { type: 'string', enum: ['TRANSFER'], example: 'TRANSFER' },
        status: {
          type: 'string',
          enum: ['COMPLETED'],
          example: 'COMPLETED',
        },
        description: { type: 'string', example: 'Pagamento de aluguel' },
        mirrorTransactionId: {
          type: 'string',
          description: 'ID da transação espelho',
          example: 'uuid-mirror',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2025-01-15T15:00:00Z',
        },
        idempotencyKey: { type: 'string', example: 'transfer-1234567890' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Dados inválidos, saldo insuficiente, ou tentativa de transferir para si mesmo',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Saldo insuficiente para realizar a transferência',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuário destinatário não encontrado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Usuário destinatário não encontrado' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflito - idempotency-key já utilizada (retorna transação existente)',
  })
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
  @ApiOperation({
    summary: 'Reverter transação',
    description:
      'Reverte uma transação anterior (depósito ou transferência). Cria uma operação inversa e marca a transação original como REVERSED. Apenas uma reversão por transação é permitida. Operação idempotente que requer header "idempotency-key" único.',
  })
  @ApiHeader({
    name: 'idempotency-key',
    description: 'Chave única para garantir idempotência (mínimo 16 caracteres)',
    required: true,
    schema: {
      type: 'string',
      minLength: 16,
      example: 'reversal-' + Date.now(),
    },
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['relatedTransactionId'],
      properties: {
        relatedTransactionId: {
          type: 'string',
          description: 'ID da transação a ser revertida',
          example: 'uuid-transacao-original',
        },
        description: {
          type: 'string',
          description: 'Descrição opcional da reversão',
          example: 'Estorno por solicitação do cliente',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Reversão realizada com sucesso',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-v4' },
        fromUserId: { type: 'string', nullable: true, example: 'uuid-remetente' },
        toUserId: { type: 'string', example: 'uuid-destinatario' },
        amount: {
          type: 'string',
          description: 'Valor da reversão (mesmo da transação original)',
          example: '250.00',
        },
        type: { type: 'string', enum: ['REVERSAL'], example: 'REVERSAL' },
        status: {
          type: 'string',
          enum: ['COMPLETED'],
          example: 'COMPLETED',
        },
        relatedTransactionId: {
          type: 'string',
          description: 'ID da transação original revertida',
          example: 'uuid-transacao-original',
        },
        description: {
          type: 'string',
          example: 'Estorno por solicitação do cliente',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2025-01-15T16:00:00Z',
        },
        idempotencyKey: { type: 'string', example: 'reversal-1234567890' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Transação já revertida ou dados inválidos',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Transação já foi revertida anteriormente',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Transação original não encontrada',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Transação não encontrada' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflito - idempotency-key já utilizada (retorna transação existente)',
  })
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
  @ApiOperation({
    summary: 'Obter histórico de transações',
    description:
      'Retorna o histórico de transações do usuário autenticado com suporte a paginação e filtros por tipo e status. Inclui tanto transações enviadas quanto recebidas.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Número máximo de resultados a retornar (padrão: sem limite)',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Número de resultados a pular para paginação (padrão: 0)',
    example: 0,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: TransactionType,
    description: 'Filtrar por tipo de transação',
    example: 'TRANSFER',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TransactionStatus,
    description: 'Filtrar por status da transação',
    example: 'COMPLETED',
  })
  @ApiResponse({
    status: 200,
    description: 'Histórico retornado com sucesso',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'uuid-v4' },
          fromUserId: {
            type: 'string',
            nullable: true,
            example: 'uuid-remetente',
          },
          toUserId: { type: 'string', example: 'uuid-destinatario' },
          amount: { type: 'string', example: '250.00' },
          type: {
            type: 'string',
            enum: ['DEPOSIT', 'TRANSFER', 'REVERSAL'],
            example: 'TRANSFER',
          },
          status: {
            type: 'string',
            enum: ['COMPLETED', 'REVERSED', 'FAILED'],
            example: 'COMPLETED',
          },
          relatedTransactionId: {
            type: 'string',
            nullable: true,
            example: null,
          },
          mirrorTransactionId: {
            type: 'string',
            nullable: true,
            example: 'uuid-mirror',
          },
          description: { type: 'string', nullable: true, example: 'Pagamento' },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-15T15:00:00Z',
          },
          idempotencyKey: { type: 'string', example: 'transfer-1234567890' },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
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
  @ApiOperation({
    summary: 'Obter transação por ID',
    description:
      'Retorna os detalhes de uma transação específica. O usuário autenticado deve ser o remetente ou destinatário da transação.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID único da transação',
    example: 'uuid-transacao',
  })
  @ApiResponse({
    status: 200,
    description: 'Transação encontrada com sucesso',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-v4' },
        fromUserId: {
          type: 'string',
          nullable: true,
          example: 'uuid-remetente',
        },
        toUserId: { type: 'string', example: 'uuid-destinatario' },
        amount: { type: 'string', example: '250.00' },
        type: {
          type: 'string',
          enum: ['DEPOSIT', 'TRANSFER', 'REVERSAL'],
          example: 'TRANSFER',
        },
        status: {
          type: 'string',
          enum: ['COMPLETED', 'REVERSED', 'FAILED'],
          example: 'COMPLETED',
        },
        relatedTransactionId: {
          type: 'string',
          nullable: true,
          example: null,
        },
        mirrorTransactionId: {
          type: 'string',
          nullable: true,
          example: 'uuid-mirror',
        },
        description: { type: 'string', nullable: true, example: 'Pagamento' },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2025-01-15T15:00:00Z',
        },
        idempotencyKey: { type: 'string', example: 'transfer-1234567890' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Transação não encontrada ou usuário sem permissão',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Transação não encontrada' },
      },
    },
  })
  async getTransaction(@Param('id') id: string, @CurrentUser() user: any) {
    return this.transactionsService.getTransactionById(id, user.id);
  }
}
