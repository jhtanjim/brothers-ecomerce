import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

export const SALES_DAY_OPTIONS = [7, 30, 90];

/** ?days=7|30|90 (default 30). */
export class SalesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(SALES_DAY_OPTIONS)
  days: number = 30;
}
