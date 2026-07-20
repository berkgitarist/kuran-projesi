export function escapeHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeTurkishText(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSearchText(value) {
  return normalizeTurkishText(value)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(left, right) {
  let a = String(left ?? '');
  let b = String(right ?? '');

  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Daha az bellek kullanmak için kısa metni satır olarak tut.
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  let previous = Array.from({ length: a.length + 1 }, (_, index) => index);
  let current = new Array(a.length + 1);

  for (let row = 1; row <= b.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= a.length; column += 1) {
      const substitutionCost = a[column - 1] === b[row - 1] ? 0 : 1;

      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost
      );
    }

    [previous, current] = [current, previous];
  }

  return previous[a.length];
}

export function getSearchMatchScore(query, text, preNormalizedText = '') {
  const q = normalizeSearchText(query);
  const t = preNormalizedText || normalizeSearchText(text);

  if (!q || !t) return 0;
  if (t === q) return 100;

  const words = t.split(/\s+/).filter(Boolean);

  if (words.includes(q)) return 100;
  if (t.includes(q)) return 95;

  let bestScore = 0;

  for (const word of words) {
    if (word.startsWith(q)) {
      bestScore = Math.max(bestScore, Math.max(85, 96 - (word.length - q.length)));
      continue;
    }

    if (word.includes(q)) {
      bestScore = Math.max(bestScore, 92);
      continue;
    }

    // Çok farklı uzunluktaki kelimelerde pahalı benzerlik hesabını atla.
    if (Math.abs(word.length - q.length) > Math.max(3, Math.ceil(q.length * 0.55))) {
      continue;
    }

    const maxLength = Math.max(q.length, word.length);
    const distance = levenshtein(q, word);
    const similarity = Math.round((1 - distance / maxLength) * 100);
    bestScore = Math.max(bestScore, similarity);
  }

  return Math.max(0, Math.min(100, bestScore));
}

export function expandVerseRefs(refText) {
  if (!refText || typeof refText !== 'string') return [];

  const refs = [];
  let currentSura = null;

  refText.split(';').forEach((part) => {
    part.split(',').forEach((item) => {
      const clean = item.trim();
      if (!clean) return;

      const fullMatch = clean.match(/^(\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/);

      if (fullMatch) {
        currentSura = fullMatch[1];
        const startVerse = Number(fullMatch[2]);
        const endSura = fullMatch[3] || currentSura;
        const endVerse = fullMatch[4] ? Number(fullMatch[4]) : startVerse;

        if (endSura === currentSura) {
          for (let verse = startVerse; verse <= endVerse; verse += 1) {
            refs.push(`${currentSura}:${verse}`);
          }
        } else {
          // Farklı surelere uzanan aralıklar veri kaynağında nadirdir.
          // Başlangıç ve bitiş referanslarını kaybetmeden sakla.
          refs.push(`${currentSura}:${startVerse}`);
          refs.push(`${endSura}:${endVerse}`);
        }

        return;
      }

      const shortMatch = clean.match(/^(\d+)(?:-(\d+))?$/);

      if (shortMatch && currentSura) {
        const startVerse = Number(shortMatch[1]);
        const endVerse = shortMatch[2] ? Number(shortMatch[2]) : startVerse;

        for (let verse = startVerse; verse <= endVerse; verse += 1) {
          refs.push(`${currentSura}:${verse}`);
        }
      }
    });
  });

  return [...new Set(refs)];
}
