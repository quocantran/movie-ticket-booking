import { Injectable, UnauthorizedException, ConflictException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { hash, compare } from 'bcryptjs';
import { UserEntity } from '../entities/user.entity';
import { UserRole } from '@app/common';
import { AUTH_CONFIG } from '../constants/auth.constants';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly saltRounds = AUTH_CONFIG.SALT_ROUNDS;
  private readonly defaultPassword =
    process.env.DEFAULT_USER_PASSWORD ||
    AUTH_CONFIG.DEFAULT_USER_PASSWORD_FALLBACK;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const usersWithoutPassword = await this.userRepository.find({
      where: { passwordHash: null as any },
    });

    if (usersWithoutPassword.length > 0) {
      const hashed = await hash(this.defaultPassword, this.saltRounds);
      for (const user of usersWithoutPassword) {
        await this.userRepository.update(user.id, { passwordHash: hashed });
      }
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepository.findOne({ where: { email: dto.email } });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Tài khoản chưa thiết lập mật khẩu');
    }

    const isPasswordValid = await compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const role = user.role || UserRole.USER;
    const payload = { sub: user.id, email: user.email, name: user.name, role };
    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
      },
    };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const hashed = await hash(dto.password, this.saltRounds);

    const user = this.userRepository.create({
      id: uuidv4(),
      name: dto.name,
      email: dto.email,
      passwordHash: hashed,
      role: UserRole.USER,
    });
    await this.userRepository.save(user);

    await this.createWalletForUser(user.id);

    const role = user.role || UserRole.USER;
    const payload = { sub: user.id, email: user.email, name: user.name, role };
    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
      },
    };
  }

  private async createWalletForUser(userId: string): Promise<void> {
    const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5004';
    try {
      await fetch(`${paymentServiceUrl}/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch {}
  }

  async getProfile(userId: string): Promise<{ id: string; name: string; email: string; role: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || UserRole.USER,
    };
  }
}
