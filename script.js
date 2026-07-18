/* =========================================================
   GÜNCELLEME: İngilizce kelime yardım alanları genişletildi.
   .verse-text + .passage-title + İngilizce dipnot metinleri
========================================================= */
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
    "Tefhim-ul Kur'an.json",
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
    dictionary: './data/manual-dictionary.json',
    arabic2: './data/mealler/quran_arapca2.json',
    erhanArabic: './data/mealler/kuran_erhan_aktas.json',
    wordTranslations: './data/word-translations.json',
    mapTr: './data/map_tr.json',
    mapEn: './data/map.json',
    appendicesTr: './data/appendices_tr.json',
    appendicesEn: './data/appendices.json'
  }
};

const FIRST_QURAN_DATA_PAGE = 23;
const LAST_QURAN_DATA_PAGE = 604;
const TOTAL_QURAN_PAGES = 604;

const STATE = {
  currentPage: FIRST_QURAN_DATA_PAGE,
  totalPages: LAST_QURAN_DATA_PAGE,
  loadedPages: new Set(),

  data: {
    en: {},
    tr: {},
    translit: {},
    ai: {},
    meals: {},
    dictionary: {},
    arabic2: {},
    erhanArabic: {},
    wordTranslations: {},
    mapTr: {},
    mapEn: {},
    appendicesTr: {},
    appendicesEn: {}
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
      STATE.currentPage = FIRST_QURAN_DATA_PAGE;
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

let currentVerseAudio = null;

function getGlobalAyahNumber(suraNum, verseNum) {
  const counts = {
    1:7,2:286,3:200,4:176,5:120,6:165,7:206,8:75,9:129,10:109,11:123,12:111,13:43,14:52,15:99,16:128,
    17:111,18:110,19:98,20:135,21:112,22:78,23:118,24:64,25:77,26:227,27:93,28:88,29:69,30:60,31:34,
    32:30,33:73,34:54,35:45,36:83,37:182,38:88,39:75,40:85,41:54,42:53,43:89,44:59,45:37,46:35,47:38,
    48:29,49:18,50:45,51:60,52:49,53:62,54:55,55:78,56:96,57:29,58:22,59:24,60:13,61:14,62:11,63:11,
    64:18,65:12,66:12,67:30,68:52,69:52,70:44,71:28,72:28,73:20,74:56,75:40,76:31,77:50,78:40,79:46,
    80:42,81:29,82:19,83:36,84:25,85:22,86:17,87:19,88:26,89:30,90:20,91:15,92:21,93:11,94:8,95:8,
    96:19,97:5,98:8,99:8,100:11,101:11,102:8,103:3,104:9,105:5,106:4,107:7,108:3,109:6,110:3,111:5,
    112:4,113:5,114:6
  };

  let total = 0;
  for (let i = 1; i < Number(suraNum); i++) {
    total += counts[i];
  }

  return total + Number(verseNum);
}

function speakVerse(suraNum, verseNum) {
  stopSpeech();

  const ayahNumber = getGlobalAyahNumber(suraNum, verseNum);
  const audioUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayahNumber}.mp3`;

  currentVerseAudio = new Audio(audioUrl);
  currentVerseAudio.play().catch((err) => {
    console.error('Ses oynatılamadı:', err);
    showNotification('Ses oynatılamadı. İnternet bağlantısını veya tarayıcı iznini kontrol edin.', 'warning');
  });
}

function stopSpeech() {
  if (currentVerseAudio) {
    currentVerseAudio.pause();
    currentVerseAudio.currentTime = 0;
    currentVerseAudio = null;
  }

  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}

function speakEnglishVerse(suraNum, verseNum) {
  stopSpeech();

  const page = getVersePage(String(suraNum), String(verseNum));
  const text =
    STATE.data.en?.[page]?.sura?.[String(suraNum)]?.verses?.[String(verseNum)] || '';

  if (!text) {
    showNotification('Bu ayet için İngilizce metin bulunamadı.', 'warning');
    return;
  }

  if (!('speechSynthesis' in window)) {
    showNotification('Tarayıcınız sesli okuma özelliğini desteklemiyor.', 'warning');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;

  speechSynthesis.speak(utterance);
}

function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTurkishText(text) {
  if (!text) {
    return '';
  }

  return String(text)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
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
      }, 1000);
    }, 5000);
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

    const themeClasses = [
        "light-theme",
        "dark-theme",
        "green-theme",
        "indigo-theme",
        "brown-theme",
        "sky-theme",
        "blackyellow-theme",
        "bluemaize-theme",
        "redpeach-theme",
        "greenolive-theme"
    ];

    DOM.body.classList.remove(...themeClasses);
    DOM.body.classList.add(`${STATE.settings.theme}-theme`);

    let rootSize = 16;

    switch (STATE.settings.fontSize) {

        case "small":
            rootSize = 14;
            break;

        case "large":
            rootSize = 20;
            break;

        default:
            rootSize = 16;
    }

    document.documentElement.style.fontSize = rootSize + "px";

    document.documentElement.style.setProperty(
        "--verse-arabic-size",
        STATE.settings.fontSize === "small"
            ? "22px"
            : STATE.settings.fontSize === "large"
            ? "34px"
            : "28px"
    );
}

/* =========================
   Görünüm
========================= */
function ensureQuranView() {
  if (DOM.quranContent) {
    DOM.quranContent.classList.remove('hidden');
    DOM.quranContent.style.display = 'block';
  }

  const contentArea = document.querySelector('.content-area');

  if (contentArea) {
    contentArea.style.padding = '';
  }

  if (DOM.introVerse) {
    DOM.introVerse.classList.add('hidden');
    DOM.introVerse.classList.remove('fade-out');
    DOM.introVerse.style.display = 'none';
    DOM.introVerse.setAttribute('aria-hidden', 'true');
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
  document
    .getElementById('prevPage')
    ?.addEventListener('click', () => {
      const previousPage =
        STATE.currentPage <= FIRST_QURAN_DATA_PAGE
          ? LAST_QURAN_DATA_PAGE
          : STATE.currentPage - 1;

      goToPage(previousPage);
    });

  document
    .getElementById('nextPage')
    ?.addEventListener('click', () => {
      const nextPage =
        STATE.currentPage >= LAST_QURAN_DATA_PAGE
          ? FIRST_QURAN_DATA_PAGE
          : STATE.currentPage + 1;

      goToPage(nextPage);
    });

  document
    .getElementById('menuToggle')
    ?.addEventListener('click', toggleSidebar);

  document
    .getElementById('closeMenu')
    ?.addEventListener('click', closeSidebar);

  document
    .getElementById('sidebarOverlay')
    ?.addEventListener('click', closeSidebar);

  document
    .getElementById('settingsPage')
    ?.addEventListener('click', () => {
      displaySettingsPage();
      closeSidebar();
    });

  document
    .getElementById('notesPage')
    ?.addEventListener('click', () => {
      displayNotesPage();
      closeSidebar();
    });

  document
    .getElementById('guidePage')
    ?.addEventListener('click', () => {
      displayGuidePage();
      closeSidebar();
    });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (document.getElementById('analysisPanel')) {
      closeAnalysisPanel();
    }

    if (document.getElementById('searchResultsPanel')) {
      closeSearchResultsPanel();
    }
  });

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
  if (!DOM.sidebar || !DOM.sidebarOverlay) {
    return;
  }

  DOM.sidebar.classList.remove('hidden');
  DOM.sidebarOverlay.classList.remove('hidden');

  DOM.sidebar.setAttribute(
    'aria-hidden',
    'false'
  );

  DOM.sidebarOverlay.setAttribute(
    'aria-hidden',
    'false'
  );

  document
    .getElementById('menuToggle')
    ?.setAttribute(
      'aria-expanded',
      'true'
    );

  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  if (!DOM.sidebar || !DOM.sidebarOverlay) {
    return;
  }

  DOM.sidebar.classList.add('hidden');
  DOM.sidebarOverlay.classList.add('hidden');

  DOM.sidebar.setAttribute(
    'aria-hidden',
    'true'
  );

  DOM.sidebarOverlay.setAttribute(
    'aria-hidden',
    'true'
  );

  document
    .getElementById('menuToggle')
    ?.setAttribute(
      'aria-expanded',
      'false'
    );

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
      loadDataFile(CONFIG.dataPaths.ai, 'ai'),
      loadDataFile(CONFIG.dataPaths.arabic2, 'arabic2'),
      loadDataFile(CONFIG.dataPaths.erhanArabic, 'erhanArabic')
    ]);

    await Promise.allSettled([
      loadDataFile(CONFIG.dataPaths.mapTr, 'mapTr'),
      loadDataFile(CONFIG.dataPaths.mapEn, 'mapEn'),
      loadDataFile(CONFIG.dataPaths.appendicesTr, 'appendicesTr'),
      loadDataFile(CONFIG.dataPaths.appendicesEn, 'appendicesEn')
    ]);

    console.log('Veriler başarıyla yüklendi.');
  } catch (error) {
    console.error('Temel veri yükleme hatası:', error);
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

  function pushSearchItem({
    source,
    page,
    suraNum,
    verseNum,
    text
  }) {
    const cleanText =
      String(text || '');

    if (!cleanText) {
      return;
    }

    SEARCH_INDEX.quran.push({
      type: 'quran',
      source,
      page:
        Number(page) ||
        getVersePage(
          String(suraNum),
          String(verseNum)
        ),
      suraNum:
        String(suraNum),
      verseNum:
        String(verseNum),
      text: cleanText,
      normalized:
        normalizeTurkishText(
          cleanText
        )
    });
  }

  /*
    Sayfa tabanlı Türkçe ve İngilizce.
  */
  ['tr', 'en'].forEach((source) => {
    const data =
      STATE.data[source];

    for (const page in data) {
      const pageObject =
        data[page];

      if (!pageObject?.sura) {
        continue;
      }

      for (const suraNum in pageObject.sura) {
        const verses =
          pageObject.sura[suraNum]?.verses || {};

        for (const verseNum in verses) {
          pushSearchItem({
            source,
            page,
            suraNum,
            verseNum,
            text:
              verses[verseNum]
          });
        }
      }
    }
  });

  /*
    Sure tabanlı okunuş.
  */
  const transliterationData =
    STATE.data.translit;

  for (const suraNum in transliterationData) {
    const verses =
      transliterationData[suraNum]?.verses || {};

    for (const verseNum in verses) {
      pushSearchItem({
        source: 'translit',
        suraNum,
        verseNum,
        text:
          verses[verseNum]
      });
    }
  }

  /*
    Sure tabanlı AI çeviri.
  */
  const aiData =
    STATE.data.ai;

  for (const suraNum in aiData) {
    const verses =
      aiData[suraNum]?.verses || {};

    for (const verseNum in verses) {
      pushSearchItem({
        source: 'ai',
        suraNum,
        verseNum,
        text:
          verses[verseNum]
      });
    }
  }

  SEARCH_INDEX.ready = true;

  console.log(
    'Quran search index hazır:',
    SEARCH_INDEX.quran.length
  );
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

const WORD_TRANSLATIONS_STATE = {
  status: 'idle',
  loadPromise: null
};

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
  const startPage = Math.max(
    FIRST_QURAN_DATA_PAGE,
    pageNum - CONFIG.initialLoad
  );

  const endPage = Math.min(
    LAST_QURAN_DATA_PAGE,
    pageNum + CONFIG.initialLoad
  );

  for (let i = startPage; i <= endPage; i++) {
    if (!STATE.loadedPages.has(i)) {
      STATE.loadedPages.add(i);
    }
  }

  displayPage(pageNum);
}

function goToPage(pageNum) {
  ensureQuranView();

  pageNum = Number(pageNum);

  if (!Number.isInteger(pageNum)) {
    console.warn('Geçersiz sayfa numarası:', pageNum);
    return;
  }

  if (pageNum > LAST_QURAN_DATA_PAGE) {
    pageNum = FIRST_QURAN_DATA_PAGE;
  }

  if (pageNum < FIRST_QURAN_DATA_PAGE) {
    pageNum = LAST_QURAN_DATA_PAGE;
  }

  if (!STATE.data.en[pageNum] || !STATE.data.tr[pageNum]) {
    console.error(
      `Sayfa verisi bulunamadı. Veri anahtarı: ${pageNum}`
    );

    DOM.content.innerHTML = `
      <div style="text-align:center;padding:60px 20px;">

          <h2 style="color:white;margin-bottom:20px;">
              www.KuranTeyit.com
          </h2>

          <button onclick="location.href='index.html?sure=1'"
              style="
                  padding:10px 22px;
                  border:none;
                  border-radius:8px;
                  cursor:pointer;
                  font-size:16px;
                  margin-bottom:40px;
              ">
              Fatiha Suresine Dön
          </button>

          <hr style="
              width:80%;
              border:0;
              border-top:1px solid rgba(255,255,255,.15);
              margin:40px auto;
          ">

          <div style="
              max-width:850px;
              margin:auto;
              background:#1b2336;
              border:1px solid rgba(255,255,255,.08);
              border-radius:18px;
              padding:35px;
          ">

              <div style="
                  font-size:28px;
                  font-weight:700;
                  color:#fff;
                  margin-bottom:25px;
              ">
                  İlk İnen Ayet
              </div>

              <div style="
                  direction:rtl;
                  font-size:44px;
                  line-height:2;
                  color:#fff;
                  font-family:'Amiri','Scheherazade New',serif;
                  margin-bottom:25px;
              ">
                  اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ
              </div>

              <div style="
                  color:#d8d8d8;
                  font-size:20px;
                  margin-bottom:18px;
              ">
                  İkra' bismi rabbikellezî halak.
              </div>

              <div style="
                  color:#fff;
                  font-size:22px;
                  font-weight:600;
              ">
                  Oku, yaratan Rabbinin adıyla.
              </div>

              <div style="
                  margin-top:22px;
                  color:#9aa4b8;
                  font-size:16px;
              ">
                  Alak Suresi • 1. Ayet
              </div>

          </div>

      </div>
    `;

    return;
  }

  STATE.currentPage = pageNum;

  if (STATE.loadedPages.has(pageNum)) {
    displayPage(pageNum);
  } else {
    loadPagesAround(pageNum);
  }

  if (!pendingHighlight) {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
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
    if (el.textContent.trim() === `${suraNum} : ${verseNum}`) {
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

function applyTemporaryHighlightToVerse(
  verseElement,
  query,
  duration = 5000
) {
  if (!verseElement || !query) {
    return;
  }

  const cleanQuery =
    String(query).trim();

  if (!cleanQuery) {
    return;
  }

  const selectors = [
    '.verse-arabic',
    '.verse-text',
    '.verse-text-tr'
  ];

  const changedElements = [];

  selectors.forEach((selector) => {
    const element =
      verseElement.querySelector(selector);

    if (!element) {
      return;
    }

    const originalHtml =
      element.innerHTML;

    const walker =
      document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT
      );

    const textNodes = [];

    while (walker.nextNode()) {
      const node =
        walker.currentNode;

      if (
        node.parentElement?.closest(
          'button'
        )
      ) {
        continue;
      }

      textNodes.push(node);
    }

    let changed = false;

    textNodes.forEach((textNode) => {
      const text =
        textNode.nodeValue || '';

      const regex =
        new RegExp(
          escapeRegExp(cleanQuery),
          'gi'
        );

      if (!regex.test(text)) {
        return;
      }

      const wrapper =
        document.createElement('span');

      wrapper.innerHTML =
        escapeHtml(text).replace(
          new RegExp(
            escapeRegExp(cleanQuery),
            'gi'
          ),
          '<span class="search-result-highlight">$&</span>'
        );

      textNode.replaceWith(
        ...wrapper.childNodes
      );

      changed = true;
    });

    if (changed) {
      changedElements.push({
        element,
        originalHtml
      });
    }
  });

  setTimeout(() => {
    changedElements.forEach(
      ({ element, originalHtml }) => {
        if (!element.isConnected) {
          return;
        }

        element.innerHTML =
          originalHtml;
      }
    );

    decorateVerseWords();
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
function getArabic2Text(suraNum, verseNum) {
  const suraData = STATE.data.arabic2?.[String(suraNum)];
  if (!Array.isArray(suraData)) return '';

  const found = suraData.find((item) => String(item.verse) === String(verseNum));
  return found?.text || '';
}

function getErhanArabicText(suraNum, verseNum) {
  const surah = STATE.data.erhanArabic?.surahs?.find(
    (s) => String(s.id) === String(suraNum)
  );

  if (!surah || !Array.isArray(surah.verses)) return '';

  const verse = surah.verses.find(
    (v) => String(v.verse_number) === String(verseNum)
  );

  return verse?.verse || '';
}

async function loadWordTranslations() {
  if (WORD_TRANSLATIONS_STATE.status === 'ready') return;

  if (WORD_TRANSLATIONS_STATE.status === 'loading') {
    return WORD_TRANSLATIONS_STATE.loadPromise;
  }

  WORD_TRANSLATIONS_STATE.status = 'loading';

  WORD_TRANSLATIONS_STATE.loadPromise = loadDataFile(
    CONFIG.dataPaths.wordTranslations,
    'wordTranslations'
  )
    .then(() => {
      WORD_TRANSLATIONS_STATE.status = 'ready';
      console.log('Kelime çevirileri yüklendi.');
    })
    .catch((err) => {
      WORD_TRANSLATIONS_STATE.status = 'error';
      console.error('Kelime çevirileri yüklenemedi:', err);
      throw err;
    });

  return WORD_TRANSLATIONS_STATE.loadPromise;
}

function getWordTranslationHtml(suraNum, verseNum) {
  const key = `${suraNum}:${verseNum}`;
  const words = STATE.data.wordTranslations?.[key];

  if (!Array.isArray(words) || words.length === 0) {
    return '<div class="word-translation-empty">Kelime çevirisi bulunamadı.</div>';
  }

  return `
    <div class="word-translation-box">
      <div class="word-translation-title">🔤 Kelime Çevirisi</div>

      <div class="word-translation-table">
        <div class="word-translation-head">
          <span>#</span>
          <span>Kelime</span>
          <span>Okunuş</span>
          <span>Anlam</span>
          <span>Kök</span>
        </div>

        ${words.map((item, index) => `
          <div class="word-translation-row">
            <span>${item.sort || index + 1}</span>
            <strong class="word-arabic" dir="rtl">${escapeHtml(item.arabic || '')}</strong>
            <span>${escapeHtml(item.transcription_tr || '')}</span>
            <span>${escapeHtml(item.translation_tr || '')}</span>
            <span class="word-root" dir="rtl">${escapeHtml(item.root?.arabic || '')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function toggleArabicWords(suraNum, verseNum) {
  const box = document.getElementById(`word-translation-${suraNum}-${verseNum}`);
  if (!box) return;

  if (box.dataset.loaded === 'true') return;

  box.innerHTML = '<div class="word-translation-loading">Kelime çevirileri yükleniyor...</div>';

  try {
    await loadWordTranslations();
    box.innerHTML = getWordTranslationHtml(suraNum, verseNum);
    box.dataset.loaded = 'true';
  } catch (err) {
    box.innerHTML = '<div class="word-translation-empty">Kelime çevirileri yüklenemedi.</div>';
  }
}

function findVerseData(suraNum, verseNum) {
  const page = getVersePage(String(suraNum), String(verseNum));
  const enVerse = STATE.data.en?.[page]?.sura?.[suraNum]?.verses?.[verseNum] || '';
  const trVerse = STATE.data.tr?.[page]?.sura?.[suraNum]?.verses?.[verseNum] || '';
  const arabic = STATE.data.en?.[page]?.sura?.[suraNum]?.encrypted?.[verseNum] || '';
  const translit = STATE.data.translit?.[suraNum]?.verses?.[verseNum] || '';

  return {
    verseId: `${suraNum}:${verseNum}`,
    sura: String(suraNum),
    verse: String(verseNum),
    page,
    arabic,
    english: enVerse,
    turkish: trVerse,
    transliteration: translit
  };
}

function buildAnalysisContext(suraNum, verseNum) {
  const mainVerse = findVerseData(String(suraNum), String(verseNum));
  const topics = findTopicsForVerse(String(suraNum), String(verseNum));
  const referenceVerses = getUniqueReferenceVerses(topics, 30);

  return {
    mainVerse,
    topics,
    referenceVerses,
    mapTrLoaded: !!STATE.data.mapTr && Object.keys(STATE.data.mapTr).length > 0,
    mapEnLoaded: !!STATE.data.mapEn && Object.keys(STATE.data.mapEn).length > 0,
    appendicesTrLoaded: !!STATE.data.appendicesTr && Object.keys(STATE.data.appendicesTr).length > 0,
    appendicesEnLoaded: !!STATE.data.appendicesEn && Object.keys(STATE.data.appendicesEn).length > 0
  };
}

function expandVerseRefs(refText) {
  if (!refText || typeof refText !== 'string') return [];

  const refs = [];
  let currentSura = null;

  refText.split(';').forEach((part) => {
    part.split(',').forEach((item) => {
      const clean = item.trim();
      if (!clean) return;

      // Tam yazım: 5:118, 24:58-59, 2:284-3:10
      const fullMatch = clean.match(/^(\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/);

      if (fullMatch) {
        currentSura = fullMatch[1];

        const startVerse = Number(fullMatch[2]);
        const endSura = fullMatch[3] || currentSura;
        const endVerse = fullMatch[4] ? Number(fullMatch[4]) : startVerse;

        if (endSura === currentSura) {
          for (let v = startVerse; v <= endVerse; v++) {
            refs.push(`${currentSura}:${v}`);
          }
        } else {
          refs.push(`${currentSura}:${startVerse}`);
        }

        return;
      }

      // Kısaltılmış yazım: "5:18, 40, 74, 118"
      const shortMatch = clean.match(/^(\d+)(?:-(\d+))?$/);

      if (shortMatch && currentSura) {
        const startVerse = Number(shortMatch[1]);
        const endVerse = shortMatch[2] ? Number(shortMatch[2]) : startVerse;

        for (let v = startVerse; v <= endVerse; v++) {
          refs.push(`${currentSura}:${v}`);
        }
      }
    });
  });

  return refs;
}

function flattenMapTopics(mapObj, lang = 'tr') {
  const results = [];

  function walk(node, path = []) {
    if (!node || typeof node !== 'object') return;

    for (const key in node) {
      const value = node[key];
      const nextPath = [...path, key];

      if (typeof value === 'string') {
        const refs = expandVerseRefs(value);
        if (refs.length) {
          results.push({
            lang,
            title: nextPath.join(' > '),
            rawRefs: value,
            refs
          });
        }
      } else if (value && typeof value === 'object') {
        walk(value, nextPath);
      }
    }
  }

  walk(mapObj);
  return results;
}

function findTopicsForVerse(suraNum, verseNum) {
  const verseId = `${suraNum}:${verseNum}`;

  const trTopics = flattenMapTopics(STATE.data.mapTr, 'tr')
    .filter((topic) => topic.refs.includes(verseId));

  const enTopics = flattenMapTopics(STATE.data.mapEn, 'en')
    .filter((topic) => topic.refs.includes(verseId));

  return {
    tr: trTopics,
    en: enTopics
  };
}

function getUniqueReferenceVerses(topics, limit = 20) {
  const seen = new Set();
  const refs = [];

  [...topics.tr, ...topics.en].forEach((topic) => {
    topic.refs.forEach((ref) => {
      if (seen.has(ref)) return;
      seen.add(ref);
      refs.push(ref);
    });
  });

  return refs.slice(0, limit).map((ref) => {
    const [sura, verse] = ref.split(':');
    return findVerseData(sura, verse);
  });
}

function openAnalysisPanel(suraNum, verseNum) {
  const context = buildAnalysisContext(suraNum, verseNum);

  const existing = document.getElementById('analysisPanel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'analysisPanel';
  panel.className = 'analysis-panel';

  panel.innerHTML = `
    <div class="analysis-panel-header">
      <h2>🔎 Ayet Analizi ${escapeHtml(context.mainVerse.verseId)}</h2>
      <button onclick="closeAnalysisPanel()" class="analysis-close-btn">✕</button>
    </div>

    <div class="analysis-panel-body">
      <h3>Ana Ayet</h3>

      <div class="analysis-card">
        <div class="analysis-arabic">${context.mainVerse.arabic}</div>
        <p><strong>TR:</strong> ${escapeHtml(context.mainVerse.turkish)}</p>
        <p><strong>EN:</strong> ${escapeHtml(context.mainVerse.english)}</p>
        <p><strong>Okunuş:</strong> ${escapeHtml(context.mainVerse.transliteration)}</p>
      </div>

<h3>İlgili Konular</h3>
<div class="analysis-card">
  <h4>Türkçe Konular</h4>
  ${
  context.topics.tr.length
    ? context.topics.tr.map(t => `
      <div class="analysis-topic">
        <strong>${escapeHtml(t.title)}</strong>
        <div class="analysis-topic-verses">
          ${renderTopicReferenceVerses(t)}
        </div>
      </div>
    `).join('')
    : '<p>Konu bulunamadı.</p>'
}

  <h4>İngilizce Konular</h4>
  ${
    context.topics.en.length
      ? context.topics.en.map(t => `<div class="analysis-topic">${escapeHtml(t.title)}<br><small>${escapeHtml(t.rawRefs)}</small></div>`).join('')
      : '<p>Topic bulunamadı.</p>'
  }
</div>

<h3>Referans Ayetler</h3>
<div class="analysis-card">
  ${
    context.referenceVerses.length
      ? context.referenceVerses.map(v => `
        <div class="analysis-ref-verse">
          <strong>${escapeHtml(v.verseId)}</strong>
          <div class="analysis-arabic-small">${v.arabic}</div>
          <p><strong>TR:</strong> ${escapeHtml(v.turkish)}</p>
          <p><strong>EN:</strong> ${escapeHtml(v.english)}</p>
        </div>
      `).join('')
      : '<p>Referans ayet bulunamadı.</p>'
  }
</div>      
    </div>
  `;

  document.body.appendChild(panel);
  document.body.classList.add('analysis-open');
}

function renderTopicReferenceVerses(topic, limit = 12) {
  return topic.refs.slice(0, limit).map((ref) => {
    const [sura, verse] = ref.split(':');
    const v = findVerseData(sura, verse);

    return `
      <div class="analysis-topic-verse">
        <span class="analysis-verse-id">${escapeHtml(v.verseId)}</span>
        <span class="analysis-verse-text">
          ${escapeHtml(v.turkish || 'Türkçe çeviri bulunamadı.')}
        </span>
      </div>
    `;
  }).join('');
}

function closeAnalysisPanel() {
  document.getElementById('analysisPanel')?.remove();
  document.body.classList.remove('analysis-open');
}

function buildPageHtml(pageNum) {
  const enPage = STATE.data.en[pageNum];
  const trPage = STATE.data.tr[pageNum];

  let pageTitle = 'Bilinmeyen';

  const suraNums = Object
    .keys(enPage.sura)
    .sort((a, b) => Number(a) - Number(b));

  if (suraNums.length > 0) {
    const suraTitles = suraNums.map((num) => {
      return STATE.metadata.sureNames[num] || `Sure ${num}`;
    });

    pageTitle = suraTitles.join(' | ');
  }

  let html = `
    <div class="page-header">
      <h1>📖 ${escapeHtml(pageTitle)}</h1>
    </div>
  `;

  const enNotesMap = mapNotesToVerses(enPage.notes?.data);
  const trNotesMap = mapNotesToVerses(trPage.notes?.data);

  for (const suraNum of suraNums) {
    const enSura = enPage.sura[suraNum];
    const trSura = trPage.sura[suraNum];

    html += `
      <div class="sura">
    `;

    const verseKeys = Object
      .keys(enSura.verses)
      .sort((a, b) => Number(a) - Number(b));

    for (const verseNum of verseKeys) {
      if (enSura.titles && enSura.titles[verseNum]) {
        html += `
          <div class="passage-title">
            ${escapeHtml(enSura.titles[verseNum])}
          </div>
        `;

        if (trSura.titles && trSura.titles[verseNum]) {
          html += `
            <div class="passage-title-tr">
              ${escapeHtml(trSura.titles[verseNum])}
            </div>
          `;
        }
      }

      const verseKey = `${suraNum}:${verseNum}`;

      const hasNotes =
        (enNotesMap[verseKey]?.length > 0) ||
        (trNotesMap[verseKey]?.length > 0);

      const arabic2Text = getArabic2Text(
        suraNum,
        verseNum
      );

      const erhanArabicText = getErhanArabicText(
        suraNum,
        verseNum
      );

      html += `
        <div class="verse">

          <div class="verse-header">
            <div></div>

            <div class="verse-number">
              ${suraNum} : ${verseNum}
            </div>

            <details
              class="arabic-section"
              ontoggle="if(this.open) toggleArabicWords(${suraNum}, ${verseNum})"
            >
              <summary>
                📖 Arapça
              </summary>

              <div class="arabic-dropdown-content">

                <div class="arabic-label">
                  Standart Arapça - qurantft.json
                </div>

                <div class="verse-arabic">
                  ${enSura.encrypted?.[verseNum] || ''}
                </div>

                ${
                  arabic2Text
                    ? `
                      <div class="arabic-label">
                        İkinci Arapça - quran_arapca2.json
                      </div>

                      <div class="verse-arabic verse-arabic-2">
                        ${arabic2Text}
                      </div>
                    `
                    : ''
                }

                ${
                  erhanArabicText
                    ? `
                      <div class="arabic-label">
                        Erhan Aktaş Arapçası - kuran_erhan_aktas.json
                      </div>

                      <div class="verse-arabic verse-arabic-2">
                        ${erhanArabicText}
                      </div>
                    `
                    : ''
                }

                <div
                  id="word-translation-${suraNum}-${verseNum}"
                  class="word-translation-container"
                ></div>

              </div>
            </details>
          </div>
      `;

      if (STATE.settings.showTransliteration) {
        const transliterationText =
          STATE.data.translit?.[String(suraNum)]?.verses?.[String(verseNum)] || '';

        html += `
          <div class="verse-transliteration">

            <span>
              ${escapeHtml(transliterationText)}
            </span>

            ${
              transliterationText
                ? `
                  <button
                    class="speak-btn"
                    onclick="speakVerse(${suraNum}, ${verseNum})"
                    title="Okunuşu seslendir"
                  >
                    🔊
                  </button>

                  <button
                    class="speak-btn stop-speak-btn"
                    onclick="stopSpeech()"
                    title="Sesi durdur"
                  >
                    ⏹
                  </button>
                `
                : ''
            }

          </div>
        `;
      }

      html += `
        <div class="verse-text">
          ${escapeHtml(enSura.verses[verseNum])}

          <button
            class="inline-speak-btn"
            onclick="speakEnglishVerse(${suraNum}, ${verseNum})"
            title="İngilizce oku"
          >
            🔈
          </button>
        </div>

        <div class="verse-text-tr">
          <strong>
            ${escapeHtml(trSura.verses[verseNum])}
          </strong>
        </div>

        <div class="buttons">
      `;

      if (hasNotes) {
        html += `
          <button
            class="toggle-btn dipnot-btn"
            data-target="note-${suraNum}-${verseNum}"
            onclick="toggleNote('note-${suraNum}-${verseNum}')"
          >
            📌 Dipnot
          </button>
        `;
      }

      if (STATE.settings.showMeals) {
        html += `
          <button
            class="toggle-btn"
            id="meal-btn-${suraNum}-${verseNum}"
            onclick="toggleMeal('meal-${suraNum}-${verseNum}', ${suraNum}, ${verseNum})"
          >
            📚 Mealler
          </button>
        `;
      }

      html += `
        <button
          class="toggle-btn analysis-btn"
          onclick="openAnalysisPanel(${suraNum}, ${verseNum})"
        >
          🔎 Analiz
        </button>
      `;

      const hasUserNote = getLocalNote(
        suraNum,
        verseNum
      );

      html += `
        <button
          id="noteBtn-${suraNum}-${verseNum}"
          class="toggle-btn note-btn ${hasUserNote ? 'has-note' : ''}"
          onclick="toggleNoteInput(
            'note-input-box-${suraNum}-${verseNum}',
            ${suraNum},
            ${verseNum}
          )"
        >
          ${hasUserNote ? '📝 Notlu' : '✍️ Not Al'}
        </button>
      `;

      html += `
        </div>
      `;

      if (STATE.settings.showAiTranslation) {
        html += `
          <div
            id="ai-translation-${suraNum}-${verseNum}"
            class="ai-translation"
          >
        `;

        if (STATE.data.ai[suraNum]?.verses?.[verseNum]) {
          html += `
            <strong>
              AI ÇEVİRİ:
            </strong>

            ${escapeHtml(
              STATE.data.ai[suraNum].verses[verseNum]
            )}
          `;
        } else {
          html += `
            <strong>
              AI ÇEVİRİ:
            </strong>

            Çeviri bulunamadı.
          `;
        }

        html += `
          </div>
        `;
      }

      if (hasNotes) {
        html += `
          <div
            id="note-${suraNum}-${verseNum}"
            class="note-box footnote-box hidden"
          >
        `;

        if (enNotesMap[verseKey]) {
          enNotesMap[verseKey].forEach((note) => {
            html += `
              <div class="footnote-line footnote-en">

                <strong class="footnote-name">
                  EN:
                </strong>

                <span class="footnote-text">
                  ${escapeHtml(note)}
                </span>

              </div>
            `;
          });
        }

        if (
          enNotesMap[verseKey] &&
          trNotesMap[verseKey]
        ) {
          html += `
            <div class="note-separator"></div>
          `;
        }

        if (trNotesMap[verseKey]) {
          trNotesMap[verseKey].forEach((note) => {
            html += `
              <div class="footnote-line footnote-tr">

                <strong class="footnote-name">
                  TR:
                </strong>

                <span class="footnote-text">
                  ${escapeHtml(note)}
                </span>

              </div>
            `;
          });
        }

        html += `
          </div>
        `;
      }

      html += `
        <div
          id="user-note-${suraNum}-${verseNum}"
          class="note-box hidden"
        ></div>

        <div
          id="meal-${suraNum}-${verseNum}"
          class="note-box hidden"
        ></div>

        <div
          id="note-input-box-${suraNum}-${verseNum}"
          class="note-input-box hidden"
        >

          <textarea
            id="note-input-${suraNum}-${verseNum}"
            placeholder="Notunuzu buraya yazın..."
            rows="4"
          ></textarea>

          <div class="note-actions">

            <button
              class="save-note-btn"
              onclick="saveNote(${suraNum}, ${verseNum})"
            >
              💾 Kaydet
            </button>

            <button
              class="cancel-note-btn"
              onclick="cancelNote(${suraNum}, ${verseNum})"
            >
              ❌ İptal
            </button>

          </div>
        </div>

      </div>
      `;
    }

    html += `
      </div>
    `;
  }

  const visiblePageNumber = STATE.currentPage;

  const previousPage =
    STATE.currentPage <= FIRST_QURAN_DATA_PAGE
      ? LAST_QURAN_DATA_PAGE
      : STATE.currentPage - 1;

  const nextPage =
    STATE.currentPage >= LAST_QURAN_DATA_PAGE
      ? FIRST_QURAN_DATA_PAGE
      : STATE.currentPage + 1;

  html += `
    <div class="page-footer">

      <button
        type="button"
        class="header-btn"
        onclick="goToPage(${previousPage})"
      >
        ⟵ Önceki Sayfa
      </button>

      <span class="page-info">
        Sayfa ${visiblePageNumber} / ${TOTAL_QURAN_PAGES}
      </span>

      <button
        type="button"
        class="header-btn"
        onclick="goToPage(${nextPage})"
      >
        Sonraki Sayfa ⟶
      </button>

    </div>
  `;

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
  console.error(
    `Sayfa verisi bulunamadı. Veri anahtarı: ${pageNum}`
  );

  DOM.content.innerHTML = `
    <div
      class="error-message"
      style="
        text-align:center;
        padding:40px 20px;
        max-width:900px;
        margin:0 auto;
      "
    >
      <h2>
        Sayfa verisi bulunamadı
      </h2>

      <p>
        Bu sayfa mevcut veri dosyalarında yer almıyor.
      </p>

      <div
        style="
          margin:30px auto;
          padding:24px;
          border-radius:14px;
          background:rgba(255,255,255,0.06);
          max-width:700px;
        "
      >
        <div
          style="
            font-size:18px;
            font-weight:700;
            margin-bottom:16px;
          "
        >
          Alak Suresi 1. Ayet
        </div>

        <div
          dir="rtl"
          style="
            font-family:'Scheherazade New', serif;
            font-size:36px;
            line-height:1.8;
            margin-bottom:16px;
          "
        >
          اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ
        </div>

        <div
          style="
            font-size:18px;
            margin-bottom:10px;
          "
        >
          İkra' bismi rabbikellezî halak.
        </div>

        <div
          style="
            font-size:17px;
            font-weight:600;
          "
        >
          Yaratan Rabbinin adıyla oku.
        </div>
      </div>

      <button
        type="button"
        class="header-btn"
        onclick="goToPage(${FIRST_QURAN_DATA_PAGE})"
      >
        Fatiha Suresine Dön
      </button>
    </div>
  `;

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
function normalizeDictionaryWord(rawWord) {
  if (!rawWord) return '';

  let word = String(rawWord)
    // Farklı apostrofları standartlaştır
    .replace(/[’‘`´ʼʻ＇]/g, "'")

    // Farklı tire biçimlerini standartlaştır
    .replace(/[‐‒–—﹘﹣－]/g, "-")

    // Aksanları kaldır
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

    .toLowerCase()
    .trim();

  // Baştaki gereksiz karakterleri temizle
  word = word.replace(/^[^a-z0-9]+/g, '');

  // Sondaki yıldız, virgül, noktalama, parantez vb. temizle
  word = word.replace(/[^a-z0-9]+$/g, '');

  // Harfler arasındaki nokta, apostrof ve tireyi koru
  word = word.replace(/[^a-z0-9.'-]/g, '');

  // Art arda gelen işaretleri sadeleştir
  word = word
    .replace(/'{2,}/g, "'")
    .replace(/-{2,}/g, '-')
    .replace(/\.{2,}/g, '.');

  // Baş ve sondaki nokta/apostrof/tireleri tekrar temizle
  word = word.replace(/^['.-]+|['.-]+$/g, '');

  return word;
}


function getDictionaryCandidates(rawWord) {
  const rawText = String(rawWord || '');

  // Orijinal metinde uzun çizgi bulunup bulunmadığını,
  // normalizasyon yapılmadan önce tespit ediyoruz.
  const containsLongDash = /[—–―]/.test(rawText);

  const word = normalizeDictionaryWord(rawText);

  if (!word) return [];

  const candidates = [word];

  // A.L.M. → alm
  if (word.includes('.')) {
    const noDots = word.replace(/\./g, '');

    if (noDots) {
      candidates.push(noDots);
    }
  }

  // Joseph's → joseph
  if (word.endsWith("'s") && word.length > 2) {
    candidates.push(word.slice(0, -2));
  }

  // prophets' → prophets
  if (word.endsWith("'") && word.length > 1) {
    candidates.push(word.slice(0, -1));
  }

  // Shu'aib → shuaib
  if (word.includes("'")) {
    const noApostrophes = word.replace(/'/g, '');

    if (noApostrophes) {
      candidates.push(noApostrophes);
    }
  }

  // well-protected → wellprotected
  // Birleşik kelime tek parça olarak korunur.
  if (word.includes('-')) {
    const noHyphens = word.replace(/-/g, '');

    if (noHyphens) {
      candidates.push(noHyphens);
    }
  }

  /*
    Yalnızca orijinal metinde uzun çizgi varsa parçala:

    earth—you → earth, you
    earth–you → earth, you

    Normal kısa tireli kelimeler parçalanmaz:

    empty-handed
    well-protected
    one-fifth
  */
  if (containsLongDash && word.includes('-')) {
    const parts = word
      .split('-')
      .map((part) => normalizeDictionaryWord(part))
      .filter(Boolean);

    candidates.push(...parts);
  }

  // Tüm işaretleri kaldırılmış son aday.
  const compact = word.replace(/[.'-]/g, '');

  if (compact) {
    candidates.push(compact);
  }

  return [...new Set(candidates)];
}


function decorateVerseWords() {
  /*
    İngilizce sözlük yardımının çalışacağı alanlar:
    - Ana İngilizce ayet metni
    - İngilizce sure / bölüm başlıkları
    - İngilizce dipnot metinleri
  */
  const englishTextSelectors = [
    '.verse-text',
    '.passage-title',
    '.footnote-en .footnote-text'
  ];

  document
    .querySelectorAll(englishTextSelectors.join(', '))
    .forEach((element) => {
      if (element.dataset.decorated === 'true') {
        return;
      }

      const preservedButtons = Array.from(
        element.querySelectorAll(
          ':scope > .inline-speak-btn'
        )
      );

      const text = Array.from(element.childNodes)
        .filter((node) => {
          return !(
            node.nodeType === Node.ELEMENT_NODE &&
            node.classList?.contains(
              'inline-speak-btn'
            )
          );
        })
        .map((node) => node.textContent || '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();

      if (!text) {
        element.dataset.decorated = 'true';
        return;
      }

      const words = text.split(/\s+/);

      element.innerHTML = words
        .map((word) => {
          const candidates =
            getDictionaryCandidates(word);

          const cleanWord =
            candidates[0] || '';

          if (!cleanWord) {
            return escapeHtml(word);
          }

          return `
            <span
              class="word-token"
              data-word="${escapeHtml(cleanWord)}"
              data-candidates="${escapeHtml(
                JSON.stringify(candidates)
              )}"
              data-original="${escapeHtml(
                normalizeDictionaryWord(word)
              )}"
              tabindex="0"
              style="cursor:help;"
            >${escapeHtml(word)}</span>
          `;
        })
        .join(' ');

      preservedButtons.forEach((button) => {
        element.appendChild(
          document.createTextNode(' ')
        );

        element.appendChild(button);
      });

      element.dataset.decorated = 'true';
    });
}

function setupWordTooltipDelegation() {
  if (tooltipDelegationReady) return;
  tooltipDelegationReady = true;

  const tooltip = DOM.wordTooltip;

  if (!tooltip || !DOM.content) return;

  let pinnedToken = null;
  let activeToken = null;
  let animationFrameId = null;

  Object.assign(tooltip.style, {
    position: 'fixed',
    display: 'none',
    pointerEvents: 'none',
    zIndex: '99999',
    maxWidth: '380px',
    maxHeight: '65vh',
    overflowY: 'auto',
    boxSizing: 'border-box'
  });

  function getTranslationHtml(token) {
    const displayedWord = String(
      token.textContent || ''
    ).trim();

    let candidates = [];

    try {
      candidates = JSON.parse(
        token.dataset.candidates || '[]'
      );
    } catch (error) {
      console.warn(
        'Kelime adayları okunamadı:',
        error
      );
    }

    if (
      !Array.isArray(candidates) ||
      candidates.length === 0
    ) {
      candidates =
        getDictionaryCandidates(displayedWord);
    }

    const originalWord =
      normalizeDictionaryWord(
        token.dataset.original ||
        displayedWord
      );

    const lookupCandidates = [
      originalWord,
      ...candidates
    ].filter(Boolean);

    const uniqueCandidates = [
      ...new Set(lookupCandidates)
    ];

    const foundWords = [];
    const usedMeanings = new Set();

    for (const candidate of uniqueCandidates) {
      const hasCandidate =
        Object.prototype.hasOwnProperty.call(
          STATE.data.dictionary,
          candidate
        );

      if (!hasCandidate) continue;

      const meaning =
        STATE.data.dictionary[candidate];

      if (!meaning) continue;

      const meaningKey =
        String(meaning).trim();

      if (usedMeanings.has(meaningKey)) {
        continue;
      }

      usedMeanings.add(meaningKey);

      foundWords.push({
        word: candidate,
        meaning: meaningKey
      });
    }

    if (foundWords.length > 0) {
      const resultHtml = foundWords
        .map((item) => {
          const translations = String(
            item.meaning
          )
            .split(/\s*,\s*/)
            .filter(Boolean)
            .map((translation, index) => {
              const colors = [
                '#e74c3c',
                '#27ae60',
                '#3498db'
              ];

              const color =
                colors[index % colors.length];

              return `
                <strong style="color:${color}">
                  ${escapeHtml(translation)}
                </strong>
              `;
            })
            .join(', ');

          return `
            <div style="margin-bottom:8px;">
              <strong>
                ${escapeHtml(item.word)}
              </strong>
              ➜
              ${translations}
            </div>
          `;
        })
        .join('<hr>');

      return `
        <div>
          <div style="margin-bottom:8px;">
            "<strong>
              ${escapeHtml(displayedWord)}
            </strong>"
          </div>

          ${resultHtml}
        </div>
      `;
    }

    console.warn(
      'Sözlükte bulunamayan kelime:',
      {
        displayedWord,
        originalWord,
        candidates: uniqueCandidates
      }
    );

    return `
      "${escapeHtml(displayedWord)}"
      ➔
      <span style="color:#e74c3c;">
        Kelime bulunamadı
      </span>
    `;
  }

  function calculateTooltipPosition(
    clientX,
    clientY
  ) {
    const margin = 10;
    const offset = 14;

    const tooltipWidth =
      tooltip.offsetWidth;

    const tooltipHeight =
      tooltip.offsetHeight;

    let left = clientX + offset;
    let top = clientY + offset;

    if (
      left + tooltipWidth >
      window.innerWidth - margin
    ) {
      left =
        clientX -
        tooltipWidth -
        offset;
    }

    if (
      top + tooltipHeight >
      window.innerHeight - margin
    ) {
      top =
        clientY -
        tooltipHeight -
        offset;
    }

    left = Math.max(
      margin,
      Math.min(
        left,
        window.innerWidth -
        tooltipWidth -
        margin
      )
    );

    top = Math.max(
      margin,
      Math.min(
        top,
        window.innerHeight -
        tooltipHeight -
        margin
      )
    );

    return {
      left,
      top
    };
  }

  function moveTooltip(
    clientX,
    clientY
  ) {
    if (animationFrameId) {
      cancelAnimationFrame(
        animationFrameId
      );
    }

    animationFrameId =
      requestAnimationFrame(() => {
        if (
          tooltip.style.display !== 'block'
        ) {
          return;
        }

        const position =
          calculateTooltipPosition(
            clientX,
            clientY
          );

        tooltip.style.left =
          `${position.left}px`;

        tooltip.style.top =
          `${position.top}px`;

        animationFrameId = null;
      });
  }

  function showTooltipAt(
    clientX,
    clientY,
    html
  ) {
    tooltip.innerHTML = html;
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';

    requestAnimationFrame(() => {
      const position =
        calculateTooltipPosition(
          clientX,
          clientY
        );

      tooltip.style.left =
        `${position.left}px`;

      tooltip.style.top =
        `${position.top}px`;

      tooltip.style.visibility =
        'visible';
    });
  }

  function showTooltipNearElement(
    element,
    html
  ) {
    const rect =
      element.getBoundingClientRect();

    const margin = 10;
    const offset = 8;

    tooltip.innerHTML = html;
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';

    requestAnimationFrame(() => {
      const tooltipWidth =
        tooltip.offsetWidth;

      const tooltipHeight =
        tooltip.offsetHeight;

      let left = rect.left;
      let top = rect.bottom + offset;

      if (
        left + tooltipWidth >
        window.innerWidth - margin
      ) {
        left =
          window.innerWidth -
          tooltipWidth -
          margin;
      }

      if (
        top + tooltipHeight >
        window.innerHeight - margin
      ) {
        top =
          rect.top -
          tooltipHeight -
          offset;
      }

      left = Math.max(
        margin,
        left
      );

      top = Math.max(
        margin,
        top
      );

      tooltip.style.left =
        `${left}px`;

      tooltip.style.top =
        `${top}px`;

      tooltip.style.visibility =
        'visible';
    });
  }

  function hideTooltip() {
    if (animationFrameId) {
      cancelAnimationFrame(
        animationFrameId
      );

      animationFrameId = null;
    }

    tooltip.style.display = 'none';
    tooltip.style.visibility = 'hidden';

    activeToken = null;
    pinnedToken = null;
  }

  function isTouchDevice() {
    return (
      window
        .matchMedia('(hover: none)')
        .matches ||
      navigator.maxTouchPoints > 0
    );
  }

  DOM.content.addEventListener(
    'mouseover',
    (event) => {
      if (
        isTouchDevice() ||
        pinnedToken
      ) {
        return;
      }

      const token =
        event.target.closest(
          '.word-token'
        );

      if (
        !token ||
        !DOM.content.contains(token)
      ) {
        return;
      }

      if (
        event.relatedTarget &&
        token.contains(
          event.relatedTarget
        )
      ) {
        return;
      }

      activeToken = token;

      showTooltipAt(
        event.clientX,
        event.clientY,
        getTranslationHtml(token)
      );
    }
  );

  DOM.content.addEventListener(
    'mousemove',
    (event) => {
      if (
        isTouchDevice() ||
        pinnedToken ||
        !activeToken
      ) {
        return;
      }

      moveTooltip(
        event.clientX,
        event.clientY
      );
    }
  );

  DOM.content.addEventListener(
    'mouseout',
    (event) => {
      if (
        isTouchDevice() ||
        pinnedToken
      ) {
        return;
      }

      const token =
        event.target.closest(
          '.word-token'
        );

      if (
        !token ||
        token !== activeToken
      ) {
        return;
      }

      if (
        event.relatedTarget &&
        token.contains(
          event.relatedTarget
        )
      ) {
        return;
      }

      tooltip.style.display = 'none';
      tooltip.style.visibility = 'hidden';
      activeToken = null;
    }
  );

  DOM.content.addEventListener(
    'click',
    (event) => {
      const token =
        event.target.closest(
          '.word-token'
        );

      if (
        !token ||
        !DOM.content.contains(token)
      ) {
        return;
      }

      if (!isTouchDevice()) return;

      event.preventDefault();
      event.stopPropagation();

      if (pinnedToken === token) {
        hideTooltip();
        return;
      }

      pinnedToken = token;
      activeToken = token;

      showTooltipNearElement(
        token,
        getTranslationHtml(token)
      );
    }
  );

  document.addEventListener(
    'click',
    (event) => {
      if (!pinnedToken) return;

      const clickedToken =
        event.target.closest(
          '.word-token'
        );

      const clickedTooltip =
        event.target.closest(
          '#wordTooltip'
        );

      if (
        !clickedToken &&
        !clickedTooltip
      ) {
        hideTooltip();
      }
    }
  );

  window.addEventListener(
    'resize',
    hideTooltip
  );

  window.addEventListener(
    'scroll',
    () => {
      if (pinnedToken) {
        hideTooltip();
      }
    },
    {
      passive: true
    }
  );
}

/* =========================
   Notlar
========================= */
/* =========================
   Yerel Not Sistemi
========================= */

const LOCAL_NOTES_KEY = 'kuranTeyitNotesV1';

function getAllLocalNotes() {
  try {
    const savedNotes = localStorage.getItem(LOCAL_NOTES_KEY);

    if (!savedNotes) {
      return {};
    }

    const parsedNotes = JSON.parse(savedNotes);

    if (
      !parsedNotes ||
      typeof parsedNotes !== 'object' ||
      Array.isArray(parsedNotes)
    ) {
      return {};
    }

    return parsedNotes;
  } catch (error) {
    console.error('Yerel notlar okunamadı:', error);
    return {};
  }
}

function writeAllLocalNotes(notes) {
  try {
    localStorage.setItem(
      LOCAL_NOTES_KEY,
      JSON.stringify(notes)
    );

    return true;
  } catch (error) {
    console.error('Yerel notlar kaydedilemedi:', error);

    showNotification(
      'Notlar tarayıcıya kaydedilemedi.',
      'warning'
    );

    return false;
  }
}

function getLocalNote(sura, verse) {
  const notes = getAllLocalNotes();
  const verseId = `${sura}:${verse}`;

  return notes[verseId] || null;
}

function saveLocalNote(sura, verse, content) {
  const notes = getAllLocalNotes();
  const verseId = `${sura}:${verse}`;

  notes[verseId] = {
    sura: String(sura),
    verse: String(verse),
    content: String(content),
    updatedAt: new Date().toISOString()
  };

  return writeAllLocalNotes(notes);
}

function deleteLocalNote(sura, verse) {
  const notes = getAllLocalNotes();
  const verseId = `${sura}:${verse}`;

  if (!notes[verseId]) {
    return false;
  }

  delete notes[verseId];

  return writeAllLocalNotes(notes);
}

/* =========================
   loadNotesForCurrentPage BAŞLANGIÇ
========================= */

function loadNotesForCurrentPage() {
    const verseElements =
        document.querySelectorAll(
            '.verse-number'
        );

    verseElements.forEach((element) => {
        const verseText =
            element.textContent.trim();

        const match =
            verseText.match(
                /^(\d+)\s*:\s*(\d+)$/
            );

        if (!match) {
            return;
        }

        const [, sura, verse] = match;

        const note = getLocalNote(
            sura,
            verse
        );

        if (note?.content) {
            displayLoadedNote(
                sura,
                verse,
                note.content
            );
        } else {
            updateLocalNoteUI(
                sura,
                verse
            );
        }
    });
}

/* =========================
   loadNotesForCurrentPage BİTİŞ
========================= */

function displayLoadedNote(sura, verse, content) {
  const box = document.getElementById(
    `user-note-${sura}-${verse}`
  );

  if (!box) return;

  const safeContent = escapeHtml(content || '');

  box.innerHTML = `
    <div class="saved-note-card">
      <div class="saved-note-row">
        <div class="saved-note-main">
          <strong class="saved-note-title">
            📝 Notunuz:
          </strong>

          <span class="saved-note-content">
            ${safeContent.replace(/\n/g, '<br>')}
          </span>
        </div>

        <div class="saved-note-actions">
          <button
            type="button"
            class="toggle-btn"
            onclick="editLocalNote(${Number(sura)}, ${Number(verse)})"
          >
            ✏️ Düzenle
          </button>

          <button
            type="button"
            class="toggle-btn"
            onclick="removeLocalNote(${Number(sura)}, ${Number(verse)})"
          >
            🗑️ Sil
          </button>
        </div>
      </div>
    </div>
  `;

  // Not kaydı hazırlanır fakat başlangıçta kapalı tutulur.
  box.classList.add('hidden');

  const noteButton = document.getElementById(
    `noteBtn-${sura}-${verse}`
  );

  if (noteButton) {
    noteButton.classList.add('has-note');
    noteButton.textContent = '📝 Notlu';
  }
}

/* =========================
   updateLocalNoteUI BAŞLANGIÇ
========================= */

function updateLocalNoteUI(sura, verse) {
    const note = getLocalNote(
        sura,
        verse
    );

    const noteButton = document.getElementById(
        `noteBtn-${sura}-${verse}`
    );

    const noteBox = document.getElementById(
        `user-note-${sura}-${verse}`
    );

    if (note?.content) {
        if (noteButton) {
            noteButton.classList.add(
                'has-note'
            );

            noteButton.textContent =
                '📝 Notlu';
        }

        return;
    }

    if (noteButton) {
        noteButton.classList.remove(
            'has-note'
        );

        noteButton.textContent =
            '✍️ Not Al';
    }

    if (noteBox) {
        noteBox.innerHTML = '';

        noteBox.classList.add(
            'hidden'
        );
    }
}

/* =========================
   updateLocalNoteUI BİTİŞ
========================= */

/* =========================
   saveNote BAŞLANGIÇ
========================= */

function saveNote(sura, verse) {
    const textarea = document.getElementById(
        `note-input-${sura}-${verse}`
    );

    if (!textarea) {
        return;
    }

    const noteContent =
        textarea.value.trim();

    if (!noteContent) {
        showNotification(
            '⚠️ Not içeriği boş olamaz.',
            'warning'
        );

        return;
    }

    const success = saveLocalNote(
        sura,
        verse,
        noteContent
    );

    if (!success) {
        return;
    }

    /*
      Eski sayfa HTML'inin önbellekten tekrar
      yüklenmesini engeller.
    */
    clearPageCache();

    textarea.value = '';

    const inputBox = document.getElementById(
        `note-input-box-${sura}-${verse}`
    );

    if (inputBox) {
        inputBox.classList.add(
            'hidden'
        );
    }

    displayLoadedNote(
        sura,
        verse,
        noteContent
    );

    updateLocalNoteUI(
        sura,
        verse
    );

    showNotification(
        '✅ Not cihazınıza kaydedildi.',
        'success'
    );
}

/* =========================
   saveNote BİTİŞ
========================= */

function cancelNote(sura, verse) {
  const textarea = document.getElementById(
    `note-input-${sura}-${verse}`
  );

  const inputBox = document.getElementById(
    `note-input-box-${sura}-${verse}`
  );

  if (textarea) {
    textarea.value = '';
  }

  if (inputBox) {
    inputBox.classList.add('hidden');
  }
}

async function toggleNoteInput(id, sura, verse) {
  const inputBox = document.getElementById(id);
  const savedNoteBox = document.getElementById(
    `user-note-${sura}-${verse}`
  );

  const existingNote = getLocalNote(sura, verse);

  /*
    Kayıtlı not varsa:
    Notlu butonu, kayıtlı not alanını açıp kapatır.
  */
  if (existingNote?.content) {
    if (!savedNoteBox) return;

    savedNoteBox.classList.toggle('hidden');

    return;
  }

  /*
    Kayıtlı not yoksa:
    Normal not yazma alanı açılır veya kapanır.
  */
  if (!inputBox) return;

  inputBox.classList.toggle('hidden');

  if (!inputBox.classList.contains('hidden')) {
    const textarea = document.getElementById(
      `note-input-${sura}-${verse}`
    );

    if (!textarea) return;

    textarea.value = '';

    setTimeout(() => {
      textarea.focus();
    }, 100);
  }
}

function editLocalNote(sura, verse) {
  const inputBox = document.getElementById(
    `note-input-box-${sura}-${verse}`
  );

  const textarea = document.getElementById(
    `note-input-${sura}-${verse}`
  );

  if (!inputBox || !textarea) return;

  const note = getLocalNote(sura, verse);

  textarea.value =
    note?.content || '';

  inputBox.classList.remove('hidden');

  setTimeout(() => {
    textarea.focus();
  }, 100);
}

/* =========================
   removeLocalNote BAŞLANGIÇ
========================= */

function removeLocalNote(sura, verse) {
    const approved = window.confirm(
        'Bu not silinsin mi?'
    );

    if (!approved) {
        return;
    }

    const deleted = deleteLocalNote(
        sura,
        verse
    );

    if (!deleted) {
        showNotification(
            'Silinecek not bulunamadı.',
            'warning'
        );

        return;
    }

    const inputBox = document.getElementById(
        `note-input-box-${sura}-${verse}`
    );

    if (inputBox) {
        inputBox.classList.add(
            'hidden'
        );
    }

    const textarea = document.getElementById(
        `note-input-${sura}-${verse}`
    );

    if (textarea) {
        textarea.value = '';
    }

    /*
      Eski "Notlu" HTML'inin önbellekten
      tekrar gelmesini engeller.
    */
    clearPageCache();

    /*
      Butonu ve not kutusunu güncel
      localStorage durumuna göre sıfırlar.
    */
    updateLocalNoteUI(
        sura,
        verse
    );

    showNotification(
        '🗑️ Not silindi.',
        'success'
    );
}

/* =========================
   removeLocalNote BİTİŞ
========================= */

function loadAndDisplayAllNotes() {
  const notesList =
    document.getElementById('notesList');

  if (!notesList) {
    return;
  }

  const notes = Object
    .values(getAllLocalNotes())
    .sort((a, b) => {
      const suraDifference =
        Number(a.sura) - Number(b.sura);

      if (suraDifference !== 0) {
        return suraDifference;
      }

      return (
        Number(a.verse) -
        Number(b.verse)
      );
    });

  if (notes.length === 0) {
    notesList.innerHTML = `
      <p>
        Henüz kaydedilmiş notunuz bulunmuyor.
      </p>
    `;

    return;
  }

  notesList.innerHTML = `
    <div class="notes-table-wrapper">
      <table class="notes-table">
        <thead>
          <tr>
            <th>Sure</th>
            <th>Ayet</th>
            <th>Sure Adı</th>
            <th>Not</th>
            <th>Güncelleme</th>
            <th>İşlemler</th>
          </tr>
        </thead>

        <tbody>
          ${notes
            .map((note) => {
              const suraNumber =
                Number(note.sura);

              const verseNumber =
                Number(note.verse);

              const suraName =
                STATE.metadata.sureNames[
                  String(note.sura)
                ] ||
                `Sure ${note.sura}`;

              const updatedDate =
                note.updatedAt
                  ? new Date(
                      note.updatedAt
                    ).toLocaleString(
                      'tr-TR'
                    )
                  : '';

              /*
                Satır sonlarını boşluğa çevirir.
                Böylece not tabloda tek satır olur.
              */
              const singleLineContent =
                String(note.content || '')
                  .replace(/\s+/g, ' ')
                  .trim();

              return `
                <tr>
                  <td class="notes-number-cell">
                    ${escapeHtml(
                      String(note.sura)
                    )}
                  </td>

                  <td class="notes-number-cell">
                    ${escapeHtml(
                      String(note.verse)
                    )}
                  </td>

                  <td
                    class="notes-sura-cell"
                    title="${escapeHtml(
                      suraName
                    )}"
                  >
                    ${escapeHtml(
                      suraName
                    )}
                  </td>

                  <td
                    class="notes-content-cell"
                    title="${escapeHtml(
                      String(
                        note.content || ''
                      )
                    )}"
                  >
                    <div class="notes-content-preview">
                      ${escapeHtml(
                        singleLineContent
                      )}
                    </div>
                  </td>

                  <td
                    class="notes-date-cell"
                    title="${escapeHtml(
                      updatedDate
                    )}"
                  >
                    ${escapeHtml(
                      updatedDate
                    )}
                  </td>

                  <td class="notes-actions-cell">
                    <div class="notes-action-buttons">
                      <button
                        type="button"
                        class="notes-go-btn"
                        onclick="goToVerseFromNotes(
                          ${suraNumber},
                          ${verseNumber}
                        )"
                        title="${suraNumber}:${verseNumber} ayetine git"
                        aria-label="${suraNumber}:${verseNumber} ayetine git"
                      >
                        📖 Git
                      </button>

                      <button
                        type="button"
                        class="notes-delete-btn"
                        onclick="removeLocalNoteFromList(
                          ${suraNumber},
                          ${verseNumber}
                        )"
                        title="${suraNumber}:${verseNumber} notunu sil"
                        aria-label="${suraNumber}:${verseNumber} notunu sil"
                      >
                        🗑️ Sil
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function goToVerseFromNotes(
  sura,
  verse
) {
  const suraNumber =
    Number(sura);

  const verseNumber =
    Number(verse);

  if (
    !Number.isInteger(suraNumber) ||
    !Number.isInteger(verseNumber)
  ) {
    showNotification(
      'Geçersiz ayet bilgisi.',
      'warning'
    );

    return;
  }

  pendingHighlight = {
    suraNum: String(suraNumber),
    verseNum: String(verseNumber),
    query: '',
    openMeal: false,
    mealName: ''
  };

  ensureQuranView();

  goToPage(
    getVersePage(
      String(suraNumber),
      String(verseNumber)
    )
  );
}

/* =========================
   removeLocalNoteFromList BAŞLANGIÇ
========================= */

function removeLocalNoteFromList(
    sura,
    verse
) {
    const approved = window.confirm(
        `${sura}:${verse} ayetine ait not silinsin mi?`
    );

    if (!approved) {
        return;
    }

    const deleted = deleteLocalNote(
        sura,
        verse
    );

    if (!deleted) {
        showNotification(
            'Silinecek not bulunamadı.',
            'warning'
        );

        return;
    }

    /*
      Eski "Notlu" butonlarının önbellekten
      tekrar yüklenmesini engeller.
    */
    clearPageCache();

    updateLocalNoteUI(
        sura,
        verse
    );

    loadAndDisplayAllNotes();

    showNotification(
        '🗑️ Not silindi.',
        'success'
    );
}

/* =========================
   removeLocalNoteFromList BİTİŞ
========================= */

function exportLocalNotes() {
  const notes = getAllLocalNotes();

  if (Object.keys(notes).length === 0) {
    showNotification(
      'Dışa aktarılacak not bulunamadı.',
      'warning'
    );

    return;
  }

  const exportData = {
    application: 'KuranTeyit',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes
  };

  const blob = new Blob(
    [
      JSON.stringify(
        exportData,
        null,
        2
      )
    ],
    {
      type: 'application/json;charset=utf-8'
    }
  );

  const downloadUrl =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement('a');

  anchor.href = downloadUrl;
  anchor.download =
    'KuranTeyit_Notlar.json';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(downloadUrl);
}

function openNotesImportDialog() {
  const input =
    document.createElement('input');

  input.type = 'file';
  input.accept =
    '.json,application/json';

  input.addEventListener(
    'change',
    async () => {
      const file = input.files?.[0];

      if (!file) return;

      try {
        const content =
          await file.text();

        const parsed =
          JSON.parse(content);

        const importedNotes =
          parsed.notes || parsed;

        if (
          !importedNotes ||
          typeof importedNotes !== 'object' ||
          Array.isArray(importedNotes)
        ) {
          throw new Error(
            'Geçersiz not dosyası.'
          );
        }

        const existingNotes =
          getAllLocalNotes();

        const mergedNotes = {
          ...existingNotes,
          ...importedNotes
        };

        writeAllLocalNotes(
          mergedNotes
        );

        loadAndDisplayAllNotes();

        if (
          STATE.data.en[STATE.currentPage] &&
          STATE.data.tr[STATE.currentPage]
        ) {
          displayPage(
            STATE.currentPage
          );
        }

        showNotification(
          '✅ Notlar içe aktarıldı.',
          'success'
        );
      } catch (error) {
        console.error(
          'Not dosyası içe aktarılamadı:',
          error
        );

        showNotification(
          'Not dosyası geçersiz veya bozuk.',
          'warning'
        );
      }
    }
  );

  input.click();
}

/* =========================
   Meal
========================= */
function highlightMealText(text, query) {
  if (!text) return '';

  const safeText = escapeHtml(text);

  if (!query) return safeText;

  const q = query.trim();
  if (!q) return safeText;

  const regex = new RegExp(escapeRegExp(escapeHtml(q)), 'gi');

  return safeText.replace(
    regex,
    '<strong class="search-result-highlight">$&</strong>'
  );
}

function highlightMealMatch(element, query) {
  if (!element || !query) {
    return;
  }

  const cleanQuery =
    String(query).trim();

  if (!cleanQuery) {
    return;
  }

  const normalizedQuery =
    normalizeTurkishText(cleanQuery);

  const mealRows =
    element.querySelectorAll(
      '.meal-row'
    );

  mealRows.forEach((row) => {
    const mealText =
      row.querySelector('.meal-text');

    if (!mealText) {
      return;
    }

    const normalizedText =
      normalizeTurkishText(
        mealText.textContent
      );

    if (
      normalizedText.includes(
        normalizedQuery
      )
    ) {
      row.classList.add(
        'meal-highlight'
      );
    } else {
      row.classList.remove(
        'meal-highlight'
      );
    }
  });
}

function getOtherTranslations(
  suraNum,
  verseNum,
  query = '',
  focusedMealName = ''
) {
  const suraIndex = parseInt(suraNum, 10) - 1;

  const pageTransliteration =
    STATE.data.translit?.[String(suraNum)]?.verses?.[String(verseNum)] || '';

  if (
    Number.isNaN(suraIndex) ||
    suraIndex < 0 ||
    suraIndex > 113
  ) {
    return '<div>Geçersiz sure numarası.</div>';
  }

  let otherMealsHtml = '';
  let erhanTranslation = null;
  let erhanArabic = null;

  for (const mealName in STATE.data.meals) {
    if (
      !Object.prototype.hasOwnProperty.call(
        STATE.data.meals,
        mealName
      )
    ) {
      continue;
    }

    const meal = STATE.data.meals[mealName];

    if (!meal) {
      continue;
    }

    let ayetText = null;

    /*
      Format 1:
      {
        sures: [
          {
            ayetler: [
              [1, "Ayet metni"]
            ]
          }
        ]
      }
    */
    if (
      meal.sures &&
      Array.isArray(meal.sures)
    ) {
      const sure = meal.sures[suraIndex];

      if (
        sure &&
        Array.isArray(sure.ayetler)
      ) {
        const ayet = sure.ayetler.find(
          (item) =>
            item &&
            String(item[0]) === String(verseNum)
        );

        if (ayet?.[1]) {
          ayetText = ayet[1];
        }
      }
    }

    /*
      Format 2:
      [
        {
          ayetler: [
            [1, "Ayet metni"]
          ]
        }
      ]
    */
    if (
      !ayetText &&
      Array.isArray(meal)
    ) {
      const sure = meal[suraIndex];

      if (
        sure &&
        Array.isArray(sure.ayetler)
      ) {
        const ayet = sure.ayetler.find(
          (item) =>
            item &&
            String(item[0]) === String(verseNum)
        );

        if (ayet?.[1]) {
          ayetText = ayet[1];
        }
      }
    }

    /*
      Format 3:
      {
        "1": {
          sura: {
            "1": {
              verses: {
                "1": "Ayet metni"
              }
            }
          }
        }
      }
    */
    if (
      !ayetText &&
      typeof meal === 'object' &&
      !Array.isArray(meal)
    ) {
      for (const pageKey in meal) {
        if (
          !Object.prototype.hasOwnProperty.call(
            meal,
            pageKey
          )
        ) {
          continue;
        }

        const page = meal[pageKey];
        const suraData = page?.sura?.[suraNum];

        if (
          suraData?.verses?.[verseNum] !== undefined
        ) {
          ayetText =
            suraData.verses[verseNum];

          break;
        }
      }
    }

    /*
      Erhan Aktaş formatı:
      {
        surahs: [
          {
            id: 1,
            verses: [
              {
                verse_number: 1,
                verse: "...",
                translation: "..."
              }
            ]
          }
        ]
      }
    */
    if (
      !ayetText &&
      meal.surahs &&
      Array.isArray(meal.surahs)
    ) {
      const sura = meal.surahs.find(
        (item) =>
          item &&
          String(item.id) === String(suraNum)
      );

      if (
        sura &&
        Array.isArray(sura.verses)
      ) {
        const verseObject =
          sura.verses.find(
            (item) =>
              item &&
              String(item.verse_number) ===
                String(verseNum)
          );

        if (verseObject) {
          if (verseObject.translation) {
            erhanTranslation =
              verseObject.translation;
          }

          if (verseObject.verse) {
            erhanArabic =
              verseObject.verse;
          }
        }
      }
    }

    /*
      Normal mealleri tek satırlı düzende oluştur.
    */
    if (
      ayetText &&
      mealName.toLowerCase() !==
        'kuran_erhan_aktas'
    ) {
      const highlightedText =
        highlightMealText(
          ayetText,
          query
        );

      const focusedClass =
        mealName === focusedMealName
          ? 'meal-focused-result'
          : '';

      otherMealsHtml += `
        <div class="meal-row ${focusedClass}">
          <strong class="meal-name">
            ${escapeHtml(mealName)}
          </strong>

          <span class="meal-text">
            ${highlightedText}
          </span>
        </div>
      `;
    }
  }

  /*
    Erhan Aktaş Türkçe çevirisi
  */
  if (erhanTranslation) {
    otherMealsHtml += `
      <div class="meal-row">
        <strong class="meal-name">
          Erhan Aktaş Çeviri
        </strong>

        <span class="meal-text">
          ${highlightMealText(
            erhanTranslation,
            query
          )}
        </span>
      </div>
    `;
  }

  /*
    Erhan Aktaş Arapça metni
  */
  if (erhanArabic) {
    otherMealsHtml += `
      <div class="meal-row meal-row-arabic">
        <strong class="meal-name">
          Erhan Aktaş Arapça
        </strong>

        <span
          class="meal-text erhan-arabic-text"
          dir="rtl"
        >
          ${highlightMealText(
            erhanArabic,
            query
          )}
        </span>
      </div>
    `;
  }

  /*
    Arapça okunuş
  */
  if (pageTransliteration) {
    otherMealsHtml += `
      <div class="meal-row">
        <strong class="meal-name">
          Arapça Okunuş
        </strong>

        <span class="meal-text">
          ${highlightMealText(
            pageTransliteration,
            query
          )}
        </span>
      </div>
    `;
  }

  if (!otherMealsHtml) {
    return `
      <div class="meal-empty">
        Bu ayet için diğer mealler bulunamadı.
      </div>
    `;
  }

  return `
    <div class="meal-list">
      ${otherMealsHtml}
    </div>
  `;
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
  if (!element) return;

  element.classList.toggle('hidden');

  const btn = document.querySelector(`[data-target="${id}"]`);
  if (btn) {
    btn.textContent = element.classList.contains('hidden')
      ? '📌 Dipnot'
      : '📌 Dipnotu Kapat';
  }
}

/* =========================
   Arama
========================= */
/* =========================
   GELİŞMİŞ ARAMA YARDIMCILARI
========================= */

function parseVerseReference(value) {
  const input = String(value || '').trim();

  const match = input.match(
    /^(\d{1,3})\s*[:\/,\-\s]\s*(\d{1,3})$/
  );

  if (!match) {
    return null;
  }

  const suraNum = Number(match[1]);
  const verseNum = Number(match[2]);

  if (
    !Number.isInteger(suraNum) ||
    !Number.isInteger(verseNum) ||
    suraNum < 1 ||
    suraNum > 114 ||
    verseNum < 1
  ) {
    return null;
  }

  const page = getVersePage(
    String(suraNum),
    String(verseNum)
  );

  const exists =
    STATE.data.en?.[page]?.sura?.[String(suraNum)]?.verses?.[
      String(verseNum)
    ] !== undefined;

  if (!exists) {
    return {
      suraNum: String(suraNum),
      verseNum: String(verseNum),
      page,
      exists: false
    };
  }

  return {
    suraNum: String(suraNum),
    verseNum: String(verseNum),
    page,
    exists: true
  };
}

function findExactSura(query) {
  const normalizedQuery =
    normalizeTurkishText(query).trim();

  if (!normalizedQuery) {
    return null;
  }

  for (const suraNum in STATE.metadata.sureNames) {
    const fullName =
      STATE.metadata.sureNames[suraNum];

    const normalizedFullName =
      normalizeTurkishText(fullName).trim();

    const shortName =
      fullName
        .replace(/\([^)]*\)/g, '')
        .trim();

    const normalizedShortName =
      normalizeTurkishText(shortName).trim();

    if (
      normalizedQuery === normalizedFullName ||
      normalizedQuery === normalizedShortName
    ) {
      return {
        type: 'sura',
        suraNum,
        suraName: fullName,
        page:
          STATE.metadata.sureToPageMap[suraNum]
      };
    }
  }

  return null;
}

function getSearchWordSuggestions(
  query,
  limit = 5
) {
  const normalizedQuery =
    normalizeTurkishText(query).trim();

  if (
    !normalizedQuery ||
    normalizedQuery.length < 2 ||
    !SEARCH_INDEX.ready
  ) {
    return [];
  }

  const candidates = new Map();

  for (const item of SEARCH_INDEX.quran) {
    const words =
      String(item.text || '')
        .match(/[\p{L}\p{N}'’-]+/gu) || [];

    for (const word of words) {
      const normalizedWord =
        normalizeTurkishText(word)
          .replace(/[^\p{L}\p{N}]/gu, '')
          .trim();

      if (
        !normalizedWord ||
        normalizedWord.length <=
          normalizedQuery.length ||
        !normalizedWord.startsWith(
          normalizedQuery
        )
      ) {
        continue;
      }

      const current =
        candidates.get(normalizedWord);

      if (current) {
        current.count++;
      } else {
        candidates.set(
          normalizedWord,
          {
            text: word,
            normalized: normalizedWord,
            count: 1
          }
        );
      }
    }
  }

  return Array
    .from(candidates.values())
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return (
        a.normalized.length -
        b.normalized.length
      );
    })
    .slice(0, limit);
}

function highlightSearchResultText(
  text,
  query
) {
  const safeText =
    escapeHtml(text || '');

  const cleanQuery =
    String(query || '').trim();

  if (!cleanQuery) {
    return safeText;
  }

  const regex = new RegExp(
    escapeRegExp(cleanQuery),
    'gi'
  );

  return safeText.replace(
    regex,
    '<mark class="search-panel-highlight">$&</mark>'
  );
}

function getSearchSourceLabel(source) {
  const labels = {
    tr: 'Türkçe',
    en: 'İngilizce',
    translit: 'Okunuş',
    ai: 'AI Çeviri'
  };

  return labels[source] || source || 'Ayet';
}

function groupDetailedSearchResults(results) {
  const groups = new Map();

  results.forEach((result) => {
    const key =
      `${result.suraNum}:${result.verseNum}`;

    if (!groups.has(key)) {
      const verseData = findVerseData(
        String(result.suraNum),
        String(result.verseNum)
      );

      groups.set(key, {
        key,
        suraNum: String(result.suraNum),
        verseNum: String(result.verseNum),
        page: result.page || verseData.page,
        verseData,
        sources: new Set(),
        meals: new Set(),
        score: 0,
        fuzzy: false
      });
    }

    const group = groups.get(key);

    if (result.type === 'meal') {
      group.meals.add(
        result.mealName || 'Meal'
      );
    } else {
      group.sources.add(
        getSearchSourceLabel(result.source)
      );
    }

    group.score = Math.max(
      group.score,
      Number(result.score) || 0
    );

    group.fuzzy =
      group.score < 100;
  });

  return Array
    .from(groups.values())
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const suraDifference =
        Number(a.suraNum) -
        Number(b.suraNum);

      if (suraDifference !== 0) {
        return suraDifference;
      }

      return (
        Number(a.verseNum) -
        Number(b.verseNum)
      );
    });
}

function createSearchPanelShell(query) {
  closeSearchResultsPanel();

  const panel =
    document.createElement('section');

  panel.id = 'searchResultsPanel';
  panel.className =
    'search-results-panel';

  panel.setAttribute(
    'aria-label',
    'Arama sonuçları'
  );

  panel.innerHTML = `
    <header class="search-results-header">
      <div>
        <h2>
          🔎 Arama Sonuçları
        </h2>

        <div class="search-results-query">
          “${escapeHtml(query)}”
        </div>
      </div>

      <button
        type="button"
        class="search-results-close"
        aria-label="Arama sonuçlarını kapat"
        title="Kapat"
      >
        ✕
      </button>
    </header>

    <div
      id="searchResultsPanelBody"
      class="search-results-body"
    >
      <div class="search-panel-loading">
        Arama sonuçları hazırlanıyor...
      </div>
    </div>
  `;

  panel
    .querySelector(
      '.search-results-close'
    )
    ?.addEventListener(
      'click',
      closeSearchResultsPanel
    );

  document.body.appendChild(panel);
  document.body.classList.add(
    'search-results-open'
  );

  return panel;
}

async function openSearchResultsPanel(
  query
) {
  const cleanQuery =
    String(query || '').trim();

  if (!cleanQuery) {
    return;
  }

  const panel =
    createSearchPanelShell(
      cleanQuery
    );

  const body =
    panel.querySelector(
      '#searchResultsPanelBody'
    );

  if (!body) {
    return;
  }

  if (!SEARCH_INDEX.ready) {
    body.innerHTML = `
      <div class="search-panel-empty">
        Arama dizini henüz hazırlanıyor.
        Birkaç saniye sonra tekrar deneyin.
      </div>
    `;

    return;
  }

  /*
    Önce temel Kuran sonuçlarını hazırlar.
  */
  let results =
    searchKeywordInData(
      cleanQuery,
      200
    );

  /*
    Mealler henüz yüklenmediyse panel açıkken yükler.
  */
  if (!areMealsReady()) {
    body.innerHTML = `
      <div class="search-panel-loading">
        Kuran sonuçları bulundu.
        Mealler de aranıyor...
      </div>
    `;

    await loadMeals();

    /*
      Meal dizini hazırlandıktan sonra
      aynı aramayı tekrar yap.
    */
    results =
      searchKeywordInData(
        cleanQuery,
        1000
      );
  }

  const groupedResults =
    groupDetailedSearchResults(
      results
    );

  const wordSuggestions =
    getSearchWordSuggestions(
      cleanQuery,
      5
    );

  if (
    groupedResults.length === 0 &&
    wordSuggestions.length === 0
  ) {
    body.innerHTML = `
      <div class="search-panel-empty">
        <strong>
          “${escapeHtml(cleanQuery)}”
        </strong>
        için sonuç bulunamadı.
      </div>
    `;

    return;
  }

  let suggestionHtml = '';

  if (wordSuggestions.length > 0) {
    suggestionHtml = `
      <div class="search-panel-suggestions">
        <strong>
          Şunlardan birini mi demek istediniz?
        </strong>

        <div class="search-panel-suggestion-list">
          ${wordSuggestions
            .map(
              (suggestion) => `
                <button
                  type="button"
                  class="search-word-suggestion"
                  data-search-word="${escapeHtml(
                    suggestion.text
                  )}"
                >
                  ${escapeHtml(
                    suggestion.text
                  )}
                </button>
              `
            )
            .join('')}
        </div>
      </div>
    `;
  }

const resultCards = groupedResults
  .map((group) => {
    const suraName =
      STATE.metadata.sureNames[group.suraNum] ||
      `Sure ${group.suraNum}`;

    const sources = [
      ...group.sources
    ];

    if (group.meals.size > 0) {
      sources.push(
        `${group.meals.size} meal`
      );
    }

    const sourceText =
      sources.length > 0
        ? sources.join(', ')
        : 'Ayet';

    const scoreClass =
      group.score === 100
        ? 'search-result-exact'
        : '';

    return `
      <article class="search-result-card">
        <div class="search-result-card-header">
          <div>
            <strong class="search-result-reference">
              ${escapeHtml(group.key)}
            </strong>

            <span class="search-result-sura-name">
              ${escapeHtml(suraName)}
            </span>
          </div>

          <span
            class="search-result-fuzzy ${scoreClass}"
          >
            %${group.score} eşleşme
          </span>
        </div>

        <div class="search-result-source">
          Eşleşen alan:
          ${escapeHtml(sourceText)}
        </div>

        ${
          group.verseData.turkish
            ? `
              <div class="search-result-language">
                <strong>TR:</strong>

                <span>
                  ${highlightSearchResultText(
                    group.verseData.turkish,
                    cleanQuery
                  )}
                </span>
              </div>
            `
            : ''
        }

        ${
          group.verseData.english
            ? `
              <div class="search-result-language">
                <strong>EN:</strong>

                <span>
                  ${highlightSearchResultText(
                    group.verseData.english,
                    cleanQuery
                  )}
                </span>
              </div>
            `
            : ''
        }

        <div class="search-result-actions">
          <button
            type="button"
            class="search-result-action"
            data-action="verse"
            data-sura="${escapeHtml(
              group.suraNum
            )}"
            data-verse="${escapeHtml(
              group.verseNum
            )}"
            data-page="${escapeHtml(
              group.page
            )}"
          >
            📖 Ayete Git
          </button>

          <button
            type="button"
            class="search-result-action"
            data-action="meal"
            data-sura="${escapeHtml(
              group.suraNum
            )}"
            data-verse="${escapeHtml(
              group.verseNum
            )}"
            data-page="${escapeHtml(
              group.page
            )}"
          >
            📚 Mealler
          </button>

          <button
            type="button"
            class="search-result-action"
            data-action="analysis"
            data-sura="${escapeHtml(
              group.suraNum
            )}"
            data-verse="${escapeHtml(
              group.verseNum
            )}"
            data-page="${escapeHtml(
              group.page
            )}"
          >
            🔎 Analiz
          </button>
        </div>
      </article>
    `;
  })
      .join('');

  body.innerHTML = `
    ${suggestionHtml}

    <div class="search-results-summary">
      <strong>
        ${groupedResults.length}
      </strong>
      ayet sonucu bulundu.
    </div>

    <div class="search-results-list">
      ${resultCards}
    </div>
  `;

  body
    .querySelectorAll(
      '.search-word-suggestion'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const nextQuery =
            button.dataset.searchWord || '';

          DOM.searchInput.value =
            nextQuery;

          openSearchResultsPanel(
            nextQuery
          );
        }
      );
    });

  body.addEventListener(
    'click',
    (event) => {
      const button =
        event.target.closest(
          '.search-result-action'
        );

      if (!button) {
        return;
      }

      const action =
        button.dataset.action;

      const suraNum =
        button.dataset.sura;

      const verseNum =
        button.dataset.verse;

      const page =
        Number(button.dataset.page) ||
        getVersePage(
          suraNum,
          verseNum
        );

      if (action === 'analysis') {
        closeSearchResultsPanel();

        openAnalysisPanel(
          suraNum,
          verseNum
        );

        return;
      }

      activeSearchQuery =
        cleanQuery;

      pendingHighlight = {
        suraNum,
        verseNum,
        query: cleanQuery,
        openMeal:
          action === 'meal',
        mealName: ''
      };

      closeSearchResultsPanel();

      DOM.searchInput.value = '';
      DOM.autocomplete.innerHTML = '';
      DOM.autocomplete.style.display =
        'none';

      goToPage(page);
    }
  );
}

function closeSearchResultsPanel() {
  document
    .getElementById(
      'searchResultsPanel'
    )
    ?.remove();

  document.body.classList.remove(
    'search-results-open'
  );
}

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

function getSearchMatchScore(query, text) {
  const q = normalizeTurkishText(query)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const t = normalizeTurkishText(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!q || !t) {
    return 0;
  }

  /*
    Metin sorgunun aynısıysa yüzde 100.
  */
  if (t === q) {
    return 100;
  }

  const words = t
    .split(/\s+/)
    .filter(Boolean);

  /*
    Tam kelime eşleşmesi yüzde 100.
    Örnek: "rahman" kelimesi gerçekten geçiyorsa.
  */
  if (words.includes(q)) {
    return 100;
  }

  /*
    Metnin içinde sorgu doğrudan geçiyorsa
    çok güçlü eşleşme kabul edilir.
    Örnek: "lütuf" → "lütufkâr"
  */
  if (t.includes(q)) {
    return 95;
  }

  let bestScore = 0;

  for (const word of words) {
    if (!word) {
      continue;
    }

    /*
      Kelime sorguyla başlıyorsa güçlü eşleşme.
    */
    if (word.startsWith(q)) {
      const lengthDifference =
        word.length - q.length;

      const prefixScore = Math.max(
        85,
        96 - lengthDifference
      );

      bestScore = Math.max(
        bestScore,
        prefixScore
      );

      continue;
    }

    /*
      Sorgu kelimenin içinde geçiyorsa.
    */
    if (word.includes(q)) {
      bestScore = Math.max(
        bestScore,
        92
      );

      continue;
    }

    const maxLength = Math.max(
      q.length,
      word.length
    );

    const distance = levenshtein(
      q,
      word
    );

    const similarity = Math.round(
      (1 - distance / maxLength) * 100
    );

    bestScore = Math.max(
      bestScore,
      similarity
    );
  }

  return Math.max(
    0,
    Math.min(100, bestScore)
  );
}


function searchKeywordInData(
  query,
  maxResults = 16,
  includeMeals = true
) {
  const q = String(query || '').trim();

  if (!q || !SEARCH_INDEX.ready) {
    return [];
  }

  const allResults = [];
  const seen = new Set();

  function addResult({
    type,
    source = '',
    mealName = '',
    page,
    suraNum,
    verseNum,
    text
  }) {
    const score = getSearchMatchScore(
      q,
      text
    );

    /*
      Yüzde 75'in altındaki eşleşmeleri alma.
    */
    if (score < 75) {
      return;
    }

    const key = type === 'meal'
      ? `meal:${mealName}:${suraNum}:${verseNum}`
      : `quran:${source}:${suraNum}:${verseNum}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);

    allResults.push({
      type,
      source,
      mealName,
      page:
        page ||
        getVersePage(
          String(suraNum),
          String(verseNum)
        ),
      suraNum: String(suraNum),
      verseNum: String(verseNum),
      text: String(text || ''),
      snippet: makeSnippet(
        String(text || ''),
        q
      ),
      query: q,
      score,
      fuzzy: score < 100
    });
  }

  /*
    Ana Türkçe, İngilizce, okunuş
    ve AI çeviri sonuçları.
  */
  for (const item of SEARCH_INDEX.quran) {
    addResult({
      type: 'quran',
      source: item.source,
      page: item.page,
      suraNum: item.suraNum,
      verseNum: item.verseNum,
      text: item.text
    });
  }

  /*
    Mealler yüklenmişse onları da ekle.
  */
  if (
  includeMeals &&
  areMealsReady()
) {
  for (const item of SEARCH_INDEX.meals) {
      addResult({
        type: 'meal',
        mealName: item.mealName,
        page: item.page,
        suraNum: item.suraNum,
        verseNum: item.verseNum,
        text: item.text
      });
    }
  }

  /*
    Önce eşleşme yüzdesine göre sırala.
    Eşitlikte sure ve ayet sırasını kullan.
  */
  allResults.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    const suraDifference =
      Number(a.suraNum) -
      Number(b.suraNum);

    if (suraDifference !== 0) {
      return suraDifference;
    }

    return (
      Number(a.verseNum) -
      Number(b.verseNum)
    );
  });

  return allResults.slice(
    0,
    maxResults
  );
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
  const searchInput =
    DOM.searchInput;

  const autocomplete =
    DOM.autocomplete;

  if (
    !searchInput ||
    !autocomplete
  ) {
    return;
  }

  let debounceTimer = null;

  const DEBOUNCE_MS = 250;

  function hideAutocomplete() {
    autocomplete.innerHTML = '';
    autocomplete.style.display =
      'none';
  }

  function addAutocompleteItem({
    html,
    className = '',
    onClick
  }) {
    const item =
      document.createElement('div');

    if (className) {
      item.className = className;
    }

    item.innerHTML = html;

    if (typeof onClick === 'function') {
      item.addEventListener(
        'click',
        onClick
      );
    }

    autocomplete.appendChild(item);

    return item;
  }

  async function runSearch(rawValue) {
    const value =
      String(rawValue || '').trim();

    autocomplete.innerHTML = '';

    if (!value) {
      hideAutocomplete();
      return;
    }

    if (!SEARCH_INDEX.ready) {
      addAutocompleteItem({
        html:
          '⏳ Arama hazırlanıyor...'
      });

      autocomplete.style.display =
        'block';

      return;
    }

    let itemCount = 0;

    /*
      17:36, 17 36, 17/36, 17-36
      yazılırken yalnızca öneri gösterilir.
      Enter olmadan otomatik gidilmez.
    */
    const verseReference =
      parseVerseReference(value);

    if (verseReference) {
      if (verseReference.exists) {
        const verseData =
          findVerseData(
            verseReference.suraNum,
            verseReference.verseNum
          );

        addAutocompleteItem({
          className:
            'autocomplete-verse-reference',

          html: `
            <strong>
              📖 ${escapeHtml(
                verseReference.suraNum
              )}:${escapeHtml(
                verseReference.verseNum
              )} ayetine git
            </strong>

            <br>

            <small>
              ${escapeHtml(
                String(
                  verseData.turkish || ''
                ).slice(0, 130)
              )}
            </small>
          `,

          onClick: () => {
            activeSearchQuery = '';

            pendingHighlight = {
              suraNum:
                verseReference.suraNum,
              verseNum:
                verseReference.verseNum,
              query: '',
              openMeal: false,
              mealName: ''
            };

            searchInput.value = '';

            hideAutocomplete();

            goToPage(
              verseReference.page
            );
          }
        });
      } else {
        addAutocompleteItem({
          className:
            'autocomplete-warning',

          html: `
            ⚠️
            ${escapeHtml(
              verseReference.suraNum
            )}:${escapeHtml(
              verseReference.verseNum
            )}
            ayeti bulunamadı.
          `
        });
      }

      itemCount++;
    }

    /*
      Sure adları
    */
    const normalizedValue =
      normalizeTurkishText(value);

    const suraSuggestions = [];

    for (
      const suraNum in
      STATE.metadata.sureNames
    ) {
      const suraName =
        STATE.metadata.sureNames[
          suraNum
        ];

      const normalizedSuraName =
        normalizeTurkishText(
          suraName
        );

      if (
        !normalizedSuraName.includes(
          normalizedValue
        )
      ) {
        continue;
      }

      suraSuggestions.push({
        type: 'sura',
        suraNum,
        suraName,
        page:
          STATE.metadata
            .sureToPageMap[suraNum],
        priority:
          normalizedSuraName.startsWith(
            normalizedValue
          )
            ? 0
            : 1
      });
    }

    suraSuggestions
      .sort(
        (a, b) =>
          a.priority -
          b.priority
      )
      .slice(0, 4)
      .forEach((suggestion) => {
        addAutocompleteItem({
          html: `
            <strong>
              ${escapeHtml(
                suggestion.suraNum
              )}:
            </strong>

            ${escapeHtml(
              suggestion.suraName
            )}
          `,

          onClick: () => {
            searchInput.value = '';
            hideAutocomplete();

            goToSura(
              suggestion.suraNum
            );
          }
        });

        itemCount++;
      });

    /*
      Lütuf → Lütufkâr gibi
      kelime tamamlama önerileri.
    */
    const wordSuggestions =
      getSearchWordSuggestions(
        value,
        4
      );

    wordSuggestions.forEach(
      (suggestion) => {
        addAutocompleteItem({
          className:
            'autocomplete-word-suggestion',

          html: `
            <span>
              “<strong>
                ${escapeHtml(value)}
              </strong>”
              yerine
            </span>

            <strong>
              ${escapeHtml(
                suggestion.text
              )}
            </strong>
            mı demek istediniz?
          `,

          onClick: () => {
            searchInput.value =
              suggestion.text;

            searchInput.focus();

            runSearch(
              suggestion.text
            );
          }
        });

        itemCount++;
      }
    );

    /*
      Yazarken yalnızca birkaç hızlı
      ayet sonucu gösterilir.
    */
    const quickResults =
      value.length < 3
       ? []
       : searchKeywordInData(
        value,
        6,
        false
      );

    quickResults.forEach(
      (result) => {
        let html = '';

        if (result.type === 'meal') {
          html = `
            <strong>
              ${escapeHtml(
                result.mealName
              )}
            </strong>

            ${escapeHtml(
              result.suraNum
            )}:${escapeHtml(
              result.verseNum
            )}

            ${
              result.fuzzy
                ? `
                  <em class="autocomplete-fuzzy">
                    yaklaşık eşleşme
                  </em>
                `
                : ''
            }

            <br>

            ${result.snippet}
          `;
        } else {
          html = `
            <strong>
              ${escapeHtml(
                result.suraNum
              )}:${escapeHtml(
                result.verseNum
              )}
            </strong>

            <span>
              (${escapeHtml(
                getSearchSourceLabel(
                  result.source
                )
              )})
            </span>

            ${
              result.fuzzy
                ? `
                  <em class="autocomplete-fuzzy">
                    yaklaşık eşleşme
                  </em>
                `
                : ''
            }

            <br>

            ${result.snippet}
          `;
        }

        addAutocompleteItem({
          html,

          onClick: () => {
            navigateToSearchResult(
              result,
              searchInput
            );
          }
        });

        itemCount++;
      }
    );

    /*
      Büyük sonuç panelini açan satır.
    */
    addAutocompleteItem({
      className:
        'autocomplete-all-results',

      html: `
        <strong>
          🔎 “${escapeHtml(value)}”
          için tüm sonuçları göster
        </strong>

        <br>

        <small>
          Enter tuşuna da basabilirsiniz.
        </small>
      `,

      onClick: () => {
        hideAutocomplete();

        openSearchResultsPanel(
          value
        );
      }
    });

    itemCount++;

    autocomplete.style.display =
      itemCount > 0
        ? 'block'
        : 'none';
  }

  searchInput.addEventListener(
    'input',
    (event) => {
      const value =
        event.target.value.trim();

      clearTimeout(
        debounceTimer
      );

      if (!value) {
        hideAutocomplete();
        return;
      }

      /*
        Enter olmadan yalnızca öneri üretir.
        Ayete otomatik gitmez.
      */
      debounceTimer =
        setTimeout(
          () => {
            runSearch(value);
          },
          DEBOUNCE_MS
        );
    }
  );

  searchInput.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();

      const value =
        searchInput.value.trim();

      if (!value) {
        return;
      }

      /*
        17:36, 17 36, 17/36, 17-36
        Enter ile doğrudan ayete gider.
      */
      const verseReference =
        parseVerseReference(value);

      if (verseReference) {
        if (!verseReference.exists) {
          showNotification(
            `${verseReference.suraNum}:${verseReference.verseNum} ayeti bulunamadı.`,
            'warning'
          );

          return;
        }

        activeSearchQuery = '';

        pendingHighlight = {
          suraNum:
            verseReference.suraNum,
          verseNum:
            verseReference.verseNum,
          query: '',
          openMeal: false,
          mealName: ''
        };

        searchInput.value = '';

        hideAutocomplete();

        goToPage(
          verseReference.page
        );

        return;
      }

      /*
        Tam sure adı yazılmışsa
        doğrudan sureye gider.
        Örnek: Bakara + Enter
      */
      const exactSura =
        findExactSura(value);

      if (exactSura) {
        searchInput.value = '';

        hideAutocomplete();

        goToSura(
          exactSura.suraNum
        );

        return;
      }

      /*
        Kelime araması Enter ile
        artık ilk sonuca gitmez.
        Büyük sonuç panelini açar.
      */
      hideAutocomplete();

      openSearchResultsPanel(
        value
      );
    }
  );

  searchInput.addEventListener(
    'blur',
    () => {
      setTimeout(
        () => {
          autocomplete.style.display =
            'none';
        },
        200
      );
    }
  );

  searchInput.addEventListener(
    'focus',
    () => {
      const value =
        searchInput.value.trim();

      if (value) {
        runSearch(value);
      }
    }
  );
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
          <h2>Yerel Not Sistemi</h2>

          <div class="drive-status">
            <p>
              <strong>Durum:</strong>
              🟢 Yerel kayıt aktif
            </p>

            <p>
              Notlarınız bu tarayıcıda ve bu cihazda saklanır.
            </p>

            <p>
              Tarayıcı verilerini silmeden önce notlarınızı
              JSON dosyası olarak yedeklemeniz önerilir.
            </p>
          </div>
        </div>

      <div class="settings-section">
        <h2>Yazılım Hakkında</h2>
        <div class="about-section">
<ul>
  <li>
    <strong>Kodlama, Tasarım:</strong><br>
    Berk KÖKSAL<br>
    <a href="https://www.berkkoksal.com" target="_blank" rel="noopener noreferrer">
      www.berkkoksal.com
    </a>
  </li>
        <li><strong>Arama:</strong> (örn: "2:255") 2 255 veya 2/255 yazabilirsiniz.</li>
            <li><strong>Yerel Notlar:</strong> Notlarınız otomatik olarak kullandığınız tarayıcıda saklanır.</li>
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
        <p>
          Notlarınız bu tarayıcıda,
          cihazınızda saklanmaktadır.
        </p>

        <div
          class="note-actions"
          style="
            display:flex;
            gap:10px;
            flex-wrap:wrap;
            margin-bottom:20px;
          "
        >
          <button
            class="toggle-btn"
            onclick="exportLocalNotes()"
          >
            💾 Notları Yedekle
          </button>

          <button
            class="toggle-btn"
            onclick="openNotesImportDialog()"
          >
            📂 Not Dosyası Yükle
          </button>

          <button
            id="toggleNotesVisibilityBtn"
            class="toggle-btn"
            type="button"
            onclick="toggleNotesVisibility()"
            aria-expanded="true"
            aria-controls="notesList"
          >
            🙈 Notları Gizle
          </button>
        </div>

        <div
          id="notesList"
          class="notes-list"
        >
          Notlar yükleniyor...
        </div>

        <button
          class="toggle-btn"
          onclick="goToPage(${STATE.currentPage})"
        >
          🔙 Kuran'a Dön
        </button>
      </div>
    </div>
  `;

  loadAndDisplayAllNotes();
}

function toggleNotesVisibility() {
  const notesList =
    document.getElementById('notesList');

  const button =
    document.getElementById(
      'toggleNotesVisibilityBtn'
    );

  if (!notesList || !button) return;

  const willHide =
    !notesList.classList.contains('hidden');

  notesList.classList.toggle(
    'hidden',
    willHide
  );

  button.textContent = willHide
    ? '👁️ Notları Göster'
    : '🙈 Notları Gizle';

  button.setAttribute(
    'aria-expanded',
    String(!willHide)
  );
}

const GUIDE_CONTENT = `
    <h1>Kuran Teyit Yazılımı: Tanıtım ve Kullanım Kılavuzu</h1>
    
    <h2>Tanıtım: Kuran Teyit Yazılımı Nedir?</h2>
    <p>[1:1] En Lütufkâr, En Merhametli TANRI’nın adıyla.</p>
    <p>Bu, Tanrı’nın insanlığa son mesajıdır. Tanrı’nın tüm peygamberleri bu dünyaya geldi ve tüm kutsal yazılar iletildi. Tanrı’nın peygamberleri tarafından iletilen tüm mesajların arındırılıp tek bir mesajda birleştirilmesinin ve bundan böyle Tanrı’nın kabul ettiği tek dinin “Teslimiyet” (3:19, 3:85) olduğunun duyurulmasının zamanı geldi. “Teslimiyet,” Tanrı’nın mutlak otoritesini tanıdığımız ve tüm güce sahip olanın YALNIZCA Tanrı olduğuna; O’ndan bağımsız başka hiçbir varlığın herhangi bir güce sahip olmadığına dair sarsılmaz bir kanaate ulaştığımız dindir. Böyle bir farkındalığın doğal sonucu, yaşamlarımızı ve tapınmamızı mutlak bir şekilde YALNIZCA Tanrı’ya adamaktır. Bu, Eski Ahit, Yeni Ahit ve bu Son Ahit de dâhil olmak üzere tüm kutsal yazılardaki İlk Buyruktur.</p>
    <p>
Kuran Teyit Yazılımı, Tanrı’nın antlaşma elçisi Reşat Halife’nin
Yetkilendirilmiş İngilizce Çevirisi üzerine geliştirilmiş modern bir
web uygulamasıdır. Kuran'ı Arapça, Türkçe ve İngilizce metinlerle
inceleme, farklı mealleri karşılaştırma, ayet analizi, not alma ve
kelime yardımı gibi özellikler sunar. Kişisel notlar kullanıcının
kendi tarayıcısında yerel olarak saklanır ve JSON dosyası olarak
yedeklenebilir.
</p>
    <p>Uygulama, [17:36] ayetinden ilhamla, "Kendiniz için teyit etmediğiniz sürece hiçbir bilgiyi kabul etmeyin" mesajıyla eleştirel düşünmeyi teşvik eder. Tema seçenekleri ve özelleştirilebilir arayüzü ile her cihazda kolayca kullanılabilir. Yetkilendirilmiş Çeviri’nin teyide ihtiyacı olmadığını vurgulayarak, İngilizce bilmeyen kullanıcıların Authorized English Translation'ı daha rahat inceleyebilmesini amaçlar.</p>

<h2>📖 Temel Referans ve Çalışma Yaklaşımı</h2>

<p><strong>Kuran Teyit Yazılımı</strong>, temel referans olarak <strong>Rashad Khalifa'nın Authorized English Translation (Yetkilendirilmiş İngilizce Çevirisi)</strong> üzerine geliştirilmiştir.</p>

<p>Bu uygulamanın çalışma yöntemi, Yetkilendirilmiş Çeviri'yi esas alır. Analizler, dipnotlar, referans bağlantıları ve diğer araştırma araçları bu temel referans doğrultusunda hazırlanmıştır.</p>

<p>Türkçe mealler, Arapça metinler, Arapça okunuşlar ve diğer yardımcı kaynaklar; Yetkilendirilmiş Çeviri'yi değiştirmek veya doğrulamak amacıyla değil, ayetlerin daha kapsamlı incelenebilmesi, kavramların karşılaştırılabilmesi ve araştırmanın derinleştirilebilmesi amacıyla sunulmaktadır.</p>

<p>Bu nedenle uygulama aşağıdaki öncelik sırasını benimser:</p>

<ol>
    <li><strong>Authorized English Translation (Ana Referans)</strong></li>
    <li><strong>Rashad Khalifa'nın dipnotları</strong></li>
    <li><strong>Arapça metin ve Arapça okunuş</strong></li>
    <li><strong>Türkçe çeviriler ve diğer mealler</strong></li>
    <li><strong>Karşılaştırmalı analiz araçları</strong></li>
    <li><strong>Kullanıcı notları ve kişisel araştırmalar</strong></li>
</ol>

<p>Bu yazılımın amacı herhangi bir meali veya yorumu mutlak doğru ilan etmek değildir. Amacı; Kuran ayetlerini, farklı kaynakları ve yardımcı araçları bir araya getirerek kullanıcının bilinçli bir araştırma yapmasına ve kendi değerlendirmesine ulaşmasına katkı sağlamaktır.</p>

<p>Bu yaklaşımın ilham kaynağı Kuran'ın şu uyarısıdır:</p>

<blockquote>
<strong>[17:36]</strong><br>
"Kendin için teyit etmediğin sürece, hiçbir bilgiyi kabul etme. Ben sana işitmeyi, görmeyi ve beyni verdim ve sen onları kullanmaktan sorumlusun."
</blockquote>

<h2>🙏 Teşekkür ve Veri Kaynakları</h2>

<p>
Bu yazılım geliştirilirken birçok açık kaynak çalışmadan yararlanılmıştır.
Bu nedenle emeği geçen herkese teşekkür etmeyi bir borç bilirim.
</p>

<p>
Özellikle uygulamanın temel veri yapısının hazırlanmasında ve Kuran metinlerinin
düzenlenmesinde <strong>QuranTFT (Authorized English Translation)</strong> projesinden
yararlanılmıştır.
</p>

<p>
İngilizce çeviri, Rashad Khalifa'nın
<strong>Authorized English Translation</strong> çalışmasını temel alan
<strong>QuranTFT</strong> projesinden alınmıştır.
Uygulamadaki dipnotlar, sayfa yapısı ve birçok veri de yine bu açık kaynak proje
sayesinde kullanılabilmektedir.
</p>

<p>
Türkçe çeviri (İngilizce çevirinin altında gösterilen ana Türkçe meal)
de yine <strong>QuranTFT</strong> projesinin sunduğu açık veri dosyalarından
yararlanılarak hazırlanmıştır.
</p>

<p>
Bu vesileyle <strong>QuranTFT</strong> geliştiricilerine emekleri ve açık kaynak
yaklaşımları için teşekkür ederiz.
</p>

<p>
QuranTFT projesini incelemek ve doğrudan Kuran okumak isteyen kullanıcılar için
resmî web sitesi:
</p>

<p style="text-align:center;">
  <a href="https://qurantft.com/" target="_blank" rel="noopener noreferrer">
    https://qurantft.com/
  </a>
  <br>
  <a href="https://kuransonahit.tr/" target="_blank" rel="noopener noreferrer">
    https://kuransonahit.tr/
  </a>
</p>

<p>
Özellikle sadece Kuran okumak isteyen kullanıcılar için
<strong>QuranTFT web sitesi</strong> daha sade ve bu amaç için hazırlanmış
kapsamlı bir okuma deneyimi sunmaktadır. Bu nedenle uygulamanın üst menüsünde yer alan
<strong>"Kuran Oku"</strong> bölümü de doğrudan QuranTFT web sitesini açmaktadır.
</p>

<p>
QuranTFT'nin hem <strong>Android</strong> hem de
<strong>iOS</strong> mobil uygulamaları bulunmaktadır.
</p>

<p style="text-align:center;">
<a href="https://play.google.com/store/apps/details?id=com.submittertech.quran&hl=tr"
target="_blank" rel="noopener noreferrer">
📱 Google Play - Kuran Son Ahit
</a>

<br><br>

<a href="https://apps.apple.com/tr/app/kuran-son-ahit/id6478772891?l=tr"
target="_blank" rel="noopener noreferrer">
🍎 App Store - Kuran Son Ahit
</a>
</p>

<p>
Bu uygulama ise QuranTFT'nin yerine geçmeyi amaçlamaz.
Tam tersine, onun üzerine araştırma odaklı ek araçlar geliştirmeyi hedefleyen
bağımsız bir çalışmadır.
</p>

<p>
Arapça kelime karşılıkları, kelime kökleri ve bazı sözlük çalışmalarının hazırlanmasında
<strong>Açık Kuran</strong> projesinden de yararlanılmıştır.
Bu değerli çalışmayı hazırlayan geliştiricilere ve katkı sağlayan herkese teşekkür ederiz.
</p>

<p style="text-align:center;">
<a href="https://acikkuran.com/" target="_blank" rel="noopener noreferrer">
https://acikkuran.com/
</a>
</p>

<p>
Açık Kuran projesi özellikle Arapça kelimelerin anlamlarını, kök yapılarını ve ayet içerisindeki kullanımlarını incelemek isteyen araştırmacılar için oldukça değerli bir kaynaktır.
Bu yazılımda kullanılan kelime çevirileri hazırlanırken bu açık kaynaktan da
yararlanılmıştır.
</p>

<ul>
<li>📖 Authorized English Translation temel alınmıştır.</li>
<li>🇹🇷 Ana Türkçe çeviri QuranTFT veri dosyalarından alınmıştır.</li>
<li>📚 Rashad Khalifa dipnotları kullanılmaktadır.</li>
<li>📝 Sayfa yapısı ve referans sistemi QuranTFT veri yapısından yararlanmaktadır.</li>
<li>
🔍 Bu yazılıma ek olarak analiz ekranları, kelime çevirileri,
karşılaştırmalı mealler, yerel not ve JSON yedekleme sistemi,
konu haritaları (MAP) ve birçok yeni özellik tarafımızdan geliştirilmiştir.
</li>
</ul>

<p>
Bu çalışma tamamen açık kaynak çalışmaların üzerine geliştirilmiş bağımsız bir
araştırma yazılımıdır ve emeği geçen tüm geliştiricilere teşekkür ederiz.
</p>

<p><strong>Kuran Teyit Yazılımı</strong>, kullanıcı adına karar veren bir uygulama değildir. Araştırmayı kolaylaştıran, karşılaştırmayı mümkün kılan ve Kuran merkezli incelemeyi destekleyen bir çalışma ortamı sunmayı amaçlamaktadır.</p>

    <h2>Kullanım Kılavuzu</h2>

    <h3>1. Genel Yapı ve Navigasyon</h3>
    <ul>
        <li><strong>Menü Butonu (☰):</strong> Sure listesi, notlar ve ayarlara ulaşmanızı sağlar.</li>
        <li><strong>Önceki/Sonraki Sayfa:</strong> Kuran sayfaları arasında geçiş yapar.</li>
        <li><strong>Arama Alanı:</strong> Sure, ayet veya kelime aramak için kullanılır.</li>
        <li>
  <strong>Kuran Oku:</strong>
  QuranTFT Kuran okuma sayfasını yeni sekmede açar.
</li>
    </ul>

    <h3>2. Arapça Karşılaştırma Alanı</h3>
    <p>Her ayetin sağ üstünde <strong>📖 Arapça</strong> bağlantısı bulunur. Bu bağlantıya tıklayınca ayetin üç farklı Arapça metni açılır.</p>
    <ul>
        <li><strong>Standart Arapça - qurantft.json:</strong> Ana Arapça kaynak.</li>
        <li><strong>İkinci Arapça - quran_arapca2.json:</strong> Eklenen ikinci Arapça veri dosyası.</li>
        <li><strong>Erhan Aktaş Arapçası - kuran_erhan_aktas.json:</strong> Erhan Aktaş veri dosyasındaki Arapça metin.</li>
    </ul>
    <p>Bu alan özellikle ayet kayması, eksik kelime, fazla kelime veya farklı Arapça yazım kontrolü için kullanışlıdır. İleride bu bölüme kelime farklarını renkli gösterme özelliği eklenebilir.</p>
<p>Ayrıca açılan bölümde her Arapça kelimenin Türkçe anlamı, okunuşu ve kök bilgisi de görüntülenebilir.</p>

    <h3>3. Arama Alanının Kullanımı</h3>
    <p>Arama çubuğuna sure adı, ayet numarası veya kelime yazabilirsiniz.</p>
    <ul>
        <li><code>2:255</code> → Bakara 255. ayete gider.</li>
        <li><code>2/255</code> → Aynı şekilde çalışır.</li>
        <li><code>2 255</code> → Boşluklu format da desteklenir.</li>
        <li><code>Bakara</code>, <code>Fatiha</code>, <code>Yasin</code> gibi sure isimleriyle arama yapılabilir.</li>
    </ul>

    <h3>4. Kuran Okuma ve Çeviriler</h3>
    <ul>
        <li>Ayet numarası ortada gösterilir.</li>
        <li>📖 Arapça alanı açılır/kapanır yapıdadır; kapalıyken sayfayı kalabalıklaştırmaz.</li>
        <li>Okunuş satırı açıksa Arapça-Türkçe okunuş gösterilir.</li>
<li>
İngilizce çeviri, Rashad Khalifa'nın Authorized English Translation
(QuranTFT) çalışmasıdır ve uygulamanın temel referansıdır.
</li>

<li>
İngilizce metnin altında gösterilen ana Türkçe çeviri de
QuranTFT projesinin açık veri dosyalarından alınmıştır.
</li>

<li>
Daha sade ve doğrudan Kuran okumak isteyen kullanıcılar için
QuranTFT web sitesi ve resmi mobil uygulamaları tavsiye edilir.
</li>
    </ul>

    <h3>5. Mealler</h3>
    <ul>
        <li>Ayarlar bölümünden <strong>Mealler’i Göster</strong> seçeneği açılırsa her ayette <strong>📚 Mealler</strong> butonu görünür.</li>
        <li>Butona tıklayınca farklı çevirmenlerin mealleri aynı ayet altında listelenir.</li>
        <li>Mealler ilk ihtiyaç olduğunda yüklenir; bu sayede uygulama ilk açılışta daha hızlı çalışır.</li>
    </ul>

<h3>6. Ayet Analizi</h3>

<p>Her ayetin altında bulunan <strong>🔎 Analiz</strong> butonu ile o ayete ait kapsamlı analiz ekranı açılır.</p>

<ul>
    <li>Seçilen ayetin Arapçası, Türkçe ve İngilizce çevirisi birlikte gösterilir.</li>

    <li>MAP dosyalarındaki ilgili konu başlıkları otomatik listelenir.</li>

    <li>Konu başlıkları, uygulamada kullanılan MAP (Konu Haritaları) veri dosyalarından otomatik olarak oluşturulmaktadır.</li>

    <li>Her konu altında o konuyla ilişkili ayetlerin Türkçe mealleri görüntülenir.</li>

    <li>Konuyla bağlantılı referans ayetler Arapça, Türkçe ve İngilizce olarak ayrı bölümde gösterilir.</li>

    <li>Mobil cihazlarda analiz ekranı tam ekran açılır ve kapatma butonu ekranın üst kısmında sabit kalır.</li>

    <li>Panel kapatıldığında normal okuma ekranına geri dönülür.</li>
</ul>

<h3>7. Yerel Not Alma ve Yedekleme</h3>

<ul>
  <li>
    <strong>✍️ Not Al</strong> butonuyla ayete özel not
    yazabilirsiniz.
  </li>

  <li>
    Notlarınız kullandığınız tarayıcıda ve cihazda yerel olarak
    saklanır.
  </li>

  <li>
    <strong>📝 Notlarım</strong> sayfasında notlar sure ve ayet
    numarasına göre sıralanır.
  </li>

  <li>
    Uzun notlar ilk aşamada üç satır gösterilir. Notun üzerine veya
    <strong>Devamını göster</strong> düğmesine tıklanınca tamamı açılır.
  </li>

  <li>
    <strong>💾 Notları Yedekle</strong> düğmesiyle bütün notlar
    JSON dosyası olarak indirilebilir.
  </li>

  <li>
    <strong>📂 Not Dosyası Yükle</strong> düğmesiyle daha önce
    alınan yedek geri yüklenebilir.
  </li>
</ul>

    <h3>8. Kelime Yardımı</h3>

<ul>
<li>İngilizce çeviri üzerindeki kelimelerin üzerine gelerek Türkçe anlamlarını görebilirsiniz.</li>

<li>Mobil cihazlarda kelimeye dokunarak aynı bilgi açılır.</li>

<li>📖 Arapça bölümünü açtığınızda ise her Arapça kelimenin okunuşu, Türkçe anlamı ve kök bilgisi tablo halinde gösterilir.</li>
</ul>

    <h3>9. Ayarlar</h3>
    <ul>
        <li><strong>Tema:</strong> Açık, koyu, yeşil, mavi ve diğer tema seçenekleri kullanılabilir.</li>
        <li><strong>Yazı Boyutu:</strong> Küçük, orta veya büyük yazı boyutu seçilebilir.</li>
        <li><strong>Mealler’i Göster:</strong> Meal butonlarını açar/kapatır.</li>
        <li><strong>Arapça-Türkçe Göster:</strong> Okunuş satırını açar/kapatır.</li>
        <li><strong>AI Çeviriyi Göster:</strong> Yapay zeka çevirisi varsa gösterir.</li>
    </ul>

    <h3>10. Performans ve Kod İyileştirmeleri</h3>
    <ul>
        <li>Sayfalar önbelleğe alınarak daha hızlı geçiş sağlanır.</li>
        <li>Mealler ihtiyaç oldukça yüklenir.</li>
        <li>Arama indexi uygulama açıldıktan sonra hazırlanır.</li>
        <li>Üç Arapça veri kaynağı ayrı ayrı yüklenir ve aynı ayet altında karşılaştırmalı gösterilir.</li>
        <li>Arapça alanı kapalı geldiği için sayfa daha sade ve hızlı okunabilir hale getirilmiştir.</li>
        <li>Kelime çevirileri ilk ihtiyaç duyulduğunda yüklenir. Böylece uygulamanın açılış hızı korunur.</li>
    </ul>

    <h3>11. Gelecek Geliştirme Fikirleri</h3>
    <ul>
        <li>Yapay Zeka ile Referans Ayetleri listeleyen yeni bir ekran.</li>
        <li>Yapay zeka destekli bağlantılı kelime arama özelliği</li>
        <li>Üç Arapça metin arasındaki kelime farklarını renkli vurgulama.</li>
        <li>Ayet bazında “Arapça kaynaklarda fark var” uyarısı.</li>
        <li>Sadece farklı kelimeleri gösterme modu.</li>
        <li>Arapça karşılaştırma raporu oluşturma.</li>
        <li>Kullanım kılavuzunu ileride ayrı bir <code>guide.html</code> veya <code>guide.md</code> dosyasına taşıma.</li>
    </ul>

    <h3>12. Sıkça Sorulan Sorular</h3>
    <ul>
        <li><strong>Mealler butonunu göremiyorum, neden?</strong> Ayarlar bölümünden “Mealler’i Göster” seçeneğini açmalısınız.</li>
        <li><strong>Arapça metinler neden kapalı geliyor?</strong> Sayfanın sade kalması için Arapça karşılaştırma alanı açılır/kapanır yapıdadır.</li>
        <li><strong>Üç Arapça metin ne işe yarar?</strong> Aynı ayetin farklı veri kaynaklarındaki Arapça karşılıklarını kontrol etmeye yarar.</li>
        <li>
  <strong>Notlarım neden görünmüyor?</strong>
  Aynı tarayıcıyı ve aynı site adresini kullandığınızdan emin olun.
  Tarayıcı verileri silindiyse daha önce indirdiğiniz JSON not
  dosyasını yeniden yükleyin.
</li>
        <li><strong>Tema değişiklikleri kalıcı mı?</strong> Evet, ayarlar tarayıcıda saklanır.</li>
    </ul>

<h2>🙏 SubmitterTech'e Teşekkür</h2>

<p>
Kuran Teyit Yazılımı'nın geliştirilmesi sırasında faydalanılan Kuran araştırma
uygulamaları, dijital kaynaklar ve teknik çalışmalar için
<strong>SubmitterTech</strong> ekibine teşekkür ederiz.
</p>

<p>
SubmitterTech tarafından geliştirilen uygulamalar; Kuran ayetlerinin okunması,
dinlenmesi, araştırılması, karşılaştırılması ve matematiksel çalışmaların
incelenmesi konusunda önemli araçlar sunmaktadır.
</p>

<h3>🌐 SubmitterTech Kaynakları</h3>

<ul>

<li>
<a href="https://submittertech.com/" target="_blank" rel="noopener noreferrer">
SubmitterTech Ana Sayfası
</a>
</li>

<li>
<a href="https://qurantft.com/" target="_blank" rel="noopener noreferrer">
QuranTFT (Web Uygulaması)
</a>
</li>

<li>
<a href="https://play.google.com/store/apps/details?id=com.submittertech.quran&hl=tr" target="_blank" rel="noopener noreferrer">
QuranTFT Android Uygulaması (Kuran Son Ahit)
</a>
</li>

<li>
<a href="https://apps.apple.com/tr/app/kuran-son-ahit/id6478772891?l=tr" target="_blank" rel="noopener noreferrer">
QuranTFT iOS Uygulaması (Kuran Son Ahit)
</a>
</li>

<li>
<a href="https://play.google.com/store/apps/details?id=com.submittertech.quranreciter" target="_blank" rel="noopener noreferrer">
Quran Reciter Android
</a>
</li>

<li>
<a href="https://apps.apple.com/us/app/quran-reciter-reader/id6766167438" target="_blank" rel="noopener noreferrer">
Quran Reciter iOS
</a>
</li>

<li>
<a href="https://submittertech.github.io/miracleofquran/" target="_blank" rel="noopener noreferrer">
Evidence Of Quran
</a>
</li>

<li>
<a href="https://submittertech.github.io/subtitle-searcher-en/" target="_blank" rel="noopener noreferrer">
Media Search (Reşad Halife ses kayıtlarında arama)
</a>
</li>

</ul>

<p>
Kuran araştırmalarına katkı sağlayan bu değerli uygulamaları ve kaynakları
hazırlayan SubmitterTech ekibine teşekkür ederiz.
</p>

<h2>📚 Diğer Kaynaklar</h2>

<ul>

<li>
<a href="https://kuransonahit.tr/" target="_blank" rel="noopener noreferrer">
Kuran Son Ahit
</a>
</li>

<li>
<a href="https://acikkuran.com/" target="_blank" rel="noopener noreferrer">
Açık Kuran
</a>
— Arapça kelime çalışmaları ve sözlük verileri
</li>

<li>
Authorized English Translation — Rashad Khalifa
</li>

<li>
OpenAI — Yapay zekâ destekli geliştirme sürecinde kullanılan araçlardan biri.
</li>

</ul>

    <h2>Son Söz</h2>

<p>
Kuran Teyit Yazılımı; Kuran ayetlerini okumak, karşılaştırmak, araştırmak ve teyit etmek amacıyla geliştirilmiş kapsamlı bir araştırma platformudur. Uygulama, Rashad Khalifa'nın Yetkilendirilmiş İngilizce Çevirisi'ni temel referans kabul ederken; Arapça metinler, Türkçe mealler, dipnotlar ve karşılaştırmalı analiz araçlarıyla kullanıcıya çok yönlü bir çalışma ortamı sunmaktadır.
</p>

<p>
Uygulama içerisinde; ayet analizi, konu haritaları (MAP), referans
ayetler, çoklu meal karşılaştırması, üç farklı Arapça metnin eş
zamanlı incelenmesi, Arapça okunuş, ayetlerin sesli dinlenebilmesi,
İngilizce kelime yardım sistemi, yerel kişisel not alma ve JSON
yedekleme gibi birçok araştırma aracı bulunmaktadır.
</p>

<p>
Geliştirme süreci devam etmektedir. Yeni analiz araçları, yapay zekâ destekli araştırma özellikleri, gelişmiş karşılaştırma sistemleri ve Kuran merkezli yeni çalışma modülleri ilerleyen sürümlerde uygulamaya eklenmeye devam edecektir.
</p>

<p>
Bu proje, kullanıcı adına hüküm vermeyi değil; Kuran'ı doğrudan inceleyebileceğiniz, delilleri karşılaştırabileceğiniz ve kendi araştırmanızı özgürce yapabileceğiniz tarafsız bir çalışma ortamı oluşturmayı amaçlamaktadır.
</p>

<hr>
<p><strong>Geliştirme, Tasarım ve Kodlama:</strong><br>
Berk KÖKSAL</p>

<p>
<a href="https://www.berkkoksal.com" target="_blank" rel="noopener noreferrer">
www.berkkoksal.com
</a>
</p>

<p>Bu yazılım geliştirilmeye devam edecek olup, katkı ve geri bildirimler her zaman memnuniyetle karşılanmaktadır. Sorularınız, önerileriniz ve katkılarınız için:<br>
<strong>berkgitarist@gmail.com</strong>
</p>

<p style="text-align:center;font-size:1.1em;margin-top:30px;">
<strong>Bu proje tamamen TANRI'ya adanmıştır.</strong> "Oku. Araştır. Karşılaştır. Teyit Et. Kararı Kuran'ın delilleriyle kendin ver."
</p>
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
window.openAnalysisPanel = openAnalysisPanel;
window.closeAnalysisPanel = closeAnalysisPanel;
window.speakVerse = speakVerse;
window.stopSpeech = stopSpeech;
window.speakEnglishVerse = speakEnglishVerse;
window.toggleArabicWords = toggleArabicWords;
window.editLocalNote = editLocalNote;
window.removeLocalNote = removeLocalNote;
window.removeLocalNoteFromList = removeLocalNoteFromList;
window.exportLocalNotes = exportLocalNotes;
window.openNotesImportDialog = openNotesImportDialog;
window.updateLocalNoteUI = updateLocalNoteUI;
window.goToVerse = goToVerse;
window.goToVerseFromNotes =
  goToVerseFromNotes;
