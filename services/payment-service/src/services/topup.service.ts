import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { TopupEntity, TopupStatus } from '../entities/topup.entity';
import { WalletEntity } from '../entities/wallet.entity';

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
  ) {}

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
    const frontendPort = this.configService.get<string>('FRONTEND_PORT', '3000');
    const cancelUrl = `http://localhost:${frontendPort}/wallet?topup=cancelled`;
    const returnUrl = `http://localhost:${gatewayPort}/topup/verify/${orderCode}`;

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

  async verifyTopup(orderCode: number): Promise<boolean> {
    const topup = await this.topupRepository.findOne({
      where: { orderCode },
    });

    if (!topup) {
      throw new NotFoundException('Không tìm thấy giao dịch nạp tiền');
    }

    if (topup.status === TopupStatus.PAID) {
      return true;
    }

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
      throw new BadRequestException('Không thể kiểm tra trạng thái thanh toán');
    }

    const resp = await res.json();
    const payosData = resp.data;
    const { status } = payosData;

    if (status === 'PAID') {
      const transaction = payosData.transactions?.[0];

      if (Number(payosData.amount) !== Number(topup.amount)) {
        this.logger.error(`Amount mismatch: payOS=${payosData.amount}, local=${topup.amount}, orderCode=${orderCode}`);
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

      return true;
    }

    if (status === 'CANCELLED') {
      await this.topupRepository
        .createQueryBuilder()
        .update(TopupEntity)
        .set({ status: TopupStatus.CANCELLED })
        .where('orderCode = :orderCode AND status = :status', {
          orderCode,
          status: TopupStatus.PENDING,
        })
        .execute();
      throw new BadRequestException('Giao dịch đã bị huỷ');
    }

    if (status === 'EXPIRED') {
      await this.topupRepository
        .createQueryBuilder()
        .update(TopupEntity)
        .set({ status: TopupStatus.EXPIRED })
        .where('orderCode = :orderCode AND status = :status', {
          orderCode,
          status: TopupStatus.PENDING,
        })
        .execute();
      throw new BadRequestException('Giao dịch đã hết hạn');
    }

    throw new BadRequestException('Thanh toán chưa hoàn tất');
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

    if (data.code === '00') {
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
  }

  async getTopupHistory(userId: string): Promise<TopupEntity[]> {
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

    const res = await this.fetchWithTimeout(`${payosUrl}/v2/payment-requests/${orderCode}`, {
      headers: {
        'x-api-key': apiKey,
        'x-client-id': clientId,
        'Content-Type': 'application/json',
      },
      method: 'DELETE',
      body: JSON.stringify({ cancellationReason: 'Người dùng huỷ giao dịch' }),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'Unknown error');
      this.logger.error(`payOS cancel failed: ${errorBody}, orderCode=${orderCode}`);
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
