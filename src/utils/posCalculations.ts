import type {
  ActiveWorkspaceRole,
  KitchenStation,
  MenuCategoryId,
  Order,
  OrderDiner,
  OrderLineItem,
  OrderStatus,
  PaymentMethod,
  ServiceType,
} from '../types/pos';

export const MAX_DINERS_PER_ORDER = 12;
export const MAX_ITEMS_PER_ORDER = 50;
export const MAX_ORDER_NOTES_LENGTH = 240;
export const MAX_LINE_NOTES_LENGTH = 120;
export const MAX_DISPLAY_NAME_LENGTH = 80;
export const MAX_CUSTOMER_NAME_LENGTH = 100;
export const MAX_PHONE_LENGTH = 30;
export const MAX_STREET_LENGTH = 140;
export const MAX_COLONY_LENGTH = 100;
export const MAX_REFERENCE_LENGTH = 200;
export const MAX_MENU_NAME_LENGTH = 80;
export const MAX_MENU_DESC_LENGTH = 180;

export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  const sign = amount < 0 ? -1 : 1;
  const rounded = (sign * Math.round((Math.abs(amount) + Number.EPSILON) * 100)) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatMXN(amount: number): string {
  const safe = roundMoney(amount);
  return `$${safe.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateOrderFolio(): string {
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `OBR-${randomPart}`;
}

export function sanitizeText(value: string, maxLength: number): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

export function isValidFirestoreId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}

export function calculateItemsSubtotal(items: OrderLineItem[]): number {
  const sum = items.reduce((acc, item) => {
    const qty = Math.max(0, Math.floor(item.qty));
    const price = Math.max(0, item.unitPrice);
    return acc + qty * price;
  }, 0);
  return roundMoney(sum);
}

export interface DinerAccountBreakdown {
  diner: OrderDiner;
  items: OrderLineItem[];
  ownSubtotal: number;
  sharedAllocation: number;
  finalTotal: number;
}

export function calculateDinerBreakdowns(
  diners: OrderDiner[],
  items: OrderLineItem[],
  splitSharedEqually: boolean
): DinerAccountBreakdown[] {
  const sharedDiners = diners.filter((d) => d.isShared);
  const personalDiners = diners.filter((d) => !d.isShared);

  const sharedTotal = items
    .filter((item) => sharedDiners.some((sd) => sd.id === item.dinerId))
    .reduce((acc, item) => acc + item.unitPrice * item.qty, 0);

  const baseShare =
    splitSharedEqually && personalDiners.length > 0 && sharedTotal > 0
      ? Math.floor((sharedTotal / personalDiners.length) * 100) / 100
      : 0;
  const remainderCents =
    splitSharedEqually && personalDiners.length > 0 && sharedTotal > 0
      ? Math.round(roundMoney(sharedTotal - baseShare * personalDiners.length) * 100)
      : 0;

  let personalIndex = 0;

  return diners.map((diner) => {
    const dinerItems = items.filter((i) => i.dinerId === diner.id);
    const ownSubtotal = calculateItemsSubtotal(dinerItems);
    let sharedAllocation = 0;
    if (!diner.isShared && splitSharedEqually && sharedTotal > 0) {
      const extraCent = personalIndex < remainderCents ? 0.01 : 0;
      sharedAllocation = roundMoney(baseShare + extraCent);
      personalIndex += 1;
    }
    const finalTotal =
      diner.isShared && splitSharedEqually && personalDiners.length > 0
        ? 0
        : roundMoney(ownSubtotal + sharedAllocation);

    return {
      diner,
      items: dinerItems,
      ownSubtotal,
      sharedAllocation,
      finalTotal,
    };
  });
}

export interface CashCutReconciliation {
  valid: boolean;
  error?: string;
  openingCash: number;
  cashSales: number;
  expectedCashInDrawer: number;
  countedCash: number;
  difference: number;
  statusLabel: 'Cuadrado' | 'Sobrante' | 'Faltante';
}

export function calculateCashCutReconciliation(params: {
  openingCash: number;
  cashSales: number;
  countedCash: number;
}): CashCutReconciliation {
  const openingCash = roundMoney(params.openingCash);
  const cashSales = roundMoney(params.cashSales);
  const countedCash = roundMoney(params.countedCash);

  if (openingCash < 0 || openingCash > 1000000) {
    return {
      valid: false,
      error: 'El fondo inicial debe estar entre $0 y $1,000,000 MXN.',
      openingCash: 0,
      cashSales,
      expectedCashInDrawer: cashSales,
      countedCash: 0,
      difference: 0,
      statusLabel: 'Cuadrado',
    };
  }
  if (countedCash < 0 || countedCash > 10000000) {
    return {
      valid: false,
      error: 'El efectivo contado en caja debe estar entre $0 y $10,000,000 MXN.',
      openingCash,
      cashSales,
      expectedCashInDrawer: roundMoney(openingCash + cashSales),
      countedCash: 0,
      difference: 0,
      statusLabel: 'Cuadrado',
    };
  }

  const expectedCashInDrawer = roundMoney(openingCash + cashSales);
  const difference = roundMoney(countedCash - expectedCashInDrawer);
  const statusLabel: 'Cuadrado' | 'Sobrante' | 'Faltante' =
    Math.abs(difference) < 0.005 ? 'Cuadrado' : difference > 0 ? 'Sobrante' : 'Faltante';

  return {
    valid: true,
    openingCash,
    cashSales,
    expectedCashInDrawer,
    countedCash,
    difference: Math.abs(difference) < 0.005 ? 0 : difference,
    statusLabel,
  };
}

export interface PaymentCalculationResult {
  valid: boolean;
  error?: string;
  subtotal: number;
  tip: number;
  total: number;
  amountReceived: number;
  changeGiven: number;
}

export function calculateCheckoutPayment(params: {
  subtotal: number;
  tip: number;
  paymentMethod: PaymentMethod;
  amountReceivedInput: number;
}): PaymentCalculationResult {
  const subtotal = roundMoney(params.subtotal);
  const tip = roundMoney(params.tip);

  if (subtotal <= 0) {
    return {
      valid: false,
      error: 'El subtotal de la orden debe ser mayor a $0.',
      subtotal,
      tip: 0,
      total: 0,
      amountReceived: 0,
      changeGiven: 0,
    };
  }

  if (tip < 0 || tip > 50000) {
    return {
      valid: false,
      error: 'La propina debe estar entre $0 y $50,000.',
      subtotal,
      tip,
      total: roundMoney(subtotal + Math.max(0, tip)),
      amountReceived: 0,
      changeGiven: 0,
    };
  }

  if (params.paymentMethod === 'none') {
    return {
      valid: false,
      error: 'Selecciona un método de pago (Efectivo, Tarjeta o Transferencia).',
      subtotal,
      tip,
      total: roundMoney(subtotal + tip),
      amountReceived: 0,
      changeGiven: 0,
    };
  }

  const total = roundMoney(subtotal + tip);
  const amountReceived =
    params.paymentMethod === 'efectivo' ? roundMoney(params.amountReceivedInput) : total;

  if (amountReceived < total) {
    return {
      valid: false,
      error: `El monto recibido (${formatMXN(amountReceived)}) es menor al total a pagar (${formatMXN(total)}).`,
      subtotal,
      tip,
      total,
      amountReceived,
      changeGiven: 0,
    };
  }

  const changeGiven = roundMoney(amountReceived - total);
  return {
    valid: true,
    subtotal,
    tip,
    total,
    amountReceived,
    changeGiven,
  };
}

export function canTransitionOrderStatus(
  role: ActiveWorkspaceRole,
  fromStatus: OrderStatus,
  toStatus: OrderStatus
): boolean {
  if (fromStatus === toStatus) return false;
  if (fromStatus === 'paid' || fromStatus === 'cancelled') {
    return false;
  }
  if (role === 'admin') {
    return toStatus === 'cancelled';
  }
  if (role === 'cocina') {
    return (
      (fromStatus === 'pending' && toStatus === 'preparing') ||
      (fromStatus === 'preparing' && toStatus === 'ready')
    );
  }
  if (role === 'mesero') {
    return fromStatus === 'ready' && toStatus === 'served';
  }
  if (role === 'cajero') {
    return (fromStatus === 'ready' || fromStatus === 'served') && toStatus === 'paid';
  }
  return false;
}

const VALID_MENU_CATEGORIES: MenuCategoryId[] = [
  'familiar',
  'cortes',
  'compartir',
  'parrillada',
  'individual',
  'mixotes',
  'extras',
  'bebidas',
];

const VALID_KITCHEN_STATIONS: KitchenStation[] = ['parrilla', 'cocina', 'barra'];

export function validateNewMenuItemInput(params: {
  name: string;
  price: number;
  categoryId: MenuCategoryId;
  station: KitchenStation;
  desc: string;
}): string | null {
  const cleanName = sanitizeText(params.name, MAX_MENU_NAME_LENGTH);
  if (cleanName.length < 2) {
    return 'Ingresa un nombre de platillo de al menos 2 caracteres.';
  }
  const safePrice = roundMoney(params.price);
  if (!Number.isFinite(params.price) || safePrice < 1 || safePrice > 50000) {
    return 'El precio del platillo debe estar entre $1 y $50,000 MXN.';
  }
  if (!VALID_MENU_CATEGORIES.includes(params.categoryId)) {
    return 'Selecciona una categoría válida para el platillo.';
  }
  if (!VALID_KITCHEN_STATIONS.includes(params.station)) {
    return 'Selecciona una estación de preparación válida (Parrilla, Cocina o Barra).';
  }
  if (params.desc.trim().length > MAX_MENU_DESC_LENGTH) {
    return `La descripción no puede superar ${MAX_MENU_DESC_LENGTH} caracteres.`;
  }
  return null;
}

export function getKitchenUrgency(createdAtMs: number, nowMs: number = Date.now()): {
  elapsedMinutes: number;
  formattedElapsed: string;
  level: 'normal' | 'warning' | 'urgent';
  label: string;
} {
  const diffSec = Math.max(0, Math.floor((nowMs - createdAtMs) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  const formattedElapsed = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  if (mins >= 20) {
    return { elapsedMinutes: mins, formattedElapsed, level: 'urgent', label: 'Urgente (+20m)' };
  }
  if (mins >= 12) {
    return { elapsedMinutes: mins, formattedElapsed, level: 'warning', label: 'Atención (+12m)' };
  }
  return { elapsedMinutes: mins, formattedElapsed, level: 'normal', label: 'En tiempo' };
}

export interface DailySalesSummary {
  dateKey: string;
  paidOrderCount: number;
  activeOrderCount: number;
  cancelledOrderCount: number;
  grossSubtotal: number;
  totalTips: number;
  totalRevenue: number;
  averageTicket: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  topDishes: { dishId: string; name: string; qty: number; revenue: number }[];
  categoryTotals: { categoryId: MenuCategoryId; revenue: number; qty: number }[];
}

export function computeDailySalesSummary(orders: Order[], dateKey: string): DailySalesSummary {
  const dayOrders = orders.filter((o) => o.dateKey === dateKey);
  const paidOrders = dayOrders.filter((o) => o.status === 'paid');
  const activeOrders = dayOrders.filter(
    (o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready' || o.status === 'served'
  );
  const cancelledOrders = dayOrders.filter((o) => o.status === 'cancelled');

  let grossSubtotal = 0;
  let totalTips = 0;
  let totalRevenue = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  let transferTotal = 0;

  const dishMap = new Map<string, { dishId: string; name: string; qty: number; revenue: number }>();
  const categoryMap = new Map<MenuCategoryId, { categoryId: MenuCategoryId; revenue: number; qty: number }>();

  for (const order of paidOrders) {
    grossSubtotal += order.subtotal;
    totalTips += order.tip;
    totalRevenue += order.total;

    if (order.paymentMethod === 'efectivo') cashTotal += order.total;
    if (order.paymentMethod === 'tarjeta') cardTotal += order.total;
    if (order.paymentMethod === 'transferencia') transferTotal += order.total;

    for (const item of order.items) {
      const lineRev = roundMoney(item.unitPrice * item.qty);
      const existingDish = dishMap.get(item.dishId);
      if (existingDish) {
        existingDish.qty += item.qty;
        existingDish.revenue = roundMoney(existingDish.revenue + lineRev);
      } else {
        dishMap.set(item.dishId, {
          dishId: item.dishId,
          name: item.name,
          qty: item.qty,
          revenue: lineRev,
        });
      }

      const existingCat = categoryMap.get(item.categoryId);
      if (existingCat) {
        existingCat.qty += item.qty;
        existingCat.revenue = roundMoney(existingCat.revenue + lineRev);
      } else {
        categoryMap.set(item.categoryId, {
          categoryId: item.categoryId,
          qty: item.qty,
          revenue: lineRev,
        });
      }
    }
  }

  const topDishes = Array.from(dishMap.values())
    .sort((a, b) => b.revenue - a.revenue || b.qty - a.qty)
    .slice(0, 8);

  const categoryTotals = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue);

  return {
    dateKey,
    paidOrderCount: paidOrders.length,
    activeOrderCount: activeOrders.length,
    cancelledOrderCount: cancelledOrders.length,
    grossSubtotal: roundMoney(grossSubtotal),
    totalTips: roundMoney(totalTips),
    totalRevenue: roundMoney(totalRevenue),
    averageTicket: paidOrders.length > 0 ? roundMoney(totalRevenue / paidOrders.length) : 0,
    cashTotal: roundMoney(cashTotal),
    cardTotal: roundMoney(cardTotal),
    transferTotal: roundMoney(transferTotal),
    topDishes,
    categoryTotals,
  };
}

/**
 * Neutralizes CSV formula injection (CWE-1236) and formats RFC-4180 CSV cells.
 */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildDailyReportCsv(orders: Order[], dateKey: string): string {
  const headers = [
    'Fecha',
    'Folio',
    'Mesa / Modalidad',
    'Estado',
    'Mesero',
    'Método de Pago',
    'Subtotal (MXN)',
    'Propina (MXN)',
    'Total (MXN)',
    'Platillos',
  ];

  const dayOrders = orders.filter((o) => o.dateKey === dateKey);
  const rows = dayOrders.map((o) => [
    o.dateKey,
    o.folio,
    o.serviceType,
    o.status,
    o.waiterName,
    o.paymentMethod,
    roundMoney(o.subtotal).toFixed(2),
    roundMoney(o.tip).toFixed(2),
    roundMoney(o.total).toFixed(2),
    o.items.map((i) => `${i.qty}x ${i.name}`).join(' | '),
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function buildPlainTextReceipt(order: Order, dinerId?: string): string {
  const breakdowns = calculateDinerBreakdowns(order.diners, order.items, order.splitSharedEqually);
  const dateStr = new Date(order.paidAtMs || order.createdAtMs).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const divider = '========================================';
  const thinDivider = '----------------------------------------';
  const lines: string[] = [
    divider,
    '       LA OBRERA GRILL ASADERO',
    '     Sabor, Fuego y Pasion * 1996',
    divider,
    `Folio:      ${order.folio}`,
    `Fecha:      ${dateStr}`,
    `Servicio:   ${order.serviceType}`,
    `Mesero:     ${order.waiterName}`,
  ];

  if (order.privateCustomer?.customerName) {
    lines.push(`Cliente:    ${order.privateCustomer.customerName}`);
  }
  if (order.privateCustomer?.phone) {
    lines.push(`Telefono:   ${order.privateCustomer.phone}`);
  }
  if (order.hasDeliveryInfo && order.privateCustomer?.street) {
    lines.push(`Direccion:  ${order.privateCustomer.street}, Col. ${order.privateCustomer.colony}`);
    if (order.privateCustomer.reference) {
      lines.push(`Referencia: ${order.privateCustomer.reference}`);
    }
  }

  lines.push(thinDivider);

  if (dinerId) {
    const selected = breakdowns.find((b) => b.diner.id === dinerId);
    if (selected) {
      lines.push(`CUENTA INDIVIDUAL: ${selected.diner.label.toUpperCase()}`);
      lines.push(thinDivider);
      for (const item of selected.items) {
        const lineTotal = formatMXN(item.unitPrice * item.qty);
        lines.push(`${item.qty}x ${item.name}  ${lineTotal}`);
        if (item.notes) lines.push(`   Nota: ${item.notes}`);
      }
      if (selected.sharedAllocation > 0) {
        lines.push(`+ Parte proporcional Al Centro  ${formatMXN(selected.sharedAllocation)}`);
      }
      lines.push(thinDivider);
      lines.push(`TOTAL PERSONA:  ${formatMXN(selected.finalTotal)} MXN`);
    }
  } else {
    for (const group of breakdowns) {
      if (group.items.length === 0 && group.sharedAllocation === 0) continue;
      lines.push(`[ ${group.diner.label.toUpperCase()} ]`);
      for (const item of group.items) {
        const lineTotal = formatMXN(item.unitPrice * item.qty);
        lines.push(`  ${item.qty}x ${item.name}  ${lineTotal}`);
        if (item.notes) lines.push(`     Nota: ${item.notes}`);
      }
      if (group.sharedAllocation > 0) {
        lines.push(`  + Al Centro proporcional  ${formatMXN(group.sharedAllocation)}`);
      }
      if (!group.diner.isShared || !order.splitSharedEqually) {
        lines.push(`  Subtotal cuenta: ${formatMXN(group.finalTotal)}`);
      }
    }

    lines.push(thinDivider);
    lines.push(`Subtotal:       ${formatMXN(order.subtotal)}`);
    if (order.tip > 0) {
      lines.push(`Propina:        ${formatMXN(order.tip)}`);
    }
    lines.push(`TOTAL A PAGAR:  ${formatMXN(order.total)} MXN`);
    if (order.status === 'paid') {
      lines.push(thinDivider);
      lines.push(`Estado:         PAGADO`);
      lines.push(`Metodo Pago:    ${order.paymentMethod.toUpperCase()}`);
      lines.push(`Recibido:       ${formatMXN(order.amountReceived)}`);
      if (order.paymentMethod === 'efectivo') {
        lines.push(`Cambio:         ${formatMXN(order.changeGiven)}`);
      }
    } else {
      lines.push(`Estado:         PRE-CUENTA (${order.status.toUpperCase()})`);
    }
  }

  lines.push(divider);
  lines.push('    Gracias por su preferencia!');
  lines.push('      @asadero_la_obrera');
  lines.push(divider);

  return lines.join('\n');
}

export function validateNewOrderInput(params: {
  serviceType: ServiceType;
  diners: OrderDiner[];
  items: OrderLineItem[];
  customerName: string;
  phone: string;
  street: string;
  colony: string;
  reference: string;
}): string | null {
  if (params.diners.length === 0 || params.diners.length > MAX_DINERS_PER_ORDER) {
    return `La orden debe tener entre 1 y ${MAX_DINERS_PER_ORDER} cuentas de comensal.`;
  }
  if (params.items.length === 0 || params.items.length > MAX_ITEMS_PER_ORDER) {
    return `Agrega entre 1 y ${MAX_ITEMS_PER_ORDER} platillos para enviar a cocina.`;
  }
  for (const item of params.items) {
    if (item.qty < 1 || item.qty > 99 || item.unitPrice <= 0) {
      return 'Se detectó una cantidad o precio inválido en un platillo.';
    }
  }
  if (params.serviceType === 'Servicio a Domicilio') {
    if (params.customerName.trim().length < 2) {
      return 'Ingresa el nombre del cliente para Servicio a Domicilio.';
    }
    if (params.phone.trim().length < 7) {
      return 'Ingresa un teléfono de contacto válido para Servicio a Domicilio.';
    }
    if (params.street.trim().length < 3 || params.colony.trim().length < 2 || params.reference.trim().length < 3) {
      return 'Completa calle/número, colonia y referencia de la casa para Servicio a Domicilio.';
    }
  }
  return null;
}

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; shortLabel: string; colorClass: string; dotClass: string }
> = {
  pending: {
    label: 'Pendiente en Cocina',
    shortLabel: 'Pendiente',
    colorClass: 'text-amber-400',
    dotClass: 'bg-amber-400',
  },
  preparing: {
    label: 'En Preparación',
    shortLabel: 'Cocinando',
    colorClass: 'text-orange-400',
    dotClass: 'bg-orange-500',
  },
  ready: {
    label: 'Lista para Servir',
    shortLabel: 'Lista',
    colorClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400',
  },
  served: {
    label: 'Servida · Por Cobrar',
    shortLabel: 'Por Cobrar',
    colorClass: 'text-sky-400',
    dotClass: 'bg-sky-400',
  },
  paid: {
    label: 'Pagada',
    shortLabel: 'Pagada',
    colorClass: 'text-stone-300',
    dotClass: 'bg-stone-400',
  },
  cancelled: {
    label: 'Cancelada',
    shortLabel: 'Cancelada',
    colorClass: 'text-red-400',
    dotClass: 'bg-red-500',
  },
};
