export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message: string;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// ---------------------------------------------------------------------------
// Catalog (matches the public REST API; money values are decimal strings)
// ---------------------------------------------------------------------------

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'discount';

export interface CategoryRef {
  name: string;
  slug: string;
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  parentId: string | null;
  productCount: number;
}

export interface ProductImage {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  price: string;
  discountPrice: string | null;
  discountPercent: number;
  stockQuantity: number;
  featured: boolean;
  newArrival: boolean;
  bestSeller: boolean;
  category: CategoryRef;
  primaryImage: { url: string } | null;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  description: string | null;
  price: string;
  discountPrice: string | null;
  discountPercent: number;
  stockQuantity: number;
  featured: boolean;
  newArrival: boolean;
  bestSeller: boolean;
  material: string | null;
  category: CategoryRef;
  images: ProductImage[];
  /** Empty when the product has no sizes or colours. size/color are '' when not applicable. */
  variants: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  size: string;
  color: string;
  stockQuantity: number;
}

/** What the listing can actually be filtered by (GET /products/filters). */
export interface ProductFilterOptions {
  sizes: string[];
  colors: string[];
  materials: string[];
}
// ---------------------------------------------------------------------------
// Auth (matches /auth/* responses; the session itself lives in HTTP-only cookies)
// ---------------------------------------------------------------------------

export type UserRole = 'CUSTOMER' | 'ADMIN';

/** Returned by register, login and refresh. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** Returned by GET /auth/me. */
export interface UserProfile extends AuthUser {
  phone: string | null;
  createdAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
}
// ---------------------------------------------------------------------------
// Cart (matches /cart responses; all money values are decimal strings)
// ---------------------------------------------------------------------------

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
  /** Units in purchasable lines only (lines with an issue are excluded). */
  itemCount: number;
  subtotal: string;
  hasIssues: boolean;
}

// ---------------------------------------------------------------------------
// Addresses (matches /addresses responses)
// ---------------------------------------------------------------------------

export interface AddressView {
  id: string;
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  area: string;
  postalCode: string;
  isDefault: boolean;
}

export interface AddressInput {
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  area: string;
  postalCode: string;
  isDefault?: boolean;
}

// ---------------------------------------------------------------------------
// Orders (matches /orders responses; money values are decimal strings, dates are ISO strings)
// ---------------------------------------------------------------------------

export type PaymentMethod = 'BKASH' | 'NAGAD' | 'CASH';

export type OrderChannel = 'ONLINE' | 'POS';

export type OrderStatus =
  'PENDING_PAYMENT' | 'PROCESSING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

/** UNPAID = no proof submitted yet; PENDING = submitted, awaiting admin review. */
export type PaymentStatus = 'UNPAID' | 'PENDING' | 'APPROVED' | 'REJECTED';

/** Shipping details and payment method only; products and prices come from the server-side cart. */
export interface CreateOrderInput {
  fullName: string;
  phone: string;
  email: string;
  addressLine: string;
  city: string;
  area: string;
  postalCode: string;
  notes?: string;
  couponCode?: string;
  paymentMethod: PaymentMethod;
}

export interface OrderItemView {
  id: string;
  productId: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  size: string | null;
  color: string | null;
  /** Regular unit price at purchase time. */
  unitPrice: string;
  quantity: number;
  discountAmount: string;
  totalPrice: string;
}

export interface OrderShipping {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  area: string;
  postalCode: string;
}

export interface OrderPayment {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: string;
}

/** Returned by POST /orders. */
export interface OrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: string;
  discountAmount: string;
  couponDiscount: string;
  deliveryCharge: string;
  totalAmount: string;
  shipping: OrderShipping;
  notes: string | null;
  expiresAt: string | null;
  createdAt: string;
  items: OrderItemView[];
  payment: OrderPayment | null;
}

export interface OrderTimelineEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: string;
}

/** The customer's most recent payment submission for an order. */
export interface PaymentSubmissionInfo {
  status: PaymentStatus;
  transactionId: string;
  rejectionReason: string | null;
  /** Signed link, only ever sent to the order's owner. */
  screenshotUrl: string | null;
  submittedAt: string;
}

/** Data for the payment panel. Null unless the order is still awaiting payment. */
export interface OrderPaymentInfo {
  /** Null when the merchant number is not set up: the customer cannot pay yet. */
  merchantNumber: string | null;
  screenshotEnabled: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  latestSubmission: PaymentSubmissionInfo | null;
}

/** Returned by POST /payments. */
export interface PaymentSubmissionResult {
  id: string;
  paymentId: string;
  status: PaymentStatus;
  transactionId: string;
  hasScreenshot: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  createdAt: string;
}
/** Returned by GET /orders/:id. */
export interface OrderDetail extends OrderView {
  timeline: OrderTimelineEntry[];
  paymentInfo: OrderPaymentInfo | null;
  /** Transaction ID of the approved payment; null until the payment is approved. */
  approvedTransactionId: string | null;
}

/** One line in the order history list (GET /orders). */
export interface OrderPreviewItem {
  name: string;
  imageUrl: string | null;
  quantity: number;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: string;
  /** Total number of lines in the order; previewItems holds only the first few. */
  lineCount: number;
  previewItems: OrderPreviewItem[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Admin payments (matches /admin/payments responses; money values are decimal strings)
// ---------------------------------------------------------------------------

export type AdminPaymentFilter = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminPaymentListItem {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  transactionId: string;
  senderPhone: string | null;
  hasScreenshot: boolean;
  amount: string;
  attemptCount: number;
  submittedAt: string;
  reviewedAt: string | null;
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    customerName: string;
    customerPhone: string;
    totalAmount: string;
  };
}

export interface AdminPaymentSubmission {
  id: string;
  status: PaymentStatus;
  transactionId: string;
  rejectionReason: string | null;
  submittedAt: string;
}

export interface AdminPaymentDetail {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  transactionId: string;
  senderPhone: string | null;
  /** Signed link to the private screenshot (admins only). */
  screenshotUrl: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  amount: string;
  paymentStatus: PaymentStatus;
  attemptCount: number;
  submissions: AdminPaymentSubmission[];
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    totalAmount: string;
    createdAt: string;
    customer: { name: string; email: string };
    shipping: { name: string; phone: string; email: string };
    items: {
      name: string;
      sku: string;
      size: string | null;
      color: string | null;
      quantity: number;
      totalPrice: string;
    }[];
  };
}

/** Returned by PATCH approve and reject. */
export interface AdminPaymentReviewResult {
  id: string;
  status: PaymentStatus;
  orderId: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
}
// ---------------------------------------------------------------------------
// Admin orders (matches /admin/orders responses; money values are decimal strings)
// ---------------------------------------------------------------------------

export interface AdminOrderFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
}

export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  channel: OrderChannel;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: string;
  itemCount: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  createdAt: string;
}

export interface AdminOrderSubmission {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId: string;
  rejectionReason: string | null;
  submittedAt: string;
}

export interface AdminOrderTimelineEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  /** Null means the system (for example the auto-expire job). */
  changedBy: string | null;
  createdAt: string;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  channel: OrderChannel;
  /** POS sales only: the cash handed over. */
  cashReceived: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: string;
  discountAmount: string;
  couponDiscount: string;
  couponCode: string | null;
  deliveryCharge: string;
  totalAmount: string;
  customer: { name: string; email: string };
  shipping: OrderShipping;
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  items: {
    id: string;
    name: string;
    sku: string;
    size: string | null;
    color: string | null;
    imageUrl: string | null;
    unitPrice: string;
    quantity: number;
    discountAmount: string;
    totalPrice: string;
  }[];
  payment: {
    id: string;
    method: PaymentMethod;
    status: PaymentStatus;
    amount: string;
    attemptCount: number;
    submissions: AdminOrderSubmission[];
  } | null;
  timeline: AdminOrderTimelineEntry[];
}

/** Returned by PATCH /admin/orders/:id/status. */
export interface AdminOrderStatusResult {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  /** True when a paid order was cancelled: the refund is a manual step. */
  refundNeeded: boolean;
}

// ---------------------------------------------------------------------------
// Coupons (matches /coupons and /admin/coupons responses; money values are decimal strings)
// ---------------------------------------------------------------------------

export type CouponType = 'PERCENTAGE' | 'FIXED';
export type CouponStatus = 'ACTIVE' | 'INACTIVE';

/** Returned by POST /coupons/validate. A preview only: the backend recalculates when the order is placed. */
export interface ValidateCouponResult {
  code: string;
  discount: string;
  /** Amount after product discounts and the coupon, before delivery. */
  payable: string;
  /** Only present when a city was sent. */
  estimatedTotal: string | null;
}

/** Returned by POST /orders/quote: a read-only checkout preview priced by the backend. */
export interface OrderQuote {
  subtotal: string;
  discount: string;
  couponCode: string | null;
  couponDiscount: string;
  couponError: { code: string; message: string } | null;
  /** null until a city is known. */
  deliveryCharge: string | null;
  /** null until a city is known. */
  total: string | null;
  freeDeliveryThreshold: string | null;
}

export interface AdminCouponFilters {
  status?: CouponStatus;
  search?: string;
}

export interface AdminCoupon {
  id: string;
  code: string;
  type: CouponType;
  value: string;
  minimumOrderAmount: string | null;
  maximumDiscount: string | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  status: CouponStatus;
  createdAt: string;
  updatedAt: string;
}

/** Body of POST /admin/coupons. Money values are decimal strings with up to 2 decimals. */
export interface CreateCouponInput {
  code: string;
  type: CouponType;
  value: string;
  minimumOrderAmount?: string;
  maximumDiscount?: string;
  usageLimit?: number;
  perUserLimit?: number;
  startsAt?: string;
  expiresAt?: string;
  status?: CouponStatus;
}

/** Body of PATCH /admin/coupons/:id. null clears an optional limit; code and type are locked once used. */
export interface UpdateCouponInput {
  code?: string;
  type?: CouponType;
  value?: string;
  minimumOrderAmount?: string | null;
  maximumDiscount?: string | null;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
}

// ---------------------------------------------------------------------------
// Admin categories (matches /admin/categories responses)
// ---------------------------------------------------------------------------

export type CategoryStatus = 'ACTIVE' | 'INACTIVE';
export type AdminCategorySort = 'sort_order' | 'name_asc' | 'name_desc' | 'newest';

export interface AdminCategoryFilters {
  status?: CategoryStatus;
  search?: string;
  sort?: AdminCategorySort;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  status: CategoryStatus;
  sortOrder: number;
  parentId: string | null;
  /** All products in the category, any status. Delete is only possible at 0. */
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Body of POST /admin/categories. The slug is generated from the name when omitted. */
export interface CreateCategoryInput {
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  status?: CategoryStatus;
  parentId?: string;
}

/** Body of PATCH /admin/categories/:id. null clears description or imageUrl. Renaming keeps the slug. */
export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
  parentId?: string | null;
}

// ---------------------------------------------------------------------------
// Admin products (matches /admin/products responses; money values are decimal strings)
// ---------------------------------------------------------------------------

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface AdminProductFilters {
  status?: ProductStatus;
  categoryId?: string;
  search?: string;
  sort?: ProductSort;
}

export interface AdminProductImage {
  id: string;
  url: string;
  publicId: string;
  sortOrder: number;
  /** The API returns images primary first, then by sortOrder. */
  isPrimary: boolean;
}

export interface AdminProductVariant {
  id: string;
  size: string;
  color: string;
  sku: string;
  stockQuantity: number;
}

export interface CreateVariantInput {
  size?: string;
  color?: string;
  sku: string;
  stockQuantity: number;
}

export interface UpdateVariantInput {
  size?: string;
  color?: string;
  sku?: string;
  stockQuantity?: number;
}

export interface AdminProduct {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  description: string | null;
  price: string;
  discountPrice: string | null;
  discountPercent: number;
  stockQuantity: number;
  lowStockThreshold: number;
  status: ProductStatus;
  featured: boolean;
  newArrival: boolean;
  bestSeller: boolean;
  material: string | null;
  soldCount: number;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string; status: CategoryStatus };
  images: AdminProductImage[];
  variants: AdminProductVariant[];
}

/** Body of POST /admin/products. Prices are numbers with up to 2 decimals; slug is generated when omitted. */
export interface CreateProductInput {
  categoryId: string;
  name: string;
  slug?: string;
  sku: string;
  shortDescription?: string;
  description?: string;
  price: number;
  discountPrice?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  status?: 'ACTIVE' | 'INACTIVE';
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  material?: string;
}

/** Body of PATCH /admin/products/:id. null clears the descriptions or the discount. Status has its own endpoint. */
export interface UpdateProductInput {
  categoryId?: string;
  name?: string;
  slug?: string;
  sku?: string;
  shortDescription?: string | null;
  description?: string | null;
  price?: number;
  discountPrice?: number | null;
  stockQuantity?: number;
  lowStockThreshold?: number;
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  material?: string | null;
}

// ---------------------------------------------------------------------------
// Admin customers (matches /admin/customers)
// ---------------------------------------------------------------------------

export type CustomerStatus = 'ACTIVE' | 'SUSPENDED';

export interface AdminCustomerFilters {
  status?: CustomerStatus;
  search?: string;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: CustomerStatus;
  createdAt: string;
  orderCount: number;
  lastOrderAt: string | null;
}

// ---------------------------------------------------------------------------
// Admin settings (matches /admin/settings; values are the effective ones customers get)
// ---------------------------------------------------------------------------

export interface AdminSettings {
  deliveryHomeCity: string;
  deliveryHomeCityCharge: number;
  deliveryOtherCityCharge: number;
  deliveryFreeThreshold: number | null;
  /** Stored text, even when it is not a usable number (for example a placeholder). */
  bkashNumber: string | null;
  bkashNumberValid: boolean;
  nagadNumber: string | null;
  nagadNumberValid: boolean;
  screenshotEnabled: boolean;
  maxPaymentAttempts: number;
  unpaidExpiryHours: number;
}

/** Body of PATCH /admin/settings: only changed fields. null clears the threshold or a merchant number. */
export type UpdateSettingsInput = Partial<
  Omit<AdminSettings, 'bkashNumberValid' | 'nagadNumberValid'>
>;

// ---------------------------------------------------------------------------
// Admin dashboard (matches /admin/dashboard responses; money values are decimal strings)
// ---------------------------------------------------------------------------

export interface DashboardCards {
  totalSales: string;
  todaySales: string;
  totalOrders: number;
  pendingOrders: number;
  pendingPayments: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockProducts: number;
}

export interface DashboardRecentOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: string;
  customerName: string;
  createdAt: string;
}

export interface DashboardPendingPayment {
  orderId: string;
  orderNumber: string;
  paymentId: string | null;
  method: PaymentMethod | null;
  totalAmount: string;
  customerName: string;
  createdAt: string;
}

export interface DashboardLowStockItem {
  id: string;
  name: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
}

export interface DashboardOverview {
  cards: DashboardCards;
  recentOrders: DashboardRecentOrder[];
  pendingPayments: DashboardPendingPayment[];
  lowStock: DashboardLowStockItem[];
}

export interface DashboardSalesPoint {
  /** Dhaka calendar day, YYYY-MM-DD. */
  date: string;
  sales: string;
  orders: number;
}

export interface DashboardSales {
  days: number;
  points: DashboardSalesPoint[];
}

export interface DashboardTopProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  soldCount: number;
  price: string;
}

// ---------------------------------------------------------------------------
// Daily report (matches /admin/dashboard/daily)
// ---------------------------------------------------------------------------

export interface DailyReportChannel {
  sales: number;
  total: string;
  methods: { method: PaymentMethod; sales: number; total: string }[];
}

export interface DailyReport {
  date: string;
  total: string;
  itemsSold: number;
  pos: DailyReportChannel;
  online: DailyReportChannel;
  cancelledPos: { sales: number; total: string };
  topItems: { productId: string; name: string; quantity: number; total: string }[];
}
