import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const POSTGRES_URL = /^postgres(ql)?:\/\/.+/;

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  @Matches(POSTGRES_URL, {
    message:
      'DATABASE_URL must be a PostgreSQL connection string (postgresql://USER:PASSWORD@HOST:PORT/DB)',
  })
  DATABASE_URL!: string;

  @IsOptional()
  @Matches(POSTGRES_URL, { message: 'DATABASE_URL_TEST must be a PostgreSQL connection string' })
  DATABASE_URL_TEST?: string;

  /** Number of reverse proxies in front of the API (0 = none). Needed so rate limits see the real client IP. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY: number = 0;

  @IsUrl({ require_tld: false })
  FRONTEND_URL: string = 'http://localhost:3000';

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters' })
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL: string = '15m';

  @IsOptional()
  @IsInt()
  @Min(1)
  JWT_REFRESH_TTL_DAYS: number = 30;

  @IsString()
  @IsNotEmpty({ message: 'CLOUDINARY_CLOUD_NAME is required for image uploads' })
  CLOUDINARY_CLOUD_NAME!: string;

  @IsString()
  @IsNotEmpty({ message: 'CLOUDINARY_API_KEY is required for image uploads' })
  CLOUDINARY_API_KEY!: string;

  @IsString()
  @IsNotEmpty({ message: 'CLOUDINARY_API_SECRET is required for image uploads' })
  CLOUDINARY_API_SECRET!: string;
}

/**
 * Validates environment variables at startup. The app refuses to boot with a clear
 * message if configuration is missing or malformed. Values are never printed.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const lines = errors.map(
      (e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`,
    );
    throw new Error(`Invalid environment configuration (check backend/.env):\n${lines.join('\n')}`);
  }
  if (validated.JWT_SECRET === validated.JWT_REFRESH_SECRET) {
    throw new Error(
      'Invalid environment configuration: JWT_SECRET and JWT_REFRESH_SECRET must be different',
    );
  }
  return validated;
}
