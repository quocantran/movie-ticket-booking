import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService, LoginDto, RegisterDto } from '../services/auth.service';
import { JwtAuthGuard, JwtPayload } from '@app/common';
import { Request } from 'express';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: 'auth-service' };
  }

  @Post('auth/login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('auth/register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth/me')
  async getProfile(@Req() req: Request) {
    const user = (req as any).user as JwtPayload;
    return this.authService.getProfile(user.sub);
  }
}
