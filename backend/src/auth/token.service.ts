import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { JwtPayload } from './types/jwt-payload.type';
const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_PATH = '/api/v1/auth/refresh';
// Must be kept in sync with JWT_ACCESS_TTL's default ('15m') above.
const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get isProd(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  signAccessToken(userId: string, role: Role): string {
    const payload: JwtPayload = { sub: userId, role, type: 'access' };
    return this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: (this.config.get<string>('JWT_ACCESS_TTL') ??
        '15m') as JwtSignOptions['expiresIn'],
    });
  }

  signRefreshToken(
    userId: string,
    role: Role,
    familyId: string,
  ): { token: string; hash: string; jti: string; expiresAt: Date } {
    const jti = randomUUID();
    const days = Number(this.config.get<number>('JWT_REFRESH_TTL_DAYS') ?? 30);
    const payload: JwtPayload = { sub: userId, role, type: 'refresh', familyId, jti };
    const token = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: `${days}d` as JwtSignOptions['expiresIn'],
    });
    return {
      token,
      hash: this.hashToken(token),
      jti,
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    };
  }

  verifyRefreshToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    });
    const days = Number(this.config.get<number>('JWT_REFRESH_TTL_DAYS') ?? 30);
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      path: REFRESH_PATH,
      maxAge: days * 24 * 60 * 60 * 1000,
    });
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
  }

  getRefreshCookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  }
}
