import { IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class RejectPaymentDto {
  /** Shown to the customer, so they know what to correct before resubmitting. */
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
