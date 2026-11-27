import { jsPDF } from 'jspdf';
import { MENU_CATEGORIES } from '../data/menuCatalog';
import type { DailyReport, Order } from '../types/pos';
import {
  calculateDinerBreakdowns,
  computeDailySalesSummary,
  formatMXN,
  roundMoney,
} from './posCalculations';

function sanitizeFileSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Generates and downloads an 80mm thermal-receipt style PDF for a full table order
 * or an individual diner split account. Uses pure jsPDF vector text (zero HTML rendering).
 */
export function downloadOrderTicketPdf(order: Order, dinerId?: string): string {
  const breakdowns = calculateDinerBreakdowns(
    order.diners,
    order.items,
    order.splitSharedEqually
  );
  const selectedBreakdown = dinerId
    ? breakdowns.find((b) => b.diner.id === dinerId) || null
    : null;

  const dateStr = new Date(order.paidAtMs || order.createdAtMs).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  // Pre-calculate needed page height so the 80mm thermal PDF never clips
  const itemCount = selectedBreakdown
    ? selectedBreakdown.items.length
    : order.items.length;
  const groupCount = selectedBreakdown
    ? 1
    : breakdowns.filter((g) => g.items.length > 0 || g.sharedAllocation > 0).length;
  const deliveryExtra = order.hasDeliveryInfo && order.privateCustomer?.street ? 22 : 0;
  const estimatedHeight = Math.max(135, 92 + itemCount * 9 + groupCount * 9 + deliveryExtra);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, estimatedHeight],
  });

  const left = 5;
  const right = 75;
  const center = 40;
  let y = 9;

  const drawDashedLine = () => {
    pdf.setDrawColor(130, 130, 130);
    pdf.setLineWidth(0.2);
    for (let x = left; x < right; x += 2.2) {
      pdf.line(x, y, Math.min(x + 1.2, right), y);
    }
    y += 4;
  };

  const drawKeyValue = (label: string, val: string, bold = false, size = 8.5) => {
    pdf.setFont('courier', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.text(label, left, y);
    pdf.text(val, right, y, { align: 'right' });
    y += size >= 10 ? 5.2 : 4.2;
  };

  // Header
  pdf.setTextColor(20, 20, 20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('LA OBRERA GRILL ASADERO', center, y, { align: 'center' });
  y += 4.5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('Sabor, Fuego y Pasión · Desde 1996', center, y, { align: 'center' });
  y += 4.5;

  pdf.setFont('courier', 'bold');
  pdf.setFontSize(8.5);
  pdf.text(`Folio: ${order.folio} · ${order.serviceType}`, center, y, { align: 'center' });
  y += 4;

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7.5);
  pdf.text(dateStr, center, y, { align: 'center' });
  y += 4;

  drawDashedLine();

  // Metadata
  drawKeyValue('Atendió:', order.waiterName.slice(0, 26));
  if (order.privateCustomer?.customerName) {
    drawKeyValue('Cliente:', order.privateCustomer.customerName.slice(0, 26));
  }
  if (order.privateCustomer?.phone) {
    drawKeyValue('Teléfono:', order.privateCustomer.phone.slice(0, 26));
  }
  if (order.hasDeliveryInfo && order.privateCustomer?.street) {
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(7.5);
    const addrLines = pdf.splitTextToSize(
      `Entrega: ${order.privateCustomer.street}, Col. ${order.privateCustomer.colony}`,
      right - left
    ) as string[];
    pdf.text(addrLines, left, y);
    y += addrLines.length * 3.6 + 1;
    if (order.privateCustomer.reference) {
      const refLines = pdf.splitTextToSize(
        `Ref: ${order.privateCustomer.reference}`,
        right - left
      ) as string[];
      pdf.text(refLines, left, y);
      y += refLines.length * 3.6 + 1;
    }
  }

  drawDashedLine();

  if (selectedBreakdown) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text(`CUENTA INDIVIDUAL: ${selectedBreakdown.diner.label.toUpperCase()}`, left, y);
    y += 4.5;

    for (const item of selectedBreakdown.items) {
      const priceText = formatMXN(item.unitPrice * item.qty);
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(8);
      const itemLabel = `${item.qty}x ${item.name}`;
      const wrapped = pdf.splitTextToSize(itemLabel, 48) as string[];
      pdf.text(wrapped[0], left, y);
      pdf.text(priceText, right, y, { align: 'right' });
      y += 4;
      for (let i = 1; i < wrapped.length; i += 1) {
        pdf.text(wrapped[i], left + 2, y);
        y += 3.6;
      }
      if (item.notes) {
        pdf.setFontSize(7);
        pdf.text(`  (${item.notes.slice(0, 34)})`, left, y);
        y += 3.5;
      }
    }

    if (selectedBreakdown.sharedAllocation > 0) {
      drawKeyValue('+ Parte Al Centro', formatMXN(selectedBreakdown.sharedAllocation), false, 8);
    }

    y += 1;
    drawDashedLine();
    drawKeyValue('TOTAL PERSONA MXN', formatMXN(selectedBreakdown.finalTotal), true, 10);
  } else {
    for (const group of breakdowns) {
      if (group.items.length === 0 && group.sharedAllocation === 0) continue;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(group.diner.label.toUpperCase(), left, y);
      y += 4;

      for (const item of group.items) {
        const priceText = formatMXN(item.unitPrice * item.qty);
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(8);
        const itemLabel = `${item.qty}x ${item.name}`;
        const wrapped = pdf.splitTextToSize(itemLabel, 48) as string[];
        pdf.text(wrapped[0], left, y);
        pdf.text(priceText, right, y, { align: 'right' });
        y += 4;
        for (let i = 1; i < wrapped.length; i += 1) {
          pdf.text(wrapped[i], left + 2, y);
          y += 3.6;
        }
        if (item.notes) {
          pdf.setFontSize(7);
          pdf.text(`  (${item.notes.slice(0, 34)})`, left, y);
          y += 3.4;
        }
      }

      if (group.sharedAllocation > 0) {
        drawKeyValue('  + Parte Al Centro', formatMXN(group.sharedAllocation), false, 7.5);
      }
      y += 1;
    }

    drawDashedLine();
    drawKeyValue('Subtotal', formatMXN(order.subtotal), false, 8.5);
    if (order.tip > 0) {
      drawKeyValue('Propina', formatMXN(order.tip), false, 8.5);
    }
    drawKeyValue('TOTAL MXN', formatMXN(order.total), true, 10.5);

    if (order.status === 'paid') {
      y += 1;
      drawDashedLine();
      drawKeyValue('Estado', 'PAGADO', true, 8);
      drawKeyValue('Método de pago', order.paymentMethod.toUpperCase(), false, 8);
      drawKeyValue('Recibido', formatMXN(order.amountReceived), false, 8);
      if (order.paymentMethod === 'efectivo') {
        drawKeyValue('Cambio entregado', formatMXN(order.changeGiven), true, 8.5);
      }
    } else {
      y += 1;
      drawKeyValue('Estado', 'PRE-CUENTA', true, 8);
    }
  }

  y += 2;
  drawDashedLine();
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.text('¡Gracias por su visita!', center, y, { align: 'center' });
  y += 3.6;
  pdf.text('@asadero_la_obrera', center, y, { align: 'center' });

  const suffix = selectedBreakdown ? `-${sanitizeFileSlug(selectedBreakdown.diner.label)}` : '';
  const filename = `ticket-${order.folio}${suffix}.pdf`;
  pdf.save(filename);
  return filename;
}

/**
 * Generates and downloads a formal A4 Cash Register Cut (Corte de Caja) PDF
 * executed by the Cashier role.
 */
export function downloadCashCutPdf(params: {
  report: DailyReport;
  orders: Order[];
}): string {
  const { report, orders } = params;
  const dayPaidOrders = orders
    .filter((o) => o.dateKey === report.dateKey && o.status === 'paid')
    .sort((a, b) => (a.paidAtMs || a.updatedAtMs) - (b.paidAtMs || b.updatedAtMs));

  const summary = computeDailySalesSummary(orders, report.dateKey);
  const expectedCash = roundMoney(report.openingCash + report.cashTotal);
  const diffLabel =
    Math.abs(report.cashDifference) < 0.005
      ? 'CUADRADO ($0.00)'
      : report.cashDifference > 0
        ? `SOBRANTE (+${formatMXN(report.cashDifference)})`
        : `FALTANTE (-${formatMXN(Math.abs(report.cashDifference))})`;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 16;
  const pageWidth = 210;
  const contentRight = pageWidth - margin;
  let y = 18;

  // Brand Header Band
  pdf.setFillColor(24, 20, 18);
  pdf.rect(0, 0, pageWidth, 34, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('LA OBRERA GRILL ASADERO', margin, 15);

  pdf.setTextColor(245, 158, 11);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text('CIERRE Y CORTE DE CAJA OFICIAL · EXCLUSIVO DE ADMINISTRADOR', margin, 22);

  pdf.setTextColor(214, 211, 209);
  pdf.setFontSize(8.5);
  const emittedAt = new Date(report.updatedAtMs || Date.now()).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  pdf.text(`Fecha de corte: ${report.dateKey}   |   Emitido: ${emittedAt}`, margin, 29);

  y = 44;

  // Cashier & Summary Metadata
  pdf.setTextColor(30, 30, 30);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('1. Datos del Responsable y Resumen Operativo', margin, y);
  y += 6;

  pdf.setDrawColor(220, 220, 220);
  pdf.setFillColor(248, 247, 245);
  pdf.roundedRect(margin, y, contentRight - margin, 24, 2, 2, 'FD');

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text(`Administrador Responsable: ${report.generatedByName}`, margin + 4, y + 7);
  pdf.text(`Fecha Operativa: ${report.dateKey}`, margin + 108, y + 7);
  pdf.text(`Órdenes Pagadas: ${report.orderCount}`, margin + 4, y + 14);
  pdf.text(`Órdenes Canceladas: ${report.cancelledCount}`, margin + 62, y + 14);
  pdf.text(`Ticket Promedio: ${formatMXN(summary.averageTicket)}`, margin + 122, y + 14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Total Cobrado del Día: ${formatMXN(report.totalSales)}`, margin + 4, y + 20.5);
  pdf.text(`Propinas Recibidas: ${formatMXN(report.totalTips)}`, margin + 108, y + 20.5);

  y += 32;

  // Payment Breakdown + Drawer Reconciliation
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('2. Arqueo de Efectivo y Desglose por Método de Pago', margin, y);
  y += 6;

  const drawSummaryRow = (label: string, val: string, highlight = false) => {
    if (highlight) {
      pdf.setFillColor(254, 243, 199);
      pdf.rect(margin, y - 4.2, contentRight - margin, 6.5, 'F');
    }
    pdf.setFont('helvetica', highlight ? 'bold' : 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(25, 25, 25);
    pdf.text(label, margin + 3, y);
    pdf.text(val, contentRight - 3, y, { align: 'right' });
    pdf.setDrawColor(232, 232, 232);
    pdf.line(margin, y + 2.2, contentRight, y + 2.2);
    y += 7;
  };

  drawSummaryRow('Fondo Inicial de Caja', formatMXN(report.openingCash));
  drawSummaryRow('Ventas Cobradas en Efectivo', formatMXN(report.cashTotal));
  drawSummaryRow('Efectivo Esperado en Caja (Fondo + Ventas Efectivo)', formatMXN(expectedCash), true);
  drawSummaryRow('Efectivo Físico Contado en Caja', formatMXN(report.countedCash));
  drawSummaryRow('Resultado de Arqueo (Diferencia)', diffLabel, true);
  drawSummaryRow('Ventas Cobradas con Tarjeta', formatMXN(report.cardTotal));
  drawSummaryRow('Ventas Cobradas por Transferencia', formatMXN(report.transferTotal));
  drawSummaryRow('Propinas Registradas', formatMXN(report.totalTips));
  drawSummaryRow('TOTAL GENERAL DE VENTAS COBRADAS (MXN)', formatMXN(report.totalSales), true);

  y += 6;

  // Paid Orders Detail Table
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(30, 30, 30);
  pdf.text(`3. Detalle de Tickets Cobrados (${dayPaidOrders.length})`, margin, y);
  y += 6;

  const drawTableHeader = () => {
    pdf.setFillColor(38, 34, 32);
    pdf.rect(margin, y - 4.5, contentRight - margin, 6.8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text('Folio', margin + 2, y);
    pdf.text('Mesa / Servicio', margin + 28, y);
    pdf.text('Hora', margin + 74, y);
    pdf.text('Método', margin + 94, y);
    pdf.text('Subtotal', margin + 132, y, { align: 'right' });
    pdf.text('Propina', margin + 154, y, { align: 'right' });
    pdf.text('Total', contentRight - 2, y, { align: 'right' });
    y += 6;
  };

  if (dayPaidOrders.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(110, 110, 110);
    pdf.text('No se registraron órdenes pagadas en esta fecha.', margin, y);
    y += 10;
  } else {
    drawTableHeader();
    pdf.setTextColor(30, 30, 30);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);

    for (const ord of dayPaidOrders) {
      if (y > 262) {
        pdf.addPage();
        y = 20;
        drawTableHeader();
        pdf.setTextColor(30, 30, 30);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
      }

      const timeStr = new Date(ord.paidAtMs || ord.updatedAtMs).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      });

      pdf.text(ord.folio, margin + 2, y);
      pdf.text(ord.serviceType.slice(0, 22), margin + 28, y);
      pdf.text(timeStr, margin + 74, y);
      pdf.text(ord.paymentMethod.toUpperCase(), margin + 94, y);
      pdf.text(formatMXN(ord.subtotal), margin + 132, y, { align: 'right' });
      pdf.text(formatMXN(ord.tip), margin + 154, y, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.text(formatMXN(ord.total), contentRight - 2, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');

      pdf.setDrawColor(238, 238, 238);
      pdf.line(margin, y + 2, contentRight, y + 2);
      y += 6.2;
    }
  }

  // Signature Footer
  if (y > 250) {
    pdf.addPage();
    y = 30;
  } else {
    y = Math.max(y + 18, 248);
  }

  pdf.setDrawColor(120, 120, 120);
  pdf.line(margin + 8, y, margin + 74, y);
  pdf.line(contentRight - 74, y, contentRight - 8, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(60, 60, 60);
  pdf.text(`Firma Administrador (${report.generatedByName})`, margin + 41, y + 5, {
    align: 'center',
  });
  pdf.text('Vo. Bo. Entrega de Caja / Cajero', contentRight - 41, y + 5, {
    align: 'center',
  });

  const filename = `corte-caja-${report.dateKey}-la-obrera.pdf`;
  pdf.save(filename);
  return filename;
}

/**
 * Generates and downloads an executive A4 Daily Sales Report (Reporte Diario de Ventas) PDF
 * for any selected date. Uses pure jsPDF vector text (zero HTML injection).
 */
export function downloadDailySalesReportPdf(params: {
  orders: Order[];
  dateKey: string;
  generatedByName: string;
}): string {
  const { orders, dateKey, generatedByName } = params;
  const summary = computeDailySalesSummary(orders, dateKey);
  const dayPaidOrders = orders
    .filter((o) => o.dateKey === dateKey && o.status === 'paid')
    .sort((a, b) => (a.paidAtMs || a.updatedAtMs) - (b.paidAtMs || b.updatedAtMs));

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 16;
  const pageWidth = 210;
  const contentRight = pageWidth - margin;
  let y = 18;

  const ensurePageSpace = (neededMm: number) => {
    if (y + neededMm > 276) {
      pdf.addPage();
      y = 20;
    }
  };

  // Brand Header Band
  pdf.setFillColor(24, 20, 18);
  pdf.rect(0, 0, pageWidth, 34, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('LA OBRERA GRILL ASADERO', margin, 15);

  pdf.setTextColor(245, 158, 11);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text('REPORTE DIARIO DE VENTAS · EXCLUSIVO DE ADMINISTRADOR', margin, 22);

  pdf.setTextColor(214, 211, 209);
  pdf.setFontSize(8.5);
  const emittedAt = new Date().toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  pdf.text(
    `Fecha del reporte: ${dateKey}   |   Emitido: ${emittedAt}   |   Admin: ${generatedByName.slice(0, 28)}`,
    margin,
    29
  );

  y = 44;

  // Section 1: Executive Sales Summary
  pdf.setTextColor(30, 30, 30);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('1. Resumen Ejecutivo de Ventas', margin, y);
  y += 6;

  pdf.setDrawColor(220, 220, 220);
  pdf.setFillColor(248, 247, 245);
  pdf.roundedRect(margin, y, contentRight - margin, 28, 2, 2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(20, 20, 20);
  pdf.text(`Ventas Cobradas: ${formatMXN(summary.totalRevenue)}`, margin + 4, y + 7.5);
  pdf.text(`Propinas: ${formatMXN(summary.totalTips)}`, margin + 96, y + 7.5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Órdenes Pagadas: ${summary.paidOrderCount}`, margin + 4, y + 15);
  pdf.text(`Órdenes Canceladas: ${summary.cancelledOrderCount}`, margin + 62, y + 15);
  pdf.text(`Ticket Promedio: ${formatMXN(summary.averageTicket)}`, margin + 122, y + 15);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(55, 55, 55);
  pdf.text(`Efectivo: ${formatMXN(summary.cashTotal)}`, margin + 4, y + 22.5);
  pdf.text(`Tarjeta: ${formatMXN(summary.cardTotal)}`, margin + 62, y + 22.5);
  pdf.text(`Transferencia: ${formatMXN(summary.transferTotal)}`, margin + 122, y + 22.5);

  y += 36;

  // Section 2: Sales by Category
  ensurePageSpace(28);
  pdf.setTextColor(30, 30, 30);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('2. Ventas por Categoría', margin, y);
  y += 6;

  if (summary.categoryTotals.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(110, 110, 110);
    pdf.text(`Sin ventas cobradas registradas en ${dateKey}.`, margin, y);
    y += 10;
  } else {
    pdf.setFillColor(38, 34, 32);
    pdf.rect(margin, y - 4.5, contentRight - margin, 6.8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text('Categoría', margin + 2, y);
    pdf.text('Unidades', margin + 106, y, { align: 'right' });
    pdf.text('% Ventas', margin + 138, y, { align: 'right' });
    pdf.text('Ingreso MXN', contentRight - 2, y, { align: 'right' });
    y += 6;

    const totalCategoryRev = summary.categoryTotals.reduce((acc, c) => acc + c.revenue, 0);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);

    for (const cat of summary.categoryTotals) {
      ensurePageSpace(8);
      const catMeta = MENU_CATEGORIES.find((c) => c.id === cat.categoryId);
      const pct = totalCategoryRev > 0 ? ((cat.revenue / totalCategoryRev) * 100).toFixed(1) : '0.0';

      pdf.text((catMeta?.title || cat.categoryId).slice(0, 42), margin + 2, y);
      pdf.text(String(cat.qty), margin + 106, y, { align: 'right' });
      pdf.text(`${pct}%`, margin + 138, y, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.text(formatMXN(cat.revenue), contentRight - 2, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');

      pdf.setDrawColor(238, 238, 238);
      pdf.line(margin, y + 2, contentRight, y + 2);
      y += 6.2;
    }
    y += 4;
  }

  // Section 3: Top Selling Dishes
  ensurePageSpace(28);
  pdf.setTextColor(30, 30, 30);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('3. Platillos Más Vendidos', margin, y);
  y += 6;

  if (summary.topDishes.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(110, 110, 110);
    pdf.text('Aún no hay platillos cobrados en esta fecha.', margin, y);
    y += 10;
  } else {
    pdf.setFillColor(38, 34, 32);
    pdf.rect(margin, y - 4.5, contentRight - margin, 6.8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text('#', margin + 2, y);
    pdf.text('Platillo', margin + 12, y);
    pdf.text('Cantidad', margin + 134, y, { align: 'right' });
    pdf.text('Ingreso MXN', contentRight - 2, y, { align: 'right' });
    y += 6;

    pdf.setTextColor(30, 30, 30);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);

    summary.topDishes.forEach((dish, idx) => {
      ensurePageSpace(8);
      pdf.text(String(idx + 1), margin + 2, y);
      pdf.text(dish.name.slice(0, 52), margin + 12, y);
      pdf.text(String(dish.qty), margin + 134, y, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.text(formatMXN(dish.revenue), contentRight - 2, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');

      pdf.setDrawColor(238, 238, 238);
      pdf.line(margin, y + 2, contentRight, y + 2);
      y += 6.2;
    });
    y += 4;
  }

  // Section 4: Paid Orders Ledger
  ensurePageSpace(28);
  pdf.setTextColor(30, 30, 30);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(`4. Detalle de Órdenes Cobradas (${dayPaidOrders.length})`, margin, y);
  y += 6;

  const drawOrdersHeader = () => {
    pdf.setFillColor(38, 34, 32);
    pdf.rect(margin, y - 4.5, contentRight - margin, 6.8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('Folio', margin + 2, y);
    pdf.text('Mesa / Servicio', margin + 26, y);
    pdf.text('Mesero', margin + 62, y);
    pdf.text('Hora', margin + 94, y);
    pdf.text('Método', margin + 110, y);
    pdf.text('Subtotal', margin + 142, y, { align: 'right' });
    pdf.text('Propina', margin + 160, y, { align: 'right' });
    pdf.text('Total', contentRight - 2, y, { align: 'right' });
    y += 6;
  };

  if (dayPaidOrders.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(110, 110, 110);
    pdf.text('No se registraron órdenes cobradas en esta fecha.', margin, y);
    y += 10;
  } else {
    drawOrdersHeader();
    pdf.setTextColor(30, 30, 30);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);

    for (const ord of dayPaidOrders) {
      if (y > 272) {
        pdf.addPage();
        y = 20;
        drawOrdersHeader();
        pdf.setTextColor(30, 30, 30);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
      }

      const timeStr = new Date(ord.paidAtMs || ord.updatedAtMs).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      });

      pdf.text(ord.folio, margin + 2, y);
      pdf.text(ord.serviceType.slice(0, 18), margin + 26, y);
      pdf.text(ord.waiterName.slice(0, 16), margin + 62, y);
      pdf.text(timeStr, margin + 94, y);
      pdf.text(ord.paymentMethod.toUpperCase().slice(0, 8), margin + 110, y);
      pdf.text(formatMXN(ord.subtotal), margin + 142, y, { align: 'right' });
      pdf.text(formatMXN(ord.tip), margin + 160, y, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.text(formatMXN(ord.total), contentRight - 2, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');

      pdf.setDrawColor(238, 238, 238);
      pdf.line(margin, y + 2, contentRight, y + 2);
      y += 6;
    }
  }

  // Footer note on final page
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    'LA OBRERA Grill Asadero · Documento generado automáticamente desde el Panel Administrador.',
    pageWidth / 2,
    289,
    { align: 'center' }
  );

  const safeDate = sanitizeFileSlug(dateKey) || 'dia';
  const filename = `reporte-ventas-${safeDate}-la-obrera.pdf`;
  pdf.save(filename);
  return filename;
}
