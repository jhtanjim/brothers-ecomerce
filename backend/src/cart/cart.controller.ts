import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

/** Authenticated customers only: no @Public(), so the global JwtAuthGuard applies. */
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getCart(@CurrentUser() user: JwtPayload) {
    return this.cart.getCart(user.sub);
  }

  @Post('items')
  addItem(@CurrentUser() user: JwtPayload, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(user.sub, dto);
  }

  @Patch('items/:id')
  updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.updateItem(user.sub, id, dto);
  }

  @Delete('items/:id')
  removeItem(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cart.removeItem(user.sub, id);
  }

  @Delete()
  clear(@CurrentUser() user: JwtPayload) {
    return this.cart.clear(user.sub);
  }
}
