import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { MAX_FILES_PER_REQUEST, productImageUploadOptions } from '../uploads/image-upload.config';
import { AdminProductQueryDto } from './dto/admin-product-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ReorderImagesDto } from './dto/reorder-images.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto';
import { ProductsService } from './products.service';
/** Admin-only (JwtAuthGuard is global; RolesGuard enforces ADMIN here). */

@Roles(Role.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query() query: AdminProductQueryDto) {
    return this.products.findAllAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.products.findOneAdmin(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: UpdateProductStatusDto) {
    return this.products.setStatus(id, dto.status);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.products.remove(id);
  }

  @Post(':id/variants')
  addVariant(@Param('id') id: string, @Body() dto: CreateVariantDto) {
    return this.products.addVariant(id, dto);
  }

  @Patch(':id/variants/:variantId')
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.products.updateVariant(id, variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  removeVariant(@Param('id') id: string, @Param('variantId') variantId: string) {
    return this.products.removeVariant(id, variantId);
  }

  /** Upload 1 to 5 images. Send multipart/form-data with the files in the "images" field. */
  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', MAX_FILES_PER_REQUEST, productImageUploadOptions))
  addImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) {
    return this.products.addImages(id, files);
  }

  /** Delete one image of a product. The image must belong to the product in the URL. */
  @Delete(':id/images/:imageId')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.products.removeImage(id, imageId);
  }

  /** Make one image the primary image. The image must belong to the product in the URL. */
  @Patch(':id/images/:imageId/primary')
  setPrimaryImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.products.setPrimaryImage(id, imageId);
  }

  /** Reorder the images of a product. Send every image id once, in the wanted order. */
  @Patch(':id/images/reorder')
  reorderImages(@Param('id') id: string, @Body() dto: ReorderImagesDto) {
    return this.products.reorderImages(id, dto.imageIds);
  }
}
