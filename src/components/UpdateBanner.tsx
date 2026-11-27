import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  RefreshCw,
  RotateCw,
  Server,
  Sparkles,
  X,
} from 'lucide-react';
import type { DesktopUpdaterState } from '../types/desktop';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function useDesktopUpdater(): {
  isDesktop: boolean;
  state: DesktopUpdaterState | null;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  saveUpdateUrl: (url: string) => Promise<{ ok: boolean; error?: string }>;
} {
  const bridge = typeof window !== 'undefined' ? window.obreraDesktop : undefined;
  const isDesktop = Boolean(bridge?.isDesktop);
  const [state, setState] = useState<DesktopUpdaterState | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let active = true;

    void bridge.updater
      .getState()
      .then((initial) => {
        if (active && initial) setState(initial);
      })
      .catch(() => undefined);

    const unsubscribe = bridge.updater.onStatus((nextState) => {
      if (active) setState(nextState);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge]);

  const checkForUpdates = async () => {
    if (!bridge) return;
    const res = await bridge.updater.checkForUpdates();
    if (res) setState(res);
  };

  const downloadUpdate = async () => {
    if (!bridge) return;
    await bridge.updater.downloadUpdate();
  };

  const installUpdate = async () => {
    if (!bridge) return;
    await bridge.updater.installUpdate();
  };

  const saveUpdateUrl = async (url: string): Promise<{ ok: boolean; error?: string }> => {
    if (!bridge) return { ok: false, error: 'Disponible solo en la aplicación de escritorio.' };
    const res = await bridge.updater.setUpdateUrl(url);
    if (res.ok && res.state) {
      setState(res.state);
    }
    return { ok: res.ok, error: res.error };
  };

  return {
    isDesktop,
    state,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    saveUpdateUrl,
  };
}

interface UpdateModalProps {
  state: DesktopUpdaterState;
  onClose: () => void;
  onCheck: () => Promise<void>;
  onDownload: () => Promise<void>;
  onInstall: () => Promise<void>;
  onSaveUrl: (url: string) => Promise<{ ok: boolean; error?: string }>;
}

const UpdateCenterModal: React.FC<UpdateModalProps> = ({
  state,
  onClose,
  onCheck,
  onDownload,
  onInstall,
  onSaveUrl,
}) => {
  const [urlDraft, setUrlDraft] = useState<string>(state.updateUrl || '');
  const [urlFeedback, setUrlFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [savingUrl, setSavingUrl] = useState<boolean>(false);

  useEffect(() => {
    setUrlDraft(state.updateUrl || '');
  }, [state.updateUrl]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSaveAndCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlFeedback(null);
    setSavingUrl(true);
    try {
      const res = await onSaveUrl(urlDraft);
      if (!res.ok) {
        setUrlFeedback({
          ok: false,
          message: res.error || 'No se pudo guardar la dirección del servidor.',
        });
        return;
      }
      setUrlFeedback({
        ok: true,
        message: urlDraft.trim()
          ? 'Servidor de actualizaciones guardado. Buscando nuevas versiones...'
          : 'Servidor de actualizaciones desactivado.',
      });
      if (urlDraft.trim()) {
        await onCheck();
      }
    } finally {
      setSavingUrl(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-center-title"
    >
      <div className="bg-[#181412] border border-stone-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="update-center-title"
              className="font-heading text-xl uppercase tracking-wide text-white flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Actualizaciones de LA OBRERA POS</span>
            </h2>
            <p className="text-xs text-stone-400">
              Versión instalada: <strong className="text-stone-200">v{state.currentVersion}</strong>{' '}
              · Actualización directa sin desinstalar ni perder tu sesión
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar centro de actualizaciones"
            className="w-9 h-9 rounded-lg border border-stone-700 hover:bg-stone-800 text-stone-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status Box */}
          <div className="p-4 rounded-lg bg-[#120f0d] border border-stone-800 space-y-3">
            {state.status === 'checking' && (
              <div className="flex items-center gap-2.5 text-sm text-stone-200">
                <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                <span>Buscando nuevas actualizaciones...</span>
              </div>
            )}

            {state.status === 'available' && (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-white">
                      ¡Nueva versión v{state.availableVersion} disponible!
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Descárgala ahora e instálala con un clic sin borrar la aplicación.
                    </p>
                    {state.releaseNotes && (
                      <p className="text-xs text-stone-300 mt-2 p-2 rounded bg-[#181412] border border-stone-800">
                        {state.releaseNotes}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onDownload()}
                  className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Descargar actualización v{state.availableVersion}</span>
                </button>
              </div>
            )}

            {state.status === 'downloading' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-200 font-semibold">
                    Descargando v{state.availableVersion || ''}...
                  </span>
                  <span className="font-mono-tabular text-amber-400 font-bold">
                    {(state.progress?.percent ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-stone-900 overflow-hidden">
                  <div
                    className="h-full bg-orange-600 transition-all duration-200"
                    style={{ width: `${Math.min(100, state.progress?.percent ?? 0)}%` }}
                  />
                </div>
                {state.progress && state.progress.total > 0 && (
                  <p className="text-[11px] text-stone-400 font-mono-tabular flex justify-between">
                    <span>
                      {formatBytes(state.progress.transferred)} / {formatBytes(state.progress.total)}
                    </span>
                    <span>{formatBytes(state.progress.bytesPerSecond)}/s</span>
                  </p>
                )}
              </div>
            )}

            {state.status === 'downloaded' && (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-200">
                      Actualización v{state.availableVersion} lista para instalar
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Al reiniciar se actualizará automáticamente conservando tu configuración y acceso.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onInstall()}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <RotateCw className="w-4 h-4 shrink-0" />
                  <span>Reiniciar e instalar actualización ahora</span>
                </button>
              </div>
            )}

            {state.status === 'not-available' && (
              <div className="flex items-center gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Tu aplicación ya está al día con la última versión (v{state.currentVersion}).
                </span>
              </div>
            )}

            {state.status === 'not-configured' && (
              <div className="text-xs text-stone-300 space-y-1">
                <p className="font-semibold text-amber-400">
                  Configura tu servidor de actualizaciones
                </p>
                <p className="text-stone-400 leading-relaxed">
                  Ingresa abajo la URL donde publicarás las nuevas versiones (GitHub Releases,
                  Firebase Hosting o el servidor local de tu restaurante). Una vez guardada, todos
                  los equipos recibirán aviso automático al publicar cambios.
                </p>
              </div>
            )}

            {state.status === 'idle' && (
              <div className="text-xs text-stone-300">
                {state.errorMessage ? (
                  <p className="text-amber-300">{state.errorMessage}</p>
                ) : (
                  <p>
                    Servidor conectado:{' '}
                    <span className="font-mono-tabular text-stone-200 break-all">
                      {state.updateUrl}
                    </span>
                  </p>
                )}
              </div>
            )}

            {state.status === 'error' && (
              <div className="flex items-start gap-2 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{state.errorMessage || 'No se pudo comprobar actualizaciones.'}</span>
              </div>
            )}

            {state.updateUrl &&
              state.status !== 'checking' &&
              state.status !== 'downloading' &&
              state.status !== 'downloaded' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => void onCheck()}
                    className="px-3.5 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Buscar actualizaciones ahora</span>
                  </button>
                </div>
              )}
          </div>

          {/* Update Server URL Configuration */}
          <form onSubmit={(e) => void handleSaveAndCheck(e)} className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="updater-server-url"
                className="text-xs font-semibold text-stone-200 flex items-center gap-1.5"
              >
                <Server className="w-3.5 h-3.5 text-amber-400" />
                <span>Dirección del Servidor de Actualizaciones</span>
              </label>
              <input
                id="updater-server-url"
                type="url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://github.com/usuario/repo/releases/latest/download  o  http://192.168.1.10:8787"
                className="w-full px-3 py-2 rounded-lg bg-[#0e0c0b] border border-stone-700 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
              />
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Compatible con GitHub Releases, Firebase Hosting o el servidor local de red (
                <code className="text-stone-300">iniciar-servidor-actualizaciones.bat</code>).
              </p>
            </div>

            {urlFeedback && (
              <div
                role={urlFeedback.ok ? 'status' : 'alert'}
                className={`p-2.5 rounded-lg border text-xs ${
                  urlFeedback.ok
                    ? 'bg-emerald-950/60 border-emerald-800/70 text-emerald-200'
                    : 'bg-red-950/60 border-red-800/70 text-red-200'
                }`}
              >
                {urlFeedback.message}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={savingUrl}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition"
              >
                {savingUrl ? 'Guardando...' : 'Guardar y comprobar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export const DesktopUpdateControls: React.FC<{ variant?: 'header' | 'login' }> = ({
  variant = 'header',
}) => {
  const { isDesktop, state, checkForUpdates, downloadUpdate, installUpdate, saveUpdateUrl } =
    useDesktopUpdater();
  const [modalOpen, setModalOpen] = useState(false);

  if (!isDesktop || !state) return null;

  const hasActionableUpdate =
    state.status === 'available' ||
    state.status === 'downloading' ||
    state.status === 'downloaded';

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        title="Buscar o configurar actualizaciones de la aplicación"
        className={`relative px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition ${
          hasActionableUpdate
            ? 'bg-orange-600/20 border-orange-500 text-amber-200 hover:bg-orange-600/30'
            : variant === 'login'
              ? 'bg-[#120f0d] border-stone-800 text-stone-400 hover:text-white hover:border-stone-600'
              : 'bg-stone-900 border-stone-800 text-stone-300 hover:text-white hover:border-stone-600'
        }`}
      >
        {state.status === 'downloading' ? (
          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
        ) : hasActionableUpdate ? (
          <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5 text-stone-400 shrink-0" />
        )}
        <span>
          {state.status === 'downloaded'
            ? `Instalar v${state.availableVersion}`
            : state.status === 'downloading'
              ? `Descargando ${Math.round(state.progress?.percent ?? 0)}%`
              : state.status === 'available'
                ? `Actualizar a v${state.availableVersion}`
                : `v${state.currentVersion}`}
        </span>
      </button>

      {modalOpen && (
        <UpdateCenterModal
          state={state}
          onClose={() => setModalOpen(false)}
          onCheck={checkForUpdates}
          onDownload={downloadUpdate}
          onInstall={installUpdate}
          onSaveUrl={saveUpdateUrl}
        />
      )}
    </>
  );
};

export const DesktopUpdateBanner: React.FC = () => {
  const { isDesktop, state, downloadUpdate, installUpdate } = useDesktopUpdater();
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  if (!isDesktop || !state) return null;

  if (
    state.status !== 'available' &&
    state.status !== 'downloading' &&
    state.status !== 'downloaded'
  ) {
    return null;
  }

  if (state.status === 'available' && dismissedVersion === state.availableVersion) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-gradient-to-r from-orange-950/95 via-[#1c130e] to-amber-950/90 border-b border-orange-600/60 px-4 py-2.5"
    >
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {state.status === 'downloaded' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : state.status === 'downloading' ? (
            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          )}

          {state.status === 'available' && (
            <p className="text-stone-100">
              Nueva actualización{' '}
              <strong className="text-amber-300">v{state.availableVersion}</strong> disponible para
              LA OBRERA POS. Se instala directo sin desinstalar.
            </p>
          )}

          {state.status === 'downloading' && (
            <div className="flex items-center gap-3">
              <span className="text-stone-100">
                Descargando actualización v{state.availableVersion}...{' '}
                <strong className="font-mono-tabular text-amber-300">
                  {(state.progress?.percent ?? 0).toFixed(0)}%
                </strong>
              </span>
              <div className="w-28 h-2 rounded-full bg-stone-900 overflow-hidden hidden sm:block">
                <div
                  className="h-full bg-orange-500 transition-all duration-200"
                  style={{ width: `${Math.min(100, state.progress?.percent ?? 0)}%` }}
                />
              </div>
            </div>
          )}

          {state.status === 'downloaded' && (
            <p className="text-emerald-200">
              Actualización <strong>v{state.availableVersion}</strong> descargada y verificada.
              Reinicia para aplicarla al instante.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {state.status === 'available' && (
            <>
              <button
                type="button"
                onClick={() => void downloadUpdate()}
                className="px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-500 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar ahora</span>
              </button>
              <button
                type="button"
                onClick={() => setDismissedVersion(state.availableVersion)}
                aria-label="Ocultar aviso temporalmente"
                className="p-1 rounded text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {state.status === 'downloaded' && (
            <button
              type="button"
              onClick={() => void installUpdate()}
              className="px-3.5 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer transition"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Instalar y reiniciar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
