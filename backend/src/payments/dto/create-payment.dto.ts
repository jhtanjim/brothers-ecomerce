import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

/** Multipart text fields of POST /payments (the screenshot file travels in its own field). */
export class CreatePaymentDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  orderId!: string;

  /** Normalized to upper case so "abc123" and "ABC123" count as the same transaction. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9]{6,30}$/, { message: 'transactionId must be 6 to 30 letters or digits' })
  transactionId!: string;

  @Trim()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'senderPhone must be a valid phone number' })
  senderPhone!: string;
}
