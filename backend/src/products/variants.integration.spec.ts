import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CartService } from '../cart/cart.service';
import { CategoriesService } from '../categories/categories.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { OrderCancellationService } from '../orders/order-cancellation.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductsService } from './products.service';

const SHIPPING = {
  fullName: 'Test Customer',
  phone: '01700000000',
  email: 'c@example.com',
  addressLine: '1 Test Road',
  city: 'Dhaka',
  area: 'Gulshan',
  postalCode: '1212',
  paymentMethod: 'BKASH',
} as CreateOrderDto;

describe('product variants (integration)', () => {
  let prisma: PrismaClient;
  let products: ProductsService;
  let cart: CartService;
  let categories: CategoriesService;
  let orders: OrdersService;
  let categoryId: string;
  let productId: string;
  let medium: string;
  let large: string;

  const makeUser = async () =>
    (
      await prisma.user.create({
        data: { name: 'u', email: `u-${randomUUID()}@example.com`, passwordHash: 'x' },
      })
    ).id;
  const place = (userId: string) => orders.create(userId, SHIPPING, randomUUID());
  const totalStock = async () =>
    (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity;
  const optionStock = async (id: string) =>
    (await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;
  const query = (values: Partial<ProductQueryDto>) =>
    ({ page: 1, limit: 20, sort: 'newest', ...values }) as ProductQueryDto;

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const service = prisma as unknown as PrismaService;
    products = new ProductsService(service, {} as CloudinaryService);
    cart = new CartService(service);
    categories = new CategoriesService(service);
    orders = new OrdersService(
      service,
      new SettingsService(service),
      {} as CloudinaryService,
      new OrderCancellationService(),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    categoryId = (await prisma.category.create({ data: { name: 'Shirts', slug: 'shirts' } })).id;
    productId = (
      await prisma.product.create({
        data: { categoryId, name: 'Shirt', slug: 'shirt', sku: 'S-1', price: '1000' },
      })
    ).id;
    const added = await products.addVariant(productId, {
      size: 'M',
      color: 'Blue',
      sku: 'S-1-M',
      stockQuantity: 2,
    });
    medium = added.variants[0]!.id;
    const both = await products.addVariant(productId, {
      size: 'L',
      color: 'Blue',
      sku: 'S-1-L',
      stockQuantity: 5,
    });
    large = both.variants.find((variant) => variant.id !== medium)!.id;
  });

  it('keeps the product total equal to the sum of its options', async () => {
    expect(await totalStock()).toBe(7);
    await products.updateVariant(productId, medium, { stockQuantity: 10 });
    expect(await totalStock()).toBe(15);
    await products.removeVariant(productId, medium);
    expect(await totalStock()).toBe(5);
  });

  it('refuses a direct stock edit on a product with options', async () => {
    await expect(products.update(productId, { stockQuantity: 99 })).rejects.toMatchObject({
      response: { code: 'PRODUCT_STOCK_FROM_VARIANTS' },
    });
  });

  it('refuses a duplicate option and a duplicate SKU', async () => {
    await expect(
      products.addVariant(productId, { size: 'M', color: 'Blue', sku: 'NEW-1', stockQuantity: 1 }),
    ).rejects.toMatchObject({ response: { code: 'VARIANT_EXISTS' } });
    await expect(
      products.addVariant(productId, { size: 'S', sku: 's-1-m', stockQuantity: 1 }),
    ).rejects.toMatchObject({ response: { code: 'VARIANT_SKU_TAKEN' } });
  });

  it('requires an option in the cart and keeps one line per option', async () => {
    const userId = await makeUser();
    await expect(cart.addItem(userId, { productId, quantity: 1 })).rejects.toMatchObject({
      response: { code: 'OPTION_REQUIRED' },
    });
    await cart.addItem(userId, { productId, variantId: medium, quantity: 1 });
    await cart.addItem(userId, { productId, variantId: medium, quantity: 1 });
    const view = await cart.addItem(userId, { productId, variantId: large, quantity: 1 });
    expect(view.items.map((line) => [line.size, line.quantity]).sort()).toEqual([
      ['L', 1],
      ['M', 2],
    ]);
  });

  it('limits the cart by the option stock, not the product total', async () => {
    const userId = await makeUser();
    await expect(
      cart.addItem(userId, { productId, variantId: medium, quantity: 3 }),
    ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_STOCK' } });
  });

  it('takes stock from the option, snapshots it, and restores it on cancel', async () => {
    const userId = await makeUser();
    await cart.addItem(userId, { productId, variantId: medium, quantity: 2 });
    const order = await place(userId);

    expect(order.items[0]).toMatchObject({ size: 'M', color: 'Blue', sku: 'S-1-M' });
    expect(await optionStock(medium)).toBe(0);
    expect(await totalStock()).toBe(5);

    await orders.cancel(userId, order.id);
    expect(await optionStock(medium)).toBe(2);
    expect(await totalStock()).toBe(7);
  });

  it('rolls everything back when an option has run out', async () => {
    const buyer = await makeUser();
    await cart.addItem(buyer, { productId, variantId: medium, quantity: 2 });
    await prisma.productVariant.update({ where: { id: medium }, data: { stockQuantity: 1 } });

    await expect(place(buyer)).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_STOCK' } });
    expect(await totalStock()).toBe(7);
    expect(await prisma.order.count()).toBe(0);
  });

  it('refuses an order for an old cart line that has no option', async () => {
    const userId = await makeUser();
    const row = await prisma.cart.create({ data: { userId } });
    await prisma.cartItem.create({ data: { cartId: row.id, productId, quantity: 1 } });

    expect((await cart.getCart(userId)).items[0]?.issue).toBe('OPTION_REQUIRED');
    await expect(place(userId)).rejects.toMatchObject({ response: { code: 'OPTION_REQUIRED' } });
    expect(await totalStock()).toBe(7);
  });

  it('keeps an ordered option from being deleted', async () => {
    const userId = await makeUser();
    await cart.addItem(userId, { productId, variantId: large, quantity: 1 });
    await place(userId);
    await expect(products.removeVariant(productId, large)).rejects.toMatchObject({
      response: { code: 'VARIANT_HAS_ORDERS' },
    });
  });

  it('filters by size, colour and material, ignoring sold-out options', async () => {
    await prisma.product.update({ where: { id: productId }, data: { material: 'Cotton' } });
    const count = async (values: Partial<ProductQueryDto>) =>
      (await products.findAllPublic(query(values))).meta.total;

    expect(await count({ size: 'M' })).toBe(1);
    expect(await count({ color: 'Blue', size: 'L' })).toBe(1);
    expect(await count({ material: 'Cotton' })).toBe(1);
    expect(await count({ size: 'XS' })).toBe(0);

    await products.updateVariant(productId, medium, { stockQuantity: 0 });
    expect(await count({ size: 'M' })).toBe(0);
    expect((await products.findFilters()).sizes).toEqual(['L']);
  });

  it('shows subcategory products on the parent page, and allows only one level', async () => {
    const child = await categories.create({
      name: 'Formal',
      slug: 'formal',
      parentId: categoryId,
    } as never);
    await prisma.product.update({ where: { id: productId }, data: { categoryId: child.id } });

    expect((await products.findAllPublic(query({ category: 'shirts' }))).meta.total).toBe(1);
    expect((await products.findAllPublic(query({ category: 'formal' }))).meta.total).toBe(1);

    await expect(
      categories.create({ name: 'Too Deep', slug: 'deep', parentId: child.id } as never),
    ).rejects.toMatchObject({ response: { code: 'CATEGORY_INVALID_PARENT' } });

    await categories.setStatus(categoryId, 'INACTIVE');
    expect((await products.findAllPublic(query({}))).meta.total).toBe(0);
  });
});
