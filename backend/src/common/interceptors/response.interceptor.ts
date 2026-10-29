import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Services return `{ data, meta }` for paginated results; the interceptor wraps everything. */
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

function isPaginated(value: unknown): value is Paginated<unknown> {
  return typeof value === 'object' && value !== null && 'data' in value && 'meta' in value;
}

/** Wraps every successful response in { success:true, data, message, meta? }. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result: unknown) => {
        if (isPaginated(result)) {
          return { success: true, data: result.data, meta: result.meta, message: 'Success' };
        }
        return { success: true, data: result ?? null, message: 'Success' };
      }),
    );
  }
}
