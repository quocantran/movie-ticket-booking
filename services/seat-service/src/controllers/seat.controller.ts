import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { SeatService } from '../services/seat.service';
import { SERVICE_NAMES } from '@app/common';
import { SEAT_CONFIG } from '../constants/seat.constants';

@Controller()
export class SeatController {
  constructor(private readonly seatService: SeatService) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: SERVICE_NAMES.SEAT };
  }

  @Get('seats')
  async getSeatsByShowtime(@Query('showtimeId') showtimeId: string) {
    return this.seatService.findByShowtimeId(showtimeId);
  }

  @Post('seats/generate')
  async generateSeats(
    @Body() body: { showtimeId: string; rows?: number; cols?: number },
  ) {
    const seats = await this.seatService.generateSeatsForShowtime(
      body.showtimeId,
      body.rows || SEAT_CONFIG.DEFAULT_ROWS,
      body.cols || SEAT_CONFIG.DEFAULT_COLS,
    );
    return { generated: seats.length, showtimeId: body.showtimeId };
  }
}
