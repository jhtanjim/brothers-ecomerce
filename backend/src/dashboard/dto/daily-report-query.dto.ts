import { IsOptional, Matches } from 'class-validator';

/** ?month=YYYY-MM. */
export class MonthlyReportQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' })
  month!: string;
}

/** ?date=YYYY-MM-DD, a Dhaka calendar day (default today). */
export class DailyReportQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}
