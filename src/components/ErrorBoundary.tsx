import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isPermissionError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      isPermissionError: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'Ocurrió un error inesperado.';
    let friendly = 'No se pudo completar la operación en la base de datos.';
    let isPermissionError = false;

    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.toLowerCase().includes('permission') || parsed.error.toLowerCase().includes('insufficient')) {
          isPermissionError = true;
          friendly = `Acceso denegado por las reglas de seguridad (${parsed.operationType || 'operación'} en ${parsed.path || 'recurso'}). Verifica que tu perfil tenga el rol autorizado y sesión verificada.`;
        } else if (parsed.error.toLowerCase().includes('quota')) {
          friendly = 'Se alcanzó temporalmente la cuota gratuita diaria de lecturas/escrituras de Firestore. Se restablece automáticamente al día siguiente.';
        } else {
          friendly = parsed.error;
        }
      }
    } catch {
      friendly = raw;
    }

    return {
      hasError: true,
      message: friendly,
      isPermissionError,
    };
  }

  componentDidCatch(error: Error): void {
    console.error('Application ErrorBoundary caught:', error);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, message: '', isPermissionError: false });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#0e0c0b] text-[#f5efe6] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#181412] border border-stone-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-950/80 border border-red-800/70 text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg uppercase tracking-wide text-white">
                {this.state.isPermissionError ? 'Protección de Seguridad Activa' : 'Error del Sistema'}
              </h2>
              <p className="text-xs text-stone-400">LA OBRERA Grill Asadero</p>
            </div>
          </div>

          <p className="text-sm text-stone-300 leading-relaxed">{this.state.message}</p>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reintentar</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
