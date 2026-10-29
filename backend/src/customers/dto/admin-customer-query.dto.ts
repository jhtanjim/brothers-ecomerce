import { UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** ?page, ?limit, optional ?status and ?search (name, email or phone). */
export class AdminCustomerQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;
}
