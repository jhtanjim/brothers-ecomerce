import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActiveStatus, Prisma, ProductStatus } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { buildPaginationMeta, toSkipTake } from '../common/utils/pagination';
import { slugify } from '../common/utils/slugify';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCategoryQueryDto, CategorySort } from './dto/admin-category-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/** Storefront view: no status/timestamps/imagePublicId; counts only ACTIVE products. */
const publicSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  sortOrder: true,
  parentId: true,
  _count: { select: { products: { where: { status: ProductStatus.ACTIVE } } } },
} satisfies Prisma.CategorySelect;

/** Admin view: full record; counts ALL products (any status) since FK Restrict cares about all. */
const adminSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  imagePublicId: true,
  status: true,
  sortOrder: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true } },
} satisfies Prisma.CategorySelect;

const ADMIN_ORDER_BY: Record<CategorySort, Prisma.CategoryOrderByWithRelationInput[]> = {
  [CategorySort.SORT_ORDER]: [{ sortOrder: 'asc' }, { name: 'asc' }],
  [CategorySort.NAME_ASC]: [{ name: 'asc' }],
  [CategorySort.NAME_DESC]: [{ name: 'desc' }],
  [CategorySort.NEWEST]: [{ createdAt: 'desc' }],
};

function flatten<T extends { _count: { products: number } }>(row: T) {
  const { _count, ...rest } = row;
  return { ...rest, productCount: _count.products };
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- public

  async findAllPublic({ page, limit }: PaginationQueryDto) {
    const where: Prisma.CategoryWhereInput = { status: ActiveStatus.ACTIVE };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        select: publicSelect,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        ...toSkipTake(page, limit),
      }),
      this.prisma.category.count({ where }),
    ]);
    return { data: rows.map(flatten), meta: buildPaginationMeta(page, limit, total) };
  }

  async findBySlugPublic(slug: string) {
    const row = await this.prisma.category.findFirst({
      where: { slug, status: ActiveStatus.ACTIVE },
      select: publicSelect,
    });
    if (!row) this.throwNotFound();
    return flatten(row);
  }

  // ----------------------------------------------------------------- admin

  async findAllAdmin(query: AdminCategoryQueryDto) {
    const { page, limit, search, status, sort } = query;
    const where: Prisma.CategoryWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        select: adminSelect,
        orderBy: ADMIN_ORDER_BY[sort],
        ...toSkipTake(page, limit),
      }),
      this.prisma.category.count({ where }),
    ]);
    return { data: rows.map(flatten), meta: buildPaginationMeta(page, limit, total) };
  }

  async findOneAdmin(id: string) {
    const row = await this.prisma.category.findUnique({ where: { id }, select: adminSelect });
    if (!row) this.throwNotFound();
    return flatten(row);
  }

  async create(dto: CreateCategoryDto) {
    const slug = dto.slug ?? this.slugFromName(dto.name);
    await this.assertUnique(dto.name, slug);
    if (dto.parentId) await this.assertValidParent(dto.parentId);

    const created = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description || null,
        imageUrl: dto.imageUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
        parentId: dto.parentId ?? null,
        status: dto.status ?? ActiveStatus.ACTIVE,
      },
      select: adminSelect,
    });
    return flatten(created);
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensureExists(id);
    await this.assertUnique(dto.name, dto.slug, id);
    if (dto.parentId) await this.assertValidParent(dto.parentId, id);

    const data: Prisma.CategoryUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    // Renaming does NOT regenerate the slug: that would silently break SEO URLs.
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.parentId !== undefined) data.parentId = dto.parentId;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl;
      // A manually set URL has no storage public id; avoid keeping a stale one.
      data.imagePublicId = null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.status === ActiveStatus.INACTIVE) await this.deactivateChildren(tx, id);
      return tx.category.update({ where: { id }, data, select: adminSelect });
    });
    return flatten(updated);
  }

  async setStatus(id: string, status: ActiveStatus) {
    await this.ensureExists(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (status === ActiveStatus.INACTIVE) await this.deactivateChildren(tx, id);
      return tx.category.update({ where: { id }, data: { status }, select: adminSelect });
    });
    return flatten(updated);
  }

  /** Hard delete only when no product (any status) references the category. */
  async remove(id: string): Promise<void> {
    const row = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, _count: { select: { products: true, children: true } } },
    });
    if (!row) this.throwNotFound();

    const count = row._count.products;
    if (count > 0) {
      throw new ConflictException({
        message: `This category still has ${count} product(s). Deactivate it instead of deleting.`,
        code: 'CATEGORY_HAS_PRODUCTS',
      });
    }
    if (row._count.children > 0) {
      throw new ConflictException({
        message: 'This category still has subcategories. Move or delete them first.',
        code: 'CATEGORY_HAS_CHILDREN',
      });
    }
    // If a product is attached between the check and the delete, the FK (Restrict)
    // fails and the global filter returns a 409 RELATED_RECORD_CONFLICT.
    await this.prisma.category.delete({ where: { id } });
  }

  // --------------------------------------------------------------- helpers

  /** A hidden parent hides its subcategories, so their products cannot stay on sale. */
  private async deactivateChildren(tx: Prisma.TransactionClient, id: string): Promise<void> {
    await tx.category.updateMany({
      where: { parentId: id },
      data: { status: ActiveStatus.INACTIVE },
    });
  }

  /** Only one level: the parent must be top-level, and a category with children cannot move under one. */
  private async assertValidParent(parentId: string, id?: string): Promise<void> {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { parentId: true },
    });
    if (!parent) this.throwNotFound();
    const hasChildren = id
      ? (await this.prisma.category.count({ where: { parentId: id } })) > 0
      : false;
    if (parentId === id || parent.parentId !== null || hasChildren) {
      throw new BadRequestException({
        message: 'Subcategories can only be one level deep',
        code: 'CATEGORY_INVALID_PARENT',
      });
    }
  }

  private slugFromName(name: string): string {
    const slug = slugify(name);
    if (!slug) {
      throw new BadRequestException({
        message: 'Could not generate a slug from this name. Please provide a slug.',
        code: 'CATEGORY_SLUG_REQUIRED',
      });
    }
    return slug;
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!found) this.throwNotFound();
  }

  /** One query covering case-insensitive name and exact slug, excluding the record being edited. */
  private async assertUnique(
    name: string | undefined,
    slug: string | undefined,
    excludeId?: string,
  ) {
    const or: Prisma.CategoryWhereInput[] = [];
    if (name) or.push({ name: { equals: name, mode: 'insensitive' } });
    if (slug) or.push({ slug });
    if (or.length === 0) return;

    const clash = await this.prisma.category.findFirst({
      where: { OR: or, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { slug: true },
    });
    if (!clash) return;

    if (slug && clash.slug === slug) {
      throw new ConflictException({
        message: `The slug "${slug}" is already in use. Provide a different slug.`,
        code: 'CATEGORY_SLUG_TAKEN',
      });
    }
    throw new ConflictException({
      message: 'A category with this name already exists',
      code: 'CATEGORY_NAME_TAKEN',
    });
  }

  private throwNotFound(): never {
    throw new NotFoundException({ message: 'Category not found', code: 'CATEGORY_NOT_FOUND' });
  }
}
