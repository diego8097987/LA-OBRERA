import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, CheckCircle2, ChefHat, Clock, Flame } from 'lucide-react';
import { usePos } from '../context/PosContext';
import type { KitchenStation, Order } from '../types/pos';
import { getKitchenUrgency, ORDER_STATUS_META } from '../utils/posCalculations';

function playKitchenChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => {
      void ctx.close().catch(() => undefined);
    };
  } catch {
    // Ignore autoplay restrictions
  }
}

export const KitchenView: React.FC = () => {
  const { orders, updateOrderStatus } = usePos();
  const [stationFilter, setStationFilter] = useState<KitchenStation | 'all'>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const seenPendingIdsRef = useRef<Set<string> | null>(null);
  const activeSignaturesRef = useRef<Map<string, string> | null>(null);

  const handleAdvanceOrder = async (orderId: string, nextStatus: 'preparing' | 'ready') => {
    if (busyOrderId === orderId) return;
    setBusyOrderId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
    } finally {
      setBusyOrderId((prev) => (prev === orderId ? null : prev));
    }
  };

  // Live 1-second timer tick for kitchen elapsed clocks
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const kitchenOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready')
      .filter((o) => {
        if (stationFilter === 'all') return true;
        return o.items.some((i) => i.station === stationFilter);
      })
      .sort((a, b) => a.createdAtMs - b.createdAtMs); // FIFO: oldest first
  }, [orders, stationFilter]);

  const pendingOrders = useMemo(
    () => kitchenOrders.filter((o) => o.status === 'pending'),
    [kitchenOrders]
  );
  const preparingOrders = useMemo(
    () => kitchenOrders.filter((o) => o.status === 'preparing'),
    [kitchenOrders]
  );
  const readyOrders = useMemo(
    () => kitchenOrders.filter((o) => o.status === 'ready'),
    [kitchenOrders]
  );

  // Play gentle alert ONLY when a genuinely new pending order arrives OR a waiter modifies an active kitchen order
  useEffect(() => {
    const currentPendingIds = orders.filter((o) => o.status === 'pending').map((o) => o.id);
    const activeKitchen = orders.filter((o) => o.status === 'pending' || o.status === 'preparing');
    const nextSignatures = new Map<string, string>();
    for (const o of activeKitchen) {
      const sig = `${o.orderNotes}|${o.items.map((i) => `${i.lineId}:${i.qty}:${i.notes}`).join(',')}`;
      nextSignatures.set(o.id, sig);
    }

    if (seenPendingIdsRef.current === null || activeSignaturesRef.current === null) {
      seenPendingIdsRef.current = new Set(currentPendingIds);
      activeSignaturesRef.current = nextSignatures;
      return;
    }

    let shouldChime = false;
    for (const id of currentPendingIds) {
      if (!seenPendingIdsRef.current.has(id)) {
        shouldChime = true;
        break;
      }
    }
    if (!shouldChime) {
      for (const [id, sig] of nextSignatures.entries()) {
        const prevSig = activeSignaturesRef.current.get(id);
        if (prevSig !== undefined && prevSig !== sig) {
          shouldChime = true;
          break;
        }
      }
    }

    seenPendingIdsRef.current = new Set(currentPendingIds);
    activeSignaturesRef.current = nextSignatures;
    if (soundEnabled && shouldChime) {
      playKitchenChime();
    }
  }, [orders, soundEnabled]);

  const renderTicketCard = (order: Order) => {
    const urgency = getKitchenUrgency(order.createdAtMs, nowMs);
    const visibleItems =
      stationFilter === 'all'
        ? order.items
        : order.items.filter((i) => i.station === stationFilter);
    const statusMeta = ORDER_STATUS_META[order.status];

    const urgencyTextClass =
      urgency.level === 'urgent'
        ? 'text-red-400'
        : urgency.level === 'warning'
          ? 'text-amber-400'
          : 'text-stone-400';

    return (
      <article
        key={order.id}
        data-testid={`kitchen-order-${order.folio}`}
        className={`bg-[#181412] border rounded-xl p-4 flex flex-col justify-between gap-4 ${
          urgency.level === 'urgent' && order.status !== 'ready'
            ? 'border-red-700/70'
            : order.status === 'ready'
              ? 'border-emerald-700/60'
              : 'border-stone-800'
        }`}
      >
        <div className="space-y-3">
          {/* Card Header */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-stone-800">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-heading text-xl uppercase tracking-wide text-white leading-none">
                  {order.serviceType}
                </h3>
                {(order.status === 'pending' || order.status === 'preparing') &&
                  order.updatedAtMs - order.createdAtMs > 2500 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                      Modificada
                    </span>
                  )}
              </div>
              <p className="text-xs text-stone-400 mt-1">
                {order.folio} · Mesero: {order.waiterName}
              </p>
            </div>
            <div className="text-right">
              <div className={`font-mono-tabular text-sm font-bold flex items-center justify-end gap-1 ${urgencyTextClass}`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{urgency.formattedElapsed}</span>
              </div>
              <p className={`text-[11px] font-medium ${urgencyTextClass}`}>
                {order.status === 'ready' ? statusMeta.shortLabel : urgency.label}
              </p>
            </div>
          </div>

          {/* Order Items (NO customer phone/address PII ever displayed in Kitchen) */}
          <ul className="space-y-2">
            {visibleItems.map((item) => {
              const dinerLabel = order.diners.find((d) => d.id === item.dinerId)?.label;
              return (
                <li key={item.lineId} className="text-sm flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-stone-100 font-medium">
                      <span className="font-mono-tabular font-bold text-amber-400 mr-1.5">
                        {item.qty}x
                      </span>
                      {item.name}
                    </p>
                    <p className="text-xs text-stone-400">
                      {dinerLabel ? `${dinerLabel} · ` : ''}
                      <span className="capitalize">{item.station}</span>
                      {item.notes ? ` · ${item.notes}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {order.orderNotes && (
            <div className="p-2.5 rounded-lg bg-[#120f0d] border border-stone-800 text-xs text-amber-300">
              Nota: {order.orderNotes}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2 border-t border-stone-800">
          {order.status === 'pending' && (
            <button
              type="button"
              disabled={busyOrderId === order.id}
              onClick={() => void handleAdvanceOrder(order.id, 'preparing')}
              className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Flame className="w-4 h-4" />
              <span>{busyOrderId === order.id ? 'Actualizando...' : 'Iniciar Preparación'}</span>
            </button>
          )}
          {order.status === 'preparing' && (
            <button
              type="button"
              disabled={busyOrderId === order.id}
              onClick={() => void handleAdvanceOrder(order.id, 'ready')}
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{busyOrderId === order.id ? 'Actualizando...' : 'Marcar Orden Lista'}</span>
            </button>
          )}
          {order.status === 'ready' && (
            <div className="text-center py-2 text-xs font-medium text-emerald-400">
              Esperando recolección de mesero o entrega
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-[#161210] border border-stone-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl uppercase tracking-wide text-white flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-400" />
            <span>Monitor de Cocina en Tiempo Real</span>
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            {pendingOrders.length} pendientes · {preparingOrders.length} en preparación · {readyOrders.length} listas para entregar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0e0c0b] border border-stone-800">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'parrilla', label: 'Parrilla' },
                { id: 'cocina', label: 'Cocina' },
                { id: 'barra', label: 'Barra' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStationFilter(st.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition ${
                  stationFilter === st.id
                    ? 'bg-orange-600 text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs text-stone-300 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            {soundEnabled ? (
              <Bell className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <BellOff className="w-3.5 h-3.5 text-stone-500" />
            )}
            <span>{soundEnabled ? 'Alerta Sonora Activa' : 'Sonido Silenciado'}</span>
          </button>
        </div>
      </div>

      {/* 3-Column Kitchen Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Column 1: Pending */}
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-800">
            <h3 className="font-heading text-base uppercase tracking-wide text-amber-400">
              Pendientes ({pendingOrders.length})
            </h3>
            <span className="text-xs text-stone-500">Orden de llegada</span>
          </div>
          {pendingOrders.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-stone-800 text-center text-xs text-stone-500">
              Sin comandas pendientes por iniciar.
            </div>
          ) : (
            <div className="space-y-3">{pendingOrders.map(renderTicketCard)}</div>
          )}
        </section>

        {/* Column 2: Preparing */}
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-800">
            <h3 className="font-heading text-base uppercase tracking-wide text-orange-400">
              En Preparación ({preparingOrders.length})
            </h3>
            <span className="text-xs text-stone-500">En parrilla y cocina</span>
          </div>
          {preparingOrders.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-stone-800 text-center text-xs text-stone-500">
              No hay platillos cocinándose actualmente.
            </div>
          ) : (
            <div className="space-y-3">{preparingOrders.map(renderTicketCard)}</div>
          )}
        </section>

        {/* Column 3: Ready */}
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-800">
            <h3 className="font-heading text-base uppercase tracking-wide text-emerald-400">
              Listas para Servir ({readyOrders.length})
            </h3>
            <span className="text-xs text-stone-500">Barra de entrega</span>
          </div>
          {readyOrders.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-stone-800 text-center text-xs text-stone-500">
              Las órdenes terminadas aparecerán aquí.
            </div>
          ) : (
            <div className="space-y-3">{readyOrders.map(renderTicketCard)}</div>
          )}
        </section>
      </div>
    </div>
  );
};
