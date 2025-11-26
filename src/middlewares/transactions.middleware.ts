import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';

@Injectable()
export class TransactionsMiddleware implements NestMiddleware {
  use(req: Request, _: Response, next: () => void) {
    const idempotencyKey = req.headers['idempotency-key'];

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      throw new BadRequestException(
        'Cabeçalho idempotency-key é obrigatório'
      );
    }

    if (idempotencyKey.length < 16) {
      throw new BadRequestException(
        'Idempotency-key deve ter no mínimo 16 caracteres'
      );
    }

    next();
  }
}
