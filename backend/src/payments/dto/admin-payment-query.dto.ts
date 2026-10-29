import { PaymentStatus } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** ?page, ?limit (shared defaults and maximum) and an optional ?status (default PENDING). */
export class AdminPaymentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([PaymentStatus.PENDING, PaymentStatus.APPROVED, PaymentStatus.REJECTED])
  status?: PaymentStatus;
}
