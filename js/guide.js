const SETTINGS_KEY = 'quranAppSettings';
const RETURN_URL_KEY = 'kuranTeyitGuideReturnUrl';

const THEME_CLASSES = [
  'light-theme',
  'dark-theme',
  'green-theme',
  'indigo-theme',
  'brown-theme',
  'sky-theme',
  'blackyellow-theme',
  'bluemaize-theme',
  'redpeach-theme',
  'greenolive-theme'
];

const THEME_COLORS = {
  light: '#7a5f3a',
  dark: '#1e293b',
  green: '#0f241b',
  indigo: '#1c1e39',
  brown: '#2a1d14',
  sky: '#2b7faa',
  blackyellow: '#050505',
  bluemaize: '#0e3458',
  redpeach: '#341018',
  greenolive: '#283216'
};

function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

    return {
      theme: THEME_COLORS[parsed.theme] ? parsed.theme : 'dark',
      fontSize: ['small', 'medium', 'large'].includes(parsed.fontSize)
        ? parsed.fontSize
        : 'medium'
    };
  } catch (error) {
    return {
      theme: 'dark',
      fontSize: 'medium'
    };
  }
}

function applySavedAppearance() {
  const settings = readSettings();
  const themeClass = `${settings.theme}-theme`;

  document.documentElement.classList.remove(...THEME_CLASSES);
  document.body.classList.remove(...THEME_CLASSES);

  document.documentElement.classList.add(themeClass);
  document.body.classList.add(themeClass);

  const rootSize = settings.fontSize === 'small'
    ? 14
    : settings.fontSize === 'large'
      ? 20
      : 16;

  document.documentElement.style.fontSize = `${rootSize}px`;

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[settings.theme]);
}

function returnToApplication() {
  const savedUrl = sessionStorage.getItem(RETURN_URL_KEY);

  if (history.length > 1 && document.referrer) {
    history.back();
    return;
  }

  window.location.href = savedUrl || './index.html';
}

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

function setupGuideSearch() {
  const input = document.getElementById('guideSearch');
  const status = document.getElementById('guideSearchStatus');
  const sections = [...document.querySelectorAll('.guide-section')];

  if (!input || !status) return;

  const runSearch = () => {
    const query = normalizeText(input.value);
    let matchCount = 0;

    sections.forEach((section) => {
      const matches = !query || normalizeText(section.textContent).includes(query);

      section.hidden = !matches;

      if (matches) {
        matchCount += 1;
        if (query) section.open = true;
      }
    });

    if (!query) {
      status.textContent = '';
      return;
    }

    status.textContent = matchCount
      ? `${matchCount} kılavuz bölümü eşleşti.`
      : 'Bu ifadeyle eşleşen kılavuz bölümü bulunamadı.';
  };

  input.addEventListener('input', runSearch);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      runSearch();
      input.blur();
    }
  });
}

function setupSectionControls() {
  const sections = [...document.querySelectorAll('.guide-section')];

  document.getElementById('expandAllBtn')?.addEventListener('click', () => {
    sections.filter((section) => !section.hidden).forEach((section) => {
      section.open = true;
    });
  });

  document.getElementById('collapseAllBtn')?.addEventListener('click', () => {
    sections.forEach((section) => {
      section.open = false;
    });
  });
}

function openHashSection() {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (!id) return;

  const target = document.getElementById(id);
  if (!(target instanceof HTMLDetailsElement)) return;

  target.open = true;

  requestAnimationFrame(() => {
    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

function setupNavigation() {
  document.getElementById('guideBackBtn')?.addEventListener('click', returnToApplication);
  document.getElementById('guideReturnBottomBtn')?.addEventListener('click', returnToApplication);

  document.getElementById('guideTopBtn')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('hashchange', openHashSection);
}

applySavedAppearance();
setupGuideSearch();
setupSectionControls();
setupNavigation();
openHashSection();
