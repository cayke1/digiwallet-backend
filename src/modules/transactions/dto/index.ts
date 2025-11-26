import { TransactionStatus, TransactionType } from '@prisma/client';
import z from 'zod';

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Invalid decimal format');
export interface Transaction {
  id: string;
  fromUserId?: string;
  toUserId: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  relatedTransactionId?: string;
  description?: string;
  createdAt: string;
}

export const depositSchema = z.object({
  amount: decimalString,
  description: z.string().optional(),
});

export const transferSchema = z.object({
  toUserId: z.string().min(1),
  amount: decimalString,
  description: z.string().optional(),
});

export const reversalSchema = z.object({
  relatedTransactionId: z.string().min(1),
  description: z.string().optional(),
});

export const unifiedTransactionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('DEPOSIT'),
    toUserId: z.string().min(1),
    amount: decimalString,
    description: z.string().optional(),
  }),

  z
    .object({
      type: z.literal('TRANSFER'),
      fromUserId: z.string().min(1),
      toUserId: z.string().min(1),
      amount: decimalString,
      description: z.string().optional(),
    })
    .refine((data) => data.fromUserId !== data.toUserId, {
      message: 'Cannot transfer to yourself',
      path: ['toUserId'],
    }),

  z.object({
    type: z.literal('REVERSAL'),
    relatedTransactionId: z.string().min(1),
    description: z.string().optional(),
  }),
]);

export type DepositDto = z.infer<typeof depositSchema>;
export type TransferDto = z.infer<typeof transferSchema>;
export type ReversalDto = z.infer<typeof reversalSchema>;
export type UnifiedTransactionDto = z.infer<typeof unifiedTransactionSchema>;
