import { ExpenseCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { MAX_PRICE } from '../../products/dto/create-product.dto';

const DAY_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DAY_MESSAGE = 'date must be YYYY-MM-DD';

export class ExpenseQueryDto {
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  date!: string;
}

export class CreateExpenseDto {
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  date!: string;

  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(MAX_PRICE)
  amount!: number;

  @IsBoolean()
  paidFromDrawer!: boolean;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  description?: string;
}

/** Leave a field out to keep it, or send null to clear it. */
export class UpdateCashDayDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  openingCash?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  countedCash?: number | null;
}

export class CashDayParamDto {
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  date!: string;
}
