import { Injectable, UnauthorizedException, ConflictException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { hash, compare } from 'bcryptjs';
import { UserEntity } from '../entities/user.entity';

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
  private readonly SALT_ROUNDS = 10;
  private readonly DEFAULT_PASSWORD = '123456';

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
      const hashed = await hash(this.DEFAULT_PASSWORD, this.SALT_ROUNDS);
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

    const payload = { sub: user.id, email: user.email, name: user.name, role: user.role || 'USER' };
    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'USER',
      },
    };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const hashed = await hash(dto.password, this.SALT_ROUNDS);

    const user = this.userRepository.create({
      id: uuidv4(),
      name: dto.name,
      email: dto.email,
      passwordHash: hashed,
    });
    await this.userRepository.save(user);

    await this.createWalletForUser(user.id);

    const payload = { sub: user.id, email: user.email, name: user.name, role: user.role || 'USER' };
    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'USER',
      },
    };
  }

  private async createWalletForUser(userId: string): Promise<void> {
    const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5004';
    try {
      await fetch(`${paymentServiceUrl}/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, initialBalance: 200000 }),
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
      role: user.role || 'USER',
    };
  }
}
