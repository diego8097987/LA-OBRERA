export type DesktopUpdaterStatus =
  | 'idle'
  | 'not-configured'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface DesktopUpdaterProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface DesktopUpdaterState {
  currentVersion: string;
  isPackaged: boolean;
  updateUrl: string;
  status: DesktopUpdaterStatus;
  availableVersion: string | null;
  releaseDate: string | null;
  releaseNotes: string;
  progress: DesktopUpdaterProgress | null;
  errorMessage: string | null;
  lastCheckedAt: number | null;
}

export interface ObreraDesktopBridge {
  isDesktop: boolean;
  platform: string;
  getVersion: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  files?: {
    saveCashCutPdf: (
      filename: string,
      base64Data: string
    ) => Promise<{ ok: boolean; savedPath?: string; folderPath?: string; error?: string }>;
    openCashCutsFolder: () => Promise<{ ok: boolean; folderPath?: string; error?: string }>;
  };
  updater: {
    getState: () => Promise<DesktopUpdaterState | null>;
    checkForUpdates: () => Promise<DesktopUpdaterState | null>;
    downloadUpdate: () => Promise<{ ok: boolean; error?: string }>;
    installUpdate: () => Promise<{ ok: boolean; error?: string }>;
    setUpdateUrl: (
      url: string
    ) => Promise<{ ok: boolean; error?: string; state?: DesktopUpdaterState }>;
    onStatus: (callback: (state: DesktopUpdaterState) => void) => () => void;
  };
}

declare global {
  interface Window {
    obreraDesktop?: ObreraDesktopBridge;
  }
}

export {};
