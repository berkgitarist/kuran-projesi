import {
  setupNativeBackButton,
  setupNativeSameWindowInternalLinks
} from './modules/platform-utils.js';

const CONFIG = {
  dataRoot: './data/evidence',
  pageSize: 20,
  relatedWordLimit: 12,
  relatedPhraseLimit: 10
};

const STATE = {
  ready: false,
  metadata: null,
  wordIndex: {},
  stemIndex: {},
  phraseIndex: {},
  wordAssociations: {},
  surfaceIndex: {},
  notesIndex: {},
  suraCache: new Map(),
  phraseMatchCache: new Map(),
  query: '',
  resultIds: [],
  resultType: '',
  usedSurfaceFallback: false,
  currentPage: 1,
  sourceVerseId: '',
  returnTarget: ''
};

const DOM = {
  form: document.getElementById('evidenceSearchForm'),
  backButton: document.getElementById('evidenceBackButton'),
  input: document.getElementById('evidenceSearchInput'),
  status: document.getElementById('evidenceStatus'),
  context: document.getElementById('evidenceContext'),
  summary: document.getElementById('evidenceSummary'),
  results: document.getElementById('evidenceResults'),
  pagination: document.getElementById('evidencePagination'),
  previousPage: document.getElementById('evidencePreviousPage'),
  nextPage: document.getElementById('evidenceNextPage'),
  pageInfo: document.getElementById('evidencePageInfo')
};

document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
  applySavedTheme();
  setupEvents();
  setupNativeSameWindowInternalLinks();
  await setupNativeBackButton();

  try {
    setStatus('Ayet araştırma verileri yükleniyor...');

    const [
      metadata,
      wordIndex,
      stemIndex,
      phraseIndex,
      wordAssociations,
      surfaceIndex,
      notesIndex
    ] = await Promise.all([
      fetchJson(`${CONFIG.dataRoot}/metadata.json`),
      fetchJson(`${CONFIG.dataRoot}/word-index-en.json`),
      fetchJson(`${CONFIG.dataRoot}/stem-index-en.json`),
      fetchJson(`${CONFIG.dataRoot}/phrase-index-en.json`),
      fetchOptionalJson(`${CONFIG.dataRoot}/word-associations-en.json`, {}),
      fetchOptionalJson(`${CONFIG.dataRoot}/surface-index-en.json`, {}),
      fetchOptionalJson(`${CONFIG.dataRoot}/notes-index.json`, {})
    ]);

    STATE.metadata = metadata;
    STATE.wordIndex = wordIndex || {};
    STATE.stemIndex = stemIndex || {};
    STATE.phraseIndex = phraseIndex || {};
    STATE.wordAssociations = wordAssociations || {};
    STATE.surfaceIndex = surfaceIndex || {};
    STATE.notesIndex = notesIndex || {};
    STATE.ready = true;

    setStatus(
      `${metadata.verse_count || 6234} ayet ve ` +
      `${metadata.sura_count || 114} sure hazır. Yapay zekâ kullanılmıyor.`
    );

    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get('q') || '';
    const sourceVerse = normalizeVerseId(params.get('verse'));

    STATE.sourceVerseId = sourceVerse;
    STATE.returnTarget = normalizeReturnTarget(params.get('return'));
    updateBackButtonDestination();

    if (urlQuery) {
      DOM.input.value = urlQuery;
      await runSearch(urlQuery, { updateAddress: false });
    } else if (sourceVerse) {
      DOM.input.value = sourceVerse;
      await runSearch(sourceVerse, { updateAddress: false });
    } else {
      await renderSourceContext();
    }
  } catch (error) {
    console.error(error);
    setStatus(`Veriler yüklenemedi: ${error.message}`, true);
  }
}

function setupEvents() {
  DOM.backButton?.addEventListener('click', (event) => {
    event.preventDefault();
    returnToQuranTeyit();
  });

  DOM.form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    STATE.sourceVerseId = '';
    await runSearch(DOM.input.value);
  });

  document.querySelectorAll('[data-example]').forEach((button) => {
    button.addEventListener('click', async () => {
      const query = button.dataset.example || '';
      STATE.sourceVerseId = '';
      DOM.input.value = query;
      await runSearch(query);
    });
  });

  DOM.previousPage?.addEventListener('click', async () => {
    if (STATE.currentPage <= 1) return;
    STATE.currentPage -= 1;
    await renderCurrentPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  DOM.nextPage?.addEventListener('click', async () => {
    const totalPages = getTotalPages();
    if (STATE.currentPage >= totalPages) return;
    STATE.currentPage += 1;
    await renderCurrentPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('.evidence-arabic-toggle');
    if (!toggle) return;

    const targetId = toggle.getAttribute('aria-controls');
    if (!targetId) return;

    const panel = document.getElementById(targetId);
    if (!panel) return;

    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
    toggle.classList.toggle('is-open', willOpen);
  });
}

function applySavedTheme() {
  const allowedThemes = [
    'light', 'dark', 'green', 'indigo', 'brown',
    'sky', 'blackyellow', 'bluemaize', 'redpeach', 'greenolive'
  ];

  let savedTheme = 'dark';

  try {
    const settings = JSON.parse(localStorage.getItem('quranAppSettings') || '{}');
    if (allowedThemes.includes(settings.theme)) savedTheme = settings.theme;
  } catch (error) {
    console.warn('Tema ayarı okunamadı:', error);
  }

  document.body.className = `${savedTheme}-theme evidence-page`;
  document.documentElement.classList.add(`${savedTheme}-theme`);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url} yüklenemedi (${response.status})`);
  return response.json();
}

async function fetchOptionalJson(url, fallback) {
  try {
    return await fetchJson(url);
  } catch (error) {
    console.warn(`İsteğe bağlı veri yüklenemedi: ${url}`, error);
    return fallback;
  }
}

async function runSearch(rawQuery, options = {}) {
  const { updateAddress = true } = options;

  if (!STATE.ready) {
    setStatus('Veriler henüz hazır değil.', true);
    return;
  }

  const query = String(rawQuery || '').trim();
  if (!query) {
    setStatus('Arama yapmak için bir değer yazın.', true);
    return;
  }

  STATE.query = query;
  STATE.currentPage = 1;
  STATE.resultIds = [];
  STATE.resultType = '';
  STATE.usedSurfaceFallback = false;

  DOM.results.innerHTML = '';
  DOM.summary.classList.add('hidden');
  DOM.pagination.classList.add('hidden');

  if (updateAddress) updateUrl(query);
  setStatus('Aranıyor...');

  const directVerse = normalizeVerseId(query);
  if (directVerse) {
    STATE.resultIds = [directVerse];
    STATE.resultType = 'verse';
    await renderSourceContext();
    await renderCurrentPage();
    return;
  }

  const normalizedQuery = normalizeEnglish(query);
  const exactPhraseEntry = findIndexEntry(STATE.phraseIndex, normalizedQuery);
  const phraseIds = collectVerseIds(exactPhraseEntry);

  if (normalizedQuery.includes(' ') && phraseIds.length > 0) {
    STATE.resultIds = phraseIds;
    STATE.resultType = 'phrase';
  } else {
    const indexedWordEntry = findIndexEntry(STATE.wordIndex, normalizedQuery);
    const surfaceWordEntry = findIndexEntry(STATE.surfaceIndex, normalizedQuery);
    const exactWordEntry = indexedWordEntry || surfaceWordEntry;
    const wordIds = collectVerseIds(exactWordEntry);

    if (wordIds.length > 0) {
      STATE.resultIds = wordIds;
      STATE.resultType = 'word';
      STATE.usedSurfaceFallback = !indexedWordEntry && Boolean(surfaceWordEntry);
    } else {
      const stemEntry = findIndexEntry(STATE.stemIndex, normalizedQuery);
      const stemIds = collectVerseIds(stemEntry);

      if (stemIds.length > 0) {
        STATE.resultIds = stemIds;
        STATE.resultType = 'stem';
      } else {
        STATE.resultIds = searchMultipleWords(normalizedQuery);
        STATE.resultType = 'free';
      }
    }
  }

  prioritizeSourceVerse();
  await renderSourceContext();
  await renderCurrentPage();
}

function prioritizeSourceVerse() {
  if (!STATE.sourceVerseId) return;
  const index = STATE.resultIds.indexOf(STATE.sourceVerseId);
  if (index <= 0) return;
  STATE.resultIds.splice(index, 1);
  STATE.resultIds.unshift(STATE.sourceVerseId);
}

function searchMultipleWords(query) {
  const words = query.split(/\s+/).map((word) => word.trim()).filter((word) => word.length >= 2);
  const scores = new Map();

  words.forEach((word) => {
    const directIds = collectVerseIds(findIndexEntry(STATE.wordIndex, word));
    const stemIds = collectVerseIds(findIndexEntry(STATE.stemIndex, word));

    directIds.forEach((verseId) => {
      scores.set(verseId, (scores.get(verseId) || 0) + 3);
    });

    stemIds.forEach((verseId) => {
      scores.set(verseId, (scores.get(verseId) || 0) + 1);
    });
  });

  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1] || compareVerseIds(left[0], right[0]))
    .map(([verseId]) => verseId);
}

function findIndexEntry(indexObject, query) {
  if (!indexObject || typeof indexObject !== 'object' || !query) return null;
  if (Object.prototype.hasOwnProperty.call(indexObject, query)) return indexObject[query];

  const matchingKey = Object.keys(indexObject).find((key) => normalizeEnglish(key) === query);
  return matchingKey ? indexObject[matchingKey] : null;
}

function collectVerseIds(value) {
  const result = new Set();

  function visit(currentValue, depth = 0) {
    if (currentValue === null || currentValue === undefined || depth > 8) return;

    if (typeof currentValue === 'string') {
      const matches = currentValue.match(/\b\d{1,3}:\d{1,3}\b/g);
      matches?.forEach((match) => result.add(match));
      return;
    }

    if (Array.isArray(currentValue)) {
      currentValue.forEach((item) => visit(item, depth + 1));
      return;
    }

    if (typeof currentValue === 'object') {
      Object.entries(currentValue).forEach(([key, item]) => {
        if (/^\d{1,3}:\d{1,3}$/.test(key)) result.add(key);
        visit(item, depth + 1);
      });
    }
  }

  visit(value);
  return [...result].sort(compareVerseIds);
}

function compareVerseIds(left, right) {
  const [leftSura, leftVerse] = String(left).split(':').map(Number);
  const [rightSura, rightVerse] = String(right).split(':').map(Number);
  return leftSura !== rightSura ? leftSura - rightSura : leftVerse - rightVerse;
}

async function renderSourceContext() {
  if (!DOM.context) return;

  if (!STATE.sourceVerseId) {
    DOM.context.innerHTML = '';
    DOM.context.classList.add('hidden');
    return;
  }

  const verse = await loadVerse(STATE.sourceVerseId);
  if (!verse) {
    DOM.context.innerHTML = `
      <div class="evidence-context-error">
        Başlangıç ayeti ${escapeHtml(STATE.sourceVerseId)} yüklenemedi.
      </div>
    `;
    DOM.context.classList.remove('hidden');
    return;
  }

  DOM.context.innerHTML = createSourceContextCard(verse);
  DOM.context.classList.remove('hidden');
  await hydrateRelatedVerseTranslations();
}

function getArabicPanelId(verseId, scope = 'result') {
  return `arabic-${scope}-${String(verseId).replace(/[^0-9A-Za-z_-]/g, '-')}`;
}

function createArabicToggleHtml(verseId, scope = 'result') {
  const panelId = getArabicPanelId(verseId, scope);

  return `
    <button
      type="button"
      class="evidence-arabic-toggle"
      aria-expanded="false"
      aria-controls="${escapeHtml(panelId)}"
      aria-label="${escapeHtml(`${verseId} Arapça metnini göster veya gizle`)}"
    >
      Arapça
    </button>
  `;
}

function createArabicPanelHtml(verse, verseId, scope = 'result') {
  const panelId = getArabicPanelId(verseId, scope);

  return `
    <div
      id="${escapeHtml(panelId)}"
      class="evidence-language evidence-language-ar evidence-arabic-panel"
      hidden
    >
      ${escapeHtml(verse.text_ar || '')}
    </div>
  `;
}

function createSourceContextCard(verse) {
  const verseId = verse.id || `${verse.sura}:${verse.verse}`;
  const phraseHtml = createVersePhraseSection(verse);
  const relatedHtml = createRelatedSection(verse);
  const noteHtml = createNotesSection(verseId);

  return `
    <article class="evidence-context-card">
      <div class="evidence-context-kicker">Araştırmanın başlangıç noktası</div>
      <div class="evidence-context-heading">
        <h2>${escapeHtml(verseId)}</h2>
        <div class="evidence-context-actions">
          ${createArabicToggleHtml(verseId, 'context')}
          <a href="${escapeHtml(buildEvidenceHref(verseId))}" target="_blank" rel="noopener">Ayeti ayrı incele ↗</a>
        </div>
      </div>

      ${createArabicPanelHtml(verse, verseId, 'context')}

      <div class="evidence-language evidence-language-en">
        <strong>Rashad Khalifa — English</strong>
        ${highlightText(verse.text_en || '', STATE.query)}
      </div>

      <div class="evidence-language evidence-language-tr">
        <strong>Türkçe</strong>
        ${escapeHtml(verse.text_tr || '')}
      </div>

      ${phraseHtml}
      ${noteHtml}
      ${relatedHtml}
    </article>
  `;
}

async function renderCurrentPage() {
  const totalResults = STATE.resultIds.length;

  if (totalResults === 0) {
    DOM.results.innerHTML = `
      <div class="evidence-empty">
        <h2>Sonuç bulunamadı</h2>
        <p>Bu sorgu için veri setinde yeterli ayet dayanağı bulunamadı.</p>
      </div>
    `;
    DOM.summary.classList.add('hidden');
    DOM.pagination.classList.add('hidden');
    setStatus('Sonuç bulunamadı.');
    return;
  }

  const totalPages = getTotalPages();
  if (STATE.currentPage > totalPages) STATE.currentPage = totalPages;

  const startIndex = (STATE.currentPage - 1) * CONFIG.pageSize;
  const pageIds = STATE.resultIds.slice(startIndex, startIndex + CONFIG.pageSize);

  setStatus(
    `${formatNumber(totalResults)} ayet bulundu. Gösterilen: ${formatNumber(startIndex + 1)}-` +
    `${formatNumber(Math.min(startIndex + pageIds.length, totalResults))}`
  );

  renderSummary(totalResults);

  const verses = await Promise.all(pageIds.map((verseId) => loadVerse(verseId)));
  DOM.results.innerHTML = verses.map((verse, index) => {
    const verseId = pageIds[index];
    return verse ? createVerseCard(verse) : createMissingVerseCard(verseId);
  }).join('');

  await hydrateRelatedVerseTranslations();
  renderPagination();
}

function renderSummary(totalResults) {
  const typeLabels = {
    verse: 'Ayet numarası',
    word: 'Birebir kelime',
    stem: 'Mekanik kelime ailesi',
    phrase: 'Birebir kelime kalıbı',
    free: 'Serbest metin'
  };

  const warning = STATE.resultType === 'phrase'
    ? `<p class="evidence-summary-warning">Bu sonuç ifadenin birebir geçtiği ayetleri gösterir; aynı hükmü taşıdığını tek başına kanıtlamaz.</p>`
    : '';

  DOM.summary.innerHTML = `
    <div class="evidence-summary-heading">
      <div>
        <div class="evidence-summary-kicker">Araştırma özeti</div>
        <h2>“${escapeHtml(STATE.query)}”</h2>
      </div>
      <span class="evidence-summary-count">${formatNumber(totalResults)} ayet</span>
    </div>
    ${createNarrativeSummaryHtml(totalResults)}
    <div class="evidence-summary-meta">
      <span><strong>Arama türü:</strong> ${escapeHtml(typeLabels[STATE.resultType] || 'Arama')}</span>
      <span><strong>Bulunan ayet:</strong> ${formatNumber(totalResults)}</span>
      ${STATE.sourceVerseId ? `<span><strong>Başlangıç:</strong> ${escapeHtml(STATE.sourceVerseId)}</span>` : ''}
    </div>
    ${warning}
    ${createQueryInsightsHtml()}
  `;

  DOM.summary.classList.remove('hidden');
}

function createNarrativeSummaryHtml(totalResults) {
  if (STATE.resultType === 'verse') {
    return `
      <div class="evidence-overview">
        <p><strong>${escapeHtml(STATE.query)}</strong> ayeti doğrudan inceleniyor.</p>
      </div>
    `;
  }

  const q = normalizeEnglish(STATE.query);
  if (!q) return '';

  if (STATE.resultType === 'phrase') {
    const phraseEntry = findIndexEntry(STATE.phraseIndex, q);
    const occurrences = Number(phraseEntry?.total_occurrences || 0);
    return `
      <div class="evidence-overview">
        <p><strong>“${escapeHtml(STATE.query)}”</strong> ifadesi ${formatNumber(totalResults)} farklı ayette${occurrences ? `, toplam ${formatNumber(occurrences)} kullanım olarak` : ''} bulunmaktadır.</p>
        <p>Bu sayı birebir metin eşleşmesini gösterir; ayetlerin aynı anlam veya hükmü taşıdığı sonucunu tek başına vermez.</p>
      </div>
    `;
  }

  if (STATE.resultType !== 'word' && STATE.resultType !== 'stem') return '';

  const indexedEntry = findIndexEntry(STATE.wordIndex, q);
  const surfaceEntry = findIndexEntry(STATE.surfaceIndex, q);
  const exactEntry = indexedEntry || surfaceEntry;
  const exactVerseCount = Number(exactEntry?.verse_count || totalResults);
  const exactOccurrences = Number(exactEntry?.total_occurrences || 0);
  const phraseStats = getPhraseMatchData(q);
  const stemKey = indexedEntry?.mechanical_stem || q;
  const stemEntry = findIndexEntry(STATE.stemIndex, stemKey);
  const stemVerseCount = Number(stemEntry?.verse_count || 0);
  const stemOccurrences = Number(stemEntry?.total_occurrences || 0);
  const surfaceForms = Object.entries(stemEntry?.surface_forms || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  const variants = Array.isArray(surfaceEntry?.variants)
    ? surfaceEntry.variants.slice(0, 10)
    : [];
  const associations = Array.isArray(STATE.wordAssociations[q])
    ? STATE.wordAssociations[q].slice(0, 5)
    : [];

  const paragraphs = [];
  paragraphs.push(
    `<p><strong>“${escapeHtml(STATE.query)}”</strong> kelimesi Rashad Khalifa İngilizce çevirisinde <strong>${formatNumber(exactVerseCount)} ayette</strong>${exactOccurrences ? `, toplam <strong>${formatNumber(exactOccurrences)} kullanım</strong> olarak` : ''} bulunmaktadır.</p>`
  );

  if (phraseStats.patternCount > 0) {
    paragraphs.push(
      `<p>Bu kelimeyi içeren <strong>${formatNumber(phraseStats.patternCount)} tekrar eden İngilizce kalıp</strong>, <strong>${formatNumber(phraseStats.uniqueVerseCount)} farklı ayete</strong> yayılmaktadır. Bunlar birebir metin kalıplarıdır; tek başına anlam eşitliği göstermez.</p>`
    );
  }

  if (variants.length > 1) {
    const variantText = variants
      .map((item) => `<strong>${escapeHtml(item.form)}</strong> (${formatNumber(item.occurrences)})`)
      .join(', ');
    paragraphs.push(`<p>Metindeki yazım biçimleri: ${variantText}.</p>`);
  }

  if (surfaceForms.length > 1 && stemVerseCount > 0) {
    const familyText = surfaceForms
      .slice(0, 8)
      .map(([word, count]) => `${escapeHtml(word)} (${formatNumber(count)})`)
      .join(', ');
    paragraphs.push(
      `<p>Mekanik arama ailesi ${familyText} biçimlerini birlikte değerlendirir ve ${formatNumber(stemVerseCount)} ayette${stemOccurrences ? ` toplam ${formatNumber(stemOccurrences)} kullanım` : ''} kapsar. Bu bir dilbilimsel kök veya anlam eşitliği iddiası değildir.</p>`
    );
  }

  if (associations.length > 0) {
    const associationText = associations
      .map((item) => `${escapeHtml(item.word)} (${formatNumber(item.cooccurring_verse_count)} ayet)`)
      .join(', ');
    paragraphs.push(`<p>En sık istatistiksel olarak birlikte geçen aday kelimeler: ${associationText}. Birlikte geçiş, teolojik veya anlamsal eşitlik kanıtı değildir.</p>`);
  }

  if (STATE.usedSurfaceFallback) {
    paragraphs.push(
      `<p class="evidence-overview-note">Bu kelime ana evidence kelime indeksinde yer almadığı için sonuçlar doğrudan Rashad ayet metninden oluşturulan tam yüzey kelime indeksinden getirildi.</p>`
    );
  }

  return `<div class="evidence-overview">${paragraphs.join('')}</div>`;
}

function getPhraseMatchData(query) {
  const q = normalizeEnglish(query);
  if (!q) return { matches: [], patternCount: 0, uniqueVerseCount: 0 };

  if (STATE.phraseMatchCache.has(q)) return STATE.phraseMatchCache.get(q);

  const queryWords = q.split(/\s+/).filter(Boolean);
  const uniqueVerseIds = new Set();
  const matches = [];

  Object.entries(STATE.phraseIndex).forEach(([phrase, entry]) => {
    const words = normalizeEnglish(phrase).split(/\s+/).filter(Boolean);
    if (!queryWords.every((word) => words.includes(word))) return;

    const verseIds = collectVerseIds(entry);
    verseIds.forEach((verseId) => uniqueVerseIds.add(verseId));
    matches.push({
      phrase,
      verseCount: Number(entry?.verse_count || verseIds.length),
      totalOccurrences: Number(entry?.total_occurrences || 0)
    });
  });

  matches.sort((a, b) => b.verseCount - a.verseCount || a.phrase.length - b.phrase.length);

  const result = {
    matches,
    patternCount: matches.length,
    uniqueVerseCount: uniqueVerseIds.size
  };

  STATE.phraseMatchCache.set(q, result);
  return result;
}

function createQueryInsightsHtml() {
  if (!STATE.query || STATE.resultType === 'verse' || STATE.resultType === 'free') return '';

  const q = normalizeEnglish(STATE.query);
  const sections = [];
  const exactWord = !q.includes(' ') ? findIndexEntry(STATE.wordIndex, q) : null;

  if (exactWord) {
    const stemKey = exactWord.mechanical_stem || q;
    const stemEntry = findIndexEntry(STATE.stemIndex, stemKey);
    const forms = Object.entries(stemEntry?.surface_forms || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 12);

    if (forms.length > 1) {
      sections.push(`
        <section class="evidence-insight-group">
          <h3>Mekanik kelime ailesi</h3>
          <div class="evidence-chip-list">
            ${forms.map(([word, count]) => createQueryChip(word, `${count} kullanım`)).join('')}
          </div>
          <p class="evidence-insight-note">Bu grup dilbilimsel kök iddiası değildir; mekanik arama ailesidir.</p>
        </section>
      `);
    }

    const associations = Array.isArray(STATE.wordAssociations[q])
      ? STATE.wordAssociations[q].slice(0, CONFIG.relatedWordLimit)
      : [];

    if (associations.length > 0) {
      sections.push(`
        <section class="evidence-insight-group">
          <h3>İstatistiksel birlikte geçen kelimeler</h3>
          <div class="evidence-chip-list">
            ${associations.map((item) => createQueryChip(item.word, `${item.cooccurring_verse_count} ayet`)).join('')}
          </div>
          <p class="evidence-insight-note">Birlikte geçiş, anlam eşitliği veya teolojik bağ kanıtı değildir.</p>
        </section>
      `);
    }
  }

  const relatedPhrases = findRelatedPhrases(q);
  if (relatedPhrases.length > 0) {
    sections.push(`
      <section class="evidence-insight-group">
        <h3>Kelimenin geçtiği tekrar eden ifadeler</h3>
        <div class="evidence-chip-list evidence-chip-list--phrases">
          ${relatedPhrases.map((item) => createQueryChip(item.phrase, `${item.verseCount} ayet`)).join('')}
        </div>
      </section>
    `);
  }

  if (sections.length === 0) return '';
  return `<div class="evidence-insights">${sections.join('')}</div>`;
}

function createQueryChip(query, meta = '') {
  return `
    <a class="evidence-query-chip" href="${escapeHtml(buildEvidenceHref(query))}">
      <span>${escapeHtml(query)}</span>
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
    </a>
  `;
}

function findRelatedPhrases(query) {
  return getPhraseMatchData(query).matches.slice(0, CONFIG.relatedPhraseLimit);
}

function renderPagination() {
  const totalPages = getTotalPages();
  if (totalPages <= 1) {
    DOM.pagination.classList.add('hidden');
    return;
  }

  DOM.pageInfo.textContent = `${STATE.currentPage} / ${totalPages}`;
  DOM.previousPage.disabled = STATE.currentPage <= 1;
  DOM.nextPage.disabled = STATE.currentPage >= totalPages;
  DOM.pagination.classList.remove('hidden');
}

function getTotalPages() {
  return Math.max(1, Math.ceil(STATE.resultIds.length / CONFIG.pageSize));
}

async function loadVerse(verseId) {
  const [suraNumber, verseNumber] = String(verseId).split(':');
  if (!suraNumber || !verseNumber) return null;

  let suraData = STATE.suraCache.get(suraNumber);
  if (!suraData) {
    try {
      suraData = await fetchJson(`${CONFIG.dataRoot}/suras/${suraNumber}.json`);
      STATE.suraCache.set(suraNumber, suraData);
    } catch (error) {
      console.error(`${suraNumber}. sure yüklenemedi:`, error);
      return null;
    }
  }

  return suraData?.verses?.[verseNumber] || null;
}

function createVerseCard(verse) {
  const verseId = verse.id || `${verse.sura}:${verse.verse}`;
  const showDeepEvidence = STATE.resultType === 'verse';
  const relatedHtml = showDeepEvidence ? createRelatedSection(verse) : '';
  const phraseHtml = showDeepEvidence ? createVersePhraseSection(verse) : '';
  const noteHtml = showDeepEvidence ? createNotesSection(verseId) : '';
  const badge = STATE.sourceVerseId === verseId ? 'Başlangıç Ayeti' : getResultBadge();

  return `
    <article class="evidence-card ${STATE.sourceVerseId === verseId ? 'evidence-card--source' : ''}">
      <header class="evidence-card-header">
        <h2>
          <a href="${escapeHtml(buildEvidenceHref(verseId))}" target="_blank" rel="noopener">${escapeHtml(verseId)}</a>
        </h2>
        <div class="evidence-card-header-actions">
          ${createArabicToggleHtml(verseId, 'result')}
          <span class="evidence-badge">${escapeHtml(badge)}</span>
        </div>
      </header>

      <div class="evidence-card-body">
        ${createArabicPanelHtml(verse, verseId, 'result')}

        <div class="evidence-language evidence-language-en">
          <strong>Rashad Khalifa — English</strong>
          ${highlightText(verse.text_en || '', STATE.query)}
        </div>

        <div class="evidence-language evidence-language-tr">
          <strong>Türkçe</strong>
          ${escapeHtml(verse.text_tr || '')}
        </div>

        ${phraseHtml}
        ${noteHtml}
        ${relatedHtml}
      </div>
    </article>
  `;
}

function getResultBadge() {
  const labels = {
    verse: 'Kaynak Ayet',
    word: 'Birebir Kelime',
    stem: 'Kelime Ailesi',
    phrase: 'Birebir Kalıp',
    free: 'Sıralanmış Sonuç'
  };
  return labels[STATE.resultType] || 'Ayet';
}

function createVersePhraseSection(verse) {
  const phrases = Array.isArray(verse.maximal_repeated_phrases_en)
    ? verse.maximal_repeated_phrases_en.slice(0, 10)
    : [];

  if (phrases.length === 0) return '';

  return `
    <section class="evidence-verse-phrases">
      <h3>Bu ayetteki tekrar eden İngilizce ifadeler</h3>
      <div class="evidence-chip-list evidence-chip-list--phrases">
        ${phrases.map((item) => createQueryChip(item.phrase, `${item.verse_count} ayet`)).join('')}
      </div>
    </section>
  `;
}

function createNotesSection(verseId) {
  const notes = Array.isArray(STATE.notesIndex[verseId]) ? STATE.notesIndex[verseId] : [];
  if (notes.length === 0) return '';

  return `
    <section class="evidence-notes">
      <h3>Rashad Khalifa dipnotları</h3>
      ${notes.map((note) => {
        const refs = Array.isArray(note.refs) ? note.refs : [];
        const appendices = Array.isArray(note.appendices) ? note.appendices : [];

        return `
          <article class="evidence-note-card">
            <div class="evidence-note-label">*${escapeHtml(note.label || verseId)}</div>
            ${note.en ? `<p><strong>English:</strong> ${escapeHtml(note.en)}</p>` : ''}
            ${note.tr ? `<p><strong>Türkçe:</strong> ${escapeHtml(note.tr)}</p>` : ''}
            ${refs.length ? `
              <div class="evidence-note-refs">
                <strong>Ayet referansları:</strong>
                ${refs.map((ref) => `<a href="${escapeHtml(buildEvidenceHref(ref))}" target="_blank" rel="noopener">${escapeHtml(ref)}</a>`).join('')}
              </div>
            ` : ''}
            ${appendices.length ? `
              <div class="evidence-note-appendices">
                <strong>Ek referansları:</strong>
                ${appendices.map((number) => `<span>Ek ${number}</span>`).join('')}
              </div>
            ` : ''}
          </article>
        `;
      }).join('')}
    </section>
  `;
}

function createRelatedSection(verse) {
  const sections = [];

  const previousAndNext = [verse.previous_verse, verse.next_verse]
    .filter(Boolean)
    .filter((verseId) => verseId !== verse.id);

  if (previousAndNext.length > 0) {
    sections.push(createRelatedGroup('Önceki ve sonraki ayet', previousAndNext, 'normal'));
  }

  const lexicalIds = collectVerseIds(verse.lexical_neighbors)
    .filter((verseId) => verseId !== verse.id)
    .slice(0, 10);

  if (lexicalIds.length > 0) {
    sections.push(createRelatedGroup('Sözcüksel bağlantılar', lexicalIds, 'yellow'));
  }

  const clauseIds = collectVerseIds(verse.similar_phrase_patterns)
    .filter((verseId) => verseId !== verse.id)
    .slice(0, 10);

  if (clauseIds.length > 0) {
    sections.push(createRelatedGroup('Benzer cümlecik kalıpları', clauseIds, 'yellow'));
  }

  const themeIds = collectVerseIds(verse.filtered_theme_neighbors)
    .filter((verseId) => verseId !== verse.id)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 10);

  if (themeIds.length > 0) {
    sections.push(createRelatedGroup('Deneysel tema bağlantıları', themeIds, 'experimental'));
  }

  if (sections.length === 0) return '';

  const experimentalWarning = themeIds.length > 0
    ? `<div class="evidence-related-warning experimental-note">Deneysel tema bağlantıları ayet metinlerinden istatistiksel olarak çıkarılmış adaylardır; kesin hüküm veya kesin anlam kanıtı değildir.</div>`
    : '';

  return `
    <section class="evidence-related">
      <h3 class="evidence-related-main-title">Bağlantılı ayetler</h3>
      <div class="evidence-related-sections">
        ${sections.join('')}
        ${experimentalWarning}
      </div>
    </section>
  `;
}

function createRelatedGroup(title, verseIds, variant = 'normal') {
  if (!Array.isArray(verseIds) || verseIds.length === 0) return '';

  const links = verseIds.map((verseId) => `
    <a
      class="evidence-related-verse"
      data-related-id="${escapeHtml(verseId)}"
      href="${escapeHtml(buildEvidenceHref(verseId))}"
      target="_blank"
      rel="noopener"
      aria-label="${escapeHtml(verseId)} ayetini yeni sekmede aç"
    >
      <span class="evidence-related-verse-id">${escapeHtml(verseId)}</span>
      <span class="evidence-related-verse-separator" aria-hidden="true">:</span>
      <span class="evidence-related-verse-text">Türkçe çeviri yükleniyor...</span>
    </a>
  `).join('');

  return `
    <section class="evidence-related-group evidence-related-group--${variant}">
      <h4 class="evidence-related-group-title evidence-related-group-title--${variant}">${escapeHtml(title)}</h4>
      <div class="evidence-related-links">${links}</div>
    </section>
  `;
}

async function hydrateRelatedVerseTranslations() {
  const relatedElements = [...document.querySelectorAll('.evidence-related-verse[data-related-id]')];
  if (relatedElements.length === 0) return;

  const uniqueVerseIds = [...new Set(relatedElements.map((element) => element.dataset.relatedId).filter(Boolean))];
  const relatedVerseMap = new Map();

  await Promise.all(uniqueVerseIds.map(async (verseId) => {
    try {
      relatedVerseMap.set(verseId, await loadVerse(verseId));
    } catch (error) {
      console.error(`${verseId} bağlantılı ayeti yüklenemedi:`, error);
      relatedVerseMap.set(verseId, null);
    }
  }));

  relatedElements.forEach((element) => {
    const verseId = element.dataset.relatedId;
    const verse = relatedVerseMap.get(verseId);
    const textElement = element.querySelector('.evidence-related-verse-text');
    if (!textElement) return;

    if (verse?.text_tr) {
      textElement.textContent = verse.text_tr;
      element.title = `${verseId}: ${verse.text_tr}`;
    } else {
      textElement.textContent = 'Türkçe çeviri bulunamadı.';
      element.classList.add('evidence-related-verse--missing');
    }
  });
}

function createMissingVerseCard(verseId) {
  return `
    <div class="evidence-empty">
      <strong>${escapeHtml(verseId)}</strong>
      <p>Bu ayetin veri dosyası okunamadı.</p>
    </div>
  `;
}

function highlightText(text, query) {
  const safeText = escapeHtml(text);
  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery || /^\d{1,3}\s*:\s*\d{1,3}$/.test(normalizedQuery)) return safeText;

  const queryWords = normalizedQuery
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
    .sort((left, right) => right.length - left.length);

  if (queryWords.length === 0) return safeText;

  const pattern = queryWords.map(escapeRegExp).join('|');
  const expression = new RegExp(`(${pattern})`, 'gi');
  return safeText.replace(expression, '<mark class="evidence-highlight">$1</mark>');
}

function normalizeVerseId(value) {
  const match = String(value || '').trim().match(/^(\d{1,3})\s*:\s*(\d{1,3})$/);
  if (!match) return '';
  const sura = Number(match[1]);
  const verse = Number(match[2]);
  if (!Number.isInteger(sura) || sura < 1 || sura > 114 || !Number.isInteger(verse) || verse < 1) return '';
  return `${sura}:${verse}`;
}

function normalizeEnglish(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEvidenceHref(query) {
  const params = new URLSearchParams();
  params.set('q', String(query || '').trim());

  if (STATE.returnTarget) {
    params.set('return', STATE.returnTarget);
  }

  return `./evidence.html?${params.toString()}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR').format(Number(value) || 0);
}

function normalizeReturnTarget(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';

  try {
    const url = new URL(candidate, window.location.href);
    if (url.origin !== window.location.origin) return '';
    return url.href;
  } catch (error) {
    return '';
  }
}

function getFallbackReturnTarget() {
  if (STATE.sourceVerseId) {
    return new URL(`./index.html#ayet=${STATE.sourceVerseId}`, window.location.href).href;
  }

  return new URL('./index.html', window.location.href).href;
}

function updateBackButtonDestination() {
  if (!DOM.backButton) return;
  DOM.backButton.href = STATE.returnTarget || getFallbackReturnTarget();
}

function returnToQuranTeyit() {
  const target = STATE.returnTarget || getFallbackReturnTarget();
  if (target) {
    window.location.href = target;
    return;
  }

  if (history.length > 1) {
    history.back();
    return;
  }

  window.location.href = './index.html';
}

function setStatus(message, isError = false) {
  DOM.status.textContent = message;
  DOM.status.classList.toggle('error', isError);
}

function updateUrl(query) {
  const url = new URL(window.location.href);
  url.searchParams.set('q', query);

  if (STATE.sourceVerseId) {
    url.searchParams.set('verse', STATE.sourceVerseId);
  } else {
    url.searchParams.delete('verse');
  }

  if (STATE.returnTarget) {
    url.searchParams.set('return', STATE.returnTarget);
  } else {
    url.searchParams.delete('return');
  }

  history.replaceState(null, '', url);
}
