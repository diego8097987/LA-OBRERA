import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  BarChart3,
  Calculator,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileDown,
  Lock,
  Plus,
  Receipt,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import { MENU_CATEGORIES } from '../data/menuCatalog';
import { extractFriendlyErrorMessage } from '../firebase';
import { useTodayDateKey } from '../hooks/useTodayDateKey';
import type {
  ActiveWorkspaceRole,
  KitchenStation,
  MenuCategoryId,
  Order,
  OrderStatus,
  StaffRole,
} from '../types/pos';
import { downloadCashCutPdf, downloadDailySalesReportPdf } from '../utils/pdfExport';
import {
  buildDailyReportCsv,
  calculateCashCutReconciliation,
  canCancelOrder,
  CANCELLATION_REASON_PRESETS,
  computeDailySalesSummary,
  formatMXN,
  getLocalDateKey,
  MAX_CANCEL_REASON_LENGTH,
  MAX_MENU_DESC_LENGTH,
  MAX_MENU_NAME_LENGTH,
  ORDER_STATUS_META,
  roundMoney,
} from '../utils/posCalculations';
import { TicketModal } from './TicketModal';

type AdminTab = 'monitor' | 'reports' | 'menu' | 'staff';

export const AdminView: React.FC = () => {
  const {
    orders,
    menuItems,
    staffList,
    cashRegister,
    dailyReports,
    auditLogs,
    cancelOrder,
    loadOrderPrivateCustomer,
    addMenuItem,
    deleteMenuItem,
    toggleMenuAvailability,
    updateMenuPrice,
    createStaffAccount,
    updateStaffRole,
    deletePendingStaff,
    openCashRegister,
    closeCashRegisterAndSaveCut,
    currentStaff,
    notify,
  } = usePos();

  const [activeTab, setActiveTab] = useState<AdminTab>('monitor');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getLocalDateKey());
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState<string>(CANCELLATION_REASON_PRESETS[0]);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<boolean>(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [ticketOrder, setTicketOrder] = useState<Order | null>(null);

  // Admin-exclusive Cash Register Open / Close Modals
  const [showOpenRegisterModal, setShowOpenRegisterModal] = useState<boolean>(false);
  const [openFundInput, setOpenFundInput] = useState<string>('500');
  const [openRegisterError, setOpenRegisterError] = useState<string | null>(null);
  const [openingRegister, setOpeningRegister] = useState<boolean>(false);

  const [showCloseRegisterModal, setShowCloseRegisterModal] = useState<boolean>(false);
  const [countedCashInput, setCountedCashInput] = useState<string>('');
  const [closeRegisterError, setCloseRegisterError] = useState<string | null>(null);
  const [closingRegister, setClosingRegister] = useState<boolean>(false);

  // Admin Add New Menu Dish form state
  const [newDishName, setNewDishName] = useState<string>('');
  const [newDishCategory, setNewDishCategory] = useState<MenuCategoryId>('cortes');
  const [newDishStation, setNewDishStation] = useState<KitchenStation>('parrilla');
  const [newDishPrice, setNewDishPrice] = useState<string>('');
  const [newDishDesc, setNewDishDesc] = useState<string>('');
  const [addingDish, setAddingDish] = useState<boolean>(false);
  const [dishFormFeedback, setDishFormFeedback] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  // Pending registration role selection map (uid -> selected function before approving)
  const [pendingRoleSelection, setPendingRoleSelection] = useState<
    Record<string, ActiveWorkspaceRole>
  >({});

  // Admin staff account creation state
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffEmail, setNewStaffEmail] = useState<string>('');
  const [newStaffPassword, setNewStaffPassword] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<ActiveWorkspaceRole>('mesero');
  const [showNewStaffPass, setShowNewStaffPass] = useState<boolean>(false);
  const [creatingStaff, setCreatingStaff] = useState<boolean>(false);
  const [staffFormFeedback, setStaffFormFeedback] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  const pendingRegistrations = useMemo(
    () => staffList.filter((s) => s.role === 'pending'),
    [staffList]
  );

  const assignedStaff = useMemo(
    () => staffList.filter((s) => s.role !== 'pending'),
    [staffList]
  );

  const summary = useMemo(
    () => computeDailySalesSummary(orders, selectedDateKey),
    [orders, selectedDateKey]
  );

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (o.dateKey !== selectedDateKey) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.folio.toLowerCase().includes(q) ||
        o.serviceType.toLowerCase().includes(q) ||
        o.waiterName.toLowerCase().includes(q)
      );
    });
  }, [orders, selectedDateKey, statusFilter, orderSearch]);

  // All active unpaid waiter orders across all dates so Admin can always cancel any live order immediately
  const activeWaiterOrders = useMemo(
    () =>
      orders
        .filter((o) => canCancelOrder('admin', o.status))
        .sort((a, b) => b.createdAtMs - a.createdAtMs),
    [orders]
  );

  const cancellationNoteByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    for (const log of auditLogs) {
      if (log.action === 'ORDER_CANCELLED' && !map.has(log.targetId)) {
        map.set(log.targetId, log.summary);
      }
    }
    return map;
  }, [auditLogs]);

  const filteredMenu = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return menuItems.filter(
      (i) => !q || i.name.toLowerCase().includes(q) || i.categoryId.toLowerCase().includes(q)
    );
  }, [menuItems, menuSearch]);

  const maxCategoryRevenue = useMemo(
    () => Math.max(1, ...summary.categoryTotals.map((c) => c.revenue)),
    [summary.categoryTotals]
  );

  const todayKey = useTodayDateKey();
  const isRegisterOpen = Boolean(cashRegister?.isOpen);
  // Keep cash cut aligned to the date the register was opened (handles shifts closing past midnight)
  const activeRegisterDateKey =
    isRegisterOpen && cashRegister?.dateKey ? cashRegister.dateKey : todayKey;

  const registerShiftSummary = useMemo(
    () => computeDailySalesSummary(orders, activeRegisterDateKey),
    [orders, activeRegisterDateKey]
  );

  const activeOpeningCash = cashRegister?.openingCash ?? 0;
  const expectedCashNow = roundMoney(activeOpeningCash + registerShiftSummary.cashTotal);

  const numericCountedCash = useMemo(() => {
    const parsed = Number.parseFloat(countedCashInput);
    return Number.isFinite(parsed) && parsed >= 0 ? roundMoney(parsed) : 0;
  }, [countedCashInput]);

  const cashCutPreview = useMemo(
    () =>
      calculateCashCutReconciliation({
        openingCash: activeOpeningCash,
        cashSales: registerShiftSummary.cashTotal,
        countedCash: numericCountedCash,
      }),
    [activeOpeningCash, registerShiftSummary.cashTotal, numericCountedCash]
  );

  const todaySavedCut = useMemo(
    () => dailyReports.find((r) => r.dateKey === activeRegisterDateKey) || null,
    [dailyReports, activeRegisterDateKey]
  );

  const handleDownloadSalesReportPdf = async () => {
    const filename = await downloadDailySalesReportPdf({
      orders,
      dateKey: selectedDateKey,
      generatedByName: currentStaff?.displayName || 'Administrador',
    });
    notify(`Reporte Diario de Ventas PDF descargado (${filename}).`, 'success');
  };

  const handleOpenCancelModal = (order: Order) => {
    setCancelModalOrder(order);
    setCancelReason(CANCELLATION_REASON_PRESETS[0]);
    setCancelError(null);
  };

  const handleConfirmCancelOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalOrder) return;
    setCancelError(null);
    setCancellingOrder(true);
    try {
      const res = await cancelOrder(cancelModalOrder.id, cancelReason);
      if (res.ok) {
        setCancelModalOrder(null);
      } else {
        setCancelError(res.message);
      }
    } finally {
      setCancellingOrder(false);
    }
  };

  const handleDownloadCsv = () => {
    const csv = buildDailyReportCsv(orders, selectedDateKey);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-ventas-${selectedDateKey}-la-obrera.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!showOpenRegisterModal && !showCloseRegisterModal && !cancelModalOrder) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showOpenRegisterModal && !openingRegister) {
        setShowOpenRegisterModal(false);
      }
      if (showCloseRegisterModal && !closingRegister) {
        setShowCloseRegisterModal(false);
      }
      if (cancelModalOrder && !cancellingOrder) {
        setCancelModalOrder(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showOpenRegisterModal,
    showCloseRegisterModal,
    cancelModalOrder,
    openingRegister,
    closingRegister,
    cancellingOrder,
  ]);

  const runGuardedAction = async (actionKey: string, fn: () => Promise<void>) => {
    if (busyActionId) return;
    setBusyActionId(actionKey);
    try {
      await fn();
    } finally {
      setBusyActionId(null);
    }
  };

  const handleOpenCashRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpenRegisterError(null);
    const parsed = Number.parseFloat(openFundInput);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000000) {
      setOpenRegisterError('Ingresa un fondo inicial válido entre $0 y $1,000,000 MXN.');
      return;
    }
    setOpeningRegister(true);
    try {
      await openCashRegister(parsed);
      setShowOpenRegisterModal(false);
    } catch (err) {
      setOpenRegisterError(extractFriendlyErrorMessage(err, 'No se pudo abrir la caja.'));
    } finally {
      setOpeningRegister(false);
    }
  };

  const handlePrepareCloseRegister = () => {
    setCountedCashInput(String(expectedCashNow));
    setCloseRegisterError(null);
    setShowCloseRegisterModal(true);
  };

  const handleCloseCashRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloseRegisterError(null);
    if (!cashCutPreview.valid) {
      setCloseRegisterError(cashCutPreview.error || 'Verifica los montos del arqueo.');
      return;
    }
    setClosingRegister(true);
    try {
      const savedReport = await closeCashRegisterAndSaveCut({
        dateKey: activeRegisterDateKey,
        countedCash: cashCutPreview.countedCash,
      });
      await downloadCashCutPdf({ report: savedReport, orders });
      setShowCloseRegisterModal(false);
    } catch (err) {
      setCloseRegisterError(extractFriendlyErrorMessage(err, 'No se pudo cerrar la caja.'));
    } finally {
      setClosingRegister(false);
    }
  };

  const handleAddMenuDishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDishFormFeedback(null);
    const parsedPrice = Number.parseFloat(newDishPrice);
    setAddingDish(true);
    try {
      const res = await addMenuItem({
        name: newDishName,
        categoryId: newDishCategory,
        station: newDishStation,
        price: parsedPrice,
        desc: newDishDesc,
      });
      setDishFormFeedback(res);
      if (res.ok) {
        setNewDishName('');
        setNewDishPrice('');
        setNewDishDesc('');
      }
    } finally {
      setAddingDish(false);
    }
  };

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffFormFeedback(null);
    setCreatingStaff(true);
    try {
      const res = await createStaffAccount({
        displayName: newStaffName,
        email: newStaffEmail,
        password: newStaffPassword,
        role: newStaffRole,
      });
      setStaffFormFeedback(res);
      if (res.ok) {
        setNewStaffName('');
        setNewStaffEmail('');
        setNewStaffPassword('');
        setNewStaffRole('mesero');
        setShowNewStaffPass(false);
      }
    } finally {
      setCreatingStaff(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation & Date Filter */}
      <div className="bg-[#161210] border border-stone-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-lg bg-[#0e0c0b] border border-stone-800">
          {(
            [
              { id: 'monitor', label: 'Monitor de Órdenes', icon: BarChart3 },
              { id: 'reports', label: 'Reportes Diarios', icon: Download },
              { id: 'menu', label: 'Menú y Precios', icon: SlidersHorizontal },
              {
                id: 'staff',
                label:
                  pendingRegistrations.length > 0
                    ? `Personal y Seguridad (${pendingRegistrations.length})`
                    : 'Personal y Seguridad',
                icon: Users,
              },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition ${
                activeTab === id
                  ? 'bg-orange-600 text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="admin-date-picker" className="text-xs text-stone-400 whitespace-nowrap">
            Fecha de corte:
          </label>
          <input
            id="admin-date-picker"
            type="date"
            value={selectedDateKey}
            onChange={(e) => setSelectedDateKey(e.target.value || todayKey)}
            className="px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs font-mono-tabular text-white focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Exclusive Admin Cash Register Open/Close Control Bar */}
      <section
        aria-label="Control exclusivo de apertura y cierre de caja"
        className={`bg-[#161210] border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isRegisterOpen ? 'border-emerald-800/60' : 'border-amber-700/60'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isRegisterOpen
                ? 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-400'
                : 'bg-red-950/80 border border-red-800/60 text-red-400'
            }`}
          >
            {isRegisterOpen ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <p className="font-heading text-lg uppercase tracking-wide text-white leading-tight">
              Control de Caja · {isRegisterOpen ? 'Abierta' : 'Cerrada'}
            </p>
            <p className="text-xs text-stone-400 mt-0.5">
              {isRegisterOpen
                ? `Fondo inicial: ${formatMXN(activeOpeningCash)} · Efectivo esperado en caja: ${formatMXN(expectedCashNow)} · Abierta por ${cashRegister?.openedByName || 'Administrador'}`
                : 'La caja está cerrada. El Cajero no podrá cobrar hasta que abras la caja.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {todaySavedCut && (
            <button
              type="button"
              onClick={() => void downloadCashCutPdf({ report: todaySavedCut, orders })}
              className="px-3.5 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-semibold text-stone-100 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition"
            >
              <FileDown className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Descargar Corte PDF</span>
            </button>
          )}

          {isRegisterOpen ? (
            <button
              type="button"
              onClick={handlePrepareCloseRegister}
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition"
            >
              <Calculator className="w-4 h-4 shrink-0" />
              <span>Cerrar Caja y Corte PDF</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpenFundInput('500');
                setOpenRegisterError(null);
                setShowOpenRegisterModal(true);
              }}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition"
            >
              <Unlock className="w-4 h-4 shrink-0" />
              <span>Abrir Caja</span>
            </button>
          )}
        </div>
      </section>

      {/* KPI Strip */}
      <section aria-label="Indicadores del día" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#161210] border border-stone-800 rounded-xl p-4">
          <p className="text-xs text-stone-400">Ventas Cobradas ({selectedDateKey})</p>
          <p className="font-mono-tabular text-2xl font-bold text-amber-400 mt-1">
            {formatMXN(summary.totalRevenue)}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {summary.paidOrderCount} órdenes pagadas · {formatMXN(summary.totalTips)} propinas
          </p>
        </div>

        <div className="bg-[#161210] border border-stone-800 rounded-xl p-4">
          <p className="text-xs text-stone-400">Órdenes Activas Ahora</p>
          <p className="font-mono-tabular text-2xl font-bold text-white mt-1">
            {summary.activeOrderCount}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            En cocina, listas o servidas
          </p>
        </div>

        <div className="bg-[#161210] border border-stone-800 rounded-xl p-4">
          <p className="text-xs text-stone-400">Ticket Promedio</p>
          <p className="font-mono-tabular text-2xl font-bold text-white mt-1">
            {formatMXN(summary.averageTicket)}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {summary.cancelledOrderCount} canceladas
          </p>
        </div>

        <div className="bg-[#161210] border border-stone-800 rounded-xl p-4">
          <p className="text-xs text-stone-400">Desglose de Cobro</p>
          <p className="font-mono-tabular text-sm font-semibold text-stone-200 mt-1.5">
            Efectivo: {formatMXN(summary.cashTotal)}
          </p>
          <p className="font-mono-tabular text-xs text-stone-400 mt-0.5">
            Tarjeta: {formatMXN(summary.cardTotal)} · Transf: {formatMXN(summary.transferTotal)}
          </p>
        </div>
      </section>

      {/* TAB 1: LIVE ORDER MONITOR & ADMIN-ONLY CANCELLATIONS */}
      {activeTab === 'monitor' && (
        <div className="space-y-6">
          {/* Dedicated Live Active Waiter Orders Panel (Admin-Exclusive Cancellation Control) */}
          <section
            aria-label="Cancelación exclusiva de pedidos activos de meseros"
            className="bg-[#161210] border border-red-900/45 rounded-xl p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3">
              <div>
                <h2 className="font-heading text-xl uppercase tracking-wide text-white flex items-center gap-2">
                  <Ban className="w-5 h-5 text-red-400 shrink-0" />
                  <span>
                    Pedidos Activos de Meseros · Cancelación ({activeWaiterOrders.length})
                  </span>
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Solo el Administrador puede cancelar pedidos tomados por meseros. Al cancelar, el
                  pedido desaparece al instante de Cocina, Caja y la mesa del Mesero.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-red-950/60 border border-red-800/60 text-[11px] font-semibold text-red-200 whitespace-nowrap">
                Exclusivo Administrador
              </span>
            </div>

            {activeWaiterOrders.length === 0 ? (
              <p className="text-xs text-stone-500 py-5 text-center border border-dashed border-stone-800 rounded-lg">
                No hay pedidos activos de meseros pendientes por cobrar o preparar en este momento.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {activeWaiterOrders.map((order) => {
                  const meta = ORDER_STATUS_META[order.status];
                  const itemQtyTotal = order.items.reduce((acc, i) => acc + i.qty, 0);
                  const previewDishes = order.items
                    .slice(0, 3)
                    .map((i) => `${i.qty}x ${i.name}`)
                    .join(', ');
                  return (
                    <div
                      key={order.id}
                      className="p-3.5 rounded-lg bg-[#120f0d] border border-stone-800 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-heading text-base uppercase tracking-wide text-white leading-tight truncate">
                              {order.serviceType} · {order.folio}
                            </p>
                            <p className="text-xs text-stone-400 truncate">
                              Mesero: <strong className="text-stone-200">{order.waiterName}</strong>
                            </p>
                          </div>
                          <span className="font-mono-tabular text-sm font-bold text-amber-400 shrink-0">
                            {formatMXN(order.total)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className={`font-semibold ${meta.colorClass}`}>{meta.label}</span>
                          <span className="text-stone-500">
                            {itemQtyTotal} {itemQtyTotal === 1 ? 'platillo' : 'platillos'}
                          </span>
                        </div>

                        <p className="text-[11px] text-stone-400 line-clamp-2">
                          {previewDishes}
                          {order.items.length > 3 ? ` (+${order.items.length - 3} más)` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-stone-800/80">
                        <button
                          type="button"
                          onClick={() => setTicketOrder(order)}
                          className="flex-1 px-2.5 py-1.5 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                        >
                          <Receipt className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Ver Detalle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenCancelModal(order)}
                          className="flex-1 px-2.5 py-1.5 rounded-md bg-red-950/80 hover:bg-red-700 text-red-200 hover:text-white border border-red-800/70 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                        >
                          <Ban className="w-3.5 h-3.5 shrink-0" />
                          <span>Cancelar Pedido</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-[#161210] border border-stone-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'all', label: 'Todas' },
                  { id: 'pending', label: 'Pendientes' },
                  { id: 'preparing', label: 'Cocinando' },
                  { id: 'ready', label: 'Listas' },
                  { id: 'served', label: 'Por Cobrar' },
                  { id: 'paid', label: 'Pagadas' },
                  { id: 'cancelled', label: 'Canceladas' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition ${
                    statusFilter === f.id
                      ? 'bg-orange-600 text-white'
                      : 'text-stone-400 hover:text-white hover:bg-stone-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <label htmlFor="admin-order-search" className="sr-only">
                Buscar orden
              </label>
              <input
                id="admin-order-search"
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Buscar folio, mesa o mesero..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-800 text-stone-400">
                  <th className="py-2.5 pr-4 font-semibold">Folio</th>
                  <th className="py-2.5 pr-4 font-semibold">Servicio</th>
                  <th className="py-2.5 pr-4 font-semibold">Estado</th>
                  <th className="py-2.5 pr-4 font-semibold">Mesero</th>
                  <th className="py-2.5 pr-4 font-semibold">Pago</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Total</th>
                  <th className="py-2.5 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/70">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-stone-500">
                      No hay órdenes registradas para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const meta = ORDER_STATUS_META[order.status];
                    const cancelAuditNote =
                      order.status === 'cancelled'
                        ? cancellationNoteByOrderId.get(order.id)
                        : undefined;
                    return (
                      <tr key={order.id} className="hover:bg-stone-900/40">
                        <td className="py-3 pr-4 font-mono-tabular font-semibold text-stone-200 whitespace-nowrap">
                          {order.folio}
                        </td>
                        <td className="py-3 pr-4 text-white whitespace-nowrap">
                          {order.serviceType}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`font-medium whitespace-nowrap ${meta.colorClass}`}>
                            {meta.label}
                          </span>
                          {cancelAuditNote && (
                            <p className="text-[11px] text-stone-500 max-w-xs truncate" title={cancelAuditNote}>
                              {cancelAuditNote}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-stone-300 whitespace-nowrap">
                          {order.waiterName}
                        </td>
                        <td className="py-3 pr-4 text-stone-400 capitalize whitespace-nowrap">
                          {order.paymentMethod === 'none' ? 'Pendiente' : order.paymentMethod}
                        </td>
                        <td className="py-3 pr-4 font-mono-tabular font-semibold text-amber-400 text-right whitespace-nowrap">
                          {formatMXN(order.total)}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setTicketOrder(order)}
                              className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Receipt className="w-3 h-3 text-amber-400" />
                              <span>Ver Ticket</span>
                            </button>

                            {canCancelOrder('admin', order.status) && (
                              <button
                                type="button"
                                onClick={() => handleOpenCancelModal(order)}
                                className="px-2.5 py-1 rounded bg-red-950/75 hover:bg-red-700 text-red-200 hover:text-white border border-red-800/70 inline-flex items-center gap-1 font-semibold cursor-pointer transition"
                              >
                                <Ban className="w-3 h-3" />
                                <span>Cancelar Pedido</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </section>
        </div>
      )}

      {/* TAB 2: DAILY SALES REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <section className="bg-[#161210] border border-stone-800 rounded-xl p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-4">
              <div>
                <h2 className="font-heading text-xl uppercase tracking-wide text-white">
                  Reporte Diario de Ventas · {selectedDateKey}
                </h2>
                <p className="text-xs text-stone-400">
                  Ventas en tiempo real, descarga en PDF oficial, exportación CSV y cierres de caja (exclusivo Administrador).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownloadSalesReportPdf()}
                  className="px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer"
                >
                  <FileDown className="w-4 h-4 shrink-0" />
                  <span>Descargar Reporte PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="px-3.5 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-200 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Sales Bar Chart */}
              <div className="space-y-3">
                <h3 className="font-heading text-base uppercase tracking-wide text-stone-200">
                  Ventas por Categoría
                </h3>
                {summary.categoryTotals.length === 0 ? (
                  <p className="text-xs text-stone-500 py-8 text-center border border-dashed border-stone-800 rounded-lg">
                    Sin ventas pagadas en {selectedDateKey}.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {summary.categoryTotals.map((cat) => {
                      const catMeta = MENU_CATEGORIES.find((c) => c.id === cat.categoryId);
                      const pct = Math.max(4, Math.round((cat.revenue / maxCategoryRevenue) * 100));
                      return (
                        <div key={cat.categoryId} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-stone-200 font-medium">
                              {catMeta?.title || cat.categoryId} ({cat.qty} uds)
                            </span>
                            <span className="font-mono-tabular font-semibold text-amber-400">
                              {formatMXN(cat.revenue)}
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-stone-900 overflow-hidden">
                            <div
                              className="h-full bg-orange-600 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Dishes */}
              <div className="space-y-3">
                <h3 className="font-heading text-base uppercase tracking-wide text-stone-200">
                  Platillos Más Vendidos
                </h3>
                {summary.topDishes.length === 0 ? (
                  <p className="text-xs text-stone-500 py-8 text-center border border-dashed border-stone-800 rounded-lg">
                    Aún no hay platillos cobrados en esta fecha.
                  </p>
                ) : (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-800 text-stone-400">
                        <th className="py-2 text-left font-semibold">Platillo</th>
                        <th className="py-2 text-right font-semibold">Cantidad</th>
                        <th className="py-2 text-right font-semibold">Ingreso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/70">
                      {summary.topDishes.map((dish) => (
                        <tr key={dish.dishId}>
                          <td className="py-2.5 text-stone-100 font-medium">{dish.name}</td>
                          <td className="py-2.5 text-right font-mono-tabular text-stone-300">
                            {dish.qty}
                          </td>
                          <td className="py-2.5 text-right font-mono-tabular font-semibold text-amber-400">
                            {formatMXN(dish.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {dailyReports.length > 0 && (
              <div className="pt-4 border-t border-stone-800 space-y-2">
                <h3 className="font-heading text-base uppercase tracking-wide text-stone-200">
                  Historial de Cierres de Caja (Administrador)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-800 text-stone-400">
                        <th className="py-2 text-left">Fecha</th>
                        <th className="py-2 text-right">Órdenes</th>
                        <th className="py-2 text-right">Efectivo</th>
                        <th className="py-2 text-right">Tarjeta</th>
                        <th className="py-2 text-right">Arqueo</th>
                        <th className="py-2 text-right">Total</th>
                        <th className="py-2 text-right">Responsable</th>
                        <th className="py-2 text-right">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/70">
                      {dailyReports.map((rep) => (
                        <tr key={rep.dateKey}>
                          <td className="py-2 font-mono-tabular text-white">{rep.dateKey}</td>
                          <td className="py-2 text-right font-mono-tabular text-stone-300">
                            {rep.orderCount}
                          </td>
                          <td className="py-2 text-right font-mono-tabular text-stone-300">
                            {formatMXN(rep.cashTotal)}
                          </td>
                          <td className="py-2 text-right font-mono-tabular text-stone-300">
                            {formatMXN(rep.cardTotal)}
                          </td>
                          <td
                            className={`py-2 text-right font-mono-tabular ${
                              Math.abs(rep.cashDifference) < 0.005
                                ? 'text-emerald-400'
                                : rep.cashDifference > 0
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                            }`}
                          >
                            {Math.abs(rep.cashDifference) < 0.005
                              ? 'Cuadrado'
                              : `${rep.cashDifference > 0 ? '+' : ''}${formatMXN(rep.cashDifference)}`}
                          </td>
                          <td className="py-2 text-right font-mono-tabular font-semibold text-amber-400">
                            {formatMXN(rep.totalSales)}
                          </td>
                          <td className="py-2 text-right text-stone-400">{rep.generatedByName}</td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void downloadCashCutPdf({ report: rep, orders })}
                              className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-amber-400 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <FileDown className="w-3 h-3 shrink-0" />
                              <span>PDF</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: MENU, ADD DISHES & PRICE CONTROL */}
      {activeTab === 'menu' && (
        <div className="space-y-6">
          {/* Add New Dish Form */}
          <section className="bg-[#161210] border border-stone-800 rounded-xl p-5 space-y-4">
            <div className="border-b border-stone-800 pb-3">
              <h2 className="font-heading text-xl uppercase tracking-wide text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400 shrink-0" />
                <span>Agregar Nuevo Platillo al Menú</span>
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Los platillos nuevos y cambios de precio se reflejan al instante en la pantalla de todos los Meseros.
              </p>
            </div>

            {dishFormFeedback && (
              <div
                role={dishFormFeedback.ok ? 'status' : 'alert'}
                className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                  dishFormFeedback.ok
                    ? 'bg-emerald-950/60 border-emerald-800/70 text-emerald-200'
                    : 'bg-red-950/60 border-red-800/70 text-red-200'
                }`}
              >
                {dishFormFeedback.ok && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{dishFormFeedback.message}</span>
              </div>
            )}

            <form onSubmit={(e) => void handleAddMenuDishSubmit(e)} noValidate className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label htmlFor="new-dish-name" className="block text-xs text-stone-300">
                    Nombre del platillo
                  </label>
                  <input
                    id="new-dish-name"
                    type="text"
                    maxLength={MAX_MENU_NAME_LENGTH}
                    value={newDishName}
                    onChange={(e) => setNewDishName(e.target.value)}
                    placeholder="Ej. Tacos de Rib Eye"
                    className="w-full px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="new-dish-category" className="block text-xs text-stone-300">
                    Categoría
                  </label>
                  <select
                    id="new-dish-category"
                    value={newDishCategory}
                    onChange={(e) => setNewDishCategory(e.target.value as MenuCategoryId)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white focus:border-orange-500 focus:outline-none"
                  >
                    {MENU_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="new-dish-station" className="block text-xs text-stone-300">
                    Estación en cocina
                  </label>
                  <select
                    id="new-dish-station"
                    value={newDishStation}
                    onChange={(e) => setNewDishStation(e.target.value as KitchenStation)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white focus:border-orange-500 focus:outline-none"
                  >
                    <option value="parrilla">Parrilla</option>
                    <option value="cocina">Cocina</option>
                    <option value="barra">Barra</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="new-dish-price" className="block text-xs text-stone-300">
                    Precio (MXN)
                  </label>
                  <input
                    id="new-dish-price"
                    type="number"
                    min="1"
                    max="50000"
                    step="0.50"
                    value={newDishPrice}
                    onChange={(e) => setNewDishPrice(e.target.value)}
                    placeholder="Ej. 185"
                    className="w-full px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 font-mono-tabular text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1 space-y-1">
                  <label htmlFor="new-dish-desc" className="block text-xs text-stone-300">
                    Descripción breve (opcional)
                  </label>
                  <input
                    id="new-dish-desc"
                    type="text"
                    maxLength={MAX_MENU_DESC_LENGTH}
                    value={newDishDesc}
                    onChange={(e) => setNewDishDesc(e.target.value)}
                    placeholder="Ej. 3 piezas en tortilla hecha a mano con guacamole y salsa martajada"
                    className="w-full px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingDish}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>{addingDish ? 'Agregando...' : 'Agregar Platillo'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Existing Menu Catalog & Price Editor */}
          <section className="bg-[#161210] border border-stone-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
              <div>
                <h2 className="font-heading text-xl uppercase tracking-wide text-white">
                  Precios e Inventario del Menú ({menuItems.length})
                </h2>
                <p className="text-xs text-stone-400">
                  Edita precios al instante o desactiva platillos agotados (86) en tiempo real.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <label htmlFor="admin-menu-search" className="sr-only">
                  Buscar en menú
                </label>
                <input
                  id="admin-menu-search"
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Buscar platillo..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-400">
                    <th className="py-2.5 pr-4">Platillo</th>
                    <th className="py-2.5 pr-4">Estación</th>
                    <th className="py-2.5 pr-4">Precio (MXN)</th>
                    <th className="py-2.5 text-right">Disponibilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/70">
                  {filteredMenu.map((item) => {
                    const draftVal = priceDrafts[item.id] ?? String(item.price);
                    const parsedDraft = Number.parseFloat(draftVal);
                    const dirty = Number.isFinite(parsedDraft) && roundMoney(parsedDraft) !== item.price;
                    return (
                      <tr key={item.id}>
                        <td className="py-2.5 pr-4">
                          <p className="font-medium text-stone-100">
                            {item.name}
                            {item.isCustom && (
                              <span className="ml-2 text-[10px] text-amber-400 uppercase tracking-wide">
                                Nuevo
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {item.categoryId}
                            {item.desc ? ` · ${item.desc}` : ''}
                          </p>
                        </td>
                        <td className="py-2.5 pr-4 capitalize text-stone-400">{item.station}</td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              max="50000"
                              step="0.50"
                              aria-label={`Precio de ${item.name}`}
                              value={draftVal}
                              onChange={(e) =>
                                setPriceDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              className="w-24 px-2 py-1 rounded bg-[#0e0c0b] border border-stone-700 font-mono-tabular text-xs text-white"
                            />
                            {dirty && (
                              <button
                                type="button"
                                disabled={busyActionId !== null}
                                onClick={() =>
                                  void runGuardedAction(`price-${item.id}`, async () => {
                                    const safePrice = roundMoney(parsedDraft);
                                    if (!Number.isFinite(parsedDraft) || safePrice < 1 || safePrice > 50000) {
                                      notify('El precio debe estar entre $1 y $50,000 MXN.', 'error');
                                      return;
                                    }
                                    const saved = await updateMenuPrice(item.id, safePrice);
                                    if (saved) {
                                      setPriceDrafts((prev) => {
                                        const next = { ...prev };
                                        delete next[item.id];
                                        return next;
                                      });
                                    }
                                  })
                                }
                                className="px-2 py-1 rounded bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-[11px] font-semibold cursor-pointer"
                              >
                                {busyActionId === `price-${item.id}` ? '...' : 'Guardar'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyActionId !== null}
                              onClick={() =>
                                void runGuardedAction(`avail-${item.id}`, () =>
                                  toggleMenuAvailability(item.id, !item.available)
                                )
                              }
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer disabled:opacity-60 transition ${
                                item.available
                                  ? 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/70'
                                  : 'bg-red-950/70 border border-red-800/60 text-red-300 hover:bg-red-900/70'
                              }`}
                            >
                              {item.available ? 'Disponible' : 'Agotado (86)'}
                            </button>
                            {item.isCustom && (
                              <button
                                type="button"
                                disabled={busyActionId !== null}
                                aria-label={`Eliminar platillo ${item.name}`}
                                onClick={() =>
                                  void runGuardedAction(`del-dish-${item.id}`, () =>
                                    deleteMenuItem(item.id)
                                  )
                                }
                                className="p-1.5 rounded-md bg-stone-900 hover:bg-red-950 disabled:opacity-60 text-stone-400 hover:text-red-300 border border-stone-800 cursor-pointer transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: STAFF RBAC & IMMUTABLE AUDIT LOG */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-7 space-y-6">
            {/* Pending Self-Registered Users: Admin Assigns Function */}
            <section
              aria-label="Solicitudes de usuarios registrados pendientes de función"
              className={`bg-[#161210] border rounded-xl p-5 space-y-4 ${
                pendingRegistrations.length > 0 ? 'border-amber-500/60' : 'border-stone-800'
              }`}
            >
              <div className="border-b border-stone-800 pb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-heading text-xl uppercase tracking-wide text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>
                      Usuarios Registrados sin Función ({pendingRegistrations.length})
                    </span>
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Cuando un usuario crea su cuenta, aparece aquí bloqueado hasta que le asignes su
                    función (Mesero, Cocina, Cajero o Administrador).
                  </p>
                </div>
              </div>

              {pendingRegistrations.length === 0 ? (
                <p className="text-xs text-stone-500 py-4 text-center border border-dashed border-stone-800 rounded-lg">
                  No hay solicitudes de registro pendientes por aprobar.
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingRegistrations.map((member) => {
                    const chosenRole = pendingRoleSelection[member.uid] || 'mesero';
                    return (
                      <div
                        key={member.uid}
                        className="p-3.5 rounded-lg bg-[#120f0d] border border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {member.displayName}
                          </p>
                          <p className="text-xs text-stone-400 truncate">
                            {member.email || 'Correo aislado'} ·{' '}
                            <span className="text-amber-400">Esperando función</span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <label htmlFor={`pending-role-${member.uid}`} className="sr-only">
                            Asignar función a {member.displayName}
                          </label>
                          <select
                            id={`pending-role-${member.uid}`}
                            value={chosenRole}
                            onChange={(e) =>
                              setPendingRoleSelection((prev) => ({
                                ...prev,
                                [member.uid]: e.target.value as ActiveWorkspaceRole,
                              }))
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white"
                          >
                            <option value="mesero">Mesero</option>
                            <option value="cocina">Cocina</option>
                            <option value="cajero">Cajero</option>
                            <option value="admin">Administrador</option>
                          </select>

                          <button
                            type="button"
                            disabled={busyActionId !== null}
                            onClick={() =>
                              void runGuardedAction(`approve-${member.uid}`, () =>
                                updateStaffRole(member.uid, chosenRole, true)
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition"
                          >
                            <UserCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {busyActionId === `approve-${member.uid}`
                                ? 'Asignando...'
                                : 'Asignar y Activar'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={busyActionId !== null}
                            aria-label={`Rechazar solicitud de ${member.displayName}`}
                            onClick={() =>
                              void runGuardedAction(`reject-${member.uid}`, () =>
                                deletePendingStaff(member.uid)
                              )
                            }
                            className="p-1.5 rounded-lg bg-stone-900 hover:bg-red-950 disabled:opacity-60 text-stone-400 hover:text-red-300 border border-stone-800 cursor-pointer transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Admin Staff Provisioning Form (Email & Password) */}
            <section className="bg-[#161210] border border-stone-800 rounded-xl p-5 space-y-4">
              <div className="border-b border-stone-800 pb-3">
                <h2 className="font-heading text-xl uppercase tracking-wide text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>Dar de Alta Personal (Correo y Contraseña)</span>
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Crea accesos individuales para Mesero, Cocina, Cajero o Administrador sin cerrar tu
                  sesión actual.
                </p>
              </div>

              {staffFormFeedback && (
                <div
                  role={staffFormFeedback.ok ? 'status' : 'alert'}
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                    staffFormFeedback.ok
                      ? 'bg-emerald-950/60 border-emerald-800/70 text-emerald-200'
                      : 'bg-red-950/60 border-red-800/70 text-red-200'
                  }`}
                >
                  {staffFormFeedback.ok && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{staffFormFeedback.message}</span>
                </div>
              )}

              <form onSubmit={(e) => void handleCreateStaffSubmit(e)} noValidate className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="admin-new-staff-name" className="block text-xs text-stone-300">
                      Nombre completo
                    </label>
                    <input
                      id="admin-new-staff-name"
                      type="text"
                      maxLength={80}
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="Ej. Roberto Morales"
                      className="w-full px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="admin-new-staff-email" className="block text-xs text-stone-300">
                      Correo electrónico
                    </label>
                    <input
                      id="admin-new-staff-email"
                      type="email"
                      maxLength={160}
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      placeholder="cajero@laobrera.com"
                      className="w-full px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="admin-new-staff-password" className="block text-xs text-stone-300">
                      Contraseña inicial
                    </label>
                    <div className="relative">
                      <input
                        id="admin-new-staff-password"
                        type={showNewStaffPass ? 'text' : 'password'}
                        value={newStaffPassword}
                        onChange={(e) => setNewStaffPassword(e.target.value)}
                        placeholder="Mín. 8 caracteres (letras y números)"
                        className="w-full pl-3 pr-9 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={showNewStaffPass ? 'Ocultar contraseña inicial' : 'Mostrar contraseña inicial'}
                        onClick={() => setShowNewStaffPass((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-white cursor-pointer"
                      >
                        {showNewStaffPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="admin-new-staff-role" className="block text-xs text-stone-300">
                      Perfil operativo
                    </label>
                    <select
                      id="admin-new-staff-role"
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value as ActiveWorkspaceRole)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white focus:border-orange-500 focus:outline-none"
                    >
                      <option value="mesero">Mesero</option>
                      <option value="cocina">Cocina</option>
                      <option value="cajero">Cajero</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-[11px] text-stone-500">
                    La contraseña nunca se guarda en texto plano; el empleado recibirá enlace de
                    verificación en su correo.
                  </p>
                  <button
                    type="submit"
                    disabled={creatingStaff}
                    className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>{creatingStaff ? 'Creando cuenta...' : 'Crear Cuenta de Personal'}</span>
                  </button>
                </div>
              </form>
            </section>

            <section className="bg-[#161210] border border-stone-800 rounded-xl p-5 space-y-4">
              <div className="border-b border-stone-800 pb-3">
                <h2 className="font-heading text-xl uppercase tracking-wide text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>Perfiles de Personal y Control de Roles</span>
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Los empleados que se registren por su cuenta inician bloqueados (Pendiente) hasta que
                  un Administrador les asigna rol.
                </p>
              </div>

            <div className="space-y-2.5">
              {assignedStaff.map((member) => {
                const isSelf = member.uid === currentStaff?.uid;
                return (
                  <div
                    key={member.uid}
                    className="p-3.5 rounded-lg bg-[#120f0d] border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {member.displayName} {isSelf ? '(Tú)' : ''}
                      </p>
                      <p className="text-xs text-stone-400 truncate">
                        {member.email || 'Correo aislado'} · Estado:{' '}
                        <span className={member.active ? 'text-emerald-400' : 'text-amber-400'}>
                          {member.active ? 'Activo' : 'Bloqueado / Pendiente'}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label htmlFor={`role-select-${member.uid}`} className="sr-only">
                        Rol de {member.displayName}
                      </label>
                      <select
                        id={`role-select-${member.uid}`}
                        disabled={isSelf || busyActionId !== null}
                        value={member.role}
                        onChange={(e) => {
                          const nextRole = e.target.value as StaffRole;
                          void runGuardedAction(`role-${member.uid}`, () =>
                            updateStaffRole(
                              member.uid,
                              nextRole,
                              nextRole !== 'pending' ? true : false
                            )
                          );
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white disabled:opacity-50"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="mesero">Mesero</option>
                        <option value="cocina">Cocina</option>
                        <option value="cajero">Cajero</option>
                        <option value="admin">Administrador</option>
                      </select>

                      {!isSelf && (
                        <button
                          type="button"
                          disabled={busyActionId !== null}
                          onClick={() =>
                            void runGuardedAction(`toggle-${member.uid}`, () =>
                              updateStaffRole(member.uid, member.role, !member.active)
                            )
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60 ${
                            member.active
                              ? 'bg-stone-800 hover:bg-red-950 text-stone-300 hover:text-red-300'
                              : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                          }`}
                        >
                          {member.active ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          </div>

          {/* Immutable Audit Log */}
          <section className="xl:col-span-5 bg-[#161210] border border-stone-800 rounded-xl p-5 space-y-3">
            <div className="border-b border-stone-800 pb-3">
              <h2 className="font-heading text-lg uppercase tracking-wide text-white">
                Bitácora de Auditoría (Inmutable)
              </h2>
              <p className="text-xs text-stone-400">
                Registro protegido contra edición o borrado de cada cobro, cambio de rol y movimiento.
              </p>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-stone-500 py-8 text-center">Sin eventos registrados.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-[#120f0d] border border-stone-800/80 text-xs space-y-0.5"
                  >
                    <p className="text-stone-100">{log.summary}</p>
                    <p className="text-[11px] text-stone-500">
                      Rol: <span className="capitalize text-amber-400">{log.actorRole}</span> ·{' '}
                      {new Date(log.createdAtMs).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modal: Open Cash Register (Admin Only) */}
      {showOpenRegisterModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="open-register-modal-heading"
        >
          <div className="bg-[#181412] border border-stone-800 rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between gap-4">
              <div>
                <h2
                  id="open-register-modal-heading"
                  className="font-heading text-xl uppercase tracking-wide text-white"
                >
                  Abrir Caja · {todayKey}
                </h2>
                <p className="text-xs text-stone-400">
                  Habilita cobros en tiempo real para el perfil Cajero
                </p>
              </div>
              <button
                type="button"
                disabled={openingRegister}
                aria-label="Cerrar ventana de apertura"
                onClick={() => setShowOpenRegisterModal(false)}
                className="w-9 h-9 rounded-lg border border-stone-700 hover:bg-stone-800 disabled:opacity-50 text-stone-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleOpenCashRegisterSubmit(e)}
              noValidate
              className="p-5 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-opening-cash-input"
                  className="block text-xs font-semibold text-stone-300"
                >
                  Fondo Inicial en Efectivo (MXN)
                </label>
                <input
                  id="admin-opening-cash-input"
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  value={openFundInput}
                  onChange={(e) => setOpenFundInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0e0c0b] border border-stone-700 font-mono-tabular text-sm text-white focus:border-orange-500 focus:outline-none"
                />
                <p className="text-[11px] text-stone-500">
                  Este monto quedará registrado para calcular el arqueo al cierre de caja.
                </p>
              </div>

              {openRegisterError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200"
                >
                  {openRegisterError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={openingRegister}
                  onClick={() => setShowOpenRegisterModal(false)}
                  className="px-4 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-200 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={openingRegister}
                  className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition"
                >
                  <Unlock className="w-4 h-4 shrink-0" />
                  <span>{openingRegister ? 'Abriendo caja...' : 'Confirmar Apertura de Caja'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Close Cash Register & Official PDF Cut (Admin Only) */}
      {showCloseRegisterModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-register-modal-heading"
        >
          <div className="bg-[#181412] border border-stone-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between gap-4">
              <div>
                <h2
                  id="close-register-modal-heading"
                  className="font-heading text-xl uppercase tracking-wide text-white"
                >
                  Cerrar Caja y Corte · {activeRegisterDateKey}
                </h2>
                <p className="text-xs text-stone-400">
                  Cierre exclusivo de Administrador con descarga automática en PDF
                </p>
              </div>
              <button
                type="button"
                disabled={closingRegister}
                aria-label="Cerrar ventana de corte de caja"
                onClick={() => setShowCloseRegisterModal(false)}
                className="w-9 h-9 rounded-lg border border-stone-700 hover:bg-stone-800 disabled:opacity-50 text-stone-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleCloseCashRegisterSubmit(e)}
              noValidate
              className="p-5 space-y-4"
            >
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-[#120f0d] border border-stone-800 text-xs">
                <div>
                  <p className="text-stone-400">Fondo Inicial</p>
                  <p className="font-mono-tabular text-base font-bold text-white">
                    {formatMXN(activeOpeningCash)}
                  </p>
                </div>
                <div>
                  <p className="text-stone-400">Ventas Efectivo</p>
                  <p className="font-mono-tabular text-base font-bold text-white">
                    {formatMXN(registerShiftSummary.cashTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-stone-400">Tarjeta + Transferencia</p>
                  <p className="font-mono-tabular text-sm font-semibold text-stone-200">
                    {formatMXN(roundMoney(registerShiftSummary.cardTotal + registerShiftSummary.transferTotal))}
                  </p>
                </div>
                <div>
                  <p className="text-stone-400">Total General Día</p>
                  <p className="font-mono-tabular text-base font-bold text-amber-400">
                    {formatMXN(registerShiftSummary.totalRevenue)}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="admin-counted-cash-input"
                  className="block text-xs font-semibold text-stone-300"
                >
                  Efectivo Físico Contado en Caja (MXN)
                </label>
                <input
                  id="admin-counted-cash-input"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.50"
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0e0c0b] border border-stone-700 font-mono-tabular text-sm text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="p-3.5 rounded-lg bg-[#120f0d] border border-stone-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-stone-300">
                  <span>Efectivo Esperado en Caja (Fondo + Efectivo)</span>
                  <span className="font-mono-tabular font-semibold">
                    {formatMXN(cashCutPreview.expectedCashInDrawer)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-stone-800 text-sm font-bold">
                  <span className="text-stone-200">Resultado de Arqueo</span>
                  <span
                    className={`font-mono-tabular ${
                      cashCutPreview.statusLabel === 'Cuadrado'
                        ? 'text-emerald-400'
                        : cashCutPreview.statusLabel === 'Sobrante'
                          ? 'text-amber-400'
                          : 'text-red-400'
                    }`}
                  >
                    {cashCutPreview.statusLabel} ({cashCutPreview.difference > 0 ? '+' : ''}
                    {formatMXN(cashCutPreview.difference)})
                  </span>
                </div>
              </div>

              {closeRegisterError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200"
                >
                  {closeRegisterError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={closingRegister}
                  onClick={() => setShowCloseRegisterModal(false)}
                  className="px-4 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-200 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={closingRegister}
                  className="px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition"
                >
                  <FileDown className="w-4 h-4 shrink-0" />
                  <span>
                    {closingRegister ? 'Cerrando caja y generando PDF...' : 'Cerrar Caja y Descargar PDF'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cancel Waiter Order (Admin Exclusive) */}
      {cancelModalOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-order-modal-heading"
        >
          <div className="bg-[#181412] border border-red-900/60 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between gap-4">
              <div>
                <h2
                  id="cancel-order-modal-heading"
                  className="font-heading text-xl uppercase tracking-wide text-white flex items-center gap-2"
                >
                  <Ban className="w-5 h-5 text-red-400 shrink-0" />
                  <span>Cancelar Pedido · {cancelModalOrder.folio}</span>
                </h2>
                <p className="text-xs text-stone-400">
                  Acción exclusiva de Administrador · Quedará registrada en auditoría
                </p>
              </div>
              <button
                type="button"
                disabled={cancellingOrder}
                aria-label="Cerrar ventana de cancelación"
                onClick={() => setCancelModalOrder(null)}
                className="w-9 h-9 rounded-lg border border-stone-700 hover:bg-stone-800 disabled:opacity-50 text-stone-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleConfirmCancelOrderSubmit(e)}
              noValidate
              className="p-5 space-y-4"
            >
              {/* Order Summary */}
              <div className="p-3.5 rounded-lg bg-[#120f0d] border border-stone-800 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-800">
                  <div>
                    <p className="font-semibold text-white text-sm">
                      {cancelModalOrder.serviceType} · {cancelModalOrder.folio}
                    </p>
                    <p className="text-stone-400">
                      Pedido tomado por Mesero:{' '}
                      <strong className="text-stone-200">{cancelModalOrder.waiterName}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono-tabular text-base font-bold text-amber-400">
                      {formatMXN(cancelModalOrder.total)}
                    </p>
                    <p className={`text-[11px] font-medium ${ORDER_STATUS_META[cancelModalOrder.status].colorClass}`}>
                      {ORDER_STATUS_META[cancelModalOrder.status].label}
                    </p>
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {cancelModalOrder.items.map((item) => (
                    <div key={item.lineId} className="flex justify-between gap-2 text-stone-300">
                      <span className="truncate">
                        <strong className="text-amber-400">{item.qty}x</strong> {item.name}
                        {item.notes ? ` (${item.notes})` : ''}
                      </span>
                      <span className="font-mono-tabular shrink-0">
                        {formatMXN(item.unitPrice * item.qty)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reason Presets & Custom Input */}
              <div className="space-y-2">
                <label
                  htmlFor="admin-cancel-reason-input"
                  className="block text-xs font-semibold text-stone-200"
                >
                  Motivo de la cancelación (obligatorio para auditoría)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CANCELLATION_REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={cancellingOrder}
                      onClick={() => {
                        setCancelReason(preset);
                        setCancelError(null);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition ${
                        cancelReason === preset
                          ? 'bg-red-950/80 border-red-600 text-red-100'
                          : 'bg-[#120f0d] border-stone-800 text-stone-300 hover:border-stone-600'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  id="admin-cancel-reason-input"
                  type="text"
                  maxLength={MAX_CANCEL_REASON_LENGTH}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Describe brevemente el motivo de cancelación..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-red-500 focus:outline-none"
                />
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Al confirmar, el pedido se cancelará en tiempo real y dejará de aparecer en{' '}
                  <strong className="text-stone-200">Cocina</strong>,{' '}
                  <strong className="text-stone-200">Caja</strong> y la{' '}
                  <strong className="text-stone-200">Mesa del Mesero</strong>.
                </p>
              </div>

              {cancelError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200"
                >
                  {cancelError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={cancellingOrder}
                  onClick={() => setCancelModalOrder(null)}
                  className="px-4 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-200 text-xs font-semibold cursor-pointer"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={cancellingOrder}
                  className="px-4 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition"
                >
                  <Ban className="w-4 h-4 shrink-0" />
                  <span>{cancellingOrder ? 'Cancelando pedido...' : 'Confirmar Cancelación'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ticketOrder && (
        <TicketModal
          order={ticketOrder}
          onClose={() => setTicketOrder(null)}
          onLoadPrivateCustomer={loadOrderPrivateCustomer}
          onRequestCancel={handleOpenCancelModal}
        />
      )}
    </div>
  );
};
