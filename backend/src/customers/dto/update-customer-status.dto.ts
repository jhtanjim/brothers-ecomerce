import { UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class UpdateCustomerStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;

  /** Saved in the activity log (for example why the account was suspended). */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
