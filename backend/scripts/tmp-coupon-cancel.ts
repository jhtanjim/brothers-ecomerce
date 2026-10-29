import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:4000/api/v1';
const EMAIL = 'customer.test@example.com';
const prisma = new PrismaClient();
let failed = 0;
let custCookie = '';
let adminCookie = '';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' -> ' + JSON.stringify(detail)));
}

function envValue(name: string): string {
  const text = fs.readFileSync('.env', 'utf8');
  const m = text.match(new RegExp('^' + name + '=(.*)$', 'm'));
  if (!m) throw new Error(name + ' not found in .env');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

async function login(email: string, password: string) {
  const res = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Login failed for ' + email + ': ' + res.status);
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

async function api(cookie: string, method: string, path: string, body?: unknown, key?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Cookie: cookie };
  if (key) headers['Idempotency-Key'] = key;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json: any = await res.json();
  return { status: res.status, body: json, code: json?.code ?? json?.error?.code };
}

const shipping = {
  fullName: 'Coupon Cancel Test',
  phone: '01700000000',
  email: EMAIL,
  addressLine: '1 Test Road',
  city: 'Dhaka',
  area: 'Gulshan',
  postalCode: '1212',
  paymentMethod: 'BKASH',
};

async function main() {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
  const product = await prisma.product.findFirstOrThrow({
    where: { status: 'ACTIVE', category: { status: 'ACTIVE' }, stockQuantity: { gte: 10 } },
  });
  const price = Math.round(Number(product.discountPrice ?? product.price) * 100);
  if (price * 2 < 1000) throw new Error('Product too cheap for this test');
  const stock0 = product.stockQuantity;

  let cart = await prisma.cart.findFirst({ where: { userId: user.id } });
  let cartCreated = false;
  if (cart) {
    if ((await prisma.cartItem.count({ where: { cartId: cart.id } })) > 0) throw new Error('cart not empty; aborting');
  } else {
    cart = await prisma.cart.create({ data: { userId: user.id } });
    cartCreated = true;
  }
  const cartId = cart.id;
  const refill = async () => {
    await prisma.cartItem.deleteMany({ where: { cartId } });
    await prisma.cartItem.create({ data: { cartId, productId: product.id, quantity: 2 } });
  };
  const stockNow = async () => (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockQuantity;

  const P = 'TMPCXL-' + Date.now().toString(36).toUpperCase();
  const couponIds: string[] = [];
  const orderIds: string[] = [];
  const mk = async (suffix: string) => {
    const c = await prisma.coupon.create({
      data: { code: P + '-' + suffix, type: 'PERCENTAGE', value: '10', status: 'ACTIVE', usageLimit: 1, perUserLimit: 1 },
    });
    couponIds.push(c.id);
    return c;
  };
  const state = async (couponId: string, orderId: string) => ({
    used: (await prisma.coupon.findUniqueOrThrow({ where: { id: couponId } })).usedCount,
    usageRows: await prisma.couponUsage.count({ where: { couponId } }),
    orderUsage: await prisma.couponUsage.count({ where: { orderId } }),
  });
  const place = async (code: string) => {
    await refill();
    const r = await api(custCookie, 'POST', '/orders', { ...shipping, couponCode: code }, randomUUID());
    if (r.body.data?.id) orderIds.push(r.body.data.id);
    return r;
  };

  try {
    custCookie = await login(EMAIL, process.env.TEST_PASSWORD ?? '');
    adminCookie = await login(envValue('SEED_ADMIN_EMAIL'), envValue('SEED_ADMIN_PASSWORD'));

    // A. Customer cancel
    const a = await mk('CUS');
    let r = await place(a.code);
    check('A order placed with coupon', r.status === 201, r);
    const aId = r.body.data.id;
    let s = await state(a.id, aId);
    check('A before cancel: used 1, usage row exists', s.used === 1 && s.usageRows === 1 && s.orderUsage === 1, s);
    r = await api(custCookie, 'PATCH', '/orders/' + aId + '/cancel');
    check('A customer cancel 200', r.status === 200, r);
    s = await state(a.id, aId);
    check('A after cancel: used 0, usage row gone', s.used === 0 && s.usageRows === 0 && s.orderUsage === 0, s);
    const aOrder = await prisma.order.findUniqueOrThrow({ where: { id: aId } });
    check('A cancelled order keeps couponCode/couponDiscount as history', aOrder.couponCode === a.code && Number(aOrder.couponDiscount) > 0, aOrder);
    r = await place(a.code);
    check('A coupon can be used again after cancel', r.status === 201, r);
    if (r.body.data?.id) {
      await api(custCookie, 'PATCH', '/orders/' + r.body.data.id + '/cancel');
    }

    // B. Admin cancel
    const b = await mk('ADM');
    r = await place(b.code);
    check('B order placed with coupon', r.status === 201, r);
    const bId = r.body.data.id;
    r = await api(adminCookie, 'PATCH', '/admin/orders/' + bId + '/status', {
      status: 'CANCELLED',
      reason: 'Coupon give-back test',
    });
    check('B admin cancel 200', r.status === 200, r);
    s = await state(b.id, bId);
    check('B after admin cancel: used 0, usage row gone', s.used === 0 && s.usageRows === 0 && s.orderUsage === 0, s);

    // C. Auto-expire
    const c = await mk('EXP');
    r = await place(c.code);
    check('C order placed with coupon', r.status === 201, r);
    const cId = r.body.data.id;
    await prisma.order.update({ where: { id: cId }, data: { expiresAt: new Date(Date.now() - 60000) } });
    console.log('...waiting for the expiry job (runs every 5 min, up to 6 min)');
    let expired = false;
    for (let i = 0; i < 36 && !expired; i++) {
      await sleep(10000);
      expired = (await prisma.order.findUniqueOrThrow({ where: { id: cId } })).status === 'CANCELLED';
    }
    check('C order expired by the job', expired);
    if (expired) {
      s = await state(c.id, cId);
      check('C after expiry: used 0, usage row gone', s.used === 0 && s.usageRows === 0 && s.orderUsage === 0, s);
    }

    // D. Rejected cancel gives nothing back
    const d = await mk('REJ');
    r = await place(d.code);
    check('D order placed with coupon', r.status === 201, r);
    const dId = r.body.data.id;
    await api(custCookie, 'PATCH', '/orders/' + dId + '/cancel');
    r = await api(custCookie, 'PATCH', '/orders/' + dId + '/cancel');
    check('D second cancel -> 409', r.status === 409, r);
    s = await state(d.id, dId);
    check('D second cancel does not go below 0', s.used === 0, s);
  } finally {
    await prisma.cartItem.deleteMany({ where: { cartId } });
    for (const id of orderIds) {
      const o = await prisma.order.findUnique({ where: { id } });
      if (o && o.status === 'PENDING_PAYMENT') {
        await api(custCookie, 'PATCH', '/orders/' + id + '/cancel');
      }
    }
    await prisma.couponUsage.deleteMany({ where: { couponId: { in: couponIds } } });
    await prisma.coupon.deleteMany({ where: { id: { in: couponIds } } });
    if (cartCreated) await prisma.cart.delete({ where: { id: cartId } }).catch(() => undefined);
    const stockEnd = await stockNow();
    check('final stock restored', stockEnd === stock0, { stock0, stockEnd });
    await prisma.$disconnect();
  }
  console.log(failed === 0 ? 'ALL PASSED' : failed + ' FAILED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});