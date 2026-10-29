import { ActiveStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Trim } from '../../common/decorators/trim.decorator';

/** ?page, ?limit (shared defaults and maximum), optional ?status and ?search (code). */
export class CouponQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ActiveStatus)
  status?: ActiveStatus;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(50)
  search?: string;
}
