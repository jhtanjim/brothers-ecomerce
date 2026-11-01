import { PaymentMethod } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

/**
 * Shipping details and payment method only. Products, quantities and prices come from the
 * server-side cart; any other field (price, total, ...) is rejected by the global ValidationPipe.
 */
export class CreateOrderDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @Trim()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  @Trim()
  @IsEmail()
  @MaxLength(254)
  email!: string;

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
  @Trim()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  couponCode?: string;

  @IsIn([PaymentMethod.BKASH, PaymentMethod.NAGAD], {
    message: 'paymentMethod must be BKASH or NAGAD',
  })
  paymentMethod!: PaymentMethod;

  /** Pay only the delivery charge now (with paymentMethod) and the rest in cash at the door. */
  @IsOptional()
  @IsBoolean()
  cashOnDelivery?: boolean;
}
