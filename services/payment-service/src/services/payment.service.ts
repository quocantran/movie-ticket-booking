import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { WalletEntity } from '../entities/wallet.entity';
import { PaymentEntity, PaymentStatus } from '../entities/payment.entity';
import {
  OutboxService,
  AGGREGATE_TYPES,
  EVENT_TYPES,
  SeatsReservedPayload,
} from '@app/common';

@Injectable()
export class PaymentService {
  constructor(
    private readonly outboxService: OutboxService,
    private readonly dataSource: DataSource,
  ) {}

  async processPayment(payload: SeatsReservedPayload): Promise<void> {
    const { bookingId, userId, showtimeId, seatIds, totalAmount } = payload;

    await this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(WalletEntity);
      const paymentRepo = manager.getRepository(PaymentEntity);

      const wallet = await walletRepo.findOne({ where: { userId } });

      if (!wallet) {
        const payment = paymentRepo.create({
          id: uuidv4(),
          bookingId,
          userId,
          amount: totalAmount,
          status: PaymentStatus.FAILED,
          failureReason: `Không tìm thấy ví tài khoản người dùng: ${userId}`,
        });
        await paymentRepo.save(payment);

        await this.outboxService.createEventInTransaction(manager, {
          aggregateType: AGGREGATE_TYPES.PAYMENT,
          aggregateId: bookingId,
          eventType: EVENT_TYPES.PAYMENT_FAILED,
          payload: {
            bookingId,
            showtimeId,
            seatIds,
            reason: `Không tìm thấy ví tài khoản người dùng: ${userId}`,
          },
        });
        return;
      }

      const balance = Number(wallet.balance);
      if (balance < totalAmount) {
        const payment = paymentRepo.create({
          id: uuidv4(),
          bookingId,
          userId,
          amount: totalAmount,
          status: PaymentStatus.FAILED,
          failureReason: `Tài khoản không đủ số dư. Số dư: ${balance} VNĐ, Yêu cầu: ${totalAmount} VNĐ`,
        });
        await paymentRepo.save(payment);

        await this.outboxService.createEventInTransaction(manager, {
          aggregateType: AGGREGATE_TYPES.PAYMENT,
          aggregateId: bookingId,
          eventType: EVENT_TYPES.PAYMENT_FAILED,
          payload: {
            bookingId,
            showtimeId,
            seatIds,
            reason: `Tài khoản không đủ số dư. Số dư: ${balance} VNĐ, Yêu cầu: ${totalAmount} VNĐ`,
          },
        });
        return;
      }

      const newBalance = balance - totalAmount;
      await walletRepo.update(userId, { balance: newBalance });

      const paymentId = uuidv4();
      const payment = paymentRepo.create({
        id: paymentId,
        bookingId,
        userId,
        amount: totalAmount,
        status: PaymentStatus.PROCESSED,
      });
      await paymentRepo.save(payment);

      await this.outboxService.createEventInTransaction(manager, {
        aggregateType: AGGREGATE_TYPES.PAYMENT,
        aggregateId: bookingId,
        eventType: EVENT_TYPES.PAYMENT_PROCESSED,
        payload: {
          bookingId,
          paymentId,
          amount: totalAmount,
        },
      });
    });
  }
}
