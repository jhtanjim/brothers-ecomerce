import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class CreateAddressDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @Trim()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  addressLine!: string;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  area!: string;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  postalCode!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}