import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  Receipt,
  Unlock,
  Wallet,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import { extractFriendlyErrorMessage } from '../firebase';
import { useTodayDateKey } from '../hooks/useTodayDateKey';
import type { Order, PaymentMethod } from '../types/pos';
import {
  calculateCheckoutPayment,
  calculateDinerBreakdowns,
  formatMXN,
  ORDER_STATUS_META,
  roundMoney,
} from '../utils/posCalculations';
import { TicketModal } from './TicketModal';

export const CashierView: React.FC = () => {
  const {
    orders,
    cashRegister,
    processOrderPayment,
    loadOrderPrivateCustomer,
  } = usePos();

  const todayKey = useTodayDateKey();
  const isRegisterOpen = Boolean(cashRegister?.isOpen);

  const payableOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'served' || o.status === 'ready')
        .sort((a, b) => a.createdAtMs - b.createdAtMs),
    [orders]
  );

  // Real-time orders currently being prepared so Cashier sees live totals owed by customers
  const inProgressOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'pending' || o.status === 'preparing')
        .sort((a, b) => a.createdAtMs - b.createdAtMs),
    [orders]
  );

  const paidTodayOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'paid' && o.dateKey === todayKey)
        .sort((a, b) => (b.paidAtMs || b.updatedAtMs) - (a.paidAtMs || a.updatedAtMs)),
    [orders, todayKey]
  );

  const payableTotalAmount = useMemo(
    () => roundMoney(payableOrders.reduce((acc, o) => acc + o.subtotal, 0)),
    [payableOrders]
  );

  const inProgressTotalAmount = useMemo(
    () => roundMoney(inProgressOrders.reduce((acc, o) => acc + o.subtotal, 0)),
    [inProgressOrders]
  );

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [tipInput, setTipInput] = useState<string>('0');
  const [amountReceivedInput, setAmountReceivedInput] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [ticketOrder, setTicketOrder] = useState<Order | null>(null);

  const selectedOrder = useMemo(
    () => payableOrders.find((o) => o.id === selectedOrderId) || payableOrders[0] || null,
    [payableOrders, selectedOrderId]
  );

  useEffect(() => {
    if (selectedOrder) {
      setSelectedOrderId(selectedOrder.id);
      setTipInput('0');
      setAmountReceivedInput(String(selectedOrder.subtotal));
      setCheckoutError(null);
    } else {
      setSelectedOrderId(null);
    }
  }, [selectedOrder?.id, selectedOrder?.subtotal]);

  const numericTip = useMemo(() => {
    const trimmed = tipInput.trim();
    if (!trimmed) return 0;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
  }, [tipInput]);

  const numericReceived = useMemo(() => {
    const trimmed = amountReceivedInput.trim();
    if (!trimmed) return 0;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
  }, [amountReceivedInput]);

  const checkoutPreview = useMemo(() => {
    if (!selectedOrder) return null;
    return calculateCheckoutPayment({
      subtotal: selectedOrder.subtotal,
      tip: numericTip,
      paymentMethod,
      amountReceivedInput: numericReceived,
    });
  }, [selectedOrder, numericTip, paymentMethod, numericReceived]);

  const selectedBreakdowns = useMemo(() => {
    if (!selectedOrder) return [];
    return calculateDinerBreakdowns(
      selectedOrder.diners,
      selectedOrder.items,
      selectedOrder.splitSharedEqually
    );
  }, [selectedOrder]);

  const handleApplyTipPercent = (pct: number) => {
    if (!selectedOrder) return;
    const computedTip = roundMoney(selectedOrder.subtotal * pct);
    setTipInput(String(computedTip));
    if (paymentMethod === 'efectivo') {
      setAmountReceivedInput(String(roundMoney(selectedOrder.subtotal + computedTip)));
    }
  };

  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setCheckoutError(null);
    if (method === 'efectivo' && selectedOrder) {
      const minTotal = roundMoney(selectedOrder.subtotal + numericTip);
      if (numericReceived < minTotal) {
        setAmountReceivedInput(String(minTotal));
      }
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setCheckoutError(null);

    if (!isRegisterOpen) {
      setCheckoutError(
        'La caja está cerrada. Solicita al Administrador abrir la caja antes de cobrar.'
      );
      return;
    }

    const calc = calculateCheckoutPayment({
      subtotal: selectedOrder.subtotal,
      tip: numericTip,
      paymentMethod,
      amountReceivedInput: numericReceived,
    });

    if (!calc.valid) {
      setCheckoutError(calc.error || 'Verifica los datos del cobro.');
      return;
    }

    setProcessing(true);
    try {
      const paidOrder = await processOrderPayment({
        orderId: selectedOrder.id,
        paymentMethod,
        tip: calc.tip,
        amountReceived: calc.amountReceived,
      });
      setTicketOrder(paidOrder);
      setSelectedOrderId(null);
    } catch (err) {
      setCheckoutError(extractFriendlyErrorMessage(err, 'No se pudo procesar el cobro.'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-Time Cash Register Status & Customer Totals Strip (No Admin Sales Reports or Cash Cut) */}
      <section
        aria-label="Estado de caja y cuentas en tiempo real"
        className={`bg-[#161210] border rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
          isRegisterOpen ? 'border-stone-800' : 'border-red-800/70'
        }`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          <div>
            <p className="text-xs text-stone-400">Estado de Caja (Tiempo Real)</p>
            <div className="mt-1 flex items-center gap-2">
              {isRegisterOpen ? (
                <>
                  <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-heading text-lg uppercase tracking-wide text-emerald-400">
                    Caja Abierta
                  </span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="font-heading text-lg uppercase tracking-wide text-red-400">
                    Caja Cerrada
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {isRegisterOpen
                ? `Autorizada por ${cashRegister?.openedByName || 'Administrador'}`
                : 'Solo el Administrador puede abrir o cerrar caja'}
            </p>
          </div>

          <div>
            <p className="text-xs text-stone-400">
              Por Cobrar Ahora ({payableOrders.length})
            </p>
            <p className="font-mono-tabular text-xl font-bold text-amber-400 mt-0.5">
              {formatMXN(payableTotalAmount)}
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Cuentas listas y servidas en mesa
            </p>
          </div>

          <div>
            <p className="text-xs text-stone-400">
              En Cocina / Consumo ({inProgressOrders.length})
            </p>
            <p className="font-mono-tabular text-xl font-bold text-white mt-0.5">
              {formatMXN(inProgressTotalAmount)}
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Totales en curso sincronizados en vivo
            </p>
          </div>
        </div>

        <div className="px-3.5 py-2.5 rounded-lg bg-[#120f0d] border border-stone-800 text-xs text-stone-400 flex items-center gap-2 shrink-0">
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Apertura y cierre de caja: exclusivo Administrador</span>
        </div>
      </section>

      {!isRegisterOpen && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-950/50 border border-red-800/70 text-xs text-red-200 flex items-center gap-3"
        >
          <Lock className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-red-100">
              La caja se encuentra cerrada en este momento
            </p>
            <p className="text-red-200/90 mt-0.5">
              Puedes consultar los totales de las mesas en tiempo real y emitir pre-cuentas, pero los
              cobros quedarán habilitados automáticamente cuando el Administrador abra la caja.
            </p>
          </div>
        </div>
      )}

      {/* Main Split: Live Queues (Left) + Checkout Terminal (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Payable Queue + Live In-Progress Totals + Paid Tickets */}
        <div className="xl:col-span-5 space-y-5">
          <section className="bg-[#161210] border border-stone-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <h2 className="font-heading text-lg uppercase tracking-wide text-white">
                Por Cobrar ({payableOrders.length})
              </h2>
              <span className="text-xs text-stone-400">Listas y servidas</span>
            </div>

            {payableOrders.length === 0 ? (
              <div className="py-10 text-center text-xs text-stone-500 border border-dashed border-stone-800 rounded-lg">
                No hay cuentas pendientes de cobro en este momento.
              </div>
            ) : (
              <div className="space-y-2">
                {payableOrders.map((order) => {
                  const isSelected = selectedOrder?.id === order.id;
                  const meta = ORDER_STATUS_META[order.status];
                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`w-full p-3.5 rounded-lg border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-orange-600/15 border-orange-500 text-white'
                          : 'bg-[#120f0d] border-stone-800 hover:border-stone-600 text-stone-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-heading text-base uppercase tracking-wide leading-tight">
                          {order.serviceType} · {order.folio}
                        </p>
                        <p className="text-xs text-stone-400 mt-0.5 truncate">
                          <span className={meta.colorClass}>{meta.shortLabel}</span> · Mesero: {order.waiterName} ·{' '}
                          {order.items.reduce((a, b) => a + b.qty, 0)} arts.
                        </p>
                      </div>
                      <span className="font-mono-tabular text-base font-bold text-amber-400 shrink-0">
                        {formatMXN(order.subtotal)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Real-Time Totals in Kitchen / Consumption */}
          <section className="bg-[#161210] border border-stone-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <h2 className="font-heading text-lg uppercase tracking-wide text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Totales en Consumo ({inProgressOrders.length})</span>
              </h2>
              <span className="text-xs text-stone-400">En cocina</span>
            </div>

            {inProgressOrders.length === 0 ? (
              <p className="text-xs text-stone-500 py-5 text-center">
                No hay órdenes activas en preparación.
              </p>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {inProgressOrders.map((order) => {
                  const meta = ORDER_STATUS_META[order.status];
                  return (
                    <div
                      key={order.id}
                      className="p-3 rounded-lg bg-[#120f0d] border border-stone-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-100 truncate">
                          {order.serviceType} · {order.folio}
                        </p>
                        <p className="text-xs text-stone-400 truncate">
                          <span className={meta.colorClass}>{meta.shortLabel}</span> · Mesero:{' '}
                          {order.waiterName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono-tabular text-sm font-bold text-amber-400">
                          {formatMXN(order.subtotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTicketOrder(order)}
                          className="px-2.5 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-[11px] text-stone-200 font-medium cursor-pointer"
                        >
                          Pre-cuenta
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Paid Orders Today (Reprint / Download Ticket PDF Anytime) */}
          <section className="bg-[#161210] border border-stone-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <h2 className="font-heading text-lg uppercase tracking-wide text-white">
                Tickets Cobrados Hoy ({paidTodayOrders.length})
              </h2>
              <span className="text-xs text-stone-400">Descarga PDF e impresión</span>
            </div>

            {paidTodayOrders.length === 0 ? (
              <p className="text-xs text-stone-500 py-6 text-center">
                Aún no se registran cobros hoy.
              </p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {paidTodayOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-3 rounded-lg bg-[#120f0d] border border-stone-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-100 truncate">
                        {order.serviceType} · {order.folio}
                      </p>
                      <p className="text-xs text-stone-400 capitalize">
                        {order.paymentMethod} ·{' '}
                        {new Date(order.paidAtMs || order.updatedAtMs).toLocaleTimeString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono-tabular text-sm font-semibold text-stone-200">
                        {formatMXN(order.total)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTicketOrder(order)}
                        className="px-2.5 py-1.5 rounded-md bg-stone-800 hover:bg-stone-700 text-xs text-amber-400 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Ticket PDF</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: Checkout Terminal */}
        <section className="xl:col-span-7 bg-[#161210] border border-stone-800 rounded-xl p-5 space-y-5">
          {!selectedOrder ? (
            <div className="py-20 text-center space-y-2">
              <Wallet className="w-8 h-8 text-stone-600 mx-auto" />
              <h3 className="font-heading text-lg uppercase text-stone-300">
                Selecciona una orden para cobrar
              </h3>
              <p className="text-xs text-stone-500">
                Cuando Cocina termine una orden o el Mesero la entregue, aparecerá lista en la columna izquierda con su total exacto.
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => void handleConfirmPayment(e)} className="space-y-5">
              {/* Order Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-stone-800">
                <div>
                  <h2 className="font-heading text-2xl uppercase tracking-wide text-white">
                    Cobro · {selectedOrder.serviceType} ({selectedOrder.folio})
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Mesero: {selectedOrder.waiterName} ·{' '}
                    {selectedOrder.splitSharedEqually
                      ? 'Al Centro dividido equitativamente'
                      : 'Sin división automática'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTicketOrder(selectedOrder)}
                  className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-medium text-stone-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pre-cuenta / Ticket PDF por Persona</span>
                </button>
              </div>

              {/* Per-Person Breakdown */}
              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                {selectedBreakdowns.map((group) => {
                  if (group.items.length === 0 && group.sharedAllocation === 0) return null;
                  return (
                    <div
                      key={group.diner.id}
                      className="p-3 rounded-lg bg-[#120f0d] border border-stone-800/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs border-b border-stone-800 pb-1.5">
                        <span className="font-semibold text-amber-400">{group.diner.label}</span>
                        <span className="font-mono-tabular font-bold text-white">
                          {formatMXN(group.finalTotal)}
                        </span>
                      </div>
                      {group.items.map((item) => (
                        <div key={item.lineId} className="flex justify-between text-xs text-stone-300">
                          <span>
                            {item.qty}x {item.name}
                            {item.notes ? ` (${item.notes})` : ''}
                          </span>
                          <span className="font-mono-tabular">
                            {formatMXN(item.unitPrice * item.qty)}
                          </span>
                        </div>
                      ))}
                      {group.sharedAllocation > 0 && (
                        <div className="flex justify-between text-[11px] text-stone-400">
                          <span>+ Parte proporcional Al Centro</span>
                          <span className="font-mono-tabular">{formatMXN(group.sharedAllocation)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-stone-300">Método de Pago</span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'efectivo', label: 'Efectivo', icon: Banknote },
                      { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
                      { id: 'transferencia', label: 'Transferencia', icon: Building2 },
                    ] as const
                  ).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectPaymentMethod(id)}
                      className={`py-2.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition ${
                        paymentMethod === id
                          ? 'bg-orange-600/20 border-orange-500 text-white'
                          : 'bg-[#120f0d] border-stone-800 text-stone-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tip & Cash Received */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="cashier-tip-input" className="text-xs font-semibold text-stone-300">
                      Propina (MXN)
                    </label>
                    <div className="flex items-center gap-1">
                      {[0, 0.1, 0.15].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => handleApplyTipPercent(pct)}
                          className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-[11px] text-stone-200 cursor-pointer"
                        >
                          {pct === 0 ? '0%' : `${pct * 100}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    id="cashier-tip-input"
                    type="number"
                    min="0"
                    max="50000"
                    step="0.50"
                    value={tipInput}
                    onChange={(e) => setTipInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0e0c0b] border border-stone-700 focus:border-orange-500 focus:outline-none font-mono-tabular text-sm text-white"
                  />
                </div>

                {paymentMethod === 'efectivo' && (
                  <div className="space-y-2">
                    <label
                      htmlFor="cashier-received-input"
                      className="block text-xs font-semibold text-stone-300"
                    >
                      Efectivo Recibido (MXN)
                    </label>
                    <input
                      id="cashier-received-input"
                      type="number"
                      min="0"
                      max="500000"
                      step="0.50"
                      value={amountReceivedInput}
                      onChange={(e) => setAmountReceivedInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#0e0c0b] border border-stone-700 focus:border-orange-500 focus:outline-none font-mono-tabular text-sm text-white"
                    />
                  </div>
                )}
              </div>

              {/* Totals Box */}
              <div className="p-4 rounded-lg bg-[#120f0d] border border-stone-800 space-y-1.5 text-sm">
                <div className="flex justify-between text-stone-400">
                  <span>Subtotal</span>
                  <span className="font-mono-tabular">{formatMXN(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Propina</span>
                  <span className="font-mono-tabular">{formatMXN(numericTip)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-stone-800">
                  <span>Total a Cobrar</span>
                  <span className="font-mono-tabular text-amber-400">
                    {formatMXN(roundMoney(selectedOrder.subtotal + numericTip))}
                  </span>
                </div>
                {paymentMethod === 'efectivo' && checkoutPreview && (
                  checkoutPreview.valid ? (
                    <div className="flex justify-between text-sm font-semibold text-emerald-400 pt-1">
                      <span>Cambio a Entregar</span>
                      <span className="font-mono-tabular">{formatMXN(checkoutPreview.changeGiven)}</span>
                    </div>
                  ) : numericReceived < checkoutPreview.total && numericTip >= 0 ? (
                    <div className="flex justify-between text-sm font-semibold text-amber-400 pt-1">
                      <span>Falta por Recibir</span>
                      <span className="font-mono-tabular">
                        {formatMXN(roundMoney(checkoutPreview.total - Math.max(0, numericReceived)))}
                      </span>
                    </div>
                  ) : null
                )}
              </div>

              {checkoutError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200"
                >
                  {checkoutError}
                </div>
              )}

              <button
                type="submit"
                disabled={processing || !isRegisterOpen}
                className="w-full py-3.5 px-5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
              >
                {isRegisterOpen ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>
                  {!isRegisterOpen
                    ? 'Caja Cerrada · Esperando Apertura del Administrador'
                    : processing
                      ? 'Procesando cobro...'
                      : 'Confirmar Cobro y Generar Ticket PDF'}
                </span>
              </button>
            </form>
          )}
        </section>
      </div>

      {ticketOrder && (
        <TicketModal
          order={ticketOrder}
          onClose={() => setTicketOrder(null)}
          onLoadPrivateCustomer={loadOrderPrivateCustomer}
        />
      )}
    </div>
  );
};
