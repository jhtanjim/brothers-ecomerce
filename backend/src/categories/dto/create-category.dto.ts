import { ActiveStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCategoryDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  /** Optional. Generated from `name` when omitted. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  @Matches(SLUG_REGEX, {
    message: 'slug may contain lowercase letters, numbers and single hyphens only',
  })
  slug?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  /** Plain HTTPS URL for now; real uploads arrive with the Uploads module. */
  @IsOptional()
  @Trim()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(ActiveStatus)
  status?: ActiveStatus;

  /** Parent category id: makes this a subcategory. null makes it top-level. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentId?: string | null;
}
