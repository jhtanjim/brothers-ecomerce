import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductsService } from './products.service';

/** Storefront endpoints: no auth, ACTIVE products in ACTIVE categories only. */
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query() query: ProductQueryDto) {
    return this.products.findAllPublic(query);
  }

  /** Must stay above :slug. */
  @Get('filters')
  findFilters(@Query('category') category?: string) {
    return this.products.findFilters(category);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.products.findBySlugPublic(slug);
  }
}
