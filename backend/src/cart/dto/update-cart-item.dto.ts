import { IsInt, Max, Min } from 'class-validator';
import { MAX_QUANTITY_PER_LINE } from '../cart.constants';

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_LINE)
  quantity!: number;
}
