let enData, trData, translitData, meals = {};
let currentPage = 1;
let sureNames = {};
let sureToPageMap = {};
let manualDictionary = {};

const mealFiles = [
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
];

async function loadData() {
    try {
        const [enRes, trRes, translitRes] = await Promise.all([
            fetch('./data/qurantft.json'),
            fetch('./data/quran_tr.json'),
            fetch('./data/Turkce_Transkript.json')
        ]);

        enData = await enRes.json();
        trData = await trRes.json();
        translitData = await translitRes.json();

        await loadMeals();

        for (let page in trData) {
            for (let suraNum in trData[page].sura) {
                if (!sureNames[suraNum]) {
                    const titles = trData[page].sura[suraNum].titles;
                    if (titles && titles["1"]) {
                        const lines = titles["1"].split("\n").map(l => l.trim()).filter(l => l);
                        const sureLine = lines.find(l => l.startsWith("Sure "));
                        const parantezLine = lines.find(l => l.startsWith("("));

                        if (sureLine) {
                            let cleanedTitle = sureLine.replace(/^Sure\s*/, "").trim();
                            if (parantezLine) {
                                cleanedTitle += " " + parantezLine;
                            }
                            sureNames[suraNum] = cleanedTitle;
                            sureToPageMap[suraNum] = parseInt(page);
                        }
                    }
                }
            }
        }

    } catch (error) {
        console.error("Veri yüklenirken hata oluştu:", error);
    }
}

async function loadMeals() {
    for (const file of mealFiles) {
        try {
            const response = await fetch(`./data/mealler/${file}`);
            const json = await response.json();
            const mealName = file.replace('.json', '');
            meals[mealName] = json;
        } catch (err) {
            console.error(`${file} yüklenirken hata:`, err);
        }
    }
}

async function loadManualDictionary() {
    try {
        const res = await fetch('./data/manual-dictionary.json');
        manualDictionary = await res.json();
    } catch (e) {
        console.error("Sözlük yüklenirken hata:", e);
    }
}

function buildSuraMenu() {
    let html = '';
    const sortedSuraNums = Object.keys(sureNames).sort((a, b) => Number(a) - Number(b));
    sortedSuraNums.forEach(suraNum => {
        html += `<li onclick="goToSura(${suraNum})">${sureNames[suraNum]}</li>`;
    });
    document.getElementById('suraMenu').innerHTML = html;
}

function goToPage(pageNum) {
    if (pageNum >= 1 && pageNum <= Object.keys(enData).length) {
        currentPage = pageNum;
        displayPage(currentPage);
    }
}

function goToSura(suraNum) {
    if (sureToPageMap[suraNum]) {
        currentPage = sureToPageMap[suraNum];
        displayPage(currentPage);
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

function getOtherTranslations(suraNum, verseNum) {
    const suraIndex = parseInt(suraNum) - 1;
    let html = '';

    for (const mealName in meals) {
        const meal = meals[mealName];
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
    const tooltip = document.getElementById('wordTooltip');

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
                if (manualDictionary[cleanWord]) {
                    const translations = manualDictionary[cleanWord].split(', ').map((trans, index) => {
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

function saveNote(suraNum, verseNum) {
    const noteId = `note-input-${suraNum}-${verseNum}`;
    const textarea = document.getElementById(noteId);
    const noteText = textarea.value.trim();
    const key = `note_${suraNum}:${verseNum}`;
    
    if (noteText) {
        localStorage.setItem(key, noteText);
    } else {
        localStorage.removeItem(key);
    }
    
    toggleNoteInput(noteId.replace('note-input-', 'note-input-box-'));
}

function loadNote(suraNum, verseNum) {
    const key = `note_${suraNum}:${verseNum}`;
    return localStorage.getItem(key) || '';
}

function toggleNoteInput(id) {
    const element = document.getElementById(id);
    if (element) {
        element.classList.toggle('hidden');
    }
}

function displayPage(pageNum) {
    const enPage = enData[pageNum];
    const trPage = trData[pageNum];

    if (!enPage || !trPage) {
        document.getElementById('content').innerHTML = '<p>Sayfa bulunamadı.</p>';
        document.getElementById('currentPageDisplay').textContent = "Bilinmeyen";
        return;
    }

    let pageTitle = "Bilinmeyen";
    const suraNums = Object.keys(enPage.sura).sort((a, b) => Number(a) - Number(b));
    if (suraNums.length > 0) {
        const suraTitles = suraNums.map(num => sureNames[num] || `Sure ${num}`);
        pageTitle = suraTitles.join(" | ");
    }

    let enSuraTitles = [];
    let subheader = "";
    for (const suraNum of suraNums) {
        const enSura = enPage.sura[suraNum];
        if (enSura.titles && enSura.titles["1"]) {
            const lines = enSura.titles["1"].split("\n").map(l => l.trim()).filter(l => l);
            const engTitleLine = lines.find(l => l.startsWith("Sura"));
            if (engTitleLine) {
                enSuraTitles.push(engTitleLine.replace(/^Sura\s*/, "").trim());
                if (!subheader && suraNum === suraNums[0]) {
                    subheader = `${suraNum}: ${engTitleLine.replace(/^Sura\s*/, "").trim()}`;
                }
            }
        }
    }
    const englishTitle = enSuraTitles.join(" | ");

    document.getElementById('currentPageDisplay').textContent = pageTitle;

    let html = `
    <div class="page-header">
        <div class="subheader">${subheader}</div>
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
                <div class="verse-arabic">${enSura.encrypted[verseNum]}</div>
                <div class="verse-transliteration">${translitData[suraNum]?.verses[verseNum] || ''}</div>
                <div class="verse-text">${enSura.verses[verseNum]}</div>
                <div class="verse-text-tr"><strong>${trSura.verses[verseNum]}</strong></div>`;

            const noteId = `note-${suraNum}-${verseNum}`;
            const mealId = `meal-${suraNum}-${verseNum}`;
            const noteInputId = `note-input-box-${suraNum}-${verseNum}`;

            html += `<div class="buttons">`;
            if (hasNotes) {
                html += `<button class="toggle-btn dipnot-btn" onclick="toggleNote('${noteId}')">📌 Dipnot</button>`;
            }
            html += `<button class="toggle-btn" onclick="toggleMeal('${mealId}', ${suraNum}, ${verseNum})">📚 Diğer Mealler</button>`;
            html += `<button class="toggle-btn note-btn" onclick="toggleNoteInput('${noteInputId}')">✍️ Not Al</button>`;
            html += `</div>`;

            if (hasNotes) {
                html += `<div id="${noteId}" class="note-box hidden">`;
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

            html += `<div id="${mealId}" class="note-box hidden"></div>`;
            html += `<div id="${noteInputId}" class="note-input-box hidden">
                        <textarea id="note-input-${suraNum}-${verseNum}" placeholder="Notunuzu buraya yazın...">${loadNote(suraNum, verseNum)}</textarea>
                        <button onclick="saveNote(${suraNum}, ${verseNum})">Kaydet</button>
                     </div>`;

            html += `</div>`; // verse end
        }

        html += `</div>`; // sura end
    }

    document.getElementById('content').innerHTML = html;
    attachWordTranslation();
}

function displayNotesPage() {
    let html = `
    <div class="page-header">
        <h1>📝 Kayıtlı Notlar</h1>
    </div>
    <div class="sura">
        <div class="verse">
    `;

    let hasNotes = false;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('note_')) {
            hasNotes = true;
            const [suraNum, verseNum] = key.replace('note_', '').split(':');
            const noteText = localStorage.getItem(key);
            html += `
            <div class="verse-number">${suraNum}:${verseNum}</div>
            <div class="note-box">${noteText}</div>
            <button class="toggle-btn" onclick="localStorage.removeItem('note_${suraNum}:${verseNum}'); displayNotesPage();">Notu Sil</button>
            <hr>
            `;
        }
    }

    if (!hasNotes) {
        html += `<div class="note-box">Henüz not alınmamış.</div>`;
    }

    html += `</div></div>`;
    document.getElementById('content').innerHTML = html;
}

function toggleNote(id) {
    const element = document.getElementById(id);
    if (element) {
        element.classList.toggle('hidden');
    }
}

function toggleMeal(id, suraNum, verseNum) {
    const element = document.getElementById(id);
    if (!element.innerHTML.trim()) {
        element.innerHTML = getOtherTranslations(suraNum, verseNum);
    }
    element.classList.toggle('hidden');
}

document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        displayPage(currentPage);
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    if (currentPage < Object.keys(enData).length) {
        currentPage++;
        displayPage(currentPage);
    }
});

document.getElementById('notesPage').addEventListener('click', () => {
    displayNotesPage();
});

document.getElementById('searchInput').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim();
    const box = document.getElementById('autocomplete');
    box.innerHTML = '';

    if (val.length < 2) {
        box.style.display = 'none';
        return;
    }

    let found = false;
    const suggestions = [];

    for (const suraNum in sureNames) {
        const suraName = sureNames[suraNum].toLowerCase();
        if (suraName.includes(val)) {
            found = true;
            suggestions.push({ suraNum, suraName: sureNames[suraNum], type: 'sura' });
        }
    }

    const verseMatch = val.match(/^(\d+):(\d+)$/);
    if (verseMatch) {
        const [_, suraNum, verseNum] = verseMatch;
        if (enData && trData) {
            for (let page in enData) {
                const enPage = enData[page];
                if (enPage.sura[suraNum] && enPage.sura[suraNum].verses[verseNum]) {
                    found = true;
                    const trVerseText = trData[page].sura[suraNum]?.verses[verseNum] || enPage.sura[suraNum].verses[verseNum];
                    suggestions.push({
                        suraNum,
                        verseNum,
                        page: parseInt(page),
                        text: `${suraNum}:${verseNum} - ${trVerseText}`,
                        type: 'verse'
                    });
                }
            }
        }
    }

    if (found) {
        suggestions.forEach(suggestion => {
            const div = document.createElement('div');
            div.textContent = suggestion.type === 'verse' 
                ? `${suggestion.text}` 
                : `${suraNum}: ${suggestion.suraName}`;
            div.onclick = () => {
                if (suggestion.type === 'verse') {
                    currentPage = suggestion.page;
                    displayPage(currentPage);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    currentPage = sureToPageMap[suggestion.suraNum];
                    displayPage(currentPage);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                box.innerHTML = '';
                box.style.display = 'none';
                e.target.value = '';
            };
            box.appendChild(div);
        });
        box.style.display = 'block';
    } else {
        box.style.display = 'none';
    }
});

document.getElementById('searchInput').addEventListener('blur', () => {
    setTimeout(() => {
        document.getElementById('autocomplete').style.display = 'none';
    }, 200);
});

document.getElementById('searchInput').addEventListener('focus', () => {
    const val = document.getElementById('searchInput').value.toLowerCase().trim();
    if (val.length >= 2) {
        document.getElementById('autocomplete').style.display = 'block';
    }
});

(async () => {
    await loadData();
    await loadManualDictionary();
    buildSuraMenu();
    currentPage = 23;
    displayPage(currentPage);
})();
