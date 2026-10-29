import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

interface NormalizedError {
  status: number;
  message: string;
  code: string;
  details?: unknown;
}

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

/**
 * Converts every error into the consistent envelope { success:false, message, code }.
 * Raw database errors, stack traces and internals are never sent to clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, message, code, details } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      success: false,
      message,
      code,
      ...(details !== undefined ? { details } : {}),
    });
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const fallbackCode = STATUS_CODES[status] ?? 'ERROR';

      if (typeof body === 'string') {
        return { status, message: body, code: fallbackCode };
      }

      const obj = body as { message?: string | string[]; code?: string; details?: unknown };
      if (Array.isArray(obj.message)) {
        // class-validator errors
        return {
          status,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: obj.message,
        };
      }
      return {
        status,
        message: obj.message ?? exception.message,
        code: obj.code ?? fallbackCode,
        details: obj.details,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return {
            status: HttpStatus.CONFLICT,
            message: 'A record with these values already exists',
            code: 'CONFLICT',
          };
        case 'P2025':
          return { status: HttpStatus.NOT_FOUND, message: 'Record not found', code: 'NOT_FOUND' };
        case 'P2003':
          return {
            status: HttpStatus.CONFLICT,
            message: 'The operation conflicts with related records',
            code: 'RELATED_RECORD_CONFLICT',
          };
      }
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong. Please try again later.',
      code: 'INTERNAL_SERVER_ERROR',
    };
  }
}
