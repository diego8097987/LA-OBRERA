import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { startStaticServer } = require('./static-server.cjs');
const {
  normalizeUpdateUrl,
  extractReleaseNotesText,
  translateUpdaterError,
} = require('./updater-helpers.cjs');

test('updater helpers validate URLs, strip HTML from release notes, and translate errors to Spanish', () => {
  assert.equal(normalizeUpdateUrl(''), '');
  assert.equal(
    normalizeUpdateUrl('  https://github.com/user/repo/releases/latest/download/  '),
    'https://github.com/user/repo/releases/latest/download'
  );
  assert.equal(normalizeUpdateUrl('http://192.168.1.20:8787///'), 'http://192.168.1.20:8787');
  assert.equal(normalizeUpdateUrl('file:///C:/evil'), null);
  assert.equal(normalizeUpdateUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUpdateUrl('not a url'), null);

  assert.equal(extractReleaseNotesText('<p>Mejoras en <b>tickets</b></p>'), 'Mejoras en tickets');
  assert.match(translateUpdaterError(new Error('net::ERR_CONNECTION_REFUSED')), /servidor/);
  assert.match(translateUpdaterError(new Error('404 Not Found latest.yml')), /latest\.yml/);
  assert.match(translateUpdaterError(new Error('sha512 checksum mismatch')), /incompleta/);
});

test('static-server serves files, supports HTTP Range requests, SPA fallback, and blocks path traversal', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'la-obrera-static-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'index.html'), '<!doctype html><div id="root">OK</div>', 'utf8');
    fs.mkdirSync(path.join(tmpDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'assets', 'sample.mp4'), Buffer.from('0123456789ABCDEF'));

    const srv = await startStaticServer(tmpDir);
    try {
      assert.ok(srv.url.startsWith('http://localhost:'));

      // Root HTML
      const rootRes = await fetch(srv.url + '/');
      assert.equal(rootRes.status, 200);
      assert.match(rootRes.headers.get('content-type') || '', /text\/html/);
      assert.match(await rootRes.text(), /id="root"/);

      // Video Range streaming (206 Partial Content)
      const rangeRes = await fetch(srv.url + '/assets/sample.mp4', {
        headers: { Range: 'bytes=4-9' },
      });
      assert.equal(rangeRes.status, 206);
      assert.equal(rangeRes.headers.get('content-range'), 'bytes 4-9/16');
      assert.equal(await rangeRes.text(), '456789');

      // Missing static asset returns 404 (not index.html)
      const missingJs = await fetch(srv.url + '/assets/missing.js');
      assert.equal(missingJs.status, 404);

      // SPA route fallback returns index.html
      const spaRes = await fetch(srv.url + '/cocina');
      assert.equal(spaRes.status, 200);
      assert.match(await spaRes.text(), /id="root"/);

      // Path traversal attempt is blocked
      const traversalRes = await fetch(srv.url + '/..%2f..%2fpackage.json');
      assert.ok(traversalRes.status === 403 || traversalRes.status === 404);
    } finally {
      await srv.close();
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
