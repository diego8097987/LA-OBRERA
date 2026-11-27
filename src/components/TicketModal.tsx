import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ban, Check, Copy, Download, FileDown, Printer, X } from 'lucide-react';
import type { Order, OrderPrivateCustomer } from '../types/pos';
import { downloadOrderTicketPdf } from '../utils/pdfExport';
import {
  buildPlainTextReceipt,
  calculateDinerBreakdowns,
  formatMXN,
} from '../utils/posCalculations';

interface TicketModalProps {
  order: Order;
  onClose: () => void;
  onLoadPrivateCustomer?: (orderId: string) => Promise<OrderPrivateCustomer | null>;
  onRequestCancel?: (order: Order) => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  order,
  onClose,
  onLoadPrivateCustomer,
  onRequestCancel,
}) => {
  const [selectedDinerId, setSelectedDinerId] = useState<string>('all');
  const [privateCustomer, setPrivateCustomer] = useState<OrderPrivateCustomer | null>(
    order.privateCustomer ?? null
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSelectedDinerId('all');
    setPrivateCustomer(order.privateCustomer ?? null);
    setCopied(false);
  }, [order.id, order.privateCustomer]);

  useEffect(() => {
    let active = true;
    if (!order.privateCustomer && onLoadPrivateCustomer) {
      onLoadPrivateCustomer(order.id)
        .then((res) => {
          if (active && res) setPrivateCustomer(res);
        })
        .catch(() => {
          // Non-fatal: ticket remains usable without optional customer delivery metadata
        });
    }
    return () => {
      active = false;
    };
  }, [order.id, order.privateCustomer, onLoadPrivateCustomer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const enrichedOrder = useMemo<Order>(
    () => ({ ...order, privateCustomer }),
    [order, privateCustomer]
  );

  const breakdowns = useMemo(
    () => calculateDinerBreakdowns(order.diners, order.items, order.splitSharedEqually),
    [order.diners, order.items, order.splitSharedEqually]
  );

  const personalBreakdowns = useMemo(
    () => breakdowns.filter((b) => !b.diner.isShared && (b.items.length > 0 || b.sharedAllocation > 0)),
    [breakdowns]
  );

  const activeDinerBreakdown = useMemo(
    () => (selectedDinerId === 'all' ? null : breakdowns.find((b) => b.diner.id === selectedDinerId) || null),
    [breakdowns, selectedDinerId]
  );

  const plainText = useMemo(
    () => buildPlainTextReceipt(enrichedOrder, selectedDinerId === 'all' ? undefined : selectedDinerId),
    [enrichedOrder, selectedDinerId]
  );

  const timestampLabel = new Date(order.paidAtMs || order.createdAtMs).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const pdfTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pdfTimerRef.current) window.clearTimeout(pdfTimerRef.current);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleDownloadPdf = async () => {
    await downloadOrderTicketPdf(
      enrichedOrder,
      selectedDinerId === 'all' ? undefined : selectedDinerId
    );
    setPdfDownloaded(true);
    if (pdfTimerRef.current) window.clearTimeout(pdfTimerRef.current);
    pdfTimerRef.current = window.setTimeout(() => setPdfDownloaded(false), 2400);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const suffix = activeDinerBreakdown
      ? `-${activeDinerBreakdown.diner.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
      : '';
    link.href = url;
    link.download = `ticket-${order.folio}${suffix}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard unavailable
    }
  };

  return (
    <div
      className="print-modal-root fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-modal-heading"
    >
      <div className="print-modal-shell bg-[#181412] border border-stone-800 rounded-xl max-w-xl w-full flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between gap-4">
          <div>
            <h2 id="ticket-modal-heading" className="font-heading text-lg uppercase tracking-wide text-white">
              Ticket de Compra · {order.folio}
            </h2>
            <p className="text-xs text-stone-400">
              {order.serviceType} ·{' '}
              {order.status === 'paid'
                ? 'Pagado'
                : order.status === 'cancelled'
                  ? 'Cancelado por Administrador'
                  : 'Pre-cuenta'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de ticket"
            className="w-9 h-9 rounded-lg border border-stone-700 hover:bg-stone-800 text-stone-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Account Selector (Full Table vs Individual Diner) */}
        {personalBreakdowns.length > 1 && (
          <div className="px-5 py-3 border-b border-stone-800 bg-[#14110f] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedDinerId('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition cursor-pointer ${
                selectedDinerId === 'all'
                  ? 'bg-orange-600 text-white'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800'
              }`}
            >
              Cuenta Completa
            </button>
            {personalBreakdowns.map((group) => (
              <button
                key={group.diner.id}
                type="button"
                onClick={() => setSelectedDinerId(group.diner.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedDinerId === group.diner.id
                    ? 'bg-orange-600 text-white'
                    : 'text-stone-400 hover:text-white hover:bg-stone-800'
                }`}
              >
                {group.diner.label}
              </button>
            ))}
          </div>
        )}

        {/* Thermal Receipt Preview */}
        <div className="p-5 overflow-y-auto bg-[#110e0d]">
          <div
            id="thermal-receipt-print-area"
            className="mx-auto max-w-[340px] bg-stone-50 text-stone-900 rounded-lg p-5 font-mono-tabular text-xs leading-relaxed border border-stone-300"
          >
            <div className="text-center border-b border-dashed border-stone-400 pb-3 mb-3">
              <p className="font-display font-bold text-sm tracking-wider text-stone-950">
                LA OBRERA GRILL ASADERO
              </p>
              <p className="text-[11px] text-stone-600">Sabor, Fuego y Pasión · Desde 1996</p>
              <p className="text-[11px] text-stone-700 mt-1">
                Folio: <strong>{order.folio}</strong> · {order.serviceType}
              </p>
              <p className="text-[10px] text-stone-600">{timestampLabel}</p>
            </div>

            <div className="space-y-0.5 text-[11px] border-b border-dashed border-stone-400 pb-2.5 mb-3">
              <div className="flex justify-between gap-2">
                <span className="text-stone-600">Atendió:</span>
                <span className="font-medium text-right">{order.waiterName}</span>
              </div>
              {privateCustomer?.customerName && (
                <div className="flex justify-between gap-2">
                  <span className="text-stone-600">Cliente:</span>
                  <span className="font-medium text-right">{privateCustomer.customerName}</span>
                </div>
              )}
              {privateCustomer?.phone && (
                <div className="flex justify-between gap-2">
                  <span className="text-stone-600">Teléfono:</span>
                  <span className="text-right">{privateCustomer.phone}</span>
                </div>
              )}
              {order.hasDeliveryInfo && privateCustomer?.street && (
                <div className="pt-1 text-[10px] text-stone-700">
                  <p>
                    <strong>Entrega:</strong> {privateCustomer.street}, Col. {privateCustomer.colony}
                  </p>
                  {privateCustomer.reference && <p>Ref: {privateCustomer.reference}</p>}
                </div>
              )}
            </div>

            {activeDinerBreakdown ? (
              <div className="space-y-2 border-b border-dashed border-stone-400 pb-3 mb-3">
                <p className="font-bold uppercase text-[11px] text-stone-900">
                  Cuenta Individual: {activeDinerBreakdown.diner.label}
                </p>
                {activeDinerBreakdown.items.map((item) => (
                  <div key={item.lineId} className="flex justify-between gap-2">
                    <span>
                      {item.qty}x {item.name}
                      {item.notes ? ` (${item.notes})` : ''}
                    </span>
                    <span className="shrink-0 font-semibold">
                      {formatMXN(item.unitPrice * item.qty)}
                    </span>
                  </div>
                ))}
                {activeDinerBreakdown.sharedAllocation > 0 && (
                  <div className="flex justify-between gap-2 text-stone-700">
                    <span>Proporción Al Centro</span>
                    <span className="shrink-0">{formatMXN(activeDinerBreakdown.sharedAllocation)}</span>
                  </div>
                )}
                <div className="pt-2 mt-2 border-t border-stone-300 flex justify-between font-bold text-sm">
                  <span>TOTAL PERSONA</span>
                  <span>{formatMXN(activeDinerBreakdown.finalTotal)}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3 border-b border-dashed border-stone-400 pb-3 mb-3">
                  {breakdowns.map((group) => {
                    if (group.items.length === 0 && group.sharedAllocation === 0) return null;
                    return (
                      <div key={group.diner.id} className="space-y-1">
                        <p className="text-[11px] font-bold uppercase text-stone-700">
                          {group.diner.label}
                        </p>
                        {group.items.map((item) => (
                          <div key={item.lineId} className="flex justify-between gap-2">
                            <span>
                              {item.qty}x {item.name}
                              {item.notes ? ` (${item.notes})` : ''}
                            </span>
                            <span className="shrink-0 font-medium">
                              {formatMXN(item.unitPrice * item.qty)}
                            </span>
                          </div>
                        ))}
                        {group.sharedAllocation > 0 && (
                          <div className="flex justify-between gap-2 text-[11px] text-stone-600">
                            <span>+ Parte Al Centro</span>
                            <span>{formatMXN(group.sharedAllocation)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatMXN(order.subtotal)}</span>
                  </div>
                  {order.tip > 0 && (
                    <div className="flex justify-between">
                      <span>Propina</span>
                      <span>{formatMXN(order.tip)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm pt-1.5 border-t border-stone-400">
                    <span>TOTAL MXN</span>
                    <span>{formatMXN(order.total)}</span>
                  </div>
                </div>

                {order.status === 'paid' && (
                  <div className="mt-3 pt-2.5 border-t border-dashed border-stone-400 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span>Método de pago</span>
                      <span className="uppercase font-semibold">{order.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recibido</span>
                      <span>{formatMXN(order.amountReceived)}</span>
                    </div>
                    {order.paymentMethod === 'efectivo' && (
                      <div className="flex justify-between font-bold">
                        <span>Cambio entregado</span>
                        <span>{formatMXN(order.changeGiven)}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <p className="text-center text-[10px] text-stone-600 mt-4 pt-2 border-t border-dashed border-stone-400">
              ¡Gracias por su visita! · @asadero_la_obrera
            </p>
          </div>
        </div>

        {/* Admin-only direct cancellation option when inspecting an active unpaid waiter order */}
        {onRequestCancel && order.status !== 'paid' && order.status !== 'cancelled' && (
          <div className="px-5 py-2.5 border-t border-red-900/50 bg-red-950/25 flex items-center justify-between gap-3">
            <span className="text-[11px] text-red-200/90">
              Cancelación exclusiva de Administrador (retira el pedido de cocina, caja y mesero)
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestCancel(order);
              }}
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition"
            >
              <Ban className="w-3.5 h-3.5 shrink-0" />
              <span>Cancelar Pedido</span>
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="px-5 py-4 border-t border-stone-800 bg-[#181412] grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            className="px-3 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition"
          >
            {pdfDownloaded ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <FileDown className="w-4 h-4 shrink-0" />
            )}
            <span>{pdfDownloaded ? 'PDF Listo' : 'Descargar PDF'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition"
          >
            <Printer className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Imprimir</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTxt}
            className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition"
          >
            <Download className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Bajar .TXT</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition"
          >
            {copied ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 shrink-0" />
            )}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
