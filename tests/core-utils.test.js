import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expandVerseRefs,
  normalizeTurkishText,
  getSearchMatchScore
} from '../js/modules/core-utils.js';

test('kısaltılmış ayet referanslarını genişletir', () => {
  assert.deepEqual(
    expandVerseRefs('5:18, 40, 74, 118'),
    ['5:18', '5:40', '5:74', '5:118']
  );
});

test('ayet aralıklarını genişletir', () => {
  assert.deepEqual(
    expandVerseRefs('24:58-60'),
    ['24:58', '24:59', '24:60']
  );
});

test('Türkçe metni arama için normalize eder', () => {
  assert.equal(normalizeTurkishText('İman ve ŞÜKÜR'), 'iman ve sukur');
});

test('tam kelime eşleşmesini yüzde 100 verir', () => {
  assert.equal(getSearchMatchScore('rahman', 'Rahman ve Rahim'), 100);
});
