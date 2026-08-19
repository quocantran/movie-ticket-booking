import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard, JwtPayload, SERVICE_NAMES } from '@app/common';
import { WalletEntity } from '../entities/wallet.entity';
import { Request } from 'express';
import { PAYMENT_CONFIG } from '../constants/payment.constants';

@Controller()
export class PaymentController {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,
  ) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: SERVICE_NAMES.PAYMENT };
  }

  @UseGuards(JwtAuthGuard)
  @Get('wallets/me')
  async getMyWallet(@Req() req: Request) {
    const user = (req as any).user as JwtPayload;
    const wallet = await this.walletRepository.findOne({
      where: { userId: user.sub },
    });
    return {
      userId: user.sub,
      balance: wallet ? Number(wallet.balance) : 0,
    };
  }

  @Post('wallets')
  async createWallet(@Body() body: { userId: string; initialBalance?: number }) {
    const { userId, initialBalance } = body;
    const balance = initialBalance ?? PAYMENT_CONFIG.DEFAULT_INITIAL_WALLET_BALANCE;

    const existing = await this.walletRepository.findOne({ where: { userId } });
    if (existing) {
      return { userId, balance: Number(existing.balance), created: false };
    }

    const wallet = this.walletRepository.create({ userId, balance });
    await this.walletRepository.save(wallet);
    return { userId, balance, created: true };
  }
}
