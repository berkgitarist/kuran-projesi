import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRouteHash, buildRouteHash } from '../js/modules/navigation-utils.js';

test('ayet bağlantısını çözer', () => {
  assert.deepEqual(parseRouteHash('#ayet=17:36'), {
    view: 'verse',
    sura: '17',
    verse: '36'
  });
});

test('analiz bağlantısını üretir', () => {
  assert.equal(
    buildRouteHash({ view: 'analysis', sura: '2', verse: '255' }),
    '#analiz=2:255'
  );
});

test('normal Kur’an sayfası URL’ye sayfa numarası yazmaz', () => {
  assert.equal(
    buildRouteHash({ view: 'page', page: 394 }),
    ''
  );

  assert.deepEqual(
    parseRouteHash('#sayfa=394'),
    { view: 'quran' }
  );
});

test('manuel İlk İnen Ayet ekranı URL hash kullanmaz', () => {
  assert.equal(
    buildRouteHash({ view: 'first-revelation' }),
    ''
  );

  assert.deepEqual(
    parseRouteHash('#ilk-ayet'),
    { view: 'quran' }
  );
});
