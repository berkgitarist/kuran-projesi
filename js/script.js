/* script.js - temizlenmiş ve hızlandırılmış sürüm */

const CONFIG = {
  batchSize: 3,
  initialLoad: 5,
  mealFiles: [
    'Abdülbaki Gölpınarlı.json',
    'Diyanet İşleri.json',
    'Diyanet Vakfı.json',
    'Edip Yüksel.json',
    'Elmalılı Hamdi Yazır.json',
    'İbn-i Kesir.json',
    'Muhammed Esed.json',
    'Mustafa İslamoğlu.json',
    'Ömer Nasuhi Bilmen.json',
    'Süleyman Ateş.json',
    'Süleymaniye.json',
    "Tefhim-ul Kur'an.json-Link",
    'Yaşar Nuri Öztürk.json',
    'Yusuf Ali (İngilizce).json',
    '2baski_quran_tr.json',
    'kuran_erhan_aktas.json'
  ],
  dataPaths: {
    en: './data/qurantft.json',
    tr: './data/quran_tr.json',
    translit: './data/Turkce_Transkript.json',
    ai: './data/yapayzekaceviri.json',
    dictionary: './data/manual-dictionary.json'
  }
};

const STATE = {
  currentPage: 1,
  totalPages: 604,
  loadedPages: new Set(),
  data: {
    en: {},
    tr: {},
    translit: {},
    ai: {},
    meals: {},
    dictionary: {}
  },
  metadata: {
    sureNames: {},
    sureToPageMap: {},
    pageToSuraMap: {},
    verseToPageMap: {}
  },
  settings: {
    theme: 'dark',
    fontSize: 'medium',
    translation: 'Diyanet İşleri',
    showTransliteration: true,
    showMeals: true,
    showAiTranslation: false
  }
};

const DOM = {
  quranContent: document.getElementById('quranContent'),
  iframeContent: document.getElementById('iframeContent'),
  content: document.getElementById('quranContent'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  currentPageDisplay: document.getElementById('currentPageDisplay'),
  searchInput: document.getElementById('searchInput'),
  autocomplete: document.getElementById('autocomplete'),
  suraMenu: document.getElementById('suraMenu'),
  wordTooltip: document.getElementById('wordTooltip'),
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  body: document.body,
  introVerse: document.getElementById('introVerse')
};

const SEARCH_INDEX = {
  quran: [],
  meals: [],
  ready: false,
  mealsReady: false
};

const PAGE_CACHE = new Map();
const MAX_PAGE_CACHE = 20;

const MEALS_STATE = {
  status: 'idle',
  loadPromise: null,
  loadedCount: 0
};

let externalSiteLoaded = false;
let activeSearchQuery = '';
let pendingHighlight = null;
let tooltipDelegationReady = false;

/* =========================
   Başlangıç
========================= */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Uygulama başlatılıyor...');

  loadSettings();
  applySettings();

  const introPromise = showIntroVerse();

  let dataLoaded = false;

  const dataPromise = loadInitialData()
    .then(() => {
      processMetadata();
      buildSuraMenu();
      setupEventListeners();
      STATE.currentPage = 23;
      dataLoaded = true;
      console.log('Veri yükleme tamamlandı.');
    })
    .catch((err) => {
      console.error('Veri yükleme başarısız:', err);
      throw err;
    });

  try {
    // Önce intro kendi 5 saniyesini tamamlasın
    await introPromise;

    // Veri henüz bitmediyse loading mesajı göster
    if (!dataLoaded) {
      ensureQuranView();
      DOM.content.innerHTML =
        '<div class="loading-message" style="text-align:center;padding:40px;"><p>Kuran sayfaları yükleniyor...</p></div>';
      await dataPromise;
    } else {
      await dataPromise;
    }

    ensureQuranView();
    loadPagesAround(STATE.currentPage);

    console.log('İlk ekran hazır.');

    // Arama indexini ekran açıldıktan sonra hazırla
    setTimeout(() => {
      try {
        buildSearchIndex();
        console.log('Arama indexi hazır.');
      } catch (err) {
        console.error('Arama indexi oluşturulamadı:', err);
      }
    }, 100);

  } catch (err) {
    console.error('Başlangıç hatası:', err);
    ensureQuranView();
    DOM.content.innerHTML =
      '<div class="error-message" style="text-align:center;padding:40px;">Veri yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</div>';
  }
});

/* =========================
   Yardımcılar
========================= */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTurkishText(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('tr-TR');
}

function showNotification(message, type = 'info') {
  console.log(`[${type}] ${message}`);
  alert(message);
}

function setPageCache(pageNum, html) {
  if (PAGE_CACHE.has(pageNum)) PAGE_CACHE.delete(pageNum);
  PAGE_CACHE.set(pageNum, html);

  if (PAGE_CACHE.size > MAX_PAGE_CACHE) {
    const oldestKey = PAGE_CACHE.keys().next().value;
    PAGE_CACHE.delete(oldestKey);
  }
}

function clearPageCache() {
  PAGE_CACHE.clear();
}

/* =========================
   Intro
========================= */
function showIntroVerse() {
  return new Promise((resolve) => {
    const intro = DOM.introVerse;

    if (!intro) {
      resolve();
      return;
    }

    // Her açılışta 5 sn göster
    intro.classList.remove('hidden');
    intro.classList.remove('fade-out');
    intro.style.display = 'flex';
    intro.setAttribute('aria-hidden', 'false');

    setTimeout(() => {
      intro.classList.add('fade-out');

      setTimeout(() => {
        intro.classList.add('hidden');
        intro.style.display = 'none';
        intro.setAttribute('aria-hidden', 'true');
        resolve();
      }, 1000); // fade süresi
    }, 5000); // ekranda kalma süresi
  });
}

/* =========================
   Ayarlar
========================= */
function loadSettings() {
  const savedSettings = localStorage.getItem('quranAppSettings');
  if (savedSettings) {
    try {
      STATE.settings = { ...STATE.settings, ...JSON.parse(savedSettings) };
    } catch (error) {
      console.warn('Ayarlar yüklenemedi:', error);
    }
  }
}

function saveSettings() {
  try {
    localStorage.setItem('quranAppSettings', JSON.stringify(STATE.settings));
    applySettings();
    clearPageCache();

    if (STATE.data.en[STATE.currentPage] && STATE.data.tr[STATE.currentPage]) {
      displayPage(STATE.currentPage);
    }
  } catch (error) {
    console.error('Ayarlar kaydedilirken hata:', error);
  }
}

function applySettings() {
  DOM.body.className = `${STATE.settings.theme}-theme`;

  const sizes = {
    small: '14px',
    medium: '16px',
    large: '20px'
  };

  const fontSize = sizes[STATE.settings.fontSize] || '16px';
  document.documentElement.style.setProperty('--base-font-size', fontSize);
  document.documentElement.style.setProperty(
    '--verse-arabic-size',
    STATE.settings.fontSize === 'small'
      ? '20px'
      : STATE.settings.fontSize === 'large'
      ? '28px'
      : '24px'
  );
  document.documentElement.style.setProperty('--verse-text-size', fontSize);
}

/* =========================
   Görünüm
========================= */
function ensureQuranView() {
  DOM.iframeContent.classList.add('hidden');
  DOM.iframeContent.style.display = 'none';

  DOM.quranContent.classList.remove('hidden');
  DOM.quranContent.style.display = 'block';

  const contentArea = document.querySelector('.content-area');
  if (contentArea) contentArea.style.padding = '';

  if (DOM.introVerse) {
    DOM.introVerse.style.display = 'none';
    DOM.introVerse.classList.add('hidden');
  }
}

function loadExternalSite() {
  DOM.quranContent.classList.add('hidden');
  DOM.iframeContent.classList.remove('hidden');
  DOM.iframeContent.style.display = 'block';

  const contentArea = document.querySelector('.content-area');
  if (contentArea) contentArea.style.padding = '0';
}

function toggleExternalSite() {
  const display = DOM.currentPageDisplay;

  if (!externalSiteLoaded) {
    loadExternalSite();
    display.textContent = "Kur'an Dönüş";
    externalSiteLoaded = true;
  } else {
    ensureQuranView();
    display.textContent = 'Kuran Oku';
    externalSiteLoaded = false;
  }
}

/* =========================
   Loading
========================= */
function showLoading(text = 'Yükleniyor...') {
  const loadingOverlay = DOM.loadingOverlay;
  if (!loadingOverlay) return;

  loadingOverlay.style.display = 'flex';
  const loadingText = document.querySelector('.loading-text');
  if (loadingText) loadingText.textContent = text;
}

function hideLoading() {
  const loadingOverlay = DOM.loadingOverlay;
  if (!loadingOverlay) return;
  loadingOverlay.style.display = 'none';
}

function updateLoadingProgress(percent) {
  const progressBar = document.querySelector('.progress-bar');
  if (progressBar) progressBar.style.width = `${percent}%`;

  const loadingText = document.querySelector('.loading-text');
  if (loadingText) loadingText.textContent = `Yükleniyor... %${Math.round(percent)}`;
}

/* =========================
   Eventler
========================= */
function setupEventListeners() {
  document.getElementById('prevPage')?.addEventListener('click', () => {
    if (STATE.currentPage > 1) goToPage(STATE.currentPage - 1);
  });

  document.getElementById('nextPage')?.addEventListener('click', () => {
    if (STATE.currentPage < STATE.totalPages) goToPage(STATE.currentPage + 1);
  });

  document.getElementById('menuToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('closeMenu')?.addEventListener('click', closeSidebar);
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);

  document.getElementById('settingsPage')?.addEventListener('click', () => {
    displaySettingsPage();
    closeSidebar();
  });

  document.getElementById('notesPage')?.addEventListener('click', () => {
    displayNotesPage();
    closeSidebar();
  });

  document.getElementById('guidePage')?.addEventListener('click', () => {
    displayGuidePage();
    closeSidebar();
  });

  document.getElementById('currentPageDisplay')?.addEventListener('click', toggleExternalSite);

  setupSearch();
  setupWordTooltipDelegation();
}

/* =========================
   Sidebar
========================= */
function toggleSidebar() {
  const isOpen = !DOM.sidebar.classList.contains('hidden');
  if (isOpen) closeSidebar();
  else openSidebar();
}

function openSidebar() {
  DOM.sidebar.classList.remove('hidden');
  DOM.sidebarOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  DOM.sidebar.classList.add('hidden');
  DOM.sidebarOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

/* =========================
   Veri yükleme
========================= */
async function loadInitialData() {
  showLoading('Veri dosyaları yükleniyor...');
  try {
    await Promise.all([
      loadDataFile(CONFIG.dataPaths.en, 'en'),
      loadDataFile(CONFIG.dataPaths.tr, 'tr'),
      loadDataFile(CONFIG.dataPaths.translit, 'translit'),
      loadDataFile(CONFIG.dataPaths.dictionary, 'dictionary'),
      loadDataFile(CONFIG.dataPaths.ai, 'ai')
    ]);
  } catch (error) {
    console.error('Veri yükleme hatası:', error);
    throw error;
  } finally {
    hideLoading();
  }
}

async function loadDataFile(path, key) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${key} dosyası yüklenemedi: ${response.status}`);
  STATE.data[key] = await response.json();
  console.log(`${key} verisi yüklendi.`);
}

function processMetadata() {
  STATE.metadata.sureNames = {};
  STATE.metadata.sureToPageMap = {};
  STATE.metadata.pageToSuraMap = {};
  STATE.metadata.verseToPageMap = {};

  for (const page in STATE.data.tr) {
    const pageObj = STATE.data.tr[page];
    if (!pageObj?.sura) continue;

    STATE.metadata.pageToSuraMap[page] = Object.keys(pageObj.sura);

    for (const suraNum in pageObj.sura) {
      const sura = pageObj.sura[suraNum];

      if (!STATE.metadata.sureNames[suraNum]) {
        const titles = sura.titles;
        if (titles && titles['1']) {
          const lines = titles['1'].split('\n').map((l) => l.trim()).filter(Boolean);
          const sureLine = lines.find((l) => l.startsWith('Sure '));
          const parantezLine = lines.find((l) => l.startsWith('('));

          if (sureLine) {
            let cleanedTitle = sureLine.replace(/^Sure\s*/, '').trim();
            if (parantezLine) cleanedTitle += ' ' + parantezLine;
            STATE.metadata.sureNames[suraNum] = cleanedTitle;
            STATE.metadata.sureToPageMap[suraNum] = parseInt(page);
          }
        }
      }

      const verses = sura.verses || {};
      for (const verseNum in verses) {
        STATE.metadata.verseToPageMap[`${suraNum}:${verseNum}`] = parseInt(page);
      }
    }
  }
}

function getVersePage(suraNum, verseNum) {
  return (
    STATE.metadata.verseToPageMap[`${suraNum}:${verseNum}`] ||
    STATE.metadata.sureToPageMap[suraNum] ||
    1
  );
}

/* =========================
   Arama index
========================= */
function buildSearchIndex() {
  SEARCH_INDEX.quran = [];
  SEARCH_INDEX.ready = false;

  ['tr', 'en', 'translit', 'ai'].forEach((source) => {
    const data = STATE.data[source];
    if (!data) return;

    for (const page in data) {
      const pageObj = data[page];
      if (!pageObj?.sura) continue;

      for (const suraNum in pageObj.sura) {
        const verses = pageObj.sura[suraNum].verses || {};
        for (const verseNum in verses) {
          const text = String(verses[verseNum] || '');
          SEARCH_INDEX.quran.push({
            type: 'quran',
            source,
            page: parseInt(page),
            suraNum,
            verseNum,
            text,
            normalized: normalizeTurkishText(text)
          });
        }
      }
    }
  });

  SEARCH_INDEX.ready = true;
  console.log('Quran search index hazır:', SEARCH_INDEX.quran.length);
}

function buildMealsSearchIndex() {
  SEARCH_INDEX.meals = [];

  for (const mealName in STATE.data.meals) {
    if (!STATE.data.meals.hasOwnProperty(mealName)) continue;
    const meal = STATE.data.meals[mealName];

    const pushMealVerse = (suraNum, verseNum, text) => {
      if (!text) return;
      SEARCH_INDEX.meals.push({
        type: 'meal',
        mealName,
        suraNum: String(suraNum),
        verseNum: String(verseNum),
        page: getVersePage(String(suraNum), String(verseNum)),
        text: String(text),
        normalized: normalizeTurkishText(String(text))
      });
    };

    if (meal?.sures && Array.isArray(meal.sures)) {
      meal.sures.forEach((sure, index) => {
        if (!sure?.ayetler) return;
        sure.ayetler.forEach(([anum, ayet]) => pushMealVerse(index + 1, anum, ayet));
      });
    }

    if (Array.isArray(meal)) {
      meal.forEach((sure, index) => {
        if (!sure?.ayetler) return;
        sure.ayetler.forEach(([anum, ayet]) => pushMealVerse(index + 1, anum, ayet));
      });
    }

    if (meal && typeof meal === 'object' && !Array.isArray(meal)) {
      for (const pageKey in meal) {
        if (!meal.hasOwnProperty(pageKey)) continue;
        const pageObj = meal[pageKey];
        const suraData = pageObj?.sura;
        if (!suraData) continue;

        for (const suraNum in suraData) {
          const verses = suraData[suraNum]?.verses || {};
          for (const verseNum in verses) {
            pushMealVerse(suraNum, verseNum, verses[verseNum]);
          }
        }
      }
    }

    if (meal?.surahs && Array.isArray(meal.surahs)) {
      meal.surahs.forEach((surah) => {
        if (!surah?.verses) return;
        surah.verses.forEach((verseObj) => {
          const verseNum = verseObj.verse_number || verseObj.verseNumber || verseObj.id;
          const text = verseObj.translation || verseObj.verse || verseObj.text || '';
          pushMealVerse(surah.id, verseNum, text);
        });
      });
    }
  }

  SEARCH_INDEX.mealsReady = true;
  console.log('Meal search index hazır:', SEARCH_INDEX.meals.length);
}

/* =========================
   Meal yükleme
========================= */
async function loadMeals() {
  if (MEALS_STATE.status === 'ready') return Promise.resolve();
  if (MEALS_STATE.status === 'loading') return MEALS_STATE.loadPromise;

  MEALS_STATE.status = 'loading';
  MEALS_STATE.loadedCount = 0;

  MEALS_STATE.loadPromise = (async () => {
    showLoading('Mealler yükleniyor...');
    try {
      for (let i = 0; i < CONFIG.mealFiles.length; i += CONFIG.batchSize) {
        const batch = CONFIG.mealFiles.slice(i, i + CONFIG.batchSize);

        await Promise.all(
          batch.map(async (file) => {
            try {
              const filePath = `./data/mealler/${file}`;
              const response = await fetch(filePath);
              if (!response.ok) {
                console.warn(`${file} bulunamadı:`, response.status);
                return;
              }

              const json = await response.json();
              const mealName =
                file === '2baski_quran_tr.json'
                  ? 'İD-Soner Tahsinoğlu 2.Baskı'
                  : file.replace('.json', '');

              STATE.data.meals[mealName] = json;
              MEALS_STATE.loadedCount++;
              console.log('Meal yüklendi:', mealName);
            } catch (err) {
              console.warn(`${file} yüklenirken hata:`, err);
            }
          })
        );

        const progress = Math.min(
          100,
          ((i + CONFIG.batchSize) / CONFIG.mealFiles.length) * 100
        );
        updateLoadingProgress(progress);
      }

      MEALS_STATE.status = 'ready';
      buildMealsSearchIndex();
      console.log(`Mealler hazır (${MEALS_STATE.loadedCount}/${CONFIG.mealFiles.length})`);
    } catch (error) {
      MEALS_STATE.status = 'error';
      console.error('Meal yükleme hatası:', error);
    } finally {
      hideLoading();
    }
  })();

  return MEALS_STATE.loadPromise;
}

function areMealsReady() {
  return MEALS_STATE.status === 'ready';
}

/* =========================
   Menü / Sure listesi
========================= */
function buildSuraMenu() {
  let html = '';
  const sortedSuraNums = Object.keys(STATE.metadata.sureNames).sort((a, b) => Number(a) - Number(b));

  sortedSuraNums.forEach((suraNum) => {
    html += `<li onclick="goToSura(${suraNum})">${escapeHtml(
      STATE.metadata.sureNames[suraNum]
    )}</li>`;
  });

  DOM.suraMenu.innerHTML = html;
}

/* =========================
   Sayfa geçişi
========================= */
function loadPagesAround(pageNum) {
  const startPage = Math.max(1, pageNum - CONFIG.initialLoad);
  const endPage = Math.min(STATE.totalPages, pageNum + CONFIG.initialLoad);

  for (let i = startPage; i <= endPage; i++) {
    if (!STATE.loadedPages.has(i)) STATE.loadedPages.add(i);
  }

  displayPage(pageNum);
}

function goToPage(pageNum) {
  ensureQuranView();

  if (pageNum < 1 || pageNum > STATE.totalPages) return;

  STATE.currentPage = pageNum;

  if (STATE.loadedPages.has(pageNum)) {
    displayPage(pageNum);
  } else {
    loadPagesAround(pageNum);
  }

  if (!pendingHighlight) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function goToSura(suraNum) {
  ensureQuranView();

  const page = STATE.metadata.sureToPageMap[suraNum];
  if (!page) return;

  pendingHighlight = {
    suraNum,
    verseNum: 1,
    query: activeSearchQuery || '',
    openMeal: false,
    mealName: ''
  };

  goToPage(page);
  closeSidebar();
}

function goToVerse(suraNum, verseNum) {
  ensureQuranView();

  pendingHighlight = {
    suraNum,
    verseNum,
    query: activeSearchQuery || '',
    openMeal: false,
    mealName: ''
  };

  goToPage(getVersePage(suraNum, verseNum));
}

/* =========================
   Scroll / highlight
========================= */
async function _applyHighlightAndScroll(suraNum, verseNum, query, openMeal, mealName) {
  let targetElement = null;

  document.querySelectorAll('.verse-number').forEach((el) => {
    if (el.textContent.trim() === `${suraNum}:${verseNum}`) {
      targetElement = el.closest('.verse');
    }
  });

  if (!targetElement) {
    console.warn(`Ayet bulunamadı: ${suraNum}:${verseNum}`);
    return;
  }

  const headerEl = document.querySelector('.header-bar');
  const headerHeight = headerEl ? headerEl.offsetHeight : 0;
  const top = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight - 8;

  window.scrollTo({ top, behavior: 'smooth' });

  targetElement.classList.add('verse-search-highlight');
  setTimeout(() => targetElement.classList.remove('verse-search-highlight'), 5000);

  if (query) {
    applyTemporaryHighlightToVerse(targetElement, query, 5000);
  }

  if (openMeal) {
    setTimeout(async () => {
      await ensureMealOpen(suraNum, verseNum, query, mealName);
    }, 700);
  }
}

function scrollToVerse(suraNum, verseNum, searchQuery) {
  _applyHighlightAndScroll(
    suraNum,
    verseNum,
    searchQuery || activeSearchQuery || '',
    false,
    ''
  );
}

function applyTemporaryHighlightToVerse(verseElement, query, duration = 5000) {
  if (!verseElement || !query) return;

  const cleanQuery = query.trim();
  if (!cleanQuery) return;

  const regex = new RegExp(escapeRegExp(cleanQuery), 'gi');
  const targets = ['.verse-arabic', '.verse-text', '.verse-text-tr'];
  const originalHtml = [];

  targets.forEach((selector, i) => {
    const el = verseElement.querySelector(selector);
    if (!el) return;

    originalHtml[i] = el.innerHTML;

    if (regex.test(el.textContent)) {
      el.innerHTML = el.textContent.replace(
        regex,
        '<span class="search-result-highlight">$&</span>'
      );
    }
  });

  setTimeout(() => {
    targets.forEach((selector, i) => {
      const el = verseElement.querySelector(selector);
      if (el && originalHtml[i] !== undefined) {
        el.innerHTML = originalHtml[i];
      }
    });
  }, duration);
}

/* =========================
   Not map
========================= */
function mapNotesToVerses(notesData) {
  const noteMap = {};
  if (!notesData) return noteMap;

  notesData.forEach((note) => {
    const match = note.match(/^\*+\s*(\d+:\d+(-\d+)?)/);
    if (!match) return;

    const range = match[1];
    if (range.includes('-')) {
      const [start, end] = range.split('-');
      const [suraStart, verseStart] = start.split(':').map(Number);
      const [, verseEnd] = end.includes(':')
        ? end.split(':').map(Number)
        : [suraStart, Number(end)];

      for (let i = verseStart; i <= verseEnd; i++) {
        const key = `${suraStart}:${i}`;
        if (!noteMap[key]) noteMap[key] = [];
        noteMap[key].push(note);
      }
    } else {
      if (!noteMap[range]) noteMap[range] = [];
      noteMap[range].push(note);
    }
  });

  return noteMap;
}

/* =========================
   HTML üretimi
========================= */
function buildPageHtml(pageNum) {
  const enPage = STATE.data.en[pageNum];
  const trPage = STATE.data.tr[pageNum];

  let pageTitle = 'Bilinmeyen';
  const suraNums = Object.keys(enPage.sura).sort((a, b) => Number(a) - Number(b));

  if (suraNums.length > 0) {
    const suraTitles = suraNums.map(
      (num) => STATE.metadata.sureNames[num] || `Sure ${num}`
    );
    pageTitle = suraTitles.join(' | ');
  }

  let html = `
    <div class="page-header">
      <h1>📖 ${escapeHtml(pageTitle)}</h1>
    </div>`;

  const enNotesMap = mapNotesToVerses(enPage.notes?.data);
  const trNotesMap = mapNotesToVerses(trPage.notes?.data);

  for (const suraNum of suraNums) {
    const enSura = enPage.sura[suraNum];
    const trSura = trPage.sura[suraNum];

    html += `<div class="sura">`;

    const verseKeys = Object.keys(enSura.verses).sort((a, b) => Number(a) - Number(b));

    for (const verseNum of verseKeys) {
      if (enSura.titles && enSura.titles[verseNum]) {
        html += `<div class="passage-title">${escapeHtml(enSura.titles[verseNum])}</div>`;
        if (trSura.titles && trSura.titles[verseNum]) {
          html += `<div class="passage-title-tr">${escapeHtml(
            trSura.titles[verseNum]
          )}</div>`;
        }
      }

      const verseKey = `${suraNum}:${verseNum}`;
      const hasNotes =
        (enNotesMap[verseKey]?.length > 0) || (trNotesMap[verseKey]?.length > 0);

      html += `
        <div class="verse">
          <div class="verse-number">${suraNum}:${verseNum}</div>
          <div class="verse-arabic">${enSura.encrypted?.[verseNum] || ''}</div>`;

      if (STATE.settings.showTransliteration) {
        html += `<div class="verse-transliteration">${
          STATE.data.translit[suraNum]?.verses?.[verseNum] || ''
        }</div>`;
      }

      html += `
          <div class="verse-text">${escapeHtml(enSura.verses[verseNum])}</div>
          <div class="verse-text-tr"><strong>${escapeHtml(
            trSura.verses[verseNum]
          )}</strong></div>
          <div class="buttons">`;

      if (hasNotes) {
        html += `<button class="toggle-btn dipnot-btn" onclick="toggleNote('note-${suraNum}-${verseNum}')">📌 Dipnot</button>`;
      }

      if (STATE.settings.showMeals) {
        html += `<button class="toggle-btn" id="meal-btn-${suraNum}-${verseNum}" onclick="toggleMeal('meal-${suraNum}-${verseNum}', ${suraNum}, ${verseNum})">📚 Mealler</button>`;
      }

      html += `<button class="toggle-btn note-btn" onclick="toggleNoteInput('note-input-box-${suraNum}-${verseNum}', ${suraNum}, ${verseNum})">✍️ Not Al</button>`;
      html += `</div>`;

      if (STATE.settings.showAiTranslation) {
        html += `<div id="ai-translation-${suraNum}-${verseNum}" class="ai-translation">`;
        if (STATE.data.ai[suraNum]?.verses?.[verseNum]) {
          html += `<strong>AI ÇEVİRİ:</strong> ${escapeHtml(
            STATE.data.ai[suraNum].verses[verseNum]
          )}`;
        } else {
          html += `<strong>AI ÇEVİRİ:</strong> Çeviri bulunamadı.`;
        }
        html += `</div>`;
      }

      if (hasNotes) {
        html += `<div id="note-${suraNum}-${verseNum}" class="note-box hidden">`;

        if (enNotesMap[verseKey]) {
          enNotesMap[verseKey].forEach((note) => {
            html += `<div class="note-en"><strong>EN:</strong> ${escapeHtml(note)}</div>`;
          });
        }

        if (trNotesMap[verseKey]) {
          trNotesMap[verseKey].forEach((note) => {
            html += `<div class="note-tr"><strong>TR:</strong> ${escapeHtml(note)}</div>`;
          });
        }

        html += `</div>`;
      }

      html += `
        <div id="user-note-${suraNum}-${verseNum}" class="note-box hidden"></div>
        <div id="meal-${suraNum}-${verseNum}" class="note-box hidden"></div>
        <div id="note-input-box-${suraNum}-${verseNum}" class="note-input-box hidden">
          <textarea id="note-input-${suraNum}-${verseNum}" placeholder="Notunuzu buraya yazın..." rows="4"></textarea>
          <div class="note-actions">
            <button class="save-note-btn" onclick="saveNote(${suraNum}, ${verseNum})">💾 Kaydet</button>
            <button class="cancel-note-btn" onclick="cancelNote(${suraNum}, ${verseNum})">❌ İptal</button>
          </div>
        </div>
      </div>`;
    }

    html += `</div>`;
  }

  html += `<div class="page-footer">`;
  if (STATE.currentPage > 1) {
    html += `<button class="header-btn" onclick="goToPage(${STATE.currentPage - 1})">⟵ Önceki Sayfa</button>`;
  }
  html += `<span class="page-info">Sayfa ${STATE.currentPage} / ${STATE.totalPages}</span>`;
  if (STATE.currentPage < STATE.totalPages) {
    html += `<button class="header-btn" onclick="goToPage(${STATE.currentPage + 1})">Sonraki Sayfa ⟶</button>`;
  }
  html += `</div>`;

  return html;
}

function afterPageRender() {
  document.querySelectorAll('.verse-arabic').forEach((el) => {
    el.style.textAlign = 'right';
    el.style.direction = 'rtl';
  });

  decorateVerseWords();
  loadNotesForCurrentPage();
  applySettings();

  if (pendingHighlight) {
    const ph = pendingHighlight;
    pendingHighlight = null;
    requestAnimationFrame(() => {
      _applyHighlightAndScroll(ph.suraNum, ph.verseNum, ph.query, ph.openMeal, ph.mealName);
    });
  }
}

function displayPage(pageNum) {
  if (!STATE.data.en[pageNum] || !STATE.data.tr[pageNum]) {
    DOM.content.innerHTML = '<p>Sayfa yükleniyor...</p>';
    return;
  }

  if (PAGE_CACHE.has(pageNum)) {
    DOM.content.innerHTML = PAGE_CACHE.get(pageNum);
    afterPageRender();
    return;
  }

  const html = buildPageHtml(pageNum);
  DOM.content.innerHTML = html;
  setPageCache(pageNum, html);
  afterPageRender();
}

/* =========================
   Tooltip - delegation
========================= */
function decorateVerseWords() {
  document.querySelectorAll('.verse-text').forEach((el) => {
    if (el.dataset.decorated === 'true') return;

    const text = el.textContent;
    const words = text.split(/\s+/);

    const html = words
      .map((word) => {
        const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
        if (!cleanWord) return escapeHtml(word);

        return `<span class="word-token" data-word="${escapeHtml(
          cleanWord
        )}" data-original="${escapeHtml(word.toLowerCase())}" style="cursor:help;">${escapeHtml(
          word
        )}</span>`;
      })
      .join(' ');

    el.innerHTML = html;
    el.dataset.decorated = 'true';
  });
}

function setupWordTooltipDelegation() {
  if (tooltipDelegationReady) return;
  tooltipDelegationReady = true;

  const tooltip = DOM.wordTooltip;
  if (!tooltip) return;

  let pinnedToken = null;

  function getTranslationHtml(token) {
    const originalWord = token.dataset.original;
    const cleanWord = token.dataset.word;

    let translationValue = null;
    if (STATE.data.dictionary[originalWord]) {
      translationValue = STATE.data.dictionary[originalWord];
    } else if (STATE.data.dictionary[cleanWord]) {
      translationValue = STATE.data.dictionary[cleanWord];
    }

    if (translationValue) {
      const translations = String(translationValue)
        .split(', ')
        .map((trans, idx) => {
          const colors = ['#e74c3c', '#27ae60', '#3498db'];
          const color = colors[idx % 3];
          return `<strong style="color:${color}">${escapeHtml(trans)}</strong>`;
        })
        .join(', ');

      return `"${escapeHtml(token.textContent)}" ➔ ${translations}`;
    }

    return `"${escapeHtml(token.textContent)}" ➔ <span style="color:#e74c3c;">Kelime bulunamadı</span>`;
  }

  function showTooltipAt(x, y, html) {
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y + 10}px`;
  }

  function showTooltipNearElement(element, html) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + window.pageXOffset;
    const y = rect.bottom + window.pageYOffset;
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y + 8}px`;
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
    pinnedToken = null;
  }

  function isTouchDevice() {
    return window.matchMedia('(hover: none)').matches || 'ontouchstart' in window;
  }

  // Desktop hover
  DOM.content.addEventListener('mouseover', (e) => {
    if (isTouchDevice()) return;
    if (pinnedToken) return;

    const token = e.target.closest('.word-token');
    if (!token) return;

    showTooltipAt(e.pageX, e.pageY, getTranslationHtml(token));
  });

  DOM.content.addEventListener('mousemove', (e) => {
    if (isTouchDevice()) return;
    if (tooltip.style.display === 'block' && !pinnedToken) {
      tooltip.style.left = `${e.pageX + 10}px`;
      tooltip.style.top = `${e.pageY + 10}px`;
    }
  });

  DOM.content.addEventListener('mouseout', (e) => {
    if (isTouchDevice()) return;
    if (pinnedToken) return;

    if (e.target.closest('.word-token')) {
      tooltip.style.display = 'none';
    }
  });

  // Mobile tap
  DOM.content.addEventListener('click', (e) => {
    const token = e.target.closest('.word-token');

    if (!token) return;

    if (isTouchDevice()) {
      e.preventDefault();
      e.stopPropagation();

      if (pinnedToken === token) {
        hideTooltip();
        return;
      }

      pinnedToken = token;
      showTooltipNearElement(token, getTranslationHtml(token));
    }
  });

  // Tooltip dışına tıklayınca kapat
  document.addEventListener('click', (e) => {
    if (!pinnedToken) return;

    const clickedToken = e.target.closest('.word-token');
    const clickedTooltip = e.target.closest('#wordTooltip');

    if (!clickedToken && !clickedTooltip) {
      hideTooltip();
    }
  });

  // Scroll olunca mobil popup kapansın
  window.addEventListener('scroll', () => {
    if (pinnedToken) {
      hideTooltip();
    }
  });
}

/* =========================
   Notlar
========================= */
function isDriveReady() {
  return (
    typeof gapi !== 'undefined' &&
    typeof folderId !== 'undefined' &&
    !!folderId &&
    typeof loadNoteFromDrive === 'function' &&
    typeof saveNoteToDrive === 'function'
  );
}

async function loadNotesForCurrentPage() {
  if (!isDriveReady()) return;

  const verseElements = document.querySelectorAll('.verse-number');
  const tasks = [];

  for (const element of verseElements) {
    const verseText = element.textContent.trim();
    const match = verseText.match(/^(\d+):(\d+)$/);
    if (!match) continue;

    const [, sura, verse] = match;

    tasks.push(
      loadNoteFromDrive(sura, verse)
        .then((content) => {
          if (content) displayLoadedNote(sura, verse, content);
        })
        .catch((err) => console.warn('Not okunamadı:', sura, verse, err))
    );
  }

  await Promise.allSettled(tasks);
}

function displayLoadedNote(sura, verse, content) {
  const box = document.getElementById(`user-note-${sura}-${verse}`);
  if (!box) return;

  const safe = escapeHtml(content || '');
  box.innerHTML = `<div class="note-tr"><strong>📝 Notunuz:</strong><br>${safe.replace(
    /\n/g,
    '<br>'
  )}</div>`;
  box.classList.remove('hidden');
}

async function saveNote(sura, verse) {
  const textarea = document.getElementById(`note-input-${sura}-${verse}`);
  const noteContent = textarea?.value.trim();

  if (!noteContent) {
    showNotification('⚠️ Not içeriği boş olamaz.', 'warning');
    return;
  }

  if (!isDriveReady()) {
    showNotification('Google Drive bağlantısı hazır değil.', 'warning');
    return;
  }

  const success = await saveNoteToDrive(sura, verse, noteContent);

  if (success) {
    textarea.value = '';
    const inputBox = document.getElementById(`note-input-box-${sura}-${verse}`);
    if (inputBox) inputBox.classList.add('hidden');
    displayLoadedNote(sura, verse, noteContent);
    showNotification('✅ Not kaydedildi.', 'success');
  }
}

function cancelNote(sura, verse) {
  const textarea = document.getElementById(`note-input-${sura}-${verse}`);
  const inputBox = document.getElementById(`note-input-box-${sura}-${verse}`);
  if (textarea) textarea.value = '';
  if (inputBox) inputBox.classList.add('hidden');
}

async function toggleNoteInput(id, sura, verse) {
  const element = document.getElementById(id);
  if (!element) return;

  element.classList.toggle('hidden');

  if (!element.classList.contains('hidden') && isDriveReady()) {
    const textarea = document.getElementById(`note-input-${sura}-${verse}`);
    if (textarea) {
      try {
        const existingNote = await loadNoteFromDrive(sura, verse);
        if (existingNote) textarea.value = existingNote;
      } catch (e) {
        console.warn('Mevcut not okunamadı:', e);
      }

      setTimeout(() => textarea.focus(), 100);
    }
  }
}

async function loadAndDisplayAllNotes() {
  const notesList = document.getElementById('notesList');
  if (!notesList || !isDriveReady()) return;

  try {
    const listResponse = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,modifiedTime)',
      orderBy: 'modifiedTime desc',
      spaces: 'drive',
      pageSize: 1000
    });

    const files = listResponse.result.files || [];
    const re = /^(\d+)_(\d+)(?:\.txt)?$/i;
    const noteFiles = files.filter((f) => re.test(f.name));

    if (noteFiles.length === 0) {
      notesList.innerHTML = '<p>Henüz kaydedilmiş notunuz bulunmuyor.</p>';
      return;
    }

    let html = '<div class="notes-grid">';

    for (const file of noteFiles) {
      const [, sura, verse] = file.name.match(re);

      let content = '';
      try {
        if (typeof getFileTextById === 'function') {
          content = await getFileTextById(file.id, file.mimeType);
        }
      } catch (e) {
        console.warn('Not içeriği okunamadı:', e);
      }

      const suraName = STATE.metadata.sureNames[sura] || `Sure ${sura}`;
      const modifiedDate = new Date(file.modifiedTime).toLocaleDateString('tr-TR');
      const preview =
        escapeHtml((content || '').substring(0, 150)) +
        ((content || '').length > 150 ? '...' : '');

      html += `
        <div class="note-card">
          <div class="note-header">
            <h3>${escapeHtml(suraName)} ${sura}:${verse}</h3>
            <span class="note-date">${modifiedDate}</span>
          </div>
          <div class="note-content">${preview}</div>
          <div class="note-actions">
            <button onclick="goToVerse(${sura}, ${verse})" class="go-to-verse-btn">📖 Ayete Git</button>
          </div>
        </div>`;
    }

    html += '</div>';
    notesList.innerHTML = html;
  } catch (error) {
    console.error('Notlar yüklenirken hata:', error);
    notesList.innerHTML = '<p>Notlar yüklenirken bir hata oluştu.</p>';
  }
}

/* =========================
   Meal
========================= */
function highlightMealText(text, query) {
  if (!query || !text) return escapeHtml(text);
  const q = query.trim();
  if (!q) return escapeHtml(text);

  const regex = new RegExp(escapeRegExp(q), 'gi');
  return String(text).replace(regex, '<strong class="search-result-highlight">$&</strong>');
}

function getOtherTranslations(suraNum, verseNum, query = '', focusedMealName = '') {
  const suraIndex = parseInt(suraNum, 10) - 1;

  if (isNaN(suraIndex) || suraIndex < 0 || suraIndex > 113) {
    return '<div>Geçersiz sure numarası.</div>';
  }

  if (!verseNum || isNaN(parseInt(verseNum, 10))) {
    return '<div>Geçersiz ayet numarası.</div>';
  }

  let otherMealsHtml = '';
  let erhanTranslation = null;
  let erhanArabic = null;
  let erhanTranscription = null;

  for (const mealName in STATE.data.meals) {
    if (!STATE.data.meals.hasOwnProperty(mealName)) continue;
    const meal = STATE.data.meals[mealName];
    if (!meal) continue;

    let ayetText = null;

    if (meal.sures && Array.isArray(meal.sures)) {
      const sure = meal.sures[suraIndex];
      if (sure && Array.isArray(sure.ayetler)) {
        const ayet = sure.ayetler.find((a) => a && String(a[0]) === String(verseNum));
        if (ayet && ayet[1]) ayetText = ayet[1];
      }
    }

    if (!ayetText && Array.isArray(meal)) {
      const sure = meal[suraIndex];
      if (sure && Array.isArray(sure.ayetler)) {
        const ayet = sure.ayetler.find((a) => a && String(a[0]) === String(verseNum));
        if (ayet && ayet[1]) ayetText = ayet[1];
      }
    }

    if (!ayetText && meal && typeof meal === 'object' && !Array.isArray(meal)) {
      for (const pageKey in meal) {
        if (!meal.hasOwnProperty(pageKey)) continue;
        const page = meal[pageKey];
        const suraData = page?.sura?.[suraNum];
        if (suraData?.verses?.[verseNum] !== undefined) {
          ayetText = suraData.verses[verseNum];
          break;
        }
      }
    }

    if (!ayetText && meal.surahs && Array.isArray(meal.surahs)) {
      const sura = meal.surahs.find((s) => s && String(s.id) === String(suraNum));
      if (sura && Array.isArray(sura.verses)) {
        const verseObj = sura.verses.find(
          (v) => v && String(v.verse_number) === String(verseNum)
        );
        if (verseObj) {
          if (verseObj.translation) erhanTranslation = verseObj.translation;
          if (verseObj.verse) erhanArabic = verseObj.verse;
          if (verseObj.transcription) erhanTranscription = verseObj.transcription;
        }
      }
    }

    if (ayetText && mealName.toLowerCase() !== 'kuran_erhan_aktas') {
      const highlighted = highlightMealText(ayetText, query);
      const isFocused = mealName === focusedMealName ? 'meal-focused-result' : '';
      otherMealsHtml += `<div class="note-tr ${isFocused}">
        <strong>${escapeHtml(mealName)}:</strong> ${highlighted}
      </div>`;
    }
  }

  if (erhanTranslation) {
    otherMealsHtml += `<div class="note-tr"><strong>Erhan Aktaş Çeviri:</strong> ${highlightMealText(
      erhanTranslation,
      query
    )}</div>`;
  }
  if (erhanArabic) {
    otherMealsHtml += `<div class="note-tr"><strong>Erhan Aktaş Arapça:</strong> <span class="erhan-arabic-text">${highlightMealText(
      erhanArabic,
      query
    )}</span></div>`;
  }
  if (erhanTranscription) {
    otherMealsHtml += `<div class="note-tr"><strong>Erhan Aktaş Arapça Okunuş:</strong> ${highlightMealText(
      erhanTranscription,
      query
    )}</div>`;
  }

  if (!otherMealsHtml) {
    return '<div>Bu ayet için diğer mealler bulunamadı.</div>';
  }

  return otherMealsHtml;
}

function highlightMealMatch(element, query) {
  if (!element || !query) return;

  const q = query.trim();
  if (!q) return;

  const re = new RegExp(escapeRegExp(q), 'gi');

  element.querySelectorAll('.note-tr').forEach((node) => {
    node.innerHTML = node.textContent.replace(
      re,
      '<strong class="search-result-highlight">$&</strong>'
    );
  });
}

async function toggleMeal(id, suraNum, verseNum, query = '', focusedMealName = '') {
  const element = document.getElementById(id);
  if (!element) return;

  if (!areMealsReady()) {
    const btn = document.getElementById(`meal-btn-${suraNum}-${verseNum}`);
    if (btn) {
      btn.textContent = '⏳ Yükleniyor...';
      btn.disabled = true;
    }

    await loadMeals();

    if (btn) {
      btn.textContent = '📚 Mealler';
      btn.disabled = false;
    }
  }

  if (!element.innerHTML.trim() || query || focusedMealName) {
    element.innerHTML = getOtherTranslations(suraNum, verseNum, query, focusedMealName);
  }

  element.classList.toggle('hidden');

  if (!element.classList.contains('hidden') && query) {
    highlightMealMatch(element, query);
  }
}

async function ensureMealOpen(suraNum, verseNum, query = '', focusedMealName = '') {
  const id = `meal-${suraNum}-${verseNum}`;
  const element = document.getElementById(id);

  if (!element) return null;

  if (!areMealsReady()) {
    await loadMeals();
  }

  element.innerHTML = getOtherTranslations(suraNum, verseNum, query, focusedMealName);
  element.classList.remove('hidden');

  if (query) {
    highlightMealMatch(element, query);
  }

  requestAnimationFrame(() => {
    const headerEl = document.querySelector('.header-bar');
    const headerHeight = headerEl ? headerEl.offsetHeight : 0;
    const top = element.getBoundingClientRect().top + window.pageYOffset - headerHeight - 8;
    window.scrollTo({ top, behavior: 'smooth' });
  });

  return element;
}

/* =========================
   Note toggle
========================= */
function toggleNote(id) {
  const element = document.getElementById(id);
  if (element) element.classList.toggle('hidden');
}

/* =========================
   Arama
========================= */
function makeSnippet(text, query) {
  if (!text || typeof text !== 'string') return '';
  if (!query || typeof query !== 'string') {
    return text.length > 140 ? `${text.slice(0, 140)}...` : text;
  }

  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);

  if (idx === -1) {
    return text.length > 140 ? `${text.slice(0, 140)}...` : text;
  }

  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + q.length + 40);
  let snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');

  const regex = new RegExp(escapeRegExp(query), 'gi');
  snippet = snippet.replace(regex, '<strong class="search-result-highlight">$&</strong>');
  return snippet;
}

function searchPrimarySources(query, maxResults = 16) {
  const q = query.trim();
  if (!q) return [];

  if (!SEARCH_INDEX.ready) {
  autocomplete.innerHTML = '<div>⏳ Arama hazırlanıyor...</div>';
  autocomplete.style.display = 'block';
  return;
}

  const normalizedQuery = normalizeTurkishText(q);
  const results = [];
  const seenVerses = new Set();

  for (const item of SEARCH_INDEX.quran) {
    if (results.length >= maxResults) break;
    if (!item.normalized.includes(normalizedQuery)) continue;

    const key = `${item.suraNum}:${item.verseNum}`;
    if (seenVerses.has(key)) continue;
    seenVerses.add(key);

    results.push({
      type: 'quran',
      source: item.source,
      page: item.page,
      suraNum: item.suraNum,
      verseNum: item.verseNum,
      snippet: makeSnippet(item.text, q),
      query: q,
    });
  }

  return results;
}

function searchMeals(query, maxResults = 16) {
  const q = query.trim();
  if (!q || !SEARCH_INDEX.mealsReady) return [];

  const normalizedQuery = normalizeTurkishText(q);
  const results = [];

  for (const item of SEARCH_INDEX.meals) {
    if (results.length >= maxResults) break;
    if (!item.normalized.includes(normalizedQuery)) continue;

    results.push({
      type: 'meal',
      mealName: item.mealName,
      suraNum: item.suraNum,
      verseNum: item.verseNum,
      page: item.page,
      text: item.text,
      snippet: makeSnippet(item.text, q),
      query: q
    });
  }

  return results;
}

function levenshtein(a, b) {
  a = String(a || '');
  b = String(b || '');

  const matrix = Array.from({ length: b.length + 1 }, () => []);

  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function isFuzzyMatch(query, text) {
  const q = normalizeTurkishText(query).trim();
  const t = normalizeTurkishText(text).trim();

  if (!q || !t) return false;
  if (q.length < 2) return false;
  if (t.includes(q)) return true;

  const words = t.split(/\s+/).filter(Boolean);
  if (!words.length) return false;

  for (const word of words) {
    if (word.includes(q)) return true;

    const distance = levenshtein(q, word);

    if (q.length <= 4 && distance <= 1) return true;
    if (q.length <= 7 && distance <= 2) return true;
    if (q.length > 7 && distance <= 3) return true;
  }

  return false;
}
function searchKeywordInData(query, maxResults = 16) {
  const q = query.trim();
  if (!q) return [];

  let primaryResults = searchPrimarySources(q, maxResults);

  if (primaryResults.length < maxResults) {
    const fuzzyResults = [];
    const seen = new Set(
      primaryResults.map(r => `${r.type}:${r.source || r.mealName}:${r.suraNum}:${r.verseNum}`)
    );

    for (const item of SEARCH_INDEX.quran) {
      if (primaryResults.length + fuzzyResults.length >= maxResults) break;

      if (!isFuzzyMatch(q, item.text)) continue;

      const key = `${item.type}:${item.source}:${item.suraNum}:${item.verseNum}`;
      if (seen.has(key)) continue;
      seen.add(key);

      fuzzyResults.push({
        type: 'quran',
        source: item.source,
        page: item.page,
        suraNum: item.suraNum,
        verseNum: item.verseNum,
        snippet: makeSnippet(item.text, q),
        query: q,
        fuzzy: true
      });
    }

    primaryResults = [...primaryResults, ...fuzzyResults];
  }

  if (primaryResults.length >= maxResults) return primaryResults;
  if (!areMealsReady()) return primaryResults;

  const remaining = maxResults - primaryResults.length;
  const exactMealResults = searchMeals(q, remaining);

  if (exactMealResults.length >= remaining) {
    return [...primaryResults, ...exactMealResults];
  }

  const seenMeal = new Set(
    exactMealResults.map(r => `${r.mealName}:${r.suraNum}:${r.verseNum}`)
  );

  const fuzzyMealResults = [];

  for (const item of SEARCH_INDEX.meals) {
    if (fuzzyMealResults.length + exactMealResults.length >= remaining) break;

    if (!isFuzzyMatch(q, item.text)) continue;

    const key = `${item.mealName}:${item.suraNum}:${item.verseNum}`;
    if (seenMeal.has(key)) continue;
    seenMeal.add(key);

    fuzzyMealResults.push({
      type: 'meal',
      mealName: item.mealName,
      suraNum: item.suraNum,
      verseNum: item.verseNum,
      page: item.page,
      text: item.text,
      snippet: makeSnippet(item.text, q),
      query: q,
      fuzzy: true
    });
  }

  return [...primaryResults, ...exactMealResults, ...fuzzyMealResults];
}

function navigateToSearchResult(result, inputElement) {
  ensureQuranView();
  DOM.autocomplete.innerHTML = '';
  DOM.autocomplete.style.display = 'none';
  inputElement.value = '';

  if (!result) return;

  activeSearchQuery = result.query || '';

  if (result.type === 'quran' || result.type === 'verse') {
    pendingHighlight = {
      suraNum: result.suraNum,
      verseNum: result.verseNum,
      query: result.query || '',
      openMeal: false,
      mealName: ''
    };
    goToPage(result.page || getVersePage(result.suraNum, result.verseNum));
    return;
  }

  if (result.type === 'meal') {
    pendingHighlight = {
      suraNum: result.suraNum,
      verseNum: result.verseNum,
      query: result.query || '',
      openMeal: true,
      mealName: result.mealName || ''
    };
    goToPage(result.page || getVersePage(result.suraNum, result.verseNum));
    return;
  }

  if (result.type === 'sura') {
    goToPage(STATE.metadata.sureToPageMap[result.suraNum]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function setupSearch() {
  const searchInput = DOM.searchInput;
  const autocomplete = DOM.autocomplete;

  let debounceTimer = null;
  const DEBOUNCE_MS = 250;
  const runSearch = async (val) => {
  autocomplete.innerHTML = '';

  if (val.length < 1) {
    autocomplete.style.display = 'none';
    return;
  }

  if (!SEARCH_INDEX.ready) {
    autocomplete.innerHTML = '<div>⏳ Arama hazırlanıyor...</div>';
    autocomplete.style.display = 'block';
    return;
  }


    let found = false;
    const suggestions = [];
    const fragment = document.createDocumentFragment();

    for (const suraNum in STATE.metadata.sureNames) {
      const suraName = STATE.metadata.sureNames[suraNum].toLowerCase();
      if (suraName.includes(val)) {
        found = true;
        suggestions.push({
          suraNum,
          suraName: STATE.metadata.sureNames[suraNum],
          type: 'sura',
          priority: suraName.startsWith(val) ? 1 : 2
        });
      }
    }

    const verseMatch = val.match(/^(\d+)(?:[:\/\s])(\d+)$/);
    if (verseMatch) {
      const [, suraNum, verseNum] = verseMatch;
      const page = getVersePage(suraNum, verseNum);

      if (
        STATE.data.en[page]?.sura?.[suraNum]?.verses?.[verseNum]
      ) {
        found = true;
        const trVerseText = STATE.data.tr[page]?.sura?.[suraNum]?.verses?.[verseNum] || '';
        suggestions.push({
          suraNum,
          verseNum,
          page,
          text: `${suraNum}:${verseNum} - ${trVerseText.substring(0, 100)}...`,
          type: 'verse',
          priority: 0
        });
      }
    }

    if (suggestions.length < 16) {
      const keywordResults = searchKeywordInData(val, 16 - suggestions.length);

      if (keywordResults.length > 0) {
        found = true;
        keywordResults.forEach((result) => {
          const div = document.createElement('div');

          if (result.type === 'quran') {
              div.innerHTML = `<strong>${escapeHtml(result.suraNum)}:${escapeHtml(
                    result.verseNum
                    )}</strong> (${escapeHtml(result.source)}) ${result.fuzzy ? '<em style="color:#f59e0b;">yaklaşık eşleşme</em> ' : ''}- ${result.snippet}`;
                  } else if (result.type === 'meal') {
                      div.innerHTML = `<strong>${escapeHtml(result.mealName)}</strong> ${escapeHtml(
                            result.suraNum
                            )}:${escapeHtml(result.verseNum)} ${result.fuzzy ? '<em style="color:#f59e0b;">yaklaşık eşleşme</em> ' : ''}- ${result.snippet}`;
                          }

          div.onclick = () => navigateToSearchResult(result, searchInput);
          fragment.appendChild(div);
        });
      }

      if (!areMealsReady() && MEALS_STATE.status !== 'loading') {
        found = true;
        const infoDiv = document.createElement('div');
        infoDiv.className = 'meal-loading-hint';
        infoDiv.innerHTML = `⏳ <em>Mealler yükleniyor, meal sonuçları birazdan görünecek...</em>`;
        fragment.appendChild(infoDiv);

        loadMeals().then(() => {
          const currentVal = searchInput.value.toLowerCase().trim();
          if (currentVal === val) runSearch(val);
        });
      }
    }

    if (suggestions.length > 0) {
      suggestions.sort((a, b) => a.priority - b.priority);

      suggestions.slice(0, 8).forEach((suggestion) => {
        const div = document.createElement('div');

        if (suggestion.type === 'verse') {
          div.innerHTML = `<strong>${escapeHtml(suggestion.suraNum)}:${escapeHtml(
            suggestion.verseNum
          )}</strong> - ${escapeHtml(
            suggestion.text.replace(suggestion.text.split(' - ')[0] + ' - ', '')
          )}`;
        } else {
          div.innerHTML = `<strong>${escapeHtml(suggestion.suraNum)}:</strong> ${escapeHtml(
            suggestion.suraName
          )}`;
        }

        div.onclick = () => navigateToSearchResult(suggestion, searchInput);
        fragment.appendChild(div);
      });
    }

    if (found) {
      autocomplete.appendChild(fragment);
      autocomplete.style.display = 'block';
    } else {
      autocomplete.style.display = 'none';
    }
  };

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim();

    if (val.length < 1) {
      clearTimeout(debounceTimer);
      autocomplete.innerHTML = '';
      autocomplete.style.display = 'none';
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runSearch(val), DEBOUNCE_MS);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    e.preventDefault();
    const val = e.target.value.trim();

    const verseMatch = val.match(/^(\d+)(?:[:\/\s])(\d+)$/);
    if (verseMatch) {
      const [, suraNum, verseNum] = verseMatch;
      const page = getVersePage(suraNum, verseNum);

      if (STATE.data.en[page]?.sura?.[suraNum]?.verses?.[verseNum]) {
        goToPage(page);
        searchInput.value = '';
        autocomplete.style.display = 'none';
        setTimeout(() => scrollToVerse(suraNum, verseNum), 300);
        return;
      }

      showNotification(`${suraNum}:${verseNum} ayeti bulunamadı!`, 'warning');
      return;
    }

    for (const suraNum in STATE.metadata.sureNames) {
      const suraName = STATE.metadata.sureNames[suraNum].toLowerCase();
      if (suraName.includes(val.toLowerCase())) {
        goToPage(STATE.metadata.sureToPageMap[suraNum]);
        searchInput.value = '';
        autocomplete.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    const keywordResults = searchKeywordInData(val, 1);
    if (keywordResults.length > 0) {
      navigateToSearchResult(keywordResults[0], searchInput);
      return;
    }

    if (val) {
      showNotification(
        'Aradığınız sure veya ayet bulunamadı! Format: "2:209", "2/209" veya "2 209" veya sure ismi',
        'warning'
      );
    }
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => {
      autocomplete.style.display = 'none';
    }, 200);
  });

  searchInput.addEventListener('focus', () => {
    const val = searchInput.value.toLowerCase().trim();
    if (val.length >= 1) autocomplete.style.display = 'block';
  });
}

/* =========================
   Sayfalar
========================= */
function displaySettingsPage() {
  ensureQuranView();

  const themes = [
    { name: 'light', label: 'Açık' },
    { name: 'dark', label: 'Koyu' },
    { name: 'green', label: 'Yeşil' },
    { name: 'indigo', label: 'Çivit' },
    { name: 'brown', label: 'Kahverengi' },
    { name: 'sky', label: 'Açık Mavi' },
    { name: 'blackyellow', label: 'Siyah' },
    { name: 'bluemaize', label: 'Mavi' },
    { name: 'redpeach', label: 'Kırmızı' },
    { name: 'greenolive', label: 'Zeytin' }
  ];

  const html = `
    <div class="page-header">
      <h1>⚙️ Ayarlar</h1>
    </div>
    <div class="sura">
      <div class="settings-section">
        <h2>Tema Ayarları</h2>
        <div class="theme-picker">
          ${themes
            .map(
              (theme) => `
            <label class="theme-option">
              <input type="radio" name="theme" value="${theme.name}" ${
                STATE.settings.theme === theme.name ? 'checked' : ''
              }>
              <div class="theme-preview ${theme.name}-theme">
                ${escapeHtml(theme.label)}
                ${STATE.settings.theme === theme.name ? '✓' : ''}
              </div>
            </label>
          `
            )
            .join('')}
        </div>

        <div class="setting-item">
          <label for="fontSizeSelect">Yazı Boyutu:</label>
          <select id="fontSizeSelect">
            <option value="small" ${
              STATE.settings.fontSize === 'small' ? 'selected' : ''
            }>Küçük</option>
            <option value="medium" ${
              STATE.settings.fontSize === 'medium' ? 'selected' : ''
            }>Orta</option>
            <option value="large" ${
              STATE.settings.fontSize === 'large' ? 'selected' : ''
            }>Büyük</option>
          </select>
        </div>

        <div class="setting-item">
          <label>
            <input type="checkbox" id="showMeals" ${
              STATE.settings.showMeals ? 'checked' : ''
            }>
            Mealler'i Göster
          </label>
        </div>

        <label>
          <input type="checkbox" id="showTransliteration" ${
            STATE.settings.showTransliteration ? 'checked' : ''
          }>
          Arapça-Türkçe Göster
        </label>

        <label>
          <input type="checkbox" id="showAiTranslation" ${
            STATE.settings.showAiTranslation ? 'checked' : ''
          }>
          AI Çeviriyi Göster
        </label>
      </div>

      <div class="settings-section">
        <h2>Google Drive Durumu</h2>
        <div class="drive-status">
          <p><strong>Durum:</strong> <span id="driveStatus">${
            isDriveReady() ? '🟢 Bağlı' : '🔴 Bağlı değil'
          }</span></p>
          <p><strong>Klasör:</strong> <span id="folderStatus">${
            typeof folderId !== 'undefined' && folderId ? '✅ Hazır' : '❌ Bulunamadı'
          }</span></p>
        </div>
      </div>

      <div class="settings-section">
        <h2>Yazılım Hakkında</h2>
        <div class="about-section">
          <ul>
            <li><strong>Kodlama, Tasarım:</strong> Berk KÖKSAL</li>
            <li><strong>Arama:</strong> (örn: "2:255") 2 255  2/255 yazabilirsiniz.</li>
            <li><strong>Google Drive:</strong> Notlarınız otomatik olarak "Kuran_Teyit_Not" klasörüne kaydedilir.</li>
          </ul>
        </div>
      </div>

      <button class="toggle-btn" id="saveSettingsBtn">💾 Ayarları Kaydet</button>
      <button class="toggle-btn" onclick="goToPage(${STATE.currentPage})">🔙 Kuran'a Dön</button>
    </div>
  `;

  DOM.content.innerHTML = html;

  document.querySelectorAll('.theme-option input').forEach((input) => {
    input.addEventListener('change', (e) => {
      STATE.settings.theme = e.target.value;
      applySettings();
    });
  });

  document.getElementById('fontSizeSelect')?.addEventListener('change', (e) => {
    STATE.settings.fontSize = e.target.value;
    applySettings();
  });

  document.getElementById('showMeals')?.addEventListener('change', (e) => {
    STATE.settings.showMeals = e.target.checked;
    saveSettings();
  });

  document.getElementById('showTransliteration')?.addEventListener('change', (e) => {
    STATE.settings.showTransliteration = e.target.checked;
    saveSettings();
  });

  document.getElementById('showAiTranslation')?.addEventListener('change', (e) => {
    STATE.settings.showAiTranslation = e.target.checked;
    saveSettings();
  });

  document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
    saveSettings();
    showNotification('✅ Ayarlar kaydedildi!', 'success');
  });
}

function displayNotesPage() {
  ensureQuranView();

  DOM.content.innerHTML = `
    <div class="page-header">
      <h1>📝 Notlarım</h1>
    </div>
    <div class="sura">
      <div class="notes-section">
        <p>Google Drive'daki notlarınız burada görüntülenecek...</p>
        <div id="notesList" class="notes-list">
          ${isDriveReady() ? 'Notlar yükleniyor...' : 'Google hesabınızla giriş yapın.'}
        </div>
        <button class="toggle-btn" onclick="goToPage(${STATE.currentPage})">🔙 Kuran'a Dön</button>
      </div>
    </div>`;

  if (isDriveReady()) loadAndDisplayAllNotes();
}

const GUIDE_CONTENT = `
  <h1>Kuran Teyit Yazılımı: Tanıtım ve Kullanım Kılavuzu</h1>
  <h2>Tanıtım</h2>
  <p>Bu yazılım Kur'an okuma, arama, meal karşılaştırma ve not alma için geliştirilmiş modern bir web uygulamasıdır.</p>
  <h3>Ana Özellikler</h3>
  <ul>
    <li>Kur'an okuma ve çeviriler</li>
    <li>Google Drive not entegrasyonu</li>
    <li>Kelime çevirisi</li>
    <li>Farklı mealler</li>
    <li>Arama</li>
    <li>Özelleştirilebilir arayüz</li>
  </ul>
`;

function displayGuidePage() {
  ensureQuranView();

  DOM.content.innerHTML = `
    <div class="page-header">
      <h1>📖 Kullanım Kılavuzu</h1>
    </div>
    <div class="sura">
      <div class="settings-section">
        <div class="about-section">
          ${GUIDE_CONTENT}
        </div>
        <button class="toggle-btn" onclick="goToPage(${STATE.currentPage})">🔙 Kuran'a Dön</button>
      </div>
    </div>`;
}

/* =========================
   Global export
========================= */
window.goToPage = goToPage;
window.goToSura = goToSura;
window.goToVerse = goToVerse;
window.toggleMeal = toggleMeal;
window.toggleNote = toggleNote;
window.toggleNoteInput = toggleNoteInput;
window.saveNote = saveNote;
window.cancelNote = cancelNote;
window.displayGuidePage = displayGuidePage;
