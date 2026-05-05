import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  Delete,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard, JwtPayload } from '@app/common';
import { TopupService, TopupVerifyResult } from '../services/topup.service';

@Controller('topup')
export class TopupController {
  constructor(private readonly topupService: TopupService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createTopup(
    @Req() req: Request,
    @Body() body: { amount: number },
  ) {
    const user = (req as any).user as JwtPayload;
    const result = await this.topupService.createTopup(user.sub, body.amount);
    return {
      message: 'Tạo link thanh toán thành công',
      data: result,
    };
  }

  @Get('verify/:orderCode')
  async verifyTopup(
    @Param('orderCode', ParseIntPipe) orderCode: number,
    @Res() res: Response,
  ) {
    const frontendPort = process.env.FRONTEND_PORT || '3000';
    try {
      const result = await this.topupService.verifyTopup(orderCode);
      const redirectByResult: Record<TopupVerifyResult, string> = {
        PAID: 'success',
        CANCELLED: 'cancelled',
        EXPIRED: 'expired',
        PENDING: 'pending',
      };

      return res.redirect(
        `http://localhost:${frontendPort}/wallet?topup=${redirectByResult[result]}&orderCode=${orderCode}`,
      );
    } catch {
      return res.redirect(
        `http://localhost:${frontendPort}/wallet?topup=failed&orderCode=${orderCode}`,
      );
    }
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any) {
    await this.topupService.handleWebhook(body);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getTopupHistory(@Req() req: Request) {
    const user = (req as any).user as JwtPayload;
    const history = await this.topupService.getTopupHistory(user.sub);
    return {
      message: 'Lịch sử nạp tiền',
      data: history,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':orderCode')
  async cancelTopup(
    @Req() req: Request,
    @Param('orderCode', ParseIntPipe) orderCode: number,
  ) {
    const user = (req as any).user as JwtPayload;
    await this.topupService.cancelTopup(orderCode, user.sub);
    return { message: 'Huỷ giao dịch thành công' };
  }
}
