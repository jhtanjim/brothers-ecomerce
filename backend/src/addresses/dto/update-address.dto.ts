import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

/** Every field is optional; only the fields that are sent are changed. */
export class UpdateAddressDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @Trim()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  addressLine?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  postalCode?: string;

  /** Only `true` has an effect: the default changes by choosing another address as default. */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}