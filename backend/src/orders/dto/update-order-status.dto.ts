import { OrderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length, ValidateIf } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  /** Required when cancelling; optional (but validated if sent) for other changes. */
  @ValidateIf(
    (o: UpdateOrderStatusDto) => o.status === OrderStatus.CANCELLED || o.reason !== undefined,
  )
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 500)
  reason?: string;
}
