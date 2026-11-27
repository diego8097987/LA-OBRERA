import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const releaseDir = path.resolve(__dirname, '..', 'release');
const port = Number(process.env.UPDATE_SERVER_PORT || 8787);

const MIME = {
  '.yml': 'text/yaml; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.exe': 'application/octet-stream',
  '.blockmap': 'application/octet-stream',
  '.json': 'application/json; charset=utf-8',
};

function getLanIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

if (!fs.existsSync(releaseDir)) {
  console.error(`No se encontró la carpeta ${releaseDir}. Compila primero con: npm run dist:win`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }

  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const cleanRel = pathname.replace(/^\/+/, '');
  if (!cleanRel) {
    const files = fs
      .readdirSync(releaseDir)
      .filter((f) => f === 'latest.yml' || f.endsWith('.exe') || f.endsWith('.blockmap'));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ service: 'LA OBRERA POS Update Server', files }, null, 2));
    return;
  }

  // Only allow top-level update artifacts inside release/
  if (cleanRel.includes('/') || cleanRel.includes('\\') || cleanRel.includes('..')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const filePath = path.join(releaseDir, cleanRel);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const totalSize = stats.size;
  const headers = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': ext === '.yml' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
  };

  const range = req.headers.range;
  if (range && /^bytes=\d*-\d*$/.test(range)) {
    const [startStr, endStr] = range.replace('bytes=', '').split('-');
    const start = startStr ? Number.parseInt(startStr, 10) : 0;
    const end = endStr ? Math.min(totalSize - 1, Number.parseInt(endStr, 10)) : totalSize - 1;
    if (start > end || start < 0 || start >= totalSize) {
      res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Content-Length': end - start + 1,
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, { ...headers, 'Content-Length': totalSize });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, '0.0.0.0', () => {
  const ips = getLanIps();
  console.log('\n=============================================================');
  console.log('  SERVIDOR DE ACTUALIZACIONES — LA OBRERA GRILL ASADERO POS');
  console.log('=============================================================');
  console.log(`Carpeta publicada: ${releaseDir}`);
  console.log('\nURL para pegar en "Actualizaciones" en las demás PCs del restaurante:');
  if (ips.length > 0) {
    for (const ip of ips) {
      console.log(`  -> http://${ip}:${port}`);
    }
  } else {
    console.log(`  -> http://127.0.0.1:${port}`);
  }
  console.log('\nMantén esta ventana abierta mientras las PCs descargan la actualización.');
  console.log('Presiona Ctrl + C para detener el servidor.\n');
});
