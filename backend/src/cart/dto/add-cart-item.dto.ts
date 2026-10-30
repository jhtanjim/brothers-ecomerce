import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MAX_QUANTITY_PER_LINE } from '../cart.constants';

export class AddCartItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  productId!: string;

  /** Required when the product has sizes or colours. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  variantId?: string;

  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_LINE)
  quantity!: number;
}
