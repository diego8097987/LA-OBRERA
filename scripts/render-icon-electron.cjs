'use strict';

/**
 * Electron offscreen helper that renders the LA OBRERA BrandLogo SVG into
 * crisp PNGs and packs a multi-resolution Windows .ico (16..256 px).
 */
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="512" height="512">
  <defs>
    <radialGradient id="fireBgGrad" cx="50%" cy="60%" r="55%">
      <stop offset="0%" stop-color="#ff9900" stop-opacity="0.9"/>
      <stop offset="45%" stop-color="#cc3300" stop-opacity="0.8"/>
      <stop offset="80%" stop-color="#4a0e00" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#0d0502" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="flameFillGrad" x1="0%" y1="100%" x2="10%" y2="0%">
      <stop offset="0%" stop-color="#e65c00"/>
      <stop offset="55%" stop-color="#ff9914"/>
      <stop offset="100%" stop-color="#ffcc33"/>
    </linearGradient>
    <linearGradient id="grillYellowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffd000"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <path id="asaderoCurvePath" d="M 102,292 A 118,118 0 0,0 298,292"/>
    <clipPath id="grillClipCircle"><circle cx="200" cy="242" r="82"/></clipPath>
  </defs>
  <circle cx="200" cy="200" r="196" fill="url(#fireBgGrad)"/>
  <circle cx="200" cy="242" r="118" fill="#050505" stroke="#ffffff" stroke-width="11"/>
  <g clip-path="url(#grillClipCircle)" fill="url(#grillYellowGrad)">
    <rect x="110" y="242" width="180" height="10" rx="3"/>
    <rect x="110" y="258" width="180" height="10" rx="3"/>
    <rect x="110" y="274" width="180" height="10" rx="3"/>
    <rect x="110" y="290" width="180" height="10" rx="3"/>
    <rect x="110" y="306" width="180" height="10" rx="3"/>
  </g>
  <path d="M 92,190 C 90,145 128,118 148,86 C 155,73 149,54 143,45 C 168,52 184,78 181,102 C 196,65 232,32 272,18 C 262,48 242,74 238,105 C 254,96 266,92 280,96 C 260,116 254,142 260,190 Z" fill="#ffffff" stroke="#ffffff" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M 255,95 C 254,68 275,54 282,30 C 298,48 298,75 278,94 C 268,103 257,104 255,95 Z" fill="#ffffff" stroke="#ffffff" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M 96,190 C 94,148 130,120 150,88 C 157,75 151,57 146,48 C 167,55 182,80 179,105 C 194,68 230,36 268,22 C 258,50 238,76 234,108 C 250,99 262,95 275,98 C 256,118 250,144 256,190 Z" fill="url(#flameFillGrad)" stroke="#1a0800" stroke-width="2.5"/>
  <path d="M 256,94 C 255,69 275,55 282,32 C 296,49 296,74 277,92 C 268,100 258,101 256,94 Z" fill="url(#flameFillGrad)" stroke="#1a0800" stroke-width="2.5"/>
  <rect x="30" y="182" width="340" height="66" rx="10" fill="#050505" stroke="#ffffff" stroke-width="9"/>
  <text x="198" y="224" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-weight="900" font-size="31" letter-spacing="2.5">LA OBRERA</text>
  <text x="315" y="240" text-anchor="end" fill="#e5e5e5" font-family="Segoe UI, sans-serif" font-weight="700" font-size="7.5" letter-spacing="0.8">DESDE 1996</text>
  <g transform="translate(202, 286) rotate(-14)">
    <text x="0" y="0" text-anchor="middle" fill="#050505" stroke="#050505" stroke-width="12" stroke-linejoin="round" font-family="Brush Script MT, Georgia, cursive" font-weight="700" font-size="56">Grill</text>
    <text x="0" y="0" text-anchor="middle" fill="#ffffff" font-family="Brush Script MT, Georgia, cursive" font-weight="700" font-size="56">Grill</text>
  </g>
  <text fill="#ffffff" font-family="Georgia, serif" font-weight="900" font-size="25" letter-spacing="2" stroke="#000000" stroke-width="1.5" paint-order="stroke">
    <textPath href="#asaderoCurvePath" startOffset="50%" text-anchor="middle">ASADERO</textPath>
  </text>
  <circle cx="200" cy="200" r="196" fill="none" stroke="rgba(255,136,0,0.55)" stroke-width="4"/>
</svg>`;

function buildIcoBuffer(pngEntries) {
  // Windows ICO header (6 bytes) + 16 bytes per ICONDIRENTRY + PNG payloads
  const count = pngEntries.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const totalSize = headerSize + pngEntries.reduce((sum, e) => sum + e.data.length, 0);
  const buf = Buffer.alloc(totalSize);

  buf.writeUInt16LE(0, 0); // Reserved
  buf.writeUInt16LE(1, 2); // Type = 1 (ICO)
  buf.writeUInt16LE(count, 4);

  pngEntries.forEach((entry, idx) => {
    const pos = 6 + idx * 16;
    buf.writeUInt8(entry.size >= 256 ? 0 : entry.size, pos); // Width (0 means 256)
    buf.writeUInt8(entry.size >= 256 ? 0 : entry.size, pos + 1); // Height
    buf.writeUInt8(0, pos + 2); // Color palette
    buf.writeUInt8(0, pos + 3); // Reserved
    buf.writeUInt16LE(1, pos + 4); // Color planes
    buf.writeUInt16LE(32, pos + 6); // Bits per pixel
    buf.writeUInt32LE(entry.data.length, pos + 8); // Image size
    buf.writeUInt32LE(offset, pos + 12); // Image offset
    entry.data.copy(buf, offset);
    offset += entry.data.length;
  });

  return buf;
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 512,
      height: 512,
      show: false,
      transparent: true,
      webPreferences: {
        offscreen: true,
      },
    });

    const html = `<!doctype html><html><body style="margin:0;padding:0;background:transparent;overflow:hidden;"><canvas id="c" width="256" height="256"></canvas></body></html>`;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    const sizes = [16, 32, 48, 64, 128, 256];
    const svgDataUrl = 'data:image/svg+xml;base64,' + Buffer.from(LOGO_SVG, 'utf8').toString('base64');

    const results = await win.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const sizes = ${JSON.stringify(sizes)};
          const out = {};
          for (const s of sizes) {
            const canvas = document.createElement('canvas');
            canvas.width = s;
            canvas.height = s;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, s, s);
            ctx.drawImage(img, 0, 0, s, s);
            out[s] = canvas.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '');
          }
          resolve(out);
        };
        img.onerror = () => reject(new Error('Failed to load SVG into canvas'));
        img.src = ${JSON.stringify(svgDataUrl)};
      });
    `);

    const buildDir = path.resolve(__dirname, '..', 'build');
    fs.mkdirSync(buildDir, { recursive: true });

    const pngEntries = sizes.map((size) => ({
      size,
      data: Buffer.from(results[size], 'base64'),
    }));

    const png256 = pngEntries.find((e) => e.size === 256).data;
    fs.writeFileSync(path.join(buildDir, 'icon.png'), png256);
    fs.writeFileSync(path.join(buildDir, 'icon.ico'), buildIcoBuffer(pngEntries));

    console.log('Generated build/icon.png and build/icon.ico successfully.');
    app.exit(0);
  } catch (err) {
    console.error('Icon generation failed:', err);
    app.exit(1);
  }
});
