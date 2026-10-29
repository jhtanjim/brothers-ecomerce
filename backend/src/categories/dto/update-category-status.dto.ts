import { ActiveStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateCategoryStatusDto {
  @IsEnum(ActiveStatus)
  status!: ActiveStatus;
}
