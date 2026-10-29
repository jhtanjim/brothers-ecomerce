import { ActiveStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateCouponStatusDto {
  @IsEnum(ActiveStatus)
  status!: ActiveStatus;
}
