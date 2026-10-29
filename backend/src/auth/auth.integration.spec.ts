import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MailerService } from '../common/mailer/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenService } from './token.service';

const ENV: Record<string, string> = {
  NODE_ENV: 'test',
  JWT_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  FRONTEND_URL: 'http://localhost:3000',
};

interface CookieCall {
  name: string;
  value: string;
  options: Record<string, unknown>;
}

function fakeRes() {
  const cookies: CookieCall[] = [];
  const cleared: string[] = [];
  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => {
      cookies.push({ name, value, options });
    },
    clearCookie: (name: string) => {
      cleared.push(name);
    },
  } as unknown as Response;
  return { res, cookies, cleared };
}

const cookieValue = (cookies: CookieCall[], name: string) =>
  cookies.find((c) => c.name === name)?.value ?? '';
const req = (refreshToken?: string) =>
  ({ cookies: refreshToken ? { refresh_token: refreshToken } : {} }) as unknown as Request;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

describe('auth (integration)', () => {
  let prisma: PrismaClient;
  let auth: AuthService;
  const sent: { to: string; url: string }[] = [];

  const register = (email = 'Jane@Example.com', password = 'Password123!') =>
    auth.register({ name: 'Jane', email, password } as RegisterDto, fakeRes().res);
  const login = (email: string, password: string) =>
    auth.login({ email, password } as LoginDto, fakeRes().res);

  async function registerWithSession() {
    const { res, cookies } = fakeRes();
    await auth.register(
      { name: 'Jane', email: 'jane@example.com', password: 'Password123!' } as RegisterDto,
      res,
    );
    return { refresh: cookieValue(cookies, 'refresh_token'), cookies };
  }

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const config = {
      get: (key: string) => ENV[key],
      getOrThrow: (key: string) => {
        const value = ENV[key];
        if (value === undefined) throw new Error('missing ' + key);
        return value;
      },
    } as unknown as ConfigService;
    const mailer = {
      sendPasswordResetEmail: async (to: string, url: string) => {
        sent.push({ to, url });
      },
    } as unknown as MailerService;
    auth = new AuthService(
      prisma as unknown as PrismaService,
      new TokenService(new JwtService(), config),
      mailer,
      config,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    sent.length = 0;
  });

  it('register lowercases the email, hashes the password and sets httpOnly cookies', async () => {
    const { res, cookies } = fakeRes();
    const result = await auth.register(
      { name: 'Jane', email: ' Jane@Example.com ', password: 'Password123!' } as RegisterDto,
      res,
    );

    expect(result).toMatchObject({ email: 'jane@example.com', role: 'CUSTOMER' });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'jane@example.com' } });
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(user.passwordHash).not.toContain('Password123!');
    const access = cookies.find((c) => c.name === 'access_token');
    const refresh = cookies.find((c) => c.name === 'refresh_token');
    expect(access?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    expect(refresh?.options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
    });
    expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(1);
  });

  it('a duplicate email is refused whatever its case', async () => {
    await register('jane@example.com');
    await expect(register('JANE@EXAMPLE.COM')).rejects.toBeInstanceOf(ConflictException);
    expect(await prisma.user.count()).toBe(1);
  });

  it('login works with the right password', async () => {
    await register();
    expect(await login('jane@example.com', 'Password123!')).toMatchObject({
      email: 'jane@example.com',
    });
  });

  it('a wrong password and an unknown email give the same error', async () => {
    await register();
    await expect(login('jane@example.com', 'WrongPassword1!')).rejects.toMatchObject({
      message: 'Invalid email or password',
    });
    await expect(login('nobody@example.com', 'Password123!')).rejects.toMatchObject({
      message: 'Invalid email or password',
    });
  });

  it('a suspended account cannot log in', async () => {
    const inactive = Object.values(UserStatus).find((s) => s !== 'ACTIVE');
    expect(inactive).toBeDefined();
    await register();
    await prisma.user.update({ where: { email: 'jane@example.com' }, data: { status: inactive } });
    await expect(login('jane@example.com', 'Password123!')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refresh rotates the token inside the same family', async () => {
    const { refresh } = await registerWithSession();
    const { res, cookies } = fakeRes();

    await auth.refresh(req(refresh), res);

    const next = cookieValue(cookies, 'refresh_token');
    expect(next).not.toBe('');
    expect(next).not.toBe(refresh);
    const rows = await prisma.refreshToken.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows[0].familyId).toBe(rows[1].familyId);
    expect(rows[0].revokedAt).not.toBeNull();
    expect(rows[1].revokedAt).toBeNull();
  });

  it('replaying a rotated token kills the whole session family', async () => {
    const { refresh: oldToken } = await registerWithSession();
    const { res, cookies } = fakeRes();
    await auth.refresh(req(oldToken), res);
    const newToken = cookieValue(cookies, 'refresh_token');

    await expect(auth.refresh(req(oldToken), fakeRes().res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
    await expect(auth.refresh(req(newToken), fakeRes().res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refresh without a cookie or with a garbage token is refused', async () => {
    await expect(auth.refresh(req(), fakeRes().res)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(auth.refresh(req('not-a-token'), fakeRes().res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('a suspended user cannot refresh', async () => {
    const inactive = Object.values(UserStatus).find((s) => s !== 'ACTIVE');
    const { refresh } = await registerWithSession();
    await prisma.user.update({ where: { email: 'jane@example.com' }, data: { status: inactive } });
    await expect(auth.refresh(req(refresh), fakeRes().res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout revokes the token and clears the cookies', async () => {
    const { refresh } = await registerWithSession();
    const { res, cleared } = fakeRes();

    await auth.logout(req(refresh), res);

    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
    expect(cleared).toEqual(['access_token', 'refresh_token']);
  });

  it('forgot password for an unknown email sends nothing and answers the same way', async () => {
    await register();
    const unknown = await auth.forgotPassword({ email: 'nobody@example.com' } as ForgotPasswordDto);
    const known = await auth.forgotPassword({ email: 'jane@example.com' } as ForgotPasswordDto);

    expect(unknown).toEqual(known);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('jane@example.com');
  });

  it('forgot password stores only a hash and mails the raw token', async () => {
    await register();
    await auth.forgotPassword({ email: 'jane@example.com' } as ForgotPasswordDto);

    const raw = new URL(sent[0].url).searchParams.get('token') ?? '';
    expect(raw.length).toBeGreaterThan(20);
    const stored = await prisma.passwordResetToken.findFirstOrThrow();
    expect(stored.tokenHash).toBe(hash(raw));
    expect(stored.tokenHash).not.toBe(raw);
  });

  it('reset password works once, ends all sessions and changes the password', async () => {
    const { refresh } = await registerWithSession();
    await auth.forgotPassword({ email: 'jane@example.com' } as ForgotPasswordDto);
    const raw = new URL(sent[0].url).searchParams.get('token') ?? '';

    await auth.resetPassword({ token: raw, newPassword: 'NewPassword456!' } as ResetPasswordDto);

    await expect(
      auth.resetPassword({ token: raw, newPassword: 'Another789!' } as ResetPasswordDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
    await expect(auth.refresh(req(refresh), fakeRes().res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(login('jane@example.com', 'Password123!')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(await login('jane@example.com', 'NewPassword456!')).toMatchObject({
      email: 'jane@example.com',
    });
  });

  it('an expired reset token is refused', async () => {
    await register();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'jane@example.com' } });
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash('expired-token'),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    await expect(
      auth.resetPassword({
        token: 'expired-token',
        newPassword: 'NewPassword456!',
      } as ResetPasswordDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await login('jane@example.com', 'Password123!')).toMatchObject({
      email: 'jane@example.com',
    });
  });
});
