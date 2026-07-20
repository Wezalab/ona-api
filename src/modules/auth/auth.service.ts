import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserDocument, UserStatus } from '../users/schemas/user.schema';
import { AppConfig } from '../../config/configuration';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async login(email: string, password: string): Promise<AuthTokens & { user: object }> {
    const user = await this.users.findByEmailWithSecrets(email);
    if (!user || user.status !== UserStatus.Active) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        clinic: user.clinic,
      },
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('jwt.refreshSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.users.findByIdWithRefresh(payload.sub);
    if (!user || !user.refreshTokenHash) throw new UnauthorizedException('Invalid refresh token');

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) throw new UnauthorizedException('Invalid refresh token');

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.users.setRefreshTokenHash(userId, null);
  }

  private async issueTokens(user: UserDocument): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      clinicId: user.clinic?.toString(),
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwt.accessSecret', { infer: true }),
      expiresIn: this.config.get('jwt.accessTtl', { infer: true }),
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwt.refreshSecret', { infer: true }),
      expiresIn: this.config.get('jwt.refreshTtl', { infer: true }),
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await this.users.setRefreshTokenHash(user.id, refreshTokenHash);

    return { accessToken, refreshToken };
  }
}
