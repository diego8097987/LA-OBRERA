'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const {
  normalizeUpdateUrl,
  extractReleaseNotesText,
  translateUpdaterError,
} = require('./updater-helpers.cjs');

const DEFAULT_CONFIG_PATH = path.join(__dirname, 'update-config.json');

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

class DesktopUpdater {
  constructor({ onBeforeQuitForInstall, broadcast }) {
    this.onBeforeQuitForInstall = onBeforeQuitForInstall;
    this.broadcast = broadcast;
    this.settingsPath = path.join(app.getPath('userData'), 'updater-settings.json');
    this.bundledConfig = readJsonSafe(DEFAULT_CONFIG_PATH, {
      updateUrl: '',
      autoCheckOnStartup: true,
      checkIntervalMinutes: 30,
    });
    this.userSettings = readJsonSafe(this.settingsPath, {});
    this.isSilentCheck = false;
    this.isChecking = false;
    this.isDownloading = false;
    this.periodicTimer = null;
    this.startupTimer = null;

    const effectiveUrl = this.getEffectiveUrl();

    this.state = {
      currentVersion: app.getVersion(),
      isPackaged: app.isPackaged || process.env.OBRERA_FORCE_DEV_UPDATER === '1',
      updateUrl: effectiveUrl,
      status: effectiveUrl ? 'idle' : 'not-configured',
      availableVersion: null,
      releaseDate: null,
      releaseNotes: '',
      progress: null,
      errorMessage: null,
      lastCheckedAt: null,
    };

    this.configureAutoUpdater();
  }

  getEffectiveUrl() {
    if (typeof this.userSettings.updateUrl === 'string') {
      const normalized = normalizeUpdateUrl(this.userSettings.updateUrl);
      if (normalized !== null) return normalized;
    }
    const bundled = normalizeUpdateUrl(this.bundledConfig.updateUrl);
    return bundled || '';
  }

  persistUserSettings(nextSettings) {
    this.userSettings = { ...this.userSettings, ...nextSettings };
    fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
    fs.writeFileSync(this.settingsPath, JSON.stringify(this.userSettings, null, 2), 'utf8');
  }

  emitState(patch) {
    this.state = { ...this.state, ...patch };
    this.broadcast('updater:status', this.state);
  }

  configureAutoUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.logger = null;

    if (!app.isPackaged && process.env.OBRERA_FORCE_DEV_UPDATER === '1') {
      autoUpdater.forceDevUpdateConfig = true;
    }

    autoUpdater.on('checking-for-update', () => {
      this.isChecking = true;
      this.emitState({
        status: 'checking',
        errorMessage: null,
      });
    });

    autoUpdater.on('update-available', (info) => {
      this.isChecking = false;
      this.emitState({
        status: 'available',
        availableVersion: info?.version || null,
        releaseDate: info?.releaseDate || null,
        releaseNotes: extractReleaseNotesText(info?.releaseNotes),
        progress: null,
        errorMessage: null,
        lastCheckedAt: Date.now(),
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.isChecking = false;
      this.emitState({
        status: 'not-available',
        availableVersion: info?.version || app.getVersion(),
        progress: null,
        errorMessage: null,
        lastCheckedAt: Date.now(),
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.isDownloading = true;
      this.emitState({
        status: 'downloading',
        errorMessage: null,
        progress: {
          percent: Math.min(100, Math.max(0, Math.round((progressObj.percent || 0) * 10) / 10)),
          bytesPerSecond: Number(progressObj.bytesPerSecond || 0),
          transferred: Number(progressObj.transferred || 0),
          total: Number(progressObj.total || 0),
        },
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.isDownloading = false;
      this.isChecking = false;
      this.emitState({
        status: 'downloaded',
        availableVersion: info?.version || this.state.availableVersion,
        releaseNotes: extractReleaseNotesText(info?.releaseNotes) || this.state.releaseNotes,
        progress: {
          percent: 100,
          bytesPerSecond: 0,
          transferred: this.state.progress?.total || 0,
          total: this.state.progress?.total || 0,
        },
        errorMessage: null,
      });
    });

    autoUpdater.on('error', (err) => {
      const wasSilent = this.isSilentCheck && !this.isDownloading;
      this.isChecking = false;
      this.isDownloading = false;
      this.isSilentCheck = false;

      if (wasSilent) {
        // Keep background startup/periodic failures silent so POS workflow is never interrupted
        this.emitState({
          status: this.state.updateUrl ? 'idle' : 'not-configured',
          lastCheckedAt: Date.now(),
        });
        return;
      }

      this.emitState({
        status: 'error',
        errorMessage: translateUpdaterError(err),
        lastCheckedAt: Date.now(),
      });
    });
  }

  startBackgroundPolling() {
    this.stopBackgroundPolling();
    if (!this.state.isPackaged || !this.state.updateUrl) return;

    if (this.bundledConfig.autoCheckOnStartup !== false) {
      this.startupTimer = setTimeout(() => {
        void this.checkForUpdates({ silent: true });
      }, 6000);
    }

    const minutes = Math.max(5, Number(this.bundledConfig.checkIntervalMinutes) || 30);
    this.periodicTimer = setInterval(() => {
      if (this.state.status !== 'downloading' && this.state.status !== 'downloaded') {
        void this.checkForUpdates({ silent: true });
      }
    }, minutes * 60 * 1000);
  }

  stopBackgroundPolling() {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
  }

  getState() {
    return this.state;
  }

  setUpdateUrl(rawUrl) {
    const normalized = normalizeUpdateUrl(rawUrl);
    if (normalized === null) {
      return {
        ok: false,
        error: 'Ingresa una dirección válida que empiece con https:// o http:// (ej. https://github.com/usuario/repo/releases/latest/download).',
      };
    }

    this.persistUserSettings({ updateUrl: normalized });
    this.emitState({
      updateUrl: normalized,
      status: normalized ? 'idle' : 'not-configured',
      errorMessage: null,
    });

    if (normalized) {
      this.startBackgroundPolling();
    } else {
      this.stopBackgroundPolling();
    }

    return { ok: true, state: this.state };
  }

  async checkForUpdates({ silent = false } = {}) {
    if (this.isChecking || this.isDownloading) {
      return this.state;
    }

    const url = this.getEffectiveUrl();
    if (!url) {
      this.emitState({
        updateUrl: '',
        status: 'not-configured',
        errorMessage: null,
      });
      return this.state;
    }

    if (!this.state.isPackaged) {
      this.emitState({
        status: 'idle',
        errorMessage:
          'Estás ejecutando en modo desarrollo. Las actualizaciones automáticas se activan en la aplicación instalada (.exe).',
      });
      return this.state;
    }

    this.isSilentCheck = silent;
    try {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url,
      });
      await autoUpdater.checkForUpdates();
    } catch (err) {
      this.isChecking = false;
      if (!silent) {
        this.emitState({
          status: 'error',
          errorMessage: translateUpdaterError(err),
          lastCheckedAt: Date.now(),
        });
      }
    } finally {
      this.isSilentCheck = false;
    }

    return this.state;
  }

  async downloadUpdate() {
    if (this.isDownloading) {
      return { ok: true };
    }
    if (this.state.status !== 'available' && this.state.status !== 'error') {
      return { ok: false, error: 'No hay una actualización pendiente por descargar.' };
    }
    this.isSilentCheck = false;
    this.isDownloading = true;
    this.emitState({
      status: 'downloading',
      errorMessage: null,
      progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 },
    });

    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      this.isDownloading = false;
      const msg = translateUpdaterError(err);
      this.emitState({ status: 'error', errorMessage: msg });
      return { ok: false, error: msg };
    }
  }

  async installUpdate() {
    if (this.state.status !== 'downloaded') {
      return { ok: false, error: 'Primero descarga la actualización antes de instalarla.' };
    }
    this.stopBackgroundPolling();
    if (typeof this.onBeforeQuitForInstall === 'function') {
      try {
        await this.onBeforeQuitForInstall();
      } catch {
        // Continue with installation even if cleanup throws
      }
    }
    // isSilent = false (shows clean progress bar), isForceRunAfter = true (auto-restarts updated POS)
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return { ok: true };
  }
}

module.exports = { DesktopUpdater, normalizeUpdateUrl, translateUpdaterError };
