import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { JwtPayload } from '../../auth/types/jwt-payload.type';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = (request.cookies as Record<string, string> | undefined)?.['access_token'];
    if (!token) throw new UnauthorizedException('Not authenticated');

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      if (payload.type !== 'access') throw new Error('wrong token type');
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // The token alone would stay valid for its whole lifetime. Re-reading the account makes a
    // suspension, deletion or role change take effect on the very next request.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, status: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        message: 'This account is no longer available. Please contact support.',
        code: 'ACCOUNT_UNAVAILABLE',
      });
    }

    request.user = { ...payload, role: user.role };
    return true;
  }
}
