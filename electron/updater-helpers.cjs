'use strict';

function normalizeUpdateUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }
  return trimmed.replace(/\/+$/, '');
}

function extractReleaseNotesText(releaseNotes) {
  if (!releaseNotes) return '';
  if (typeof releaseNotes === 'string') {
    return releaseNotes.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((entry) => {
        if (!entry) return '';
        if (typeof entry === 'string') return entry;
        return typeof entry.note === 'string' ? entry.note : '';
      })
      .filter(Boolean)
      .join('\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

function translateUpdaterError(err) {
  const raw = err instanceof Error ? err.message : String(err || '');
  const lower = raw.toLowerCase();

  if (lower.includes('err_connection_refused') || lower.includes('econnrefused')) {
    return 'No se pudo conectar con el servidor de actualizaciones. Verifica que el servidor esté encendido y accesible.';
  }
  if (lower.includes('err_name_not_resolved') || lower.includes('enotfound')) {
    return 'No se encontró la dirección del servidor de actualizaciones. Verifica la URL y tu conexión a internet.';
  }
  if (lower.includes('err_internet_disconnected') || lower.includes('network')) {
    return 'Sin conexión de red para buscar actualizaciones.';
  }
  if (lower.includes('404') || lower.includes('cannot find latest.yml')) {
    return 'No se encontró el archivo latest.yml en el servidor de actualizaciones. Asegúrate de subir latest.yml junto con el instalador .exe.';
  }
  if (lower.includes('sha512') || lower.includes('checksum')) {
    return 'La descarga de la actualización llegó incompleta o alterada. Intenta descargarla nuevamente.';
  }
  if (lower.includes('timed out') || lower.includes('etimedout')) {
    return 'Tiempo de espera agotado al conectar con el servidor de actualizaciones.';
  }
  return raw || 'No se pudo comprobar si existen actualizaciones.';
}

module.exports = {
  normalizeUpdateUrl,
  extractReleaseNotesText,
  translateUpdaterError,
};
