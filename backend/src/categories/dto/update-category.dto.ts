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
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { SLUG_REGEX } from './create-category.dto';

/** All fields optional. `description` and `imageUrl` accept null to clear them. */
export class UpdateCategoryDto {
  // ValidateIf (not IsOptional) so an explicit null is rejected for required columns.
  @ValidateIf((_o, v) => v !== undefined)
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ValidateIf((_o, v) => v !== undefined)
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

  @IsOptional()
  @Trim()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string | null;

  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder?: number;

  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(ActiveStatus)
  status?: ActiveStatus;

  /** Parent category id: makes this a subcategory. null makes it top-level. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentId?: string | null;
}
