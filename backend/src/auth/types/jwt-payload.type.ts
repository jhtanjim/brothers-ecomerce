import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string; // userId
  role: Role;
  type: 'access' | 'refresh';
  familyId?: string; // refresh tokens only
  jti?: string; // refresh tokens only
}
