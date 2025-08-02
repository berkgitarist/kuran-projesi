// PHP tabanlı not sistemi (Google API'siz)


// App configuration
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
    },
    folderName: 'Kuranteyit'
};

// Uygulama durumu (state)
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
        theme: 'light',
        fontSize: 'medium',
        translation: 'Diyanet İşleri',
        showTransliteration: true
    }
};


// DOM elements
const DOM = {
    content: document.getElementById('content'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    currentPageDisplay: document.getElementById('currentPageDisplay'),
    searchInput: document.getElementById('searchInput'),
    autocomplete: document.getElementById('autocomplete'),
    suraMenu: document.getElementById('suraMenu'),
    wordTooltip: document.getElementById('wordTooltip'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    body: document.body
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Intro ayet ekranını 5 saniye göster
    const intro = document.getElementById('introVerse');
    if (intro) {
        setTimeout(() => {
            intro.classList.add('fade-out');
        }, 5000); // 5 saniye bekleme
    }

    // 2. Geri kalan uygulama yükleme işlemleri
    loadSettings();
    await loadInitialData();
    buildSuraMenu();
    setupEventListeners();

    STATE.currentPage = 23;
    loadPagesAround(STATE.currentPage);

    const activeTheme = document.body.className;
    console.log(`Aktif tema: ${activeTheme}`);

    const box = document.querySelector('.verse-box');
    if (box) {
        box.addEventListener('mouseenter', () => {
            console.log('Ayet kutusu üzerine gelindi.');
        });
    }
});


function loadSettings() {
    const savedSettings = localStorage.getItem('quranAppSettings');
    if (savedSettings) {
        STATE.settings = JSON.parse(savedSettings);
        applySettings();
    }
}

function saveSettings() {
    localStorage.setItem('quranAppSettings', JSON.stringify(STATE.settings));
    applySettings();
    displayPage(STATE.currentPage);
}

function applySettings() {
    DOM.body.className = `${STATE.settings.theme}-theme`;
    const sizes = { small: '10px', medium: '14px', large: '24px' };
    const fontSize = sizes[STATE.settings.fontSize];

    const elementsToStyle = [
        '.verse-transliteration',
        '.verse-text',
        '.verse-text-tr',
        '.note-box',
        '.ai-translation',
        '.meal-container',
        '.passage-title',
        '.passage-title-tr',
        '.note-input-box textarea',
        '.word-tooltip',
        '.autocomplete-suggestions div',
        '.settings-section',
        '.about-section p',
        '.about-section li'
    ];

    elementsToStyle.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.fontSize = fontSize;
        });
    });
}


function setupEventListeners() {
    document.getElementById('prevPage').addEventListener('click', () => {
        if (STATE.currentPage > 1) {
            goToPage(STATE.currentPage - 1);
        }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        if (STATE.currentPage < STATE.totalPages) {
            goToPage(STATE.currentPage + 1);
        }
    });

    document.getElementById('menuToggle').addEventListener('click', () => {
        const isSidebarOpen = !DOM.sidebar.classList.contains('hidden');
        DOM.sidebar.classList.toggle('hidden');
        DOM.sidebarOverlay.classList.toggle('hidden');
        document.body.style.overflow = isSidebarOpen ? '' : 'hidden';
        
        const menuSection = DOM.sidebar.querySelector('.menu-section');
        const notesPage = document.getElementById('notesPage');
        const settingsPage = document.getElementById('settingsPage');
        const closeMenu = document.getElementById('closeMenu');
        if (menuSection && !isSidebarOpen) {
            menuSection.style.display = 'flex';
            [notesPage, settingsPage, closeMenu].forEach(btn => {
                if (btn) btn.style.display = 'block';
            });
        }
    });

    document.getElementById('closeMenu').addEventListener('click', () => {
        DOM.sidebar.classList.add('hidden');
        DOM.sidebarOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    });

    document.getElementById('sidebarOverlay').addEventListener('click', () => {
        DOM.sidebar.classList.add('hidden');
        DOM.sidebarOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    });

    document.getElementById('settingsPage').addEventListener('click', () => {
        displaySettingsPage();
        DOM.sidebar.classList.add('hidden');
        DOM.sidebarOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    });

    setupSearch();
}

async function loadInitialData() {
    showLoading();

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

        hideLoading();
    } catch (error) {
        console.error("Initial data loading error:", error);
        hideLoading();
        DOM.content.innerHTML = '<div class="error-message">Veri yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</div>';
    }
}

async function loadDataFile(path, key) {
    return new Promise((resolve, reject) => {
        fetch(path)
            .then(response => response.json())
            .then(data => {
                STATE.data[key] = data;
                resolve();
            })
            .catch(error => {
                console.error(`Error loading ${key} data:`, error);
                reject(error);
            });
    });
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
                        if (parantezLine) {
                            cleanedTitle += " " + parantezLine;
                        }
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
                    const json = await response.json();
                    const mealName = file.replace('.json', '');
                    STATE.data.meals[mealName] = json;
                } catch (err) {
                    console.error(`${file} yüklenirken hata:`, err);
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
    const startPage = Math.max(1, pageNum - STATE.settings.initialLoad);
    const endPage = Math.min(STATE.totalPages, pageNum + STATE.settings.initialLoad);

    const pagesToLoad = [];
    for (let i = startPage; i <= endPage; i++) {
        if (!STATE.loadedPages.has(i)) {
            pagesToLoad.push(i);
        }
    }

    if (pagesToLoad.length > 0) {
        loadPagesBatch(pagesToLoad);
    }

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
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (pageNumbers.includes(STATE.currentPage)) {
            displayPage(STATE.currentPage);
        }
    } catch (error) {
        console.error("Sayfa yüklenirken hata:", error);
    } finally {
        STATE.isLoading = false;
        hideLoading();
    }
}

function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > STATE.totalPages) return;

    STATE.currentPage = pageNum;

    if (STATE.loadedPages.has(pageNum)) {
        displayPage(pageNum);
    } else {
        loadPagesAround(pageNum);
    }

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });

    if (!STATE.isLoading) {
        const startPage = Math.max(1, pageNum - STATE.settings.initialLoad);
        const endPage = Math.min(STATE.totalPages, pageNum + STATE.settings.initialLoad);

        const pagesToLoad = [];
        for (let i = startPage; i <= endPage; i++) {
            if (!STATE.loadedPages.has(i)) {
                pagesToLoad.push(i);
            }
        }

        if (pagesToLoad.length > 0) {
            loadPagesBatch(pagesToLoad);
        }
    }
}

function goToSura(suraNum) {
    if (STATE.metadata.sureToPageMap[suraNum]) {
        goToPage(STATE.metadata.sureToPageMap[suraNum]);

        DOM.sidebar.classList.add('hidden');
        DOM.sidebarOverlay.classList.add('hidden');
        document.body.style.overflow = '';

        setTimeout(() => {
            scrollToVerse(suraNum, 1);
        }, 300);
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
                <div class="verse-text-tr"><strong>${trSura.verses[verseNum]}</strong></div>`;

            html += `<div class="buttons">`;
            if (hasNotes) {
                html += `<button class="toggle-btn dipnot-btn" onclick="toggleNote('note-${suraNum}-${verseNum}')">📌 Dipnot</button>`;
            }
            html += `
                <button class="toggle-btn" onclick="toggleMeal('meal-${suraNum}-${verseNum}', ${suraNum}, ${verseNum})">📚 Mealler</button>
                <button class="toggle-btn note-btn" onclick="toggleNoteInput('note-input-box-${suraNum}-${verseNum}', ${suraNum}, ${verseNum})">✍️ Not Al</button>
            </div>`;

            html += `<div id="ai-translation-${suraNum}-${verseNum}" class="ai-translation">`;
            if (STATE.data.ai[suraNum] && STATE.data.ai[suraNum].verses && STATE.data.ai[suraNum].verses[verseNum]) {
                html += `<strong>AI ÇEVİRİ</strong> ${STATE.data.ai[suraNum].verses[verseNum]}`;
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

            // Kullanıcı notlarını ekle
            const noteKey = `${suraNum}:${verseNum}`;
            html += `<div id="user-note-${suraNum}-${verseNum}" class="note-box hidden"></div>`;

            html += `<div id="meal-${suraNum}-${verseNum}" class="note-box hidden"></div>`;
            html += `<div id="note-input-box-${suraNum}-${verseNum}" class="note-input-box hidden">
                        <textarea id="note-input-${suraNum}-${verseNum}" placeholder="Notunuzu buraya yazın..."></textarea>
                        <button onclick="saveNote(${suraNum}, ${verseNum})">Kaydet</button>
                     </div>`;
			html += `<div id="all-notes-${suraNum}-${verseNum}" class="note-box hidden"></div>`;

            html += `</div>`;
        }

        html += `</div>`;
    }

    html += `<div class="page-footer">`;
    if (STATE.currentPage > 1) {
        html += `<button class="header-btn" onclick="goToPage(${STATE.currentPage - 1})">⟵ Geri</button>`;
    }
    if (STATE.currentPage < STATE.totalPages) {
        html += `<button class="header-btn" onclick="goToPage(${STATE.currentPage + 1})">İleri ⟶</button>`;
    }
    html += `</div>`;

    DOM.content.innerHTML = html;

    document.querySelectorAll('.verse-arabic').forEach(el => {
        el.style.textAlign = 'right';
        el.style.direction = 'rtl';
    });

    attachWordTranslation();
    loadNotesForPage(pageNum, suraNums, enPage);
    applySettings();
}

function loadNotesForPage(pageNum, suraNums, enPage) {
    for (const suraNum of suraNums) {
        const verseKeys = Object.keys(enPage.sura[suraNum].verses);
        for (const verseNum of verseKeys) {
            loadNotes(suraNum, verseNum);
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
                        let color = '';
                        switch (index % 3) {
                            case 0: color = 'red'; break;
                            case 1: color = 'green'; break;
                            case 2: color = 'blue'; break;
                        }
                        return `<strong style="color: ${color}">${trans}</strong>`;
                    }).join(', ');
                    tooltip.innerHTML = `"${word}" ➔ ${translations}`;
                } else {
                    tooltip.innerHTML = `"${word}" ➔ <span style="color: red;">Kelime bulunamadı</span>`;
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

function saveNote(sura, verse) {
    const textarea = document.getElementById(`note-input-${sura}-${verse}`);
    const note = textarea.value.trim();

    if (!note) {
        alert("Not boş olamaz.");
        return;
    }

    fetch('/api/save_note.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sura, verse, note }),
        credentials: 'include' // ✅ oturum için gerekli
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Not kaydedildi.');
        } else {
            alert('Not kaydedilemedi: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Hata:', error);
        alert('Sunucu hatası: not kaydedilemedi.');
    });
}



function loadNotes(sura, verse) {
    fetch(`get_notes.php?sura=${sura}&verse=${verse}`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById(`all-notes-${sura}-${verse}`);
            if (!container) return;

            if (data.length === 0) {
                container.innerHTML = '<div class="note-box">Henüz not alınmamış.</div>';
                return;
            }

            let html = '';
            data.forEach(note => {
                html += `
                    <div class="note-box">
                        <strong>${note.username}</strong> (${note.email})<br>
                        <div>${note.note}</div>
                        <small>${note.created_at}</small>
                    </div>
                `;
            });

            container.innerHTML = html;
        })
        .catch(err => {
            console.error("Notlar yüklenirken hata:", err);
        });
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
    if (element) {
        element.classList.toggle('hidden');
    }
}


function displaySettingsPage() {
    const themes = [
        { name: 'light', label: 'Açık' },
        { name: 'dark', label: 'Koyu' },
        { name: 'green', label: 'Yeşil' },
        { name: 'indigo', label: 'Çivit' },
        { name: 'brown', label: 'Kahverengi' },
        { name: 'sky', label: 'Gece' }
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
                    Transkripsiyon Göster
                </label>
            </div>

            <div class="settings-section">
                <h2>Kullanma Talimatı</h2>
                <div class="about-section">
                    <p>Bu yazılımda:</p>
                    <ul>
                        <li>İngilizce metin üzerine geldiğinizde, İngilizce kelimelerin Türkçe çevirileri bir tooltip içinde görünür. <strong>20 adet yapay zeka kelime çevirisi</strong> eklenmiştir.</li>
                        <li>İngilizce metnin altında yer alan Türkçe çeviri, <strong>"İskender Durmaz ve Soner Tahsinoğlu"</strong> tarafından hazırlanmıştır.</li>
                        <li>Sure ve ayet aramak için üstteki arama çubuğunu kullanabilirsiniz. Örnek format: <strong>2:209</strong> veya sure ismi.</li>
                        
                        <li>Mealler, farklı çevirmenlerin yorumlarını görmek için <strong>Mealler</strong> butonuna tıklayın.</li>
                        <li>Tema ve yazı boyutu ayarlarını bu sayfadan özelleştirebilirsiniz.</li>
						<li>AI ÇEVİRİ: Yapay zeka destekli 3 farklı çeviri sunulmuştur. Bu çevirilerde hatalar bulunabilir.</li>
						<li><strong>"Her Ayetin Altında, Kullanıcıya Özel Not Almak"</strong> için geliştirmeler devam etmektedir.</li>
						<li><strong>Hata gördüğünüz alanları lütfen bildiriniz.</strong> İlk adımı attık, birlikte büyüteceğiz inşallah. Dualarınızla... 💚</li>
                    </ul>
                </div>
            </div>

            <button class="toggle-btn" id="saveSettingsBtn">Ayarları Kaydet</button>
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

    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
}


function goToVerse(suraNum, verseNum) {
    if (STATE.metadata.sureToPageMap[suraNum]) {
        goToPage(STATE.metadata.sureToPageMap[suraNum]);

        setTimeout(() => {
            const verseElement = Array.from(document.querySelectorAll('.verse-number')).find(
                el => el.textContent.trim() === `${suraNum}:${verseNum}`
            );
            if (verseElement) {
                verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const verseContainer = verseElement.closest('.verse');
                if (verseContainer) {
                    verseContainer.style.boxShadow = '0 0 20px rgba(10, 104, 71, 0.5)';
                    setTimeout(() => {
                        verseContainer.style.boxShadow = '';
                    }, 3000);
                }
            }
        }, 500);
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
        const elementTop = targetElement.offsetTop;
        const offsetPosition = elementTop - headerHeight - 50;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });

        targetElement.style.boxShadow = '0 0 20px rgba(10, 104, 71, 0.5)';
        setTimeout(() => {
            targetElement.style.boxShadow = '';
        }, 3000);
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

        const verseMatch = val.match(/^(\d+):(\d+)$/);
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

                div.onclick = () => {
                    navigateToSuggestion(suggestion, searchInput);
                };
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

            const verseMatch = val.match(/^(\d+):(\d+)$/);
            if (verseMatch) {
                const [_, suraNum, verseNum] = verseMatch;

                if (STATE.data.en && STATE.data.tr) {
                    for (let page in STATE.data.en) {
                        const enPage = STATE.data.en[page];
                        if (enPage.sura[suraNum] && enPage.sura[suraNum].verses[verseNum]) {
                            goToPage(parseInt(page));
                            searchInput.value = '';
                            autocomplete.style.display = 'none';

                            setTimeout(() => {
                                scrollToVerse(suraNum, verseNum);
                            }, 300);

                            return;
                        }
                    }

                    alert(`${suraNum}:${verseNum} ayeti bulunamadı!`);
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
                alert('Aradığınız sure veya ayet bulunamadı! Format: "2:209" veya sure ismi');
            }
        }
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            autocomplete.style.display = 'none';
        }, 200);
    });

    searchInput.addEventListener('focus', () => {
        const val = searchInput.value.toLowerCase().trim();
        if (val.length >= 1) {
            autocomplete.style.display = 'block';
        }
    });
}

function navigateToSuggestion(suggestion, inputElement) {
    if (suggestion.type === 'verse') {
        goToPage(suggestion.page);
        setTimeout(() => {
            scrollToVerse(suggestion.suraNum, suggestion.verseNum);
        }, 300);
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

    loadingOverlay.autoHideTimeout = setTimeout(() => {
        hideLoading();
    }, 2000);
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

document.getElementById('notesPage').addEventListener('click', () => {
    displayNotesPage(); // Bu fonksiyonu JS'e ekleyeceğiz
    DOM.sidebar.classList.add('hidden');
    DOM.sidebarOverlay.classList.add('hidden');
    document.body.style.overflow = '';
});

function displayNotesPage() {
    DOM.content.innerHTML = `
        <div class="page-header">
            <h1>📝 Notlarım</h1>
        </div>
        <div class="sura" id="userNotesContainer">
            <p>Notlarınız yükleniyor...</p>
        </div>
    `;

    fetch('get_user_notes.php', {
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById('userNotesContainer');

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = `<p>Henüz bir notunuz yok.</p>`;
            return;
        }

        let html = '';
        data.forEach(note => {
            html += `
                <div class="note-box">
                    <div><strong>🕋 Ayet:</strong> ${note.sura}:${note.verse}</div>
                    <div><strong>🗒️ Not:</strong> ${note.note}</div>
                    <div><small>🕑 ${note.created_at}</small></div>
                </div>
            `;
        });

        container.innerHTML = html;
    })
    .catch(err => {
        console.error('Notlar alınırken hata:', err);
        const container = document.getElementById('userNotesContainer');
        container.innerHTML = '<p>Notlar yüklenemedi.</p>';
    });
}

// Bu fonksiyon dışarıda olmalı!
function toggleNoteInput(id, sura, verse) {
    const element = document.getElementById(id);
    if (!element) return;

    element.classList.toggle('hidden');
    if (!element.classList.contains('hidden')) {
        const textarea = document.getElementById(`note-input-${sura}-${verse}`);
        if (textarea) textarea.focus();
    }
}
