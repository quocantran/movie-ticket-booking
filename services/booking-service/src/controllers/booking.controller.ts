import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { JwtAuthGuard, JwtPayload } from '@app/common';
import { Request } from 'express';

@Controller()
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: 'booking-service' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('bookings')
  async createBooking(
    @Req() req: Request,
    @Body()
    body: {
      movieId: string;
      showtimeId: string;
      seatIds: string[];
      totalAmount: number;
    },
  ) {
    const user = (req as any).user as JwtPayload;
    return this.bookingService.createBooking({
      userId: user.sub,
      movieId: body.movieId,
      showtimeId: body.showtimeId,
      seatIds: body.seatIds,
      totalAmount: body.totalAmount,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('bookings')
  async getMyBookings(@Req() req: Request) {
    const user = (req as any).user as JwtPayload;
    return this.bookingService.getBookingsByUser(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bookings/:id')
  async getBookingById(@Param('id') id: string) {
    return this.bookingService.getBookingById(id);
  }
}
