import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_ADDRESSES_PER_USER } from './addresses.constants';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

const addressSelect = {
  id: true,
  fullName: true,
  phone: true,
  addressLine: true,
  city: true,
  area: true,
  postalCode: true,
  isDefault: true,
} satisfies Prisma.AddressSelect;

export type AddressView = Prisma.AddressGetPayload<{ select: typeof addressSelect }>;

function notFound(): NotFoundException {
  return new NotFoundException({ message: 'Address not found', code: 'ADDRESS_NOT_FOUND' });
}

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Serializes address changes per customer, so concurrent requests cannot exceed the
   * limit or leave two default addresses. Must be called first inside a transaction.
   */
  private async lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
  }

  /** Default address first, then newest. Bounded by MAX_ADDRESSES_PER_USER. */
  list(userId: string): Promise<AddressView[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_ADDRESSES_PER_USER,
      select: addressSelect,
    });
  }

  create(userId: string, dto: CreateAddressDto): Promise<AddressView> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);

      const count = await tx.address.count({ where: { userId } });
      if (count >= MAX_ADDRESSES_PER_USER) {
        throw new BadRequestException({
          message: `You can save up to ${MAX_ADDRESSES_PER_USER} addresses`,
          code: 'ADDRESS_LIMIT',
        });
      }

      // The first address is always the default.
      const makeDefault = dto.isDefault === true || count === 0;
      if (makeDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          userId,
          fullName: dto.fullName,
          phone: dto.phone,
          addressLine: dto.addressLine,
          city: dto.city,
          area: dto.area,
          postalCode: dto.postalCode,
          isDefault: makeDefault,
        },
        select: addressSelect,
      });
    });
  }

  update(userId: string, id: string, dto: UpdateAddressDto): Promise<AddressView> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);

      const existing = await tx.address.findFirst({ where: { id, userId }, select: { id: true } });
      if (!existing) throw notFound();

      const makeDefault = dto.isDefault === true;
      if (makeDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          addressLine: dto.addressLine,
          city: dto.city,
          area: dto.area,
          postalCode: dto.postalCode,
          ...(makeDefault ? { isDefault: true } : {}),
        },
        select: addressSelect,
      });
    });
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userId);

      const existing = await tx.address.findFirst({
        where: { id, userId },
        select: { id: true, isDefault: true },
      });
      if (!existing) throw notFound();

      await tx.address.delete({ where: { id } });

      // Never leave a customer with addresses but no default.
      if (existing.isDefault) {
        const next = await tx.address.findFirst({
          where: { userId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true },
        });
        if (next) {
          await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
        }
      }
    });
    return { id };
  }
}
