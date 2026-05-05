import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { TopupEntity, TopupStatus } from '../entities/topup.entity';
import { WalletEntity } from '../entities/wallet.entity';

export type TopupVerifyResult = 'PAID' | 'CANCELLED' | 'EXPIRED' | 'PENDING';

@Injectable()
export class TopupService {
  private readonly logger = new Logger(TopupService.name);
  private static readonly FETCH_TIMEOUT_MS = 15000;

  constructor(
    @InjectRepository(TopupEntity)
    private readonly topupRepository: Repository<TopupEntity>,
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) { }

  private generateOrderCode(): number {
    const timestamp = Date.now() % 1000000000;
    const random = Math.floor(Math.random() * 1000);
    return Number(`${timestamp}${random}`.slice(0, 9).padEnd(9, '0'));
  }

  private createSignature(data: string): string {
    const checksumKey = this.configService.get<string>('PAYOS_CHECKSUM_KEY', '');
    return crypto.createHmac('sha256', checksumKey).update(data).digest('hex');
  }

  private verifyWebhookSignature(data: Record<string, any>, signature: string): boolean {
    const checksumKey = this.configService.get<string>('PAYOS_CHECKSUM_KEY', '');

    const sortedKeys = Object.keys(data).sort();
    const dataStr = sortedKeys
      .filter((key) => data[key] !== undefined)
      .map((key) => {
        let value = data[key];
        if (value === null || value === undefined || value === 'undefined' || value === 'null') {
          value = '';
        }
        if (Array.isArray(value)) {
          value = JSON.stringify(
            value.map((val: any) => {
              if (typeof val === 'object' && val !== null) {
                return Object.keys(val)
                  .sort()
                  .reduce((obj: Record<string, any>, k: string) => {
                    obj[k] = val[k];
                    return obj;
                  }, {});
              }
              return val;
            }),
          );
        }
        return `${key}=${value}`;
      })
      .join('&');

    const computedSignature = crypto
      .createHmac('sha256', checksumKey)
      .update(dataStr)
      .digest('hex');

    return computedSignature === signature;
  }

  private fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TopupService.FETCH_TIMEOUT_MS);

    return fetch(url, { ...options, signal: controller.signal }).finally(() =>
      clearTimeout(timeoutId),
    );
  }

  private async fetchPayosPaymentRequest(orderCode: number): Promise<any> {
    const payosUrl = this.configService.get<string>('PAYOS_URL', 'https://api-merchant.payos.vn');
    const apiKey = this.configService.get<string>('PAYOS_API_KEY', '');
    const clientId = this.configService.get<string>('PAYOS_CLIENT_ID', '');

    const res = await this.fetchWithTimeout(`${payosUrl}/v2/payment-requests/${orderCode}`, {
      headers: {
        'x-api-key': apiKey,
        'x-client-id': clientId,
        'Content-Type': 'application/json',
      },
      method: 'GET',
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'Unknown error');
      throw new BadRequestException(`Không thể kiểm tra trạng thái thanh toán: ${errorBody}`);
    }

    const resp = await res.json();
    return resp.data;
  }

  private async markTopupStatus(orderCode: number, status: TopupStatus): Promise<void> {
    await this.topupRepository
      .createQueryBuilder()
      .update(TopupEntity)
      .set({ status })
      .where('orderCode = :orderCode AND status = :pending', {
        orderCode,
        pending: TopupStatus.PENDING,
      })
      .execute();
  }

  private async syncTopupFromPayos(topup: TopupEntity): Promise<TopupVerifyResult> {
    if (topup.status === TopupStatus.PAID) return 'PAID';
    if (topup.status === TopupStatus.CANCELLED) return 'CANCELLED';
    if (topup.status === TopupStatus.EXPIRED) return 'EXPIRED';

    const payosData = await this.fetchPayosPaymentRequest(topup.orderCode);
    const payosStatus = String(payosData?.status || '').toUpperCase();

    if (payosStatus === 'PAID') {
      const transaction = payosData.transactions?.[0];
      if (Number(payosData.amount) !== Number(topup.amount)) {
        this.logger.error(`Amount mismatch: payOS=${payosData.amount}, local=${topup.amount}, orderCode=${topup.orderCode}`);
        throw new BadRequestException('Số tiền không khớp');
      }

      await this.dataSource.transaction(async (manager) => {
        await this.creditWallet(manager, topup, {
          reference: transaction?.reference,
          counterAccountBankName: transaction?.counterAccountBankName,
          counterAccountName: transaction?.counterAccountName,
          counterAccountNumber: transaction?.counterAccountNumber,
          transactionDateTime: transaction?.transactionDateTime,
        });
      });
      return 'PAID';
    }

    if (payosStatus === 'CANCELLED') {
      await this.markTopupStatus(topup.orderCode, TopupStatus.CANCELLED);
      return 'CANCELLED';
    }

    if (payosStatus === 'EXPIRED') {
      await this.markTopupStatus(topup.orderCode, TopupStatus.EXPIRED);
      return 'EXPIRED';
    }

    return 'PENDING';
  }

  private async creditWallet(
    manager: import('typeorm').EntityManager,
    topup: TopupEntity,
    transactionDetails: {
      reference?: string;
      counterAccountBankName?: string;
      counterAccountName?: string;
      counterAccountNumber?: string;
      transactionDateTime?: string;
    },
  ): Promise<boolean> {
    const topupRepo = manager.getRepository(TopupEntity);
    const walletRepo = manager.getRepository(WalletEntity);

    const result = await topupRepo
      .createQueryBuilder()
      .update(TopupEntity)
      .set({
        status: TopupStatus.PAID,
        transactionReference: transactionDetails.reference || null,
        counterAccountBankName: transactionDetails.counterAccountBankName || null,
        counterAccountName: transactionDetails.counterAccountName || null,
        counterAccountNumber: transactionDetails.counterAccountNumber || null,
        paidAt: transactionDetails.transactionDateTime
          ? new Date(transactionDetails.transactionDateTime)
          : new Date(),
      })
      .where('orderCode = :orderCode AND status = :status', {
        orderCode: topup.orderCode,
        status: TopupStatus.PENDING,
      })
      .execute();

    if (!result.affected || result.affected === 0) {
      this.logger.warn(`Topup ${topup.orderCode} already processed or not PENDING, skipping`);
      return false;
    }

    const updateResult = await walletRepo
      .createQueryBuilder()
      .update(WalletEntity)
      .set({ balance: () => `balance + ${Number(topup.amount)}` })
      .where('userId = :userId', { userId: topup.userId })
      .execute();

    if (!updateResult.affected || updateResult.affected === 0) {
      const newWallet = walletRepo.create({
        userId: topup.userId,
        balance: Number(topup.amount),
      });
      await walletRepo.save(newWallet);
    }

    this.logger.log(`Wallet credited: user=${topup.userId}, amount=${topup.amount}, orderCode=${topup.orderCode}`);
    return true;
  }

  async createTopup(userId: string, amount: number): Promise<{ checkoutUrl: string; orderCode: number }> {
    if (amount < 1000) {
      throw new BadRequestException('Số tiền nạp tối thiểu là 1.000 VNĐ');
    }

    const orderCode = this.generateOrderCode();
    const description = orderCode.toString();
    const gatewayPort = this.configService.get<string>('GATEWAY_PORT', '8080');
    const verifyUrl = `http://localhost:${gatewayPort}/topup/verify/${orderCode}`;
    const cancelUrl = verifyUrl;
    const returnUrl = verifyUrl;

    const payosUrl = this.configService.get<string>('PAYOS_URL', 'https://api-merchant.payos.vn');
    const apiKey = this.configService.get<string>('PAYOS_API_KEY', '');
    const clientId = this.configService.get<string>('PAYOS_CLIENT_ID', '');

    const signatureData = `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`;
    const signature = this.createSignature(signatureData);

    const body = JSON.stringify({
      orderCode,
      amount: +amount,
      description,
      cancelUrl,
      returnUrl,
      signature,
    });

    const res = await this.fetchWithTimeout(`${payosUrl}/v2/payment-requests`, {
      headers: {
        'x-api-key': apiKey,
        'x-client-id': clientId,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new BadRequestException(`Tạo link thanh toán thất bại: ${errorBody}`);
    }

    const resp = await res.json();
    const { checkoutUrl, paymentLinkId } = resp.data;

    const topup = this.topupRepository.create({
      id: uuidv4(),
      userId,
      orderCode,
      amount,
      status: TopupStatus.PENDING,
      checkoutUrl,
      paymentLinkId,
      description,
    });
    await this.topupRepository.save(topup);

    return { checkoutUrl, orderCode };
  }

  async verifyTopup(orderCode: number): Promise<TopupVerifyResult> {
    const topup = await this.topupRepository.findOne({
      where: { orderCode },
    });

    if (!topup) {
      throw new NotFoundException('Không tìm thấy giao dịch nạp tiền');
    }

    return this.syncTopupFromPayos(topup);
  }

  async handleWebhook(webhookData: any): Promise<void> {
    const { data, signature } = webhookData;
    if (!data || !data.orderCode) return;

    if (!signature || !this.verifyWebhookSignature(data, signature)) {
      this.logger.warn(`Invalid webhook signature for orderCode=${data.orderCode}`);
      return;
    }

    const orderCode = data.orderCode;
    const topup = await this.topupRepository.findOne({ where: { orderCode } });
    if (!topup) {
      this.logger.warn(`Topup not found for webhook orderCode=${orderCode}`);
      return;
    }

    if (topup.status === TopupStatus.PAID) {
      this.logger.log(`Topup ${orderCode} already PAID, webhook idempotency skip`);
      return;
    }

    const webhookCode = String(webhookData?.code ?? data?.code ?? '');
    const webhookStatus = String(data?.status ?? '').toUpperCase();
    const isPaymentSuccess = webhookCode === '00' || webhookStatus === 'PAID';

    if (!isPaymentSuccess) {
      this.logger.log(
        `Webhook ignored for orderCode=${orderCode}: code=${webhookCode || 'N/A'}, status=${webhookStatus || 'N/A'}`,
      );
      return;
    }

    if (Number(data.amount) !== Number(topup.amount)) {
      this.logger.error(`Webhook amount mismatch: webhook=${data.amount}, local=${topup.amount}, orderCode=${orderCode}`);
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      await this.creditWallet(manager, topup, {
        reference: data.reference,
        counterAccountBankName: data.counterAccountBankName,
        counterAccountName: data.counterAccountName,
        counterAccountNumber: data.counterAccountNumber,
        transactionDateTime: data.transactionDateTime,
      });
    });
  }

  async getTopupHistory(userId: string): Promise<TopupEntity[]> {
    const history = await this.topupRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const pendingTopups = history.filter((topup) => topup.status === TopupStatus.PENDING);
    if (pendingTopups.length === 0) return history;

    let hasChanged = false;
    for (const topup of pendingTopups) {
      try {
        const result = await this.syncTopupFromPayos(topup);
        if (result !== 'PENDING') hasChanged = true;
      } catch (error) {
        this.logger.warn(
          `Skip topup sync orderCode=${topup.orderCode}: ${(error as Error).message}`,
        );
      }
    }

    if (!hasChanged) return history;

    return this.topupRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelTopup(orderCode: number, userId: string): Promise<void> {
    const topup = await this.topupRepository.findOne({
      where: { orderCode, userId },
    });

    if (!topup) {
      throw new NotFoundException('Không tìm thấy giao dịch nạp tiền');
    }

    if (topup.status !== TopupStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể huỷ giao dịch đang chờ thanh toán');
    }

    const payosUrl = this.configService.get<string>('PAYOS_URL', 'https://api-merchant.payos.vn');
    const apiKey = this.configService.get<string>('PAYOS_API_KEY', '');
    const clientId = this.configService.get<string>('PAYOS_CLIENT_ID', '');

    const res = await this.fetchWithTimeout(`${payosUrl}/v2/payment-requests/${orderCode}/cancel`, {
      headers: {
        'x-api-key': apiKey,
        'x-client-id': clientId,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({ cancellationReason: 'Người dùng huỷ giao dịch' }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'Unknown error');
      this.logger.warn(`payOS cancel failed: ${errorBody}, orderCode=${orderCode}`);

      const latestStatus = await this.syncTopupFromPayos(topup);
      if (latestStatus === 'CANCELLED' || latestStatus === 'EXPIRED') {
        return;
      }
      if (latestStatus === 'PAID') {
        throw new BadRequestException('Giao dịch đã thanh toán thành công, không thể huỷ');
      }

      throw new BadRequestException('Không thể huỷ giao dịch trên payOS');
    }

    const cancelResult = await this.topupRepository
      .createQueryBuilder()
      .update(TopupEntity)
      .set({ status: TopupStatus.CANCELLED })
      .where('orderCode = :orderCode AND status = :status', {
        orderCode,
        status: TopupStatus.PENDING,
      })
      .execute();

    if (!cancelResult.affected || cancelResult.affected === 0) {
      throw new BadRequestException('Giao dịch đã được xử lý, không thể huỷ');
    }
  }
}
