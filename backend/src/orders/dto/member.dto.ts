import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class MemberQueryDto extends PaginationQueryDto {
  /** Name or phone. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateMemberDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @Trim()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid phone number' })
  phone!: string;
}

export class UpdateMemberDto {
  @IsBoolean()
  active!: boolean;
}
