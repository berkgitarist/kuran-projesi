const VERSE_PATTERN = /^(\d{1,3}):(\d{1,3})$/;

export function parseRouteHash(hashValue) {
  const hash = String(hashValue || '').replace(/^#/, '').trim();
  if (!hash) return { view: 'quran' };

  const params = new URLSearchParams(hash);

  for (const view of ['analiz', 'ayet']) {
    const value = params.get(view);
    const match = value?.match(VERSE_PATTERN);

    if (match) {
      return {
        view: view === 'analiz' ? 'analysis' : 'verse',
        sura: match[1],
        verse: match[2]
      };
    }
  }

  // Kur'an sayfası ve özel "İlk İnen Ayet" ekranı URL'ye yazılmaz.
  // Eski sayfa ve özel ekran bağlantıları temiz başlangıç olarak ele alınır.
  return { view: 'quran' };
}

export function buildRouteHash(route) {
  if (!route || route.view === 'quran') return '';

  if (route.view === 'analysis') {
    return `#analiz=${route.sura}:${route.verse}`;
  }

  if (route.view === 'verse') {
    return `#ayet=${route.sura}:${route.verse}`;
  }

  // Normal sayfa geçişleri ve manuel özel ekran temiz URL kullanır.
  return '';
}

export function createHistoryState(route, extra = {}) {
  return {
    app: 'KuranTeyit',
    route,
    ...extra
  };
}
