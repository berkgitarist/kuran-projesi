import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('ayrıntılı kullanım kılavuzu bağımsız sayfa olarak bulunur', async () => {
  const html = await readFile(new URL('guide.html', root), 'utf8');

  assert.match(html, /Kuran Teyit Ayrıntılı Kullanım Kılavuzu/);
  assert.match(html, /Ayet Analizi ve Bağlantılı Ayetler/);
  assert.match(html, /Yerel Not Sistemi ve Yedekleme/);
  assert.match(html, /Gizlilik, Veri Kullanımı ve İzinler/);
  assert.match(html, /Sorun Giderme/);
  assert.doesNotMatch(html, /\bonclick\s*=|\boninput\s*=/);
});

test('ana uygulamadaki kılavuz düğmesi bağımsız sayfaya yönlendirir', async () => {
  const script = await readFile(new URL('js/script.js', root), 'utf8');

  assert.match(script, /window\.location\.assign\('\.\/guide\.html'\)/);
  assert.doesNotMatch(script, /const GUIDE_CONTENT/);
});

test('kılavuz görünümü tema ve arama betiğini kullanır', async () => {
  const script = await readFile(new URL('js/guide.js', root), 'utf8');

  assert.match(script, /quranAppSettings/);
  assert.match(script, /setupGuideSearch/);
  assert.match(script, /returnToApplication/);
});

test('çevrimdışı uygulama kabuğu kılavuz dosyalarını içerir', async () => {
  const serviceWorker = await readFile(new URL('service-worker.js', root), 'utf8');

  assert.match(serviceWorker, /kuran-teyit-v44/);
  assert.match(serviceWorker, /\.\/guide\.html/);
  assert.match(serviceWorker, /\.\/js\/guide\.js/);
});
