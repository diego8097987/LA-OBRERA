import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCancellationAuditSummary,
  buildDailyReportCsv,
  buildPlainTextReceipt,
  calculateCashCutReconciliation,
  calculateCheckoutPayment,
  calculateDinerBreakdowns,
  calculateItemsSubtotal,
  canCancelOrder,
  canTransitionOrderStatus,
  computeDailySalesSummary,
  computeShiftSalesSummary,
  escapeCsvCell,
  formatMXN,
  getKitchenUrgency,
  isValidFirestoreId,
  mergeDailyReportTotals,
  roundMoney,
  validateCancellationReason,
  validateNewMenuItemInput,
  validateNewOrderInput,
} from './posCalculations';
import type { Order, OrderDiner, OrderLineItem } from '../types/pos';

const sampleDiners: OrderDiner[] = [
  { id: 'd1', label: 'Carlos Mendoza', isShared: false },
  { id: 'd2', label: 'Lucía Herrera', isShared: false },
  { id: 'shared-center', label: 'Al Centro / Compartido', isShared: true },
];

const sampleItems: OrderLineItem[] = [
  {
    lineId: 'l1',
    dishId: 'cor-4',
    name: 'Tomahawk',
    categoryId: 'cortes',
    station: 'parrilla',
    unitPrice: 610,
    qty: 1,
    dinerId: 'd1',
    notes: 'Término Medio',
  },
  {
    lineId: 'l2',
    dishId: 'beb-1',
    name: 'Horchata con Nuez',
    categoryId: 'bebidas',
    station: 'barra',
    unitPrice: 45,
    qty: 2,
    dinerId: 'd2',
    notes: '',
  },
  {
    lineId: 'l3',
    dishId: 'ext-5',
    name: 'Queso Fundido Grande',
    categoryId: 'extras',
    station: 'cocina',
    unitPrice: 80,
    qty: 1,
    dinerId: 'shared-center',
    notes: '',
  },
];

test('calculateItemsSubtotal sums unitPrice * qty accurately', () => {
  assert.equal(calculateItemsSubtotal(sampleItems), 780);
});

test('calculateDinerBreakdowns splits Al Centro equally when enabled', () => {
  const split = calculateDinerBreakdowns(sampleDiners, sampleItems, true);
  assert.equal(split[0].ownSubtotal, 610);
  assert.equal(split[0].sharedAllocation, 40);
  assert.equal(split[0].finalTotal, 650);

  assert.equal(split[1].ownSubtotal, 90);
  assert.equal(split[1].sharedAllocation, 40);
  assert.equal(split[1].finalTotal, 130);

  assert.equal(split[2].finalTotal, 0);
});

test('calculateDinerBreakdowns preserves exact total to the penny on 3-way splits', () => {
  const threeDiners: OrderDiner[] = [
    { id: 'p1', label: 'Ana', isShared: false },
    { id: 'p2', label: 'Beto', isShared: false },
    { id: 'p3', label: 'Carla', isShared: false },
    { id: 'shared', label: 'Al Centro', isShared: true },
  ];
  const sharedItem: OrderLineItem[] = [
    {
      lineId: 'ls1',
      dishId: 'ext-10',
      name: 'Papa Especial',
      categoryId: 'extras',
      station: 'parrilla',
      unitPrice: 100,
      qty: 1,
      dinerId: 'shared',
      notes: '',
    },
  ];
  const split = calculateDinerBreakdowns(threeDiners, sharedItem, true);
  const sum = split.reduce((acc, g) => acc + g.finalTotal, 0);
  assert.equal(Math.round(sum * 100), 10000);
  assert.equal(split[0].sharedAllocation, 33.34);
  assert.equal(split[1].sharedAllocation, 33.33);
  assert.equal(split[2].sharedAllocation, 33.33);
});

test('calculateCashCutReconciliation computes Cuadrado, Sobrante, Faltante and validates bounds', () => {
  const exact = calculateCashCutReconciliation({
    openingCash: 1000,
    cashSales: 400,
    countedCash: 1400,
  });
  assert.equal(exact.valid, true);
  assert.equal(exact.expectedCashInDrawer, 1400);
  assert.equal(exact.difference, 0);
  assert.equal(exact.statusLabel, 'Cuadrado');

  const short = calculateCashCutReconciliation({
    openingCash: 500,
    cashSales: 400,
    countedCash: 850,
  });
  assert.equal(short.valid, true);
  assert.equal(short.difference, -50);
  assert.equal(short.statusLabel, 'Faltante');

  const over = calculateCashCutReconciliation({
    openingCash: 500,
    cashSales: 400,
    countedCash: 925,
  });
  assert.equal(over.valid, true);
  assert.equal(over.difference, 25);
  assert.equal(over.statusLabel, 'Sobrante');

  const negative = calculateCashCutReconciliation({
    openingCash: -10,
    cashSales: 400,
    countedCash: 390,
  });
  assert.equal(negative.valid, false);
});

test('calculateCheckoutPayment blocks underpayment and computes exact cash change', () => {
  const underpaid = calculateCheckoutPayment({
    subtotal: 655,
    tip: 0,
    paymentMethod: 'efectivo',
    amountReceivedInput: 500,
  });
  assert.equal(underpaid.valid, false);
  assert.ok(underpaid.error?.includes('menor'));

  const validCash = calculateCheckoutPayment({
    subtotal: 655,
    tip: 45,
    paymentMethod: 'efectivo',
    amountReceivedInput: 1000,
  });
  assert.equal(validCash.valid, true);
  assert.equal(validCash.total, 700);
  assert.equal(validCash.changeGiven, 300);

  const validCard = calculateCheckoutPayment({
    subtotal: 655,
    tip: 65.5,
    paymentMethod: 'tarjeta',
    amountReceivedInput: 0,
  });
  assert.equal(validCard.valid, true);
  assert.equal(validCard.amountReceived, 720.5);
  assert.equal(validCard.changeGiven, 0);
});

test('canTransitionOrderStatus enforces strict RBAC workflow and terminal locking', () => {
  // Kitchen can only do pending -> preparing -> ready
  assert.equal(canTransitionOrderStatus('cocina', 'pending', 'preparing'), true);
  assert.equal(canTransitionOrderStatus('cocina', 'preparing', 'ready'), true);
  assert.equal(canTransitionOrderStatus('cocina', 'pending', 'paid'), false);
  assert.equal(canTransitionOrderStatus('cocina', 'ready', 'paid'), false);

  // Waiter can only do ready -> served
  assert.equal(canTransitionOrderStatus('mesero', 'ready', 'served'), true);
  assert.equal(canTransitionOrderStatus('mesero', 'served', 'paid'), false);

  // Cashier can only collect ready/served -> paid, and NEVER reopen paid
  assert.equal(canTransitionOrderStatus('cajero', 'ready', 'paid'), true);
  assert.equal(canTransitionOrderStatus('cajero', 'served', 'paid'), true);
  assert.equal(canTransitionOrderStatus('cajero', 'pending', 'paid'), false);
  assert.equal(canTransitionOrderStatus('cajero', 'paid', 'pending'), false);

  // Admin can ONLY cancel unpaid active orders (strict role separation: Admin does not cook or charge)
  assert.equal(canTransitionOrderStatus('admin', 'pending', 'cancelled'), true);
  assert.equal(canTransitionOrderStatus('admin', 'preparing', 'cancelled'), true);
  assert.equal(canTransitionOrderStatus('admin', 'pending', 'preparing'), false);
  assert.equal(canTransitionOrderStatus('admin', 'ready', 'paid'), false);
  assert.equal(canTransitionOrderStatus('admin', 'paid', 'cancelled'), false);
});

test('validateNewMenuItemInput validates dish name, price bounds, category, and station', () => {
  assert.equal(
    validateNewMenuItemInput({
      name: 'Tacos de Rib Eye',
      price: 185,
      categoryId: 'individual',
      station: 'parrilla',
      desc: '3 piezas con guacamole',
    }),
    null
  );
  assert.ok(
    validateNewMenuItemInput({
      name: 'A',
      price: 100,
      categoryId: 'individual',
      station: 'parrilla',
      desc: '',
    }) !== null
  );
  assert.ok(
    validateNewMenuItemInput({
      name: 'Corte Gratis',
      price: 0,
      categoryId: 'cortes',
      station: 'parrilla',
      desc: '',
    }) !== null
  );
});

test('computeDailySalesSummary aggregates revenue, tips, payment methods, and top dishes', () => {
  const orders: Order[] = [
    {
      id: 'o1',
      folio: 'OBR-1001',
      serviceType: 'Mesa 1',
      status: 'paid',
      dateKey: '2026-11-26',
      waiterUid: 'w1',
      waiterName: 'Sofía',
      diners: sampleDiners,
      items: sampleItems,
      splitSharedEqually: true,
      subtotal: 780,
      tip: 70,
      total: 850,
      paymentMethod: 'efectivo',
      amountReceived: 900,
      changeGiven: 50,
      hasDeliveryInfo: false,
      orderNotes: '',
      createdAtMs: 1000,
      updatedAtMs: 2000,
      paidAtMs: 2000,
    },
    {
      id: 'o2',
      folio: 'OBR-1002',
      serviceType: 'Mesa 2',
      status: 'paid',
      dateKey: '2026-11-26',
      waiterUid: 'w1',
      waiterName: 'Sofía',
      diners: [sampleDiners[0]],
      items: [sampleItems[1]],
      splitSharedEqually: false,
      subtotal: 90,
      tip: 10,
      total: 100,
      paymentMethod: 'tarjeta',
      amountReceived: 100,
      changeGiven: 0,
      hasDeliveryInfo: false,
      orderNotes: '',
      createdAtMs: 1500,
      updatedAtMs: 2500,
      paidAtMs: 2500,
    },
    {
      id: 'o3',
      folio: 'OBR-1003',
      serviceType: 'Mesa 3',
      status: 'preparing',
      dateKey: '2026-11-26',
      waiterUid: 'w1',
      waiterName: 'Sofía',
      diners: [sampleDiners[0]],
      items: [sampleItems[0]],
      splitSharedEqually: false,
      subtotal: 610,
      tip: 0,
      total: 610,
      paymentMethod: 'none',
      amountReceived: 0,
      changeGiven: 0,
      hasDeliveryInfo: false,
      orderNotes: '',
      createdAtMs: 3000,
      updatedAtMs: 3000,
    },
  ];

  const summary = computeDailySalesSummary(orders, '2026-11-26');
  assert.equal(summary.paidOrderCount, 2);
  assert.equal(summary.activeOrderCount, 1);
  assert.equal(summary.totalRevenue, 950);
  assert.equal(summary.totalTips, 80);
  assert.equal(summary.cashTotal, 850);
  assert.equal(summary.cardTotal, 100);
  assert.equal(summary.averageTicket, 475);
  assert.equal(summary.topDishes[0].name, 'Tomahawk');
});

test('escapeCsvCell neutralizes CSV formula injection attacks', () => {
  assert.equal(escapeCsvCell('=HYPERLINK("http://evil.com")'), `"'=HYPERLINK(""http://evil.com"")"`);
  assert.equal(escapeCsvCell('+1+1'), `"'+1+1"`);
  assert.equal(escapeCsvCell('-cmd'), `"'-cmd"`);
  assert.equal(escapeCsvCell('@SUM(A1:A2)'), `"'@SUM(A1:A2)"`);
  assert.equal(escapeCsvCell('Rib-Eye'), `"Rib-Eye"`);
});

test('buildDailyReportCsv outputs sanitized CSV lines', () => {
  const csv = buildDailyReportCsv(
    [
      {
        id: 'o1',
        folio: 'OBR-1001',
        serviceType: 'Mesa 1',
        status: 'paid',
        dateKey: '2026-11-26',
        waiterUid: 'w1',
        waiterName: '=EVIL()',
        diners: [sampleDiners[0]],
        items: [sampleItems[0]],
        splitSharedEqually: false,
        subtotal: 610,
        tip: 0,
        total: 610,
        paymentMethod: 'efectivo',
        amountReceived: 700,
        changeGiven: 90,
        hasDeliveryInfo: false,
        orderNotes: '',
        createdAtMs: 1000,
        updatedAtMs: 2000,
        paidAtMs: 2000,
      },
    ],
    '2026-11-26'
  );
  assert.ok(csv.includes(`"'=EVIL()"`));
  assert.ok(csv.includes(`"OBR-1001"`));
});

test('buildPlainTextReceipt formats full and individual tickets cleanly', () => {
  const order: Order = {
    id: 'o1',
    folio: 'OBR-2026',
    serviceType: 'Mesa 3',
    status: 'paid',
    dateKey: '2026-11-26',
    waiterUid: 'w1',
    waiterName: 'Sofía Ramírez',
    diners: sampleDiners,
    items: sampleItems,
    splitSharedEqually: true,
    subtotal: 780,
    tip: 20,
    total: 800,
    paymentMethod: 'efectivo',
    amountReceived: 1000,
    changeGiven: 200,
    hasDeliveryInfo: false,
    orderNotes: '',
    createdAtMs: 1700000000000,
    updatedAtMs: 1700000500000,
    paidAtMs: 1700000500000,
  };

  const fullTicket = buildPlainTextReceipt(order);
  assert.ok(fullTicket.includes('LA OBRERA GRILL ASADERO'));
  assert.ok(fullTicket.includes('OBR-2026'));
  assert.ok(fullTicket.includes('Cambio:'));

  const personTicket = buildPlainTextReceipt(order, 'd1');
  assert.ok(personTicket.includes('CUENTA INDIVIDUAL: CARLOS MENDOZA'));
  assert.ok(personTicket.includes('Tomahawk'));
});

test('validateNewOrderInput rejects missing delivery fields and invalid Firestore IDs', () => {
  const err = validateNewOrderInput({
    serviceType: 'Servicio a Domicilio',
    diners: [sampleDiners[0]],
    items: [sampleItems[0]],
    customerName: 'Juan',
    phone: '123',
    street: '',
    colony: '',
    reference: '',
  });
  assert.ok(err !== null);

  assert.equal(isValidFirestoreId('ord-12345_abc'), true);
  assert.equal(isValidFirestoreId('../../etc/passwd'), false);
  assert.equal(isValidFirestoreId('a'.repeat(129)), false);
});

test('getKitchenUrgency classifies elapsed prep times accurately', () => {
  const now = 100000000;
  assert.equal(getKitchenUrgency(now - 5 * 60 * 1000, now).level, 'normal');
  assert.equal(getKitchenUrgency(now - 14 * 60 * 1000, now).level, 'warning');
  assert.equal(getKitchenUrgency(now - 25 * 60 * 1000, now).level, 'urgent');
});

test('roundMoney rounds symmetrically for negative numbers and avoids negative zero', () => {
  assert.equal(roundMoney(12.345), 12.35);
  assert.equal(roundMoney(-12.345), -12.35);
  assert.equal(Object.is(roundMoney(-0.001), 0), true);
  assert.equal(Object.is(roundMoney(-0), 0), true);
});

test('formatMXN places minus sign before currency symbol for negative values', () => {
  assert.equal(formatMXN(50), '$50.00');
  assert.equal(formatMXN(-50), '-$50.00');
  assert.equal(formatMXN(-0.001), '$0.00');
});

test('validateNewOrderInput enforces Firestore upper bounds and integer quantities', () => {
  const nonIntQty = validateNewOrderInput({
    serviceType: 'Mesa 1',
    diners: [sampleDiners[0]],
    items: [{ ...sampleItems[0], qty: 1.5 }],
    customerName: '',
    phone: '',
    street: '',
    colony: '',
    reference: '',
  });
  assert.ok(nonIntQty !== null);

  const hugeSubtotal = validateNewOrderInput({
    serviceType: 'Mesa 1',
    diners: [sampleDiners[0]],
    items: [{ ...sampleItems[0], unitPrice: 10000, qty: 30 }],
    customerName: '',
    phone: '',
    street: '',
    colony: '',
    reference: '',
  });
  assert.ok(hugeSubtotal !== null);
});

test('canCancelOrder strictly allows ONLY Admin to cancel unpaid active waiter orders', () => {
  // Admin CAN cancel any active unpaid order placed through waiters
  assert.equal(canCancelOrder('admin', 'pending'), true);
  assert.equal(canCancelOrder('admin', 'preparing'), true);
  assert.equal(canCancelOrder('admin', 'ready'), true);
  assert.equal(canCancelOrder('admin', 'served'), true);
  // Admin CANNOT cancel already paid or already cancelled orders
  assert.equal(canCancelOrder('admin', 'paid'), false);
  assert.equal(canCancelOrder('admin', 'cancelled'), false);

  // Mesero, Cocina, Cajero, pending, and null can NEVER cancel any order
  for (const role of ['mesero', 'cocina', 'cajero', 'pending', null, undefined] as const) {
    for (const status of ['pending', 'preparing', 'ready', 'served', 'paid', 'cancelled'] as const) {
      assert.equal(canCancelOrder(role, status), false);
    }
  }
});

test('validateCancellationReason and buildCancellationAuditSummary enforce audit bounds', () => {
  assert.equal(validateCancellationReason('  ').valid, false);
  assert.equal(validateCancellationReason('no').valid, false);
  const ok = validateCancellationReason('Cliente canceló el pedido');
  assert.equal(ok.valid, true);
  assert.equal(ok.reason, 'Cliente canceló el pedido');

  const summary = buildCancellationAuditSummary({
    adminName: 'Admin General',
    folio: 'OBR-554433',
    serviceType: 'Mesa 4',
    waiterName: 'Carlos Mesero',
    total: 780,
    reason: 'Cliente canceló el pedido porque cambió de mesa y pidió otra cosa muy larga '.repeat(4),
  });
  assert.ok(summary.length >= 3 && summary.length <= 200);
  assert.ok(summary.includes('OBR-554433'));
  assert.ok(summary.includes('Carlos Mesero'));
});

test('computeShiftSalesSummary captures open-shift orders across calendar dates before cash close', () => {
  const crossMidnightOrders: Order[] = [
    {
      id: 'o1',
      folio: 'OBR-3001',
      serviceType: 'Mesa 1',
      status: 'paid',
      dateKey: '2026-11-26',
      waiterUid: 'w1',
      waiterName: 'Ana',
      diners: [sampleDiners[0]],
      items: [sampleItems[0]],
      splitSharedEqually: false,
      subtotal: 610,
      tip: 40,
      total: 650,
      paymentMethod: 'efectivo',
      amountReceived: 700,
      changeGiven: 50,
      hasDeliveryInfo: false,
      orderNotes: '',
      createdAtMs: 1000,
      updatedAtMs: 2000,
      paidAtMs: 2000,
    },
    {
      id: 'o2',
      folio: 'OBR-3002',
      serviceType: 'Mesa 2',
      status: 'paid',
      dateKey: '2026-11-27',
      waiterUid: 'w1',
      waiterName: 'Ana',
      diners: [sampleDiners[0]],
      items: [sampleItems[1]],
      splitSharedEqually: false,
      subtotal: 90,
      tip: 10,
      total: 100,
      paymentMethod: 'tarjeta',
      amountReceived: 100,
      changeGiven: 0,
      hasDeliveryInfo: false,
      orderNotes: '',
      createdAtMs: 3000,
      updatedAtMs: 4000,
      paidAtMs: 4000,
    },
  ];
  const shiftSummary = computeShiftSalesSummary(crossMidnightOrders, '2026-11-26');
  assert.equal(shiftSummary.paidOrderCount, 2);
  assert.equal(shiftSummary.totalRevenue, 750);
  assert.equal(shiftSummary.cashTotal, 650);
  assert.equal(shiftSummary.cardTotal, 100);
});

test('mergeDailyReportTotals preserves multi-shift daily sales and satisfies Firestore reconciliation invariant', () => {
  const merged = mergeDailyReportTotals(
    {
      totalSales: 1500,
      totalTips: 100,
      orderCount: 4,
      cancelledCount: 1,
      cashTotal: 1000,
      cardTotal: 500,
      transferTotal: 0,
      openingCash: 500,
      countedCash: 1500,
    },
    {
      totalSales: 2000,
      totalTips: 150,
      orderCount: 6,
      cancelledCount: 0,
      cashTotal: 1200,
      cardTotal: 500,
      transferTotal: 300,
      openingCash: 500,
      countedCash: 1680,
    }
  );
  assert.equal(merged.totalSales, 3500);
  assert.equal(merged.orderCount, 10);
  assert.equal(merged.cancelledCount, 1);
  assert.equal(merged.cashTotal, 2200);
  assert.equal(merged.openingCash, 1000);
  assert.equal(merged.countedCash, 3180);
  assert.equal(merged.cashDifference, -20);
  // Firestore invariant check: abs(cashDifference - (countedCash - (openingCash + cashTotal))) <= 0.01
  assert.ok(
    Math.abs(merged.cashDifference - (merged.countedCash - (merged.openingCash + merged.cashTotal))) <= 0.01
  );
});
