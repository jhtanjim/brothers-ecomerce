import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActiveStatus, Prisma, ProductStatus } from '@prisma/client';
import { formatCents, toCents } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_CART_LINES, MAX_QUANTITY_PER_LINE } from './cart.constants';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

/** Primary image first, then by sortOrder. */
const IMAGE_ORDER: Prisma.ProductImageOrderByWithRelationInput[] = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
];

const cartItemSelect = {
  id: true,
  quantity: true,
  variant: { select: { id: true, size: true, color: true, stockQuantity: true } },
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      discountPrice: true,
      stockQuantity: true,
      status: true,
      category: { select: { status: true } },
      images: { orderBy: IMAGE_ORDER, take: 1, select: { url: true } },
      _count: { select: { variants: true } },
    },
  },
} satisfies Prisma.CartItemSelect;

type CartItemRow = Prisma.CartItemGetPayload<{ select: typeof cartItemSelect }>;

export type CartLineIssue =
  'PRODUCT_UNAVAILABLE' | 'OPTION_REQUIRED' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';

export interface CartLine {
  id: string;
  productId: string;
  variantId: string | null;
  size: string | null;
  color: string | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  regularPrice: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  availableStock: number;
  issue: CartLineIssue | null;
}

export interface CartView {
  id: string | null;
  items: CartLine[];
  itemCount: number;
  subtotal: string;
  hasIssues: boolean;
}

function toLine(row: CartItemRow): CartLine & { counted: boolean } {
  const product = row.product;
  const purchasable =
    product.status === ProductStatus.ACTIVE && product.category.status === ActiveStatus.ACTIVE;

  const available = row.variant ? row.variant.stockQuantity : product.stockQuantity;

  let issue: CartLineIssue | null = null;
  if (!purchasable) issue = 'PRODUCT_UNAVAILABLE';
  else if (!row.variant && product._count.variants > 0) issue = 'OPTION_REQUIRED';
  else if (available < 1) issue = 'OUT_OF_STOCK';
  else if (row.quantity > available) issue = 'INSUFFICIENT_STOCK';

  const unitCents = toCents(product.discountPrice ?? product.price);
  return {
    id: row.id,
    productId: product.id,
    variantId: row.variant?.id ?? null,
    size: row.variant?.size || null,
    color: row.variant?.color || null,
    name: product.name,
    slug: product.slug,
    imageUrl: product.images[0]?.url ?? null,
    regularPrice: formatCents(toCents(product.price)),
    unitPrice: formatCents(unitCents),
    quantity: row.quantity,
    lineTotal: formatCents(unitCents * row.quantity),
    availableStock: available,
    issue,
    counted: issue === null,
  };
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string): Promise<CartView> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: {
        id: true,
        items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: cartItemSelect },
      },
    });

    if (!cart) {
      return { id: null, items: [], itemCount: 0, subtotal: formatCents(0), hasIssues: false };
    }

    let subtotalCents = 0;
    let itemCount = 0;
    const items = cart.items.map((row) => {
      const { counted, ...line } = toLine(row);
      if (counted) {
        subtotalCents += toCents(line.lineTotal);
        itemCount += line.quantity;
      }
      return line;
    });

    return {
      id: cart.id,
      items,
      itemCount,
      subtotal: formatCents(subtotalCents),
      hasIssues: items.some((line) => line.issue !== null),
    };
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartView> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: dto.productId,
        status: ProductStatus.ACTIVE,
        category: { status: ActiveStatus.ACTIVE },
      },
      select: {
        id: true,
        stockQuantity: true,
        variants: {
          where: { id: dto.variantId ?? '' },
          select: { id: true, stockQuantity: true },
        },
        _count: { select: { variants: true } },
      },
    });
    if (!product) {
      throw new NotFoundException({ message: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
    }
    const variant = product.variants[0] ?? null;
    if (product._count.variants > 0 && !variant) {
      throw new BadRequestException({
        message: 'Please choose an option first',
        code: 'OPTION_REQUIRED',
      });
    }
    if (dto.variantId && !variant) {
      throw new BadRequestException({
        message: 'This option does not exist',
        code: 'VARIANT_NOT_FOUND',
      });
    }
    const available = variant ? variant.stockQuantity : product.stockQuantity;
    if (available < 1) {
      throw new ConflictException({
        message: 'This product is out of stock',
        code: 'PRODUCT_OUT_OF_STOCK',
      });
    }

    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });

    // The transaction rolls back if the resulting quantity breaks a limit, even under concurrent adds.
    await this.prisma.$transaction(async (tx) => {
      const variantKey = variant?.id ?? '';
      const key = {
        cartId_productId_variantKey: { cartId: cart.id, productId: product.id, variantKey },
      };
      const existing = await tx.cartItem.findUnique({ where: key, select: { id: true } });

      if (!existing) {
        const lines = await tx.cartItem.count({ where: { cartId: cart.id } });
        if (lines >= MAX_CART_LINES) {
          throw new BadRequestException({
            message: `Your cart can hold up to ${MAX_CART_LINES} different products`,
            code: 'CART_FULL',
          });
        }
      }

      const item = await tx.cartItem.upsert({
        where: key,
        create: {
          cartId: cart.id,
          productId: product.id,
          variantId: variant?.id ?? null,
          variantKey,
          quantity: dto.quantity,
        },
        update: { quantity: { increment: dto.quantity } },
        select: { quantity: true },
      });

      if (item.quantity > available) {
        throw new ConflictException({
          message: `Only ${available} available in stock`,
          code: 'INSUFFICIENT_STOCK',
        });
      }
      if (item.quantity > MAX_QUANTITY_PER_LINE) {
        throw new BadRequestException({
          message: `You can order up to ${MAX_QUANTITY_PER_LINE} of one product`,
          code: 'CART_LINE_LIMIT',
        });
      }
    });

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto): Promise<CartView> {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      select: {
        id: true,
        variant: { select: { stockQuantity: true } },
        product: {
          select: { stockQuantity: true, status: true, category: { select: { status: true } } },
        },
      },
    });
    if (!item) {
      throw new NotFoundException({ message: 'Cart item not found', code: 'CART_ITEM_NOT_FOUND' });
    }

    const product = item.product;
    if (
      product.status !== ProductStatus.ACTIVE ||
      product.category.status !== ActiveStatus.ACTIVE
    ) {
      throw new ConflictException({
        message: 'This product is no longer available',
        code: 'PRODUCT_UNAVAILABLE',
      });
    }
    const available = item.variant ? item.variant.stockQuantity : product.stockQuantity;
    if (available < 1) {
      throw new ConflictException({
        message: 'This product is out of stock',
        code: 'PRODUCT_OUT_OF_STOCK',
      });
    }
    if (dto.quantity > available) {
      throw new ConflictException({
        message: `Only ${available} available in stock`,
        code: 'INSUFFICIENT_STOCK',
      });
    }

    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity: dto.quantity } });
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    const result = await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cart: { userId } },
    });
    if (result.count === 0) {
      throw new NotFoundException({ message: 'Cart item not found', code: 'CART_ITEM_NOT_FOUND' });
    }
    return this.getCart(userId);
  }

  async clear(userId: string): Promise<CartView> {
    await this.prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    return this.getCart(userId);
  }
}
