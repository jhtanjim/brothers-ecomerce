import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import type { PrismaService } from '../../prisma/prisma.service';
import { createTestPrisma, resetDatabase } from '../../test/db';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'a'.repeat(40);
const config = {
  getOrThrow: (key: string) => {
    if (key !== 'JWT_SECRET') throw new Error('missing ' + key);
    return SECRET;
  },
} as unknown as ConfigService;

function handler() {}
function publicHandler() {}
Reflect.defineMetadata(IS_PUBLIC_KEY, true, publicHandler);

function contextFor(request: Partial<Request>, route: () => void = handler): ExecutionContext {
  return {
    getHandler: () => route,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard (integration)', () => {
  let prisma: PrismaClient;
  let guard: JwtAuthGuard;
  const jwt = new JwtService();

  const sign = (sub: string, role: Role, type: JwtPayload['type'] = 'access') =>
    jwt.sign({ sub, role, type } satisfies JwtPayload, { secret: SECRET, expiresIn: '15m' });

  async function run(token?: string) {
    const request: Partial<Request> = { cookies: token ? { access_token: token } : {} };
    const allowed = await guard.canActivate(contextFor(request));
    return { allowed, user: request.user };
  }

  async function failure(token?: string) {
    const error = await run(token).then(
      () => null,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(UnauthorizedException);
    return (error as UnauthorizedException).getResponse() as { code?: string };
  }

  const createUser = (email: string, status: UserStatus = UserStatus.ACTIVE) =>
    prisma.user.create({
      data: { name: 'Test', email, passwordHash: 'x', role: Role.CUSTOMER, status },
    });

  beforeAll(async () => {
    prisma = await createTestPrisma();
    guard = new JwtAuthGuard(new Reflector(), jwt, config, prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('lets an active user through and exposes the token payload', async () => {
    const user = await createUser('active@example.com');
    const { allowed, user: seen } = await run(sign(user.id, Role.CUSTOMER));
    expect(allowed).toBe(true);
    expect(seen).toMatchObject({ sub: user.id, role: Role.CUSTOMER, type: 'access' });
  });

  it('refuses a still-valid token once the account is suspended', async () => {
    const user = await createUser('suspended@example.com');
    const token = sign(user.id, Role.CUSTOMER);
    await run(token);

    await prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.SUSPENDED } });
    expect((await failure(token)).code).toBe('ACCOUNT_UNAVAILABLE');
  });

  it('refuses a token whose user no longer exists', async () => {
    expect((await failure(sign('missing-user-id', Role.CUSTOMER))).code).toBe(
      'ACCOUNT_UNAVAILABLE',
    );
  });

  it('uses the current role from the database, not the role in the token', async () => {
    const user = await createUser('promoted@example.com');
    const token = sign(user.id, Role.ADMIN);
    // The token claims ADMIN, the database says CUSTOMER: the database wins.
    expect((await run(token)).user?.role).toBe(Role.CUSTOMER);

    await prisma.user.update({ where: { id: user.id }, data: { role: Role.ADMIN } });
    expect((await run(sign(user.id, Role.CUSTOMER))).user?.role).toBe(Role.ADMIN);
  });

  it('refuses a missing cookie, a refresh token and a token signed with another secret', async () => {
    const user = await createUser('tokens@example.com');
    await failure();
    await failure(sign(user.id, Role.CUSTOMER, 'refresh'));
    await failure(
      jwt.sign({ sub: user.id, role: Role.CUSTOMER, type: 'access' }, { secret: 'z'.repeat(40) }),
    );
  });

  it('public routes need no cookie and never touch the database', async () => {
    const request: Partial<Request> = { cookies: {} };
    await expect(guard.canActivate(contextFor(request, publicHandler))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });
});
