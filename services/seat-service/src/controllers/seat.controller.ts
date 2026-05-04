import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { SeatService } from '../services/seat.service';

@Controller()
export class SeatController {
  constructor(private readonly seatService: SeatService) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: 'seat-service' };
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
      body.rows || 5,
      body.cols || 8,
    );
    return { generated: seats.length, showtimeId: body.showtimeId };
  }
}
