import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { parseIdempotencyKey } from './idempotency-key';
import { OrderQuoteService } from './order-quote.service';
import { OrdersService } from './orders.service';

/** Authenticated customers only: no @Public(), so the global JwtAuthGuard applies. */
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly quotes: OrderQuoteService,
  ) {}

  /** Checkout preview of the cart total, delivery charge and coupon. Read-only. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('quote')
  quote(@CurrentUser() user: JwtPayload, @Body() dto: QuoteOrderDto) {
    return this.quotes.quote(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: PaginationQueryDto) {
    return this.orders.list(user.sub, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orders.findOne(user.sub, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch(':id/cancel')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orders.cancel(user.sub, id);
  }
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.orders.create(user.sub, dto, parseIdempotencyKey(idempotencyKey));
  }
}
