import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeImportedNotes } from '../js/modules/note-validator.js';

test('geçerli notu temizleyerek kabul eder', () => {
  const notes = sanitizeImportedNotes({
    notes: {
      '17:36': {
        sura: '17',
        verse: '36',
        content: '  Teyit et.  ',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    }
  }, {
    verseExists: (sura, verse) => sura === '17' && verse === '36'
  });

  assert.equal(notes['17:36'].content, 'Teyit et.');
});

test('olmayan ayete ait notu reddeder', () => {
  assert.throws(() => sanitizeImportedNotes({
    '999:1': { content: 'Geçersiz' }
  }, {
    verseExists: () => false
  }));
});
