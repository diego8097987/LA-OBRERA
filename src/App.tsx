import React from 'react';
import { Lock, LogOut, Unlock } from 'lucide-react';
import { AdminView } from './components/AdminView';
import { AuthGate } from './components/AuthGate';
import { BrandLogo } from './components/BrandLogo';
import { CashierView } from './components/CashierView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KitchenView } from './components/KitchenView';
import { WaiterView } from './components/WaiterView';
import { PosProvider, usePos } from './context/PosContext';
import type { ActiveWorkspaceRole } from './types/pos';

const ROLE_META: Record<ActiveWorkspaceRole, { label: string; scope: string }> = {
  mesero: { label: 'Estación Mesero', scope: 'Toma de órdenes en tiempo real' },
  cocina: { label: 'Monitor de Cocina', scope: 'Pedidos en tiempo real' },
  cajero: { label: 'Estación Cajero', scope: 'Cobros y totales en tiempo real' },
  admin: { label: 'Panel Administrador', scope: 'Ventas, caja, menú y personal' },
};

const PosShell: React.FC = () => {
  const {
    authReady,
    needsEmailVerification,
    currentStaff,
    activeWorkspace,
    exitSession,
    orders,
    cashRegister,
    toast,
  } = usePos();

  if (
    !authReady ||
    needsEmailVerification ||
    !currentStaff ||
    !currentStaff.active ||
    currentStaff.role === 'pending'
  ) {
    return <AuthGate />;
  }

  const kitchenCount = orders.filter((o) => o.status === 'pending' || o.status === 'preparing').length;
  const cashierCount = orders.filter((o) => o.status === 'ready' || o.status === 'served').length;
  const currentRoleMeta = ROLE_META[activeWorkspace];
  const liveCountBadge =
    activeWorkspace === 'cocina'
      ? kitchenCount
      : activeWorkspace === 'cajero'
        ? cashierCount
        : 0;

  return (
    <div className="min-h-screen bg-[#0e0c0b] text-[#f5efe6] flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#0e0c0b]/95 backdrop-blur-md border-b border-stone-800/90">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand */}
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <BrandLogo className="w-9 h-9 shrink-0" />
            <span className="font-display font-bold text-base sm:text-lg tracking-wider text-white">
              LA OBRERA
            </span>
          </div>

          {/* Zone 2: Independent Role Station Indicator (No Cross-Role Access) */}
          <nav
            aria-label="Estación activa del usuario"
            className="flex items-center gap-3 overflow-x-auto no-scrollbar"
          >
            <span
              aria-current="page"
              className="py-2 text-sm font-semibold whitespace-nowrap shrink-0 border-b-2 border-orange-500 text-white"
            >
              {currentRoleMeta.label}
              {liveCountBadge > 0 ? ` (${liveCountBadge})` : ''}
            </span>
            <span className="hidden md:inline text-xs text-stone-400 whitespace-nowrap">
              {currentRoleMeta.scope}
            </span>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => void exitSession()}
              className="px-3.5 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Quiet Operational Context Strip (Outside Header Contract) */}
      <div className="border-b border-stone-800/70 bg-[#13100e]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-stone-200 font-medium">{currentStaff.displayName}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">Cuenta independiente: {currentStaff.role}</span>
            <span aria-hidden="true">·</span>
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                cashRegister?.isOpen ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {cashRegister?.isOpen ? (
                <>
                  <Unlock className="w-3 h-3 shrink-0" />
                  <span>Caja Abierta</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 shrink-0" />
                  <span>Caja Cerrada</span>
                </>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span>Tiempo Real Firebase</span>
          </div>
        </div>
      </div>

      {/* Main Independent Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeWorkspace === 'mesero' && <WaiterView />}
        {activeWorkspace === 'cocina' && <KitchenView />}
        {activeWorkspace === 'cajero' && <CashierView />}
        {activeWorkspace === 'admin' && <AdminView />}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-stone-800/70 py-4 px-4 sm:px-6 text-center text-xs text-stone-500">
        LA OBRERA Grill Asadero · Desde 1996 · Cuentas Independientes en Tiempo Real
      </footer>

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg border text-xs font-medium shadow-xl max-w-sm ${
            toast.tone === 'error'
              ? 'bg-red-950 border-red-700 text-red-100'
              : toast.tone === 'success'
                ? 'bg-[#1b1714] border-emerald-700/80 text-emerald-200'
                : 'bg-[#1b1714] border-stone-700 text-stone-100'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <PosProvider>
        <PosShell />
      </PosProvider>
    </ErrorBoundary>
  );
}
