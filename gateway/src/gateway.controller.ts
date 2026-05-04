import { Controller, All, Req, Res, Get } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller()
export class GatewayController {
  private readonly bookingServiceUrl =
    process.env.BOOKING_SERVICE_URL || 'http://booking-service:5001';
  private readonly movieServiceUrl =
    process.env.MOVIE_SERVICE_URL || 'http://movie-service:5003';
  private readonly authServiceUrl =
    process.env.AUTH_SERVICE_URL || 'http://auth-service:5005';
  private readonly seatServiceUrl =
    process.env.SEAT_SERVICE_URL || 'http://seat-service:5002';
  private readonly paymentServiceUrl =
    process.env.PAYMENT_SERVICE_URL || 'http://payment-service:5004';
  private readonly aiRecommenderServiceUrl =
    process.env.AI_RECOMMENDER_SERVICE_URL || 'http://ai-recommender-service:5006';

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: 'gateway' };
  }

  @Get('health/all')
  async aggregatedHealth() {
    const services = [
      { name: 'booking-service', url: this.bookingServiceUrl },
      { name: 'seat-service', url: this.seatServiceUrl },
      { name: 'movie-service', url: this.movieServiceUrl },
      { name: 'payment-service', url: this.paymentServiceUrl },
      { name: 'auth-service', url: this.authServiceUrl },
      { name: 'ai-recommender-service', url: this.aiRecommenderServiceUrl },
    ];

    const results = await Promise.all(
      services.map(async (svc) => {
        try {
          const res = await fetch(`${svc.url}/health`, { signal: AbortSignal.timeout(3000) });
          const data = await res.json().catch(() => null);
          return { name: svc.name, status: res.ok ? 'up' : 'down', data };
        } catch {
          return { name: svc.name, status: 'down', data: null };
        }
      }),
    );

    const allUp = results.every((r) => r.status === 'up');
    const anyUp = results.some((r) => r.status === 'up');

    return {
      status: allUp ? 'healthy' : anyUp ? 'degraded' : 'down',
      timestamp: new Date().toISOString(),
      services: results,
    };
  }

  @All('auth/login')
  async proxyLogin(@Req() req: Request, @Res() res: Response) {
    await this.proxy(req, res, this.authServiceUrl, '/auth/login');
  }

  @All('auth/register')
  async proxyRegister(@Req() req: Request, @Res() res: Response) {
    await this.proxy(req, res, this.authServiceUrl, '/auth/register');
  }

  @All('auth/me')
  async proxyMe(@Req() req: Request, @Res() res: Response) {
    await this.proxy(req, res, this.authServiceUrl, '/auth/me');
  }

  @All('bookings')
  async proxyBookings(@Req() req: Request, @Res() res: Response) {
    await this.proxy(req, res, this.bookingServiceUrl, '/bookings');
  }

  @All('bookings/:id')
  async proxyBookingById(@Req() req: Request, @Res() res: Response) {
    const id = req.params.id;
    await this.proxy(req, res, this.bookingServiceUrl, `/bookings/${id}`);
  }

  @All('movies')
  async proxyMovies(@Req() req: Request, @Res() res: Response) {
    await this.proxy(req, res, this.movieServiceUrl, '/movies');
  }

  @All('movies/:id/showtimes')
  async proxyMovieShowtimes(@Req() req: Request, @Res() res: Response) {
    const id = req.params.id;
    await this.proxy(req, res, this.movieServiceUrl, `/movies/${id}/showtimes`);
  }

  @All('movies/:id')
  async proxyMovieById(@Req() req: Request, @Res() res: Response) {
    const id = req.params.id;
    await this.proxy(req, res, this.movieServiceUrl, `/movies/${id}`);
  }

  @All('seats')
  async proxySeats(@Req() req: Request, @Res() res: Response) {
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    await this.proxy(req, res, this.seatServiceUrl, `/seats${queryString}`);
  }

  @All('seats/generate')
  async proxySeatGenerate(@Req() req: Request, @Res() res: Response) {
    await this.proxy(req, res, this.seatServiceUrl, '/seats/generate');
  }

  @All('wallets/me')
  async proxyWalletMe(@Req() req: Request, @Res() res: Response) {
    await this.proxy(req, res, this.paymentServiceUrl, '/wallets/me');
  }

  @All('recommendations/grouped')
  async proxyRecommendationsGrouped(@Req() req: Request, @Res() res: Response) {
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    await this.proxy(req, res, this.aiRecommenderServiceUrl, `/recommendations/grouped${queryString}`);
  }

  private async proxy(
    req: Request,
    res: Response,
    targetBaseUrl: string,
    targetPath: string,
  ) {
    const url = `${targetBaseUrl}${targetPath}`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(url, fetchOptions);
      const data = await response.json().catch(() => null);
      res.status(response.status).json(data);
    } catch {
      res.status(502).json({
        statusCode: 502,
        message: 'Không thể kết nối đến dịch vụ',
        error: 'Bad Gateway',
      });
    }
  }
}
