import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { MailerService } from '../common/mailer/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenService } from './token.service';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, res: Response) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: { name: dto.name.trim(), email, phone: dto.phone?.trim(), passwordHash },
    });

    await this.issueSession(user.id, user.role, res);
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  async login(dto: LoginDto, res: Response) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Same error whether the user doesn't exist or the password is wrong.
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('This account has been suspended');
    }

    await this.issueSession(user.id, user.role, res);
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  async logout(req: Request, res: Response) {
    const raw = this.tokens.getRefreshCookie(req);
    if (raw) {
      const hash = this.tokens.hashToken(raw);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    this.tokens.clearAuthCookies(res);
    return { message: 'Logged out' };
  }

  async refresh(req: Request, res: Response) {
    const raw = this.tokens.getRefreshCookie(req);
    if (!raw) throw new UnauthorizedException('No refresh token');

    try {
      this.tokens.verifyRefreshToken(raw);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const hash = this.tokens.hashToken(raw);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token not recognized');
    }

    if (stored.revokedAt) {
      // This exact token was already rotated away once. Seeing it again means
      // replay (stolen cookie) — kill every token in the family, force re-login.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session invalidated, please log in again');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account unavailable');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    await this.issueSession(user.id, user.role, res, stored.familyId);

    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    });
    if (!user) throw new UnauthorizedException('Session no longer valid');
    return user;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Same response whether or not the account exists — don't leak which emails are registered.
    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });
      const resetUrl = `${this.config.getOrThrow<string>('FRONTEND_URL')}/reset-password?token=${rawToken}`;
      await this.mailer.sendPasswordResetEmail(user.email, resetUrl);
    }

    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // A password reset invalidates every existing session for this user.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password has been reset. Please log in again.' };
  }

  private async issueSession(userId: string, role: Role, res: Response, familyId?: string) {
    const family = familyId ?? randomUUID();
    const accessToken = this.tokens.signAccessToken(userId, role);
    const {
      token: refreshToken,
      hash,
      expiresAt,
    } = this.tokens.signRefreshToken(userId, role, family);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hash, familyId: family, expiresAt },
    });

    this.tokens.setAuthCookies(res, accessToken, refreshToken);
  }
}
