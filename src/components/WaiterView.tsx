import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  MapPin,
  Minus,
  Plus,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import { extractFriendlyErrorMessage } from '../firebase';
import {
  COOKING_NOTE_PRESETS,
  MENU_CATEGORIES,
  SERVICE_TYPES,
  TABLE_OPTIONS,
} from '../data/menuCatalog';
import type {
  MenuCategoryId,
  MenuItem,
  Order,
  OrderDiner,
  OrderLineItem,
  ServiceType,
} from '../types/pos';
import {
  calculateDinerBreakdowns,
  calculateItemsSubtotal,
  formatMXN,
  MAX_COLONY_LENGTH,
  MAX_CUSTOMER_NAME_LENGTH,
  MAX_DINERS_PER_ORDER,
  MAX_ITEMS_PER_ORDER,
  MAX_LINE_NOTES_LENGTH,
  MAX_ORDER_NOTES_LENGTH,
  MAX_PHONE_LENGTH,
  MAX_REFERENCE_LENGTH,
  MAX_STREET_LENGTH,
  ORDER_STATUS_META,
  validateNewOrderInput,
} from '../utils/posCalculations';

function createInitialDiners(): OrderDiner[] {
  return [
    { id: 'diner-1', label: 'Persona 1', isShared: false },
    { id: 'shared-center', label: 'Al Centro / Compartido', isShared: true },
  ];
}

export const WaiterView: React.FC = () => {
  const { orders, menuItems, createOrder, appendItemsToOrder, updateOrderStatus, notify } = usePos();

  const [serviceType, setServiceType] = useState<ServiceType>('Mesa 3');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [diners, setDiners] = useState<OrderDiner[]>(createInitialDiners);
  const [activeDinerId, setActiveDinerId] = useState<string>('diner-1');
  const [newDinerName, setNewDinerName] = useState<string>('');
  const [draftItems, setDraftItems] = useState<OrderLineItem[]>([]);
  const [splitSharedEqually, setSplitSharedEqually] = useState<boolean>(true);
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Isolated PII fields (saved only to /orders/{id}/private/customer)
  const [customerName, setCustomerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [street, setStreet] = useState<string>('');
  const [colony, setColony] = useState<string>('');
  const [reference, setReference] = useState<string>('');

  // Menu filters
  const [selectedCategory, setSelectedCategory] = useState<MenuCategoryId | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingNoteLineId, setEditingNoteLineId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [servingOrderId, setServingOrderId] = useState<string | null>(null);

  const activeOrdersByTable = useMemo(() => {
    const map = new Map<ServiceType, Order>();
    for (const order of orders) {
      if (order.status === 'paid' || order.status === 'cancelled') continue;
      if (!map.has(order.serviceType)) {
        map.set(order.serviceType, order);
      }
    }
    return map;
  }, [orders]);

  const activeCountBySlot = useMemo(() => {
    const counts = new Map<ServiceType, number>();
    for (const order of orders) {
      if (order.status === 'paid' || order.status === 'cancelled') continue;
      counts.set(order.serviceType, (counts.get(order.serviceType) || 0) + 1);
    }
    return counts;
  }, [orders]);

  const editableMultiSlotOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          (o.serviceType === 'Para Llevar' || o.serviceType === 'Servicio a Domicilio') &&
          (o.status === 'pending' || o.status === 'preparing')
      ),
    [orders]
  );

  const readyToServeOrders = useMemo(
    () => orders.filter((o) => o.status === 'ready'),
    [orders]
  );

  const filteredMenu = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return menuItems.filter((item) => {
      if (!q && selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q)
      );
    });
  }, [menuItems, selectedCategory, searchTerm]);

  const draftSubtotal = useMemo(() => calculateItemsSubtotal(draftItems), [draftItems]);
  const dinerBreakdowns = useMemo(
    () => calculateDinerBreakdowns(diners, draftItems, splitSharedEqually),
    [diners, draftItems, splitSharedEqually]
  );

  const resetDraft = (nextService: ServiceType = serviceType) => {
    setEditingOrderId(null);
    setServiceType(nextService);
    const fresh = createInitialDiners();
    setDiners(fresh);
    setActiveDinerId(fresh[0].id);
    setDraftItems([]);
    setSplitSharedEqually(true);
    setOrderNotes('');
    setCustomerName('');
    setPhone('');
    setStreet('');
    setColony('');
    setReference('');
    setEditingNoteLineId(null);
    setFormError(null);
  };

  // Auto-exit edit mode if Kitchen or Admin moves the active order out of editable statuses in real time
  useEffect(() => {
    if (!editingOrderId) return;
    const liveOrder = orders.find((o) => o.id === editingOrderId);
    if (!liveOrder || (liveOrder.status !== 'pending' && liveOrder.status !== 'preparing')) {
      setEditingOrderId(null);
      const fresh = createInitialDiners();
      setDiners(fresh);
      setActiveDinerId(fresh[0].id);
      setDraftItems([]);
      setSplitSharedEqually(true);
      setOrderNotes('');
      setEditingNoteLineId(null);
      setFormError(null);
      if (liveOrder?.status === 'cancelled') {
        notify(
          `La comanda ${liveOrder.folio} fue cancelada por el Administrador.`,
          'info'
        );
      } else {
        notify('La comanda cambió de estado en tiempo real y se cerró la edición.', 'info');
      }
    }
  }, [editingOrderId, orders, notify]);

  const handleMarkServed = async (orderId: string) => {
    if (servingOrderId) return;
    setServingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, 'served');
    } finally {
      setServingOrderId(null);
    }
  };

  const loadOrderIntoEditor = (existing: Order) => {
    setServiceType(existing.serviceType);
    setEditingOrderId(existing.id);
    const safeDiners = existing.diners.length > 0 ? existing.diners : createInitialDiners();
    setDiners(safeDiners);
    setActiveDinerId(safeDiners.find((d) => !d.isShared)?.id || safeDiners[0]?.id || 'diner-1');
    setDraftItems(existing.items);
    setSplitSharedEqually(existing.splitSharedEqually);
    setOrderNotes(existing.orderNotes);
    setEditingNoteLineId(null);
    setFormError(null);
    notify(`Editando comanda activa ${existing.folio} (${existing.serviceType}).`, 'info');
  };

  const handleSelectTableFromMap = (table: ServiceType) => {
    // Takeout and Delivery can have multiple concurrent orders for different customers,
    // so clicking them starts a clean new order instead of mixing into another customer's ticket.
    if (table === 'Para Llevar' || table === 'Servicio a Domicilio') {
      resetDraft(table);
      return;
    }

    const existing = activeOrdersByTable.get(table);
    setServiceType(table);
    setFormError(null);

    if (existing && (existing.status === 'pending' || existing.status === 'preparing')) {
      loadOrderIntoEditor(existing);
    } else {
      resetDraft(table);
    }
  };

  const handleAddDiner = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newDinerName.trim().slice(0, 80);
    if (clean.length < 2) {
      setFormError('Escribe al menos 2 caracteres para el nombre del comensal.');
      return;
    }
    if (diners.length >= MAX_DINERS_PER_ORDER) {
      setFormError(`Máximo ${MAX_DINERS_PER_ORDER} cuentas por orden.`);
      return;
    }
    const id = `diner-${Date.now()}`;
    const newDiner: OrderDiner = { id, label: clean, isShared: false };
    const sharedIdx = diners.findIndex((d) => d.isShared);
    const nextDiners =
      sharedIdx >= 0
        ? [...diners.slice(0, sharedIdx), newDiner, ...diners.slice(sharedIdx)]
        : [...diners, newDiner];

    setDiners(nextDiners);
    setActiveDinerId(id);
    setNewDinerName('');
    setFormError(null);
  };

  const handleRemoveDiner = (dinerId: string) => {
    const personal = diners.filter((d) => !d.isShared);
    if (personal.length <= 1) return;
    setDiners((prev) => prev.filter((d) => d.id !== dinerId));
    setDraftItems((prev) => prev.filter((i) => i.dinerId !== dinerId));
    if (activeDinerId === dinerId) {
      const next =
        diners.find((d) => d.id !== dinerId && !d.isShared) ||
        diners.find((d) => d.id !== dinerId);
      if (next) setActiveDinerId(next.id);
    }
  };

  const handleAddDish = (dish: MenuItem) => {
    if (!dish.available) {
      notify(`${dish.name} está marcado como Agotado (86).`, 'error');
      return;
    }
    const targetDinerId =
      diners.find((d) => d.id === activeDinerId)?.id || diners[0]?.id || 'diner-1';
    const hasMergeableLine = draftItems.some(
      (line) => line.dishId === dish.id && line.dinerId === targetDinerId && line.notes === ''
    );
    if (!hasMergeableLine && draftItems.length >= MAX_ITEMS_PER_ORDER) {
      setFormError(`Máximo ${MAX_ITEMS_PER_ORDER} líneas de platillos por comanda.`);
      return;
    }
    setFormError(null);
    setDraftItems((prev) => {
      const existingIdx = prev.findIndex(
        (line) => line.dishId === dish.id && line.dinerId === targetDinerId && line.notes === ''
      );
      if (existingIdx >= 0) {
        return prev.map((line, idx) =>
          idx === existingIdx ? { ...line, qty: Math.min(99, line.qty + 1) } : line
        );
      }
      if (prev.length >= MAX_ITEMS_PER_ORDER) {
        return prev;
      }
      const newLine: OrderLineItem = {
        lineId: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dishId: dish.id,
        name: dish.name,
        categoryId: dish.categoryId,
        station: dish.station,
        unitPrice: dish.price,
        qty: 1,
        dinerId: targetDinerId,
        notes: '',
      };
      return [...prev, newLine];
    });
  };

  const handleChangeLineQty = (lineId: string, delta: number) => {
    setDraftItems((prev) =>
      prev
        .map((line) =>
          line.lineId === lineId ? { ...line, qty: Math.min(99, line.qty + delta) } : line
        )
        .filter((line) => line.qty > 0)
    );
  };

  const handleUpdateLineNote = (lineId: string, notes: string) => {
    setDraftItems((prev) =>
      prev.map((line) =>
        line.lineId === lineId ? { ...line, notes: notes.slice(0, MAX_LINE_NOTES_LENGTH) } : line
      )
    );
  };

  const handleSubmitOrder = async () => {
    setFormError(null);

    const editingOrder = editingOrderId
      ? orders.find((o) => o.id === editingOrderId) || null
      : null;

    // When editing an existing order, allow keeping items already sent to kitchen even if later marked Agotado (86);
    // only block newly added dishes or quantity increases on an Agotado dish.
    const existingQtyByDish = new Map<string, number>();
    if (editingOrder) {
      for (const line of editingOrder.items) {
        existingQtyByDish.set(line.dishId, (existingQtyByDish.get(line.dishId) || 0) + line.qty);
      }
    }
    const draftQtyByDish = new Map<string, number>();
    for (const line of draftItems) {
      draftQtyByDish.set(line.dishId, (draftQtyByDish.get(line.dishId) || 0) + line.qty);
    }

    const unavailableInDraft = draftItems.find((line) => {
      const catalogDish = menuItems.find((m) => m.id === line.dishId);
      if (!catalogDish || catalogDish.available) return false;
      if (!editingOrder) return true;
      const prevQty = existingQtyByDish.get(line.dishId) || 0;
      const nextQty = draftQtyByDish.get(line.dishId) || 0;
      return nextQty > prevQty;
    });
    if (unavailableInDraft) {
      setFormError(
        `"${unavailableInDraft.name}" fue marcado como Agotado (86) por Administración. Quítalo o reduce las unidades nuevas antes de enviar.`
      );
      return;
    }

    if (editingOrderId) {
      if (draftItems.length === 0) {
        setFormError('La comanda debe conservar al menos un platillo.');
        return;
      }
      if (
        editingOrder &&
        editingOrder.status === 'preparing' &&
        draftSubtotal < editingOrder.subtotal
      ) {
        setFormError(
          'Esta orden ya está en preparación en cocina; puedes agregar platillos, pero no reducir el total. Si requieres cancelarla, solicítalo al Administrador.'
        );
        return;
      }
      setSubmitting(true);
      try {
        await appendItemsToOrder({
          orderId: editingOrderId,
          diners,
          items: draftItems,
          splitSharedEqually,
          orderNotes,
        });
        resetDraft(serviceType);
      } catch (err) {
        setFormError(extractFriendlyErrorMessage(err, 'No se pudo actualizar la comanda.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const validationError = validateNewOrderInput({
      serviceType,
      diners,
      items: draftItems,
      customerName,
      phone,
      street,
      colony,
      reference,
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await createOrder({
        serviceType,
        diners,
        items: draftItems,
        splitSharedEqually,
        orderNotes,
        customerName,
        phone,
        street,
        colony,
        reference,
      });
      resetDraft(serviceType);
    } catch (err) {
      setFormError(extractFriendlyErrorMessage(err, 'No se pudo enviar la comanda.'));
    } finally {
      setSubmitting(false);
    }
  };

  const activeDiner = diners.find((d) => d.id === activeDinerId) || diners[0];

  return (
    <div className="space-y-6">
      {/* Live Kitchen-Ready Banner for Waiters */}
      {readyToServeOrders.length > 0 && (
        <section
          aria-label="Órdenes listas en cocina para entregar"
          className="bg-[#181412] border border-emerald-700/50 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div className="space-y-0.5">
            <h2 className="font-heading text-base uppercase tracking-wide text-emerald-400">
              Listas para Recoger en Cocina ({readyToServeOrders.length})
            </h2>
            <p className="text-xs text-stone-400">
              Marca como servida en cuanto entregues los platillos en la mesa para habilitar caja.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {readyToServeOrders.map((order) => {
              const isBusy = servingOrderId === order.id;
              return (
                <button
                  key={order.id}
                  type="button"
                  disabled={servingOrderId !== null}
                  onClick={() => void handleMarkServed(order.id)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isBusy ? 'Actualizando...' : `Servir ${order.serviceType} · ${order.folio}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Restaurant Floor Map */}
      <section aria-label="Mapa de mesas en tiempo real" className="bg-[#161210] border border-stone-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-base uppercase tracking-wide text-white">
              Mapa de Mesas y Servicio
            </h2>
            <p className="text-xs text-stone-400">
              Selecciona una mesa libre para tomar comanda o una activa en cocina para agregar platillos.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-400">
            <span>Libre</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400">En Cocina</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400">Lista</span>
            <span aria-hidden="true">·</span>
            <span className="text-sky-400">Por Cobrar</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-12 gap-2">
          {SERVICE_TYPES.map((slot) => {
            const active = activeOrdersByTable.get(slot);
            const activeCount = activeCountBySlot.get(slot) || 0;
            const isSelected = serviceType === slot;
            const statusMeta = active ? ORDER_STATUS_META[active.status] : null;
            const isTable = TABLE_OPTIONS.includes(slot);

            return (
              <button
                key={slot}
                type="button"
                onClick={() => handleSelectTableFromMap(slot)}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-orange-600/15 border-orange-500 text-white'
                    : active
                      ? 'bg-[#1f1a17] border-stone-700 hover:border-stone-500 text-stone-100'
                      : 'bg-[#120f0d] border-stone-800/90 hover:border-stone-700 text-stone-300'
                }`}
              >
                <div className="text-xs font-semibold truncate">
                  {isTable ? slot : slot === 'Para Llevar' ? 'Llevar' : 'Domicilio'}
                </div>
                <div className={`text-[11px] mt-0.5 truncate ${statusMeta ? statusMeta.colorClass : 'text-stone-500'}`}>
                  {!isTable && activeCount > 1
                    ? `${activeCount} activas`
                    : statusMeta
                      ? statusMeta.shortLabel
                      : 'Libre'}
                </div>
              </button>
            );
          })}
        </div>

        {editableMultiSlotOrders.length > 0 && (
          <div className="pt-2 border-t border-stone-800/80 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-stone-400">Editar orden activa Llevar/Domicilio:</span>
            {editableMultiSlotOrders.map((ord) => (
              <button
                key={ord.id}
                type="button"
                onClick={() => loadOrderIntoEditor(ord)}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-medium cursor-pointer transition ${
                  editingOrderId === ord.id
                    ? 'bg-orange-600/20 border-orange-500 text-white'
                    : 'bg-[#120f0d] border-stone-800 hover:border-stone-600 text-stone-300'
                }`}
              >
                {ord.serviceType === 'Para Llevar' ? 'Llevar' : 'Domicilio'} · {ord.folio} ({formatMXN(ord.subtotal)})
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Main Split Workspace: Menu Catalog (Left) + Order Ticket Builder (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Menu Catalog */}
        <section className="xl:col-span-7 bg-[#161210] border border-stone-800 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl uppercase tracking-wide text-white">
                Menú Oficial LA OBRERA
              </h2>
              <p className="text-xs text-stone-400">
                Agregando a la cuenta de <strong className="text-amber-400">{activeDiner?.label}</strong>
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <label htmlFor="waiter-menu-search" className="sr-only">
                Buscar platillo
              </label>
              <input
                id="waiter-menu-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar corte, mixote, bebida..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 focus:border-orange-500 focus:outline-none text-sm text-white placeholder-stone-500"
              />
            </div>
          </div>

          {/* Interactive Category Filter Bar */}
          <div className="flex items-center sm:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-2.5 border-b border-stone-800">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition ${
                selectedCategory === 'all'
                  ? 'bg-orange-600 text-white'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              Todos ({menuItems.length})
            </button>
            {MENU_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition ${
                  selectedCategory === cat.id
                    ? 'bg-orange-600 text-white'
                    : 'text-stone-400 hover:text-white hover:bg-stone-800/80'
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>

          {/* Menu Grid */}
          {filteredMenu.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-400">
              No se encontraron platillos con &ldquo;{searchTerm}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[620px] overflow-y-auto pr-1">
              {filteredMenu.map((dish) => {
                const qtyForActive = draftItems
                  .filter((i) => i.dishId === dish.id && i.dinerId === activeDinerId)
                  .reduce((acc, i) => acc + i.qty, 0);

                return (
                  <div
                    key={dish.id}
                    className={`p-3.5 rounded-lg border transition flex items-start justify-between gap-3 ${
                      !dish.available
                        ? 'bg-[#120f0d] border-stone-800/60 opacity-60'
                        : qtyForActive > 0
                          ? 'bg-[#1f1916] border-orange-600/60'
                          : 'bg-[#1a1613] border-stone-800 hover:border-stone-600'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-sm font-semibold text-white leading-snug">
                          {dish.name}
                        </h3>
                        {!dish.available && (
                          <span className="text-[11px] font-semibold text-red-400">Agotado</span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 line-clamp-2">{dish.desc}</p>
                      <div className="text-xs text-stone-500 flex items-center gap-2 pt-0.5">
                        <span className="font-mono-tabular text-sm font-semibold text-amber-400">
                          {formatMXN(dish.price)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{dish.station}</span>
                        {qtyForActive > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-orange-400 font-medium">{qtyForActive} en cuenta</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!dish.available}
                      onClick={() => handleAddDish(dish)}
                      aria-label={`Agregar ${dish.name}`}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 transition ${
                        dish.available
                          ? 'bg-stone-800 hover:bg-orange-600 text-white cursor-pointer'
                          : 'bg-stone-900 text-stone-600 cursor-not-allowed'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Active Order & Split Accounts Composer */}
        <section className="xl:col-span-5 bg-[#161210] border border-stone-800 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-800">
            <div>
              <h2 className="font-heading text-xl uppercase tracking-wide text-white">
                {editingOrderId ? `Editar Comanda · ${serviceType}` : `Nueva Comanda · ${serviceType}`}
              </h2>
              <p className="text-xs text-stone-400">
                Cuentas separadas por persona con envío inmediato a cocina
              </p>
            </div>
            {editingOrderId && (
              <button
                type="button"
                onClick={() => resetDraft(serviceType)}
                className="px-2.5 py-1.5 rounded-md border border-stone-700 text-xs text-stone-300 hover:text-white cursor-pointer"
              >
                Nueva orden
              </button>
            )}
          </div>

          {editingOrderId && (
            <div className="px-3 py-2 rounded-lg bg-stone-900/90 border border-stone-800 text-[11px] text-stone-400">
              Para <strong className="text-stone-200">cancelar completamente</strong> este pedido,
              solicítalo al <strong className="text-amber-400">Administrador</strong> (solo
              Administración puede cancelar pedidos).
            </div>
          )}

          {/* Diners / Per-Person Accounts Bar */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Comensales (Cuentas por Persona)</span>
              </span>
              <label className="flex items-center gap-1.5 text-stone-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitSharedEqually}
                  onChange={(e) => setSplitSharedEqually(e.target.checked)}
                  className="accent-orange-600"
                />
                <span>Dividir Al Centro</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {diners.map((diner) => {
                const isSelected = activeDinerId === diner.id;
                const breakdown = dinerBreakdowns.find((b) => b.diner.id === diner.id);
                return (
                  <div key={diner.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveDinerId(diner.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                        isSelected
                          ? 'bg-orange-600 text-white'
                          : 'bg-[#1f1a17] text-stone-300 hover:bg-stone-800 border border-stone-800'
                      }`}
                    >
                      {diner.label}
                      {breakdown && breakdown.ownSubtotal > 0 ? ` · ${formatMXN(breakdown.ownSubtotal)}` : ''}
                    </button>
                    {!diner.isShared && diners.filter((d) => !d.isShared).length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDiner(diner.id)}
                        aria-label={`Quitar cuenta de ${diner.label}`}
                        className="p-1.5 rounded-md text-stone-500 hover:text-red-400 hover:bg-stone-900 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleAddDiner} className="flex items-center gap-2">
              <label htmlFor="new-diner-input" className="sr-only">
                Nombre del comensal
              </label>
              <input
                id="new-diner-input"
                type="text"
                maxLength={80}
                value={newDinerName}
                onChange={(e) => setNewDinerName(e.target.value)}
                placeholder="Agregar persona (ej. Carlos Mendoza)..."
                className="flex-1 px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 focus:border-orange-500 focus:outline-none text-xs text-white placeholder-stone-500"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition"
              >
                <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>Agregar</span>
              </button>
            </form>
          </div>

          {/* Delivery / Takeout Private Customer Fields (PII Isolated) */}
          {!editingOrderId && (serviceType === 'Servicio a Domicilio' || serviceType === 'Para Llevar') && (
            <div className="p-3.5 rounded-lg bg-[#120f0d] border border-stone-800 space-y-2.5">
              <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  Datos Privados del Cliente ({serviceType === 'Servicio a Domicilio' ? 'Requerido' : 'Opcional'})
                </span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  maxLength={MAX_CUSTOMER_NAME_LENGTH}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre completo del cliente"
                  aria-label="Nombre completo del cliente"
                  className="px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                />
                <input
                  type="tel"
                  maxLength={MAX_PHONE_LENGTH}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Teléfono / WhatsApp"
                  aria-label="Teléfono del cliente"
                  className="px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
              {serviceType === 'Servicio a Domicilio' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      maxLength={MAX_STREET_LENGTH}
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Calle y número *"
                      aria-label="Calle y número"
                      className="px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      maxLength={MAX_COLONY_LENGTH}
                      value={colony}
                      onChange={(e) => setColony(e.target.value)}
                      placeholder="Colonia *"
                      aria-label="Colonia"
                      className="px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    maxLength={MAX_REFERENCE_LENGTH}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Referencia del domicilio *"
                    aria-label="Referencia del domicilio"
                    className="w-full px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                  />
                </>
              )}
              <p className="text-[11px] text-stone-500">
                Privacidad protegida: Cocina no visualiza teléfono ni dirección del cliente.
              </p>
            </div>
          )}

          {/* Ordered Items Grouped by Diner */}
          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {draftItems.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-stone-800 rounded-lg text-xs text-stone-500">
                Selecciona platillos del menú para armar la comanda de {serviceType}.
              </div>
            ) : (
              dinerBreakdowns.map((group) => {
                if (group.items.length === 0 && group.sharedAllocation === 0) return null;
                return (
                  <div
                    key={group.diner.id}
                    className="border-t border-stone-800 pt-3 first:border-t-0 first:pt-0 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-400">{group.diner.label}</span>
                      <span className="font-mono-tabular text-stone-300 font-semibold">
                        {formatMXN(group.finalTotal)}
                      </span>
                    </div>

                    {group.items.map((line) => (
                      <div key={line.lineId} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="text-stone-100 font-medium truncate">{line.name}</p>
                            <div className="text-[11px] text-stone-500 flex items-center gap-2">
                              <span className="font-mono-tabular">{formatMXN(line.unitPrice)} c/u</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingNoteLineId(
                                    editingNoteLineId === line.lineId ? null : line.lineId
                                  )
                                }
                                className="text-amber-400 hover:underline cursor-pointer"
                              >
                                {line.notes ? `Nota: ${line.notes}` : '+ Término / Nota'}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleChangeLineQty(line.lineId, -1)}
                              aria-label={`Disminuir ${line.name}`}
                              className="w-7 h-7 rounded-md bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono-tabular w-5 text-center font-semibold text-white">
                              {line.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleChangeLineQty(line.lineId, 1)}
                              aria-label={`Aumentar ${line.name}`}
                              className="w-7 h-7 rounded-md bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <span className="font-mono-tabular text-xs font-semibold text-stone-200 w-16 text-right shrink-0">
                            {formatMXN(line.unitPrice * line.qty)}
                          </span>
                        </div>

                        {editingNoteLineId === line.lineId && (
                          <div className="p-2.5 rounded-lg bg-[#0e0c0b] border border-stone-800 space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {COOKING_NOTE_PRESETS.map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => handleUpdateLineNote(line.lineId, preset)}
                                  className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[11px] text-stone-200 cursor-pointer"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                            <input
                              type="text"
                              maxLength={MAX_LINE_NOTES_LENGTH}
                              value={line.notes}
                              onChange={(e) => handleUpdateLineNote(line.lineId, e.target.value)}
                              placeholder="Ej. Término medio, sin cebolla..."
                              className="w-full px-2.5 py-1.5 rounded bg-[#161210] border border-stone-700 text-xs text-white focus:border-orange-500 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* General Kitchen Note */}
          <div>
            <label htmlFor="order-general-notes" className="block text-xs text-stone-400 mb-1">
              Nota general para cocina (opcional)
            </label>
            <input
              id="order-general-notes"
              type="text"
              maxLength={MAX_ORDER_NOTES_LENGTH}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Ej. Sacar entradas primero, salsas aparte..."
              className="w-full px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 focus:border-orange-500 focus:outline-none text-xs text-white placeholder-stone-500"
            />
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200"
            >
              {formError}
            </div>
          )}

          {/* Footer Total + Send Button */}
          <div className="pt-3 border-t border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-400">Subtotal de comanda</span>
              <span className="font-mono-tabular text-2xl font-bold text-amber-400">
                {formatMXN(draftSubtotal)}
              </span>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmitOrder()}
              className="w-full py-3 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Send className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Enviando...'
                  : editingOrderId
                    ? 'Guardar Cambios en Comanda'
                    : 'Enviar Pedido a Cocina'}
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
