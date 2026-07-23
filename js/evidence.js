const CONFIG = {
  dataRoot: './data/evidence',
  pageSize: 20
};

const STATE = {
  ready: false,
  metadata: null,
  wordIndex: {},
  stemIndex: {},
  phraseIndex: {},
  suraCache: new Map(),
  query: '',
  resultIds: [],
  resultType: '',
  currentPage: 1
};

const DOM = {
  form: document.getElementById('evidenceSearchForm'),
  input: document.getElementById('evidenceSearchInput'),
  status: document.getElementById('evidenceStatus'),
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

  try {
    setStatus('Ayet araştırma verileri yükleniyor...');

    const [
      metadata,
      wordIndex,
      stemIndex,
      phraseIndex
    ] = await Promise.all([
      fetchJson(`${CONFIG.dataRoot}/metadata.json`),
      fetchJson(`${CONFIG.dataRoot}/word-index-en.json`),
      fetchJson(`${CONFIG.dataRoot}/stem-index-en.json`),
      fetchJson(`${CONFIG.dataRoot}/phrase-index-en.json`)
    ]);

    STATE.metadata = metadata;
    STATE.wordIndex = wordIndex || {};
    STATE.stemIndex = stemIndex || {};
    STATE.phraseIndex = phraseIndex || {};
    STATE.ready = true;

    setStatus(
      `${metadata.verse_count || 6234} ayet ve ` +
      `${metadata.sura_count || 114} sure hazır.`
    );

    const urlQuery = new URLSearchParams(
      window.location.search
    ).get('q');

    if (urlQuery) {
      DOM.input.value = urlQuery;
      await runSearch(urlQuery);
    }
  } catch (error) {
    console.error(error);

    setStatus(
      `Veriler yüklenemedi: ${error.message}`,
      true
    );
  }
}

function setupEvents() {
  DOM.form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    await runSearch(
      DOM.input.value
    );
  });

  document
    .querySelectorAll('[data-example]')
    .forEach((button) => {
      button.addEventListener('click', async () => {
        const query = button.dataset.example || '';

        DOM.input.value = query;

        await runSearch(query);
      });
    });

  DOM.previousPage?.addEventListener('click', () => {
    if (STATE.currentPage <= 1) {
      return;
    }

    STATE.currentPage -= 1;
    renderCurrentPage();

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  DOM.nextPage?.addEventListener('click', () => {
    const totalPages = getTotalPages();

    if (STATE.currentPage >= totalPages) {
      return;
    }

    STATE.currentPage += 1;
    renderCurrentPage();

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

function applySavedTheme() {
  const allowedThemes = [
    'light',
    'dark',
    'green',
    'indigo',
    'brown',
    'sky',
    'blackyellow',
    'bluemaize',
    'redpeach',
    'greenolive'
  ];

  let savedTheme = 'dark';

  try {
    const settings = JSON.parse(
      localStorage.getItem('quranAppSettings') || '{}'
    );

    if (allowedThemes.includes(settings.theme)) {
      savedTheme = settings.theme;
    }
  } catch (error) {
    console.warn(
      'Tema ayarı okunamadı:',
      error
    );
  }

  document.body.className =
    `${savedTheme}-theme evidence-page`;

  document.documentElement.classList.add(
    `${savedTheme}-theme`
  );
}

async function fetchJson(url) {
  const response = await fetch(url, {
    cache: 'no-cache'
  });

  if (!response.ok) {
    throw new Error(
      `${url} yüklenemedi (${response.status})`
    );
  }

  return response.json();
}

async function runSearch(rawQuery) {
  if (!STATE.ready) {
    setStatus(
      'Veriler henüz hazır değil.',
      true
    );

    return;
  }

  const query = String(rawQuery || '').trim();

  if (!query) {
    setStatus(
      'Arama yapmak için bir değer yazın.',
      true
    );

    return;
  }

  STATE.query = query;
  STATE.currentPage = 1;
  STATE.resultIds = [];
  STATE.resultType = '';

  DOM.results.innerHTML = '';
  DOM.summary.classList.add('hidden');
  DOM.pagination.classList.add('hidden');

  updateUrl(query);
  setStatus('Aranıyor...');

  const verseMatch = query.match(
    /^(\d{1,3})\s*:\s*(\d{1,3})$/
  );

  if (verseMatch) {
    const verseId =
      `${Number(verseMatch[1])}:${Number(verseMatch[2])}`;

    STATE.resultIds = [verseId];
    STATE.resultType = 'verse';

    await renderCurrentPage();
    return;
  }

  const normalizedQuery =
    normalizeEnglish(query);

  const exactPhraseEntry =
    findIndexEntry(
      STATE.phraseIndex,
      normalizedQuery
    );

  const phraseIds =
    collectVerseIds(exactPhraseEntry);

  if (
    query.includes(' ') &&
    phraseIds.length > 0
  ) {
    STATE.resultIds = phraseIds;
    STATE.resultType = 'phrase';

    await renderCurrentPage();
    return;
  }

  const exactWordEntry =
    findIndexEntry(
      STATE.wordIndex,
      normalizedQuery
    );

  const wordIds =
    collectVerseIds(exactWordEntry);

  if (wordIds.length > 0) {
    STATE.resultIds = wordIds;
    STATE.resultType = 'word';

    await renderCurrentPage();
    return;
  }

  const stemEntry =
    findIndexEntry(
      STATE.stemIndex,
      normalizedQuery
    );

  const stemIds =
    collectVerseIds(stemEntry);

  if (stemIds.length > 0) {
    STATE.resultIds = stemIds;
    STATE.resultType = 'stem';

    await renderCurrentPage();
    return;
  }

  const freeSearchIds =
    searchMultipleWords(normalizedQuery);

  STATE.resultIds = freeSearchIds;
  STATE.resultType = 'free';

  await renderCurrentPage();
}

function searchMultipleWords(query) {
  const words = query
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);

  const scores = new Map();

  words.forEach((word) => {
    const directIds = collectVerseIds(
      findIndexEntry(
        STATE.wordIndex,
        word
      )
    );

    const stemIds = collectVerseIds(
      findIndexEntry(
        STATE.stemIndex,
        word
      )
    );

    directIds.forEach((verseId) => {
      scores.set(
        verseId,
        (scores.get(verseId) || 0) + 3
      );
    });

    stemIds.forEach((verseId) => {
      scores.set(
        verseId,
        (scores.get(verseId) || 0) + 1
      );
    });
  });

  return [...scores.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return compareVerseIds(
        left[0],
        right[0]
      );
    })
    .map(([verseId]) => verseId);
}

function findIndexEntry(indexObject, query) {
  if (
    !indexObject ||
    typeof indexObject !== 'object'
  ) {
    return null;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      indexObject,
      query
    )
  ) {
    return indexObject[query];
  }

  const matchingKey = Object.keys(indexObject)
    .find((key) => {
      return normalizeEnglish(key) === query;
    });

  return matchingKey
    ? indexObject[matchingKey]
    : null;
}

function collectVerseIds(value) {
  const result = new Set();

  function visit(currentValue, depth = 0) {
    if (
      currentValue === null ||
      currentValue === undefined ||
      depth > 8
    ) {
      return;
    }

    if (typeof currentValue === 'string') {
      const matches = currentValue.match(
        /\b\d{1,3}:\d{1,3}\b/g
      );

      matches?.forEach((match) => {
        result.add(match);
      });

      return;
    }

    if (Array.isArray(currentValue)) {
      currentValue.forEach((item) => {
        visit(item, depth + 1);
      });

      return;
    }

    if (typeof currentValue === 'object') {
      Object.entries(currentValue)
        .forEach(([key, item]) => {
          if (/^\d{1,3}:\d{1,3}$/.test(key)) {
            result.add(key);
          }

          visit(item, depth + 1);
        });
    }
  }

  visit(value);

  return [...result]
    .sort(compareVerseIds);
}

function compareVerseIds(left, right) {
  const [
    leftSura,
    leftVerse
  ] = String(left)
    .split(':')
    .map(Number);

  const [
    rightSura,
    rightVerse
  ] = String(right)
    .split(':')
    .map(Number);

  if (leftSura !== rightSura) {
    return leftSura - rightSura;
  }

  return leftVerse - rightVerse;
}

async function renderCurrentPage() {
  const totalResults =
    STATE.resultIds.length;

  if (totalResults === 0) {
    DOM.results.innerHTML = `
      <div class="evidence-empty">
        <h2>Sonuç bulunamadı</h2>

        <p>
          Bu sorgu için veri setinde yeterli ayet dayanağı bulunamadı.
        </p>
      </div>
    `;

    DOM.summary.classList.add('hidden');
    DOM.pagination.classList.add('hidden');

    setStatus('Sonuç bulunamadı.');
    return;
  }

  const totalPages =
    getTotalPages();

  if (STATE.currentPage > totalPages) {
    STATE.currentPage = totalPages;
  }

  const startIndex =
    (STATE.currentPage - 1) *
    CONFIG.pageSize;

  const pageIds =
    STATE.resultIds.slice(
      startIndex,
      startIndex + CONFIG.pageSize
    );

  setStatus(
    `${totalResults} ayet bulundu. ` +
    `Gösterilen: ${startIndex + 1}-` +
    `${Math.min(startIndex + pageIds.length, totalResults)}`
  );

  renderSummary(totalResults);

  const verses = await Promise.all(
    pageIds.map((verseId) => {
      return loadVerse(verseId);
    })
  );

  DOM.results.innerHTML = verses
  .map((verse, index) => {
    const verseId = pageIds[index];

    return verse
      ? createVerseCard(verse)
      : createMissingVerseCard(verseId);
  })
  .join('');

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

  const warning =
    STATE.resultType === 'phrase'
      ? `
        <p>
          Bu sonuç, ifadenin birebir geçtiği ayetleri gösterir.
          Ayetlerin aynı hükmü taşıdığını tek başına kanıtlamaz.
        </p>
      `
      : '';

  DOM.summary.innerHTML = `
    <h2>
      “${escapeHtml(STATE.query)}”
    </h2>

    <p>
      <strong>Arama türü:</strong>
      ${escapeHtml(typeLabels[STATE.resultType] || 'Arama')}
    </p>

    <p>
      <strong>Bulunan ayet:</strong>
      ${totalResults}
    </p>

    ${warning}
  `;

  DOM.summary.classList.remove('hidden');
}

function renderPagination() {
  const totalPages =
    getTotalPages();

  if (totalPages <= 1) {
    DOM.pagination.classList.add('hidden');
    return;
  }

  DOM.pageInfo.textContent =
    `${STATE.currentPage} / ${totalPages}`;

  DOM.previousPage.disabled =
    STATE.currentPage <= 1;

  DOM.nextPage.disabled =
    STATE.currentPage >= totalPages;

  DOM.pagination.classList.remove('hidden');
}

function getTotalPages() {
  return Math.max(
    1,
    Math.ceil(
      STATE.resultIds.length /
      CONFIG.pageSize
    )
  );
}

async function loadVerse(verseId) {
  const [
    suraNumber,
    verseNumber
  ] = String(verseId).split(':');

  if (!suraNumber || !verseNumber) {
    return null;
  }

  let suraData =
    STATE.suraCache.get(suraNumber);

  if (!suraData) {
    try {
      suraData = await fetchJson(
        `${CONFIG.dataRoot}/suras/${suraNumber}.json`
      );

      STATE.suraCache.set(
        suraNumber,
        suraData
      );
    } catch (error) {
      console.error(
        `${suraNumber}. sure yüklenemedi:`,
        error
      );

      return null;
    }
  }

  return (
    suraData?.verses?.[verseNumber] ||
    null
  );
}

function createVerseCard(verse) {
  const verseId =
    verse.id ||
    `${verse.sura}:${verse.verse}`;

  const relatedHtml =
    STATE.resultType === 'verse'
      ? createRelatedSection(verse)
      : '';

  return `
    <article class="evidence-card">
      <header class="evidence-card-header">
        <h2>
          <a
            href="./evidence.html?q=${encodeURIComponent(verseId)}"
            target="_blank"
            rel="noopener"
          >
            ${escapeHtml(verseId)}
          </a>
        </h2>

        <span class="evidence-badge">
          ${escapeHtml(getResultBadge())}
        </span>
      </header>

      <div class="evidence-card-body">
        <div class="evidence-language evidence-language-ar">
          <strong>Arapça</strong>

          ${escapeHtml(verse.text_ar || '')}
        </div>

        <div class="evidence-language evidence-language-en">
          <strong>English</strong>

          ${highlightText(
            verse.text_en || '',
            STATE.query
          )}
        </div>

        <div class="evidence-language evidence-language-tr">
          <strong>Türkçe</strong>

          ${highlightText(
            verse.text_tr || '',
            STATE.query
          )}
        </div>

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
function createRelatedSection(verse) {
  const sections = [];

  const previousAndNext = [
    verse.previous_verse,
    verse.next_verse
  ]
    .filter(Boolean)
    .filter((verseId) => {
      return verseId !== verse.id;
    });

  if (previousAndNext.length > 0) {
    sections.push(
      createRelatedGroup(
        'Önceki ve sonraki ayet',
        previousAndNext,
        'normal'
      )
    );
  }

  const lexicalIds = collectVerseIds(
    verse.lexical_neighbors
  )
    .filter((verseId) => {
      return verseId !== verse.id;
    })
    .slice(0, 10);

  if (lexicalIds.length > 0) {
    sections.push(
      createRelatedGroup(
        'Sözcüksel bağlantılar',
        lexicalIds,
        'yellow'
      )
    );
  }

  const clauseIds = collectVerseIds(
    verse.similar_phrase_patterns
  )
    .filter((verseId) => {
      return verseId !== verse.id;
    })
    .slice(0, 10);

  if (clauseIds.length > 0) {
    sections.push(
      createRelatedGroup(
        'Benzer cümlecik kalıpları',
        clauseIds,
        'yellow'
      )
    );
  }

  const themeIds = [
    ...collectVerseIds(
      verse.filtered_theme_neighbors
    ),
    ...collectVerseIds(
      verse.topic_candidates
    )
  ]
    .filter((verseId) => {
      return verseId !== verse.id;
    })
    .filter((value, index, array) => {
      return array.indexOf(value) === index;
    })
    .slice(0, 10);

  if (themeIds.length > 0) {
    sections.push(
      createRelatedGroup(
        'Deneysel tema bağlantıları',
        themeIds,
        'experimental'
      )
    );
  }

  if (sections.length === 0) {
    return '';
  }

  const experimentalWarning =
    themeIds.length > 0
      ? `
        <div class="evidence-related-warning experimental-note">
          Deneysel tema bağlantıları, ayet metinlerinden
          istatistiksel olarak çıkarılmış bağlantı adaylarıdır.
          Kesin hüküm veya kesin anlam kanıtı değildir.
        </div>
      `
      : '';

  return `
    <section class="evidence-related">
      <h3 class="evidence-related-main-title">
        Bağlantılı ayetler
      </h3>

      <div class="evidence-related-sections">
        ${sections.join('')}
        ${experimentalWarning}
      </div>
    </section>
  `;
}

function createRelatedGroup(
  title,
  verseIds,
  variant = 'normal'
) {
  if (
    !Array.isArray(verseIds) ||
    verseIds.length === 0
  ) {
    return '';
  }

  const links = verseIds
    .map((verseId) => {
      return `
        <a
          class="evidence-related-verse"
          data-related-id="${escapeHtml(verseId)}"
          href="./evidence.html?q=${encodeURIComponent(verseId)}"
          target="_blank"
          rel="noopener"
          aria-label="${escapeHtml(verseId)} ayetini yeni sekmede aç"
        >
          <span class="evidence-related-verse-id">
            ${escapeHtml(verseId)}
          </span>

          <span
            class="evidence-related-verse-separator"
            aria-hidden="true"
          >
            :
          </span>

          <span class="evidence-related-verse-text">
            Türkçe çeviri yükleniyor...
          </span>
        </a>
      `;
    })
    .join('');

  return `
    <section
      class="evidence-related-group
      evidence-related-group--${variant}"
    >
      <h4
        class="evidence-related-group-title
        evidence-related-group-title--${variant}"
      >
        ${escapeHtml(title)}
      </h4>

      <div class="evidence-related-links">
        ${links}
      </div>
    </section>
  `;
}

async function hydrateRelatedVerseTranslations() {
  const relatedElements = [
    ...document.querySelectorAll(
      '.evidence-related-verse[data-related-id]'
    )
  ];

  if (relatedElements.length === 0) {
    return;
  }

  const uniqueVerseIds = [
    ...new Set(
      relatedElements
        .map((element) => {
          return element.dataset.relatedId;
        })
        .filter(Boolean)
    )
  ];

  const relatedVerseMap = new Map();

  for (const verseId of uniqueVerseIds) {
    try {
      const verse = await loadVerse(verseId);

      relatedVerseMap.set(
        verseId,
        verse
      );
    } catch (error) {
      console.error(
        `${verseId} bağlantılı ayeti yüklenemedi:`,
        error
      );

      relatedVerseMap.set(
        verseId,
        null
      );
    }
  }

  relatedElements.forEach((element) => {
    const verseId =
      element.dataset.relatedId;

    const verse =
      relatedVerseMap.get(verseId);

    const textElement =
      element.querySelector(
        '.evidence-related-verse-text'
      );

    if (!textElement) {
      return;
    }

    if (verse?.text_tr) {
      textElement.textContent =
        verse.text_tr;

      element.title =
        `${verseId}: ${verse.text_tr}`;

      return;
    }

    textElement.textContent =
      'Türkçe çeviri bulunamadı.';

    element.classList.add(
      'evidence-related-verse--missing'
    );
  });
}

function createMissingVerseCard(verseId) {
  return `
    <div class="evidence-empty">
      <strong>
        ${escapeHtml(verseId)}
      </strong>

      <p>
        Bu ayetin veri dosyası okunamadı.
      </p>
    </div>
  `;
}

function highlightText(text, query) {
  const safeText =
    escapeHtml(text);

  const normalizedQuery =
    String(query || '').trim();

  if (
    !normalizedQuery ||
    /^\d{1,3}\s*:\s*\d{1,3}$/.test(normalizedQuery)
  ) {
    return safeText;
  }

  const queryWords = normalizedQuery
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
    .sort((left, right) => {
      return right.length - left.length;
    });

  if (queryWords.length === 0) {
    return safeText;
  }

  const pattern = queryWords
    .map(escapeRegExp)
    .join('|');

  const expression = new RegExp(
    `(${pattern})`,
    'gi'
  );

  return safeText.replace(
    expression,
    '<mark class="evidence-highlight">$1</mark>'
  );
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
  return String(value ?? '')
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
}

function setStatus(message, isError = false) {
  DOM.status.textContent = message;
  DOM.status.classList.toggle(
    'error',
    isError
  );
}

function updateUrl(query) {
  const url = new URL(
    window.location.href
  );

  url.searchParams.set(
    'q',
    query
  );

  history.replaceState(
    null,
    '',
    url
  );
}
