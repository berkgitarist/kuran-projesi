import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMealData } from '../js/modules/meal-normalizer.js';

test('sures/ayetler formatını ortak indekse çevirir', () => {
  const index = normalizeMealData({
    sures: [{ ayetler: [[1, 'Birinci ayet'], [2, 'İkinci ayet']] }]
  });

  assert.equal(index['1:1'].text, 'Birinci ayet');
  assert.equal(index['1:2'].text, 'İkinci ayet');
});

test('surahs formatında çeviri ve Arapçayı korur', () => {
  const index = normalizeMealData({
    surahs: [{
      id: 1,
      verses: [{ verse_number: 1, verse: 'العربية', translation: 'Türkçe' }]
    }]
  });

  assert.equal(index['1:1'].translation, 'Türkçe');
  assert.equal(index['1:1'].arabic, 'العربية');
});
