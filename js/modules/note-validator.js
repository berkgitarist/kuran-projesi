const VERSE_KEY_PATTERN = /^(\d{1,3}):(\d{1,3})$/;

export function sanitizeImportedNotes(rawValue, options = {}) {
  const {
    maxNotes = 10000,
    maxContentLength = 10000,
    verseExists = () => true
  } = options;

  const source = rawValue?.notes || rawValue;

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('Geçersiz not dosyası.');
  }

  const entries = Object.entries(source);
  if (entries.length > maxNotes) {
    throw new Error('Not dosyasında izin verilenden fazla kayıt var.');
  }

  const sanitized = Object.create(null);

  for (const [key, note] of entries) {
    const keyMatch = key.match(VERSE_KEY_PATTERN);
    if (!keyMatch || !note || typeof note !== 'object' || Array.isArray(note)) {
      continue;
    }

    const sura = Number(note.sura ?? keyMatch[1]);
    const verse = Number(note.verse ?? keyMatch[2]);
    const content = typeof note.content === 'string' ? note.content.trim() : '';

    if (
      !Number.isInteger(sura) ||
      !Number.isInteger(verse) ||
      sura < 1 ||
      sura > 114 ||
      verse < 1 ||
      !content ||
      content.length > maxContentLength ||
      !verseExists(String(sura), String(verse))
    ) {
      continue;
    }

    const updatedDate = new Date(note.updatedAt || Date.now());

    sanitized[`${sura}:${verse}`] = {
      sura: String(sura),
      verse: String(verse),
      content,
      updatedAt: Number.isNaN(updatedDate.getTime())
        ? new Date().toISOString()
        : updatedDate.toISOString()
    };
  }

  if (Object.keys(sanitized).length === 0 && entries.length > 0) {
    throw new Error('Dosyada geçerli not kaydı bulunamadı.');
  }

  return sanitized;
}
