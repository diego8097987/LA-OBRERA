'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const PREFERRED_PORTS = [47832, 47833, 47834, 47835, 47836, 0];

function serveFile(req, res, filePath, isIndexFallback) {
  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const totalSize = stats.size;
    const cacheControl =
      ext === '.html' || isIndexFallback
        ? 'no-cache, no-store, must-revalidate'
        : 'public, max-age=31536000, immutable';

    const commonHeaders = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    };

    const rangeHeader = req.headers.range;
    if (rangeHeader && /^bytes=\d*-\d*$/.test(rangeHeader)) {
      const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
      let start = startStr ? Number.parseInt(startStr, 10) : 0;
      let end = endStr ? Number.parseInt(endStr, 10) : totalSize - 1;

      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= totalSize) end = totalSize - 1;

      if (start > end || start < 0 || start >= totalSize) {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        res.end();
        return;
      }

      const chunkSize = end - start + 1;
      res.writeHead(206, {
        ...commonHeaders,
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': chunkSize,
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', () => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      stream.pipe(res);
      return;
    }

    res.writeHead(200, {
      ...commonHeaders,
      'Content-Length': totalSize,
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    stream.pipe(res);
  });
}

function tryListen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Starts a loopback-only HTTP server serving Vite's production dist/ folder.
 * Uses a stable localhost port so Firebase Auth IndexedDB sessions persist across restarts and updates.
 */
async function startStaticServer(distDir) {
  const normalizedRoot = path.resolve(distDir);
  const indexHtmlPath = path.join(normalizedRoot, 'index.html');
  let cachedIndexBuffer = null;
  try {
    cachedIndexBuffer = fs.readFileSync(indexHtmlPath);
  } catch {
    cachedIndexBuffer = null;
  }

  const sendIndexHtml = (req, res) => {
    if (cachedIndexBuffer) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': cachedIndexBuffer.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : cachedIndexBuffer);
      return;
    }
    serveFile(req, res, indexHtmlPath, true);
  };

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    let pathname = '/';
    try {
      const parsed = new URL(req.url || '/', 'http://localhost');
      pathname = decodeURIComponent(parsed.pathname);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      sendIndexHtml(req, res);
      return;
    }

    const relativePath = pathname.replace(/^\/+/, '');
    const candidate = path.resolve(normalizedRoot, relativePath);

    // Block path traversal outside dist/
    if (candidate !== normalizedRoot && !candidate.startsWith(normalizedRoot + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(candidate, (err, stats) => {
      if (!err && stats.isFile()) {
        serveFile(req, res, candidate, false);
        return;
      }

      // If requesting a missing static asset with an extension, return 404 rather than index.html
      if (path.extname(relativePath) && relativePath !== 'index.html') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      // SPA fallback
      sendIndexHtml(req, res);
    });
  });

  let boundPort = null;
  let lastError = null;
  for (const candidatePort of PREFERRED_PORTS) {
    try {
      boundPort = await tryListen(server, candidatePort);
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (boundPort === null) {
    throw lastError || new Error('No se pudo iniciar el servidor interno de la aplicación.');
  }

  return {
    server,
    port: boundPort,
    url: `http://localhost:${boundPort}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}

module.exports = { startStaticServer };
