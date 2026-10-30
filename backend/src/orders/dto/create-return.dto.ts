import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class ReturnItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  orderItemId!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;
}

export class CreateReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  /** False for damaged items, which do not go back on sale. */
  @IsBoolean()
  restock!: boolean;

  /** How the money goes back. Leave it out for an exchange: the value becomes credit for a new sale. */
  @IsOptional()
  @IsEnum(PaymentMethod)
  refundMethod?: PaymentMethod;
}
