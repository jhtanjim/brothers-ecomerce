import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActiveStatus, Prisma, ProductStatus } from '@prisma/client';
import { buildPaginationMeta, toSkipTake } from '../common/utils/pagination';
import { slugify } from '../common/utils/slugify';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { detectImageType } from '../uploads/image-signature';
import { MAX_IMAGES_PER_PRODUCT } from '../uploads/image-upload.config';
import { AdminProductQueryDto } from './dto/admin-product-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto, ProductSort } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto';
type MoneyInput = number | string | Prisma.Decimal;

/** Primary image first, then by sortOrder. Stable even when no image is flagged primary. */
const IMAGE_ORDER: Prisma.ProductImageOrderByWithRelationInput[] = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
];

const categoryPublicSelect = { select: { name: true, slug: true } } as const;

const VARIANT_ORDER: Prisma.ProductVariantOrderByWithRelationInput[] = [
  { color: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
];

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3XL', '4XL'];

/** Letter sizes in wearing order, then numeric sizes, then anything else alphabetically. */
function sortSizes(sizes: string[]): string[] {
  const rank = (size: string) => {
    const index = SIZE_ORDER.indexOf(size.toUpperCase());
    return index >= 0 ? index : SIZE_ORDER.length;
  };
  return [...sizes].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b, 'en', { numeric: true }),
  );
}

function presentValues(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/** Storefront grid: light payload, one image only. No sku/soldCount/status/timestamps. */
const publicListSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  price: true,
  discountPrice: true,
  discountPercent: true,
  stockQuantity: true,
  featured: true,
  newArrival: true,
  bestSeller: true,
  category: categoryPublicSelect,
  images: { orderBy: IMAGE_ORDER, take: 1, select: { url: true } },
} satisfies Prisma.ProductSelect;

/** Product page: list fields plus description, sku and all images. */
const publicDetailSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  shortDescription: true,
  description: true,
  price: true,
  discountPrice: true,
  discountPercent: true,
  stockQuantity: true,
  featured: true,
  newArrival: true,
  bestSeller: true,
  material: true,
  category: categoryPublicSelect,
  images: {
    orderBy: IMAGE_ORDER,
    select: { id: true, url: true, sortOrder: true, isPrimary: true },
  },
  variants: {
    orderBy: VARIANT_ORDER,
    select: { id: true, size: true, color: true, stockQuantity: true },
  },
} satisfies Prisma.ProductSelect;

/** Admin view: everything. */
const adminSelect = {
  id: true,
  categoryId: true,
  name: true,
  slug: true,
  sku: true,
  shortDescription: true,
  description: true,
  price: true,
  discountPrice: true,
  discountPercent: true,
  stockQuantity: true,
  lowStockThreshold: true,
  costPrice: true,
  status: true,
  featured: true,
  newArrival: true,
  bestSeller: true,
  material: true,
  soldCount: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true, status: true } },
  images: {
    orderBy: IMAGE_ORDER,
    select: { id: true, url: true, publicId: true, sortOrder: true, isPrimary: true },
  },
  variants: {
    orderBy: VARIANT_ORDER,
    select: { id: true, size: true, color: true, sku: true, stockQuantity: true },
  },
} satisfies Prisma.ProductSelect;

/** `id` is a tiebreaker so pagination stays stable. Price sorts use the regular price (V1 limitation). */
const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  [ProductSort.NEWEST]: [{ createdAt: 'desc' }, { id: 'desc' }],
  [ProductSort.PRICE_ASC]: [{ price: 'asc' }, { id: 'asc' }],
  [ProductSort.PRICE_DESC]: [{ price: 'desc' }, { id: 'desc' }],
  [ProductSort.POPULAR]: [{ soldCount: 'desc' }, { id: 'desc' }],
  [ProductSort.DISCOUNT]: [{ discountPercent: 'desc' }, { id: 'desc' }],
};

// ------------------------------------------------------------------ money

/** Exact conversion to integer cents (no floating-point drift). */
function toCents(value: MoneyInput): number {
  return new Prisma.Decimal(value).mul(100).round().toNumber();
}

/** Whole-number percentage off, computed on integer cents. 0 when there is no discount price. */
function calcDiscountPercent(
  price: MoneyInput,
  discountPrice: MoneyInput | null | undefined,
): number {
  if (discountPrice === null || discountPrice === undefined) return 0;
  const priceCents = toCents(price);
  const discountCents = toCents(discountPrice);
  return Math.round(((priceCents - discountCents) * 100) / priceCents);
}

function withPrimaryImage<T extends { images: { url: string }[] }>(row: T) {
  const { images, ...rest } = row;
  return { ...rest, primaryImage: images[0] ?? null };
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}
  // ---------------------------------------------------------------- public

  async findAllPublic(query: ProductQueryDto) {
    const { page, limit, sort, minPrice, maxPrice } = query;
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      throw new BadRequestException({
        message: 'minPrice cannot be greater than maxPrice',
        code: 'INVALID_PRICE_RANGE',
      });
    }

    const where = this.buildPublicWhere(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: publicListSelect,
        orderBy: ORDER_BY[sort],
        ...toSkipTake(page, limit),
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data: rows.map(withPrimaryImage), meta: buildPaginationMeta(page, limit, total) };
  }

  /** The filter options that actually exist for this category (or the whole store). */
  async findFilters(category?: string) {
    const where = this.buildPublicWhere({ category } as ProductQueryDto);
    const [variants, products] = await Promise.all([
      this.prisma.productVariant.findMany({
        where: { stockQuantity: { gt: 0 }, product: where },
        distinct: ['size', 'color'],
        select: { size: true, color: true },
      }),
      this.prisma.product.findMany({
        where: { ...where, material: { not: null } },
        distinct: ['material'],
        select: { material: true },
      }),
    ]);
    return {
      sizes: sortSizes(presentValues(variants.map((variant) => variant.size))),
      colors: presentValues(variants.map((variant) => variant.color)).sort(),
      materials: presentValues(products.map((product) => product.material)).sort(),
    };
  }

  /** Hidden products (inactive/archived, or in an inactive category) look exactly like missing ones. */
  async findBySlugPublic(slug: string) {
    const row = await this.prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.ACTIVE,
        category: { status: ActiveStatus.ACTIVE },
      },
      select: publicDetailSelect,
    });
    if (!row) this.throwNotFound();
    return row;
  }

  // ----------------------------------------------------------------- admin

  async findAllAdmin(query: AdminProductQueryDto) {
    const { page, limit, search, status, categoryId, featured, sort } = query;
    const where: Prisma.ProductWhereInput = {
      ...(status ? { status } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(featured !== undefined ? { featured } : {}),
      ...(search ? { OR: this.searchConditions(search) } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: adminSelect,
        orderBy: ORDER_BY[sort],
        ...toSkipTake(page, limit),
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data: rows, meta: buildPaginationMeta(page, limit, total) };
  }

  async findOneAdmin(id: string) {
    const row = await this.prisma.product.findUnique({ where: { id }, select: adminSelect });
    if (!row) this.throwNotFound();
    return row;
  }

  async create(dto: CreateProductDto) {
    await this.assertCategoryExists(dto.categoryId);
    this.assertDiscountBelowPrice(dto.price, dto.discountPrice);

    const slug = dto.slug ?? this.slugFromName(dto.name);
    await this.assertUnique(slug, dto.sku);

    return this.withUniqueGuard(() =>
      this.prisma.product.create({
        data: {
          categoryId: dto.categoryId,
          name: dto.name,
          slug,
          sku: dto.sku,
          shortDescription: dto.shortDescription || null,
          description: dto.description || null,
          price: dto.price,
          costPrice: dto.costPrice ?? null,
          discountPrice: dto.discountPrice ?? null,
          discountPercent: calcDiscountPercent(dto.price, dto.discountPrice),
          // undefined = let the database default apply (0, 5, ACTIVE, false)
          stockQuantity: dto.stockQuantity,
          lowStockThreshold: dto.lowStockThreshold,
          status: dto.status,
          featured: dto.featured,
          newArrival: dto.newArrival,
          bestSeller: dto.bestSeller,
          material: dto.material || null,
        },
        select: adminSelect,
      }),
    );
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        price: true,
        discountPrice: true,
        _count: { select: { variants: true } },
      },
    });
    if (!existing) this.throwNotFound();
    if (dto.stockQuantity !== undefined && existing._count.variants > 0) {
      throw new ConflictException({
        message: 'This product has sizes or colours. Change the stock of each option instead.',
        code: 'PRODUCT_STOCK_FROM_VARIANTS',
      });
    }

    if (dto.categoryId !== undefined) await this.assertCategoryExists(dto.categoryId);
    await this.assertUnique(dto.slug, dto.sku, id);

    // Merge incoming prices with the stored ones so a partial update is validated correctly.
    const nextPrice: MoneyInput = dto.price ?? existing.price;
    const nextDiscount: MoneyInput | null =
      dto.discountPrice !== undefined ? dto.discountPrice : existing.discountPrice;
    this.assertDiscountBelowPrice(nextPrice, nextDiscount);

    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.name !== undefined) data.name = dto.name;
    // Renaming does NOT regenerate the slug: that would silently break SEO URLs.
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.shortDescription !== undefined) data.shortDescription = dto.shortDescription || null;
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.costPrice !== undefined) data.costPrice = dto.costPrice;
    if (dto.discountPrice !== undefined) data.discountPrice = dto.discountPrice;
    if (dto.stockQuantity !== undefined) data.stockQuantity = dto.stockQuantity;
    if (dto.lowStockThreshold !== undefined) data.lowStockThreshold = dto.lowStockThreshold;
    if (dto.featured !== undefined) data.featured = dto.featured;
    if (dto.newArrival !== undefined) data.newArrival = dto.newArrival;
    if (dto.bestSeller !== undefined) data.bestSeller = dto.bestSeller;
    if (dto.material !== undefined) data.material = dto.material || null;
    if (dto.price !== undefined || dto.discountPrice !== undefined) {
      data.discountPercent = calcDiscountPercent(nextPrice, nextDiscount);
    }

    return this.withUniqueGuard(() =>
      this.prisma.product.update({ where: { id }, data, select: adminSelect }),
    );
  }

  async setStatus(id: string, status: ProductStatus) {
    await this.ensureExists(id);
    return this.prisma.product.update({ where: { id }, data: { status }, select: adminSelect });
  }

  // -------------------------------------------------------------- variants

  async addVariant(productId: string, dto: CreateVariantDto) {
    const size = dto.size ?? '';
    const color = dto.color ?? '';
    this.assertHasOption(size, color);
    await this.withVariantGuard(() =>
      this.prisma.$transaction(async (tx) => {
        await this.lockProduct(tx, productId);
        await this.assertVariantSkuFree(tx, dto.sku);
        await tx.productVariant.create({
          data: { productId, size, color, sku: dto.sku, stockQuantity: dto.stockQuantity },
        });
        await this.syncStock(tx, productId);
      }),
    );
    return this.findOneAdmin(productId);
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateVariantDto) {
    await this.withVariantGuard(() =>
      this.prisma.$transaction(async (tx) => {
        await this.lockProduct(tx, productId);
        const variant = await this.findVariant(tx, productId, variantId);
        const size = dto.size ?? variant.size;
        const color = dto.color ?? variant.color;
        this.assertHasOption(size, color);
        if (dto.sku !== undefined) await this.assertVariantSkuFree(tx, dto.sku, variantId);
        await tx.productVariant.update({
          where: { id: variantId },
          data: { size, color, sku: dto.sku, stockQuantity: dto.stockQuantity },
        });
        await this.syncStock(tx, productId);
      }),
    );
    return this.findOneAdmin(productId);
  }

  /** An option with order history stays: cancelling those orders must be able to restore its stock. */
  async removeVariant(productId: string, variantId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockProduct(tx, productId);
      await this.findVariant(tx, productId, variantId);
      const ordered = await tx.orderItem.count({ where: { variantId } });
      if (ordered > 0) {
        throw new ConflictException({
          message: 'This option has been ordered before and cannot be deleted. Set its stock to 0.',
          code: 'VARIANT_HAS_ORDERS',
        });
      }
      await tx.productVariant.delete({ where: { id: variantId } });
      await this.syncStock(tx, productId);
    });
    return this.findOneAdmin(productId);
  }

  /** Same lock order as checkout (product first), so stock edits and orders cannot deadlock. */
  private async lockProduct(tx: Prisma.TransactionClient, productId: string): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "products" WHERE id = ${productId} FOR UPDATE`;
    if (rows.length === 0) this.throwNotFound();
  }

  private async findVariant(tx: Prisma.TransactionClient, productId: string, variantId: string) {
    const variant = await tx.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { size: true, color: true },
    });
    if (!variant) {
      throw new NotFoundException({ message: 'Option not found', code: 'VARIANT_NOT_FOUND' });
    }
    return variant;
  }

  /** Product stock is the sum of its options. Without options left it is 0 until the admin sets it. */
  private async syncStock(tx: Prisma.TransactionClient, productId: string): Promise<void> {
    const total = await tx.productVariant.aggregate({
      where: { productId },
      _sum: { stockQuantity: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: total._sum.stockQuantity ?? 0 },
    });
  }

  private assertHasOption(size: string, color: string): void {
    if (!size && !color) {
      throw new BadRequestException({
        message: 'Enter a size, a colour or both',
        code: 'VARIANT_OPTION_REQUIRED',
      });
    }
  }

  /** Case-insensitive, like product SKUs. */
  private async assertVariantSkuFree(
    tx: Prisma.TransactionClient,
    sku: string,
    excludeId?: string,
  ): Promise<void> {
    const clash = await tx.productVariant.findFirst({
      where: {
        sku: { equals: sku, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) this.throwVariantSkuTaken();
  }

  private throwVariantSkuTaken(): never {
    throw new ConflictException({
      message: 'An option with this SKU already exists',
      code: 'VARIANT_SKU_TAKEN',
    });
  }

  /** Race guard: the unique indexes are the real protection. */
  private async withVariantGuard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        if (String(error.meta?.target ?? '').includes('sku')) this.throwVariantSkuTaken();
        throw new ConflictException({
          message: 'This product already has that size and colour',
          code: 'VARIANT_EXISTS',
        });
      }
      throw error;
    }
  }

  /** Hard delete only when no order has ever referenced the product. Otherwise archive it. */
  async remove(id: string): Promise<void> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { orderItems: true } },
        images: { select: { publicId: true } },
      },
    });
    if (!row) this.throwNotFound();

    if (row._count.orderItems > 0) {
      throw new ConflictException({
        message: 'This product has been ordered before and cannot be deleted. Archive it instead.',
        code: 'PRODUCT_HAS_ORDERS',
      });
    }
    // If an order item is created between the check and the delete, the FK (Restrict)
    // fails and the global filter returns a 409. Cart items and image rows cascade.
    await this.prisma.product.delete({ where: { id } });

    // Database first. Then remove the files from Cloudinary (a failure is only logged).
    await Promise.all(row.images.map((img) => this.cloudinary.deleteImage(img.publicId)));
  }
  /**
   * Uploads images to Cloudinary, then saves them in the database.
   * The first image of a product becomes the primary image.
   */
  async addImages(productId: string, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException({
        message: 'No image files were uploaded. Send files in the "images" field.',
        code: 'NO_FILES_UPLOADED',
      });
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, _count: { select: { images: true } } },
    });
    if (!product) this.throwNotFound();

    const existingCount = product._count.images;
    if (existingCount + files.length > MAX_IMAGES_PER_PRODUCT) {
      throw new BadRequestException({
        message: `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images (currently ${existingCount}).`,
        code: 'TOO_MANY_IMAGES',
      });
    }

    // Check the real file bytes (not the declared type) BEFORE any upload, so one bad file
    // never leaves the earlier ones orphaned on Cloudinary.
    if (files.some((file) => detectImageType(file.buffer) === null)) {
      throw new BadRequestException({
        message: 'Every file must be a JPEG, PNG or WebP image',
        code: 'INVALID_IMAGE',
      });
    }

    // 1) Upload to Cloudinary first (slow, outside any database transaction).
    const uploaded: { url: string; publicId: string }[] = [];
    try {
      for (const file of files) {
        uploaded.push(await this.cloudinary.uploadImage(file.buffer, `products/${productId}`));
      }
    } catch (error) {
      // One failed: remove the ones already uploaded so nothing is left orphaned.
      await Promise.all(uploaded.map((img) => this.cloudinary.deleteImage(img.publicId)));
      throw error;
    }

    // 2) Save to the database. If this fails, clean up Cloudinary again.
    try {
      await this.prisma.$transaction(async (tx) => {
        const hasPrimary = await tx.productImage.count({
          where: { productId, isPrimary: true },
        });
        await tx.productImage.createMany({
          data: uploaded.map((img, index) => ({
            productId,
            url: img.url,
            publicId: img.publicId,
            sortOrder: existingCount + index,
            isPrimary: hasPrimary === 0 && index === 0,
          })),
        });
      });
    } catch (error) {
      await Promise.all(uploaded.map((img) => this.cloudinary.deleteImage(img.publicId)));
      throw error;
    }

    return this.findOneAdmin(productId);
  }

  /**
   * Deletes one image of a product (database first, then Cloudinary).
   * If the deleted image was the primary one, the next image becomes primary.
   */
  async removeImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
      select: { id: true, publicId: true, isPrimary: true },
    });
    if (!image) {
      throw new NotFoundException({ message: 'Image not found', code: 'IMAGE_NOT_FOUND' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: image.id } });

      if (image.isPrimary) {
        const next = await tx.productImage.findFirst({
          where: { productId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true },
        });
        if (next) {
          await tx.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
        }
      }
    });

    // Database is the source of truth. A failed Cloudinary delete is only logged (never throws).
    await this.cloudinary.deleteImage(image.publicId);

    return this.findOneAdmin(productId);
  }

  /** Makes one image the primary image of its product. All other images become non-primary. */
  async setPrimaryImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
      select: { id: true },
    });
    if (!image) {
      throw new NotFoundException({ message: 'Image not found', code: 'IMAGE_NOT_FOUND' });
    }

    await this.prisma.$transaction([
      this.prisma.productImage.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      }),
      this.prisma.productImage.update({
        where: { id: image.id },
        data: { isPrimary: true },
      }),
    ]);

    return this.findOneAdmin(productId);
  }

  /** Sets sortOrder 0..n-1 following the given list. The list must contain every image of the product exactly once. */
  async reorderImages(productId: string, imageIds: string[]) {
    await this.ensureExists(productId);

    const current = await this.prisma.productImage.findMany({
      where: { productId },
      select: { id: true },
    });
    const currentIds = new Set(current.map((img) => img.id));
    const sameSet =
      imageIds.length === currentIds.size && imageIds.every((id) => currentIds.has(id));
    if (!sameSet) {
      throw new BadRequestException({
        message: 'imageIds must contain every image of this product exactly once',
        code: 'INVALID_IMAGE_LIST',
      });
    }

    await this.prisma.$transaction(
      imageIds.map((id, index) =>
        this.prisma.productImage.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    return this.findOneAdmin(productId);
  }
  // --------------------------------------------------------------- helpers

  private searchConditions(search: string): Prisma.ProductWhereInput[] {
    return [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  private buildPublicWhere(query: ProductQueryDto): Prisma.ProductWhereInput {
    const { search, category, minPrice, maxPrice, inStock, featured } = query;
    const { newArrival, bestSeller, size, color, material } = query;
    const and: Prisma.ProductWhereInput[] = [];

    if (search) and.push({ OR: this.searchConditions(search) });

    // Effective price = discountPrice when set, otherwise price.
    if (minPrice !== undefined || maxPrice !== undefined) {
      const range: { gte?: number; lte?: number } = {};
      if (minPrice !== undefined) range.gte = minPrice;
      if (maxPrice !== undefined) range.lte = maxPrice;
      and.push({
        OR: [{ discountPrice: { not: null, ...range } }, { discountPrice: null, price: range }],
      });
    }

    return {
      status: ProductStatus.ACTIVE,
      // A parent category's page also shows its subcategories' products.
      category: {
        status: ActiveStatus.ACTIVE,
        ...(category ? { OR: [{ slug: category }, { parent: { slug: category } }] } : {}),
      },
      ...(featured !== undefined ? { featured } : {}),
      ...(newArrival !== undefined ? { newArrival } : {}),
      ...(bestSeller !== undefined ? { bestSeller } : {}),
      ...(material ? { material } : {}),
      ...(size || color
        ? {
            variants: {
              some: {
                stockQuantity: { gt: 0 },
                ...(size ? { size } : {}),
                ...(color ? { color } : {}),
              },
            },
          }
        : {}),
      // inStock=true filters; inStock=false applies no filter.
      ...(inStock !== undefined ? { stockQuantity: inStock ? { gt: 0 } : { lte: 0 } } : {}),
      ...(and.length > 0 ? { AND: and } : {}),
    };
  }

  private assertDiscountBelowPrice(
    price: MoneyInput,
    discountPrice: MoneyInput | null | undefined,
  ): void {
    if (discountPrice === null || discountPrice === undefined) return;
    if (toCents(discountPrice) >= toCents(price)) {
      throw new BadRequestException({
        message: 'discountPrice must be lower than price',
        code: 'INVALID_DISCOUNT_PRICE',
      });
    }
  }

  private slugFromName(name: string): string {
    const slug = slugify(name);
    if (!slug) {
      throw new BadRequestException({
        message: 'Could not generate a slug from this name. Please provide a slug.',
        code: 'PRODUCT_SLUG_REQUIRED',
      });
    }
    return slug;
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const found = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException({ message: 'Category not found', code: 'CATEGORY_NOT_FOUND' });
    }
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!found) this.throwNotFound();
  }

  /** One query: exact slug, case-insensitive SKU, excluding the record being edited. */
  private async assertUnique(
    slug: string | undefined,
    sku: string | undefined,
    excludeId?: string,
  ) {
    const or: Prisma.ProductWhereInput[] = [];
    if (slug) or.push({ slug });
    if (sku) or.push({ sku: { equals: sku, mode: 'insensitive' } });
    if (or.length === 0) return;

    const clash = await this.prisma.product.findFirst({
      where: { OR: or, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { slug: true },
    });
    if (!clash) return;

    if (slug && clash.slug === slug) this.throwSlugTaken(slug);
    this.throwSkuTaken();
  }

  /** Race guard: the unique indexes are the real protection; turn P2002 into the same 409s. */
  private async withUniqueGuard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = String(error.meta?.target ?? '');
        if (target.includes('sku')) this.throwSkuTaken();
        if (target.includes('slug')) this.throwSlugTaken();
      }
      throw error;
    }
  }

  private throwSlugTaken(slug?: string): never {
    throw new ConflictException({
      message: slug
        ? `The slug "${slug}" is already in use. Provide a different slug.`
        : 'This slug is already in use. Provide a different slug.',
      code: 'PRODUCT_SLUG_TAKEN',
    });
  }

  private throwSkuTaken(): never {
    throw new ConflictException({
      message: 'A product with this SKU already exists',
      code: 'PRODUCT_SKU_TAKEN',
    });
  }

  private throwNotFound(): never {
    throw new NotFoundException({ message: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
  }
}
