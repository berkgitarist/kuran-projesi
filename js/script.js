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
        'Yusuf Ali (İngilizce).json'
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
        showTransliteration: true
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
});

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

function setupEventListeners() {
    document.getElementById('prevPage').addEventListener('click', () => {
        if (STATE.currentPage > 1) goToPage(STATE.currentPage - 1);
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        if (STATE.currentPage < STATE.totalPages) goToPage(STATE.currentPage + 1);
    });

    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    document.getElementById('closeMenu').addEventListener('click', closeSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

    document.getElementById('settingsPage').addEventListener('click', () => {
        displaySettingsPage();
        closeSidebar();
    });

    document.getElementById('notesPage').addEventListener('click', () => {
        displayNotesPage();
        closeSidebar();
    });

    document.getElementById('currentPageDisplay').addEventListener('click', toggleExternalSite);

    setupSearch();
}

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
    DOM.quranContent.style.display = 'block'; // Ekstra görünürlük garantisi
}

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
        await loadMeals();
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

async function loadMeals() {
    showLoading('Mealler yükleniyor...');
    try {
        for (let i = 0; i < CONFIG.mealFiles.length; i += CONFIG.batchSize) {
            const batch = CONFIG.mealFiles.slice(i, i + CONFIG.batchSize);
            await Promise.all(batch.map(async file => {
                try {
                    const response = await fetch(`./data/mealler/${file}`);
                    if (response.ok) {
                        const json = await response.json();
                        const mealName = file.replace('.json', '');
                        STATE.data.meals[mealName] = json;
                    }
                } catch (err) {
                    console.warn(`${file} yüklenirken hata:`, err);
                }
            }));
            const progress = Math.min(100, ((i + CONFIG.batchSize) / CONFIG.mealFiles.length) * 100);
            updateLoadingProgress(progress);
        }
    } catch (error) {
        console.error("Meal yükleme hatası:", error);
    } finally {
        hideLoading();
    }
}

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

function scrollToVerse(suraNum, verseNum) {
    const verseElements = document.querySelectorAll('.verse-number');
    let targetElement = null;
    verseElements.forEach(el => {
        if (el.textContent.trim() === `${suraNum}:${verseNum}`) {
            targetElement = el.closest('.verse');
        }
    });
    if (targetElement) {
        const headerHeight = document.querySelector('.header-bar').offsetHeight;
        const offsetPosition = targetElement.offsetTop - headerHeight - 50;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        targetElement.style.boxShadow = '0 0 20px rgba(10, 104, 71, 0.5)';
        setTimeout(() => targetElement.style.boxShadow = '', 3000);
    }
}

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
            html += `
                <button class="toggle-btn" onclick="toggleMeal('meal-${suraNum}-${verseNum}', ${suraNum}, ${verseNum})">📚 Mealler</button>
                <button class="toggle-btn note-btn" onclick="toggleNoteInput('note-input-box-${suraNum}-${verseNum}', ${suraNum}, ${verseNum})">✍️ Not Al</button>
                </div>
                <div id="ai-translation-${suraNum}-${verseNum}" class="ai-translation">`;
            if (STATE.data.ai[suraNum] && STATE.data.ai[suraNum].verses && STATE.data.ai[suraNum].verses[verseNum]) {
                html += `<strong>AI ÇEVİRİ:</strong> ${STATE.data.ai[suraNum].verses[verseNum]}`;
            } else {
                html += `<strong>AI ÇEVİRİ:</strong> Çeviri bulunamadı.`;
            }
            html += `</div>`;
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
            html += `<div id="user-note-${suraNum}-${verseNum}" class="note-box hidden"></div>
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
    DOM.content.innerHTML = html;
    document.querySelectorAll('.verse-arabic').forEach(el => {
        el.style.textAlign = 'right';
        el.style.direction = 'rtl';
    });
    attachWordTranslation();
    loadNotesForCurrentPage();
    applySettings();
}

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

function buildSuraMenu() {
    let html = '';
    const sortedSuraNums = Object.keys(STATE.metadata.sureNames).sort((a, b) => Number(a) - Number(b));
    sortedSuraNums.forEach(suraNum => {
        html += `<li onclick="goToSura(${suraNum})">${STATE.metadata.sureNames[suraNum]}</li>`;
    });
    DOM.suraMenu.innerHTML = html;
}

function getOtherTranslations(suraNum, verseNum) {
    const suraIndex = parseInt(suraNum) - 1;
    let html = '';
    for (const mealName in STATE.data.meals) {
        const meal = STATE.data.meals[mealName];
        const sure = meal.sures?.[suraIndex];
        if (sure && sure.ayetler) {
            const ayet = sure.ayetler.find(a => String(a[0]) === String(verseNum));
            if (ayet) {
                html += `<div class="note-tr"><strong>${mealName}:</strong> ${ayet[1]}</div>`;
            }
        }
    }
    return html || '<div>Bu ayet için diğer mealler bulunamadı.</div>';
}

function attachWordTranslation() {
    const tooltip = DOM.wordTooltip;
    document.querySelectorAll('.verse-text').forEach(el => {
        const text = el.textContent;
        const words = text.split(/\s+/);
        el.innerHTML = '';
        words.forEach(word => {
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
                if (STATE.data.dictionary[cleanWord]) {
                    const translations = STATE.data.dictionary[cleanWord].split(', ').map((trans, index) => {
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

function toggleMeal(id, suraNum, verseNum) {
    const element = document.getElementById(id);
    if (!element.innerHTML.trim()) {
        element.innerHTML = getOtherTranslations(suraNum, verseNum);
    }
    element.classList.toggle('hidden');
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
                    <input type="checkbox" id="showTransliteration" 
                           ${STATE.settings.showTransliteration ? 'checked' : ''}>
                    Arapça-Türkçe Göster
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
                <h2>Kullanım Kılavuzu</h2>
                <div class="about-section">
                    <ul>
                        <li><strong>Not Alma:</strong> Her ayetin altındaki "✍️ Not Al" butonuna tıklayarak notlarınızı Google Drive'a kaydedebilirsiniz.</li>
                        <li><strong>Kelime Çevirisi:</strong> İngilizce kelimelerin üzerine fareyle geldiğinizde Türkçe çevirilerini görebilirsiniz.</li>
                        <li><strong>Arama:</strong> Üstteki arama kutusuna sure adı veya ayet numarası (örn: "2:255") yazabilirsiniz.</li>
                        <li><strong>Mealler:</strong> Farklı çevirmenlerden çevirileri görmek için "📚 Mealler" butonunu kullanın.</li>
                        <li><strong>Google Drive:</strong> Notlarınız otomatik olarak "Kuran_Teyit_Not" klasörüne kaydedilir.</li>
                    </ul>
                </div>
            </div>
            <button class="toggle-btn" id="saveSettingsBtn">💾 Ayarları Kaydet</button>
            <button class="toggle-btn" onclick="goToPage(${STATE.currentPage})">🔙 Kuran'a Dön</button>
        </div>
    </div>`;
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
    document.getElementById('showTransliteration').addEventListener('change', (e) => {
        STATE.settings.showTransliteration = e.target.checked;
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
            q: `'${folderId}' in parents and trashed=false and name contains '.txt'`,
            fields: 'files(id,name,modifiedTime)',
            orderBy: 'modifiedTime desc',
            spaces: 'drive'
        });
        if (!listResponse.result.files || listResponse.result.files.length === 0) {
            notesList.innerHTML = '<p>Henüz kaydedilmiş notunuz bulunmuyor.</p>';
            return;
        }
        let html = '<div class="notes-grid">';
        for (const file of listResponse.result.files) {
            const fileName = file.name;
            const match = fileName.match(/^(\d+)_(\d+)\.txt$/);
            if (match) {
                const [, sura, verse] = match;
                const content = await loadNoteFromDrive(sura, verse);
                const suraName = STATE.metadata.sureNames[sura] || `Sure ${sura}`;
                const modifiedDate = new Date(file.modifiedTime).toLocaleDateString('tr-TR');
                html += `
                <div class="note-card">
                    <div class="note-header">
                        <h3>${suraName} ${sura}:${verse}</h3>
                        <span class="note-date">${modifiedDate}</span>
                    </div>
                    <div class="note-content">${content.substring(0, 150)}${content.length > 150 ? '...' : ''}</div>
                    <div class="note-actions">
                        <button onclick="goToVerse(${sura}, ${verse})" class="go-to-verse-btn">📖 Ayete Git</button>
                    </div>
                </div>`;
            }
        }
        html += '</div>';
        notesList.innerHTML = html;
    } catch (error) {
        console.error("Notlar yüklenirken hata:", error);
        notesList.innerHTML = '<p>Notlar yüklenirken bir hata oluştu.</p>';
    }
}

function setupSearch() {
    const searchInput = DOM.searchInput;
    const autocomplete = DOM.autocomplete;
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
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
                        const trVerseText = STATE.data.tr[page].sura[suraNum]?.verses[verseNum] || enPage.sura[suraNum].verses[verseNum];
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
        if (found) {
            suggestions.sort((a, b) => a.priority - b.priority);
            suggestions.slice(0, 8).forEach(suggestion => {
                const div = document.createElement('div');
                if (suggestion.type === 'verse') {
                    div.innerHTML = `<strong>${suggestion.suraNum}:${suggestion.verseNum}</strong> - ${suggestion.text.replace(suggestion.text.split(' - ')[0] + ' - ', '')}`;
                } else {
                    div.innerHTML = `<strong>${suggestion.suraNum}:</strong> ${suggestion.suraName}`;
                }
                div.onclick = () => navigateToSuggestion(suggestion, searchInput);
                autocomplete.appendChild(div);
            });
            autocomplete.style.display = 'block';
        } else {
            autocomplete.style.display = 'none';
        }
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
