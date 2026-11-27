export type StaffRole = 'pending' | 'mesero' | 'cocina' | 'cajero' | 'admin';

export type ActiveWorkspaceRole = 'mesero' | 'cocina' | 'cajero' | 'admin';

export type KitchenStation = 'parrilla' | 'cocina' | 'barra';

export type MenuCategoryId =
  | 'familiar'
  | 'cortes'
  | 'compartir'
  | 'parrillada'
  | 'individual'
  | 'mixotes'
  | 'extras'
  | 'bebidas';

export type ServiceType =
  | 'Mesa 1'
  | 'Mesa 2'
  | 'Mesa 3'
  | 'Mesa 4'
  | 'Mesa 5'
  | 'Mesa 6'
  | 'Mesa 7'
  | 'Mesa 8'
  | 'Mesa 9'
  | 'Mesa 10'
  | 'Para Llevar'
  | 'Servicio a Domicilio';

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'paid'
  | 'cancelled';

export type PaymentMethod = 'none' | 'efectivo' | 'tarjeta' | 'transferencia';

export interface StaffProfile {
  uid: string;
  displayName: string;
  role: StaffRole;
  active: boolean;
  email?: string; // Loaded separately from /staff/{uid}/private/contact only for owner/admin
  createdAtMs: number;
  updatedAtMs: number;
}

export interface MenuCategory {
  id: MenuCategoryId;
  title: string;
  subtitle: string;
}

export interface MenuItem {
  id: string;
  categoryId: MenuCategoryId;
  name: string;
  price: number;
  desc: string;
  note?: string;
  badge?: string;
  station: KitchenStation;
  available: boolean;
  isCustom?: boolean;
}

export interface CashRegisterState {
  id: 'current';
  isOpen: boolean;
  dateKey: string;
  openingCash: number;
  openedByUid: string;
  openedByName: string;
  openedAtMs: number;
  closedByUid?: string;
  closedByName?: string;
  closedAtMs?: number;
  lastCountedCash?: number;
  lastCashDifference?: number;
  updatedAtMs: number;
}

export interface OrderDiner {
  id: string;
  label: string;
  isShared: boolean;
}

export interface OrderLineItem {
  lineId: string;
  dishId: string;
  name: string;
  categoryId: MenuCategoryId;
  station: KitchenStation;
  unitPrice: number;
  qty: number;
  dinerId: string;
  notes: string;
}

export interface OrderPrivateCustomer {
  orderId: string;
  customerName: string;
  phone: string;
  street: string;
  colony: string;
  reference: string;
  waiterUid: string;
}

export interface Order {
  id: string;
  folio: string;
  serviceType: ServiceType;
  status: OrderStatus;
  dateKey: string; // YYYY-MM-DD
  waiterUid: string;
  waiterName: string;
  kitchenUid?: string;
  cashierUid?: string;
  diners: OrderDiner[];
  items: OrderLineItem[];
  splitSharedEqually: boolean;
  subtotal: number;
  tip: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  changeGiven: number;
  hasDeliveryInfo: boolean;
  orderNotes: string;
  createdAtMs: number;
  updatedAtMs: number;
  paidAtMs?: number;
  // Populated on-demand ONLY for Admin/Cashier/originating Waiter from /orders/{id}/private/customer
  privateCustomer?: OrderPrivateCustomer | null;
}

export interface DailyReport {
  dateKey: string;
  totalSales: number;
  totalTips: number;
  orderCount: number;
  cancelledCount: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  openingCash: number;
  countedCash: number;
  cashDifference: number;
  generatedByUid: string;
  generatedByName: string;
  updatedAtMs: number;
}

export type AuditAction =
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_PAID'
  | 'ORDER_CANCELLED'
  | 'ROLE_UPDATED'
  | 'MENU_UPDATED'
  | 'CASH_REGISTER_OPENED'
  | 'CASH_REGISTER_CLOSED'
  | 'REPORT_SAVED';

export interface AuditLog {
  id: string;
  action: AuditAction;
  actorUid: string;
  actorRole: ActiveWorkspaceRole;
  targetId: string;
  summary: string;
  createdAtMs: number;
}
