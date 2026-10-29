import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };
const MAX_CHARGE = 100_000;
const MAX_THRESHOLD = 9_999_999_999.99;

/** Spaces and dashes are allowed when typing a number ("01700-000000"); they are not stored. */
const CompactPhone = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '') : value,
  );

/**
 * Every field optional: only the sent fields change. null clears the free-delivery threshold
 * (never free) or a merchant number (that payment method shows "not set up" to customers).
 */
export class UpdateSettingsDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  deliveryHomeCity?: string;

  @ValidateIf((_o, v) => v !== undefined)
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_CHARGE)
  deliveryHomeCityCharge?: number;

  @ValidateIf((_o, v) => v !== undefined)
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_CHARGE)
  deliveryOtherCityCharge?: number;

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_THRESHOLD)
  deliveryFreeThreshold?: number | null;

  @IsOptional()
  @CompactPhone()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'bkashNumber must be a phone number (7 to 15 digits)' })
  bkashNumber?: string | null;

  @IsOptional()
  @CompactPhone()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'nagadNumber must be a phone number (7 to 15 digits)' })
  nagadNumber?: string | null;

  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  screenshotEnabled?: boolean;

  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(10)
  maxPaymentAttempts?: number;

  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(168)
  unpaidExpiryHours?: number;
}
