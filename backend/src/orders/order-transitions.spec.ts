import { OrderStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ALLOWED_TRANSITIONS } from './order-transitions';

describe('admin order status transitions', () => {
  it('has an entry for every order status', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual(Object.values(OrderStatus).sort());
  });

  it('DELIVERED and CANCELLED are final', () => {
    expect(ALLOWED_TRANSITIONS.DELIVERED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('PENDING_PAYMENT can only be cancelled by hand (payment approval moves it forward)', () => {
    expect(ALLOWED_TRANSITIONS.PENDING_PAYMENT).toEqual(['CANCELLED']);
  });

  it('follows PROCESSING -> CONFIRMED -> SHIPPED -> DELIVERED', () => {
    expect(ALLOWED_TRANSITIONS.PROCESSING).toContain('CONFIRMED');
    expect(ALLOWED_TRANSITIONS.CONFIRMED).toContain('SHIPPED');
    expect(ALLOWED_TRANSITIONS.SHIPPED).toContain('DELIVERED');
  });

  it('a shipped order can no longer be cancelled', () => {
    expect(ALLOWED_TRANSITIONS.SHIPPED).not.toContain('CANCELLED');
  });

  it('no status can move backwards', () => {
    expect(ALLOWED_TRANSITIONS.CONFIRMED).not.toContain('PROCESSING');
    expect(ALLOWED_TRANSITIONS.SHIPPED).not.toContain('CONFIRMED');
    expect(ALLOWED_TRANSITIONS.PROCESSING).not.toContain('PENDING_PAYMENT');
  });
});
