/* script.js — Uygulama ana JS
   - Bu sürümde "Mealler" butonu ayarlara bağlıdır (varsayılan kapalı).
   - Google Drive not entegrasyonu: gdrive.js fonksiyonlarını kullanır.
   
   DÜZELTMELER (v2):
   - scrollToVerse çift tanım hatası giderildi (iki ayrı imza tek fonksiyonda birleştirildi)
   - navigateToSearchResult: meal sonuçlarında highlight + scroll güvenilir hale getirildi
   - ensureMealOpen: scroll ve highlight sırası düzeltildi
   - waitForQuranPageReady: STATE.loadedPages kontrolü iyileştirildi
   - searchQuery değişkeni: scrollToVerse'e güvenli şekilde iletiliyor
*/

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
    'Tefhim-ul Kur\'an.json-Link',
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
  isLoading: false,
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
    pageToSuraMap: {}
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

let externalSiteLoaded = false;

// Aktif arama sorgusunu tutar (highlight için)
let activeSearchQuery = '';

/* ========== Pending Highlight Sistemi ==========
   goToPage → displayPage DOM'u sıfırladığı için,
   scrollToVerse'i displayPage'den ÖNCE çağırmak işe yaramaz.
   Bu nesne, displayPage tamamlandıktan sonra otomatik
   uygulanacak highlight + scroll bilgisini taşır.
*/
let pendingHighlight = null; // { suraNum, verseNum, query, openMeal, mealName }

document.addEventListener('DOMContentLoaded', async () => {
  console.log("DOM tamamen yüklendi, introVerse kontrol ediliyor...");
  showIntroVerse();
  loadSettings();
  await loadInitialData();
  buildSuraMenu();
  setupEventListeners();
  STATE.currentPage = 23;
  loadPagesAround(STATE.currentPage);
  console.log("Uygulama başarıyla yüklendi.");
  const guidePageButton = document.getElementById('guidePage');
  console.log("guidePage elementi:", guidePageButton);
});

/* ========== Intro ========== */
function showIntroVerse() {
  const intro = DOM.introVerse;
  console.log("IntroVerse çağrıldı");
  if (!intro) {
    console.warn("IntroVerse elementi bulunamadı!");
    ensureQuranView();
    return;
  }
  console.log("Intro gösteriliyor");
  intro.style.display = 'flex';
  setTimeout(() => {
    intro.classList.add('fade-out');
    setTimeout(() => {
      intro.style.display = 'none';
      localStorage.setItem('initialVerseShown', 'true');
      ensureQuranView();
      console.log("Intro ekranı gizlendi, içerik gösteriliyor.");
    }, 1000);
  }, 5000);
}

/* ========== Ayarlar ========== */
function loadSettings() {
  const savedSettings = localStorage.getItem('quranAppSettings');
  if (savedSettings) {
    try {
      STATE.settings = { ...STATE.settings, ...JSON.parse(savedSettings) };
    } catch (error) {
      console.warn("Ayarlar yüklenemedi:", error);
    }
  }
  applySettings();
}

function saveSettings() {
  localStorage.setItem('quranAppSettings', JSON.stringify(STATE.settings));
  applySettings();
  displayPage(STATE.currentPage);
}

function applySettings() {
  DOM.body.className = `${STATE.settings.theme}-theme`;
  const sizes = { small: '12px', medium: '16px', large: '20px' };
  const fontSize = sizes[STATE.settings.fontSize] || '16px';
  document.documentElement.style.setProperty('--base-font-size', fontSize);
}

/* ========== Olaylar ========== */
function setupEventListeners() {
  console.log("setupEventListeners çağrıldı");
  document.getElementById('prevPage').addEventListener('click', () => {
    console.log("Önceki Sayfa butonuna tıklandı");
    if (STATE.currentPage > 1) goToPage(STATE.currentPage - 1);
  });

  document.getElementById('nextPage').addEventListener('click', () => {
    console.log("Sonraki Sayfa butonuna tıklandı");
    if (STATE.currentPage < STATE.totalPages) goToPage(STATE.currentPage + 1);
  });

  document.getElementById('menuToggle').addEventListener('click', () => {
    console.log("Menü butonuna tıklandı");
    toggleSidebar();
  });
  document.getElementById('closeMenu').addEventListener('click', () => {
    console.log("Menü kapatma butonuna tıklandı");
    closeSidebar();
  });
  document.getElementById('sidebarOverlay').addEventListener('click', () => {
    console.log("Sidebar overlay'e tıklandı");
    closeSidebar();
  });

  document.getElementById('settingsPage').addEventListener('click', () => {
    console.log("Ayarlar butonuna tıklandı");
    displaySettingsPage();
    closeSidebar();
  });

  document.getElementById('notesPage').addEventListener('click', () => {
    console.log("Notlar butonuna tıklandı");
    displayNotesPage();
    closeSidebar();
  });

  const guidePageButton = document.getElementById('guidePage');
  if (guidePageButton) {
    console.log("guidePage butonu bulundu, olay dinleyicisi ekleniyor");
    guidePageButton.addEventListener('click', () => {
      console.log("Kullanım Kılavuzu butonuna tıklandı!");
      displayGuidePage();
      closeSidebar();
    });
  } else {
    console.error("Hata: guidePage elementi bulunamadı!");
  }

  document.getElementById('currentPageDisplay').addEventListener('click', () => {
    console.log("Sayfa göstergesine tıklandı");
    toggleExternalSite();
  });

  setupSearch();
}

/* ========== Sidebar ========== */
function toggleSidebar() {
  const isOpen = !DOM.sidebar.classList.contains('hidden');
  isOpen ? closeSidebar() : openSidebar();
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

/* ========== Harici Site ========== */
function toggleExternalSite() {
  const display = DOM.currentPageDisplay;
  if (!externalSiteLoaded) {
    loadExternalSite();
    display.textContent = "Kur'an Dönüş";
    externalSiteLoaded = true;
  } else {
    ensureQuranView();
    display.textContent = "Kuran Oku";
    externalSiteLoaded = false;
  }
}

function loadExternalSite() {
  DOM.quranContent.classList.add('hidden');
  DOM.iframeContent.classList.remove('hidden');
  document.querySelector('.content-area').style.padding = '0';
}

function ensureQuranView() {
  DOM.iframeContent.classList.add('hidden');
  DOM.quranContent.classList.remove('hidden');
  document.querySelector('.content-area').style.padding = '';
  DOM.quranContent.style.display = 'block';
}

/* ========== Veri Yükleme ========== */
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
    processMetadata();
    // Mealler artık başlangıçta yüklenmiyor — lazy load ile ilk kullanımda yüklenir
  } catch (error) {
    console.error("Veri yükleme hatası:", error);
    DOM.content.innerHTML = '<div class="error-message">Veri yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</div>';
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
  for (let page in STATE.data.tr) {
    for (let suraNum in STATE.data.tr[page].sura) {
      if (!STATE.metadata.sureNames[suraNum]) {
        const titles = STATE.data.tr[page].sura[suraNum].titles;
        if (titles && titles["1"]) {
          const lines = titles["1"].split("\n").map(l => l.trim()).filter(l => l);
          const sureLine = lines.find(l => l.startsWith("Sure "));
          const parantezLine = lines.find(l => l.startsWith("("));
          if (sureLine) {
            let cleanedTitle = sureLine.replace(/^Sure\s*/, "").trim();
            if (parantezLine) cleanedTitle += " " + parantezLine;
            STATE.metadata.sureNames[suraNum] = cleanedTitle;
            STATE.metadata.sureToPageMap[suraNum] = parseInt(page);
          }
        }
      }
    }
  }
}

/* ========== Meal Lazy Load Sistemi ==========
   Mealler başlangıçta yüklenmez. İlk ihtiyaç anında (meal butonu tıklaması
   veya meal araması) yüklenir. Sonraki çağrılarda tekrar yüklenmez.
   
   STATE.meals.status:
     'idle'    → henüz yüklenmedi
     'loading' → yükleniyor (Promise bekleniyor)
     'ready'   → yüklendi, kullanıma hazır
     'error'   → yükleme başarısız
*/
const MEALS_STATE = {
  status: 'idle',       // 'idle' | 'loading' | 'ready' | 'error'
  loadPromise: null,    // tekrar yüklemeyi önler
  loadedCount: 0,       // kaç dosya yüklendi (progress için)
};

async function loadMeals() {
  // Zaten yüklenmiş veya yükleniyor — mevcut Promise'i döndür
  if (MEALS_STATE.status === 'ready') return Promise.resolve();
  if (MEALS_STATE.status === 'loading') return MEALS_STATE.loadPromise;

  MEALS_STATE.status = 'loading';
  MEALS_STATE.loadedCount = 0;

  MEALS_STATE.loadPromise = (async () => {
    showLoading('Mealler yükleniyor...');
    try {
      for (let i = 0; i < CONFIG.mealFiles.length; i += CONFIG.batchSize) {
        const batch = CONFIG.mealFiles.slice(i, i + CONFIG.batchSize);
        await Promise.all(batch.map(async file => {
          try {
            const filePath = `./data/mealler/${file}`;
            const response = await fetch(filePath);
            if (response.ok) {
              const json = await response.json();
              const mealName = file === '2baski_quran_tr.json'
                ? 'İD-Soner Tahsinoğlu 2.Baskı'
                : file.replace('.json', '');
              STATE.data.meals[mealName] = json;
              MEALS_STATE.loadedCount++;
              console.log('Meal yüklendi:', mealName);
            } else {
              console.warn(`${file} bulunamadı:`, response.status);
            }
          } catch (err) {
            console.warn(`${file} yüklenirken hata:`, err);
          }
        }));
        const progress = Math.min(100, ((i + CONFIG.batchSize) / CONFIG.mealFiles.length) * 100);
        updateLoadingProgress(progress);
      }
      MEALS_STATE.status = 'ready';
      console.log(`✅ Mealler hazır (${MEALS_STATE.loadedCount}/${CONFIG.mealFiles.length} dosya)`);
    } catch (error) {
      MEALS_STATE.status = 'error';
      console.error('Meal yükleme hatası:', error);
    } finally {
      hideLoading();
    }
  })();

  return MEALS_STATE.loadPromise;
}

/* Meallerin yüklenip yüklenmediğini kontrol et — UI için */
function areMealsReady() {
  return MEALS_STATE.status === 'ready';
}

/* ========== Sayfa Yükleme/Geçiş ========== */
function loadPagesAround(pageNum) {
  const startPage = Math.max(1, pageNum - CONFIG.initialLoad);
  const endPage = Math.min(STATE.totalPages, pageNum + CONFIG.initialLoad);
  const pagesToLoad = [];
  for (let i = startPage; i <= endPage; i++) {
    if (!STATE.loadedPages.has(i)) pagesToLoad.push(i);
  }
  if (pagesToLoad.length > 0) loadPagesBatch(pagesToLoad);
  displayPage(pageNum);
}

async function loadPagesBatch(pageNumbers) {
  if (STATE.isLoading) return;
  STATE.isLoading = true;
  showLoading(`Sayfalar yükleniyor (${pageNumbers[0]}-${pageNumbers[pageNumbers.length - 1]})...`);
  try {
    for (const pageNum of pageNumbers) {
      if (!STATE.loadedPages.has(pageNum)) {
        STATE.loadedPages.add(pageNum);
        const progress = (pageNumbers.indexOf(pageNum) + 1) / pageNumbers.length * 100;
        updateLoadingProgress(progress);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    if (pageNumbers.includes(STATE.currentPage)) displayPage(STATE.currentPage);
  } catch (error) {
    console.error("Sayfa yükleme hatası:", error);
  } finally {
    STATE.isLoading = false;
    hideLoading();
  }
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
  // pendingHighlight varsa sayfanın tepesine gitme —
  // _applyHighlightAndScroll zaten doğru konuma scroll edecek
  if (!pendingHighlight) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (!STATE.isLoading) {
    const startPage = Math.max(1, pageNum - CONFIG.initialLoad);
    const endPage = Math.min(STATE.totalPages, pageNum + CONFIG.initialLoad);
    const pagesToLoad = [];
    for (let i = startPage; i <= endPage; i++) {
      if (!STATE.loadedPages.has(i)) pagesToLoad.push(i);
    }
    if (pagesToLoad.length > 0) loadPagesBatch(pagesToLoad);
  }
}

function goToSura(suraNum) {
  ensureQuranView();
  if (STATE.metadata.sureToPageMap[suraNum]) {
    goToPage(STATE.metadata.sureToPageMap[suraNum]);
    closeSidebar();
    setTimeout(() => scrollToVerse(suraNum, 1), 300);
  }
}

function goToVerse(suraNum, verseNum) {
  if (STATE.metadata.sureToPageMap[suraNum]) {
    goToPage(STATE.metadata.sureToPageMap[suraNum]);
    setTimeout(() => scrollToVerse(suraNum, verseNum), 500);
  }
}

/* ========== _applyHighlightAndScroll (iç yardımcı) ==========
   DOM hazır olduğunda çağrılır. Ayeti bulur, scroll yapar,
   çerçeve + metin highlight uygular, opsiyonel meal kutusunu açar.
*/
async function _applyHighlightAndScroll(suraNum, verseNum, query, openMeal, mealName) {
  // 1) Ayet elementini bul
  let targetElement = null;
  document.querySelectorAll('.verse-number').forEach(el => {
    if (el.textContent.trim() === `${suraNum}:${verseNum}`) {
      targetElement = el.closest('.verse');
    }
  });

  if (!targetElement) {
    console.warn(`_applyHighlightAndScroll: ${suraNum}:${verseNum} elementi bulunamadı`);
    return;
  }

  // 2) Scroll — header yüksekliğini hesaba kat
  const headerEl = document.querySelector('.header-bar');
  const headerHeight = headerEl ? headerEl.offsetHeight : 0;
  const top = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight - 8;
  window.scrollTo({ top, behavior: 'smooth' });

  // 3) Çerçeve highlight (5 sn)
  targetElement.classList.add('verse-search-highlight');
  setTimeout(() => targetElement.classList.remove('verse-search-highlight'), 5000);

  // 4) Metin içi kelime highlight (5 sn) — query varsa
  if (query) {
    applyTemporaryHighlightToVerse(targetElement, query, 5000);
  }

  // 5) Meal kutusunu aç ve highlight yap (meal araması ise)
  if (openMeal) {
    // Smooth scroll tamamlanmadan meal'a atlamayı önlemek için kısa gecikme
    // ensureMealOpen async olduğu için await ile çağır
    setTimeout(async () => {
      await ensureMealOpen(suraNum, verseNum, query, mealName);
    }, 700);
  }
}

/* ========== scrollToVerse ==========
   goToSura / goToVerse / Enter tuşu gibi iç çağrılar için.
   DOM'un hazır olduğu varsayılır; doğrudan _applyHighlightAndScroll'u çağırır.
   Arama sonucu tıklamaları için navigateToSearchResult → pendingHighlight yolu kullanılır.
*/
function scrollToVerse(suraNum, verseNum, searchQuery) {
  _applyHighlightAndScroll(suraNum, verseNum, searchQuery || activeSearchQuery || '', false, '');
}

/* ========== Sayfa Göstermesi ========== */
function displayPage(pageNum) {
  if (!STATE.data.en[pageNum] || !STATE.data.tr[pageNum]) {
    DOM.content.innerHTML = '<p>Sayfa yükleniyor...</p>';
    return;
  }

  const enPage = STATE.data.en[pageNum];
  const trPage = STATE.data.tr[pageNum];

  let pageTitle = "Bilinmeyen";
  const suraNums = Object.keys(enPage.sura).sort((a, b) => Number(a) - Number(b));
  if (suraNums.length > 0) {
    const suraTitles = suraNums.map(num => STATE.metadata.sureNames[num] || `Sure ${num}`);
    pageTitle = suraTitles.join(" | ");
  }

  let html = `
    <div class="page-header">
      <h1>📖 ${pageTitle}</h1>
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
        html += `<div class="passage-title">${enSura.titles[verseNum]}</div>`;
        if (trSura.titles && trSura.titles[verseNum]) {
          html += `<div class="passage-title-tr">${trSura.titles[verseNum]}</div>`;
        }
      }

      const verseKey = `${suraNum}:${verseNum}`;
      const hasNotes = (enNotesMap[verseKey]?.length > 0) || (trNotesMap[verseKey]?.length > 0);

      html += `
        <div class="verse">
          <div class="verse-number">${suraNum}:${verseNum}</div>
          <div class="verse-arabic">${enSura.encrypted[verseNum]}</div>`;

      if (STATE.settings.showTransliteration) {
        html += `<div class="verse-transliteration">${STATE.data.translit[suraNum]?.verses[verseNum] || ''}</div>`;
      }

      html += `
          <div class="verse-text">${enSura.verses[verseNum]}</div>
          <div class="verse-text-tr"><strong>${trSura.verses[verseNum]}</strong></div>
          <div class="buttons">`;

      if (hasNotes) {
        html += `<button class="toggle-btn dipnot-btn" onclick="toggleNote('note-${suraNum}-${verseNum}')">📌 Dipnot</button>`;
      }

      if (STATE.settings.showMeals) {
        html += `<button class="toggle-btn" onclick="toggleMeal('meal-${suraNum}-${verseNum}', ${suraNum}, ${verseNum})">📚 Mealler</button>`;
      }

      html += `<button class="toggle-btn note-btn" onclick="toggleNoteInput('note-input-box-${suraNum}-${verseNum}', ${suraNum}, ${verseNum})">✍️ Not Al</button>`;

      html += `</div>  <!-- .buttons -->`;

      if (STATE.settings.showAiTranslation) {
        html += `<div id="ai-translation-${suraNum}-${verseNum}" class="ai-translation">`;
        if (STATE.data.ai[suraNum] && STATE.data.ai[suraNum].verses && STATE.data.ai[suraNum].verses[verseNum]) {
          html += `<strong>AI ÇEVİRİ:</strong> ${STATE.data.ai[suraNum].verses[verseNum]}`;
        } else {
          html += `<strong>AI ÇEVİRİ:</strong> Çeviri bulunamadı.`;
        }
        html += `</div>`;
      }

      if (hasNotes) {
        html += `<div id="note-${suraNum}-${verseNum}" class="note-box hidden">`;
        if (enNotesMap[verseKey]) {
          enNotesMap[verseKey].forEach(note => {
            html += `<div class="note-en"><strong>EN:</strong> ${note}</div>`;
          });
        }
        if (trNotesMap[verseKey]) {
          trNotesMap[verseKey].forEach(note => {
            html += `<div class="note-tr"><strong>TR:</strong> ${note}</div>`;
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
      </div>`; // .verse
    }

    html += `</div>`; // .sura
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

  DOM.content.innerHTML = html;

  document.querySelectorAll('.verse-arabic').forEach(el => {
    el.style.textAlign = 'right';
    el.style.direction = 'rtl';
  });

  attachWordTranslation();
  loadNotesForCurrentPage();
  applySettings();

  /* ---- Pending highlight: displayPage DOM'u yeniledikten hemen sonra çalışır ---- */
  if (pendingHighlight) {
    const ph = pendingHighlight;
    pendingHighlight = null; // sıfırla — bir daha tetiklenmesin

    // rAF: tarayıcı layout'u commit ettikten sonra offset hesapla
    requestAnimationFrame(() => {
      _applyHighlightAndScroll(ph.suraNum, ph.verseNum, ph.query, ph.openMeal, ph.mealName);
    });
  }
}

/* ========== Not Görüntüleme (Drive) ========== */
async function loadNotesForCurrentPage() {
  if (!isDriveReady()) return;
  const verseElements = document.querySelectorAll('.verse-number');
  for (const element of verseElements) {
    const verseText = element.textContent.trim();
    const match = verseText.match(/^(\d+):(\d+)$/);
    if (match) {
      const [, sura, verse] = match;
      const content = await loadNoteFromDrive(sura, verse);
      if (content) displayLoadedNote(sura, verse, content);
    }
  }
}

function displayLoadedNote(sura, verse, content) {
  const box = document.getElementById(`user-note-${sura}-${verse}`);
  if (!box) return;
  const safe = (content || '').replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]));
  box.innerHTML = `<div class="note-tr"><strong>📝 Notunuz:</strong><br>${safe.replace(/\n/g, '<br>')}</div>`;
  box.classList.remove('hidden');
}

/* ========== Not verisi mapleme (dipnotlar) ========== */
function mapNotesToVerses(notesData) {
  const noteMap = {};
  if (!notesData) return noteMap;
  notesData.forEach(note => {
    const match = note.match(/^\*+\s*(\d+:\d+(-\d+)?)/);
    if (match) {
      const range = match[1];
      if (range.includes('-')) {
        const [start, end] = range.split('-');
        const [suraStart, verseStart] = start.split(':').map(Number);
        const [, verseEnd] = end.includes(':') ? end.split(':').map(Number) : [suraStart, Number(end)];
        for (let i = verseStart; i <= verseEnd; i++) {
          const key = `${suraStart}:${i}`;
          if (!noteMap[key]) noteMap[key] = [];
          noteMap[key].push(note);
        }
      } else {
        const key = range;
        if (!noteMap[key]) noteMap[key] = [];
        noteMap[key].push(note);
      }
    }
  });
  return noteMap;
}

/* ========== Sura menüsü ========== */
function buildSuraMenu() {
  let html = '';
  const sortedSuraNums = Object.keys(STATE.metadata.sureNames).sort((a, b) => Number(a) - Number(b));
  sortedSuraNums.forEach(suraNum => {
    html += `<li onclick="goToSura(${suraNum})">${STATE.metadata.sureNames[suraNum]}</li>`;
  });
  DOM.suraMenu.innerHTML = html;
}

/* ========== Mealler ========== */
function highlightMealText(text, query) {
  if (!query || !text) return text;
  const q = query.trim();
  if (!q) return text;
  const regex = new RegExp(escapeRegExp(q), 'gi');
  return String(text).replace(regex, '<strong class="search-result-highlight">$&</strong>');
}

function getOtherTranslations(suraNum, verseNum, query = '', focusedMealName = '') {
  const suraIndex = parseInt(suraNum, 10) - 1;
  let otherMealsHtml = '';

  let erhanTranslation = null;
  let erhanArabic = null;
  let erhanTranscription = null;

  for (const mealName in STATE.data.meals) {
    const meal = STATE.data.meals[mealName];
    let ayetText = null;

    if (meal?.sures && Array.isArray(meal.sures)) {
      const sure = meal.sures[suraIndex];
      const ayet = sure?.ayetler?.find(a => String(a[0]) === String(verseNum));
      if (ayet) ayetText = ayet[1];
    }

    if (!ayetText && Array.isArray(meal)) {
      const sure = meal[suraIndex];
      const ayet = sure?.ayetler?.find(a => String(a[0]) === String(verseNum));
      if (ayet) ayetText = ayet[1];
    }

    if (!ayetText && meal && typeof meal === 'object') {
      for (const pageKey in meal) {
        if (!meal.hasOwnProperty(pageKey)) continue;
        const page = meal[pageKey];
        const suraData = page?.sura?.[suraNum];
        if (suraData && suraData.verses && suraData.verses[verseNum] !== undefined) {
          ayetText = suraData.verses[verseNum];
          break;
        }
      }
    }

    if (!ayetText && meal?.surahs) {
      const sura = meal.surahs.find(s => String(s.id) === String(suraNum));
      const verseObj = sura?.verses?.find(v => String(v.verse_number) === String(verseNum));
      if (verseObj) {
        if (verseObj.translation) {
          erhanTranslation = verseObj.translation;
        }
        if (verseObj.verse) {
          erhanArabic = verseObj.verse;
        }
        if (verseObj.transcription) {
          erhanTranscription = verseObj.transcription;
        }
      }
    }

    if (ayetText && mealName.toLowerCase() !== 'kuran_erhan_aktas') {
      const highlighted = highlightMealText(ayetText, query);
      otherMealsHtml += `<div class="note-tr ${mealName === focusedMealName ? 'meal-focused-result' : ''}">
        <strong>${mealName}:</strong> ${highlighted}
      </div>`;
    }
  }

  if (erhanTranslation) {
    otherMealsHtml += `<div class="note-tr"><strong>Erhan Aktaş Çeviri:</strong> ${highlightMealText(erhanTranslation, query)}</div>`;
  }
  if (erhanArabic) {
    otherMealsHtml += `<div class="note-tr"><strong>Erhan Aktaş Arapça:</strong> <span class="erhan-arabic-text">${highlightMealText(erhanArabic, query)}</span></div>`;
  }
  if (erhanTranscription) {
    otherMealsHtml += `<div class="note-tr"><strong>Erhan Aktaş Arapça Okunuş:</strong> ${highlightMealText(erhanTranscription, query)}</div>`;
  }

  if (!otherMealsHtml) {
    return '<div>Bu ayet için diğer mealler bulunamadı.</div>';
  }

  return otherMealsHtml;
}

/* ========== Kelime tooltip (EN -> TR sözlük) ========== */
function attachWordTranslation() {
  const tooltip = DOM.wordTooltip;

  document.querySelectorAll('.verse-text').forEach(el => {
    const text = el.textContent;
    const words = text.split(/\s+/);
    el.innerHTML = '';

    words.forEach(word => {
      const originalWord = word.toLowerCase();
      const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();

      const span = document.createElement('span');
      span.textContent = word + ' ';
      span.style.cursor = 'help';

      if (cleanWord.length === 0) {
        el.appendChild(span);
        return;
      }

      span.addEventListener('mouseenter', (e) => {
        tooltip.style.display = 'block';
        tooltip.style.left = (e.pageX + 10) + 'px';
        tooltip.style.top = (e.pageY + 10) + 'px';

        let translationValue = null;

        if (STATE.data.dictionary[originalWord]) {
          translationValue = STATE.data.dictionary[originalWord];
        } else if (STATE.data.dictionary[cleanWord]) {
          translationValue = STATE.data.dictionary[cleanWord];
        }

        if (translationValue) {
          const translations = translationValue.split(', ').map((trans, index) => {
            const colors = ['#e74c3c', '#27ae60', '#3498db'];
            const color = colors[index % 3];
            return `<strong style="color: ${color}">${trans}</strong>`;
          }).join(', ');
          tooltip.innerHTML = `"${word}" ➔ ${translations}`;
        } else {
          tooltip.innerHTML = `"${word}" ➔ <span style="color: #e74c3c;">Kelime bulunamadı</span>`;
        }
      });

      span.addEventListener('mousemove', (e) => {
        tooltip.style.left = (e.pageX + 10) + 'px';
        tooltip.style.top = (e.pageY + 10) + 'px';
      });

      span.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });

      el.appendChild(span);
    });
  });
}

/* ========== Not alma UI ========== */
async function saveNote(sura, verse) {
  const textarea = document.getElementById(`note-input-${sura}-${verse}`);
  const noteContent = textarea.value.trim();
  if (!noteContent) {
    showNotification('⚠️ Not içeriği boş olamaz.', 'warning');
    return;
  }
  const success = await saveNoteToDrive(sura, verse, noteContent);
  if (success) {
    textarea.value = '';
    const inputBox = document.getElementById(`note-input-box-${sura}-${verse}`);
    if (inputBox) inputBox.classList.add('hidden');
    displayLoadedNote(sura, verse, noteContent);
  }
}

function cancelNote(sura, verse) {
  const textarea = document.getElementById(`note-input-${sura}-${verse}`);
  const inputBox = document.getElementById(`note-input-box-${sura}-${verse}`);
  if (textarea) textarea.value = '';
  if (inputBox) inputBox.classList.add('hidden');
}

async function toggleMeal(id, suraNum, verseNum, query = '', focusedMealName = '') {
  const element = document.getElementById(id);
  if (!element) return;

  // Mealler henüz yüklenmemişse önce yükle, yükleme sırasında buton durumunu göster
  if (!areMealsReady()) {
    const btn = element.closest('.verse')?.querySelector(`button[onclick*="${id}"]`);
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

function toggleNote(id) {
  const element = document.getElementById(id);
  if (element) element.classList.toggle('hidden');
}

async function toggleNoteInput(id, sura, verse) {
  const element = document.getElementById(id);
  if (!element) return;
  element.classList.toggle('hidden');
  if (!element.classList.contains('hidden') && isDriveReady()) {
    const textarea = document.getElementById(`note-input-${sura}-${verse}`);
    if (textarea) {
      const existingNote = await loadNoteFromDrive(sura, verse);
      if (existingNote) textarea.value = existingNote;
      setTimeout(() => textarea.focus(), 100);
    }
  }
}

/* ========== Ayarlar / Notlar sayfaları ========== */
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
          ${themes.map(theme => `
            <label class="theme-option">
              <input type="radio" name="theme" value="${theme.name}" 
                     ${STATE.settings.theme === theme.name ? 'checked' : ''}>
              <div class="theme-preview ${theme.name}-theme">
                ${theme.label}
                ${STATE.settings.theme === theme.name ? '✓' : ''}
              </div>
            </label>
          `).join('')}
        </div>
        <div class="setting-item">
          <label for="fontSizeSelect">Yazı Boyutu:</label>
          <select id="fontSizeSelect">
            <option value="small" ${STATE.settings.fontSize === 'small' ? 'selected' : ''}>Küçük</option>
            <option value="medium" ${STATE.settings.fontSize === 'medium' ? 'selected' : ''}>Orta</option>
            <option value="large" ${STATE.settings.fontSize === 'large' ? 'selected' : ''}>Büyük</option>
          </select>
        </div>
        <div class="setting-item">
          <label>
            <input type="checkbox" id="showMeals" 
                   ${STATE.settings.showMeals ? 'checked' : ''}>
            Mealler'i Göster
          </label>
        </div>

        <label>
          <input type="checkbox" id="showTransliteration" 
                 ${STATE.settings.showTransliteration ? 'checked' : ''}>
          Arapça-Türkçe Göster
        </label>
        <label>
          <input type="checkbox" id="showAiTranslation" 
                 ${STATE.settings.showAiTranslation ? 'checked' : ''}>
          AI Çeviriyi Göster
        </label>
      </div>
      <div class="settings-section">
        <h2>Google Drive Durumu</h2>
        <div class="drive-status">
          <p><strong>Durum:</strong> <span id="driveStatus">${isDriveReady() ? '🟢 Bağlı' : '🔴 Bağlı değil'}</span></p>
          <p><strong>Klasör:</strong> <span id="folderStatus">${folderId ? '✅ Hazır' : '❌ Bulunamadı'}</span></p>
        </div>
      </div>
      <div class="settings-section">
        <h2>Yazılım Hakkında</h2>
        <div class="about-section">
          <ul>
            <li><strong>Kodlama, Tasarım:</strong> Berk KÖKSAL <a href=>https://www.youtube.com/@berkgitarist</a></li>
            <li><strong>Arama:</strong> (örn: "2:255") 2 255  2/255 yazabilirsiniz.</li>
            <li><strong>Google Drive:</strong> Notlarınız otomatik olarak "Kuran_Teyit_Not" klasörüne Drive içinde kaydedilir.</li>
          </ul>
        </div>
      </div>
      <button class="toggle-btn" id="saveSettingsBtn">💾 Ayarları Kaydet</button>
      <button class="toggle-btn" onclick="goToPage(${STATE.currentPage})">🔙 Kuran'a Dön</button>
    </div>
  `;
  DOM.content.innerHTML = html;
  document.querySelectorAll('.theme-option input').forEach(input => {
    input.addEventListener('change', (e) => {
      STATE.settings.theme = e.target.value;
      applySettings();
    });
  });
  document.getElementById('fontSizeSelect').addEventListener('change', (e) => {
    STATE.settings.fontSize = e.target.value;
    applySettings();
  });
  document.getElementById('showMeals').addEventListener('change', (e) => {
    STATE.settings.showMeals = e.target.checked;
    saveSettings();
  });
  document.getElementById('showTransliteration').addEventListener('change', (e) => {
    STATE.settings.showTransliteration = e.target.checked;
    saveSettings();
  });
  document.getElementById('showAiTranslation').addEventListener('change', (e) => {
    STATE.settings.showAiTranslation = e.target.checked;
    saveSettings();
  });
  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
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
    const noteFiles = files.filter(f => re.test(f.name));

    if (noteFiles.length === 0) {
      notesList.innerHTML = '<p>Henüz kaydedilmiş notunuz bulunmuyor.</p>';
      return;
    }

    let html = '<div class="notes-grid">';
    for (const file of noteFiles) {
      const [, sura, verse] = file.name.match(re);
      const content = await getFileTextById(file.id, file.mimeType);
      const suraName = STATE.metadata.sureNames[sura] || `Sure ${sura}`;
      const modifiedDate = new Date(file.modifiedTime).toLocaleDateString('tr-TR');
      const preview = (content || '').substring(0, 150) + ((content || '').length > 150 ? '...' : '');
      html += `
        <div class="note-card">
          <div class="note-header">
            <h3>${suraName} ${sura}:${verse}</h3>
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
    console.error("Notlar yüklenirken hata:", error);
    notesList.innerHTML = '<p>Notlar yüklenirken bir hata oluştu.</p>';
  }
}

/* ========== Arama ========== */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeSnippet(text, query) {
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

function getMealVerseText(meal, suraNum, verseNum) {
  const suraIndex = parseInt(suraNum, 10) - 1;
  let ayetText = null;

  if (meal?.sures && Array.isArray(meal.sures)) {
    const sure = meal.sures[suraIndex];
    const ayet = sure?.ayetler?.find(a => String(a[0]) === String(verseNum));
    if (ayet) ayetText = ayet[1];
  }

  if (!ayetText && Array.isArray(meal)) {
    const sure = meal[suraIndex];
    const ayet = sure?.ayetler?.find(a => String(a[0]) === String(verseNum));
    if (ayet) ayetText = ayet[1];
  }

  if (!ayetText && meal && typeof meal === 'object') {
    for (const pageKey in meal) {
      if (!meal.hasOwnProperty(pageKey)) continue;
      const page = meal[pageKey];
      const suraData = page?.sura?.[suraNum];
      if (suraData && suraData.verses && suraData.verses[verseNum] !== undefined) {
        ayetText = suraData.verses[verseNum];
        break;
      }
    }
  }

  if (!ayetText && meal?.surahs) {
    const sura = meal.surahs.find(s => String(s.id) === String(suraNum));
    const verseObj = sura?.verses?.find(v => String(v.verse_number) === String(verseNum));
    if (verseObj) {
      ayetText = verseObj.translation || verseObj.verse || verseObj.text || null;
    }
  }

  return ayetText;
}

function searchKeywordInData(query, maxResults = 16) {
  const q = query.trim();
  if (!q) return [];
  const qLower = q.toLocaleLowerCase('tr-TR');

  const results = [];
  const visitedVerses = new Set();

  const addQuranResult = (source, page, suraNum, verseNum, text) => {
    if (results.length >= maxResults) return;
    const key = `${suraNum}:${verseNum}`;
    if (visitedVerses.has(key)) return;
    visitedVerses.add(key);
    results.push({ type: 'quran', source, page: parseInt(page), suraNum, verseNum, snippet: makeSnippet(text, q), query: q });
  };

  ['tr', 'en', 'translit', 'ai'].forEach(source => {
    if (results.length >= maxResults) return;
    const data = STATE.data[source];
    if (!data) return;
    for (const page in data) {
      if (results.length >= maxResults) break;
      const pageObj = data[page];
      if (!pageObj || !pageObj.sura) continue;
      for (const suraNum in pageObj.sura) {
        if (results.length >= maxResults) break;
        const verses = pageObj.sura[suraNum].verses;
        if (!verses) continue;
        for (const verseNum in verses) {
          if (results.length >= maxResults) break;
          const text = String(verses[verseNum] || '');
          if (text.toLocaleLowerCase('tr-TR').includes(qLower)) {
            addQuranResult(source, page, suraNum, verseNum, text);
          }
        }
      }
    }
  });

  if (results.length < maxResults) {
    for (const mealName in STATE.data.meals) {
      if (results.length >= maxResults) break;
      const meal = STATE.data.meals[mealName];

      const processVerse = (suraNum, verseNum, text) => {
        if (!text || !String(text).toLocaleLowerCase('tr-TR').includes(qLower)) return;
        if (results.length >= maxResults) return;
        // Doğru sayfa numarasını bul:
        // Önce STATE.data.en üzerinde sure+ayet'in gerçekten bulunduğu sayfaya bak
        let page = null;
        for (const p in STATE.data.en) {
          if (STATE.data.en[p]?.sura?.[suraNum]?.verses?.[verseNum] !== undefined) {
            page = parseInt(p);
            break;
          }
        }
        // Fallback: sureToPageMap
        if (!page) page = STATE.metadata.sureToPageMap[suraNum] || null;
        results.push({ type: 'meal', mealName, suraNum, verseNum, page, text: String(text), snippet: makeSnippet(String(text), q), query: q });
      };

      if (meal?.sures && Array.isArray(meal.sures)) {
        meal.sures.forEach((sure, index) => {
          if (!sure?.ayetler) return;
          sure.ayetler.forEach(([anum, ayet]) => processVerse(String(index + 1), String(anum), ayet));
        });
      }

      if (meal && Array.isArray(meal) && results.length < maxResults) {
        meal.forEach((sure, index) => {
          if (!sure?.ayetler) return;
          sure.ayetler.forEach(([anum, ayet]) => processVerse(String(index + 1), String(anum), ayet));
        });
      }

      if (meal && typeof meal === 'object' && !Array.isArray(meal)) {
        for (const pageKey in meal) {
          if (!meal.hasOwnProperty(pageKey)) continue;
          const pageObj = meal[pageKey];
          const suraData = pageObj?.sura;
          if (!suraData) continue;
          for (const suraNum in suraData) {
            const verses = suraData[suraNum]?.verses;
            if (!verses) continue;
            for (const verseNum in verses) {
              processVerse(suraNum, verseNum, verses[verseNum]);
              if (results.length >= maxResults) break;
            }
            if (results.length >= maxResults) break;
          }
          if (results.length >= maxResults) break;
        }
      }

      if (meal?.surahs && Array.isArray(meal.surahs)) {
        meal.surahs.forEach(surah => {
          if (!surah?.verses) return;
          surah.verses.forEach(verseObj => {
            const verseNumber = String(verseObj.verse_number || verseObj.verseNumber || verseObj.id);
            const verseText = verseObj.translation || verseObj.verse || verseObj.text || '';
            processVerse(String(surah.id), verseNumber, verseText);
          });
        });
      }
    }
  }

  return results.slice(0, maxResults);
}

/* ========== ensureMealOpen (düzeltildi) ==========
   Meal kutusunu açar, içeriği yazar, scroll + highlight yapar.
   Scroll garantilemek için displayPage'in DOM güncellemesini bekler.
*/
async function ensureMealOpen(suraNum, verseNum, query = '', focusedMealName = '') {
  const id = `meal-${suraNum}-${verseNum}`;
  const element = document.getElementById(id);

  if (!element) {
    console.warn(`ensureMealOpen: #${id} bulunamadı — sayfa henüz render edilmedi`);
    return null;
  }

  // Mealler yüklenmemişse önce yükle (arama sonucu yolu — kullanıcı beklediğini bilir)
  if (!areMealsReady()) {
    await loadMeals();
  }

  // İçeriği yaz ve görünür yap (showMeals ayarından bağımsız)
  element.innerHTML = getOtherTranslations(suraNum, verseNum, query, focusedMealName);
  element.classList.remove('hidden');

  // Meal butonu yoksa (showMeals kapalı) görsel olarak ekle
  const btnId = `meal-btn-${suraNum}-${verseNum}`;
  if (!document.getElementById(btnId)) {
    const buttonsDiv = element.closest('.verse')?.querySelector('.buttons');
    if (buttonsDiv) {
      const btn = document.createElement('button');
      btn.id = btnId;
      btn.className = 'toggle-btn';
      btn.textContent = '📚 Mealler';
      btn.onclick = () => toggleMeal(id, suraNum, verseNum);
      buttonsDiv.insertBefore(btn, buttonsDiv.firstChild);
    }
  }

  // Highlight
  if (query) {
    highlightMealMatch(element, query);
  }

  // Scroll — rAF ile layout tamamlandıktan sonra
  requestAnimationFrame(() => {
    const headerEl = document.querySelector('.header-bar');
    const headerHeight = headerEl ? headerEl.offsetHeight : 0;
    const top = element.getBoundingClientRect().top + window.pageYOffset - headerHeight - 8;
    window.scrollTo({ top, behavior: 'smooth' });
  });

  return element;
}

/* ========== waitForQuranPageReady (düzeltildi) ==========
   displayPage çağrısı senkron olduğu için DOM güncellemesi hemen olur.
   Ancak loadPagesBatch async olduğunda veri henüz yüklenmemiş olabilir.
   Bu versiyon her iki durumu da kapsar.
*/
function waitForQuranPageReady(callback, timeout = 4000) {
  const interval = 120;
  const max = Math.ceil(timeout / interval);
  let attempts = 0;

  const checkReady = () => {
    // Hem DOM elementi hem veri hazır mı kontrol et
    const verseExists = document.querySelector('.verse-number');
    const dataReady = STATE.data.en[STATE.currentPage] && STATE.data.tr[STATE.currentPage];

    if (verseExists && dataReady) {
      callback();
    } else if (attempts < max) {
      attempts += 1;
      setTimeout(checkReady, interval);
    } else {
      // Zaman aşımı — yine de dene
      console.warn('waitForQuranPageReady: zaman aşımı, yine de devam ediliyor');
      callback();
    }
  };

  checkReady();
}

function normalizeTurkishText(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('tr-TR');
}

function highlightString(text, query) {
  if (!text || !query) return text;
  const q = query.trim();
  if (!q) return text;

  const regex = new RegExp(escapeRegExp(q), 'gi');
  const replaced = text.replace(regex, '<strong class="search-result-highlight">$&</strong>');
  if (replaced !== text) return replaced;

  const normalizedText = normalizeTurkishText(text);
  const normalizedQuery = normalizeTurkishText(q);
  if (!normalizedText.includes(normalizedQuery)) return text;

  let result = '';
  let start = 0;
  let index = normalizedText.indexOf(normalizedQuery, start);

  while (index !== -1) {
    result += text.slice(start, index);
    result += '<strong class="search-result-highlight">' + text.slice(index, index + normalizedQuery.length) + '</strong>';
    start = index + normalizedQuery.length;
    index = normalizedText.indexOf(normalizedQuery, start);
  }

  result += text.slice(start);
  return result;
}

function highlightMealMatch(element, query) {
  if (!element || !query) return;
  const q = query.trim();
  if (!q) return;
  const re = new RegExp(escapeRegExp(q), 'gi');
  element.querySelectorAll('.note-tr').forEach(node => {
    node.innerHTML = node.textContent.replace(re, '<strong class="search-result-highlight">$&</strong>');
  });
}

/* ========== applyTemporaryHighlightToVerse ========== */
function applyTemporaryHighlightToVerse(verseElement, query, duration = 5000) {
  if (!verseElement || !query) return;

  const cleanQuery = query.trim();
  if (cleanQuery.length === 0) return;

  const regex = new RegExp(escapeRegExp(cleanQuery), 'gi');
  const targets = ['.verse-arabic', '.verse-text', '.verse-text-tr'];
  const originalHtml = [];

  targets.forEach((selector, i) => {
    const el = verseElement.querySelector(selector);
    if (!el) return;
    originalHtml[i] = el.innerHTML;
    if (regex.test(el.textContent)) {
      const escaped = el.textContent.replace(regex, '<span class="search-result-highlight">$&</span>');
      el.innerHTML = escaped;
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

/* ========== navigateToSearchResult ==========
   Arama sonucuna tıklandığında çağrılır.

   TEMEL MANTIK:
   goToPage → displayPage DOM'u tamamen sıfırlar (innerHTML).
   Bu yüzden goToPage'den ÖNCE scrollToVerse çağırmak işe yaramaz;
   DOM zaten silinmiş olur.

   Çözüm: pendingHighlight nesnesine hedef bilgisini yaz,
   displayPage tamamlandığında otomatik olarak _applyHighlightAndScroll çalışır.
   Böylece tüm sonuç türlerinde (quran, meal, verse) highlight %100 garantilenir.
*/
function navigateToSearchResult(result, inputElement) {
  ensureQuranView();
  DOM.autocomplete.innerHTML = '';
  DOM.autocomplete.style.display = 'none';
  inputElement.value = '';

  if (!result) return;

  activeSearchQuery = result.query || '';

  if (result.type === 'quran') {
    const page = result.page || STATE.metadata.sureToPageMap[result.suraNum] || 1;
    // pendingHighlight'ı ayarla — displayPage bitince otomatik tetiklenir
    pendingHighlight = {
      suraNum:  result.suraNum,
      verseNum: result.verseNum,
      query:    result.query || '',
      openMeal: false,
      mealName: ''
    };
    goToPage(page);
    return;
  }

  if (result.type === 'meal') {
    // result.page öncelikli; yoksa sureToPageMap'e bak
    const page = result.page || STATE.metadata.sureToPageMap[result.suraNum] || 1;
    console.log('Meal arama sonucu tıklandı:', result, '→ sayfa:', page);
    pendingHighlight = {
      suraNum:  result.suraNum,
      verseNum: result.verseNum,
      query:    result.query || '',
      openMeal: true,
      mealName: result.mealName || ''
    };
    goToPage(page);
    return;
  }

  if (result.type === 'verse') {
    const page = result.page || STATE.metadata.sureToPageMap[result.suraNum] || 1;
    pendingHighlight = {
      suraNum:  result.suraNum,
      verseNum: result.verseNum,
      query:    result.query || '',
      openMeal: false,
      mealName: ''
    };
    goToPage(page);
    return;
  }

  if (result.type === 'sura') {
    goToPage(STATE.metadata.sureToPageMap[result.suraNum]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  showNotification('Arama sonucu işlenemiyor.', 'warning');
}

/* ========== Arama kurulumu ========== */
function setupSearch() {
  const searchInput = DOM.searchInput;
  const autocomplete = DOM.autocomplete;

  // Debounce: kullanıcı yazmayı durdurana kadar (300ms) aramayı beklet.
  // Her tuş basışında searchKeywordInData çalışmaz — özellikle meal JSON'ları
  // büyük olduğundan bu ciddi performans kazancı sağlar.
  let debounceTimer = null;
  const DEBOUNCE_MS = 300;

  const runSearch = (val) => {
    autocomplete.innerHTML = '';
    if (val.length < 1) {
      autocomplete.style.display = 'none';
      return;
    }

    let found = false;
    const suggestions = [];

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
      const [_, suraNum, verseNum] = verseMatch;
      if (STATE.data.en && STATE.data.tr) {
        for (let page in STATE.data.en) {
          const enPage = STATE.data.en[page];
          if (enPage.sura[suraNum] && enPage.sura[suraNum].verses[verseNum]) {
            found = true;
            const trVerseText = STATE.data.tr[page]?.sura?.[suraNum]?.verses?.[verseNum] || enPage.sura[suraNum].verses[verseNum];
            suggestions.push({
              suraNum,
              verseNum,
              page: parseInt(page),
              text: `${suraNum}:${verseNum} - ${trVerseText.substring(0, 100)}...`,
              type: 'verse',
              priority: 0
            });
            break;
          }
        }
      }
    }

    {
      const keywordResults = searchKeywordInData(val, 16);
      if (keywordResults.length > 0) {
        found = true;
        keywordResults.forEach(result => {
          const div = document.createElement('div');
          if (result.type === 'quran') {
            div.innerHTML = `<strong>${result.suraNum}:${result.verseNum}</strong> (${result.source}) - ${result.snippet}`;
            div.onclick = () => navigateToSearchResult(result, searchInput);
          } else if (result.type === 'meal') {
            div.innerHTML = `<strong>${result.mealName}</strong> ${result.suraNum}:${result.verseNum} - ${result.snippet}`;
            div.onclick = () => navigateToSearchResult(result, searchInput);
          }
          autocomplete.appendChild(div);
        });
      }

      // Mealler henüz yüklenmemişse bilgi satırı göster ve arka planda yükle
      if (!areMealsReady() && MEALS_STATE.status !== 'loading') {
        found = true;
        const infoDiv = document.createElement('div');
        infoDiv.className = 'meal-loading-hint';
        infoDiv.innerHTML = `⏳ <em>Mealler yükleniyor, meal sonuçları birazdan görünecek...</em>`;
        autocomplete.appendChild(infoDiv);
        // Arka planda yükle; tamamlanınca mevcut sorguyu tekrar çalıştır
        loadMeals().then(() => {
          const currentVal = searchInput.value.toLowerCase().trim();
          if (currentVal === val) runSearch(val);
        });
      }
    }

    if (found) {
      if (suggestions.length > 0) {
        suggestions.sort((a, b) => a.priority - b.priority);
        suggestions.slice(0, 8).forEach(suggestion => {
          const div = document.createElement('div');
          if (suggestion.type === 'verse') {
            div.innerHTML = `<strong>${suggestion.suraNum}:${suggestion.verseNum}</strong> - ${suggestion.text.replace(suggestion.text.split(' - ')[0] + ' - ', '')}`;
          } else {
            div.innerHTML = `<strong>${suggestion.suraNum}:</strong> ${suggestion.suraName}`;
          }
          div.onclick = () => navigateToSearchResult(suggestion, searchInput);
          autocomplete.appendChild(div);
        });
      }
      autocomplete.style.display = 'block';
    } else {
      autocomplete.style.display = 'none';
    }
  }; // runSearch sonu

  // Debounce'lu input listener:
  // Sure ismi / ayet numarası eşleşmeleri anında gösterilir (hızlı, hesaplama yok).
  // Kelime araması (searchKeywordInData) 300ms bekledikten sonra çalışır —
  // büyük meal JSON'larını her tuşta taramayı önler.
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
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      const verseMatch = val.match(/^(\d+)(?:[:\/\s])(\d+)$/);
      if (verseMatch) {
        const [_, suraNum, verseNum] = verseMatch;
        if (STATE.data.en && STATE.data.tr) {
          for (let page in STATE.data.en) {
            const enPage = STATE.data.en[page];
            if (enPage.sura[suraNum] && enPage.sura[suraNum].verses[verseNum]) {
              goToPage(parseInt(page));
              searchInput.value = '';
              autocomplete.style.display = 'none';
              setTimeout(() => scrollToVerse(suraNum, verseNum), 300);
              return;
            }
          }
          showNotification(`${suraNum}:${verseNum} ayeti bulunamadı!`, 'warning');
          return;
        }
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
        showNotification('Aradığınız sure veya ayet bulunamadı! Format: "2:209", "2/209" veya "2 209" veya sure ismi', 'warning');
      }
    }
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => autocomplete.style.display = 'none', 200);
  });

  searchInput.addEventListener('focus', () => {
    const val = searchInput.value.toLowerCase().trim();
    if (val.length >= 1) autocomplete.style.display = 'block';
  });
}

function navigateToSuggestion(suggestion, inputElement) {
  ensureQuranView();
  if (suggestion.type === 'verse') {
    goToPage(suggestion.page);
    setTimeout(() => scrollToVerse(suggestion.suraNum, suggestion.verseNum), 300);
  } else {
    goToPage(STATE.metadata.sureToPageMap[suggestion.suraNum]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  DOM.autocomplete.innerHTML = '';
  DOM.autocomplete.style.display = 'none';
  inputElement.value = '';
}

/* ========== Loading UI ========== */
function showLoading(text = 'Yükleniyor...') {
  const loadingOverlay = DOM.loadingOverlay;
  loadingOverlay.style.display = 'flex';
  document.querySelector('.loading-text').textContent = text;
  loadingOverlay.autoHideTimeout = setTimeout(() => hideLoading(), 2000);
}

function hideLoading() {
  const loadingOverlay = DOM.loadingOverlay;
  loadingOverlay.style.display = 'none';
  if (loadingOverlay.autoHideTimeout) {
    clearTimeout(loadingOverlay.autoHideTimeout);
  }
}

function updateLoadingProgress(percent) {
  const progressBar = document.querySelector('.progress-bar');
  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }
  document.querySelector('.loading-text').textContent = `Yükleniyor... %${Math.round(percent)}`;
}

const GUIDE_CONTENT = `
    <h1>Kuran Teyit Yazılımı: Tanıtım ve Kullanım Kılavuzu</h1>
    
    <h2>Tanıtım: Kuran Teyit Yazılımı Nedir?</h2>
    <p>[1:1] En Lütufkâr, En Merhametli TANRI’nın adıyla.*</p>
    <p>Bu, Tanrı’nın insanlığa son mesajıdır. Tanrı’nın tüm peygamberleri bu dünyaya geldi ve tüm kutsal yazılar iletildi. Tanrı’nın peygamberleri tarafından iletilen tüm mesajların arındırılıp tek bir mesajda birleştirilmesinin ve bundan böyle Tanrı’nın kabul ettiği tek dinin “Teslimiyet” (3:19, 3:85) olduğunun duyurulmasının zamanı geldi. “Teslimiyet,” Tanrı’nın mutlak otoritesini tanıdığımız ve tüm güce sahip olanın YALNIZCA Tanrı olduğuna; O’ndan bağımsız başka hiçbir varlığın herhangi bir güce sahip olmadığına dair sarsılmaz bir kanaate ulaştığımız dindir. Böyle bir farkındalığın doğal sonucu, yaşamlarımızı ve tapınmamızı mutlak bir şekilde YALNIZCA Tanrı’ya adamaktır. Bu, Eski Ahit, Yeni Ahit ve bu Son Ahit de dâhil olmak üzere tüm kutsal yazılardaki İlk Buyruktur.</p>
    <p>Kuran Teyit Yazılımı, Tanrı’nın antlaşma elçisi Reşat Halife’nin Yetkilendirilmiş (İngilizce) çevirisi üzerine geliştirilmiş modern bir web uygulamasıdır. Kur'an-ı Kerim'i Arapça, Türkçe ve İngilizce çevirileriyle inceleme, farklı mealleri karşılaştırma, not alma ve kelime çevirisi gibi özelliklerle kullanıcı dostu bir deneyim sunar. Google Drive entegrasyonu ile notlarınızı güvenli bir şekilde kaydedebilirsiniz.</p>
    <p>Uygulama, [17:36] ayetinden ilhamla, "Hiçbir bilgiyi, kendiniz için teyit etmediğiniz sürece, kabul etmeyin" mesajıyla eleştirel düşünmeyi teşvik eder. Tema seçenekleri ve özelleştirilebilir arayüzü ile her cihazda kolayca kullanılabilir. Yetkilendirilmiş Çeviri’nin teyide ihtiyacı olmadığını vurgulayarak, İngilizce bilmeyenler için kelimelerin derin anlamlarına ulaşmayı hedefler.</p>
    
    <h3>Ana Özellikler</h3>
    <ul>
        <li><strong>Kur'an Okuma ve Çeviriler:</strong> Arapça metin, <strong>Türkçe (Yunusemre Şentürk - Mehmet Kablama çevirisi 2026)</strong> ve İngilizce çeviriler, transliterasyon çeviriler.</li>
        <li><strong>Not Alma ve Google Drive Entegrasyonu:</strong> Ayetler için kişisel notlarınızı Google Drive'a kaydedebilirsiniz.</li>
        <li><strong>Kelime Çevirisi:</strong> İngilizce kelimelerin üzerine geldiğinizde Türkçe çevirilerini görebilirsiniz.</li>
        <li><strong>Farklı Mealler:</strong> <em>Ayarlar &gt; “Mealler’i Göster”</em> seçeneğini açtığınızda her ayetin altında "📚 Mealler" butonu görünür; Diyanet Vakfı, Diyanet İşleri, Edip Yüksel vb. farklı çevirileri karşılaştırabilirsiniz. <strong></strong></li>
        <li><strong>Arama Fonksiyonu:</strong> Sure ve ayet numaralarıyla veya sure isimleriyle hızlı arama yapın.</li>
        <li><strong>Özelleştirilebilir Arayüz:</strong> Farklı temalar (açık, koyu, yeşil, mavi vb.) ve yazı boyutu seçenekleri.</li>
        <li><strong>Dış Kaynak Entegrasyonu:</strong> Harici bir Kur'an okuma platformuna geçiş yapma imkanı.</li>
    </ul>
    
    <h2>Kullanım Kılavuzu</h2>
    
    <h3>1. Genel Yapı ve Navigasyon</h3>
    <p>Kuran Teyit Yazılımı, kullanıcı dostu bir arayüze sahiptir ve aşağıdaki temel bileşenlerden oluşur:</p>
    <ul>
        <li><strong>Üst Menü:</strong>
            <ul>
                <li><strong>Menü Butonu (☰):</strong> Yan menüyü açar/kapar. Sure listesine, notlara ve ayarlara erişim sağlar.</li>
                <li><strong>Önceki/Sonraki Sayfa (⟵/⟶):</strong> Kur'an sayfaları arasında gezinmeyi sağlar.</li>
                <li><strong>Arama Alanı:</strong> Sure ve ayet aramak için kullanılır (ayrıntılar aşağıda).</li>
                <li><strong>Sayfa Göstergesi:</strong> Mevcut sayfa numarasını gösterir ve harici siteye geçiş için tıklanabilir.</li>
                <li><strong>Google Giriş/Çıkış:</strong> Not alma özelliği için Google Drive bağlantısını yönetir.</li>
            </ul>
        </li>
        <li><strong>Yan Menü:</strong>
            <ul>
                <li>Sure listesi, notlar sayfası ve ayarlar menüsüne erişim sağlar.</li>
                <li>Kapat butonu ile menüyü gizleyebilirsiniz.</li>
            </ul>
        </li>
        <li><strong>Ana İçerik Alanı:</strong>
            <ul>
                <li>Kur'an ayetlerini, çevirilerini, transliterasyonları çevirilerini ve notları görüntüler.</li>
                <li><strong>Mealler butonu:</strong> Ayarlar’da “Mealler’i Göster” açıksa her ayetin buton alanına 📚 Mealler görünür (Dipnot butonunun yanında). Ayar kapalıysa bu buton görünmez.</li>
                <li>Harici siteye geçiş yapıldığında iframe üzerinden başka bir Kur'an platformu gösterilir.</li>
            </ul>
        </li>
        <li><strong>Yükleme Göstergesi:</strong> Veri yüklenirken veya sayfalar arası geçişlerde görünür.</li>
        <li><strong>Kelime Tooltip:</strong> İngilizce ayetlerdeki kelimelerin üzerine geldiğinizde Türkçe çevirilerini gösterir.</li>
    </ul>
    
    <h3>3. Kur'an Okuma ve Çeviriler</h3>
    <ul>
        <li><strong>Sayfa Gezinme:</strong> Üst menüdeki "Önceki Sayfa" ve "Sonraki Sayfa" butonları ile 604 sayfalık Kur'an'da gezinebilirsiniz. Mevcut sayfa numarası üst menüde gösterilir.</li>
        <li><strong>Ayet Görünümü:</strong> Her ayet, Arapça metni, Türkçe ve Diğer çevirileri ile birlikte gösterilir. Transliterasyon (Türkçe okunuş) ayarı açıksa, Arapça metnin Latin harfleriyle okunuşu da görünür.</li>
        <li><strong>Mealler:</strong> 
            <ul>
                <li>Ayarlar > “Mealler’i Göster” açıldığında her ayetin altında 📚 Mealler butonu belirir (Dipnot butonunun yanında).</li>
                <li>Butona tıkladığınızda Diyanet Vakfı, Diyanet İşleri vb. kaynaklardan mealler ilgili ayetin altında açılır.</li>
                <li>Varsayılan: Kapalı. Ayar kapalıyken mealler butonu görünmez.</li>
                <li>Mealler kapalıyken diğer butonlar (📌 Dipnot, ✍️ Not Al) aynen çalışır.</li>
            </ul>
        </li>
        <li><strong></li>
    </ul>

    <h3>2. Arama Alanının Kullanımı</h3>
    <p>Arama alanı, Kur'an'da hızlı bir şekilde gezinmenizi sağlar. Sure numaraları, ayet numaraları veya sure isimleriyle arama yapabilirsiniz. Arama yaparken aşağıdaki formatları kullanabilirsiniz:</p>
    
    <h4>Arama Formatları ve Örnekler</h4>
    <ul>
        <li><strong>Sure ve Ayet Numarası:</strong>
            <ul>
                <li><strong>Format:</strong> <code>sure:ayet</code>, <code>sure/ayet</code> veya <code>sure ayet</code></li>
                <li><strong>Örnekler:</strong>
                    <ul>
                        <li><code>2:255</code> → Bakara suresinin 255. ayetine gider (Ayetü'l-Kürsi).</li>
                        <li><code>2/255</code> → Aynı şekilde Bakara 255'e gider.</li>
                        <li><code>2 255</code> → Boşlukla ayrılmış şekilde de çalışır.</li>
                    </ul>
                </li>
                <li><strong>Kullanım:</strong> Arama çubuğuna <code>2:255</code> yazın ve Enter tuşuna basın. Uygulama, ilgili sayfaya gider ve ayeti vurgular.</li>
            </ul>
        </li>
        <li><strong>Sure İsmi:</strong>
            <ul>
                <li><strong>Format:</strong> Sure adının tamamını veya bir kısmını yazabilirsiniz (büyük/küçük harf duyarlı değildir).</li>
                <li><strong>Örnekler:</strong>
                    <ul>
                        <li><code>Bakara</code> → Bakara suresinin başlangıç sayfasına gider.</li>
                        <li><code>Fatiha</code> → Fatiha suresine gider.</li>
                        <li><code>Yasin</code> → Yasin suresine gider.</li>
                    </ul>
                </li>
                <li><strong>Kullanım:</strong> Arama çubuğuna <code>Yasin</code> yazın ve Enter tuşuna basın. Uygulama, Yasin suresinin ilk sayfasına gider.</li>
            </ul>
        </li>
        <li><strong>Otomatik Tamamlama:</strong>
            <ul>
                <li>Arama çubuğuna yazmaya başladığınızda, otomatik tamamlama önerileri görünür.</li>
                <li><strong>Örnek:</strong> <code>Ba</code> yazdığınızda, "Bakara" gibi eşleşen sure isimleri listelenir. Önerilerden birine tıklayarak doğrudan ilgili sureye gidebilirsiniz.</li>
                <li>Ayet ararken, <code>2:25</code> yazdığınızda öneriler arasında ayet metninin bir kısmı görünür. Tıklayarak ayete ulaşabilirsiniz.</li>
            </ul>
        </li>
        <li><strong>Hata Durumları:</strong>
            <ul>
                <li>Eğer geçersiz bir format girerseniz (ör. <code>999:999</code>), uygulama bir uyarı mesajı gösterir: "Aradığınız sure veya ayet bulunamadı! Format: '2:209', '2/209' veya '2 209' veya sure ismi".</li>
                <li>Arama çubuğunu boş bırakıp Enter'a basarsanız, uyarı alırsınız.</li>
            </ul>
        </li>
    </ul>
    
    <h4>Arama İpuçları</h4>
    <ul>
        <li>Sayı formatında arama yaparken, sure ve ayet numarasını doğru girdiğinizden emin olun.</li>
        <li>Sure isimlerinde Türkçe karakterler (ör. "ı", "ş") kullanılabilir.</li>
        <li>Arama çubuğuna odaklandığınızda, daha önce yazdığınız bir arama varsa öneriler otomatik olarak görünür.</li>
        <li>Arama yaptıktan sonra, arama çubuğunu temizlemek için önerilere tıklayın veya Enter tuşuna basın.</li>
    </ul>
    
    <h3>3. Kur'an Okuma ve Çeviriler</h3>
    <ul>
        <li><strong>Sayfa Gezinme:</strong> Üst menüdeki "Önceki Sayfa" ve "Sonraki Sayfa" butonları ile 604 sayfalık Kur'an'da gezinebilirsiniz. Mevcut sayfa numarası üst menüde gösterilir.</li>
        <li><strong>Ayet Görünümü:</strong> Her ayet, Arapça metni, Türkçe ve İngilizce çevirileri ile birlikte gösterilir. Transliterasyon (Türkçe okunuş) ayarı açıksa, Arapça metnin Latin harfleriyle okunuşu da görünür.</li>
        <li><strong>Mealler:</strong> Her ayetin altında "📚 Mealler" butonuna tıklayarak farklı çevirmenlerin yorumlarını görebilirsiniz. Mealler, Abdülbaki Gölpınarlı, Diyanet Vakfı, Diyanet İşleri, Edip Yüksel gibi çeşitli kaynaklardan alınmıştır.</li>
        <li><strong></strong> </li>
    </ul>
    
    <h3>4. Not Alma ve Google Drive Entegrasyonu</h3>
    <ul>
        <li><strong>Not Alma:</strong>
            <ul>
                <li>Her ayetin altında "✍️ Not Al" butonuna tıklayın.</li>
                <li>Açılan metin kutusuna notunuzu yazın ve "💾 Kaydet" butonuna basın.</li>
                <li>Notlar, Google Drive'daki "Kuran_Teyit_Not" klasörüne otomatik olarak kaydedilir (ör. <code>2_255.txt</code> formatında).</li>
                <li>İptal etmek için "❌ İptal" butonuna tıklayın.</li>
            </ul>
        </li>
        <li><strong>Google Drive Bağlantısı:</strong>
            <ul>
                <li>Not alma özelliği için Google hesabınızla giriş yapmalısınız. Üst menüdeki Google Giriş butonuna tıklayın ve gerekli izinleri verin.</li>
                <li>Giriş yaptıktan sonra, notlarınız otomatik olarak yüklenir ve "Notlarım" sayfasında görüntülenir.</li>
                <li>Çıkış yapmak için "Çıkış" butonuna tıklayın; bu, tüm notları sıfırlar ve bağlantıyı keser.</li>
            </ul>
        </li>
        <li><strong>Notlar Sayfası:</strong>
            <ul>
                <li>Yan menüdeki "📝 Notlarım" seçeneğine tıklayın.</li>
                <li>Google Drive'daki tüm notlarınız, sure ve ayet numaralarına göre listelenir.</li>
                <li>Her not kartında ayete gitmek için "📖 Ayete Git" butonu bulunur.</li>
            </ul>
        </li>
    </ul>
    
    <h3>5. Kelime Çevirisi</h3>
    <ul>
        <li>İngilizce ayet metinlerindeki kelimelerin üzerine geldiğinizde, Türkçe çevirileri bir tooltip içinde görünür.</li>
        <li><strong>Örnek:</strong> "Mercy" kelimesinin üzerine geldiğinizde, tooltip "Merhamet" gibi çevirileri gösterebilir.</li>
        <li>Eğer kelime sözlükte yoksa, "Kelime bulunamadı" mesajı görünür.</li>
    </ul>
    
    <h3>6. Ayarlar ve Özelleştirme</h3>
    <ul>
        <li>Yan menüdeki "⚙️ Ayarlar" seçeneğine tıklayın.</li>
        <li><strong>Tema Seçimi:</strong> Açık, koyu, yeşil, mavi, kırmızı gibi 10 farklı tema arasından seçim yapabilirsiniz.</li>
        <li><strong>Yazı Boyutu:</strong> Küçük, orta veya büyük yazı boyutunu seçin.</li>
        <li><strong>Mealler’i Göster (yeni):</strong> Arapça-Türkçe Göster seçeneğinin üstünde yer alır. Açıldığında ayetlerin buton alanına 📚 Mealler butonu eklenir. Kapalıyken bu buton görünmez. Varsayılan: Kapalı.</li>
        <li><strong>Transliterasyon:</strong> "Arapça-Türkçe Göster" seçeneğini açarak/kapatarak transliterasyon görünümünü kontrol edebilirsiniz.</li>
        <li><strong>Google Drive Durumu:</strong> Bağlantı durumunu ve klasör hazır olup olmadığını kontrol edin.</li>
        <li><strong>Ayarları Kaydet:</strong> Değişiklikleri yaptıktan sonra "💾 Ayarları Kaydet" butonuna tıklayın.</li>
    </ul>

    
    <h3>7. Harici Siteye Geçiş</h3>
    <ul>
        <li>Üst menüdeki sayfa göstergesine (ör. "Kuran Oku") tıklayarak harici bir Kur'an platformuna (<a href="https://qurantft.com/" target="_blank">qurantft.com</a>) https://kuransonahit.tr/ geçiş yapabilirsiniz.</li>
        <li>Tekrar tıkladığınızda Kur'an görünümüne geri dönersiniz.</li>
    </ul>
    
    <h3>8. Önemli İpuçları</h3>
    <ul>
        <li><strong>Hızlı Erişim:</strong> Yan menüdeki sure listesinden istediğiniz sureye doğrudan gidebilirsiniz.</li>
        <li><strong>Mobil Uyumluluk:</strong> Uygulama, tablet ve telefonlarda da sorunsuz çalışır. Menü ve arama alanı mobil cihazlarda optimize edilmiştir.</li>
        <li><strong>Performans:</strong> Sayfalar, performans için toplu olarak yüklenir. Yükleme sırasında bir ilerleme çubuğu görünür.</li>
        <li><strong>Hata Bildirimleri:</strong> Uygulama, hatalar veya uyarılar için bildirimler gösterir (ör. "Not içeriği boş olamaz!").</li>
        <li><strong>Mealler İpucu:</strong> Mealler butonunu göremiyorum, neden?
    </ul>
    
    <h3>9. Sıkça Sorulan Sorular (SSS)</h3>
    <ul>
        <li><strong>Notlarım neden kaydedilmiyor?</strong> Google hesabınızla giriş yaptığınızdan ve gerekli izinleri verdiğinizden emin olun.</li>
        <li><strong>Arama neden çalışmıyor?</strong> Doğru formatta arama yaptığınızdan emin olun (ör. <code>2:255</code> veya <code>Bakara</code>).</li>
        <li><strong>Mealler butonunu göremiyorum, neden?</strong> Ayarlar menüsünden “Mealler’i Göster” seçeneğini açmalısınız. Bu ayar varsayılan olarak kapalıdır.</li>
        <li><strong>Hangi mealler mevcut?</strong> Abdülbaki Gölpınarlı, Diyanet Vakfı, Diyanet İşleri, Edip Yüksel gibi 12 farklı meal desteklenmektedir.</li>
        <li><strong>Tema değişiklikleri kalıcı mı?</strong> Evet, ayarlarınız tarayıcınızın yerel depolama alanına kaydedilir.</li>
    </ul>
    
    <h2>Son Söz</h2>
    <p>Kuran Teyit Yazılımı, Kur'an-ı Kerim'i daha derinlemesine anlamak ve kişisel notlarınızla zenginleştirmek için güçlü bir araçtır. Kullanıcı dostu arayüzü, zengin özellikleri ve modern tasarımıyla, Kur'an okumalarınıza yeni bir boyut katmayı hedefler. Sorularınız veya önerileriniz için; <strong>Berk KÖKSAL</strong> <a href=>berkgitarist@gmail.com</a> adresine ulaşabilirsiniz.</p>
`;

function displayGuidePage() {
  ensureQuranView();
  const html = `
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
  DOM.content.innerHTML = html;
  closeSidebar();
}

/* ========== Global (HTML onclick erişimi için) ========== */
window.goToPage = goToPage;
window.goToSura = goToSura;
window.goToVerse = goToVerse;
window.toggleMeal = toggleMeal;
window.toggleNote = toggleNote;
window.toggleNoteInput = toggleNoteInput;
window.saveNote = saveNote;
window.cancelNote = cancelNote;
window.displayGuidePage = displayGuidePage;
